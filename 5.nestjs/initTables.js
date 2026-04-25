const pool = require('./database');

async function tableExists(tableName) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name = $1
     )`,
    [tableName]
  );
  return result.rows[0].exists;
}

async function createTable(name, ddl) {
  const exists = await tableExists(name);
  if (exists) {
    console.log(`Table "${name}" already exists — skipping creation`);
  } else {
    await pool.query(ddl);
    console.log(`Table "${name}" created successfully`);
  }
}

async function initTables() {
  await createTable('users', `
    CREATE TABLE users (
      id       SERIAL PRIMARY KEY,
      name     VARCHAR(255) NOT NULL,
      email    VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    )
  `);

  await createTable('profile', `
    CREATE TABLE profile (
      id         SERIAL PRIMARY KEY,
      user_id    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bio        TEXT,
      phone      VARCHAR(20),
      avatar_url VARCHAR(500),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

module.exports = initTables;
