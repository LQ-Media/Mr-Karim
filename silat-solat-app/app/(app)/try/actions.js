"use server";

import { dbConfigured, query } from "@/lib/db";
import { getClass } from "@/lib/data";

/** Book a free trial class. Open to anyone; nothing else is asked. */
export async function bookTrial(prev, formData) {
  const name = String(formData.get("name") || "").trim().slice(0, 80);
  const contact = String(formData.get("contact") || "").trim().slice(0, 120);
  const classId = String(formData.get("classId") || "");
  const day = String(formData.get("day") || "");
  const people = Math.max(1, Math.min(6, Number(formData.get("people")) || 1));
  if (!name || !contact) return { error: "missing" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "missing" };
  const c = await getClass(classId);
  if (!c) return { error: "missing" };
  if (!dbConfigured()) return { ok: true, offline: true };
  await query("insert into trial_bookings (name, contact, class_id, day, people) values ($1,$2,$3,$4,$5)", [
    name,
    contact,
    c.id,
    day,
    people,
  ]);
  return { ok: true, classId: c.id, day };
}
