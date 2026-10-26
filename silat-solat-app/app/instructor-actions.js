"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser, isInstructor, instructorScope, inScope, isAdmin } from "@/lib/auth";
import { query, transaction, setSetting } from "@/lib/db";
import { getClass, getMember, todaySgt } from "@/lib/data";
import { canCoachMember } from "@/lib/access";
import { nextSash, MAX_STRIPES, TOP_LEVEL } from "@/lib/sashes";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { dateLabel, clock } from "@/lib/tr";

const str = (v, n = 120) => String(v || "").trim().slice(0, n);

async function coach() {
  const user = await getUser();
  if (!isInstructor(user)) redirect("/me");
  return user;
}

async function coachOf(memberId) {
  const user = await coach();
  const m = await getMember(memberId);
  if (!m || !(await canCoachMember(user, m))) redirect("/instructor");
  return { user, m };
}

/** Roster: tick a member present (or not) for a class on a day. */
export async function toggleAttendance(formData) {
  const user = await coach();
  const cls = await getClass(str(formData.get("classId"), 20));
  const day = str(formData.get("day"), 10);
  if (!cls || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  if (!inScope(await instructorScope(user), cls.branch, cls.stream)) return;
  const m = await getMember(str(formData.get("memberId"), 20));
  if (!m || m.branch !== cls.branch || m.stream !== cls.stream) return;
  if (formData.get("present") === "1") {
    await query("insert into attendance (member_id, class_id, day, method) values ($1,$2,$3,'roster') on conflict do nothing", [m.id, cls.id, day]);
  } else {
    await query("delete from attendance where member_id = $1 and class_id = $2 and day = $3", [m.id, cls.id, day]);
  }
  revalidatePath("/instructor");
}

/** Sign off (or un-sign) one syllabus item of the member's next sash. */
export async function toggleSignoff(formData) {
  const { user, m } = await coachOf(str(formData.get("memberId"), 20));
  const item = str(formData.get("item"), 10);
  const target = nextSash(m.level);
  if (!target || !target.items.some(([id]) => id === item)) return;
  if (formData.get("on") === "1") {
    await query("insert into signoffs (member_id, item, by_user) values ($1,$2,$3) on conflict do nothing", [m.id, item, user.id]);
  } else {
    await query("delete from signoffs where member_id = $1 and item = $2", [m.id, item]);
  }
  revalidatePath(`/instructor/member/${m.id}`);
}

export async function addNote(formData) {
  const { user, m } = await coachOf(str(formData.get("memberId"), 20));
  const body = str(formData.get("body"), 600);
  if (body) await query("insert into member_notes (member_id, by_user, body) values ($1,$2,$3)", [m.id, user.id, body]);
  revalidatePath(`/instructor/member/${m.id}`);
}

/** Kids earn stripes (cula) inside a sash, up to three. */
export async function setStripes(formData) {
  const { m } = await coachOf(str(formData.get("memberId"), 20));
  const n = Math.max(0, Math.min(MAX_STRIPES, Number(formData.get("stripes")) || 0));
  await query("update members set stripes = $1 where id = $2", [n, m.id]);
  revalidatePath(`/instructor/member/${m.id}`);
}

/** Post an announcement to a branch (and stream) the instructor teaches. */
export async function postAnnouncement(prev, formData) {
  const user = await coach();
  const branch = str(formData.get("branch"), 40) || null;
  const stream = str(formData.get("stream"), 20) || null;
  const title = str(formData.get("title"), 120);
  const body = str(formData.get("body"), 2000);
  if (!title || !body) return { error: true };
  if (branch && !BY_SLUG[branch]) return { error: true };
  if (stream && !STREAMS[stream]) return { error: true };
  if (!isAdmin(user)) {
    const scope = await instructorScope(user);
    if (!branch || !scope.some((s) => s.branch === branch && (!stream || s.stream === stream))) return { error: "scope" };
  }
  await query("insert into announcements (branch, stream, title, body, by_user) values ($1,$2,$3,$4,$5)", [branch, stream, title, body, user.id]);
  revalidatePath("/news");
  return { ok: true };
}

/** Open a grading day for a branch the instructor teaches (admins: any, or all). */
export async function createGrading(prev, formData) {
  const user = await coach();
  const branch = str(formData.get("branch"), 40) || null;
  const day = str(formData.get("day"), 10);
  const starts = str(formData.get("starts"), 5) || "09:30";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(starts)) return { error: true };
  if (!isAdmin(user)) {
    const scope = await instructorScope(user);
    if (!branch || !scope.some((s) => s.branch === branch)) return { error: true };
  }
  await query("insert into gradings (branch, day, starts, created_by) values ($1,$2,$3,$4)", [branch, day, starts, user.id]);
  await query(
    "insert into announcements (branch, title, body, kind, by_user) values ($1,$2,$3,'grading',$4)",
    [
      branch,
      `Hari gred · Grading day: ${dateLabel(day, "ms")}`,
      `Gred bengkung pada ${dateLabel(day, "ms")}, ${clock(starts, "ms")}. Ahli yang layak akan dijemput dalam aplikasi.\n\nSash grading on ${dateLabel(day, "en")}, ${clock(starts, "en")}. Eligible members will be invited in the app.`,
      user.id,
    ]
  );
  revalidatePath("/instructor/grading");
  return { ok: true };
}

