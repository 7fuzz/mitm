import sqlite3
import json

class Database:
    def __init__(self, db_path='master_database.sqlite'):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        # Enable foreign keys for cascading deletes
        self.conn.execute("PRAGMA foreign_keys = ON") 
        self.init_db()

    def init_db(self):
        self.conn.execute('''CREATE TABLE IF NOT EXISTS proxy_vault (
            id TEXT PRIMARY KEY, name TEXT, group_name TEXT, 
            request TEXT, response TEXT, timestamp INTEGER
        )''')
        
        self.conn.execute('''CREATE TABLE IF NOT EXISTS history_log (
            id TEXT PRIMARY KEY, method TEXT, url TEXT, status_code INTEGER, 
            request TEXT, response TEXT, timestamp INTEGER
        )''')
        
        self.conn.execute('''CREATE TABLE IF NOT EXISTS repeater_workspace (
            id TEXT PRIMARY KEY, name TEXT, method TEXT, url TEXT, 
            request TEXT, response TEXT, timestamp INTEGER
        )''')
        
        self.conn.execute('''CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY, value TEXT
        )''')

        self.conn.execute('''CREATE TABLE IF NOT EXISTS environments (
            name TEXT PRIMARY KEY, is_active INTEGER
        )''')

        # === NEW: 1-to-Many Relational Schema ===
        self.conn.execute('''CREATE TABLE IF NOT EXISTS variables (
            id TEXT PRIMARY KEY, environment TEXT, name TEXT, active_index INTEGER
        )''')

        self.conn.execute('''CREATE TABLE IF NOT EXISTS variable_values (
            id TEXT PRIMARY KEY, variable_id TEXT, name TEXT, value TEXT,
            FOREIGN KEY(variable_id) REFERENCES variables(id) ON DELETE CASCADE
        )''')
        
        self.conn.commit()

    def execute(self, query, params=()):
        return self.conn.execute(query, params)

    def commit(self):
        self.conn.commit()

    def get_state_key(self, key, default=None):
        row = self.execute("SELECT value FROM app_state WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else default
