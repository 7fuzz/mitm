import json
import uuid
import time
import re
import aiohttp
import os
from urllib.parse import unquote, urlencode
from aiohttp import web


class RepeaterHandlers:
    def __init__(self, bridge, db):
        self.bridge = bridge
        self.db = db

    async def handle_repeater_get(self, request):
        """Get repeater requests, optionally filtered by group"""
        group_id_param = request.query.get("groupId", "All")

        # Use order_index for sorting
        query = """SELECT rw.id, rw.name, rw.group_id, rg.name, rw.method, rw.url, rw.request, rw.response, rw.timestamp, rw.order_index, rw.extract 
                   FROM repeater_workspace rw 
                   LEFT JOIN repeater_groups rg ON rw.group_id = rg.id"""
        params = ()

        if group_id_param == "null":
            query += " WHERE rw.group_id IS NULL"
        elif group_id_param != "All":
            query += " WHERE rw.group_id = ?"
            params = (group_id_param,)

        query += " ORDER BY rw.order_index ASC, rw.timestamp ASC"

        rows = self.db.execute(query, params).fetchall()

        result = []
        for r in rows:
            req = json.loads(r[6]) if r[6] else {}
            res = json.loads(r[7]) if r[7] else None
            item = {
                "id": r[0],
                "name": r[1],
                "groupId": r[2],
                "group": r[3] or "Default",
                "method": r[4],
                "url": r[5],
                "headers": req.get("headers", {}),
                "body": req.get("body", ""),
                "timestamp": r[8],
                "orderIndex": r[9] if len(r) > 9 else 0,
                "extract": json.loads(r[10]) if len(r) > 10 and r[10] else {}
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
        """Batch update or reorder requests"""
        data = await request.json()
        
        # If data is a list of reordered IDs
        if isinstance(data, list):
            for idx, item in enumerate(data):
                item_id = item if isinstance(item, str) else item.get("id")
                if item_id:
                    self.db.execute(
                        "UPDATE repeater_workspace SET order_index = ? WHERE id = ?",
                        (idx, item_id)
                    )
            self.db.commit()
            return web.json_response({"success": True})
            
        # Legacy full sync logic
        self.db.execute("DELETE FROM repeater_workspace")

        for idx, item in enumerate(data):
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

            group_id = item.get("groupId")

            self.db.execute(
                "INSERT INTO repeater_workspace (id, name, group_id, method, url, request, response, timestamp, order_index, extract) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    item["id"],
                    item["name"],
                    group_id,
                    item["method"],
                    item["url"],
                    json.dumps(req_data),
                    json.dumps(res_data) if res_data else None,
                    item["timestamp"],
                    item.get("orderIndex", idx),
                    json.dumps(item.get("extract", {}))
                ),
            )
        self.db.commit()
        return web.json_response({"success": True})

    async def handle_repeater_create(self, request):
        try:
            data = await request.json()
            is_raw = request.query.get("raw") == "true"
            item_id = str(uuid.uuid4())
            group_id = data.get("groupId")

            headers = data.get("headers", {})
            body = data.get("body", "")
            
            # --- AUTO-CONVERT FORM DATA & EXTRACT FILES ---
            ct = ""
            for k, v in headers.items():
                if k.lower() == 'content-type':
                    ct = v.lower()
                    break
            
            if not is_raw and 'multipart/form-data' in ct and body:
                boundary_match = re.search(r'boundary=(?:"([^"]+)"|([^;]+))', ct, re.I)
                boundary = boundary_match.group(1) or boundary_match.group(2) if boundary_match else None
                if boundary:
                    # Split by boundary
                    separator = '--' + boundary
                    parts = body.split(separator)
                    form_entries = []
                    
                    for part in parts:
                        # Skip empty parts or terminal markers
                        if not part.strip() or part.strip() == '--':
                            continue
                            
                        if 'name=' in part:
                            name_match = re.search(r'name="([^"]+)"', part)
                            filename_match = re.search(r'filename="([^"]+)"', part)
                            content_type_match = re.search(r'content-type:\s*([^\s\r\n]+)', part, re.I)
                            
                            # Standard multipart uses \r\n\r\n to separate headers from value
                            header_body_split = re.split(r'\r?\n\r?\n', part, 1)
                            
                            if name_match and len(header_body_split) > 1:
                                k = name_match.group(1)
                                ct_inner = content_type_match.group(1) if content_type_match else ""
                                v_raw = header_body_split[1]
                                # Clean up potential trailing newline from the split
                                v_final = v_raw.rstrip('\r\n')
                                
                                if filename_match:
                                    filename = filename_match.group(1)
                                    ext = os.path.splitext(filename)[1]
                                    unique_name = f"{uuid.uuid4()}{ext}"
                                    os.makedirs("data/file", exist_ok=True)
                                    
                                    file_path = os.path.join("data/file", unique_name)
                                    with open(file_path, 'wb') as f:
                                        if isinstance(v_final, str):
                                            # Recover binary data from string using latin-1
                                            try:
                                                f.write(v_final.encode('latin-1'))
                                            except UnicodeEncodeError:
                                                f.write(v_final.encode('utf-8', errors='ignore'))
                                        else:
                                            f.write(v_final)
                                            
                                    form_entries.append({"k": k, "v": unique_name, "type": "file", "fileName": filename, "contentType": ct_inner})
                                else:
                                    form_entries.append({"k": k, "v": v_final, "type": "text", "contentType": ct_inner})
                    
                    if form_entries:
                        body = json.dumps({
                            "__form_data": form_entries,
                            "_hint": "Auto-extracted from multipart"
                        })

            req_data = {
                "headers": headers,
                "body": body,
            }

            # Find next order index
            order_index = 0
            row = self.db.execute("SELECT MAX(order_index) FROM repeater_workspace WHERE group_id IS ?", (group_id,) if group_id else (None,)).fetchone()
            if row and row[0] is not None:
                order_index = row[0] + 1

            self.db.execute(
                "INSERT INTO repeater_workspace (id, name, group_id, method, url, request, response, timestamp, order_index, extract) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    item_id,
                    data.get("name", "New Request"),
                    group_id,
                    data.get("method", "GET"),
                    data.get("url", ""),
                    json.dumps(req_data),
                    None,
                    int(time.time() * 1000),
                    order_index,
                    json.dumps(data.get("extract", {}))
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

            if "extract" in data:
                self.db.execute(
                    "UPDATE repeater_workspace SET extract = ? WHERE id = ?",
                    (json.dumps(data["extract"]), item_id),
                )

            if "orderIndex" in data:
                self.db.execute(
                    "UPDATE repeater_workspace SET order_index = ? WHERE id = ?",
                    (data["orderIndex"], item_id),
                )

            # 1. Update Group ID cleanly
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

            # 1. CASCADE DELETE: Destroy all requests inside this workspace first
            self.db.execute(
                "DELETE FROM repeater_workspace WHERE group_id = ?", (group_id,)
            )

            # 2. Destroy the group itself
            self.db.execute("DELETE FROM repeater_groups WHERE id = ?", (group_id,))

            self.db.commit()
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_group_reorder(self, request):
        try:
            data = await request.json()
            if not isinstance(data, list):
                return web.json_response({"error": "Expected list of IDs"}, status=400)
            
            for idx, group_id in enumerate(data):
                self.db.update_group_order(group_id, idx)
            
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    async def handle_repeat(self, request):
        data = await request.json()
        repeater_id = data.get("id") # Optional: can be passed if we want to associate with a repeater item
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

            # --- NEW: Form Data Reconstruction Support ---
            form_data = None
            if isinstance(body, str) and body.startswith('{') and '"__form_data"' in body:
                try:
                    parsed_body = json.loads(body)
                    if "__form_data" in parsed_body:
                        form_data = aiohttp.FormData()
                        for entry in parsed_body["__form_data"]:
                            k = interpolate(entry.get("k", ""))
                            v = interpolate(entry.get("v", ""))
                            entry_ct = entry.get("contentType")
                            
                            if entry.get("type") == "file" and v:
                                file_path = os.path.join("data/file", v)
                                if os.path.exists(file_path):
                                    filename = entry.get("fileName", v)
                                    # Pass explicit content_type if available
                                    field_kwargs = {"filename": filename}
                                    if entry_ct:
                                        field_kwargs["content_type"] = entry_ct
                                    
                                    form_data.add_field(k, open(file_path, 'rb'), **field_kwargs)
                                else:
                                    form_data.add_field(k, v)
                            else:
                                if entry_ct:
                                    form_data.add_field(k, v, content_type=entry_ct)
                                else:
                                    form_data.add_field(k, v)
                except Exception as e:
                    print(f"Error parsing form data: {e}")

            async with aiohttp.ClientSession() as session:
                kwargs = {"headers": headers, "ssl": False}
                if form_data:
                    kwargs["data"] = form_data
                    # aiohttp will set the correct multipart Content-Type header
                    if "content-type" in headers:
                        del headers["content-type"]
                elif body and method != "GET":
                    kwargs["data"] = body
                async with session.request(method, url, **kwargs) as resp:
                    resp_headers = dict(resp.headers)
                    resp_body = await resp.text()

                    # --- SAVE TO HISTORY ---
                    if repeater_id:
                        history_id = str(uuid.uuid4())
                        req_data = json.dumps({"headers": headers, "body": body})
                        res_data = json.dumps({"status": resp.status, "headers": resp_headers, "body": resp_body})
                        self.db.execute(
                            "INSERT INTO repeater_history (id, repeater_id, method, url, request, response, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            (history_id, repeater_id, method, url, req_data, res_data, int(time.time() * 1000))
                        )
                        self.db.commit()

                    return web.json_response(
                        {
                            "success": True,
                            "status": resp.status,
                            "headers": resp_headers,
                            "body": resp_body,
                        }
                    )
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_history_get(self, request):
        try:
            repeater_id = request.match_info["id"]
            rows = self.db.execute(
                "SELECT id, method, url, request, response, timestamp FROM repeater_history WHERE repeater_id = ? ORDER BY timestamp DESC",
                (repeater_id,)
            ).fetchall()
            
            result = []
            for r in rows:
                req = json.loads(r[3]) if r[3] else {}
                res = json.loads(r[4]) if r[4] else {}
                result.append({
                    "id": r[0],
                    "method": r[1],
                    "url": r[2],
                    "headers": req.get("headers", {}),
                    "body": req.get("body", ""),
                    "response": {
                        "status": res.get("status", 0),
                        "headers": res.get("headers", {}),
                        "body": res.get("body", ""),
                    },
                    "timestamp": r[5]
                })
            return web.json_response(result)
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_history_delete(self, request):
        try:
            repeater_id = request.match_info["id"]
            self.db.execute("DELETE FROM repeater_history WHERE repeater_id = ?", (repeater_id,))
            self.db.commit()
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_postman_import(self, request):
        """Import Postman collection OR our own custom exported format"""
        try:
            data = await request.json()
            postman_data = data.get("collection", {})
            import_env = data.get("importEnv", False)
            
            # Detect our custom format
            if "test_cases" in data:
                return await self.handle_custom_import(data, import_env)

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
                    
                    # Find next order index in group
                    order_index = 0
                    row = self.db.execute("SELECT MAX(order_index) FROM repeater_workspace WHERE group_id = ?", (final_group_id,)).fetchone()
                    if row and row[0] is not None:
                        order_index = row[0] + 1

                    self.db.execute(
                        "INSERT INTO repeater_workspace (id, name, group_id, method, url, request, response, timestamp, order_index, extract) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (
                            item_id,
                            item_name,
                            final_group_id,
                            method,
                            url,
                            json.dumps({"headers": headers, "body": body}),
                            None,
                            int(time.time() * 1000),
                            order_index,
                            json.dumps({})
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

    async def handle_custom_import(self, data, import_env):
        """Logic for our internal export format"""
        try:
            project_name = data.get("name", "Imported Project")
            global_url = data.get("url", "")
            global_headers = data.get("header", {})
            placeholders = data.get("placeholders", {})
            test_cases = data.get("test_cases", [])

            # 1. Optional Environment Import
            if import_env and placeholders:
                env_id = str(uuid.uuid4())
                self.db.execute("INSERT INTO environments (id, name, is_active) VALUES (?, ?, 0)", (env_id, project_name))
                for k, v in placeholders.items():
                    var_id = str(uuid.uuid4())
                    self.db.execute("INSERT INTO variables (id, environment_id, name, active_index) VALUES (?, ?, ?, ?)", (var_id, env_id, k, 0))
                    self.db.execute("INSERT INTO variable_values (id, variable_id, name, value) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), var_id, "Default", str(v)))
            
            # 2. Import Repeater Requests
            imported_count = 0
            for tc in test_cases:
                group_name = tc.get("name", "Imported Group")
                group_url = tc.get("url", global_url)
                targets = tc.get("target", [])

                # Create or get group
                group_row = self.db.execute("SELECT id FROM repeater_groups WHERE name = ?", (group_name,)).fetchone()
                if not group_row:
                    group_id = str(uuid.uuid4())
                    group_order = (self.db.execute("SELECT MAX(order_index) FROM repeater_groups").fetchone()[0] or -1)
                    self.db.execute("INSERT INTO repeater_groups (id, name, order_index, timestamp) VALUES (?, ?, ?, ?)",
                                (group_id, group_name, group_order + 1, int(time.time() * 1000)))
                else:
                    group_id = group_row[0]

                for target in targets:
                    item_name = target.get("name", "Untitled")
                    endpoint = target.get("endpoint", "")
                    method = target.get("method", "GET")
                    
                    # Merge headers
                    headers = {**global_headers, **target.get("header", {})}
                    # Remove nullified headers
                    headers = {k: v for k, v in headers.items() if v is not None}

                    # Construct full URL if needed
                    full_url = group_url + endpoint
                    
                    # Append params if present
                    params = target.get("params", {})
                    if params:
                        query_str = urlencode(params)
                        if "?" in full_url:
                            full_url += "&" + query_str
                        else:
                            full_url += "?" + query_str

                    body = target.get("body", "")
                    if not isinstance(body, str):
                        body = json.dumps(body)

                    item_id = str(uuid.uuid4())
                    
                    # Find next order index in group
                    order_index = 0
                    row = self.db.execute("SELECT MAX(order_index) FROM repeater_workspace WHERE group_id = ?", (group_id,)).fetchone()
                    if row and row[0] is not None:
                        order_index = row[0] + 1

                    # Merge extractions
                    extract = target.get("extract", {})
                    if "get_id_from_response" in target:
                        extract["id"] = target["get_id_from_response"]

                    self.db.execute(
                        "INSERT INTO repeater_workspace (id, name, group_id, method, url, request, response, timestamp, order_index, extract) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (item_id, item_name, group_id, method, full_url, json.dumps({"headers": headers, "body": body}), None, int(time.time() * 1000), order_index, json.dumps(extract))
                    )
                    imported_count += 1
            
            self.db.commit()
            return web.json_response({"success": True, "imported": imported_count})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)
