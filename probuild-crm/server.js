const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-for-production";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("./crm.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    project_address TEXT,
    project_type TEXT,
    budget TEXT,
    status TEXT NOT NULL,
    assigned_to TEXT,
    next_action TEXT,
    due_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  )`);

db.get("SELECT COUNT(*) AS count FROM users", [], (err, row) => {
  if (!err && row.count === 0) {

    const users = [
      ["Quan", "quan@probuild.com", "quan123", "admin"],
      ["Kien", "kien@probuild.com", "kien123", "staff"],
      ["Tuan", "tuan@probuild.com", "tuan123", "staff"],
      ["Dung", "dung@probuild.com", "dung123", "staff"],
      ["Bao", "bao@probuild.com", "bao123", "staff"]
    ];

    users.forEach(user => {
      const hash = bcrypt.hashSync(user[2], 10);

      db.run(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        [user[0], user[1], hash, user[3]]
      );
    });
  }
});

  db.get("SELECT COUNT(*) AS count FROM customers", [], (err, row) => {
    if (!err && row.count === 0) {
      const sample = [
        ["John Smith", "0400 111 222", "john@email.com", "12 King St, Melbourne", "New House Build", "$650,000", "Quotation Sent", "David", "Follow up quotation", "2026-06-10", "Client asked for double-storey design."],
        ["Anna Nguyen", "0400 333 444", "anna@email.com", "8 Queen Rd, Glen Waverley", "Renovation", "$180,000", "Negotiation", "Linh", "Revise price", "2026-06-07", "Wants to reduce kitchen cost."],
        ["Michael Lee", "0400 555 666", "michael@email.com", "22 Park Ave, Richmond", "Townhouse Project", "$900,000", "Construction", "James", "Site progress check", "2026-06-12", "Frame stage in progress."]
      ];
      sample.forEach(c => db.run(`INSERT INTO customers 
        (customer_name, phone, email, project_address, project_type, budget, status, assigned_to, next_action, due_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, c));
    }
  });
});

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err || !user) return res.status(401).json({ error: "Invalid login" });
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid login" });
    }
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  });
});

app.get("/api/customers", auth, (req, res) => {
  db.all("SELECT * FROM customers ORDER BY updated_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(rows);
  });
});

app.post("/api/customers", auth, (req, res) => {
  const c = req.body;
  db.run(`INSERT INTO customers 
    (customer_name, phone, email, project_address, project_type, budget, status, assigned_to, next_action, due_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.customer_name, c.phone, c.email, c.project_address, c.project_type, c.budget, c.status, c.assigned_to, c.next_action, c.due_date, c.notes],
    function(err) {
      if (err) return res.status(500).json({ error: "Could not create customer" });
      db.run("INSERT INTO activities (customer_id, action, created_by) VALUES (?, ?, ?)",
        [this.lastID, `Customer created at status: ${c.status}`, req.user.name]);
      res.json({ id: this.lastID });
    });
});

app.put("/api/customers/:id", auth, (req, res) => {
  const c = req.body;
  db.run(`UPDATE customers SET
    customer_name=?, phone=?, email=?, project_address=?, project_type=?, budget=?, status=?, assigned_to=?,
    next_action=?, due_date=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?`,
    [c.customer_name, c.phone, c.email, c.project_address, c.project_type, c.budget, c.status, c.assigned_to, c.next_action, c.due_date, c.notes, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: "Could not update customer" });
      db.run("INSERT INTO activities (customer_id, action, created_by) VALUES (?, ?, ?)",
        [req.params.id, `Customer updated. Current status: ${c.status}`, req.user.name]);
      res.json({ success: true });
    });
});

app.delete("/api/customers/:id", auth, (req, res) => {
  db.run("DELETE FROM customers WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: "Could not delete customer" });
    res.json({ success: true });
  });
});

app.get("/api/customers/:id/activities", auth, (req, res) => {
  db.all("SELECT * FROM activities WHERE customer_id=? ORDER BY created_at DESC", [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Construction CRM running on http://localhost:${PORT}`);
});
