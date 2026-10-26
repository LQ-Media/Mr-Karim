import { NextResponse } from "next/server";
import { googleConfigured, authorizeUrl, redirectUri, randomToken, appOrigin, safeNext } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// What this sign-in attempt must come back with, for ten minutes, sent only
// to /api/auth. Lax is enough: Google returns with a top-level GET.
export const FLOW_COOKIE = "ss_app_oauth";
export const FLOW_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
  maxAge: 600,
};

/** GET /api/auth/google?next=/progress — starts "Continue with Google". */
export async function GET(request) {
  const origin = appOrigin(request);
  if (!googleConfigured()) return NextResponse.redirect(new URL("/signin?error=off", origin));

  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const res = NextResponse.redirect(
    authorizeUrl({ redirectUri: redirectUri(origin), state, nonce, codeVerifier: verifier })
  );
  res.cookies.set(FLOW_COOKIE, JSON.stringify({ state, nonce, verifier, next }), FLOW_COOKIE_OPTIONS);
  return res;
}
