import sqlite3
import json


class Database:
    def __init__(self, db_path="data/master_database.sqlite"):
        # Ensure directory exists
        import os
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
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
            order_index INTEGER DEFAULT 0,
            extract TEXT,
            FOREIGN KEY(group_id) REFERENCES repeater_groups(id) ON DELETE SET NULL
        )""")

        # Repeater History table for historical sends
        self.conn.execute("""CREATE TABLE IF NOT EXISTS repeater_history (
            id TEXT PRIMARY KEY,
            repeater_id TEXT,
            method TEXT,
            url TEXT,
            request TEXT,
            response TEXT,
            timestamp INTEGER,
            FOREIGN KEY(repeater_id) REFERENCES repeater_workspace(id) ON DELETE CASCADE
        )""")

        # Migration: Add missing columns if they don't exist
        try:
            self.conn.execute("ALTER TABLE repeater_workspace ADD COLUMN order_index INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass # already exists
        
        try:
            self.conn.execute("ALTER TABLE repeater_workspace ADD COLUMN extract TEXT")
        except sqlite3.OperationalError:
            pass # already exists

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
        
        # Migration: Add missing columns if they don't exist
        try:
            self.conn.execute("ALTER TABLE replacements ADD COLUMN is_active INTEGER DEFAULT 1")
        except sqlite3.OperationalError:
            pass # already exists
            
        try:
            self.conn.execute("ALTER TABLE replacements ADD COLUMN order_index INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass # already exists

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
        rows = self.execute("SELECT id, type, pattern, replacement, description, is_active, order_index FROM replacements ORDER BY type, order_index").fetchall()
        return [
            {"id": r[0], "type": r[1], "pattern": r[2], "replacement": r[3], "description": r[4], "is_active": bool(r[5]), "order_index": r[6]}
            for r in rows
        ]

    def get_replacements_by_type(self, replacement_type):
        rows = self.execute("SELECT id, type, pattern, replacement, description, is_active, order_index FROM replacements WHERE type = ? AND is_active = 1 ORDER BY order_index", (replacement_type,)).fetchall()
        return {r[2]: r[3] for r in rows}

    def save_replacement(self, id, replacement_type, pattern, replacement, description="", order_index=0, is_active=1):
        self.execute(
            """INSERT OR REPLACE INTO replacements (id, type, pattern, replacement, description, is_active, order_index, updated_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))""",
            (id, replacement_type, pattern, replacement, description, is_active, order_index)
        )
        self.commit()

    def delete_replacement(self, id):
        self.execute("DELETE FROM replacements WHERE id = ?", (id,))
        self.commit()

    def update_replacement_order(self, id, order_index):
        self.execute("UPDATE replacements SET order_index = ?, updated_at = strftime('%s', 'now') WHERE id = ?", (order_index, id))
        self.commit()

    def update_group_order(self, id, order_index):
        self.execute("UPDATE repeater_groups SET order_index = ? WHERE id = ?", (order_index, id))
        self.commit()

    def bulk_save_replacements(self, replacements_list):
        for item in replacements_list:
            self.execute(
                """INSERT OR REPLACE INTO replacements (id, type, pattern, replacement, description, is_active, order_index, updated_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))""",
                (item.get("id"), item.get("type"), item.get("pattern"), item.get("replacement"), item.get("description", ""), 
                 1 if item.get("is_active", True) else 0, item.get("order_index", 0))
            )
        self.commit()

    # ==================== API Methods ====================
    # These methods handle the HTTP request/response logic
    # and delegate to the CRUD methods above

    def get_replacements_api(self):
        """Get all replacements grouped by type with order info (API handler)"""
        replacements = self.get_all_replacements()
        
        # Group by type for the frontend, preserving order
        grouped = {
            "URL_REPLACEMENTS": {},
            "HEADER_REPLACEMENTS": {},
            "BODY_KEY_REPLACEMENTS": {},
            "URL_PARAM_REPLACEMENTS": {},
            "TEXT_REPLACEMENTS": {}
        }
        
        # Also return ordered list for drag-and-drop
        ordered = []
        
        for r in replacements:
            r_type = r.get("type", "")
            if r_type in grouped:
                # Grouped only contains active patterns for the proxy application logic
                if r.get("is_active"):
                    grouped[r_type][r["pattern"]] = r["replacement"]
                
                ordered.append({
                    "id": r["id"],
                    "type": r_type,
                    "pattern": r["pattern"],
                    "replacement": r["replacement"],
                    "is_active": r.get("is_active", True),
                    "order_index": r.get("order_index", 0)
                })
        
        return {
            "grouped": grouped,
            "ordered": ordered
        }

    def save_replacements_bulk_api(self, data, incremental=False):
        """Save replacements with support for incremental UPSERT and list format"""
        import uuid
        
        if isinstance(data, list):
            # New format: List of replacement objects with IDs
            for item in data:
                self.save_replacement(
                    item.get("id") or str(uuid.uuid4()),
                    item.get("type"),
                    item.get("pattern"),
                    item.get("replacement"),
                    item.get("description", "Incremental update"),
                    item.get("order_index", 0),
                    1 if item.get("is_active", True) else 0
                )
            return {"success": True}

        # legacy/grouped format (dict)
        if not incremental:
             self.execute("UPDATE replacements SET is_active = 0")

        for r_type, patterns in data.items():
            if isinstance(patterns, dict):
                # Sort by order_index if provided
                sorted_items = sorted(patterns.items(), key=lambda x: x[1].get("order_index", 0) if isinstance(x[1], dict) else 0)
                for idx, (pattern, value) in enumerate(sorted_items):
                    if isinstance(value, dict):
                        # New format with order info
                        self.save_replacement(
                            value.get("id") or str(uuid.uuid4()),
                            r_type,
                            pattern,
                            value.get("replacement", ""),
                            f"Auto-saved {r_type}",
                            value.get("order_index", idx),
                            1 if value.get("is_active", True) else 0
                        )
                    else:
                        # Legacy format (just string value)
                        self.save_replacement(
                            str(uuid.uuid4()),
                            r_type,
                            pattern,
                            value,
                            f"Auto-saved {r_type}",
                            idx,
                            1
                        )
        
        return {"success": True}

    def update_replacement_order_api(self, items):
        """Update replacement order (API handler)"""
        for item in items:
            self.update_replacement_order(
                item.get("id"),
                item.get("order_index", 0)
            )
        return {"success": True}

    def delete_replacement_api(self, replacement_id):
        """Delete a specific replacement (API handler)"""
        if replacement_id:
            self.delete_replacement(replacement_id)
        return {"success": True}
