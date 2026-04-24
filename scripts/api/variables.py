import uuid
from aiohttp import web
from urllib.parse import unquote


class VariableHandlers:
    def __init__(self, bridge, db):
        self.bridge = bridge
        self.db = db

    async def handle_vars_get(self, request):
        env_rows = self.db.execute(
            "SELECT name, is_active FROM environments"
        ).fetchall()
        var_rows = self.db.execute(
            "SELECT id, environment, name, active_index FROM variables"
        ).fetchall()
        val_rows = self.db.execute(
            "SELECT id, variable_id, name, value FROM variable_values"
        ).fetchall()

        active_proj = "Default"
        environments = ["Default"]

        for e in env_rows:
            if e[0] not in environments:
                environments.append(e[0])
            if e[1] == 1:
                active_proj = e[0]

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
                    "project": r[1],
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
                "activeProject": active_proj,
                "environments": environments,
                "variables": variables,
            }
        )

    async def handle_vars_post(self, request):
        data = await request.json()
        var_id = data["id"]
        self.db.execute(
            "INSERT INTO variables VALUES (?, ?, ?, ?)",
            (
                var_id,
                data.get("project", "Default"),
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
        self.db.execute("DELETE FROM variable_values WHERE variable_id=?", (var_id,))
        self.db.execute("DELETE FROM variables WHERE id=?", (var_id,))
        self.db.commit()
        return web.json_response({"success": True})

    async def handle_env_post(self, request):
        data = await request.json()
        active_proj = data.get("activeProject", "Default")
        new_env = data.get("newEnvironment")
        if new_env:
            self.db.execute(
                "INSERT OR IGNORE INTO environments VALUES (?, 0)", (new_env,)
            )
        self.db.execute("UPDATE environments SET is_active=0")
        self.db.execute(
            "INSERT OR REPLACE INTO environments (name, is_active) VALUES (?, 1)",
            (active_proj,),
        )
        self.db.commit()
        return web.json_response({"success": True})

    async def handle_env_put(self, request):
        old_name = unquote(request.match_info["name"])
        data = await request.json()
        new_name = data.get("newName")

        if not new_name or old_name == "Default":
            return web.json_response(
                {"success": False, "error": "Cannot rename Default or empty"}
            )

        self.db.execute(
            "UPDATE environments SET name=? WHERE name=?", (new_name, old_name)
        )
        self.db.execute(
            "UPDATE variables SET environment=? WHERE environment=?",
            (new_name, old_name),
        )
        self.db.commit()
        return web.json_response({"success": True})

    async def handle_env_delete(self, request):
        env_name = unquote(request.match_info["name"])
        if env_name == "Default":
            return web.json_response(
                {"success": False, "error": "Cannot delete Default"}
            )

        self.db.execute("DELETE FROM environments WHERE name=?", (env_name,))
        self.db.execute("DELETE FROM variables WHERE environment=?", (env_name,))
        self.db.execute("UPDATE environments SET is_active=1 WHERE name='Default'")
        self.db.commit()
        return web.json_response({"success": True})
