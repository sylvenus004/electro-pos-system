import math
import sqlite3

from flask import Flask, jsonify, request
from flask_cors import CORS

from database import get_db, init_db

app = Flask(__name__)

# Allow your React frontend to communicate with Flask.
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]
        }
    },
)


# Return errors as JSON so React can display them.
def error(message, status=400):
    return jsonify({"error": message}), status


# Check whether the backend is running.
@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


# Get all products from the database.
@app.get("/api/products")
def get_products():
    conn = get_db()

    try:
        rows = conn.execute("""
            SELECT
                p.id,
                p.name,
                p.brand,
                p.price,
                p.quantity,
                p.low_stock_threshold,
                p.serial_number,
                p.category_id,
                c.name AS category_name
            FROM products p
            LEFT JOIN categories c
                ON c.id = p.category_id
            ORDER BY p.name COLLATE NOCASE
        """).fetchall()

        products = []

        for row in rows:
            product = dict(row)

            # Mark products that have reached their low-stock threshold.
            product["low_stock"] = (
                product["quantity"] <= product["low_stock_threshold"]
            )

            products.append(product)

        return jsonify(products)

    finally:
        conn.close()


# Add a new product to inventory.
@app.post("/api/products")
def create_product():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()

    if not name:
        return error("Product name is required.")

    try:
        price = float(data.get("price"))
        quantity = int(data.get("quantity", 0))
        threshold = int(data.get("low_stock_threshold", 5))

        category_id = data.get("category_id")

        if category_id in ("", None):
            category_id = None
        else:
            category_id = int(category_id)

    except (TypeError, ValueError):
        return error(
            "Enter valid price, quantity and threshold values."
        )

    if not math.isfinite(price) or price < 0:
        return error("Price must be a valid non-negative number.")

    if quantity < 0 or threshold < 0:
        return error("Quantity and threshold cannot be negative.")

    conn = get_db()

    try:
        # Make sure the selected category exists.
        if category_id is not None:
            category = conn.execute(
                "SELECT id FROM categories WHERE id = ?",
                (category_id,)
            ).fetchone()

            if category is None:
                return error("Category not found.", 404)

        cursor = conn.execute("""
            INSERT INTO products (
                name,
                brand,
                price,
                quantity,
                low_stock_threshold,
                serial_number,
                category_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            name,
            str(data.get("brand", "")).strip() or None,
            price,
            quantity,
            threshold,
            str(data.get("serial_number", "")).strip() or None,
            category_id,
        ))

        conn.commit()

        product_id = cursor.lastrowid

        row = conn.execute("""
            SELECT
                p.id,
                p.name,
                p.brand,
                p.price,
                p.quantity,
                p.low_stock_threshold,
                p.serial_number,
                p.category_id,
                c.name AS category_name
            FROM products p
            LEFT JOIN categories c
                ON c.id = p.category_id
            WHERE p.id = ?
        """, (product_id,)).fetchone()

        product = dict(row)

        product["low_stock"] = (
            product["quantity"] <= product["low_stock_threshold"]
        )

        return jsonify(product), 201

    except sqlite3.IntegrityError as exc:
        conn.rollback()
        return error(f"Could not save product: {exc}")

    finally:
        conn.close()


# Get all product categories.
@app.get("/api/categories")
def get_categories():
    conn = get_db()

    try:
        rows = conn.execute("""
            SELECT id, name
            FROM categories
            ORDER BY name COLLATE NOCASE
        """).fetchall()

        return jsonify([dict(row) for row in rows])

    finally:
        conn.close()


# Add a new category.
@app.post("/api/categories")
def create_category():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()

    if not name:
        return error("Category name is required.")

    conn = get_db()

    try:
        cursor = conn.execute(
            "INSERT INTO categories (name) VALUES (?)",
            (name,)
        )

        conn.commit()

        return jsonify({
            "id": cursor.lastrowid,
            "name": name
        }), 201

    except sqlite3.IntegrityError:
        conn.rollback()
        return error("That category already exists.")

    finally:
        conn.close()


# Process a sale and reduce stock.
@app.post("/api/checkout")
def checkout():
    data = request.get_json(silent=True) or {}

    # Accept either {"items": [...]} or {"cart": [...]}.
    items = data.get("items")

    if items is None:
        items = data.get("cart")

    if not isinstance(items, list) or not items:
        return error("The cart is empty.")

    requested = {}

    # Validate the product IDs and quantities.
    try:
        for item in items:
            product_id = int(
                item.get("id", item.get("product_id"))
            )

            quantity = int(item.get("quantity", 0))

            if product_id <= 0 or quantity <= 0:
                return error("Invalid product ID or quantity.")

            # Combine repeated product IDs into one quantity.
            requested[product_id] = (
                requested.get(product_id, 0) + quantity
            )

    except (AttributeError, TypeError, ValueError):
        return error(
            "Cart items must contain valid IDs and quantities."
        )

    conn = get_db()

    try:
        # Prevent competing checkouts from using the same stock.
        conn.execute("BEGIN IMMEDIATE")

        total = 0.0
        checked_items = []

        # Read current prices and stock from the database.
        for product_id, quantity in requested.items():
            product = conn.execute("""
                SELECT id, name, price, quantity
                FROM products
                WHERE id = ?
            """, (product_id,)).fetchone()

            if product is None:
                conn.rollback()
                return error(
                    f"Product ID {product_id} was not found.",
                    404
                )

            price = float(product["price"])
            stock = int(product["quantity"])

            if not math.isfinite(price) or price < 0:
                conn.rollback()
                return error(
                    f"Invalid price for {product['name']}.",
                    409
                )

            if quantity > stock:
                conn.rollback()
                return error(
                    f"Not enough stock for {product['name']}. "
                    f"Available: {stock}.",
                    409
                )

            # Calculate the amount for this product.
            line_total = round(price * quantity, 2)
            total += line_total

            checked_items.append({
                "id": product_id,
                "name": product["name"],
                "price": price,
                "quantity": quantity,
                "line_total": line_total,
            })

        # Round the final sale total to two decimal places.
        total = round(total, 2)

        # Create the main sale record.
        sale_cursor = conn.execute(
            "INSERT INTO sales (total_amount) VALUES (?)",
            (total,)
        )

        sale_id = sale_cursor.lastrowid

        # Save sale items and reduce inventory stock.
        for item in checked_items:
            conn.execute("""
                INSERT INTO sale_items (
                    sale_id,
                    product_id,
                    product_name,
                    unit_price,
                    quantity,
                    line_total
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                sale_id,
                item["id"],
                item["name"],
                item["price"],
                item["quantity"],
                item["line_total"],
            ))

            conn.execute("""
                UPDATE products
                SET quantity = quantity - ?
                WHERE id = ?
            """, (
                item["quantity"],
                item["id"]
            ))

        # Read the saved sale from the database.
        sale = conn.execute("""
            SELECT id, total_amount, created_at
            FROM sales
            WHERE id = ?
        """, (sale_id,)).fetchone()

        # Save all changes together.
        conn.commit()

        # FIX: Return sale_id and total at the top level.
        # React expects data.sale_id and data.total.
        return jsonify({
            "message": "Checkout successful.",
            "sale_id": sale_id,
            "total": total,
            "sale": dict(sale),
            "items": checked_items,
        }), 201

    except sqlite3.Error as exc:
        conn.rollback()
        app.logger.exception("Checkout failed")

        return error(f"Checkout failed: {exc}", 500)

    finally:
        conn.close()


# Get the sales history.
@app.get("/api/sales")
def get_sales():
    conn = get_db()

    try:
        rows = conn.execute("""
            SELECT id, total_amount, created_at
            FROM sales
            ORDER BY id DESC
        """).fetchall()

        return jsonify([dict(row) for row in rows])

    finally:
        conn.close()


# Get one sale and all its items.
@app.get("/api/sales/<int:sale_id>")
def get_sale(sale_id):
    conn = get_db()

    try:
        sale = conn.execute("""
            SELECT id, total_amount, created_at
            FROM sales
            WHERE id = ?
        """, (sale_id,)).fetchone()

        if sale is None:
            return error("Sale not found.", 404)

        items = conn.execute("""
            SELECT
                product_id,
                product_name,
                unit_price,
                quantity,
                line_total
            FROM sale_items
            WHERE sale_id = ?
            ORDER BY id
        """, (sale_id,)).fetchall()

        result = dict(sale)
        result["items"] = [dict(item) for item in items]

        return jsonify(result)

    finally:
        conn.close()


# Start the Flask server when this file is run directly.
if __name__ == "__main__":
    init_db()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
