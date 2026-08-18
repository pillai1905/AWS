import React, { useState, useMemo, useEffect } from "react";
import { 
  LayoutDashboard, Package, History, TrendingUp, AlertTriangle, 
  Plus, Edit2, Trash2, ArrowUpRight, ArrowDownRight, Edit, AlertCircle,
  Search, Calendar, X, RefreshCw, Send, CheckCircle2, TrendingDown
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from "recharts";

// ============================================================================
// 1. PSEUDORANDOM GENERATOR & MOCK DATA GENERATOR
// ============================================================================
// Simple seedable random generator to ensure consistent, realistic patterns
function createRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateMockData() {
  const rand = createRandom(42); // fixed seed for consistency
  const daysHistory = 90;
  const startDate = new Date(Date.now() - daysHistory * 24 * 60 * 60 * 1000);
  const startDateStr = startDate.toISOString().split("T")[0] + "T00:00:00Z";

  // Product configurations
  const productProfiles = [
    {
      product_id: "PROD-01",
      product_name: "EcoWidget A",
      category: "Electronics",
      reorder_level: 50,
      unit: "units",
      lead_time_days: 3,
      safety_stock: 15,
      pattern: "steady",
      base_demand: 10,
      initial_stock: 130
    },
    {
      product_id: "PROD-02",
      product_name: "IronGizmo B",
      category: "Hardware",
      reorder_level: 80,
      unit: "units",
      lead_time_days: 5,
      safety_stock: 25,
      pattern: "growing",
      base_demand: 2, // starts at 2, grows over 90 days to ~18
      initial_stock: 100
    },
    {
      product_id: "PROD-03",
      product_name: "ActiveSeason X",
      category: "Apparel",
      reorder_level: 30,
      unit: "units",
      lead_time_days: 2,
      safety_stock: 10,
      pattern: "spiky",
      base_demand: 1.5,
      initial_stock: 90
    },
    {
      product_id: "PROD-04",
      product_name: "Titanium Valve Y",
      category: "Industrial",
      reorder_level: 5,
      unit: "boxes",
      lead_time_days: 10,
      safety_stock: 2,
      pattern: "slow",
      base_demand: 0.08,
      initial_stock: 12
    },
    {
      product_id: "PROD-05",
      product_name: "Solvent Chemical Z",
      category: "Chemicals",
      reorder_level: 40,
      unit: "liters",
      lead_time_days: 4,
      safety_stock: 15,
      pattern: "depleting", // high steady sales, no restocks for last 20 days
      base_demand: 12,
      initial_stock: 80
    }
  ];

  const transactions = [];
  const products = [];

  productProfiles.forEach((profile) => {
    let currentStock = profile.initial_stock;
    const pendingRestocks = []; // list of { date: Date, quantity: number }
    
    // Create initial product metadata
    products.push({
      product_id: profile.product_id,
      product_name: profile.product_name,
      category: profile.category,
      current_stock: currentStock,
      reorder_level: profile.reorder_level,
      unit: profile.unit,
      lead_time_days: profile.lead_time_days,
      safety_stock: profile.safety_stock,
      created_at: startDateStr,
      updated_at: startDateStr
    });

    for (let day = 0; day < daysHistory; day++) {
      const currentDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const dateStr = currentDate.toISOString().split("T")[0] + "T12:00:00Z";

      // 1. Process arriving restocks
      for (let i = pendingRestocks.length - 1; i >= 0; i--) {
        const order = pendingRestocks[i];
        if (currentDate >= order.date) {
          const stockBefore = currentStock;
          currentStock += order.quantity;
          
          transactions.push({
            transaction_id: Math.random().toString(36).substring(2, 14).toUpperCase(),
            product_id: profile.product_id,
            product_name: profile.product_name,
            transaction_type: "STOCK_IN",
            quantity: order.quantity,
            stock_before: stockBefore,
            stock_after: currentStock,
            timestamp: dateStr
          });
          
          pendingRestocks.splice(i, 1);
        }
      }

      // 2. Determine demand for today
      let demand = 0;
      const pattern = profile.pattern;
      const base = profile.base_demand;

      if (pattern === "steady") {
        // normal dist approx: sum 6 random numbers
        const noise = (rand() + rand() + rand() + rand() + rand() + rand() - 3) * 2.5;
        demand = Math.max(0, Math.round(base + noise));
      } else if (pattern === "growing") {
        const trend = (day / daysHistory) * 16; // linear growth up to +16 units
        const noise = (rand() + rand() + rand() - 1.5) * 2;
        demand = Math.max(0, Math.round(base + trend + noise));
      } else if (pattern === "spiky") {
        if (rand() < 0.08) { // 8% chance of bulk order spike
          demand = Math.floor(rand() * 21) + 30; // 30-50 units
        } else {
          const noise = (rand() + rand() - 1) * 0.7;
          demand = Math.max(0, Math.round(base + noise));
        }
      } else if (pattern === "slow") {
        if (rand() < 1 / 12) { // sold once every ~12 days
          demand = 1;
        }
      } else if (pattern === "depleting") {
        const noise = (rand() + rand() + rand() - 1.5) * 2;
        demand = Math.max(0, Math.round(base + noise));
      }

      // 3. Process STOCK_OUT transaction
      if (demand > 0) {
        const actualSale = Math.min(demand, currentStock);
        if (actualSale > 0) {
          const stockBefore = currentStock;
          currentStock -= actualSale;
          
          transactions.push({
            transaction_id: Math.random().toString(36).substring(2, 14).toUpperCase(),
            product_id: profile.product_id,
            product_name: profile.product_name,
            transaction_type: "STOCK_OUT",
            quantity: actualSale,
            stock_before: stockBefore,
            stock_after: currentStock,
            timestamp: dateStr
          });
        }
      }

      // 4. Check for restock trigger
      const isDepletingLate = pattern === "depleting" && day > (daysHistory - 20);
      if (currentStock <= profile.reorder_level && pendingRestocks.length === 0 && !isDepletingLate) {
        const orderQty = profile.reorder_level * 2;
        const arrivalDate = new Date(currentDate.getTime() + profile.lead_time_days * 24 * 60 * 60 * 1000);
        pendingRestocks.push({ date: arrivalDate, quantity: orderQty });
      }
    }

    // Update product with its final calculated stock at end of history
    const prodIdx = products.findIndex(p => p.product_id === profile.product_id);
    if (prodIdx !== -1) {
      products[prodIdx].current_stock = currentStock;
      products[prodIdx].updated_at = new Date().toISOString();
    }
  });

  // Sort transactions chronologically
  transactions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  return { products, transactions };
}

// Initialize seed arrays
const { products: seedProducts, transactions: seedTransactions } = generateMockData();

// ============================================================================
// 2. MATHEMATICAL FORECASTING UTILITIES (Least-Squares Line Fitting)
// ============================================================================
function runForecasting(productId, productsList, transactionsList) {
  const product = productsList.find(p => p.product_id === productId);
  if (!product) return null;

  // 1. Gather all STOCK_OUT transactions for this product
  const stockOuts = transactionsList.filter(
    t => t.product_id === productId && t.transaction_type === "STOCK_OUT"
  );

  // 2. Aggregate demand by day
  // Map timestamps to dates
  const dailyDemandMap = {};
  stockOuts.forEach(t => {
    const dateStr = t.timestamp.split("T")[0];
    dailyDemandMap[dateStr] = (dailyDemandMap[dateStr] || 0) + t.quantity;
  });

  // Backdate daily timeline from today to product creation (or at least 30 days) to fill missing with 0
  const demandHistory = [];
  const createdDate = new Date(product.created_at);
  const today = new Date();
  
  // limit timeline to max 60 days to keep math relevant and responsive
  const startLimit = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
  const timelineStart = createdDate > startLimit ? createdDate : startLimit;
  
  let tempDate = new Date(timelineStart);
  while (tempDate <= today) {
    const dStr = tempDate.toISOString().split("T")[0];
    demandHistory.push({
      date: dStr,
      demand: dailyDemandMap[dStr] || 0
    });
    tempDate.setDate(tempDate.getDate() + 1);
  }

  const n = demandHistory.length;
  const y = demandHistory.map(h => h.demand);

  // Default fallbacks for insufficient data
  if (n < 3) {
    const totalOut = y.reduce((a, b) => a + b, 0);
    const avg = n > 0 ? totalOut / n : 0;
    const forecastDays = Array(7).fill(avg);
    const forecast7Day = avg * 7;
    return {
      forecast_1_day: avg,
      forecast_7_day: forecast7Day,
      daily_average_demand: avg,
      forecast_days: forecastDays,
      historical_demand: demandHistory,
      forecast_demand: Array.from({ length: 7 }, (_, i) => {
        const nextDate = new Date(today.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
        return { date: nextDate.toISOString().split("T")[0], demand: avg };
      }),
      metrics: {
        model_used: "Baseline Mean",
        slope: 0,
        intercept: avg,
        data_points: n,
        evaluation: { available: false }
      }
    };
  }

  // 14-day Moving Average baseline
  const maWindow = Math.min(14, n);
  const maSum = y.slice(-maWindow).reduce((a, b) => a + b, 0);
  const movingAvgDaily = maSum / maWindow;

  // Fit Linear Regression: y = m*x + c
  // x = [0, 1, 2, ..., n-1]
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += y[i];
    sumXY += i * y[i];
    sumXX += i * i;
  }
  
  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
  const c = (sumY - m * sumX) / n || 0;

  // Forecast next 7 days
  const forecastDays = [];
  const forecastDemand = [];
  for (let i = 1; i <= 7; i++) {
    // Project day T + i
    const xVal = n - 1 + i;
    const pred = Math.max(0, m * xVal + c); // clip at 0
    forecastDays.push(pred);
    
    const futureDate = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    forecastDemand.push({
      date: futureDate.toISOString().split("T")[0],
      demand: pred
    });
  }

  const forecast1Day = forecastDays[0];
  const forecast7Day = forecastDays.reduce((a, b) => a + b, 0);
  const dailyAverageDemand = forecast7Day / 7;

  // Backtesting walk-forward validation (Train on n-7, test on last 7 days)
  let evaluation = { available: false };
  if (n >= 10) {
    const trainN = n - 7;
    const trainY = y.slice(0, trainN);
    const testY = y.slice(-7);

    let tSumX = 0, tSumY = 0, tSumXY = 0, tSumXX = 0;
    for (let i = 0; i < trainN; i++) {
      tSumX += i;
      tSumY += trainY[i];
      tSumXY += i * trainY[i];
      tSumXX += i * i;
    }
    const valM = (trainN * tSumXY - tSumX * tSumY) / (trainN * tSumXX - tSumX * tSumX) || 0;
    const valC = (tSumY - valM * tSumX) / trainN || 0;

    const valPreds = [];
    for (let i = 0; i < 7; i++) {
      valPreds.push(Math.max(0, valM * (trainN + i) + valC));
    }

    // Compute error metrics
    let maeSum = 0;
    let rmseSqSum = 0;
    let mapeSum = 0;
    let mapeCount = 0;

    for (let i = 0; i < 7; i++) {
      const error = Math.abs(valPreds[i] - testY[i]);
      maeSum += error;
      rmseSqSum += error * error;
      
      if (testY[i] > 0) {
        mapeSum += error / testY[i];
        mapeCount++;
      }
    }

    evaluation = {
      available: true,
      mae: maeSum / 7,
      rmse: Math.sqrt(rmseSqSum / 7),
      mape: mapeCount > 0 ? (mapeSum / mapeCount) * 100 : 0
    };
  }

  return {
    forecast_1_day: forecast1Day,
    forecast_7_day: forecast7Day,
    daily_average_demand: dailyAverageDemand,
    forecast_days: forecastDays,
    historical_demand: demandHistory,
    forecast_demand: forecastDemand,
    metrics: {
      model_used: "Linear Regression",
      slope: m,
      intercept: c,
      data_points: n,
      daily_moving_average_14d: movingAvgDaily,
      evaluation
    }
  };
}

// Run comprehensive inventory predictions and safety calculations for a single product
function analyzeInventoryProduct(product, productsList, transactionsList) {
  const currentStock = Number(product.current_stock);
  const reorderLevel = Number(product.reorder_level);
  const leadTime = Number(product.lead_time_days || 3);
  const safetyStock = Number(product.safety_stock || 10);

  // Execute math forecasting engine
  const forecast = runForecasting(product.product_id, productsList, transactionsList);
  
  const dailyAvg = forecast ? forecast.daily_average_demand : 0;
  const forecast7 = forecast ? forecast.forecast_7_day : 0;

  // Days to stock out
  let daysToStockOut = 999;
  let riskLevel = "LOW";

  if (currentStock === 0) {
    daysToStockOut = 0;
    riskLevel = "CRITICAL";
  } else if (dailyAvg > 0.01) {
    daysToStockOut = currentStock / dailyAvg;
    if (daysToStockOut <= 3) riskLevel = "HIGH";
    else if (daysToStockOut <= 7) riskLevel = "MEDIUM";
    else riskLevel = "LOW";
  }

  // Restocking calculations
  const reorderPoint = (dailyAvg * leadTime) + safetyStock;
  const restockRequired = currentStock <= reorderPoint;
  
  let recommendedQty = 0;
  let recommendedDate = "N/A";

  if (restockRequired) {
    recommendedQty = Math.max(10, Math.ceil(forecast7 + safetyStock - currentStock));
    const daysUntilReorder = daysToStockOut - leadTime;
    if (daysUntilReorder <= 0) {
      recommendedDate = "IMMEDIATELY";
    } else {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() + Math.floor(daysUntilReorder));
      recommendedDate = orderDate.toISOString().split("T")[0];
    }
  }

  return {
    ...product,
    current_stock: currentStock,
    reorder_level: reorderLevel,
    forecast_1_day: forecast ? forecast.forecast_1_day : 0,
    forecast_7_day: forecast7,
    daily_average_demand: dailyAvg,
    days_to_stock_out: daysToStockOut,
    risk_level: riskLevel,
    restock_required: restockRequired,
    recommended_qty: recommendedQty,
    recommended_date: recommendedDate,
    reorder_point: reorderPoint,
    historical_demand: forecast ? forecast.historical_demand : [],
    forecast_demand: forecast ? forecast.forecast_demand : [],
    metrics: forecast ? forecast.metrics : { model_used: "None", evaluation: { available: false } }
  };
}

