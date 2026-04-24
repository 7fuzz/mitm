import json
from aiohttp import web


class HistoryHandlers:
    def __init__(self, bridge, db):
        self.bridge = bridge
        self.db = db

    async def handle_history_get(self, request):
        rows = self.db.execute(
            "SELECT id, method, url, status_code, request, response, timestamp FROM history_log ORDER BY timestamp ASC"
        ).fetchall()
        result = []
        for r in rows:
            req = json.loads(r[4]) if r[4] else {}
            res = json.loads(r[5]) if r[5] else {}
            host = req.get("headers", {}).get(
                "Host", req.get("headers", {}).get("host", "")
            )
            if not host and "://" in r[2]:
                host = r[2].split("://")[1].split("/")[0]
            result.append(
                {
                    "id": r[0],
                    "phase": "history",
                    "method": r[1],
                    "url": r[2],
                    "host": host,
                    "status_code": r[3],
                    "request_headers": req.get("headers", {}),
                    "request_body": req.get("body", ""),
                    "response_headers": res.get("headers", {}),
                    "response_body": res.get("body", ""),
                    "is_intercepted": False,
                    "intercepted_at": r[6],
                }
            )
        return web.json_response(result)

    async def handle_history_delete(self, request):
        self.db.execute("DELETE FROM history_log")
        self.db.commit()
        return web.Response(text="OK")

    async def handle_history_delete_single(self, request):
        self.db.execute(
            "DELETE FROM history_log WHERE id=?", (request.match_info["id"],)
        )
        self.db.commit()
        return web.Response(text="OK")
