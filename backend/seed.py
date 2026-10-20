
from database import get_db, init_db


def seed_database():
    # Create the database tables if they do not exist.
    init_db()

    conn = get_db()

    try:
        cursor = conn.cursor()

        # Add the product categories to the database.
        categories = [
            ("Laptops",),
            ("Accessories",),
            ("Smartphones",),
            ("Networking",)
        ]

        cursor.executemany("""
            INSERT OR IGNORE INTO categories (name)
            VALUES (?)
        """, categories)

        conn.commit()

        # Get the IDs of the categories we just added.
        category_rows = cursor.execute(
            "SELECT id, name FROM categories"
        ).fetchall()

        category_ids = {
            row["name"]: row["id"]
            for row in category_rows
        }

        # Add some sample products to the shop.
        products = [
            (
                "HP ProBook",
                "HP",
                45000.00,
                10,
                3,
                "HP-9921",
                category_ids.get("Laptops")
            ),
            (
                "Dell Latitude",
                "Dell",
                38000.00,
                8,
                2,
                "DL-4412",
                category_ids.get("Laptops")
            ),
            (
                "Wireless Mouse",
                "Logitech",
                1500.00,
                25,
                5,
                "LOG-882",
                category_ids.get("Accessories")
            ),
            (
                "Type-C Cable",
                "Remax",
                500.00,
                50,
                10,
                None,
                category_ids.get("Accessories")
            )
        ]

        # Save the sample products without adding duplicates.
        cursor.executemany("""
            INSERT INTO products (
                name,
                brand,
                price,
                quantity,
                low_stock_threshold,
                serial_number,
                category_id
            )
            SELECT ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
                SELECT 1
                FROM products
                WHERE serial_number = ?
                  AND serial_number IS NOT NULL
            )
        """, [
            product + (product[5],)
            for product in products
            if product[5] is not None
        ])

        # Add products without serial numbers only if they do not exist.
        cursor.execute("""
            INSERT INTO products (
                name,
                brand,
                price,
                quantity,
                low_stock_threshold,
                serial_number,
                category_id
            )
            SELECT ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
                SELECT 1
                FROM products
                WHERE name = ?
                  AND brand = ?
                  AND serial_number IS NULL
            )
        """, (
            "Type-C Cable",
            "Remax",
            500.00,
            50,
            10,
            None,
            category_ids.get("Accessories"),
            "Type-C Cable",
            "Remax"
        ))

        conn.commit()

        print("Sample categories and products added successfully!")

    except Exception:
        # Undo unsaved changes if something goes wrong.
        conn.rollback()
        raise

    finally:
        # Close the database connection when finished.
        conn.close()


# Run this file when we want to add sample data.
if __name__ == "__main__":
    seed_database()