// ============================================================================
// 3. MAIN REACT APP COMPONENT
// ============================================================================
export default function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [toast, setToast] = useState(null);

  const refreshData = async () => {
    try {
      const prodRes = await fetch("http://127.0.0.1:8000/products");
      if (!prodRes.ok) throw new Error("Failed to fetch products");
      const prodData = await prodRes.json();
      setProducts(prodData);

      const txRes = await fetch("http://127.0.0.1:8000/transactions");
      if (!txRes.ok) throw new Error("Failed to fetch transactions");
      const txData = await txRes.json();
      setTransactions(txData);

      const predRes = await fetch("http://127.0.0.1:8000/predictions");
      if (!predRes.ok) throw new Error("Failed to fetch predictions");
      const predData = await predRes.json();
      setPredictions(predData);
    } catch (err) {
      console.error("Error connecting to backend API:", err);
      triggerToast("Error connecting to backend API. Using local seed data.", "error");
      
      // Seed fallback if backend is offline, to prevent blank app
      if (products.length === 0) {
        setProducts(seedProducts);
        setTransactions(seedTransactions);
        const mappedSeeds = seedProducts.map(p => 
          analyzeInventoryProduct(p, seedProducts, seedTransactions)
        );
        setPredictions(mappedSeeds);
      }
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [txProduct, setTxProduct] = useState(null);
  const [txType, setTxType] = useState("STOCK_IN"); // STOCK_IN, STOCK_OUT, ADJUST
  const [txQuantity, setTxQuantity] = useState("");

  // Product Form Input State
  const [prodId, setProdId] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("");
  const [prodInitialStock, setProdInitialStock] = useState("0");
  const [prodReorderLevel, setProdReorderLevel] = useState("10");
  const [prodUnit, setProdUnit] = useState("units");
  const [prodLeadTime, setProdLeadTime] = useState("3");
  const [prodSafetyStock, setProdSafetyStock] = useState("10");

  // Notification Toast Helper
  const triggerToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Use prediction results fetched from the local backend
  const analyzedProducts = predictions;

  // Handle Product Add / Edit submission
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    const parsedStock = parseFloat(prodInitialStock) || 0;
    const parsedReorder = parseFloat(prodReorderLevel) || 0;
    const parsedLead = parseFloat(prodLeadTime) || 3;
    const parsedSafety = parseFloat(prodSafetyStock) || 10;

    try {
      if (editingProduct) {
        // Edit mode (PUT)
        const res = await fetch(`http://127.0.0.1:8000/products/${editingProduct.product_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_name: prodName,
            category: prodCategory,
            reorder_level: parsedReorder,
            unit: prodUnit,
            lead_time_days: parsedLead,
            safety_stock: parsedSafety
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Failed to update product.");
        }
        triggerToast(`Product '${prodName}' updated successfully.`);
      } else {
        // Create mode (POST)
        const res = await fetch("http://127.0.0.1:8000/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: prodId,
            product_name: prodName,
            category: prodCategory,
            reorder_level: parsedReorder,
            unit: prodUnit,
            lead_time_days: parsedLead,
            safety_stock: parsedSafety,
            current_stock: parsedStock
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Failed to create product.");
        }
        triggerToast(`Product '${prodName}' added successfully.`);
      }
      await refreshData();
      setShowProductModal(false);
      resetProductForm();
    } catch (err) {
      console.error(err);
      triggerToast(err.message || "Failed to save product.", "error");
    }
  };

  // Reset Product Form Fields
  const resetProductForm = () => {
    setEditingProduct(null);
    setProdId("");
    setProdName("");
    setProdCategory("");
    setProdInitialStock("0");
    setProdReorderLevel("10");
    setProdUnit("units");
    setProdLeadTime("3");
    setProdSafetyStock("10");
  };

  // Open forms
  const openAddProduct = () => {
    resetProductForm();
    setShowProductModal(true);
  };

  const openEditProduct = (p) => {
    setEditingProduct(p);
    setProdId(p.product_id);
    setProdName(p.product_name);
    setProdCategory(p.category);
    setProdInitialStock(p.current_stock.toString());
    setProdReorderLevel(p.reorder_level.toString());
    setProdUnit(p.unit);
    setProdLeadTime((p.lead_time_days || 3).toString());
    setProdSafetyStock((p.safety_stock || 10).toString());
    setShowProductModal(true);
  };

  const openTransactionForm = (p, type) => {
    setTxProduct(p);
    setTxType(type);
    setTxQuantity("");
    setShowTxModal(true);
  };

  const handleDeleteProduct = async (productId, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}? This will clear it from inventory catalog.`)) {
      try {
        const res = await fetch(`http://127.0.0.1:8000/products/${productId}`, {
          method: "DELETE"
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Failed to delete product.");
        }
        triggerToast(`Product '${name}' removed from inventory.`);
        await refreshData();
      } catch (err) {
        console.error(err);
        triggerToast(err.message || "Failed to delete product.", "error");
      }
    }
  };

  // Handle Quick stock adjustments and log transactions
  const handleTxSubmit = async (e) => {
    e.preventDefault();
    const qty = parseFloat(txQuantity);
    if (isNaN(qty) || qty <= 0) {
      triggerToast("Invalid quantity.", "error");
      return;
    }

    try {
      let endpoint = "http://127.0.0.1:8000/inventory/stock-in";
      if (txType === "STOCK_OUT") {
        endpoint = "http://127.0.0.1:8000/inventory/stock-out";
      } else if (txType === "ADJUST") {
        endpoint = "http://127.0.0.1:8000/inventory/adjust";
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: txProduct.product_id,
          quantity: qty
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Transaction failed.");
      }

      const resData = await res.json();
      triggerToast(resData.message);
      await refreshData();
      setShowTxModal(false);
    } catch (err) {
      console.error(err);
      triggerToast(err.message || "Transaction failed.", "error");
    }
  };

  // Sidebar components trigger tabs
  return (
    <div className="app-container">
      {/* SIDEBAR NAVIGATION */}
      <div className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">
            <TrendingUp style={{ color: "#ffffff" }} size={20} />
          </div>
          <span className="logo-text">PredictiveInv</span>
        </div>
        <nav style={{ flexGrow: 1 }}>
          <ul className="sidebar-menu">
            <li>
              <a onClick={() => setCurrentPage("dashboard")} className={`menu-item ${currentPage === "dashboard" ? "active" : ""}`}>
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </a>
            </li>
            <li>
              <a onClick={() => setCurrentPage("inventory")} className={`menu-item ${currentPage === "inventory" ? "active" : ""}`}>
                <Package size={20} />
                <span>Products / Inventory</span>
              </a>
            </li>
            <li>
              <a onClick={() => setCurrentPage("transactions")} className={`menu-item ${currentPage === "transactions" ? "active" : ""}`}>
                <History size={20} />
                <span>Transaction History</span>
              </a>
            </li>
            <li>
              <a onClick={() => setCurrentPage("predictions")} className={`menu-item ${currentPage === "predictions" ? "active" : ""}`}>
                <TrendingUp size={20} />
                <span>Demand Forecasting</span>
              </a>
            </li>
            <li>
              <a onClick={() => setCurrentPage("recommendations")} className={`menu-item ${currentPage === "recommendations" ? "active" : ""}`}>
                <AlertTriangle size={20} />
                <span>Restock Planner</span>
              </a>
            </li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <div>PROTOTYPE MODE:</div>
          <div className="flex-between">
            <span>Data State</span>
            <span className="mode-badge local">In-Memory (Mock)</span>
          </div>
          <div style={{ fontSize: "0.7rem", marginTop: "0.5rem" }}>
            AWS Pivot Stage 1
          </div>
        </div>
      </div>

      {/* MAIN CONTENT ROUTING PANEL */}
      <main className="main-content">
        {toast && (
          <div className={`toast ${toast.type}`}>
            <AlertCircle size={18} />
            <span>{toast.message}</span>
          </div>
        )}

        {currentPage === "dashboard" && (
          <DashboardView 
            analyzedProducts={analyzedProducts} 
            transactions={transactions} 
          />
        )}

        {currentPage === "inventory" && (
          <InventoryView 
            analyzedProducts={analyzedProducts} 
            openAddProduct={openAddProduct}
            openEditProduct={openEditProduct}
            openTransactionForm={openTransactionForm}
            handleDeleteProduct={handleDeleteProduct}
          />
        )}

        {currentPage === "transactions" && (
          <TransactionsView 
            transactions={transactions} 
            products={products}
          />
        )}

        {currentPage === "predictions" && (
          <PredictionsView 
            analyzedProducts={analyzedProducts} 
          />
        )}

        {currentPage === "recommendations" && (
          <RecommendationsView 
            analyzedProducts={analyzedProducts} 
            handleRestockExecute={async (productId, qty, name) => {
              try {
                const res = await fetch("http://127.0.0.1:8000/inventory/stock-in", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    product_id: productId,
                    quantity: qty
                  })
                });
                if (!res.ok) {
                  const errData = await res.json();
                  throw new Error(errData.detail || "Restock failed.");
                }
                triggerToast(`Restocked ${qty} units of '${name}'. Alert cleared.`);
                await refreshData();
              } catch (err) {
                console.error(err);
                triggerToast(err.message || "Restock execution failed.", "error");
              }
            }}
          />
        )}
      </main>

      {/* CRUD Product Modal Overlay */}
      {showProductModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ marginBottom: "1.5rem", fontSize: "1.25rem" }}>
              {editingProduct ? `Edit Product: ${editingProduct.product_name}` : "Create New Product"}
            </h2>
            <form onSubmit={handleProductSubmit}>
              <div className="form-group">
                <label className="form-label">Product ID</label>
                <input 
                  type="text" 
                  value={prodId}
                  onChange={(e) => setProdId(e.target.value)}
                  className="form-input"
                  placeholder="e.g. PROD-06"
                  required
                  disabled={!!editingProduct}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input 
                  type="text" 
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Copper Gasket"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input 
                  type="text" 
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Hardware"
                  required
                />
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">Initial Stock</label>
                  <input 
                    type="number" 
                    value={prodInitialStock}
                    onChange={(e) => setProdInitialStock(e.target.value)}
                    className="form-input"
                    min="0"
                    required
                    disabled={!!editingProduct}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reorder Level</label>
                  <input 
                    type="number" 
                    value={prodReorderLevel}
                    onChange={(e) => setProdReorderLevel(e.target.value)}
                    className="form-input"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Measurement Unit</label>
                <input 
                  type="text" 
                  value={prodUnit}
                  onChange={(e) => setProdUnit(e.target.value)}
                  className="form-input"
                  placeholder="e.g. units, kg, boxes"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">Lead Time (Days)</label>
                  <input 
                    type="number" 
                    value={prodLeadTime}
                    onChange={(e) => setProdLeadTime(e.target.value)}
                    className="form-input"
                    min="0"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Safety Stock Margin</label>
                  <input 
                    type="number" 
                    value={prodSafetyStock}
                    onChange={(e) => setProdSafetyStock(e.target.value)}
                    className="form-input"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowProductModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Transactions Modal Overlay */}
      {showTxModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem" }}>
              {txType === "STOCK_IN" && "Stock In (Restock)"}
              {txType === "STOCK_OUT" && "Stock Out (Shipment)"}
              {txType === "ADJUST" && "Reconciliation Audit"}
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              Product: <strong>{txProduct?.product_name}</strong>
              <br />
              Current Stock: <strong>{txProduct?.current_stock} {txProduct?.unit}</strong>
            </p>
            <form onSubmit={handleTxSubmit}>
              <div className="form-group">
                <label className="form-label">
                  {txType === "STOCK_IN" && "Quantity to Add"}
                  {txType === "STOCK_OUT" && "Quantity to Ship"}
                  {txType === "ADJUST" && "New Absolute Stock Level"}
                </label>
                <input 
                  type="number" 
                  value={txQuantity}
                  onChange={(e) => setTxQuantity(e.target.value)}
                  className="form-input"
                  min="0.01"
                  step="any"
                  placeholder="e.g. 50"
                  required
                />
                {txType === "STOCK_OUT" && txProduct && parseFloat(txQuantity) > txProduct.current_stock && (
                  <span style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.25rem", display: "block" }}>
                    Warning: Quantity exceeds current stock counts!
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowTxModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={`btn ${txType === "STOCK_IN" ? "btn-success" : txType === "STOCK_OUT" ? "btn-danger" : "btn-primary"}`}
                >
                  Post Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. SUB-PAGES VIEWS (Consolidated Sub-components)
// ============================================================================

// A. DASHBOARD VIEW
function DashboardView({ analyzedProducts, transactions }) {
  // Aggregate KPIs
  const totalProducts = analyzedProducts.length;
  const totalStock = analyzedProducts.reduce((sum, p) => sum + Number(p.current_stock), 0);
  
  let lowStockCount = 0;
  let criticalCount = 0;
  analyzedProducts.forEach(p => {
    if (p.current_stock === 0) criticalCount++;
    else if (p.current_stock <= p.reorder_level) lowStockCount++;
  });

  const recentTransactions = [...transactions].reverse().slice(0, 10);

  // Format charts data
  const stockLevelData = analyzedProducts.map(p => ({
    name: p.product_name,
    "Current Stock": p.current_stock,
    "Reorder Level": p.reorder_level
  }));

  const demandForecastData = [...analyzedProducts]
    .map(p => ({
      name: p.product_name,
      "7-Day Projected Demand": Math.round(p.forecast_7_day)
    }))
    .sort((a, b) => b["7-Day Projected Demand"] - a["7-Day Projected Demand"]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Predictive Inventory Dashboard</h1>
        <p className="page-subtitle">Interactive warehouse telemetry powered by in-memory regression analytics.</p>
      </div>

      {/* KPI Tiles */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <h3>Total Catalog</h3>
            <div className="metric-value">{totalProducts}</div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>products registered</p>
          </div>
          <div className="metric-icon blue">
            <Package size={24} />
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <h3>Total Inventory</h3>
            <div className="metric-value">{totalStock}</div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>units in warehouse</p>
          </div>
          <div className="metric-icon purple">
            <TrendingUp size={24} />
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <h3>Low Stock Alerts</h3>
            <div className="metric-value" style={{ color: lowStockCount > 0 ? "#fbbf24" : "inherit" }}>{lowStockCount}</div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>below reorder threshold</p>
          </div>
          <div className="metric-icon amber">
            <AlertTriangle size={24} />
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <h3>Critical Out-of-Stock</h3>
            <div className="metric-value" style={{ color: criticalCount > 0 ? "#f87171" : "inherit" }}>{criticalCount}</div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>completely depleted</p>
          </div>
          <div className="metric-icon red">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h2 className="card-title">Stock Levels vs Reorder Thresholds</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockLevelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="Current Stock" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Reorder Level" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-card">
          <h2 className="card-title">Forecasted 7-Day Demand Volume</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demandForecastData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={80} />
                <Tooltip 
                  contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                />
                <Bar dataKey="7-Day Projected Demand" fill="#a855f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="dashboard-card" style={{ marginBottom: "2rem" }}>
        <h2 className="card-title">Recent Inventory Activities</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Stock Before</th>
                <th>Stock After</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{tx.product_name}</td>
                  <td>
                    <span className={`badge tx-${tx.transaction_type.toLowerCase()}`}>
                      {tx.transaction_type}
                    </span>
                  </td>
                  <td>{tx.quantity}</td>
                  <td>{tx.stock_before}</td>
                  <td>{tx.stock_after}</td>
                  <td style={{ color: "#64748b" }}>
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// B. INVENTORY VIEW
function InventoryView({ 
  analyzedProducts, openAddProduct, openEditProduct, openTransactionForm, handleDeleteProduct 
}) {
  const getStockBadge = (stock, reorder) => {
    const s = parseFloat(stock);
    const r = parseFloat(reorder);
    if (s === 0) return <span className="badge critical">Depleted</span>;
    if (s <= r) return <span className="badge low">Low Stock</span>;
    return <span className="badge healthy">Healthy</span>;
  };

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Products & Catalog Registry</h1>
          <p className="page-subtitle">Monitor current stock statuses and post quick transactions.</p>
        </div>
        <button onClick={openAddProduct} className="btn btn-primary" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Plus size={18} /> Register Product
        </button>
      </div>

      <div className="dashboard-card" style={{ marginBottom: "2rem" }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Reorder Level</th>
                <th>Status</th>
                <th>Quick Actions</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {analyzedProducts.map((p) => (
                <tr key={p.product_id}>
                  <td style={{ fontFamily: "monospace", color: "#818cf8" }}>{p.product_id}</td>
                  <td style={{ fontWeight: 600 }}>{p.product_name}</td>
                  <td>{p.category}</td>
                  <td>
                    {p.current_stock} <span style={{ color: "#64748b", fontSize: "0.8rem" }}>{p.unit}</span>
                  </td>
                  <td>{p.reorder_level}</td>
                  <td>{getStockBadge(p.current_stock, p.reorder_level)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <button 
                        onClick={() => openTransactionForm(p, "STOCK_IN")}
                        className="btn btn-secondary btn-icon"
                        title="Stock In (+)"
                        style={{ color: "#34d399", padding: "0.35rem" }}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                      <button 
                        onClick={() => openTransactionForm(p, "STOCK_OUT")}
                        className="btn btn-secondary btn-icon"
                        title="Stock Out (-)"
                        style={{ color: "#f87171", padding: "0.35rem" }}
                        disabled={p.current_stock === 0}
                      >
                        <ArrowDownRight size={16} />
                      </button>
                      <button 
                        onClick={() => openTransactionForm(p, "ADJUST")}
                        className="btn btn-secondary btn-icon"
                        title="Audit Adjust"
                        style={{ color: "#60a5fa", padding: "0.35rem" }}
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button 
                        onClick={() => openEditProduct(p)}
                        className="btn btn-secondary btn-icon"
                        style={{ color: "#c084fc", padding: "0.35rem" }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(p.product_id, p.product_name)}
                        className="btn btn-secondary btn-icon"
                        style={{ color: "#f87171", padding: "0.35rem" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// C. TRANSACTION HISTORY VIEW
function TransactionsView({ transactions, products }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterProduct("");
    setFilterType("");
    setFilterStartDate("");
    setFilterEndDate("");
  };

  // Perform filtration in-memory
  const filteredTxs = useMemo(() => {
    return transactions.filter(tx => {
      const term = searchTerm.toLowerCase();
      const matchSearch = tx.product_name.toLowerCase().includes(term) ||
                          tx.product_id.toLowerCase().includes(term) ||
                          tx.transaction_id.toLowerCase().includes(term);
      const matchProd = filterProduct ? tx.product_id === filterProduct : true;
      const matchType = filterType ? tx.transaction_type === filterType : true;
      
      let matchStart = true;
      if (filterStartDate) {
        matchStart = new Date(tx.timestamp) >= new Date(filterStartDate + "T00:00:00Z");
      }
      
      let matchEnd = true;
      if (filterEndDate) {
        matchEnd = new Date(tx.timestamp) <= new Date(filterEndDate + "T23:59:59Z");
      }

      return matchSearch && matchProd && matchType && matchStart && matchEnd;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, searchTerm, filterProduct, filterType, filterStartDate, filterEndDate]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Transaction History Audit Log</h1>
        <p className="page-subtitle">Fully queryable ledger of historical inventory movements.</p>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="filter-group" style={{ minWidth: "200px" }}>
          <label className="form-label">Search Keywords</label>
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
            placeholder="Search ID, name..."
          />
        </div>
        <div className="filter-group">
          <label className="form-label">Product Name</label>
          <select 
            value={filterProduct} 
            onChange={(e) => setFilterProduct(e.target.value)}
            className="form-select"
          >
            <option value="">All Products</option>
            {products.map(p => (
              <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="form-label">Movement Type</label>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="form-select"
          >
            <option value="">All Types</option>
            <option value="STOCK_IN">STOCK_IN</option>
            <option value="STOCK_OUT">STOCK_OUT</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="form-label">From Date</label>
          <input 
            type="date" 
            value={filterStartDate} 
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="form-input" 
          />
        </div>
        <div className="filter-group">
          <label className="form-label">To Date</label>
          <input 
            type="date" 
            value={filterEndDate} 
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="form-input" 
          />
        </div>

        {(filterProduct || filterType || filterStartDate || filterEndDate || searchTerm) && (
          <button 
            onClick={handleClearFilters}
            className="btn btn-secondary"
            style={{ border: "1px solid rgba(239, 68, 68, 0.3)" }}
          >
            <X size={16} style={{ color: "#ef4444", marginRight: "0.25rem" }} /> Clear
          </button>
        )}
      </div>

      <div className="dashboard-card" style={{ marginBottom: "2rem" }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Product</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Stock Before</th>
                <th>Stock After</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                    No matching transaction logs found.
                  </td>
                </tr>
              ) : (
                filteredTxs.map((tx) => (
                  <tr key={tx.transaction_id}>
                    <td style={{ fontFamily: "monospace", color: "#64748b", fontSize: "0.85rem" }}>
                      {tx.transaction_id.slice(0, 10)}...
                    </td>
                    <td style={{ fontWeight: 600 }}>{tx.product_name}</td>
                    <td>
                      <span className={`badge tx-${tx.transaction_type.toLowerCase()}`}>
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td>{tx.quantity}</td>
                    <td>{tx.stock_before}</td>
                    <td>{tx.stock_after}</td>
                    <td style={{ color: "#94a3b8" }}>
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// D. FORECASTING VIEW
function PredictionsView({ analyzedProducts }) {
  const [activeProductId, setActiveProductId] = useState("");

  useEffect(() => {
    if (analyzedProducts.length > 0 && !activeProductId) {
      setActiveProductId(analyzedProducts[0].product_id);
    }
  }, [analyzedProducts]);

  const p = analyzedProducts.find(prod => prod.product_id === activeProductId);

  // Format Recharts data for the timeline
  const chartData = useMemo(() => {
    if (!p) return [];

    // Slice last 30 historical days to make the chart readable
    const history = (p.historical_demand || [])
      .slice(-30)
      .map(h => ({
        date: h.date,
        "Actual Sales": h.demand
      }));

    const forecast = (p.forecast_demand || [])
      .map(f => ({
        date: f.date,
        "Forecasted Sales": Math.round(f.demand * 10) / 10
      }));

    // Connect the lines at boundary
    if (history.length > 0 && forecast.length > 0) {
      const lastHistory = history[history.length - 1];
      forecast[0]["Actual Sales"] = lastHistory["Actual Sales"];
    }

    return [...history, ...forecast];
  }, [p]);

  if (!p) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>Register a product to view forecasting engine...</div>;
  }

  const slope = p.metrics?.slope || 0;
  const evalMetrics = p.metrics?.evaluation;

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">Demand Forecasting Engine</h1>
          <p className="page-subtitle">Calibrate predictive models and evaluate walk-forward error metrics.</p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <label className="form-label" style={{ margin: 0 }}>Active Product:</label>
          <select 
            value={activeProductId}
            onChange={(e) => setActiveProductId(e.target.value)}
            className="form-select"
            style={{ width: "200px" }}
          >
            {analyzedProducts.map(prod => (
              <option key={prod.product_id} value={prod.product_id}>{prod.product_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Forecasting KPIs */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <h3>Tomorrow's Demand</h3>
            <div className="metric-value">{Math.round(p.forecast_1_day * 10) / 10}</div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>units forecasted</p>
          </div>
          <div className="metric-icon blue">
            <Package size={24} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h3>7-Day Projected Sales</h3>
            <div className="metric-value">{Math.round(p.forecast_7_day)}</div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>unit volume expected</p>
          </div>
          <div className="metric-icon purple">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h3>Trend Slope</h3>
            <div className="metric-value" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              {slope > 0.05 ? (
                <span style={{ color: "#34d399", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "1.5rem" }}>
                  <TrendingUp size={20} /> Rising
                </span>
              ) : slope < -0.05 ? (
                <span style={{ color: "#f87171", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "1.5rem" }}>
                  <TrendingDown size={20} /> Falling
                </span>
              ) : (
                <span style={{ color: "#94a3b8", fontSize: "1.5rem" }}>Steady</span>
              )}
            </div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
              Rate: {slope > 0 ? "+" : ""}{slope.toFixed(3)} units/day
            </p>
          </div>
          <div className="metric-icon amber">
            {slope >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <h3>Stock Out Risk</h3>
            <div className="metric-value">
              {p.days_to_stock_out > 365 ? (
                <span style={{ color: "#34d399", fontSize: "1.6rem" }}>Indefinite</span>
              ) : (
                <span>{p.days_to_stock_out.toFixed(1)} Days</span>
              )}
            </div>
            <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
              Risk Profile: <strong style={{ color: p.days_to_stock_out <= 3 ? "#f87171" : "#fbbf24" }}>{p.risk_level}</strong>
            </p>
          </div>
          <div className="metric-icon red">
            <CheckCircle2 size={24} />
          </div>
        </div>
      </div>

      {/* Regression Line Chart */}
      <div className="dashboard-card" style={{ marginBottom: "2rem" }}>
        <h2 className="card-title">Sales History vs Linear Regression Projection</h2>
        <div className="chart-container" style={{ height: "350px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 15 }} />
              <Line 
                type="monotone" 
                dataKey="Actual Sales" 
                stroke="#6366f1" 
                strokeWidth={3} 
                dot={{ r: 4 }} 
                activeDot={{ r: 6 }} 
              />
              <Line 
                type="monotone" 
                dataKey="Forecasted Sales" 
                stroke="#a855f7" 
                strokeDasharray="5 5" 
                strokeWidth={3} 
                dot={{ r: 4 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model calibration / Backtesting */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="dashboard-card">
          <h2 className="card-title">Mathematical Formula Calibration</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.95rem" }}>
            <div className="flex-between">
              <span style={{ color: "#94a3b8" }}>Algorithm:</span>
              <span style={{ fontWeight: 600 }}>{p.metrics.model_used}</span>
            </div>
            <div className="flex-between">
              <span style={{ color: "#94a3b8" }}>Regression Line fit:</span>
              <span style={{ fontFamily: "monospace", background: "rgba(255,255,255,0.03)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                y = ({slope.toFixed(4)})x + ({p.metrics.intercept?.toFixed(2) || "0.00"})
              </span>
            </div>
            <div className="flex-between">
              <span style={{ color: "#94a3b8" }}>Data Intervals:</span>
              <span>{p.metrics.data_points} days</span>
            </div>
            <div className="flex-between">
              <span style={{ color: "#94a3b8" }}>14-Day Baseline Demand:</span>
              <span>{p.metrics.daily_moving_average_14d?.toFixed(2) || p.daily_average_demand?.toFixed(2)} units/day</span>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <h2 className="card-title">Back-testing Validation Metrics</h2>
          {evalMetrics?.available ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.95rem" }}>
              <div className="flex-between">
                <span style={{ color: "#94a3b8" }}>Mean Absolute Error (MAE):</span>
                <span style={{ fontWeight: 600, color: "#a855f7" }}>{evalMetrics.mae.toFixed(3)} units</span>
              </div>
              <div className="flex-between">
                <span style={{ color: "#94a3b8" }}>Root Mean Squared Error (RMSE):</span>
                <span style={{ fontWeight: 600, color: "#6366f1" }}>{evalMetrics.rmse.toFixed(3)} units</span>
              </div>
              <div className="flex-between">
                <span style={{ color: "#94a3b8" }}>Mean Absolute Percentage Error (MAPE):</span>
                <span style={{ fontWeight: 600, color: "#14b8a6" }}>
                  {evalMetrics.mape > 0 ? `${evalMetrics.mape.toFixed(2)}%` : "N/A"}
                </span>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem" }}>
                *Validated using walk-forward backtesting (split: train on first {p.metrics.data_points - 7} days, test on last 7 days).
              </p>
            </div>
          ) : (
            <div style={{ color: "#64748b", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", textAlign: "center" }}>
              <p>Insufficient timeline to evaluate walk-forward forecast errors.</p>
              <p style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>Requires at least 10 days of transactions logging history.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// E. RECOMMENDATIONS VIEW
function RecommendationsView({ analyzedProducts, handleRestockExecute }) {
  // Filter active alerts
  const alerts = analyzedProducts.filter(p => p.restock_required);

  // Sort: Critical > High > Medium > Low
  const priority = { "CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3 };
  const sortedAlerts = [...alerts].sort((a, b) => priority[a.risk_level] - priority[b.risk_level]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Restock Planner</h1>
        <p className="page-subtitle">Proactive stocking recommendations triggered by lead times and safety limits.</p>
      </div>

      {sortedAlerts.length === 0 ? (
        <div className="dashboard-card" style={{ textAlign: "center", padding: "4rem 2rem", borderStyle: "dashed" }}>
          <CheckCircle2 size={48} style={{ color: "#10b981", margin: "0 auto 1rem" }} />
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>Warehouse Fully Stocked</h3>
          <p style={{ color: "#94a3b8", maxWidth: "450px", margin: "0 auto" }}>
            All products currently have sufficient stock levels to satisfy projected sales demands and safety stock margins.
          </p>
        </div>
      ) : (
        <div className="rec-grid">
          {sortedAlerts.map((rec) => (
            <div key={rec.product_id} className={`rec-card risk-${rec.risk_level}`}>
              <div>
                <div className="rec-header flex-between">
                  <div>
                    <h2 className="rec-title">{rec.product_name}</h2>
                    <span className="rec-category">{rec.category}</span>
                  </div>
                  <span className={`badge ${rec.risk_level.toLowerCase()}`}>
                    {rec.risk_level} Risk
                  </span>
                </div>

                <div className="rec-body">
                  <div className="rec-metric-row">
                    <span className="rec-metric-label">Current Stock:</span>
                    <span className="rec-metric-value">{rec.current_stock} {rec.unit}</span>
                  </div>
                  <div className="rec-metric-row">
                    <span className="rec-metric-label">Safety Reorder Point:</span>
                    <span className="rec-metric-value">{Math.round(rec.reorder_point * 10) / 10} {rec.unit}</span>
                  </div>
                  <div className="rec-metric-row">
                    <span className="rec-metric-label">Projected 7-Day Demand:</span>
                    <span className="rec-metric-value">{Math.round(rec.forecast_7_day)} {rec.unit}</span>
                  </div>
                  <div className="rec-metric-row">
                    <span className="rec-metric-label">Time to Depletion:</span>
                    <span className="rec-metric-value" style={{ fontWeight: 700, color: rec.days_to_stock_out <= 3 ? "#f87171" : "#fbbf24" }}>
                      {rec.days_to_stock_out > 365 ? "N/A" : `${rec.days_to_stock_out.toFixed(1)} days`}
                    </span>
                  </div>

                  <div className="rec-action-box">
                    <div className="rec-action-title">SUGGESTED REORDER</div>
                    <div>
                      <div className="rec-action-qty">Order {rec.recommended_qty} {rec.unit}</div>
                      <div style={{ fontSize: "0.85rem", color: "#cbd5e1", display: "flex", gap: "0.25rem", alignItems: "center", marginTop: "0.25rem" }}>
                        <Calendar size={12} /> Deadline: 
                        <span style={{ fontWeight: 700, color: rec.recommended_date === "IMMEDIATELY" ? "#ef4444" : "#fbbf24" }}>
                          {rec.recommended_date}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => handleRestockExecute(rec.product_id, rec.recommended_qty, rec.product_name)}
                className="btn btn-primary"
                style={{ width: "100%", display: "flex", gap: "0.5rem", marginTop: "1rem" }}
              >
                <Send size={16} /> Execute Purchase Order
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
