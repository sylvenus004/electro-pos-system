
import React, { useEffect, useState } from "react";
import POSCheckout from "./POSCheckout";
import "./App.css";

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

// This component shows a table of completed sales
function SalesTable({ sales }) {
  if (sales.length === 0) {
    return (
      <div className="empty-state">
        <h3>No sales recorded</h3>
        <p>Completed transactions will appear here.</p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Sale ID</th>
            <th>Date</th>
            <th>Total Amount</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id}>
              <td className="id-cell">#{sale.id}</td>
              <td>{sale.created_at || "—"}</td>
              <td className="amount-cell">
                {formatPrice(sale.total_amount)}
              </td>
              <td>
                <span className="status-pill">Completed</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// This is the Dashboard page that shows a summary of the shop
function Dashboard({ sales, products, openPage }) {
  // Calculate total money made from all sales
  const totalSales = sales.reduce((runningTotal, sale) => {
    return runningTotal + (Number(sale.total_amount) || 0);
  }, 0);

  // Count how many products are running low on stock
  const lowStockCount = products.filter((product) => {
    const quantity = Number(product.quantity) || 0;
    const minimumStock = Number(product.low_stock_threshold ?? 5);

    return quantity <= minimumStock;
  }).length;

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome to your electronic shop management system.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => openPage("POS / Checkout")}
        >
          + New Sale
        </button>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <p>Total Sales</p>
          <h2>{formatPrice(totalSales)}</h2>
        </article>

        <article className="stat-card">
          <p>Products</p>
          <h2>{products.length}</h2>
        </article>

        <article className="stat-card">
          <p>Low Stock</p>
          <h2>{lowStockCount}</h2>
        </article>

        <article className="stat-card">
          <p>Completed Sales</p>
          <h2>{sales.length}</h2>
        </article>
      </div>

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Recent Sales</h2>
            <p>Your latest transactions.</p>
          </div>

          <button
            className="text-button"
            onClick={() => openPage("Sales History")}
          >
            View All
          </button>
        </div>

        <SalesTable sales={sales.slice(0, 5)} />
      </section>
    </>
  );
}

