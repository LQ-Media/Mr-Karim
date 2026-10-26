import "server-only";
import { dbConfigured, query } from "./db.js";
import { SEED_CLASSES, BY_SLUG } from "./branches.js";
import { nowInSgt } from "./time.js";
import { eligibility } from "./sashes.js";

/** Every active class. Without a database, the starting timetable. */
export async function getClasses({ includeInactive = false } = {}) {
  if (!dbConfigured()) {
    return SEED_CLASSES.map(([branch, stream, weekday, starts, ends, confirmed], i) => ({
      id: String(i + 1),
      branch,
      stream,
      weekday,
      starts,
      ends,
      confirmed,
      active: true,
      note: null,
    }));
  }
  const { rows } = await query(
    `select id::text, branch, stream, weekday, starts, ends, confirmed, active, note from classes
     ${includeInactive ? "" : "where active"} order by weekday, starts`
  );
  return rows.filter((c) => BY_SLUG[c.branch]);
}

export async function getClass(id) {
  if (!dbConfigured()) return (await getClasses()).find((c) => c.id === String(id)) || null;
  const { rows } = await query(
    "select id::text, branch, stream, weekday, starts, ends, confirmed, active, note from classes where id = $1",
    [id]
  );
  return rows[0] || null;
}

/** Order classes from today onwards: a Friday class shows first on a Friday. */
export function sortFromToday(classes) {
  const today = nowInSgt().weekday;
  return [...classes].sort(
    (a, b) => ((a.weekday - today + 7) % 7) - ((b.weekday - today + 7) % 7) || a.starts.localeCompare(b.starts)
  );
}

/** The next calendar date (YYYY-MM-DD, Singapore) a weekday falls on. */
export function nextDateFor(weekday, from = new Date()) {
  const { weekday: today, dateISO } = nowInSgt(from);
  const add = (weekday - today + 7) % 7;
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

export function todaySgt() {
  return nowInSgt().dateISO;
}

/** The family profiles on an account. */
export async function getFamily(accountId) {
  const { rows } = await query(
    `select m.*, m.id::text as id,
       (select count(*)::int from attendance a where a.member_id = m.id) as classes_total
     from members m where account_id = $1 order by created_at`,
    [accountId]
  );
  return rows;
}

export async function getMember(id) {
  const { rows } = await query("select *, id::text as id, account_id::text as account_id from members where id = $1", [id]);
  return rows[0] || null;
}

/** Progress towards the next sash for one member. */
export async function memberProgress(member) {
  const [signed, att] = await Promise.all([
    query("select item, at from signoffs where member_id = $1", [member.id]),
    query("select count(*)::int as n from attendance where member_id = $1 and day >= $2", [
      member.id,
      member.level_since,
    ]),
  ]);
  const done = new Set(signed.rows.map((r) => r.item));
  const since = new Date(member.level_since);
  const now = new Date();
  const monthsSince = (now.getUTCFullYear() - since.getUTCFullYear()) * 12 + (now.getUTCMonth() - since.getUTCMonth());
  return {
    done,
    ...eligibility({ level: member.level, done, classesSince: att.rows[0].n, monthsSince }),
  };
}

/** The announcements a family should see: everyone's, plus their branches and streams. */
export async function announcementsFor(family, limit = 20) {
  const pairs = family.map((m) => [m.branch, m.stream]);
  const { rows } = await query(
    `select a.*, a.id::text as id from announcements a
     order by at desc limit 100`
  );
  return rows
    .filter(
      (a) =>
        (!a.branch && !a.stream) ||
        pairs.some(([b, s]) => (!a.branch || a.branch === b) && (!a.stream || a.stream === s))
    )
    .slice(0, limit);
}

/** The next grading day for a branch (or for all), today or later. */
export async function nextGrading(branch) {
  const { rows } = await query(
    `select g.id::text as id, g.branch, g.starts, to_char(g.day, 'YYYY-MM-DD') as day from gradings g
     where g.day >= $1 and (g.branch is null or g.branch = $2) order by g.day limit 1`,
    [todaySgt(), branch]
  );
  return rows[0] || null;
}

/** Each class with the prayer that falls in it on its next date. */
export async function withPrayer(classes) {
  const { prayerTimesFor, prayerDuring } = await import("./prayer.js");
  const days = [...new Set(classes.map((c) => c.weekday))];
  const times = Object.fromEntries(
    await Promise.all(days.map(async (d) => [d, await prayerTimesFor(nextDateFor(d))]))
  );
  return classes.map((c) => ({ ...c, prayer: prayerDuring(times[c.weekday], c.starts, c.ends) }));
}

/** Library videos. Without a database, the seed list. */
export async function getVideos({ all = false } = {}) {
  if (!dbConfigured()) {
    const { SEED_VIDEOS } = await import("./library.js");
    return SEED_VIDEOS.map((x, i) => ({
      id: String(i + 1), youtube_id: x.youtube, title_ms: x.ms, title_en: x.en, level: x.level ?? null, topic: x.topic,
      steps_ms: x.stepsMs || null, steps_en: x.stepsEn || null, adab_ms: x.adabMs || null, adab_en: x.adabEn || null, published: true,
    }));
  }
  const { rows } = await query(
    `select *, id::text as id from videos ${all ? "" : "where published"} order by sort, created_at desc`
  );
  return rows;
}
