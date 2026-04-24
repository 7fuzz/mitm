import asyncio
import aiohttp
import time
import json
import base64
from mitmproxy import ctx

from db import Database
from server import APIServer


class InterceptBridge:
    def __init__(self):
        self.waiting_flows = {}
        self.db = Database()
        self.server = APIServer(self)
        self.load_state()

    def load_state(self):
        self.prefs = self.db.get_state_key(
            "preferences",
            {
                "history": True,
                "repeater": True,
                "bindings": True,
                "limits": True,
                "intercept": True,
            },
        )

        ic = (
            self.db.get_state_key("intercept", {})
            if self.prefs.get("intercept")
            else {}
        )
        self.intercept_enabled = ic.get("enabled", False)
        self.intercept_mode = ic.get("mode", "both")
        self.ignored_methods = ic.get("ignored", ["OPTIONS"])

        if self.prefs.get("bindings"):
            net = self.db.get_state_key("network", {"bindings": ["8080"]})
            modes = [
                f"regular@{str(b).strip()}"
                for b in net.get("bindings", ["8080"])
                if str(b).strip()
            ]
            if modes:
                ctx.options.mode = modes

    def load(self, loader):
        asyncio.create_task(self.server.start())
        ctx.log.info("Command Server started on http://127.0.0.1:3001")

    def should_intercept(self, flow, phase):
        if not self.intercept_enabled:
            return False
        if flow.request.method.upper() in self.ignored_methods:
            return False
        if self.intercept_mode in ["both", phase]:
            return True
        return False

    async def send_to_dashboard(self, payload):
        try:
            async with aiohttp.ClientSession() as session:
                await session.post("http://127.0.0.1:3000/api/traffic", json=payload)
        except Exception:
            pass

        if self.prefs.get("history") and payload.get("phase") != "request":
            req_data = {
                "headers": payload.get("request_headers", {}),
                "body": payload.get("request_body", ""),
            }
            res_data = {
                "headers": payload.get("response_headers", {}),
                "body": payload.get("response_body", ""),
            }

            # 1. Insert the new traffic log
            self.db.execute(
                """INSERT OR REPLACE INTO history_log (id, method, url, status_code, request, response, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    payload["id"],
                    payload.get("method"),
                    payload.get("url"),
                    payload.get("status_code", 0),
                    json.dumps(req_data),
                    json.dumps(res_data),
                    payload.get("intercepted_at", int(time.time() * 1000)),
                ),
            )

            # 2. Check if limits are actually enabled in preferences
            limits_pref = self.prefs.get("limits", True)
            limit_enabled = True
            max_history = 1000

            # Handle both boolean toggles and object configs
            if isinstance(limits_pref, dict):
                limit_enabled = limits_pref.get("enabled", True)
                max_history = limits_pref.get("maxHistory", 1000)
            elif isinstance(limits_pref, bool):
                limit_enabled = limits_pref

            # 3. Only run the rolling buffer vacuum if limits are ON
            if limit_enabled:
                self.db.execute(
                    """
                    DELETE FROM history_log 
                    WHERE id NOT IN (
                        SELECT id FROM history_log 
                        ORDER BY timestamp DESC 
                        LIMIT ?
                    )
                """,
                    (max_history,),
                )

            self.db.commit()

    async def request(self, flow):
        if self.should_intercept(flow, "request"):
            payload = {
                "id": flow.id,
                "phase": "request",
                "method": flow.request.method,
                "url": flow.request.url,
                "host": flow.request.host,
                "status_code": 0,
                "request_headers": dict(flow.request.headers),
                "response_headers": {},
                "request_body": (flow.request.get_text() or "")[:500000],
                "response_body": "",
                "is_intercepted": True,
                "intercepted_at": int(time.time() * 1000),
            }
            await self.send_to_dashboard(payload)
            event = asyncio.Event()
            self.waiting_flows[flow.id] = {
                "flow": flow,
                "event": event,
                "phase": "request",
                "payload": payload,
            }
            await event.wait()
            del self.waiting_flows[flow.id]

    async def response(self, flow):
        intercepted = self.should_intercept(flow, "response")
        content_type = flow.response.headers.get("Content-Type", "").lower()
        is_binary = any(
            t in content_type
            for t in [
                "image/",
                "video/",
                "audio/",
                "application/pdf",
                "application/zip",
                "application/octet-stream",
            ]
        )
        try:
            if is_binary and flow.response.content:
                res_body = base64.b64encode(flow.response.content).decode("utf-8")
            else:
                res_body = flow.response.get_text() or ""
        except:
            res_body = "<Binary data could not be decoded>"

        payload = {
            "id": flow.id,
            "phase": "response" if intercepted else "history",
            "method": flow.request.method,
            "url": flow.request.url,
            "host": flow.request.host,
            "status_code": flow.response.status_code,
            "request_headers": dict(flow.request.headers),
            "response_headers": dict(flow.response.headers),
            "request_body": (flow.request.get_text() or "")[:500000],
            "response_body": res_body[:5000000],
            "is_intercepted": intercepted,
            "intercepted_at": int(time.time() * 1000),
        }
        await self.send_to_dashboard(payload)

        if intercepted:
            event = asyncio.Event()
            self.waiting_flows[flow.id] = {
                "flow": flow,
                "event": event,
                "phase": "response",
                "payload": payload,
            }
            await event.wait()
            del self.waiting_flows[flow.id]


addons = [InterceptBridge()]
