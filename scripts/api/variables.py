import uuid
from aiohttp import web


class VariableHandlers:
    def __init__(self, bridge, db):
        self.bridge = bridge
        self.db = db
        self.ensure_default_env()

    def ensure_default_env(self):
        # Guarantee a default environment exists on boot
        row = self.db.execute("SELECT id FROM environments").fetchone()
        if not row:
            self.db.execute(
                "INSERT INTO environments VALUES (?, ?, ?)",
                ("default-env-id", "Default", 1),
            )
            self.db.commit()

    async def handle_vars_get(self, request):
        env_rows = self.db.execute(
            "SELECT id, name, is_active FROM environments"
        ).fetchall()

        active_env_id = "default-env-id"
        environments = []
        for e in env_rows:
            environments.append({"id": e[0], "name": e[1]})
            if e[2] == 1:
                active_env_id = e[0]

        requested_env_id = request.query.get("envId", active_env_id)

        var_rows = self.db.execute(
            "SELECT id, environment_id, name, active_index FROM variables WHERE environment_id = ?",
            (requested_env_id,),
        ).fetchall()

        val_rows = self.db.execute(
            """SELECT id, variable_id, name, value FROM variable_values 
               WHERE variable_id IN (SELECT id FROM variables WHERE environment_id = ?)""",
            (requested_env_id,),
        ).fetchall()

        vals_by_var = {}
        for r in val_rows:
            v_id = r[1]
            if v_id not in vals_by_var:
                vals_by_var[v_id] = []
            vals_by_var[v_id].append({"id": r[0], "name": r[2], "value": r[3]})

        variables = []
        for r in var_rows:
            v_id = r[0]
            variables.append(
                {
                    "id": v_id,
                    "environmentId": r[1],
                    "name": r[2],
                    "activeIndex": r[3],
                    "values": vals_by_var.get(
                        v_id,
                        [{"id": str(uuid.uuid4()), "name": "Default", "value": ""}],
                    ),
                }
            )

        return web.json_response(
            {
                "activeEnvironmentId": active_env_id,
                "environments": environments,
                "variables": variables,
            }
        )

    async def handle_vars_post(self, request):
        try:
            data = await request.json()
            if not data or "id" not in data:
                return web.json_response(
                    {"success": False, "error": "Missing variable ID"}, status=400
                )

            var_id = data["id"]
            self.db.execute(
                "INSERT INTO variables VALUES (?, ?, ?, ?)",
                (
                    var_id,
                    data.get("environmentId", "default-env-id"),
                    data.get("name", ""),
                    data.get("activeIndex", 0),
                ),
            )

            for val in data.get("values", []):
                self.db.execute(
                    "INSERT INTO variable_values VALUES (?, ?, ?, ?)",
                    (
                        val.get("id", str(uuid.uuid4())),
                        var_id,
                        val.get("name", ""),
                        val.get("value", ""),
                    ),
                )
            self.db.commit()
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_vars_put(self, request):
        var_id = request.match_info["id"]
        data = await request.json()
        self.db.execute(
            "UPDATE variables SET name=?, active_index=? WHERE id=?",
            (data.get("name", ""), data.get("activeIndex", 0), var_id),
        )
        self.db.execute("DELETE FROM variable_values WHERE variable_id=?", (var_id,))
        for val in data.get("values", []):
            self.db.execute(
                "INSERT INTO variable_values VALUES (?, ?, ?, ?)",
                (
                    val.get("id", str(uuid.uuid4())),
                    var_id,
                    val.get("name", ""),
                    val.get("value", ""),
                ),
            )
        self.db.commit()
        return web.json_response({"success": True})

    async def handle_vars_delete(self, request):
        var_id = request.match_info["id"]
        self.db.execute(
            "DELETE FROM variables WHERE id=?", (var_id,)
        )  # DB Cascade handles values!
        self.db.commit()
        return web.json_response({"success": True})

    async def handle_env_post(self, request):
        data = await request.json()
        env_id = data.get("id", str(uuid.uuid4()))
        env_name = data.get("name")

        if env_name:
            self.db.execute(
                "INSERT INTO environments VALUES (?, ?, 0)", (env_id, env_name)
            )

        # Set Active
        active_id = data.get("activeId", env_id)
        self.db.execute("UPDATE environments SET is_active=0")
        self.db.execute("UPDATE environments SET is_active=1 WHERE id=?", (active_id,))
        self.db.commit()
        return web.json_response({"success": True, "id": env_id})

    async def handle_env_put(self, request):
        env_id = request.match_info["id"]
        data = await request.json()
        self.db.execute(
            "UPDATE environments SET name=? WHERE id=?",
            (data.get("name", "Untitled"), env_id),
        )
        self.db.commit()
        return web.json_response({"success": True})

    async def handle_env_delete(self, request):
        env_id = request.match_info["id"]
        if env_id == "default-env-id":
            return web.json_response(
                {"success": False, "error": "Cannot delete Default"}
            )

        self.db.execute(
            "DELETE FROM environments WHERE id=?", (env_id,)
        )  # DB Cascade handles variables!
        self.db.execute("UPDATE environments SET is_active=1 WHERE id='default-env-id'")
        self.db.commit()
        return web.json_response({"success": True})
