import sqlite3
import json


class Database:
    def __init__(self, db_path="master_database.sqlite"):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        # Enable foreign keys for cascading deletes
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.init_db()

    def init_db(self):
        self.conn.execute("""CREATE TABLE IF NOT EXISTS proxy_vault (
            id TEXT PRIMARY KEY, name TEXT, group_name TEXT, 
            request TEXT, response TEXT, timestamp INTEGER
        )""")

        self.conn.execute("""CREATE TABLE IF NOT EXISTS history_log (
            id TEXT PRIMARY KEY, method TEXT, url TEXT, status_code INTEGER, 
            request TEXT, response TEXT, timestamp INTEGER
        )""")

        # Repeater groups table
        self.conn.execute("""CREATE TABLE IF NOT EXISTS repeater_groups (
            id TEXT PRIMARY KEY, name TEXT UNIQUE, order_index INTEGER DEFAULT 0, timestamp INTEGER
        )""")

        self.conn.execute("""CREATE TABLE IF NOT EXISTS repeater_workspace (
            id TEXT PRIMARY KEY, name TEXT, group_id TEXT, method TEXT, url TEXT, 
            request TEXT, response TEXT, timestamp INTEGER,
            FOREIGN KEY(group_id) REFERENCES repeater_groups(id) ON DELETE SET NULL
        )""")

        self.conn.execute("""CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY, value TEXT
        )""")

        self.conn.execute("""CREATE TABLE IF NOT EXISTS environments (
            id TEXT PRIMARY KEY, name TEXT, is_active INTEGER
        )""")

        self.conn.execute("""CREATE TABLE IF NOT EXISTS variables (
            id TEXT PRIMARY KEY, environment_id TEXT, name TEXT, active_index INTEGER,
            FOREIGN KEY(environment_id) REFERENCES environments(id) ON DELETE CASCADE
        )""")

        self.conn.execute("""CREATE TABLE IF NOT EXISTS variable_values (
            id TEXT PRIMARY KEY, variable_id TEXT, name TEXT, value TEXT,
            FOREIGN KEY(variable_id) REFERENCES variables(id) ON DELETE CASCADE
        )""")

        # Replacements table for Send to Repeater transformations
        self.conn.execute("""CREATE TABLE IF NOT EXISTS replacements (
            id TEXT PRIMARY KEY, 
            type TEXT NOT NULL, 
            pattern TEXT NOT NULL, 
            replacement TEXT NOT NULL,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            order_index INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )""")
        self.conn.commit()

    def execute(self, query, params=()):
        return self.conn.execute(query, params)

    def commit(self):
        self.conn.commit()

    def get_state_key(self, key, default=None):
        row = self.execute("SELECT value FROM app_state WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    # Replacements CRUD
    def get_all_replacements(self):
        rows = self.execute("SELECT id, type, pattern, replacement, description, is_active, order_index FROM replacements WHERE is_active = 1 ORDER BY type, order_index").fetchall()
        return [
            {"id": r[0], "type": r[1], "pattern": r[2], "replacement": r[3], "description": r[4], "is_active": bool(r[5]), "order_index": r[6]}
            for r in rows
        ]

    def get_replacements_by_type(self, replacement_type):
        rows = self.execute("SELECT id, type, pattern, replacement, description, is_active, order_index FROM replacements WHERE type = ? AND is_active = 1 ORDER BY order_index", (replacement_type,)).fetchall()
        return {r[2]: r[3] for r in rows}

    def save_replacement(self, id, replacement_type, pattern, replacement, description="", order_index=0):
        self.execute(
            """INSERT OR REPLACE INTO replacements (id, type, pattern, replacement, description, is_active, order_index, updated_at) 
               VALUES (?, ?, ?, ?, ?, 1, ?, strftime('%s', 'now'))""",
            (id, replacement_type, pattern, replacement, description, order_index)
        )
        self.commit()

    def delete_replacement(self, id):
        self.execute("UPDATE replacements SET is_active = 0 WHERE id = ?", (id,))
        self.commit()

    def update_replacement_order(self, id, order_index):
        self.execute("UPDATE replacements SET order_index = ?, updated_at = strftime('%s', 'now') WHERE id = ?", (order_index, id))
        self.commit()

    def bulk_save_replacements(self, replacements_list):
        for item in replacements_list:
            self.execute(
                """INSERT OR REPLACE INTO replacements (id, type, pattern, replacement, description, is_active, order_index, updated_at) 
                   VALUES (?, ?, ?, ?, ?, 1, ?, strftime('%s', 'now'))""",
                (item.get("id"), item.get("type"), item.get("pattern"), item.get("replacement"), item.get("description", ""), item.get("order_index", 0))
            )
        self.commit()
