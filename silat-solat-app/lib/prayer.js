import "server-only";

// Today's Singapore prayer times for the schedule ("Isyak berjemaah 7:58 pm"),
// from the Aladhan API with MUIS's method (11), cached for a day on the server.
// If the API is down the schedule simply shows no times.
const NAMES = { Fajr: "Subuh", Dhuhr: "Zohor", Asr: "Asar", Maghrib: "Maghrib", Isha: "Isyak" };

export async function prayerTimesFor(dateISO) {
  const [y, m, d] = dateISO.split("-");
  try {
    const res = await fetch(
      `https://api.aladhan.com/v1/timingsByCity/${d}-${m}-${y}?city=Singapore&country=Singapore&method=11`,
      { next: { revalidate: 60 * 60 * 12 } }
    );
    if (!res.ok) return null;
    const body = await res.json();
    const t = body?.data?.timings;
    if (!t) return null;
    const out = {};
    for (const k of Object.keys(NAMES)) out[NAMES[k]] = String(t[k] || "").slice(0, 5);
    return out;
  } catch {
    return null;
  }
}

/** The prayer that falls inside a class, e.g. Isyak during 8–10pm. */
export function prayerDuring(times, starts, ends) {
  if (!times) return null;
  for (const [name, at] of Object.entries(times)) {
    if (at && at >= starts && at <= ends) return { name, at };
  }
  // A class that ends just before a prayer: say what comes next, within 30 min.
  const [eh, em] = ends.split(":").map(Number);
  for (const [name, at] of Object.entries(times)) {
    const [h, m] = at.split(":").map(Number);
    const gap = h * 60 + m - (eh * 60 + em);
    if (gap >= 0 && gap <= 30) return { name, at, after: true };
  }
  return null;
}
