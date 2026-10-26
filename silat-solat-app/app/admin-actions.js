"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser, isAdmin } from "@/lib/auth";
import { query, transaction, setSetting } from "@/lib/db";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { FREQUENCIES } from "@/lib/grading";
import { FAQ } from "@/lib/faq";
import { youtubeId, TOPICS } from "@/lib/library";
import { TOP_LEVEL, NO_SASH_LEVEL } from "@/lib/sashes";
import { todaySgt } from "@/lib/data";

const str = (v, n = 200) => String(v || "").trim().slice(0, n);
const time = (v) => (/^\d{2}:\d{2}$/.test(String(v)) ? String(v) : null);

async function admin() {
  const user = await getUser();
  if (!isAdmin(user)) redirect("/me");
  return user;
}

export async function setGradingFrequency(formData) {
  await admin();
  const f = str(formData.get("frequency"), 20);
  if (FREQUENCIES[f]) await setSetting("grading_frequency", f);
  revalidatePath("/admin");
}

// ── Classes ──────────────────────────────────────────────────────────────────
export async function saveClass(formData) {
  await admin();
  const id = str(formData.get("id"), 20);
  const branch = str(formData.get("branch"), 40);
  const stream = str(formData.get("stream"), 20);
  const weekday = Number(formData.get("weekday"));
  const starts = time(formData.get("starts"));
  const ends = time(formData.get("ends"));
  if (!BY_SLUG[branch] || !STREAMS[stream] || !(weekday >= 0 && weekday <= 6) || !starts || !ends) return;
  const confirmed = formData.get("confirmed") === "on";
  const active = formData.get("active") !== "off";
  if (id) {
    await query(
      "update classes set branch=$1, stream=$2, weekday=$3, starts=$4, ends=$5, confirmed=$6, active=$7 where id=$8",
      [branch, stream, weekday, starts, ends, confirmed, active, id]
    );
  } else {
    await query("insert into classes (branch, stream, weekday, starts, ends, confirmed) values ($1,$2,$3,$4,$5,$6)", [
      branch, stream, weekday, starts, ends, confirmed,
    ]);
  }
  revalidatePath("/admin/classes");
  revalidatePath("/schedule");
}

export async function toggleClassActive(formData) {
  await admin();
  await query("update classes set active = not active where id = $1", [str(formData.get("id"), 20)]);
  revalidatePath("/admin/classes");
}

// ── People ───────────────────────────────────────────────────────────────────
export async function setRole(formData) {
  const me = await admin();
  const id = str(formData.get("userId"), 20);
  const role = ["member", "instructor", "admin"].includes(formData.get("role")) ? formData.get("role") : "member";
  if (id === me.id && role !== "admin") return; // never lock yourself out
  await query("update app_users set role = $1 where id = $2", [role, id]);
  revalidatePath("/admin/people");
}

export async function assign(formData) {
  await admin();
  const id = str(formData.get("userId"), 20);
  const branch = str(formData.get("branch"), 40);
  const stream = str(formData.get("stream"), 20);
  if (!BY_SLUG[branch] || !STREAMS[stream]) return;
  if (formData.get("remove") === "1") {
    await query("delete from instructor_assignments where user_id=$1 and branch=$2 and stream=$3", [id, branch, stream]);
  } else {
    await query("insert into instructor_assignments (user_id, branch, stream) values ($1,$2,$3) on conflict do nothing", [id, branch, stream]);
  }
  revalidatePath("/admin/people");
}

/** Move a member's sash by hand (e.g. setting up existing students on day one). */
export async function setMemberLevel(formData) {
  await admin();
  const id = str(formData.get("memberId"), 20);
  const level = Math.max(NO_SASH_LEVEL, Math.min(TOP_LEVEL, Number(formData.get("level"))));
  if (!Number.isFinite(level)) return;
  await transaction(async (c) => {
    await c.query("update members set level = $1, stripes = 0, level_since = $2 where id = $3", [level, todaySgt(), id]);
    await c.query("delete from signoffs where member_id = $1", [id]);
  });
  revalidatePath("/admin/people");
}

export async function setMemberStatus(formData) {
  await admin();
  const status = formData.get("status") === "paused" ? "paused" : "active";
  await query("update members set status = $1 where id = $2", [status, str(formData.get("memberId"), 20)]);
  revalidatePath("/admin/people");
}

/** The Ustaz approves a black-sash pass; the member moves up then. */
export async function approveResult(formData) {
  await admin();
  const id = str(formData.get("resultId"), 20);
  await transaction(async (c) => {
    const { rows } = await c.query(
      `update grading_results r set approved = true from gradings g
       where r.id = $1 and g.id = r.grading_id and not r.approved returning r.member_id, r.to_level, g.day`,
      [id]
    );
    if (rows[0]) {
      await c.query("update members set level = $1, stripes = 0, level_since = $2 where id = $3", [rows[0].to_level, todaySgt(), rows[0].member_id]);
      await c.query("delete from signoffs where member_id = $1", [rows[0].member_id]);
    }
  });
  revalidatePath("/admin");
}

