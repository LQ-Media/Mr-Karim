import "server-only";
import { instructorScope, inScope, isAdmin } from "./auth.js";

/** Owner, admin, or an instructor who teaches this member's branch and stream. */
export async function canViewMember(user, member) {
  if (!user || !member) return false;
  if (String(member.account_id) === String(user.id)) return true;
  if (isAdmin(user)) return true;
  if (user.role !== "instructor") return false;
  return inScope(await instructorScope(user), member.branch, member.stream);
}

export async function canCoachMember(user, member) {
  if (!user || !member) return false;
  if (isAdmin(user)) return true;
  if (user.role !== "instructor") return false;
  return inScope(await instructorScope(user), member.branch, member.stream);
}
