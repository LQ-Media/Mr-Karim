// Sign-in for two kinds of people, each with its own signed session cookie:
//  - admins: Google only; the email must be in the admins table.
//  - customers: Google, or email + password (scrypt-hashed). Customers must sign in to order.
// Google uses the authorization-code flow with PKCE, verified with Google's keys via `jose`.
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCb);
import { q } from "./db.js";

const env = (k) => String(process.env[k] || "").trim();
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const SESSION = "tsb_session";
const FLOW = "tsb_oauth";
const CUSTOMER = "tsb_customer";
const safeNext = (v) => (/^#[A-Za-z0-9/_-]{0,80}$/.test(String(v || "")) ? String(v) : "#account");

const secret = () => new TextEncoder().encode(env("SESSION_SECRET") || "dev-only-secret-change-me");
export const googleConfigured = () => Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));

export function origin(req) {
  if (env("APP_ORIGIN")) return env("APP_ORIGIN").replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}
const cookieOpts = (req, maxAgeMs) => ({ httpOnly: true, sameSite: "lax", secure: origin(req).startsWith("https"), maxAge: maxAgeMs, path: "/" });

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}

export async function startGoogle(req, res) {
  if (!googleConfigured()) return res.status(503).send("Google sign-in isn't set up yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  const state = randomBytes(18).toString("base64url"), nonce = randomBytes(18).toString("base64url"), verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const as = req.query.as === "customer" ? "customer" : "admin", next = safeNext(req.query.next);
  const flow = await new SignJWT({ state, nonce, verifier, as, next }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(secret());
  res.cookie(FLOW, flow, cookieOpts(req, 10 * 60 * 1000));
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", env("GOOGLE_CLIENT_ID"));
  u.searchParams.set("redirect_uri", `${origin(req)}/api/auth/google/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("nonce", nonce);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("prompt", "select_account");
  res.redirect(u.toString());
}

export async function finishGoogle(req, res) {
  let as = "admin";
  try {
    const flowCookie = parseCookies(req)[FLOW];
    if (!flowCookie) throw new Error("Sign-in took too long. Please try again.");
    const { payload: flow } = await jwtVerify(flowCookie, secret());
    as = flow.as === "customer" ? "customer" : "admin";
    if (!req.query.code || req.query.state !== flow.state) throw new Error("Sign-in check failed. Please try again.");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: String(req.query.code), client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"),
        redirect_uri: `${origin(req)}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: flow.verifier })
    });
    const tok = await r.json();
    if (!tok.id_token) throw new Error("Google didn't confirm the sign-in.");
    const { payload } = await jwtVerify(tok.id_token, JWKS, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: env("GOOGLE_CLIENT_ID") });
    if (payload.nonce !== flow.nonce || !payload.email_verified) throw new Error("Google didn't confirm that email address.");
    const email = String(payload.email).toLowerCase();
    res.clearCookie(FLOW, { path: "/" });
    if (as === "customer") {
      const { rows: [c] } = await q(`INSERT INTO customers (email, name, google, last_login) VALUES ($1, $2, true, now())
        ON CONFLICT (email) DO UPDATE SET google = true, last_login = now(), name = CASE WHEN customers.name = '' THEN EXCLUDED.name ELSE customers.name END
        RETURNING id`, [email, String(payload.name || "").slice(0, 80)]);
      await setCustomer(req, res, c.id);
      return res.redirect("/" + safeNext(flow.next));
    }
    const { rows } = await q("SELECT email, role FROM admins WHERE email = $1", [email]);
    if (!rows.length) return res.redirect("/admin.html?denied=" + encodeURIComponent(email));
    if (payload.name) await q("UPDATE admins SET name = $2 WHERE email = $1", [email, String(payload.name).slice(0, 80)]);
    const session = await new SignJWT({ email, name: payload.name || "" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(secret());
    res.cookie(SESSION, session, cookieOpts(req, 30 * 24 * 3600 * 1000));
    res.redirect("/admin.html");
  } catch (e) {
    const msg = encodeURIComponent(e.message || "Sign-in failed");
    res.redirect(as === "customer" ? "/?autherr=" + msg + "#account" : "/admin.html?error=" + msg);
  }
}

export function logout(req, res) { res.clearCookie(SESSION, { path: "/" }); res.redirect("/admin.html"); }

/** Express middleware: req.admin = { email, role } or 401. Role is re-read every request, so removing an admin takes effect at once. */
export function requireAdmin(roleNeeded) {
  return async (req, res, next) => {
    try {
      const token = parseCookies(req)[SESSION];
      if (!token) return res.status(401).json({ error: "Please sign in." });
      const { payload } = await jwtVerify(token, secret());
      const { rows } = await q("SELECT email, role, name FROM admins WHERE email = $1", [payload.email]);
      if (!rows.length) return res.status(403).json({ error: "This Google account isn't an admin any more." });
      if (roleNeeded === "owner" && rows[0].role !== "owner") return res.status(403).json({ error: "Only owners can do that." });
      req.admin = rows[0];
      next();
    } catch (e) {
      res.status(401).json({ error: "Please sign in again." });
    }
  };
}

/** The signed-in admin row (email, role, name), or null. For pages that only need to know. */
export async function currentAdmin(req) {
  const token = parseCookies(req)[SESSION];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const { rows } = await q("SELECT email, role, name FROM admins WHERE email = $1", [payload.email]);
    return rows[0] || null;
  } catch { return null; }
}

/* ---------- customers ---------- */
export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(String(pw), salt, 64);
  return "s1$" + salt.toString("base64url") + "$" + key.toString("base64url");
}
export async function checkPassword(pw, stored) {
  const [v, salt, key] = String(stored || "").split("$");
  if (v !== "s1" || !salt || !key) return false;
  const want = Buffer.from(key, "base64url"), got = await scrypt(String(pw), Buffer.from(salt, "base64url"), want.length);
  return timingSafeEqual(want, got);
}
export async function setCustomer(req, res, id) {
  const t = await new SignJWT({ cid: id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("180d").sign(secret());
  res.cookie(CUSTOMER, t, cookieOpts(req, 180 * 24 * 3600 * 1000));
}
export function clearCustomer(req, res) { res.clearCookie(CUSTOMER, { path: "/" }); }
/** The signed-in customer row, or null. */
export async function currentCustomer(req) {
  const t = parseCookies(req)[CUSTOMER];
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, secret());
    const { rows } = await q("SELECT id, email, name, phone, address, google, (password_hash IS NOT NULL) AS has_password FROM customers WHERE id = $1", [payload.cid]);
    return rows[0] || null;
  } catch { return null; }
}
export function requireCustomer() {
  return async (req, res, next) => {
    const c = await currentCustomer(req).catch(() => null);
    if (!c) return res.status(401).json({ error: "Please sign in or create an account first.", signin: true });
    req.customer = c; next();
  };
}
/** Tests only: a customer session cookie. */
export async function testCustomerSession(id) {
  return new SignJWT({ cid: id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(secret());
}

/** Tests only: a session cookie for an admin email. */
export async function testSession(email) {
  return new SignJWT({ email }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(secret());
}
