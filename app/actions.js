"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE } from "@/lib/i18n";
import { clearSession } from "@/lib/session";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";

/** BM / EN toggle. Remembered for a year on this device. */
export async function setLang(formData) {
  const lang = formData.get("lang") === "en" ? "en" : "ms";
  const store = await cookies();
  store.set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function signOut() {
  await clearSession();
  redirect("/");
}

/** Delete the account, its family profiles and everything kept with them. */
export async function deleteAccount() {
  const user = await getUser();
  if (user) await query("delete from app_users where id = $1", [user.id]);
  await clearSession();
  redirect("/?deleted=1");
}
