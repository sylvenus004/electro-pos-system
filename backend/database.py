import os
import sqlite3

# Check if Turso cloud credentials are provided on Vercel
TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")

def get_db():
    if TURSO_DATABASE_URL:
        # Connect to Turso in production on Vercel
        import libsql_client
        return libsql_client.connect(
            url=TURSO_DATABASE_URL,
            auth_token=TURSO_AUTH_TOKEN
        )
    else:
        # Fall back to your local SQLite database file during development
        conn = sqlite3.connect('database.db')
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    # Initialize local database tables if running locally
    if not TURSO_DATABASE_URL:
        conn = sqlite3.connect('database.db')
        
        # Create categories table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )
        """)
        
        # Create products table
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
        
        # Create sales table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                total_amount REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create sale items table
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

        # Create users table for login and registration
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
