import json
import asyncio
import aiohttp
import time
import sqlite3 # NEW
import uuid    # NEW
from aiohttp import web
from mitmproxy import ctx

class InterceptBridge:
    def __init__(self):
        self.intercept_enabled = False
        self.intercept_mode = "both"
        self.ignored_methods = ["OPTIONS"]
        self.waiting_flows = {} # Now stores a dict with the full payload
        self.init_db()

    def init_db(self):
        self.db = sqlite3.connect('proxy_vault.sqlite', check_same_thread=False)
        self.db.execute('''CREATE TABLE IF NOT EXISTS saved_traffic (
            id TEXT PRIMARY KEY, name TEXT, group_name TEXT, 
            request TEXT, response TEXT, timestamp INTEGER
        )''')
        self.db.commit()

    def load(self, loader):
        asyncio.create_task(self.start_command_server())

    async def start_command_server(self):
        app = web.Application()
        
        # Add CORS middleware
        async def cors_middleware(app, handler):
            async def middleware_handler(request):
                if request.method == 'OPTIONS':
                    return web.Response(
                        status=200,
                        headers={
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type',
                        }
                    )
                response = await handler(request)
                response.headers['Access-Control-Allow-Origin'] = '*'
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
                return response
            return middleware_handler
        
        app.middlewares.append(cors_middleware)
        
        app.router.add_post('/resume/{id}', self.handle_resume)
        app.router.add_post('/config', self.handle_config)
        app.router.add_get('/config', self.get_config)

        # DB 
        app.router.add_post('/save', self.handle_save)
        app.router.add_get('/saved', self.handle_get_saved)
        app.router.add_delete('/saved/{id}', self.handle_delete_saved)

        # Repeater
        app.router.add_post('/repeat', self.handle_repeat)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '127.0.0.1', 3001)
        await site.start()
        ctx.log.info("Command Server started on http://127.0.0.1:3001")

    # === NEW: Database Handlers ===
    async def handle_save(self, request):
        data = await request.json()
        item_id = str(uuid.uuid4())
        
        # We store request/response as JSON strings if they were checked in the UI
        req_str = json.dumps(data.get('request')) if data.get('request') else None
        res_str = json.dumps(data.get('response')) if data.get('response') else None
        
        self.db.execute("INSERT INTO saved_traffic VALUES (?, ?, ?, ?, ?, ?)",
            (item_id, data.get('name'), data.get('group'), req_str, res_str, int(time.time() * 1000)))
        self.db.commit()
        return web.json_response({"success": True, "id": item_id})

    async def handle_get_saved(self, request):
        cursor = self.db.execute("SELECT * FROM saved_traffic ORDER BY timestamp DESC")
        rows = cursor.fetchall()
        result = []
        for r in rows:
            result.append({
                "id": r[0], "name": r[1], "group": r[2],
                "request": json.loads(r[3]) if r[3] else None,
                "response": json.loads(r[4]) if r[4] else None,
                "timestamp": r[5]
            })
        return web.json_response(result)

    async def handle_delete_saved(self, request):
        item_id = request.match_info['id']
        self.db.execute("DELETE FROM saved_traffic WHERE id=?", (item_id,))
        self.db.commit()
        return web.Response(text="OK")

    async def handle_repeat(self, request):
        """Handle repeater requests - execute them through the proxy"""
        data = await request.json()
        
        try:
            method = data.get('method', 'GET').upper()
            url = data.get('url', '')
            headers = data.get('headers', {})
            body = data.get('body', '')
            
            if not url:
                return web.json_response({"error": "URL is required"}, status=400)
            
            # Execute request through aiohttp (which respects proxy settings if configured)
            async with aiohttp.ClientSession() as session:
                kwargs = {
                    'headers': headers,
                    'ssl': False,  # Ignore SSL verification for testing
                }
                
                if body and method != 'GET':
                    kwargs['data'] = body
                
                async with session.request(method, url, **kwargs) as resp:
                    response_body = await resp.text()
                    response_headers = dict(resp.headers)
                    status_code = resp.status
                    
                    return web.json_response({
                        "success": True,
                        "status": status_code,
                        "headers": response_headers,
                        "body": response_body
                    })
        
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": str(e)
            }, status=500)

    async def get_config(self, request):
        # Extract all currently paused payloads so the UI can restore them on reload
        queue = [v["payload"] for v in self.waiting_flows.values()]
        return web.json_response({
            "enabled": self.intercept_enabled,
            "mode": self.intercept_mode,
            "ignored_methods": self.ignored_methods,
            "queue": queue
        })

    async def handle_config(self, request):
        data = await request.json()
        if "enabled" in data: self.intercept_enabled = data["enabled"]
        if "mode" in data: self.intercept_mode = data["mode"]
        if "ignored_methods" in data: self.ignored_methods = data["ignored_methods"]
        return web.Response(text="OK")

    async def handle_resume(self, request):
        flow_id = request.match_info['id']
        data = await request.json()
        
        if flow_id in self.waiting_flows:
            # Unpack from the new dict structure
            stored = self.waiting_flows[flow_id]
            flow, event, phase = stored["flow"], stored["event"], stored["phase"]
            
            if data.get("drop"):
                flow.kill()
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

    async def send_to_dashboard(self, payload):
        try:
            async with aiohttp.ClientSession() as session:
                await session.post('http://127.0.0.1:3000/api/traffic', json=payload)
        except Exception:
            pass

    def should_intercept(self, flow, phase):
        if not self.intercept_enabled: return False
        if flow.request.method.upper() in self.ignored_methods: return False
        if self.intercept_mode == "both": return True
        if self.intercept_mode == phase: return True
        return False

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
                "intercepted_at": int(time.time() * 1000) # Inject Javascript-friendly timestamp
            }
            await self.send_to_dashboard(payload)
            event = asyncio.Event()
            # Store the payload so we can send it on reload
            self.waiting_flows[flow.id] = {"flow": flow, "event": event, "phase": "request", "payload": payload}
            await event.wait()
            del self.waiting_flows[flow.id]

    async def response(self, flow):
        if self.should_intercept(flow, "response"):
            payload = {
                "id": flow.id,
                "phase": "response",
                "method": flow.request.method,
                "url": flow.request.url,
                "host": flow.request.host,
                "status_code": flow.response.status_code,
                "request_headers": dict(flow.request.headers),
                "response_headers": dict(flow.response.headers),
                "request_body": (flow.request.get_text() or "")[:500000],
                "response_body": (flow.response.get_text() or "")[:500000],
                "is_intercepted": True,
                "intercepted_at": int(time.time() * 1000)
            }
            await self.send_to_dashboard(payload)
            event = asyncio.Event()
            self.waiting_flows[flow.id] = {"flow": flow, "event": event, "phase": "response", "payload": payload}
            await event.wait()
            del self.waiting_flows[flow.id]
        else:
            payload = {
                "id": flow.id,
                "phase": "history",
                "method": flow.request.method,
                "url": flow.request.url,
                "host": flow.request.host,
                "status_code": flow.response.status_code,
                "request_headers": dict(flow.request.headers),
                "response_headers": dict(flow.response.headers),
                "request_body": (flow.request.get_text() or "")[:500000],
                "response_body": (flow.response.get_text() or "")[:500000],
                "is_intercepted": False
            }
            await self.send_to_dashboard(payload)

addons = [InterceptBridge()]
