// Postgres: orders, payment proofs, history, admins, the editable menu and
// uploaded menu photos. Tables are created on start-up, so a fresh Railway
// database needs no manual setup.
import pg from "pg";

let pool = null;
export function setPool(p) { pool = p; }
export function db() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new pg.Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1|railway\.internal/.test(url) ? false : { rejectUnauthorized: false }, max: 5 });
  }
  return pool;
}
export const q = (text, params) => db().query(text, params);

export async function migrate() {
  await q(`
    CREATE TABLE IF NOT EXISTS admins (
      email TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'admin',
      name TEXT,
      added_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE SEQUENCE IF NOT EXISTS order_ref_seq START 1001;
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      ref TEXT UNIQUE NOT NULL,
      token TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      address TEXT NOT NULL,
      delivery_date DATE NOT NULL,
      slot TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      items JSONB NOT NULL,
      subtotal NUMERIC(10,2),
      delivery_fee NUMERIC(10,2),
      total NUMERIC(10,2),
      pending_change JSONB,
      note_to_customer TEXT NOT NULL DEFAULT '',
      admin_note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS orders_date_idx ON orders (delivery_date);
    CREATE TABLE IF NOT EXISTS payment_proofs (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      mime TEXT NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS order_events (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      actor TEXT NOT NULL,
      message TEXT NOT NULL,
      visible BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      mime TEXT NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await q(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      password_hash TEXT,
      google BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login TIMESTAMPTZ
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);
    CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id);
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS saved JSONB NOT NULL DEFAULT '[]';
  `);
  // Owners named in OWNER_EMAILS always exist (comma-separated).
  for (const email of String(process.env.OWNER_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)) {
    await q(`INSERT INTO admins (email, role, added_by) VALUES ($1, 'owner', 'setup')
             ON CONFLICT (email) DO UPDATE SET role = 'owner'`, [email]);
  }
  // Session-signing key: SESSION_SECRET if set, otherwise one made once and kept in the database.
  if (!String(process.env.SESSION_SECRET || "").trim()) {
    const { randomBytes } = await import("node:crypto");
    await q(`INSERT INTO settings (key, value, updated_by) VALUES ('session_secret', $1, 'setup') ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify(randomBytes(32).toString("base64url"))]);
    const { rows } = await q(`SELECT value FROM settings WHERE key = 'session_secret'`);
    process.env.SESSION_SECRET = rows[0].value;
  }
}
