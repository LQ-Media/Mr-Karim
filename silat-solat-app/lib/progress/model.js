// What "My progress" keeps, and how two copies of it are merged.
//
// Pure functions, no browser or database, so the same rules run on the phone
// (a visitor who never signs in), on the server (a signed-in account) and in
// the tests. One plain object per person:
//
//   {
//     v: 1,
//     days:     { "2026-10-16": { quran: 3, dua: 1, tasbih: 33 } },  // what was done each day (Singapore date)
//     juz:      [1, 2, 30],                                          // juz finished towards this khatam
//     khatams:  0,                                                   // whole Qurans finished
//     tasbih:   { count: 12, total: 4410 },                          // counter on screen, and every tap ever
//     bookmark: { chapterId: 2, verseKey: "2:255", at: 1760600000000 } | null,
//     updatedAt: 1760600000000,
//   }
//
// Merging never loses work: days add up by taking the larger count, juz are a
// union, totals take the larger, and the newer bookmark wins. That is what lets
// a visitor read for a week, then sign in and keep that week.

export const ACTIVITIES = ["quran", "dua", "tasbih"];

export function emptyProgress() {
  return { v: 1, days: {}, juz: [], khatams: 0, tasbih: { count: 0, total: 0 }, bookmark: null, updatedAt: 0 };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const VERSE = /^\d{1,3}:\d{1,3}$/;
const int = (n, max = 1e9) => {
  const x = Math.floor(Number(n));
  return Number.isFinite(x) && x > 0 ? Math.min(x, max) : 0;
};

const juzNumber = (j) => {
  const n = Number(j);
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : 0;
};

/** Anything that came from storage or the network, made safe to use. */
export function clean(raw) {
  const p = emptyProgress();
  if (!raw || typeof raw !== "object") return p;

  const days = raw.days && typeof raw.days === "object" ? raw.days : {};
  // Keep at most the last two years of days, so the record stays small.
  for (const d of Object.keys(days).filter((k) => DAY.test(k)).sort().slice(-730)) {
    const row = {};
    for (const a of ACTIVITIES) {
      const n = int(days[d]?.[a], 100000);
      if (n) row[a] = n;
    }
    if (Object.keys(row).length) p.days[d] = row;
  }

  p.juz = [...new Set((Array.isArray(raw.juz) ? raw.juz : []).map(juzNumber).filter(Boolean))].sort((a, b) => a - b);
  p.khatams = int(raw.khatams, 10000);
  p.tasbih = { count: int(raw.tasbih?.count, 1e6), total: int(raw.tasbih?.total) };

  const b = raw.bookmark;
  const cid = Number.isInteger(Number(b?.chapterId)) && b.chapterId >= 1 && b.chapterId <= 114 ? Number(b.chapterId) : 0;
  if (cid && VERSE.test(String(b?.verseKey || ""))) {
    p.bookmark = { chapterId: cid, verseKey: String(b.verseKey), at: int(b.at, 8.64e15) };
  }
  p.updatedAt = int(raw.updatedAt, 8.64e15);
  return p;
}

/** Both copies' work, kept. */
export function merge(a, b) {
  const x = clean(a);
  const y = clean(b);
  const out = emptyProgress();

  for (const d of new Set([...Object.keys(x.days), ...Object.keys(y.days)])) {
    const row = {};
    for (const k of ACTIVITIES) {
      const n = Math.max(x.days[d]?.[k] || 0, y.days[d]?.[k] || 0);
      if (n) row[k] = n;
    }
    out.days[d] = row;
  }
  // A khatam resets the juz list, so whichever side has more khatams has the
  // current list; on a tie the juz are combined.
  out.khatams = Math.max(x.khatams, y.khatams);
  out.juz =
    x.khatams === y.khatams
      ? [...new Set([...x.juz, ...y.juz])].sort((m, n) => m - n)
      : (x.khatams > y.khatams ? x : y).juz;
  out.tasbih = {
    count: (x.updatedAt >= y.updatedAt ? x : y).tasbih.count,
    total: Math.max(x.tasbih.total, y.tasbih.total),
  };
  out.bookmark = [x.bookmark, y.bookmark].filter(Boolean).sort((m, n) => n.at - m.at)[0] || null;
  out.updatedAt = Math.max(x.updatedAt, y.updatedAt);
  return clean(out);
}

/** Today's date in Singapore, as YYYY-MM-DD. */
export function today(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(now);
}

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Record one thing done today. */
export function logActivity(p, activity, amount = 1, now = new Date()) {
  const next = clean(p);
  if (!ACTIVITIES.includes(activity)) return next;
  const d = today(now);
  next.days[d] = { ...(next.days[d] || {}), [activity]: (next.days[d]?.[activity] || 0) + int(amount, 100000) };
  next.updatedAt = now.getTime();
  return next;
}

/**
 * Days in a row with something done, ending today. A streak still counts
 * until the end of today even if today has nothing yet, so opening the app in
 * the morning never shows a broken streak.
 */
export function streak(p, now = new Date()) {
  const { days } = clean(p);
  let d = today(now);
  if (!days[d]) d = addDays(d, -1);
  let n = 0;
  while (days[d]) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

/** The last `count` days, oldest first, each with whether anything was done. */
export function recentDays(p, count = 7, now = new Date()) {
  const { days } = clean(p);
  const end = today(now);
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(end, i - count + 1);
    return { day: d, done: Boolean(days[d]) };
  });
}

export function toggleJuz(p, juz, now = new Date()) {
  const next = clean(p);
  const j = juzNumber(juz);
  if (!j) return next;
  next.juz = next.juz.includes(j) ? next.juz.filter((x) => x !== j) : [...next.juz, j].sort((a, b) => a - b);
  next.updatedAt = now.getTime();
  return next;
}

/** All 30 ticked: count a khatam and start the next one. */
export function completeKhatam(p, now = new Date()) {
  const next = clean(p);
  if (next.juz.length < 30) return next;
  next.khatams += 1;
  next.juz = [];
  next.updatedAt = now.getTime();
  return next;
}

export function tapTasbih(p, now = new Date()) {
  const next = logActivity(p, "tasbih", 1, now);
  next.tasbih = { count: next.tasbih.count + 1, total: next.tasbih.total + 1 };
  return next;
}

export function resetTasbih(p, now = new Date()) {
  const next = clean(p);
  next.tasbih = { ...next.tasbih, count: 0 };
  next.updatedAt = now.getTime();
  return next;
}

export function setBookmark(p, { chapterId, verseKey }, now = new Date()) {
  const next = logActivity(p, "quran", 1, now);
  next.bookmark = { chapterId: int(chapterId, 114), verseKey: String(verseKey), at: now.getTime() };
  return clean(next);
}
