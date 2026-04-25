import json
import os
import re
from urllib.parse import unquote
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
                # 1. Grab variables from the frontend payload (default to empty dict)
                variables = data.get("variables", {})

                # 2. The Interpolation Engine
                def interpolate(text):
                    if not text or not isinstance(text, str):
                        return text
                    # Replace {{var}}
                    text = re.sub(
                        r"\{\{([^}]+)\}\}",
                        lambda m: str(variables.get(m.group(1).strip(), m.group(0))),
                        text,
                    )
                    # Replace URL-encoded %7B%7Bvar%7D%7D
                    return re.sub(
                        r"%7B%7B(.*?)%7D%7D",
                        lambda m: str(
                            variables.get(unquote(m.group(1)).strip(), m.group(0))
                        ),
                        text,
                        flags=re.IGNORECASE,
                    )

                # 3. Apply interpolations before mutating the actual mitmproxy flow
                if phase == "request":
                    if "method" in data:
                        flow.request.method = interpolate(data["method"]).upper()
                    if "url" in data:
                        flow.request.url = interpolate(data["url"])
                    if "body" in data:
                        flow.request.text = interpolate(data["body"])
                        flow.request.headers.pop("Content-Length", None)
                    if "headers" in data:
                        flow.request.headers.clear()
                        for k, v in data["headers"].items():
                            interp_k = interpolate(k)
                            # Ensure we don't mess up content-length calculation
                            if interp_k.lower() != "content-length":
                                flow.request.headers[interp_k] = str(interpolate(v))

                elif phase == "response":
                    if "status_code" in data:
                        flow.response.status_code = int(data["status_code"])
                    if "body" in data:
                        flow.response.text = interpolate(data["body"])
                        flow.response.headers.pop("Content-Length", None)
                    if "headers" in data:
                        flow.response.headers.clear()
                        for k, v in data["headers"].items():
                            interp_k = interpolate(k)
                            if interp_k.lower() != "content-length":
                                flow.response.headers[interp_k] = str(interpolate(v))

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
