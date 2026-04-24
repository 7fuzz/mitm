import json
import os
from aiohttp import web


class CoreHandlers:
    def __init__(self, bridge, db):
        self.bridge = bridge
        self.db = db

    async def handle_state_get(self, request):
        rows = self.db.execute("SELECT key, value FROM app_state").fetchall()
        state = {r[0]: json.loads(r[1]) for r in rows}
        state["queue"] = [v["payload"] for v in self.bridge.waiting_flows.values()]
        return web.json_response(state)

    async def handle_state_post(self, request):
        data = await request.json()
        for k, v in data.items():
            self.db.execute(
                "INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)",
                (k, json.dumps(v)),
            )
            if k == "preferences":
                self.bridge.prefs = v
        self.db.commit()
        self.bridge.load_state()
        return web.json_response({"success": True})

    async def handle_resume(self, request):
        flow_id = request.match_info["id"]
        data = await request.json()
        if flow_id in self.bridge.waiting_flows:
            stored = self.bridge.waiting_flows[flow_id]
            flow, event, phase = stored["flow"], stored["event"], stored["phase"]

            if data.get("drop"):
                flow.kill()
            else:
                if phase == "request":
                    if "method" in data:
                        flow.request.method = data["method"]
                    if "url" in data:
                        flow.request.url = data["url"]
                    if "body" in data:
                        flow.request.text = data["body"]
                        flow.request.headers.pop("Content-Length", None)
                    if "headers" in data:
                        flow.request.headers.clear()
                        for k, v in data["headers"].items():
                            flow.request.headers[k] = str(v)
                elif phase == "response":
                    if "status_code" in data:
                        flow.response.status_code = int(data["status_code"])
                    if "body" in data:
                        flow.response.text = data["body"]
                        flow.response.headers.pop("Content-Length", None)
                    if "headers" in data:
                        flow.response.headers.clear()
                        for k, v in data["headers"].items():
                            flow.response.headers[k] = str(v)
            event.set()
            return web.Response(text="Resumed")
        return web.Response(text="Not Found", status=404)

    async def handle_get_cert(self, request):
        cert_path = os.path.expanduser("~/.mitmproxy/mitmproxy-ca-cert.pem")
        if os.path.exists(cert_path):
            return web.FileResponse(
                cert_path,
                headers={
                    "Content-Disposition": 'attachment; filename="mitmproxy-ca-cert.pem"'
                },
            )
        return web.Response(text="Not found", status=404)
