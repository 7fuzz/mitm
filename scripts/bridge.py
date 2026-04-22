import json
import asyncio
import aiohttp
import time
import sqlite3
import uuid
import os
from aiohttp import web
from mitmproxy import ctx

class InterceptBridge:
    def __init__(self):
        self.waiting_flows = {}
        self.init_db()

    def init_db(self):
        self.db = sqlite3.connect('master_database.sqlite', check_same_thread=False)
        
        # Vault Table
        self.db.execute('''CREATE TABLE IF NOT EXISTS proxy_vault (
            id TEXT PRIMARY KEY, name TEXT, group_name TEXT, 
            request TEXT, response TEXT, timestamp INTEGER
        )''')
        
        # History Table
        self.db.execute('''CREATE TABLE IF NOT EXISTS history_log (
            id TEXT PRIMARY KEY, method TEXT, url TEXT, status_code INTEGER, 
            request TEXT, response TEXT, timestamp INTEGER
        )''')
        
        # Repeater Workspace Table
        self.db.execute('''CREATE TABLE IF NOT EXISTS repeater_workspace (
            id TEXT PRIMARY KEY, name TEXT, method TEXT, url TEXT, 
            request TEXT, response TEXT, timestamp INTEGER
        )''')
        
        # State Key-Value Table (For limits, bindings, etc)
        self.db.execute('''CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY, value TEXT
        )''')
        self.db.commit()
        self.load_state()

    def load_state(self):
        self.prefs = self.get_state_key("preferences", {
            "history": True, "repeater": True, "bindings": True, "limits": True, "intercept": True
        })
        
        ic = self.get_state_key("intercept", {}) if self.prefs.get("intercept") else {}
        self.intercept_enabled = ic.get("enabled", False)
        self.intercept_mode = ic.get("mode", "both")
        self.ignored_methods = ic.get("ignored", ["OPTIONS"])

        if self.prefs.get("bindings"):
            net = self.get_state_key("network", {"bindings": ["8080"]})
            modes = [f"regular@{str(b).strip()}" for b in net.get("bindings", ["8080"]) if str(b).strip()]
            if modes: ctx.options.mode = modes

    def get_state_key(self, key, default=None):
        row = self.db.execute("SELECT value FROM app_state WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def load(self, loader):
        asyncio.create_task(self.start_command_server())

    async def start_command_server(self):
        app = web.Application()
        
        async def cors_middleware(app, handler):
            async def middleware_handler(request):
                if request.method == 'OPTIONS':
                    return web.Response(status=200, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'})
                response = await handler(request)
                response.headers['Access-Control-Allow-Origin'] = '*'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
                return response
            return middleware_handler
        
        app.middlewares.append(cors_middleware)
        
        # Intercept / Options / Vault
        app.router.add_post('/resume/{id}', self.handle_resume)
        app.router.add_post('/repeat', self.handle_repeat)
        app.router.add_get('/cert', self.handle_get_cert)
        app.router.add_get('/state', self.handle_state_get)
        app.router.add_post('/state', self.handle_state_post)
        app.router.add_post('/save', self.handle_save)
        app.router.add_get('/saved', self.handle_get_saved)
        app.router.add_delete('/saved/{id}', self.handle_delete_saved)
        
        # History
        app.router.add_get('/history', self.handle_history_get)
        app.router.add_delete('/history', self.handle_history_delete)
        app.router.add_delete('/history/{id}', self.handle_history_delete_single)
        
        # Repeater Database
        app.router.add_get('/repeater-db', self.handle_repeater_get)
        app.router.add_post('/repeater-db', self.handle_repeater_post)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '127.0.0.1', 3001)
        await site.start()
        ctx.log.info("Command Server started on http://127.0.0.1:3001")

    # === Repeater DB Handlers ===
    async def handle_repeater_get(self, request):
        rows = self.db.execute("SELECT id, name, method, url, request, response, timestamp FROM repeater_workspace ORDER BY timestamp ASC").fetchall()
        result = []
        for r in rows:
            req = json.loads(r[4]) if r[4] else {}
            res = json.loads(r[5]) if r[5] else None
            item = {"id": r[0], "name": r[1], "method": r[2], "url": r[3], "headers": req.get("headers", {}), "body": req.get("body", ""), "timestamp": r[6]}
            if res: item["response"] = {"status": res.get("status", 0), "headers": res.get("headers", {}), "body": res.get("body", "")}
            result.append(item)
        return web.json_response(result)

    async def handle_repeater_post(self, request):
        data = await request.json()
        self.db.execute("DELETE FROM repeater_workspace") # Wipe and replace for bulk sync
        for item in data:
            req_data = {"headers": item.get("headers", {}), "body": item.get("body", "")}
            res_data = None
            if item.get("response"):
                res_data = {"status": item["response"].get("status"), "headers": item["response"].get("headers", {}), "body": item["response"].get("body", "")}
            self.db.execute('''INSERT INTO repeater_workspace (id, name, method, url, request, response, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)''', 
                (item["id"], item["name"], item["method"], item["url"], json.dumps(req_data), json.dumps(res_data) if res_data else None, item["timestamp"]))
        self.db.commit()
        return web.json_response({"success": True})

    # === History DB Handlers ===
    async def handle_history_get(self, request):
        rows = self.db.execute("SELECT id, method, url, status_code, request, response, timestamp FROM history_log ORDER BY timestamp ASC").fetchall()
        result = []
        for r in rows:
            req = json.loads(r[4]) if r[4] else {}
            res = json.loads(r[5]) if r[5] else {}
            host = req.get("headers", {}).get("Host", req.get("headers", {}).get("host", ""))
            if not host and "://" in r[2]: host = r[2].split("://")[1].split("/")[0]

            result.append({
                "id": r[0], "phase": "history", "method": r[1], "url": r[2], "host": host, "status_code": r[3],
                "request_headers": req.get("headers", {}), "request_body": req.get("body", ""),
                "response_headers": res.get("headers", {}), "response_body": res.get("body", ""),
                "is_intercepted": False, "intercepted_at": r[6]
            })
        return web.json_response(result)

    async def handle_history_delete(self, request):
        self.db.execute("DELETE FROM history_log")
        self.db.commit()
        return web.Response(text="OK")
        
    async def handle_history_delete_single(self, request):
        self.db.execute("DELETE FROM history_log WHERE id=?", (request.match_info['id'],))
        self.db.commit()
        return web.Response(text="OK")

    # === State Handlers ===
    async def handle_state_get(self, request):
        rows = self.db.execute("SELECT key, value FROM app_state").fetchall()
        state = {r[0]: json.loads(r[1]) for r in rows}
        state["queue"] = [v["payload"] for v in self.waiting_flows.values()]
        return web.json_response(state)

    async def handle_state_post(self, request):
        data = await request.json()
        for k, v in data.items():
            self.db.execute("INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)", (k, json.dumps(v)))
            if k == "preferences": self.prefs = v
        self.db.commit()
        self.load_state() 
        return web.json_response({"success": True})

    # === Vault Handlers ===
    async def handle_save(self, request):
        data = await request.json()
        item_id = str(uuid.uuid4())
        self.db.execute("INSERT INTO proxy_vault VALUES (?, ?, ?, ?, ?, ?)",
            (item_id, data.get('name'), data.get('group'), json.dumps(data.get('request')) if data.get('request') else None, json.dumps(data.get('response')) if data.get('response') else None, int(time.time() * 1000)))
        self.db.commit()
        return web.json_response({"success": True, "id": item_id})

    async def handle_get_saved(self, request):
        rows = self.db.execute("SELECT * FROM proxy_vault ORDER BY timestamp DESC").fetchall()
        result = []
        for r in rows:
            result.append({"id": r[0], "name": r[1], "group": r[2], "request": json.loads(r[3]) if r[3] else None, "response": json.loads(r[4]) if r[4] else None, "timestamp": r[5]})
        return web.json_response(result)

    async def handle_delete_saved(self, request):
        self.db.execute("DELETE FROM proxy_vault WHERE id=?", (request.match_info['id'],))
        self.db.commit()
        return web.Response(text="OK")

    # === Core Intercept Logic ===
    async def send_to_dashboard(self, payload):
        try:
            async with aiohttp.ClientSession() as session:
                await session.post('http://127.0.0.1:3000/api/traffic', json=payload)
        except Exception: pass
        
        # Save to History DB by breaking down the Payload
        if self.prefs.get("history") and payload.get("phase") != "request": 
            req_data = {"headers": payload.get("request_headers", {}), "body": payload.get("request_body", "")}
            res_data = {"headers": payload.get("response_headers", {}), "body": payload.get("response_body", "")}
            
            self.db.execute('''INSERT OR REPLACE INTO history_log (id, method, url, status_code, request, response, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)''', 
                (payload["id"], payload.get("method"), payload.get("url"), payload.get("status_code", 0), json.dumps(req_data), json.dumps(res_data), payload.get("intercepted_at", int(time.time() * 1000))))
            self.db.commit()

    async def handle_resume(self, request):
        flow_id = request.match_info['id']
        data = await request.json()
        if flow_id in self.waiting_flows:
            stored = self.waiting_flows[flow_id]
            flow, event, phase = stored["flow"], stored["event"], stored["phase"]
            if data.get("drop"): flow.kill()
            else:
                if phase == "request":
                    if "method" in data: flow.request.method = data["method"]
                    if "url" in data: flow.request.url = data["url"]
                    if "body" in data: flow.request.text = data["body"]
                    if "headers" in data:
                        flow.request.headers.clear()
                        for k, v in data["headers"].items(): flow.request.headers[k] = str(v)
                elif phase == "response":
                    if "status_code" in data: flow.response.status_code = int(data["status_code"])
                    if "body" in data: flow.response.text = data["body"]
                    if "headers" in data:
                        flow.response.headers.clear()
                        for k, v in data["headers"].items(): flow.response.headers[k] = str(v)
            event.set()
            return web.Response(text="Resumed")
        return web.Response(text="Not Found", status=404)

    async def handle_repeat(self, request):
        data = await request.json()
        try:
            method, url, headers, body = data.get('method', 'GET').upper(), data.get('url', ''), data.get('headers', {}), data.get('body', '')
            async with aiohttp.ClientSession() as session:
                kwargs = {'headers': headers, 'ssl': False}
                if body and method != 'GET': kwargs['data'] = body
                async with session.request(method, url, **kwargs) as resp:
                    return web.json_response({"success": True, "status": resp.status, "headers": dict(resp.headers), "body": await resp.text()})
        except Exception as e: return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_get_cert(self, request):
        cert_path = os.path.expanduser("~/.mitmproxy/mitmproxy-ca-cert.pem")
        if os.path.exists(cert_path): return web.FileResponse(cert_path, headers={'Content-Disposition': 'attachment; filename="mitmproxy-ca-cert.pem"'})
        return web.Response(text="Not found", status=404)

    def should_intercept(self, flow, phase):
        if not self.intercept_enabled: return False
        if flow.request.method.upper() in self.ignored_methods: return False
        if self.intercept_mode in ["both", phase]: return True
        return False

    async def request(self, flow):
        if self.should_intercept(flow, "request"):
            payload = {
                "id": flow.id, "phase": "request", "method": flow.request.method, "url": flow.request.url,
                "host": flow.request.host, "status_code": 0, "request_headers": dict(flow.request.headers),
                "response_headers": {}, "request_body": (flow.request.get_text() or "")[:500000], "response_body": "",
                "is_intercepted": True, "intercepted_at": int(time.time() * 1000)
            }
            await self.send_to_dashboard(payload)
            event = asyncio.Event()
            self.waiting_flows[flow.id] = {"flow": flow, "event": event, "phase": "request", "payload": payload}
            await event.wait()
            del self.waiting_flows[flow.id]

    async def response(self, flow):
        intercepted = self.should_intercept(flow, "response")
        payload = {
            "id": flow.id, "phase": "response" if intercepted else "history", "method": flow.request.method,
            "url": flow.request.url, "host": flow.request.host, "status_code": flow.response.status_code,
            "request_headers": dict(flow.request.headers), "response_headers": dict(flow.response.headers),
            "request_body": (flow.request.get_text() or "")[:500000], "response_body": (flow.response.get_text() or "")[:500000],
            "is_intercepted": intercepted, "intercepted_at": int(time.time() * 1000)
        }
        await self.send_to_dashboard(payload)
        if intercepted:
            event = asyncio.Event()
            self.waiting_flows[flow.id] = {"flow": flow, "event": event, "phase": "response", "payload": payload}
            await event.wait()
            del self.waiting_flows[flow.id]

addons = [InterceptBridge()]
