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
    last_edited_by TEXT,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
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

  db.all("PRAGMA table_info(customers)", [], (err, columns) => {
    if (!err) {
      const columnNames = columns.map(col => col.name);

      if (!columnNames.includes("last_edited_by")) {
        db.run("ALTER TABLE customers ADD COLUMN last_edited_by TEXT");
      }

      if (!columnNames.includes("last_updated")) {
        db.run("ALTER TABLE customers ADD COLUMN last_updated TEXT DEFAULT CURRENT_TIMESTAMP");
      }
    }
  });

  const companyUsers = [
    ["Quan", "quan@probuild.com", "quan2903", "admin"],
    ["Kien", "kien@probuild.com", "kien123", "admin"],
    ["Tuan", "tuan@probuild.com", "tuan123", "admin"],
    ["Dung", "dung@probuild.com", "dung123", "admin"],
    ["Bao", "bao@probuild.com", "bao123", "admin"]
  ];

  companyUsers.forEach(user => {
    const [name, email, password, role] = user;

    db.get("SELECT * FROM users WHERE email = ?", [email], (err, existingUser) => {
      if (!existingUser) {
        const hash = bcrypt.hashSync(password, 10);

        db.run(
          "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
          [name, email, hash, role]
        );
      }
    });
  });

  db.get("SELECT COUNT(*) AS count FROM customers", [], (err, row) => {
    if (!err && row.count === 0) {
      const sample = [
        [
          "John Smith",
          "0400 111 222",
          "john@email.com",
          "12 King St, Melbourne",
          "New House Build",
          "$650,000",
          "Quotation Sent",
          "Kien",
          "Follow up quotation",
          "2026-06-10",
          "Client asked for double-storey design.",
          "Quan"
        ],
        [
          "Anna Nguyen",
          "0400 333 444",
          "anna@email.com",
          "8 Queen Rd, Glen Waverley",
          "Renovation",
          "$180,000",
          "Negotiation",
          "Tuan",
          "Revise price",
          "2026-06-07",
          "Wants to reduce kitchen cost.",
          "Quan"
        ],
        [
          "Michael Lee",
          "0400 555 666",
          "michael@email.com",
          "22 Park Ave, Richmond",
          "Townhouse Project",
          "$900,000",
          "Construction",
          "Dung",
          "Site progress check",
          "2026-06-12",
          "Frame stage in progress.",
          "Quan"
        ]
      ];

      sample.forEach(c => {
        db.run(`INSERT INTO customers 
          (customer_name, phone, email, project_address, project_type, budget, status, assigned_to, next_action, due_date, notes, last_edited_by, last_updated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, c);
      });
    }
  });
});

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

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
    if (err || !user) {
      return res.status(401).json({ error: "Invalid login" });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid login" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  });
});

app.get("/api/customers", auth, (req, res) => {
  db.all("SELECT * FROM customers ORDER BY updated_at DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }

    res.json(rows);
  });
});

app.post("/api/customers", auth, (req, res) => {
  const c = req.body;

  db.run(`INSERT INTO customers 
    (customer_name, phone, email, project_address, project_type, budget, status, assigned_to, next_action, due_date, notes, last_edited_by, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      c.customer_name,
      c.phone,
      c.email,
      c.project_address,
      c.project_type,
      c.budget,
      c.status,
      c.assigned_to,
      c.next_action,
      c.due_date,
      c.notes,
      req.user.name
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: "Could not create customer" });
      }

      db.run(
        "INSERT INTO activities (customer_id, action, created_by) VALUES (?, ?, ?)",
        [this.lastID, `Customer created at status: ${c.status}`, req.user.name]
      );

      res.json({ id: this.lastID });
    }
  );
});

app.put("/api/customers/:id", auth, (req, res) => {
  const c = req.body;

  db.run(`UPDATE customers SET
    customer_name=?,
    phone=?,
    email=?,
    project_address=?,
    project_type=?,
    budget=?,
    status=?,
    assigned_to=?,
    next_action=?,
    due_date=?,
    notes=?,
    last_edited_by=?,
    last_updated=CURRENT_TIMESTAMP,
    updated_at=CURRENT_TIMESTAMP
    WHERE id=?`,
    [
      c.customer_name,
      c.phone,
      c.email,
      c.project_address,
      c.project_type,
      c.budget,
      c.status,
      c.assigned_to,
      c.next_action,
      c.due_date,
      c.notes,
      req.user.name,
      req.params.id
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: "Could not update customer" });
      }

      db.run(
        "INSERT INTO activities (customer_id, action, created_by) VALUES (?, ?, ?)",
        [req.params.id, `Customer updated. Current status: ${c.status}`, req.user.name]
      );

      res.json({ success: true });
    }
  );
});

app.delete("/api/customers/:id", auth, (req, res) => {
  db.run("DELETE FROM customers WHERE id = ?", [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: "Could not delete customer" });
    }

    res.json({ success: true });
  });
});

app.get("/api/customers/:id/activities", auth, (req, res) => {
  db.all(
    "SELECT * FROM activities WHERE customer_id=? ORDER BY created_at DESC",
    [req.params.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }

      res.json(rows);
    }
  );
});

app.listen(PORT, () => {
  console.log(`ProBuild CRM running on http://localhost:${PORT}`);
});
