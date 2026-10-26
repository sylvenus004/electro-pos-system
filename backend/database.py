import os
import sqlite3

def get_db():
    turso_url = os.environ.get("TURSO_DATABASE_URL")
    turso_token = os.environ.get("TURSO_AUTH_TOKEN")

    if turso_url and turso_token:
        import turso_serverless
        conn = turso_serverless.connect(
            turso_url,
            auth_token=turso_token
        )
        # Optional: only if the driver supports it
        # conn.row_factory = sqlite3.Row
        return conn
    else:
        # Local development only
        conn = sqlite3.connect("database.db")
        conn.row_factory = sqlite3.Row
        return conn


def init_db():
    """Create tables on both local SQLite and Turso."""
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                brand TEXT,
                price REAL NOT NULL,
                quantity INTEGER NOT NULL,
                low_stock_threshold INTEGER DEFAULT 5,
                serial_number TEXT,
                category_id INTEGER,
                FOREIGN KEY (category_id) REFERENCES categories (id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                total_amount REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER,
                product_id INTEGER,
                product_name TEXT,
                unit_price REAL,
                quantity INTEGER,
                line_total REAL,
                FOREIGN KEY (sale_id) REFERENCES sales (id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'Cashier'
            )
        """)
        conn.commit()
        print("Database initialized successfully")
    finally:
        conn.close()
