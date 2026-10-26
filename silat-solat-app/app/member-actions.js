"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { cleanCallMe } from "@/lib/call-me";
import { checkinValid } from "@/lib/checkin";
import { getClass, todaySgt } from "@/lib/data";

const str = (v, n = 120) => String(v || "").trim().slice(0, n);

function readMember(formData) {
  const fullName = str(formData.get("fullName"), 80);
  const displayName = str(formData.get("displayName"), 30) || fullName.split(" ")[0];
  const birthYear = Number(formData.get("birthYear")) || null;
  const gender = formData.get("gender") === "female" ? "female" : "male";
  const branch = str(formData.get("branch"), 40);
  let stream = str(formData.get("stream"), 20);
  const thisYear = new Date().getFullYear();
  if (!fullName || !BY_SLUG[branch] || !STREAMS[stream]) return { error: "missing" };
  if (birthYear && (birthYear < 1930 || birthYear > thisYear)) return { error: "year" };
  // Sisters' classes are for women and girls only; kids' for ages 7–12.
  if (stream === "sisters" && gender !== "female") return { error: "sisters" };
  if (stream === "kids" && birthYear && (thisYear - birthYear < 7 || thisYear - birthYear > 13)) return { error: "kids" };
  return {
    fullName,
    displayName,
    birthYear,
    gender,
    branch,
    stream,
    medical: str(formData.get("medical"), 400) || null,
    consent: formData.get("consent") === "on",
  };
}

/** Add or edit a training profile on the signed-in account. */
export async function saveMember(prev, formData) {
  const user = await getUser();
  if (!user) redirect("/signin?next=/register");
  const m = readMember(formData);
  if (m.error) return { error: m.error };
  const id = str(formData.get("id"), 20);
  if (id) {
    const { rowCount } = await query(
      `update members set full_name=$1, display_name=$2, birth_year=$3, gender=$4, branch=$5, stream=$6,
         medical_notes=$7, media_consent=$8 where id=$9 and account_id=$10`,
      [m.fullName, m.displayName, m.birthYear, m.gender, m.branch, m.stream, m.medical, m.consent, id, user.id]
    );
    if (!rowCount) return { error: "missing" };
  } else {
    const { rows } = await query("select count(*)::int as n from members where account_id = $1", [user.id]);
    if (rows[0].n >= 10) return { error: "many" };
    await query(
      `insert into members (account_id, full_name, display_name, birth_year, gender, branch, stream, medical_notes, media_consent)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [user.id, m.fullName, m.displayName, m.birthYear, m.gender, m.branch, m.stream, m.medical, m.consent]
    );
  }
  revalidatePath("/me");
  redirect("/me?saved=1");
}

export async function removeMember(formData) {
  const user = await getUser();
  if (!user) redirect("/signin");
  await query("delete from members where id = $1 and account_id = $2", [str(formData.get("id"), 20), user.id]);
  revalidatePath("/me");
  redirect("/profile");
}

/** Check family members in to today's class from its QR link. */
export async function checkIn(prev, formData) {
  const user = await getUser();
  if (!user) return { error: "signin" };
  const classId = str(formData.get("c"), 20);
  const day = str(formData.get("d"), 10);
  if (!checkinValid(classId, day, str(formData.get("s"), 40))) return { error: "bad" };
  if (day !== todaySgt()) return { error: "old" };
  const cls = await getClass(classId);
  if (!cls) return { error: "bad" };
  const ids = formData.getAll("member").map((v) => str(v, 20)).filter(Boolean);
  if (!ids.length) return { error: "none" };
  const { rows } = await query("select id from members where account_id = $1 and id = any($2::bigint[])", [user.id, ids]);
  for (const r of rows) {
    await query(
      "insert into attendance (member_id, class_id, day, method) values ($1,$2,$3,'qr') on conflict do nothing",
      [r.id, cls.id, day]
    );
  }
  revalidatePath("/me");
  return { ok: true, count: rows.length };
}

/** Profile: the name the app greets them by, and a phone number for instructors. */
export async function saveAccount(prev, formData) {
  const user = await getUser();
  if (!user) redirect("/signin?next=/profile");
  await query("update app_users set call_me = $1, phone = $2 where id = $3", [
    cleanCallMe(formData.get("callMe")) || null,
    str(formData.get("phone"), 30) || null,
    user.id,
  ]);
  revalidatePath("/", "layout");
  return { saved: true };
}

/** Open Stripe's page where a supporter changes or cancels their monthly plan. */
export async function manageSupport() {
  const user = await getUser();
  if (!user) redirect("/signin?next=/profile");
  const { rows } = await query(
    `select details->>'customer' as customer from payments
     where user_id = $1 and monthly and method = 'card' and status = 'paid' and details ? 'customer'
     order by id desc limit 1`,
    [user.id]
  );
  if (!rows[0]?.customer) redirect("/support");
  const { portalUrl } = await import("@/lib/stripe");
  const { siteOrigin } = await import("@/lib/origin");
  const origin = await siteOrigin();
  let url;
  try {
    url = await portalUrl({ customer: rows[0].customer, origin });
  } catch (err) {
    console.error("[profile] Stripe portal failed:", err.message);
    redirect("/profile?portal=failed");
  }
  redirect(url);
}
