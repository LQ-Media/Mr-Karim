import { NextResponse } from "next/server";
import { googleConfigured, exchangeCode, redirectUri, appOrigin, safeNext } from "@/lib/oauth";
import { upsertGoogleUser } from "@/lib/auth";
import { sessionCookie } from "@/lib/session";
import { FLOW_COOKIE, FLOW_COOKIE_OPTIONS } from "../route";

export const dynamic = "force-dynamic";

/**
 * Google sends the visitor back here. Any Google account may sign in: an
 * account here is only a place to keep progress, so there is nothing to
 * check it against. A new account is created on first sign-in.
 */
export async function GET(request) {
  const origin = appOrigin(request);
  const url = new URL(request.url);
  const fields = Object.fromEntries(url.searchParams);
  const back = (error) => {
    const res = NextResponse.redirect(new URL(`/signin?error=${error}`, origin), 303);
    res.cookies.set(FLOW_COOKIE, "", { ...FLOW_COOKIE_OPTIONS, maxAge: 0 });
    return res;
  };
  if (!googleConfigured()) return back("off");

  let flow = null;
  try {
    flow = JSON.parse(request.cookies.get(FLOW_COOKIE)?.value || "null");
  } catch {
    flow = null;
  }
  if (!flow || !fields.state || fields.state !== flow.state) return back("state");
  if (!fields.code) return back(fields.error === "access_denied" ? "cancelled" : "failed");

  let id;
  try {
    id = await exchangeCode({
      code: String(fields.code),
      redirectUri: redirectUri(origin),
      codeVerifier: flow.verifier,
      nonce: flow.nonce,
    });
  } catch (err) {
    console.error("[auth] Google sign-in failed:", err.message);
    return back("failed");
  }
  if (!id.subject || !id.email || !id.emailVerified) return back("failed");

  let userId;
  try {
    userId = await upsertGoogleUser(id);
  } catch (err) {
    console.error("[auth] saving the account failed:", err.message);
    return back("failed");
  }

  const res = NextResponse.redirect(new URL(safeNext(flow.next), origin), 303);
  const c = await sessionCookie(userId);
  res.cookies.set(c.name, c.value, c.options);
  res.cookies.set(FLOW_COOKIE, "", { ...FLOW_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
