// "Continue with Google", done by hand with `jose` (the same approach as the
// Parents portal's lib/oauth.js, cut down to Google). What is needed from
// Google is a verified account id and a name for the greeting; the account id
// (`sub`) is the identity, so a visitor who changes their Gmail address keeps
// their progress.
//
// Secrets are read at request time, never at import, so `next build` needs none.
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";

const env = (k) => String(process.env[k] || "").trim();

const GOOGLE = {
  issuer: ["https://accounts.google.com", "accounts.google.com"],
  authorize: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  jwks: "https://www.googleapis.com/oauth2/v3/certs",
  scope: "openid email profile",
};

export function googleConfigured() {
  return Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET") && env("DATABASE_URL"));
}

/**
 * The app's public origin. Behind Railway's proxy `request.url` is the
 * server's bind address, so APP_ORIGIN wins, then the forwarded host.
 */
export function appOrigin(request) {
  const configured = env("APP_ORIGIN");
  if (configured) return configured.replace(/\/+$/, "");
  const host = request?.headers?.get("x-forwarded-host") || request?.headers?.get("host");
  if (host && !/^(0\.0\.0\.0|127\.0\.0\.1|localhost)(:|$)/.test(host)) {
    const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

export function redirectUri(origin) {
  return `${String(origin || "").replace(/\/+$/, "")}/api/auth/google/callback`;
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Only ever return to a page on this site. */
export function safeNext(value) {
  const v = String(value || "");
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/api/") ? v : "/";
}

export function authorizeUrl({ redirectUri: uri, state, nonce, codeVerifier }) {
  const u = new URL(GOOGLE.authorize);
  u.searchParams.set("client_id", env("GOOGLE_CLIENT_ID"));
  u.searchParams.set("redirect_uri", uri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GOOGLE.scope);
  u.searchParams.set("state", state);
  u.searchParams.set("nonce", nonce);
  u.searchParams.set("code_challenge", createHash("sha256").update(codeVerifier).digest("base64url"));
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("prompt", "select_account");
  u.searchParams.set("access_type", "online");
  return u.toString();
}

let keys = null;

/** Check the ID token came from Google, for this app, for this attempt. */
export async function verifyIdToken(idToken, { nonce, jwks = null } = {}) {
  keys ??= createRemoteJWKSet(new URL(GOOGLE.jwks));
  const { payload } = await jwtVerify(idToken, jwks ?? keys, {
    issuer: GOOGLE.issuer,
    audience: env("GOOGLE_CLIENT_ID"),
  });
  if (!nonce || payload.nonce !== nonce) throw new Error("nonce mismatch");
  return {
    subject: String(payload.sub || ""),
    email: typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "",
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: typeof payload.name === "string" ? payload.name : "",
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

/** Swap the callback's code for tokens and verify the ID token. */
export async function exchangeCode({ code, redirectUri: uri, codeVerifier, nonce }) {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: uri,
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    code_verifier: codeVerifier,
  });
  const res = await fetch(GOOGLE.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id_token) {
    throw new Error(`Google token exchange failed: ${body.error_description || body.error || res.status}`);
  }
  return verifyIdToken(body.id_token, { nonce });
}
