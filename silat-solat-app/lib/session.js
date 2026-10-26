import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "ss_app_session";
// A year: signing in is only there to keep progress, so it should rarely ask again.
const MAX_AGE_DAYS = 365;

// Read lazily so `next build` needs no secret, and refuse a guessable key in
// production rather than signing sessions with it.
function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not set — refusing to sign sessions with an insecure key in production.");
  }
  return new TextEncoder().encode("dev-only-insecure-secret-change-me");
}

export async function sessionCookie(userId) {
  const token = await new SignJWT({ uid: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_DAYS}d`)
    .sign(getKey());
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * MAX_AGE_DAYS,
    },
  };
}

export async function getSessionUserId() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
    return payload.uid ? String(payload.uid) : null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
