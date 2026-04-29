const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pool = require('./database');
const initTables = require('./initTables');

const app = express();
app.use(express.json());

// ─── AUTH TOKEN STORE ────────────────────────────────────────────────────────
// token → { userId, email }
const tokenStore = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  const user = tokenStore.get(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = user;
  next();
}

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

// app.use((req, res, next) => {
//     console.log("Request URL:", req.url);

//     const oldJson = res.json;

//     res.json = function (data) {
//         console.log("Response JSON:", data);
//         oldJson.apply(res, arguments);
//     };

//     next();
// });

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
app.get('/users', authenticate, async (req, res) => {
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
app.get('/users/:id', authenticate, async (req, res) => {
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
app.put('/users/:id', authenticate, async (req, res) => {
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
app.delete('/users/:id', authenticate, async (req, res) => {
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

    const token = generateToken();
    tokenStore.set(token, { userId: user.id, email: user.email });

    res.json({ message: "Login success", token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   LOGOUT (DELETE TOKEN)
========================= */
app.post('/logout', authenticate, (req, res) => {
  const token = req.headers['authorization'].slice(7);
  tokenStore.delete(token);
  res.json({ message: "Logged out successfully" });
});

// ─── PROFILES ────────────────────────────────────────────────────────────────

/* =========================
   CREATE PROFILE (POST)
========================= */
app.post('/create/profile', authenticate, upload.single('avatar'), async (req, res) => {
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
   GET ALL PROFILES (READ)
========================= */
app.get('/profiles', authenticate, async (req, res) => {
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
app.get('/profiles/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM profile WHERE id = $1',
      [id]
    );

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
========================= */
app.put('/profiles/:id', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { bio, phone } = req.body;

    if (!bio || !phone) {
      return res.status(400).json({ error: "bio and phone are required" });
    }

    // Fetch existing profile to keep old avatar if no new file uploaded
    const existing = await pool.query('SELECT avatar_url FROM profile WHERE id=$1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const avatar_url = req.file
      ? `/uploads/${req.file.filename}`
      : existing.rows[0].avatar_url;

    const result = await pool.query(
      'UPDATE profile SET bio=$1, phone=$2, avatar_url=$3 WHERE id=$4 RETURNING *',
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
app.delete('/profiles/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM profile WHERE id=$1 RETURNING *',
      [id]
    );

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
    app.listen(5000, '0.0.0.0', () => {
      const { networkInterfaces } = require('os');
      const nets = networkInterfaces();
      let localIP = 'localhost';
      for (const iface of Object.values(nets)) {
        for (const net of iface) {
          if (net.family === 'IPv4' && !net.internal) {
            localIP = net.address;
            break;
          }
        }
      }
      console.log(`Server listening on port 5000`);
      console.log(`Local:   http://localhost:5000`);
      console.log(`Network: http://${localIP}:5000`);
    });
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
