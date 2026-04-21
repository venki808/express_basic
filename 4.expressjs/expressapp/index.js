const express = require('express');
const pool = require('./database');
const initTables = require('./initTables');

const app = express();
app.use(express.json()); // parse JSON request body

// Middleware: log every request
app.use((req, res, next) => {
    console.log("Request URL:", req.url);
    next();
});

// ─── USERS ────────────────────────────────────────────────────────────────────

/* =========================
   CREATE USER (POST)
========================= */
app.post('/create/user', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }

    const result = await pool.query(
      'INSERT INTO users(name, email, password) VALUES($1,$2,$3) RETURNING *',
      [name, email, password]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET ALL USERS (READ)
========================= */
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET SINGLE USER
========================= */
app.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   UPDATE USER (PUT)
========================= */
app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }

    const result = await pool.query(
      'UPDATE users SET name=$1, email=$2, password=$3 WHERE id=$4 RETURNING *',
      [name, email, password, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   DELETE USER
========================= */
app.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM users WHERE id=$1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted", user: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   LOGIN (CHECK PASSWORD)
========================= */
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email=$1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return res.status(400).json({ error: "Invalid password" });
    }

    res.json({ message: "Login success", user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 404 fallback ──────────────────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).send('404 Page not found');
});

// app.listen(5000, () => {
//     console.log('Server listening on port 5000');
// });

pool.query('SELECT 1')
  .then(async () => {
    console.log('Database connected');
    await initTables();
    app.listen(5000, () => {
      console.log('Server listening on port 5000');
    });
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
