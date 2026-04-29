from aiohttp import web

# Import our new segmented handlers
from api.variables import VariableHandlers
from api.history import HistoryHandlers
from api.repeater import RepeaterHandlers
from api.core import CoreHandlers
from api.vault import VaultHandlers
from api.replacements import ReplacementHandlers


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
        vault = VaultHandlers(self.bridge, self.db)
        replacements = ReplacementHandlers(self.bridge, self.db)

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

        app.router.add_post("/saved", vault.handle_save)
        app.router.add_get("/saved", vault.handle_get_saved)
        app.router.add_delete("/saved/{id}", vault.handle_delete_saved)

        # Repeater CRUD (individual operations)
        app.router.add_get("/repeater-db", repeater.handle_repeater_get)
        app.router.add_post("/repeater-db", repeater.handle_repeater_post)
        app.router.add_post("/repeater", repeater.handle_repeater_create)
        app.router.add_put("/repeater/{id}", repeater.handle_repeater_update)
        app.router.add_delete("/repeater/{id}", repeater.handle_repeater_delete)

        # Repeater Groups
        app.router.add_get("/repeater-groups", repeater.handle_group_get_all)
        app.router.add_post("/repeater-groups", repeater.handle_group_create)
        app.router.add_put("/repeater-groups/{id}", repeater.handle_group_put)
        app.router.add_delete("/repeater-groups/{id}", repeater.handle_group_delete)

        # Import
        app.router.add_post("/repeater-import", repeater.handle_postman_import)

        # Replacements
        replacements = ReplacementHandlers(self.bridge, self.db)
        app.router.add_get("/replacements", replacements.handle_replacements_get)
        app.router.add_post("/replacements", replacements.handle_replacements_post)
        app.router.add_put("/replacements", replacements.handle_replacements_put)
        app.router.add_delete("/replacements", replacements.handle_replacements_delete)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", 3001)
        await site.start()
