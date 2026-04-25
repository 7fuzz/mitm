import json
import uuid
import time
from aiohttp import web


class VaultHandlers:
    def __init__(self, bridge, db):
        self.bridge = bridge
        self.db = db

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