// ── Content ──────────────────────────────────────────────────────────────────
export async function deleteAnnouncement(formData) {
  await admin();
  await query("delete from announcements where id = $1", [str(formData.get("id"), 20)]);
  revalidatePath("/admin/content");
}

export async function saveVideo(prev, formData) {
  await admin();
  const yt = youtubeId(formData.get("youtube"));
  const titleMs = str(formData.get("titleMs"), 160);
  const titleEn = str(formData.get("titleEn"), 160) || titleMs;
  const topic = TOPICS[formData.get("topic")] ? formData.get("topic") : "jurus";
  const levelRaw = formData.get("level");
  const level = levelRaw === "" || levelRaw === null ? null : Math.max(0, Math.min(TOP_LEVEL, Number(levelRaw)));
  if (!yt || !titleMs) return { error: true };
  await query(
    `insert into videos (youtube_id, title_ms, title_en, level, topic, steps_ms, steps_en, adab_ms, adab_en)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [yt, titleMs, titleEn, level, topic, str(formData.get("stepsMs"), 2000) || null, str(formData.get("stepsEn"), 2000) || null, str(formData.get("adabMs"), 600) || null, str(formData.get("adabEn"), 600) || null]
  );
  revalidatePath("/library");
  revalidatePath("/admin/content");
  return { ok: true };
}

export async function toggleVideo(formData) {
  await admin();
  if (formData.get("delete") === "1") await query("delete from videos where id = $1", [str(formData.get("id"), 20)]);
  else await query("update videos set published = not published where id = $1", [str(formData.get("id"), 20)]);
  revalidatePath("/library");
  revalidatePath("/admin/content");
}

/** Load the ten drafted answers (lib/faq.js) as unpublished, to edit and publish. */
export async function loadFaqDrafts() {
  await admin();
  for (const [i, f] of FAQ.entries()) {
    await query(
      `insert into questions (question, question_en, answer_ms, answer_en, published, sort)
       select $1,$2,$3,$4,false,$5 where not exists (select 1 from questions where question = $1)`,
      [f.q[0], f.q[1], f.a[0], f.a[1], i]
    );
  }
  revalidatePath("/admin/content");
}

export async function saveAnswer(formData) {
  await admin();
  await query(
    "update questions set question=$1, question_en=$2, answer_ms=$3, answer_en=$4, published=$5 where id=$6",
    [
      str(formData.get("question"), 1000),
      str(formData.get("questionEn"), 1000) || null,
      str(formData.get("answerMs"), 3000) || null,
      str(formData.get("answerEn"), 3000) || null,
      formData.get("published") === "on",
      str(formData.get("id"), 20),
    ]
  );
  revalidatePath("/ask");
  revalidatePath("/admin/content");
}

export async function deleteQuestion(formData) {
  await admin();
  await query("delete from questions where id = $1", [str(formData.get("id"), 20)]);
  revalidatePath("/admin/content");
}

export async function saveCampaign(formData) {
  await admin();
  const id = str(formData.get("id"), 20);
  const goal = Math.round(Number(formData.get("goal")) * 100) || null;
  const status = ["active", "upcoming", "closed"].includes(formData.get("status")) ? formData.get("status") : "upcoming";
  const fields = [
    str(formData.get("titleMs"), 120),
    str(formData.get("titleEn"), 120),
    str(formData.get("bodyMs"), 1000),
    str(formData.get("bodyEn"), 1000),
    goal,
    status,
    formData.get("volunteers") === "on",
  ];
  if (!fields[0]) return;
  if (id) {
    await query(
      "update campaigns set title_ms=$1, title_en=$2, body_ms=$3, body_en=$4, goal_cents=$5, status=$6, volunteers=$7 where id=$8",
      [...fields, id]
    );
  } else {
    const slug = `${fields[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${Date.now().toString(36).slice(-4)}`;
    await query(
      "insert into campaigns (title_ms, title_en, body_ms, body_en, goal_cents, status, volunteers, slug) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [...fields, slug]
    );
  }
  revalidatePath("/campaigns");
  revalidatePath("/admin/content");
}

// ── Payments ─────────────────────────────────────────────────────────────────
export async function setPaymentStatus(formData) {
  await admin();
  const status = ["paid", "cancelled", "pending"].includes(formData.get("status")) ? formData.get("status") : null;
  if (!status) return;
  await query(
    `update payments set status = $1, paid_at = case when $1 = 'paid' then coalesce(paid_at, now()) else null end where id = $2`,
    [status, str(formData.get("id"), 20)]
  );
  revalidatePath("/admin/payments");
}
