// The Islamic date, derived with Intl's Umm al-Qura calendar — no dependency,
// no table to maintain. Umm al-Qura is a calculated calendar and Singapore
// (MUIS) confirms months by sighting, so around a month boundary this can sit
// one day off the announced date. For a subtitle that is the right trade;
// anything that must match MUIS exactly (Ramadan, Eid) is announced by the
// school, not derived here.
import { TZ } from "./time.js";

/** "29 Safar 1448 AH" — for the Home header, beside the Gregorian date. */
export function hijriToday(at = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-SG-u-ca-islamic-umalqura", {
      timeZone: TZ,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(at);
  } catch {
    return "";
  }
}
