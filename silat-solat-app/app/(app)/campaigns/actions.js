"use server";

import { query } from "@/lib/db";

export async function volunteer(prev, formData) {
  const name = String(formData.get("name") || "").trim().slice(0, 80);
  const contact = String(formData.get("contact") || "").trim().slice(0, 120);
  const slug = String(formData.get("campaign") || "");
  if (!name || !contact) return { error: true };
  const { rows } = await query("select id from campaigns where slug = $1 and volunteers", [slug]);
  if (!rows[0]) return { error: true };
  await query("insert into volunteers (campaign_id, name, contact) values ($1,$2,$3)", [rows[0].id, name, contact]);
  return { ok: true };
}
