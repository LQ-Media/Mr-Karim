// "Sign in with Google" for admins (authorization-code flow with PKCE, verified
// with Google's keys via `jose`), then a signed session cookie. Only emails in
// the admins table get in; owners can add and remove admins.
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { q } from "./db.js";

const env = (k) => String(process.env[k] || "").trim();
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const SESSION = "tsb_session";
const FLOW = "tsb_oauth";

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
  const flow = await new SignJWT({ state, nonce, verifier }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(secret());
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
  try {
    const flowCookie = parseCookies(req)[FLOW];
    if (!flowCookie) throw new Error("Sign-in took too long. Please try again.");
    const { payload: flow } = await jwtVerify(flowCookie, secret());
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
    const { rows } = await q("SELECT email, role FROM admins WHERE email = $1", [email]);
    res.clearCookie(FLOW, { path: "/" });
    if (!rows.length) return res.redirect("/admin.html?denied=" + encodeURIComponent(email));
    if (payload.name) await q("UPDATE admins SET name = $2 WHERE email = $1", [email, String(payload.name).slice(0, 80)]);
    const session = await new SignJWT({ email, name: payload.name || "" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(secret());
    res.cookie(SESSION, session, cookieOpts(req, 30 * 24 * 3600 * 1000));
    res.redirect("/admin.html");
  } catch (e) {
    res.redirect("/admin.html?error=" + encodeURIComponent(e.message || "Sign-in failed"));
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

/** Tests only: a session cookie for an admin email. */
export async function testSession(email) {
  return new SignJWT({ email }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(secret());
}
