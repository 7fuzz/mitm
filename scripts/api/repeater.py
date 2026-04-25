import json
import uuid
import time
import re
import aiohttp
from urllib.parse import unquote
from aiohttp import web


class RepeaterHandlers:
    def __init__(self, bridge, db):
        self.bridge = bridge
        self.db = db

    async def handle_repeater_get(self, request):
        """Get repeater requests, optionally filtered by group"""
        group_id_param = request.query.get("groupId", "All")

        # Changed rg.id to rw.group_id for a safer source of truth
        query = """SELECT rw.id, rw.name, rw.group_id, rg.name, rw.method, rw.url, rw.request, rw.response, rw.timestamp 
                   FROM repeater_workspace rw 
                   LEFT JOIN repeater_groups rg ON rw.group_id = rg.id"""
        params = ()

        # Apply strict SQL filtering
        if group_id_param == "null":
            query += " WHERE rw.group_id IS NULL"
        elif group_id_param != "All":
            query += " WHERE rw.group_id = ?"
            params = (group_id_param,)

        query += " ORDER BY rg.order_index, rw.timestamp ASC"

        rows = self.db.execute(query, params).fetchall()

        result = []
        for r in rows:
            req = json.loads(r[6]) if r[6] else {}
            res = json.loads(r[7]) if r[7] else None
            item = {
                "id": r[0],
                "name": r[1],
                "groupId": r[2],  # Uses strict UUID
                "group": r[3] or "Default",  # Human-readable name for UI
                "method": r[4],
                "url": r[5],
                "headers": req.get("headers", {}),
                "body": req.get("body", ""),
                "timestamp": r[8],
            }
            if res:
                item["response"] = {
                    "status": res.get("status", 0),
                    "headers": res.get("headers", {}),
                    "body": res.get("body", ""),
                }
            result.append(item)

        return web.json_response(result)

    async def handle_repeater_post(self, request):
        """Full sync endpoint - completely purged of string logic"""
        data = await request.json()
        self.db.execute("DELETE FROM repeater_workspace")
        # Notice we do NOT delete groups here anymore! Groups are handled independently.

        for item in data:
            req_data = {
                "headers": item.get("headers", {}),
                "body": item.get("body", ""),
            }
            res_data = (
                {
                    "status": item["response"].get("status"),
                    "headers": item["response"].get("headers", {}),
                    "body": item["response"].get("body", ""),
                }
                if item.get("response")
                else None
            )

            # STRICT ID LINKING
            group_id = item.get("groupId")

            self.db.execute(
                "INSERT INTO repeater_workspace (id, name, group_id, method, url, request, response, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    item["id"],
                    item["name"],
                    group_id,
                    item["method"],
                    item["url"],
                    json.dumps(req_data),
                    json.dumps(res_data) if res_data else None,
                    item["timestamp"],
                ),
            )
        self.db.commit()
        return web.json_response({"success": True})

    async def handle_repeater_create(self, request):
        try:
            data = await request.json()
            item_id = str(uuid.uuid4())
            group_id = data.get("groupId")  # STRICT ID LINKING

            req_data = {
                "headers": data.get("headers", {}),
                "body": data.get("body", ""),
            }

            self.db.execute(
                "INSERT INTO repeater_workspace (id, name, group_id, method, url, request, response, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    item_id,
                    data.get("name", "New Request"),
                    group_id,
                    data.get("method", "GET"),
                    data.get("url", ""),
                    json.dumps(req_data),
                    None,
                    int(time.time() * 1000),
                ),
            )
            self.db.commit()
            return web.json_response(
                {"success": True, "id": item_id, "groupId": group_id}
            )
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_repeater_update(self, request):
        try:
            item_id = request.match_info["id"]
            data = await request.json()

            # 1. Update Group ID cleanly (No legacy string lookups fighting it anymore!)
            if "groupId" in data:
                self.db.execute(
                    "UPDATE repeater_workspace SET group_id = ? WHERE id = ?",
                    (data["groupId"], item_id),
                )

            # 2. Update Request Name
            if "name" in data:
                self.db.execute(
                    "UPDATE repeater_workspace SET name = ? WHERE id = ?",
                    (data["name"], item_id),
                )

            # 3. Update Request Line & Payload
            if any(k in data for k in ["method", "url", "headers", "body"]):
                req_obj = self.db.execute(
                    "SELECT request FROM repeater_workspace WHERE id = ?", (item_id,)
                ).fetchone()
                req_data = json.loads(req_obj[0]) if req_obj and req_obj[0] else {}

                if "method" in data:
                    self.db.execute(
                        "UPDATE repeater_workspace SET method = ? WHERE id = ?",
                        (data["method"], item_id),
                    )
                if "url" in data:
                    self.db.execute(
                        "UPDATE repeater_workspace SET url = ? WHERE id = ?",
                        (data["url"], item_id),
                    )

                if "headers" in data or "body" in data:
                    req_data["headers"] = data.get(
                        "headers", req_data.get("headers", {})
                    )
                    req_data["body"] = data.get("body", req_data.get("body", ""))
                    self.db.execute(
                        "UPDATE repeater_workspace SET request = ? WHERE id = ?",
                        (json.dumps(req_data), item_id),
                    )

            # 4. Update Response
            if "response" in data:
                res_data = data["response"]
                res_json = json.dumps(res_data) if res_data else None
                self.db.execute(
                    "UPDATE repeater_workspace SET response = ? WHERE id = ?",
                    (res_json, item_id),
                )

            self.db.commit()
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_repeater_delete(self, request):
        try:
            item_id = request.match_info["id"]
            self.db.execute("DELETE FROM repeater_workspace WHERE id = ?", (item_id,))
            self.db.commit()
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    # ==========================================
    # GROUP HANDLERS
    # ==========================================

    async def handle_group_get_all(self, request):
        try:
            rows = self.db.execute(
                "SELECT id, name, order_index, timestamp FROM repeater_groups ORDER BY order_index ASC"
            ).fetchall()
            result = [
                {"id": r[0], "name": r[1], "orderIndex": r[2], "timestamp": r[3]}
                for r in rows
            ]
            return web.json_response(result)
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_group_create(self, request):
        try:
            data = await request.json()
            group_id = str(uuid.uuid4())
            group_name = data.get("name", "New Group")

            group_order = (
                self.db.execute(
                    "SELECT MAX(order_index) FROM repeater_groups"
                ).fetchone()[0]
                or -1
            )

            self.db.execute(
                "INSERT INTO repeater_groups (id, name, order_index, timestamp) VALUES (?, ?, ?, ?)",
                (group_id, group_name, group_order + 1, int(time.time() * 1000)),
            )
            self.db.commit()
            return web.json_response(
                {"success": True, "id": group_id, "name": group_name}
            )
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_group_put(self, request):
        try:
            group_id = request.match_info["id"]
            data = await request.json()
            self.db.execute(
                "UPDATE repeater_groups SET name = ? WHERE id = ?",
                (data.get("name", "Untitled"), group_id),
            )
            self.db.commit()
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_group_delete(self, request):
        try:
            group_id = request.match_info["id"]
            self.db.execute("DELETE FROM repeater_groups WHERE id = ?", (group_id,))
            self.db.commit()
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    # ==========================================
    # VAULT & EXTRAS
    # ==========================================

    async def handle_save(self, request):
        data = await request.json()
        item_id = str(uuid.uuid4())
        self.db.execute(
            "INSERT INTO proxy_vault VALUES (?, ?, ?, ?, ?, ?)",
            (
                item_id,
                data.get("name"),
                data.get("group"),
                json.dumps(data.get("request")) if data.get("request") else None,
                json.dumps(data.get("response")) if data.get("response") else None,
                int(time.time() * 1000),
            ),
        )
        self.db.commit()
        return web.json_response({"success": True, "id": item_id})

    async def handle_get_saved(self, request):
        rows = self.db.execute(
            "SELECT * FROM proxy_vault ORDER BY timestamp DESC"
        ).fetchall()
        result = [
            {
                "id": r[0],
                "name": r[1],
                "group": r[2],
                "request": json.loads(r[3]) if r[3] else None,
                "response": json.loads(r[4]) if r[4] else None,
                "timestamp": r[5],
            }
            for r in rows
        ]
        return web.json_response(result)

    async def handle_delete_saved(self, request):
        self.db.execute(
            "DELETE FROM proxy_vault WHERE id=?", (request.match_info["id"],)
        )
        self.db.commit()
        return web.Response(text="OK")

    async def handle_repeat(self, request):
        data = await request.json()
        try:
            raw_method, raw_url, raw_headers, raw_body, variables = (
                data.get("method", "GET").upper(),
                data.get("url", ""),
                data.get("headers", {}),
                data.get("body", ""),
                data.get("variables", {}),
            )

            def interpolate(text):
                if not text or not isinstance(text, str):
                    return text
                text = re.sub(
                    r"\{\{([^}]+)\}\}",
                    lambda m: str(variables.get(m.group(1).strip(), m.group(0))),
                    text,
                )
                return re.sub(
                    r"%7B%7B(.*?)%7D%7D",
                    lambda m: str(
                        variables.get(unquote(m.group(1)).strip(), m.group(0))
                    ),
                    text,
                    flags=re.IGNORECASE,
                )

            method, url, body = raw_method, interpolate(raw_url), interpolate(raw_body)
            headers = {}
            for k, v in raw_headers.items():
                interp_k = interpolate(k)
                if interp_k.lower() != "content-length":
                    headers[interp_k] = interpolate(v)

            async with aiohttp.ClientSession() as session:
                kwargs = {"headers": headers, "ssl": False}
                if body and method != "GET":
                    kwargs["data"] = body
                async with session.request(method, url, **kwargs) as resp:
                    return web.json_response(
                        {
                            "success": True,
                            "status": resp.status,
                            "headers": dict(resp.headers),
                            "body": await resp.text(),
                        }
                    )
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_postman_import(self, request):
        """Import Postman collection JSON and dynamically resolve folder groups"""
        try:
            data = await request.json()
            postman_data = data.get("collection", {})
            root_group_name = data.get("group", "Postman Import")

            if not postman_data:
                return web.json_response(
                    {"success": False, "error": "No collection data provided"},
                    status=400,
                )

            # Create or get root group
            root_group_row = self.db.execute(
                "SELECT id FROM repeater_groups WHERE name = ?", (root_group_name,)
            ).fetchone()
            if not root_group_row:
                root_group_id = str(uuid.uuid4())
                group_order = (
                    self.db.execute(
                        "SELECT MAX(order_index) FROM repeater_groups"
                    ).fetchone()[0]
                    or -1
                )
                self.db.execute(
                    "INSERT INTO repeater_groups (id, name, order_index, timestamp) VALUES (?, ?, ?, ?)",
                    (
                        root_group_id,
                        root_group_name,
                        group_order + 1,
                        int(time.time() * 1000),
                    ),
                )
            else:
                root_group_id = root_group_row[0]

            folder_group_cache = {}
            imported_count = 0

            def get_or_create_group(group_name):
                if group_name in folder_group_cache:
                    return folder_group_cache[group_name]
                group_row = self.db.execute(
                    "SELECT id FROM repeater_groups WHERE name = ?", (group_name,)
                ).fetchone()
                if not group_row:
                    group_id = str(uuid.uuid4())
                    group_order = (
                        self.db.execute(
                            "SELECT MAX(order_index) FROM repeater_groups"
                        ).fetchone()[0]
                        or -1
                    )
                    self.db.execute(
                        "INSERT INTO repeater_groups (id, name, order_index, timestamp) VALUES (?, ?, ?, ?)",
                        (
                            group_id,
                            group_name,
                            group_order + 1,
                            int(time.time() * 1000),
                        ),
                    )
                else:
                    group_id = group_row[0]
                folder_group_cache[group_name] = group_id
                return group_id

            def parse_postman_item(item, parent_group_id=None):
                nonlocal imported_count
                item_name = item.get("name", "Untitled")

                if "item" in item and "request" not in item:
                    folder_group_id = (
                        get_or_create_group(item_name)
                        if not parent_group_id
                        else parent_group_id
                    )
                    for sub_item in item["item"]:
                        parse_postman_item(sub_item, folder_group_id)
                else:
                    req_obj = item.get("request", {})
                    method = req_obj.get("method", "GET")

                    url = ""
                    if isinstance(req_obj.get("url"), dict):
                        url_obj = req_obj["url"]
                        protocol = url_obj.get("protocol", "https")
                        host = url_obj.get("host", [])
                        if isinstance(host, list):
                            host = ".".join(host)
                        port = url_obj.get("port")
                        path = url_obj.get("path", [])
                        if isinstance(path, list):
                            path = "/" + "/".join(path)
                        url = f"{protocol}://{host}"
                        if port:
                            url += f":{port}"
                        url += path
                        query = url_obj.get("query", [])
                        if query:
                            query_str = "&".join(
                                [
                                    f"{q.get('key')}={q.get('value')}"
                                    for q in query
                                    if q.get("key")
                                ]
                            )
                            if query_str:
                                url += f"?{query_str}"
                    else:
                        url = req_obj.get("url", "")

                    headers = {}
                    for header in req_obj.get("header", []):
                        if isinstance(header, dict) and header.get("key"):
                            headers[header["key"]] = header.get("value", "")

                    body = ""
                    body_obj = req_obj.get("body", {})
                    if isinstance(body_obj, dict):
                        if body_obj.get("mode") == "raw":
                            body = body_obj.get("raw", "")
                    elif isinstance(body_obj, str):
                        body = body_obj

                    item_id = str(uuid.uuid4())
                    final_group_id = parent_group_id or root_group_id

                    self.db.execute(
                        "INSERT INTO repeater_workspace (id, name, group_id, method, url, request, response, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (
                            item_id,
                            item_name,
                            final_group_id,
                            method,
                            url,
                            json.dumps({"headers": headers, "body": body}),
                            None,
                            int(time.time() * 1000),
                        ),
                    )
                    imported_count += 1

            for item in postman_data.get("item", []):
                parse_postman_item(item)
            self.db.commit()

            return web.json_response(
                {
                    "success": True,
                    "imported": imported_count,
                    "message": f"Imported {imported_count} request(s)",
                }
            )
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)
