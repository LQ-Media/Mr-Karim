import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "./session.js";
import { dbConfigured, query } from "./db.js";
import { cleanCallMe, firstWord } from "./call-me.js";

/**
 * Who is here. Public pages work for guests; member pages ask them to sign in
 * with Google. Roles: member (default), instructor, admin. ADMIN_EMAILS (comma
 * separated) are always admin, so the first admin never needs a database edit.
 */
export const getUser = cache(async () => {
  const id = await getSessionUserId();
  if (!id || !dbConfigured()) return null;
  try {
    const { rows } = await query(
      "select id, email, name, picture, call_me, role, phone from app_users where id = $1",
      [id]
    );
    const u = rows[0];
    if (!u) return null;
    const role = adminEmails().includes(u.email.toLowerCase()) ? "admin" : u.role;
    return { ...u, id: String(u.id), role };
  } catch (err) {
    console.error("[auth] user lookup failed:", err.message);
    return null;
  }
});

export function adminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(user) {
  return user?.role === "admin";
}

export function isInstructor(user) {
  return user?.role === "instructor" || user?.role === "admin";
}

export function firstName(user) {
  return cleanCallMe(user?.call_me) || firstWord(user?.name);
}

/** For member pages: the signed-in user, or off to sign in and back again. */
export async function requireUser(next = "/me") {
  const user = await getUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireInstructor(next = "/instructor") {
  const user = await requireUser(next);
  if (!isInstructor(user)) redirect("/me");
  return user;
}

export async function requireAdmin(next = "/admin") {
  const user = await requireUser(next);
  if (!isAdmin(user)) redirect("/me");
  return user;
}

/** Find or create the account for a verified Google identity. */
export async function upsertGoogleUser({ subject, email, name, picture }) {
  const { rows } = await query(
    `insert into app_users (google_sub, email, name, picture)
     values ($1, $2, $3, $4)
     on conflict (google_sub) do update
       set email = excluded.email, name = excluded.name, picture = excluded.picture, last_seen = now()
     returning id`,
    [subject, email, String(name || "").slice(0, 80), picture || null]
  );
  return String(rows[0].id);
}

/**
 * The branch+stream pairs an instructor may see. Admins see everything (null).
 * Returns [] for an instructor with no assignment yet.
 */
export async function instructorScope(user) {
  if (isAdmin(user)) return null;
  const { rows } = await query("select branch, stream from instructor_assignments where user_id = $1", [user.id]);
  return rows;
}

export function inScope(scope, branch, stream) {
  return scope === null || scope.some((s) => s.branch === branch && s.stream === stream);
}
