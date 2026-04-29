import json
from aiohttp import web


class ReplacementHandlers:
    def __init__(self, bridge, db):
        self.bridge = bridge
        self.db = db

    async def handle_replacements_get(self, request):
        """Get all replacements grouped by type with order info"""
        try:
            replacements = self.db.get_all_replacements()
            
            # Group by type for the frontend, preserving order
            grouped = {
                "URL_REPLACEMENTS": {},
                "HEADER_VALUE_REPLACEMENTS": {},
                "HEADER_HOST_REPLACEMENTS": {},
                "BODY_KEY_REPLACEMENTS": {},
                "URL_PARAM_REPLACEMENTS": {}
            }
            
            # Also return ordered list for drag-and-drop
            ordered = []
            
            for r in replacements:
                r_type = r.get("type", "")
                if r_type in grouped:
                    grouped[r_type][r["pattern"]] = r["replacement"]
                    ordered.append({
                        "id": r["id"],
                        "type": r_type,
                        "pattern": r["pattern"],
                        "replacement": r["replacement"],
                        "order_index": r.get("order_index", 0)
                    })
            
            return web.json_response({
                "grouped": grouped,
                "ordered": ordered
            })
        except Exception as e:
            print(f"Error getting replacements: {e}")
            return web.json_response({"error": str(e)}, status=500)

    async def handle_replacements_post(self, request):
        """Save replacements (bulk replace) with order"""
        try:
            data = await request.json()
            
            # Clear existing and insert new
            self.db.execute("UPDATE replacements SET is_active = 0")
            
            import uuid
            order_counter = {}
            
            for r_type, patterns in data.items():
                if isinstance(patterns, dict):
                    # Sort by order_index if provided
                    sorted_items = sorted(patterns.items(), key=lambda x: x[1].get("order_index", 0) if isinstance(x[1], dict) else 0)
                    for idx, (pattern, value) in enumerate(sorted_items):
                        if isinstance(value, dict):
                            # New format with order info
                            self.db.save_replacement(
                                value.get("id") or str(uuid.uuid4()),
                                r_type,
                                pattern,
                                value.get("replacement", ""),
                                f"Auto-saved {r_type}",
                                value.get("order_index", idx)
                            )
                        else:
                            # Legacy format (just string value)
                            self.db.save_replacement(
                                str(uuid.uuid4()),
                                r_type,
                                pattern,
                                value,
                                f"Auto-saved {r_type}",
                                idx
                            )
            
            return web.json_response({"success": True})
        except Exception as e:
            print(f"Error saving replacements: {e}")
            return web.json_response({"error": str(e)}, status=500)

    async def handle_replacements_put(self, request):
        """Update replacement order"""
        try:
            data = await request.json()
            items = data.get("items", [])
            
            for item in items:
                self.db.update_replacement_order(
                    item.get("id"),
                    item.get("order_index", 0)
                )
            
            return web.json_response({"success": True})
        except Exception as e:
            print(f"Error updating replacement order: {e}")
            return web.json_response({"error": str(e)}, status=500)

    async def handle_replacements_delete(self, request):
        """Delete a specific replacement"""
        try:
            data = await request.json()
            replacement_id = data.get("id")
            if replacement_id:
                self.db.delete_replacement(replacement_id)
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)