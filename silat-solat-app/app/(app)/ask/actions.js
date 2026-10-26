"use server";

import { dbConfigured, query } from "@/lib/db";

/** A question for the Ustaz. Kept private until he answers and publishes it. */
export async function askQuestion(prev, formData) {
  const question = String(formData.get("question") || "").trim().slice(0, 1000);
  const name = String(formData.get("name") || "").trim().slice(0, 80) || null;
  const email = String(formData.get("email") || "").trim().slice(0, 120) || null;
  if (question.length < 8) return { error: true };
  if (dbConfigured()) await query("insert into questions (name, email, question) values ($1,$2,$3)", [name, email, question]);
  return { ok: true };
}