// This is the Products page where you can add and view products
function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  // These are the values typed into the Add Product form
  const [productForm, setProductForm] = useState({
    name: "",
    brand: "",
    price: "",
    quantity: "",
    low_stock_threshold: "5",
    serial_number: "",
    category_id: "",
  });

  // This function gets products and categories from the backend
  async function loadProductsAndCategories() {
    const [productsResponse, categoriesResponse] = await Promise.all([
      fetch(`${API_URL}/products`),
      fetch(`${API_URL}/categories`),
    ]);

    const productData = await productsResponse.json();
    const categoryData = await categoriesResponse.json();

    if (!productsResponse.ok) {
      throw new Error(productData.error || "Could not load products.");
    }

    if (!categoriesResponse.ok) {
      throw new Error(categoryData.error || "Could not load categories.");
    }

    if (!Array.isArray(productData) || !Array.isArray(categoryData)) {
      throw new Error("The server returned an unexpected response.");
    }

    setProducts(productData);
    setCategories(categoryData);
  }

  // Load products and categories when the page opens
  useEffect(() => {
    async function loadPage() {
      try {
        await loadProductsAndCategories();
      } catch (error) {
        setMessage(error.message);
        setMessageType("error");
      } finally {
        setIsLoading(false);
      }
    }

    loadPage();
  }, []);

  // Update the form when the user types
  function handleInputChange(event) {
    const { name, value } = event.target;

    setProductForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  }

  // Clear the form after saving a product
  function resetProductForm() {
    setProductForm({
      name: "",
      brand: "",
      price: "",
      quantity: "",
      low_stock_threshold: "5",
      serial_number: "",
      category_id: "",
    });
  }

  // This function runs when the user clicks Save Product
  async function handleAddProduct(event) {
    event.preventDefault();

    setMessage("");

    const price = Number(productForm.price);
    const quantity = Number(productForm.quantity);
    const lowStockThreshold = Number(productForm.low_stock_threshold);

    // Simple checks before sending data to the backend
    if (!productForm.name.trim()) {
      setMessage("Please enter a product name.");
      setMessageType("error");
      return;
    }

    if (
      productForm.price.trim() === "" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      setMessage("Please enter a valid selling price.");
      setMessageType("error");
      return;
    }

    if (
      productForm.quantity.trim() === "" ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      setMessage("Quantity must be a whole number of zero or more.");
      setMessageType("error");
      return;
    }

    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      setMessage("The low-stock threshold must be a whole number.");
      setMessageType("error");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: productForm.name.trim(),
          brand: productForm.brand.trim(),
          price: price,
          quantity: quantity,
          low_stock_threshold: lowStockThreshold,
          serial_number: productForm.serial_number.trim(),
          category_id: productForm.category_id || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not save the product.");
      }

      // Refresh the product list after saving
      await loadProductsAndCategories();

      resetProductForm();
      setShowForm(false);
      setMessage("Product added successfully!");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Products</h1>
          <p>Add products and manage your shop inventory.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setShowForm((previousValue) => !previousValue);
            setMessage("");
          }}
        >
          {showForm ? "Cancel" : "+ Add Product"}
        </button>
      </div>

      {message && (
        <div
          className={
            messageType === "error" ? "error-banner" : "success-banner"
          }
          role={messageType === "error" ? "alert" : "status"}
        >
          {message}
        </div>
      )}

      {showForm && (
        <section className="content-card product-form-card">
          <h2>Add New Product</h2>
          <p>Enter the product details below.</p>

          <form onSubmit={handleAddProduct}>
            <div className="product-form-grid">
              <label>
                Product Name *
                <input
                  name="name"
                  value={productForm.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Samsung Galaxy A15"
                  required
                />
              </label>

              <label>
                Brand
                <input
                  name="brand"
                  value={productForm.brand}
                  onChange={handleInputChange}
                  placeholder="e.g. Samsung"
                />
              </label>

              <label>
                Selling Price (KSh) *
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={handleInputChange}
                  placeholder="e.g. 25000"
                  required
                />
              </label>

              <label>
                Quantity in Stock *
                <input
                  name="quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.quantity}
                  onChange={handleInputChange}
                  placeholder="e.g. 10"
                  required
                />
              </label>

              <label>
                Low Stock Alert At
                <input
                  name="low_stock_threshold"
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.low_stock_threshold}
                  onChange={handleInputChange}
                />
              </label>

              <label>
                Category
                <select
                  name="category_id"
                  value={productForm.category_id}
                  onChange={handleInputChange}
                >
                  <option value="">No category selected</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="full-width-field">
                Serial Number
                <input
                  name="serial_number"
                  value={productForm.serial_number}
                  onChange={handleInputChange}
                  placeholder="Optional"
                />
              </label>
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={isSaving}
            >
              {isSaving ? "Saving Product..." : "Save Product"}
            </button>
          </form>
        </section>
      )}

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Product Inventory</h2>
            <p>{products.length} product records</p>
          </div>
        </div>

        {isLoading ? (
          <p className="loading-text">Loading products...</p>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <h3>No products found</h3>
            <p>Click Add Product to register your first product.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Product</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Serial Number</th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="id-cell">#{product.id}</td>
                    <td>{product.name}</td>
                    <td>{product.brand || "—"}</td>
                    <td>{product.category_name || "—"}</td>
                    <td className="amount-cell">
                      {formatPrice(product.price)}
                    </td>
                    <td>{product.quantity}</td>
                    <td>{product.serial_number || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// This page shows all product categories
function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch(`${API_URL}/categories`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load categories.");
        }

        setCategories(data);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadCategories();
  }, []);

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Categories</h1>
          <p>View the categories used to organize your products.</p>
        </div>
      </div>

      <section className="content-card">
        {isLoading ? (
          <p className="loading-text">Loading categories...</p>
        ) : errorMessage ? (
          <div className="error-banner">{errorMessage}</div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <h3>No categories found</h3>
            <p>You can add categories to your database when needed.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category Name</th>
                </tr>
              </thead>

              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>#{category.id}</td>
                    <td>{category.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// These are the links shown in the sidebar
const navigationItems = [
  { name: "Dashboard" },
  { name: "POS / Checkout" },
  { name: "Products" },
  { name: "Categories" },
  { name: "Sales History" },
];

export default function App() {
  // Check if a user is already logged in
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [isRegistering, setIsRegistering] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [currentPage, setCurrentPage] = useState("Dashboard");
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [dashboardError, setDashboardError] = useState("");

  // This runs when the user clicks Login or Register
  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");

    const endpoint = isRegistering
      ? `${API_URL}/register`
      : `${API_URL}/login`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername,
          password: authPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      if (isRegistering) {
        alert("Registration successful! Please log in.");
        setIsRegistering(false);
        setAuthPassword("");
      } else {
        // Save the user details so they stay logged in
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  }

  // Log the user out
  function handleLogout() {
    localStorage.removeItem("user");
    setUser(null);
  }

  // Load sales and products when the user is logged in
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function loadDashboardData() {
      try {
        const [salesResponse, productsResponse] = await Promise.all([
          fetch(`${API_URL}/sales`),
          fetch(`${API_URL}/products`),
        ]);

        const salesData = await salesResponse.json();
        const productsData = await productsResponse.json();

        if (!salesResponse.ok) {
          throw new Error(salesData.error || "Could not load sales.");
        }

        if (!productsResponse.ok) {
          throw new Error(productsData.error || "Could not load products.");
        }

        if (!Array.isArray(salesData) || !Array.isArray(productsData)) {
          throw new Error("The server returned unexpected data.");
        }

        if (isMounted) {
          setSales(salesData);
          setProducts(productsData);
          setDashboardError("");
        }
      } catch (error) {
        if (isMounted) {
          setDashboardError(error.message);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [currentPage, user]);

  // If the user is not logged in, show the login screen
  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "#f4f6f9",
        }}
      >
        <form
          onSubmit={handleAuthSubmit}
          style={{
            background: "white",
            padding: "30px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            width: "320px",
          }}
        >
          <h2 style={{ marginBottom: "20px", textAlign: "center" }}>
            {isRegistering ? "Register Account" : "POS Login"}
          </h2>

          {authError && (
            <p
              style={{
                color: "red",
                fontSize: "14px",
                marginBottom: "15px",
              }}
            >
              {authError}
            </p>
          )}

          <div style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "8px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "8px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "10px",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isRegistering ? "Register" : "Login"}
          </button>

          <p
            style={{
              textAlign: "center",
              marginTop: "15px",
              fontSize: "13px",
            }}
          >
            <span
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError("");
              }}
              style={{
                color: "#007bff",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {isRegistering
                ? "Already have an account? Login"
                : "Need an account? Register"}
            </span>
          </p>
        </form>
      </div>
    );
  }

  // This decides which page to show in the main area
  function displayPage() {
    switch (currentPage) {
      case "POS / Checkout":
        return <POSCheckout />;

      case "Products":
        return <ProductsPage />;

      case "Categories":
        return <CategoriesPage />;

      case "Sales History":
        return (
          <>
            <div className="page-heading">
              <div>
                <h1>Sales History</h1>
                <p>Review the transactions completed by your shop.</p>
              </div>

              <button
                className="secondary-button"
                onClick={() => setCurrentPage("Dashboard")}
              >
                Back to Dashboard
              </button>
            </div>

            <section className="content-card">
              <SalesTable sales={sales} />
            </section>
          </>
        );

      default:
        return (
          <Dashboard
            sales={sales}
            products={products}
            openPage={setCurrentPage}
          />
        );
    }
  }

  // Main layout of the application after login
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">E</div>

          <div>
            <strong>
              Electro<span>POS</span>
            </strong>
            <small>SHOP MANAGEMENT</small>
          </div>
        </div>

        <p className="nav-caption">MAIN MENU</p>

        <nav className="side-nav">
          {navigationItems.map((item) => (
            <button
              key={item.name}
              type="button"
              className={
                currentPage === item.name ? "nav-item active" : "nav-item"
              }
              onClick={() => setCurrentPage(item.name)}
            >
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        <div
          className="sidebar-footer"
          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="user-avatar">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>{user.username}</strong>
              <small>{user.role}</small>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "6px",
              background: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{currentPage}</strong>
          </div>

          <span className="system-status">System Online</span>
        </header>

        <div className="content-body">
          {dashboardError && (
            <div className="error-banner" role="alert">
              {dashboardError}
            </div>
          )}
          {displayPage()}
        </div>
      </main>
    </div>
  );
}
