const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('./database');
const initTables = require('./initTables');

const app = express();
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const valid = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    cb(null, valid);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use('/uploads', express.static(uploadsDir));

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

// ─── PROFILE ──────────────────────────────────────────────────────────────────

/* =========================
   CREATE PROFILE (POST)
   Accepts multipart/form-data: user_id, bio, phone, avatar (file, optional)
========================= */
app.post('/create/profile', upload.single('avatar'), async (req, res) => {
  try {
    const { user_id, bio, phone } = req.body;

    if (!user_id || !bio || !phone) {
      return res.status(400).json({ error: "user_id, bio and phone are required" });
    }

    const avatar_url = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      'INSERT INTO profile(user_id, bio, phone, avatar_url) VALUES($1,$2,$3,$4) RETURNING *',
      [user_id, bio, phone, avatar_url]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET ALL PROFILES
========================= */
app.get('/profiles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profile ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET SINGLE PROFILE
========================= */
app.get('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM profile WHERE id=$1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   UPDATE PROFILE (PUT)
   Accepts multipart/form-data: bio, phone, avatar (file, optional)
========================= */
app.put('/profile/:id', upload.single('avatar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { bio, phone } = req.body;

    if (!bio || !phone) {
      return res.status(400).json({ error: "bio and phone are required" });
    }

    const existing = await pool.query('SELECT * FROM profile WHERE id=$1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const avatar_url = req.file ? `/uploads/${req.file.filename}` : existing.rows[0].avatar_url;

    const result = await pool.query(
      'UPDATE profile SET bio=$1, phone=$2, avatar_url=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [bio, phone, avatar_url, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   DELETE PROFILE
========================= */
app.delete('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM profile WHERE id=$1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({ message: "Profile deleted", profile: result.rows[0] });
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
      console.log('Server listening on port 5000 ');
    });
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
