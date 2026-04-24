from aiohttp import web

# Import our new segmented handlers
from api.variables import VariableHandlers
from api.history import HistoryHandlers
from api.repeater import RepeaterHandlers
from api.core import CoreHandlers


class APIServer:
    def __init__(self, bridge):
        self.bridge = bridge
        self.db = bridge.db

    async def start(self):
        app = web.Application()

        async def cors_middleware(app, handler):
            async def middleware_handler(request):
                if request.method == "OPTIONS":
                    return web.Response(
                        status=200,
                        headers={
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                            "Access-Control-Allow-Headers": "Content-Type",
                        },
                    )
                response = await handler(request)
                response.headers["Access-Control-Allow-Origin"] = "*"
                response.headers["Access-Control-Allow-Methods"] = (
                    "GET, POST, PUT, DELETE, OPTIONS"
                )
                response.headers["Access-Control-Allow-Headers"] = "Content-Type"
                return response

            return middleware_handler

        app.middlewares.append(cors_middleware)

        # Initialize handler modules
        core = CoreHandlers(self.bridge, self.db)
        variables = VariableHandlers(self.bridge, self.db)
        history = HistoryHandlers(self.bridge, self.db)
        repeater = RepeaterHandlers(self.bridge, self.db)

        # Register Core & State Routes
        app.router.add_post("/resume/{id}", core.handle_resume)
        app.router.add_get("/cert", core.handle_get_cert)
        app.router.add_get("/state", core.handle_state_get)
        app.router.add_post("/state", core.handle_state_post)

        # Register Variables Routes
        app.router.add_get("/variables", variables.handle_vars_get)
        app.router.add_post("/variables", variables.handle_vars_post)
        app.router.add_put("/variables/{id}", variables.handle_vars_put)
        app.router.add_delete("/variables/{id}", variables.handle_vars_delete)

        # environments
        app.router.add_post("/environments", variables.handle_env_post)
        app.router.add_put("/environments/{name}", variables.handle_env_put)
        app.router.add_delete("/environments/{name}", variables.handle_env_delete)

        # Register History Routes
        app.router.add_get("/history", history.handle_history_get)
        app.router.add_delete("/history", history.handle_history_delete)
        app.router.add_delete("/history/{id}", history.handle_history_delete_single)

        # Register Repeater & Vault Routes
        app.router.add_post("/repeat", repeater.handle_repeat)
        app.router.add_post("/save", repeater.handle_save)
        app.router.add_get("/saved", repeater.handle_get_saved)
        app.router.add_delete("/saved/{id}", repeater.handle_delete_saved)
        app.router.add_get("/repeater-db", repeater.handle_repeater_get)
        app.router.add_post("/repeater-db", repeater.handle_repeater_post)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", 3001)
        await site.start()
