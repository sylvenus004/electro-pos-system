import React, { useState, useEffect } from 'react';

// This decides which backend URL to use
// On your computer it uses localhost
// On Vercel it uses the address you set in VITE_API_URL
const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : window.location.hostname === "localhost"
    ? "http://localhost:5000/api"
    : "/api";

// This function makes prices look nice, for example 25000 becomes KSh 25,000.00
function formatPrice(price) {
  const amount = Number(price);

  if (
    price === null ||
    price === undefined ||
    price === "" ||
    !Number.isFinite(amount)
  ) {
    return "KSh 0.00";
  }

  return `KSh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function POSCheckout() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  // This function gets the list of products from the backend
  async function fetchProducts() {
    const response = await fetch(`${API_URL}/products`);

    if (!response.ok) {
      throw new Error("Could not load products.");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("The server returned an invalid product list.");
    }

    setProducts(data);
  }

  // Load products when the checkout page opens
  useEffect(() => {
    fetchProducts()
      .catch((error) => {
        console.error("Error loading products:", error);

        setMessage(
          "Could not load products. Please check that the backend is running."
        );

        setMessageType("error");
      })
      .finally(() => {
        setProductsLoading(false);
      });
  }, []);

  // Add a product to the cart if there is enough stock
  function addToCart(product) {
    setMessage("");
    setMessageType("info");

    const existing = cart.find((item) => item.id === product.id);

    const cartQuantity = existing ? existing.quantity : 0;
    const stock = Number(product.quantity);

    if (cartQuantity >= stock) {
      setMessage(`Not enough stock for ${product.name}.`);
      setMessageType("error");
      return;
    }

    if (existing) {
      // Increase the quantity if the product is already in the cart
      setCart((previousCart) =>
        previousCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        )
      );
    } else {
      // Add the product to the cart for the first time
      setCart((previousCart) => [
        ...previousCart,
        {
          ...product,
          price: Number(product.price) || 0,
          quantity: 1,
        },
      ]);
    }
  }

  // Remove a product from the cart
  function removeFromCart(productId) {
    setCart((previousCart) =>
      previousCart.filter((item) => item.id !== productId)
    );

    setMessage("");
    setMessageType("info");
  }

  // This function runs when the user clicks Complete Checkout
  async function handleCheckout() {
    if (cart.length === 0) {
      setMessage("Your cart is empty. Add a product first.");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");
    setMessageType("info");

    let checkoutSucceeded = false;

    try {
      const response = await fetch(`${API_URL}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cart: cart.map((item) => ({
            id: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      // Read the response from the server
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not complete the sale.");
      }

      const saleId = data.sale_id ?? data.sale?.id;
      const saleTotal = Number(data.total ?? data.sale?.total_amount);

      if (
        saleId === undefined ||
        saleId === null ||
        !Number.isFinite(saleTotal)
      ) {
        throw new Error(
          "The server response is missing the sale ID or total. Check Sales History before trying again."
        );
      }

      // The sale was successful
      checkoutSucceeded = true;

      setMessage(
        `Sale completed successfully! Sale ID: ${saleId}. Total: ${formatPrice(
          saleTotal
        )}`
      );

      setMessageType("success");

      // Clear the cart after a successful sale
      setCart([]);

      // Try to refresh the product list so stock numbers update
      try {
        await fetchProducts();
      } catch (refreshError) {
        console.error(
          "Sale succeeded, but products could not refresh:",
          refreshError
        );

        setMessage(
          `Sale completed successfully! Sale ID: ${saleId}. Total: ${formatPrice(
            saleTotal
          )}. Please refresh the page to update stock.`
        );

        setMessageType("success");
      }
    } catch (error) {
      console.error("Checkout error:", error);

      if (checkoutSucceeded) {
        setMessage(
          "The sale was completed, but another page update failed. Check Sales History before doing anything else."
        );
        setMessageType("success");
      } else {
        setMessage(`Checkout failed: ${error.message}`);
        setMessageType("error");
      }
    } finally {
      setLoading(false);
    }
  }

  // Calculate the total price of everything in the cart
  const totalPrice = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * item.quantity,
    0
  );

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexWrap: "wrap",
        gap: "24px",
        fontFamily: "Arial, sans-serif",
        color: "#212529",
      }}
    >
      {/* Left side - list of products */}
      <section style={{ flex: "2 1 400px" }}>
        <h2>Available Products</h2>

        <p style={{ color: "#6c757d" }}>
          Choose a product to add to the customer's cart.
        </p>

        {productsLoading ? (
          <p>Loading products...</p>
        ) : products.length === 0 ? (
          <p>
            No products available. Add some products to your inventory first.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            {products.map((product) => {
              const cartItem = cart.find((item) => item.id === product.id);

              const availableStock =
                Number(product.quantity) - (cartItem?.quantity || 0);

              return (
                <div
                  key={product.id}
                  style={{
                    border: "1px solid #dee2e6",
                    padding: "16px",
                    borderRadius: "8px",
                    background: "#fff",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>{product.name}</h3>

                  <p>
                    <strong>Brand:</strong>{" "}
                    {product.brand || "Not specified"}
                  </p>

                  <p>
                    <strong>Price:</strong> {formatPrice(product.price)}
                  </p>

                  <p>
                    <strong>Available stock:</strong> {availableStock}
                  </p>

                  {product.low_stock && (
                    <p style={{ color: "#b45309" }}>Stock is running low.</p>
                  )}

                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={availableStock <= 0}
                    style={{
                      background: availableStock > 0 ? "#0d6efd" : "#adb5bd",
                      color: "#fff",
                      border: "none",
                      padding: "10px 12px",
                      borderRadius: "5px",
                      cursor: availableStock > 0 ? "pointer" : "not-allowed",
                      width: "100%",
                    }}
                  >
                    {availableStock > 0 ? "Add to Cart" : "Out of Stock"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Right side - current cart and checkout button */}
      <section
        style={{
          flex: "1 1 280px",
          minWidth: 0,
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          padding: "20px",
          background: "#fff",
          alignSelf: "flex-start",
          boxSizing: "border-box",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Current Sale</h2>

        {/* Show success or error messages */}
        {message && (
          <p
            role={messageType === "error" ? "alert" : "status"}
            style={{
              padding: "10px",
              borderRadius: "5px",
              overflowWrap: "anywhere",
              background:
                messageType === "success"
                  ? "#d1e7dd"
                  : messageType === "error"
                  ? "#f8d7da"
                  : "#f1f3f5",
              color:
                messageType === "success"
                  ? "#0f5132"
                  : messageType === "error"
                  ? "#842029"
                  : "#212529",
            }}
          >
            {message}
          </p>
        )}

        {cart.length === 0 ? (
          <p style={{ color: "#6c757d" }}>
            Your cart is empty. Add a product to get started.
          </p>
        ) : (
          <>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {cart.map((item) => (
                <li
                  key={item.id}
                  style={{
                    marginBottom: "14px",
                    borderBottom: "1px solid #dee2e6",
                    paddingBottom: "12px",
                  }}
                >
                  <strong>{item.name}</strong>

                  <p>
                    {item.quantity} × {formatPrice(item.price)}
                  </p>

                  <p>
                    <strong>
                      {formatPrice(Number(item.price) * item.quantity)}
                    </strong>
                  </p>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    style={{
                      padding: "6px 10px",
                      border: "1px solid #dc3545",
                      color: "#dc3545",
                      background: "#fff",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            {/* Total and checkout button */}
            <div
              style={{
                borderTop: "1px solid #dee2e6",
                paddingTop: "12px",
                marginTop: "12px",
              }}
            >
              <h3>Total: {formatPrice(totalPrice)}</h3>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: loading ? "#6c757d" : "#198754",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                {loading ? "Processing Sale..." : "Complete Checkout"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
