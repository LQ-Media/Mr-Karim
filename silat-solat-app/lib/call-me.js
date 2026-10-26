/* "Call me": the name the app greets someone by (LQK, 23 Oct 2026). The
   choices come from the words of the person's own name, so "Nur Aisyah binte
   Ahmad" offers "Nur", "Aisyah" and "Nur Aisyah", plus whatever they type in
   themselves. Pure, imports nothing: the Account form (client) and the
   greetings (server) share it. A copy of the portals' packages/db/src/call-me.js
   (LQK-Portal); keep the two alike. */

export const CALL_ME_MAX = 40;

// Titles at the start of a name. The greeting either keeps one in front
// (Teachers: "Ustazah Nur") or has its own salutation chip (Parents).
const TITLES = new Set(
  "ustaz ustazah ustadh ustadha cikgu teacher puan encik cik en pn tuan mr mrs ms mdm miss madam sir dr sister brother haji hajah hajjah hj hjh sheikh syeikh".split(" "),
);

// Words that join a name to a parent's ("bin", "binte", "s/o"). Choices stop
// at them: "Nur Aisyah binte Ahmad" never offers "Ahmad" or "binte Ahmad".
const JOINERS = new Set("bin binte binti bte bt b. bte. s/o d/o a/l a/p".split(" "));

// Never offered alone: "Abdul" means "servant of" and wants the name after it.
const NOT_ALONE = new Set("abdul abd abdel abdur abdool".split(" "));

const bare = (w) => w.replace(/\.$/, "").toLowerCase();

/** Collapse spaces and cut to the limit: the one shape a saved name takes. */
export function cleanCallMe(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, CALL_ME_MAX).trim();
}

/** Split a full name into its leading title (if any) and the name itself. */
export function splitTitle(fullName) {
  const words = cleanWords(fullName);
  const title = words.length > 1 && TITLES.has(bare(words[0])) ? words.shift() : "";
  return { title, words };
}

function cleanWords(name) {
  return String(name || "").trim().split(/\s+/).filter(Boolean);
}

/**
 * The choices offered for a full name, most likely first: each word up to
 * the first "bin"/"binte", each pair of neighbouring words, then the whole
 * given name. With `keepTitle`, the first few are offered with the title in
 * front as well ("Ustazah Nur", "Ustazah Nur Aisyah").
 */
export function callMeOptions(fullName, { keepTitle = false } = {}) {
  const { title, words } = splitTitle(fullName);
  const cut = words.findIndex((w) => JOINERS.has(w.toLowerCase()));
  const given = (cut > 0 ? words.slice(0, cut) : words).filter((w) => !TITLES.has(bare(w)));
  if (!given.length) return [];

  const base = given.slice(0, 4).filter((w) => !NOT_ALONE.has(w.toLowerCase()));
  for (let i = 0; i + 1 < given.length && i < 3; i++) base.push(`${given[i]} ${given[i + 1]}`);
  if (given.length > 2) base.push(given.join(" "));

  const titled = keepTitle && title ? base.slice(0, 3).map((o) => `${title} ${o}`) : [];
  const seen = new Set();
  return [...titled, ...base]
    .map(cleanCallMe)
    .filter((o) => o && !seen.has(o.toLowerCase()) && seen.add(o.toLowerCase()))
    .slice(0, 10);
}

/** First word of a name, keeping a title in front ("Ustazah Nur"): the old default. */
export function firstNameWithTitle(fullName) {
  const words = cleanWords(fullName);
  if (!words.length) return "";
  return TITLES.has(bare(words[0])) && words[1] ? `${words[0]} ${words[1]}` : words[0];
}

/** First word of a name, as the greetings used before "Call me". */
export function firstWord(fullName) {
  return cleanWords(fullName)[0] || "";
}
