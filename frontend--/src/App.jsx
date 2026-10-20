
import React, { useEffect, useState } from "react";
import POSCheckout from "./POSCheckout";
import "./App.css";

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    :'https://electro-pos-backend.onrender.com/api';

// Format prices consistently throughout the application.
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

// Display completed sales in a reusable table.
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

// Dashboard page with a summary of shop activity.
function Dashboard({ sales, products, openPage }) {
  const totalSales = sales.reduce((runningTotal, sale) => {
    return runningTotal + (Number(sale.total_amount) || 0);
  }, 0);

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
          <span className="stat-icon purple">↗</span>
          <p>Total Sales</p>
          <h2>{formatPrice(totalSales)}</h2>
        </article>

        <article className="stat-card">
          <span className="stat-icon blue">□</span>
          <p>Products</p>
          <h2>{products.length}</h2>
        </article>

        <article className="stat-card">
          <span className="stat-icon orange">!</span>
          <p>Low Stock</p>
          <h2>{lowStockCount}</h2>
        </article>

        <article className="stat-card">
          <span className="stat-icon green">✓</span>
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
            View All →
          </button>
        </div>

        <SalesTable sales={sales.slice(0, 5)} />
      </section>
    </>
  );
}

// Products page: add new products and view existing inventory.
function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  // Values entered into the Add Product form.
  const [productForm, setProductForm] = useState({
    name: "",
    brand: "",
    price: "",
    quantity: "",
    low_stock_threshold: "5",
    serial_number: "",
    category_id: "",
  });

  // Get the inventory and category lists from Flask.
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

  // Load information when the Products page opens.
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

  // Update the field the user is currently typing into.
  function handleInputChange(event) {
    const { name, value } = event.target;

    setProductForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  }

  // Clear all the fields after a product has been saved.
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

  // Save a new product in the SQLite database through Flask.
  async function handleAddProduct(event) {
    event.preventDefault();

    setMessage("");

    const price = Number(productForm.price);
    const quantity = Number(productForm.quantity);
    const lowStockThreshold = Number(productForm.low_stock_threshold);

    // Check the entered details before sending them to the backend.
    if (!productForm.name.trim()) {
      setMessage("Please enter a product name.");
      setMessageType("error");
      return;
    }

    if (productForm.price.trim() === "" ||
        !Number.isFinite(price) || price < 0) {
      setMessage("Please enter a valid selling price.");
      setMessageType("error");
      return;
    }

    if (productForm.quantity.trim() === "" ||
        !Number.isInteger(quantity) || quantity < 0) {
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

      // Refresh the table so it includes the new product.
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
            messageType === "error"
              ? "error-banner"
              : "success-banner"
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

// Reusable page for viewing categories.
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

// Sidebar links.
const navigationItems = [
  { name: "Dashboard", icon: "▦" },
  { name: "POS / Checkout", icon: "▣" },
  { name: "Products", icon: "□" },
  { name: "Categories", icon: "▤" },
  { name: "Sales History", icon: "↗" },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState("Dashboard");
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [dashboardError, setDashboardError] = useState("");

  // Load sales and products for the dashboard and sales history.
  useEffect(() => {
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
  }, [currentPage]);

  // Select the page that should appear in the main content area.
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">E</div>

          <div>
            <strong>Electro<span>POS</span></strong>
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
                currentPage === item.name
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => setCurrentPage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">ES</div>
          <div>
            <strong>Shop Manager</strong>
            <small>Administrator</small>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{currentPage}</strong>
          </div>

          <span className="system-status">● System Online</span>
        </header>

        <div className="page-content">
          {dashboardError && (
            <div className="error-banner">
              Could not load dashboard information: {dashboardError}.
              Check that the Flask backend is running.
            </div>
          )}

          {displayPage()}
        </div>

        <footer className="app-footer">
          <span>ElectroPOS</span>
          <span>Electronic Shop Management System</span>
        </footer>
      </main>
    </div>
  );
}

