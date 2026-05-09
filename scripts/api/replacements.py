from aiohttp import web


class ReplacementHandlers:
    def __init__(self, bridge, db):
        self.bridge = bridge
        self.db = db

    async def handle_replacements_get(self, request):
        """Get all replacements grouped by type with order info"""
        try:
            data = self.db.get_replacements_api()
            return web.json_response(data)
        except Exception as e:
            print(f"Error getting replacements: {e}")
            return web.json_response({"error": str(e)}, status=500)

    async def handle_replacements_post(self, request):
        """Save replacements (bulk or incremental)"""
        try:
            incremental = request.query.get("incremental", "false").lower() == "true"
            data = await request.json()
            result = self.db.save_replacements_bulk_api(data, incremental=incremental)
            return web.json_response(result)
        except Exception as e:
            print(f"Error saving replacements: {e}")
            return web.json_response({"error": str(e)}, status=500)

    async def handle_replacements_put(self, request):
        """Update replacement order"""
        try:
            data = await request.json()
            items = data.get("items", [])
            result = self.db.update_replacement_order_api(items)
            return web.json_response(result)
        except Exception as e:
            print(f"Error updating replacement order: {e}")
            return web.json_response({"error": str(e)}, status=500)

    async def handle_replacements_delete(self, request):
        """Delete a specific replacement"""
        try:
            data = await request.json()
            replacement_id = data.get("id")
            result = self.db.delete_replacement_api(replacement_id)
            return web.json_response(result)
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)