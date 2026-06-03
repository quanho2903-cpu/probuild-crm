const express = require("express");
const { Pool } = require("pg");
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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function getMelbourneTime() {
  return new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      project_address TEXT,
      project_type TEXT,
      budget TEXT,
      status TEXT NOT NULL,
      assigned_to TEXT,
      created_by TEXT,
      next_action TEXT,
      due_date TEXT,
      notes TEXT,
      last_edited_by TEXT,
      last_updated TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT
    );
  `);

  const companyUsers = [
    ["Quan", "quan@probuild.com", "quan2903", "admin"],
    ["Kien", "kien@probuild.com", "kien123", "sales"],
    ["Tuan", "tuan@probuild.com", "tuan123", "sales"],
    ["Dung", "dung@probuild.com", "dung123", "project_manager"],
    ["Bao", "bao@probuild.com", "bao123", "site_supervisor"]
  ];

  for (const user of companyUsers) {
    const [name, email, password, role] = user;

    const existing = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length === 0) {
      const hash = bcrypt.hashSync(password, 10);

      await pool.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
        [name, email, hash, role]
      );
    }
  }
}

initDB().catch(err => {
  console.error("Database init error:", err);
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

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    if (!user) {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login server error" });
  }
});

app.get("/api/customers", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM customers ORDER BY id DESC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/customers", auth, async (req, res) => {
  try {
    const c = req.body;
    const now = getMelbourneTime();

    const result = await pool.query(
      `INSERT INTO customers
      (
        customer_name,
        phone,
        email,
        project_address,
        project_type,
        budget,
        status,
        assigned_to,
        created_by,
        next_action,
        due_date,
        notes,
        last_edited_by,
        last_updated,
        created_at,
        updated_at
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id`,
      [
        c.customer_name,
        c.phone,
        c.email,
        c.project_address,
        c.project_type,
        c.budget,
        c.status,
        c.assigned_to,
        req.user.name,
        c.next_action,
        c.due_date,
        c.notes,
        req.user.name,
        now,
        now,
        now
      ]
    );

    await pool.query(
      `INSERT INTO activities
      (customer_id, action, created_by, created_at)
      VALUES ($1, $2, $3, $4)`,
      [
        result.rows[0].id,
        `Customer created at status: ${c.status}`,
        req.user.name,
        now
      ]
    );

    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create customer" });
  }
});

app.put("/api/customers/:id", auth, async (req, res) => {
  try {
    const c = req.body;
    const now = getMelbourneTime();

    await pool.query(
      `UPDATE customers SET
        customer_name=$1,
        phone=$2,
        email=$3,
        project_address=$4,
        project_type=$5,
        budget=$6,
        status=$7,
        assigned_to=$8,
        next_action=$9,
        due_date=$10,
        notes=$11,
        last_edited_by=$12,
        last_updated=$13,
        updated_at=$14
      WHERE id=$15`,
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
        now,
        now,
        req.params.id
      ]
    );

    await pool.query(
      `INSERT INTO activities
      (customer_id, action, created_by, created_at)
      VALUES ($1, $2, $3, $4)`,
      [
        req.params.id,
        `Customer updated. Current status: ${c.status}`,
        req.user.name,
        now
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update customer" });
  }
});

app.delete("/api/customers/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM customers WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete customer" });
  }
});

app.get("/api/customers/:id/activities", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM activities WHERE customer_id=$1 ORDER BY id DESC",
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.listen(PORT, () => {
  console.log(`ProBuild CRM running on port ${PORT}`);
});
