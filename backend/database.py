import os
import sqlite3

def get_db():
    turso_url = os.environ.get("TURSO_DATABASE_URL")
    turso_token = os.environ.get("TURSO_AUTH_TOKEN")

    if turso_url:
        import libsql
        # On Vercel, use /tmp/database.db so the local replica has write permissions
        db_path = "/tmp/database.db"
        conn = libsql.connect(
            database=db_path,
            sync_url=turso_url,
            auth_token=turso_token
        )
        conn.row_factory = sqlite3.Row
        return conn
    else:
        # Local development fallback
        conn = sqlite3.connect('database.db')
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    turso_url = os.environ.get("TURSO_DATABASE_URL")
    # Determine the correct path depending on environment
    db_path = "/tmp/database.db" if turso_url else "database.db"
    
    conn = sqlite3.connect(db_path)
    
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
    conn.close()
    
