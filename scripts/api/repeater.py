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
        rows = self.db.execute(
            "SELECT id, name, method, url, request, response, timestamp FROM repeater_workspace ORDER BY timestamp ASC"
        ).fetchall()
        result = []
        for r in rows:
            req = json.loads(r[4]) if r[4] else {}
            res = json.loads(r[5]) if r[5] else None
            item = {
                "id": r[0],
                "name": r[1],
                "method": r[2],
                "url": r[3],
                "headers": req.get("headers", {}),
                "body": req.get("body", ""),
                "timestamp": r[6],
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
        data = await request.json()
        self.db.execute("DELETE FROM repeater_workspace")
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
            self.db.execute(
                "INSERT INTO repeater_workspace (id, name, method, url, request, response, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    item["id"],
                    item["name"],
                    item["method"],
                    item["url"],
                    json.dumps(req_data),
                    json.dumps(res_data) if res_data else None,
                    item["timestamp"],
                ),
            )
        self.db.commit()
        return web.json_response({"success": True})

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
