const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

// Database
const db = new sqlite3.Database("./backend/itpro.db");

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        full_name TEXT,
        phone TEXT,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        order_number TEXT UNIQUE,
        total_amount REAL,
        tax REAL,
        delivery_fee REAL,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'unpaid',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        service_name TEXT,
        quantity INTEGER,
        price REAL,
        FOREIGN KEY(order_id) REFERENCES orders(id)
    )`);
});

// ============ AUTH MIDDLEWARE ============
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, "my-secret-key-12345");
    req.userId = decoded.id;
    req.isAdmin = decoded.isAdmin;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ============ AUTHENTICATION ============

app.post("/api/signup", async (req, res) => {
  const { username, email, password, full_name, phone } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (username, email, password, full_name, phone) VALUES (?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, full_name, phone],
      function (err) {
        if (err) {
          return res
            .status(400)
            .json({ error: "Username or email already exists" });
        }
        res.json({ message: "User created successfully", userId: this.lastID });
      },
    );
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [
      user.id,
    ]);

    // Create token with admin status
    const token = jwt.sign(
      { id: user.id, email: user.email, isAdmin: user.is_admin === 1 },
      "my-secret-key-12345",
      { expiresIn: "7d" },
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        isAdmin: user.is_admin === 1,
      },
    });
  });
});

// ============ ADMIN ROUTES (Protected) ============

app.get("/api/admin/stats", verifyToken, requireAdmin, (req, res) => {
  db.get(`SELECT COUNT(*) as total_users FROM users`, [], (err, userCount) => {
    db.get(
      `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE payment_status = 'paid'`,
      [],
      (err, orderStats) => {
        db.get(
          `SELECT COUNT(*) as pending_orders FROM orders WHERE status = 'pending'`,
          [],
          (err, pending) => {
            res.json({
              total_users: userCount?.total_users || 0,
              total_orders: orderStats?.total_orders || 0,
              revenue: orderStats?.revenue || 0,
              pending_orders: pending?.pending_orders || 0,
            });
          },
        );
      },
    );
  });
});

app.get("/api/admin/orders", verifyToken, requireAdmin, (req, res) => {
  db.all(
    `SELECT o.*, u.username, u.email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC`,
    [],
    (err, orders) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(orders || []);
    },
  );
});

app.get("/api/admin/users", verifyToken, requireAdmin, (req, res) => {
  db.all(
    `SELECT id, username, email, full_name, phone, is_admin, created_at, last_login FROM users`,
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(users || []);
    },
  );
});

app.put(
  "/api/admin/orders/:id/status",
  verifyToken,
  requireAdmin,
  (req, res) => {
    const { status } = req.body;
    db.run(
      `UPDATE orders SET status = ? WHERE id = ?`,
      [status, req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Status updated", changes: this.changes });
      },
    );
  },
);

// ============ PUBLIC ROUTES ============

app.get("/api/services", (req, res) => {
  db.all(`SELECT * FROM services`, [], (err, services) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(services || []);
  });
});

app.post("/api/orders", verifyToken, (req, res) => {
  const { items, total, tax, delivery } = req.body;
  const userId = req.userId;

  const orderNumber = "ORD" + Date.now();

  db.run(
    `INSERT INTO orders (user_id, order_number, total_amount, tax, delivery_fee) VALUES (?, ?, ?, ?, ?)`,
    [userId, orderNumber, total, tax, delivery],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ orderId: this.lastID, orderNumber });
    },
  );
});

app.post("/api/create-payment-intent", (req, res) => {
  const { amount, orderId } = req.body;
  // Demo mode - simulate successful payment
  res.json({ clientSecret: "demo_secret_" + Date.now() });
});

// ============ CREATE ADMIN USER ============
async function createAdminUser() {
  const adminPassword = await bcrypt.hash("admin123", 10);

  db.get(
    `SELECT * FROM users WHERE email = 'admin@itpro.com'`,
    [],
    (err, user) => {
      if (!user) {
        db.run(
          `INSERT INTO users (username, email, password, full_name, is_admin) VALUES (?, ?, ?, ?, ?)`,
          [
            "admin",
            "admin@itpro.com",
            adminPassword,
            "System Administrator",
            1,
          ],
        );
        console.log("✅ Admin user created: admin@itpro.com / admin123");
      } else {
        console.log("✅ Admin user already exists");
      }
    },
  );
}

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 IT PRO SOLUTIONS BACKEND SERVER RUNNING                 ║
║                                                              ║
║   📍 Server: http://localhost:${PORT}                          ║
║   💳 Payments: DEMO MODE                                     ║
║                                                              ║
║   🔐 Admin Login: admin@itpro.com / admin123                ║
║                                                              ║
║   📱 Frontend: Open http://localhost:8000                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
  createAdminUser();
});