/**
 * Record a grading result. A pass moves the member up a sash and resets their
 * syllabus, attendance count and stripes for the next one. A black-sash pass
 * waits for the Ustaz (an admin) to approve before the certificate shows.
 */
export async function recordResult(formData) {
  const { user, m } = await coachOf(str(formData.get("memberId"), 20));
  const gradingId = str(formData.get("gradingId"), 20);
  const result = ["pass", "conditional", "retry"].includes(formData.get("result")) ? formData.get("result") : null;
  if (!result) return;
  const g = (await query("select id, branch, to_char(day,'YYYY-MM-DD') as day from gradings where id = $1", [gradingId])).rows[0];
  if (!g || (g.branch && g.branch !== m.branch)) return;
  // Results are recorded on or after the grading day, never before it.
  const today = todaySgt();
  if (g.day > today) return;
  const toLevel = result === "retry" ? m.level : Math.min(TOP_LEVEL, m.level + 1);
  const approved = !(toLevel === TOP_LEVEL && result !== "retry" && !isAdmin(user));
  await transaction(async (c) => {
    const ins = await c.query(
      `insert into grading_results (grading_id, member_id, from_level, to_level, result, approved, by_user)
       values ($1,$2,$3,$4,$5,$6,$7) on conflict (grading_id, member_id) do nothing returning id`,
      [g.id, m.id, m.level, toLevel, result, approved, user.id]
    );
    if (ins.rowCount && result !== "retry" && approved) {
      await c.query("update members set level = $1, stripes = 0, level_since = $2 where id = $3", [toLevel, today, m.id]);
      await c.query("delete from signoffs where member_id = $1", [m.id]);
    }
  });
  revalidatePath("/instructor/grading");
}

/** An instructor sets how often their own branch grades. */
export async function setBranchFrequency(formData) {
  const user = await coach();
  const branch = str(formData.get("branch"), 40);
  const freq = str(formData.get("frequency"), 20);
  if (!BY_SLUG[branch] || !["", "monthly", "bimonthly", "quarterly", "adhoc"].includes(freq)) return;
  if (!isAdmin(user)) {
    const scope = await instructorScope(user);
    if (!scope.some((s) => s.branch === branch)) return;
  }
  if (freq) await setSetting(`grading_frequency:${branch}`, freq);
  else await query("delete from settings where key = $1", [`grading_frequency:${branch}`]);
  revalidatePath("/instructor/grading");
}
