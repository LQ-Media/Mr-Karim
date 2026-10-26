import "server-only";
import { cookies } from "next/headers";

// Bahasa Melayu first, English as the toggle. Strings are written in place as
// pairs, t("Jadual", "Schedule"), so each page reads in both languages at once
// and nothing hides in a key file. Silat terms (jurus, buah, bengkung) stay in
// Malay in both.
export const LANG_COOKIE = "ss_lang";

export async function getLang() {
  const store = await cookies();
  return store.get(LANG_COOKIE)?.value === "en" ? "en" : "ms";
}

/** t("Malay", "English") for the current visitor's language. */
export async function getT() {
  const lang = await getLang();
  const t = (ms, en) => (lang === "en" ? en : ms);
  t.lang = lang;
  return t;
}
