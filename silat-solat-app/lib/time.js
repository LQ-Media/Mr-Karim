// Everything a parent sees is in Singapore time, regardless of where the
// container runs. Railway/Fly default to UTC, so "today" must be computed
// against Asia/Singapore explicitly or the schedule silently shifts 8 hours.
export const TZ = "Asia/Singapore";

const PARTS = new Intl.DateTimeFormat("en-SG", {
  timeZone: TZ,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Current SGT wall clock: { weekday 0-6, minutes from midnight, dateISO }. */
export function nowInSgt(at = new Date()) {
  const parts = {};
  for (const p of PARTS.formatToParts(at)) parts[p.type] = p.value;
  // en-SG can render midnight as "24" — normalise it to 0.
  const hour = Number(parts.hour) % 24;
  return {
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
    minutes: hour * 60 + Number(parts.minute),
    dateISO: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** '2026-11-30' → '30/11/2026', how the office writes dates. */
export function dmy(dateISO) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateISO ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** 990 → "4:30pm". */
export function formatTime(startMin) {
  const h24 = Math.floor(startMin / 60) % 24;
  const m = startMin % 60;
  const suffix = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ":00"}${suffix}`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Sunday, 2 August" — the header subtitle format from the design. */
export function formatToday(at = new Date()) {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
}

/** "1 September" — for due dates. */
export function formatDueDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-SG", { timeZone: "UTC", day: "numeric", month: "long" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

/**
 * How far away a session is, in plain language.
 * Deliberately not "in 0 minutes": a class that has begun says so.
 */
export function describeGap(minutesUntil, weekdayOffset, startMin) {
  if (minutesUntil < 0) return "on now";
  if (minutesUntil === 0) return "starting now";
  if (weekdayOffset === 0 && minutesUntil < 60) return `in ${minutesUntil} minutes`;
  if (weekdayOffset === 0) return `today ${formatTime(startMin)}`;
  if (weekdayOffset === 1) return `tomorrow ${formatTime(startMin)}`;
  return "";
}

/** "Today 4:30pm" / "Tomorrow 4:30pm" / "Saturday 10:00am". */
export function formatWhen(weekdayOffset, weekday, startMin) {
  const time = formatTime(startMin);
  if (weekdayOffset === 0) return `Today ${time}`;
  if (weekdayOffset === 1) return `Tomorrow ${time}`;
  return `${DAY_NAMES[weekday]} ${time}`;
}

/**
 * The same moment as prose, for use mid-sentence: "at 4:30pm today".
 * formatWhen() is the label form ("Today 4:30pm") used on cards.
 */
export function formatWhenProse(weekdayOffset, weekday, startMin) {
  const time = `at ${formatTime(startMin)}`;
  if (weekdayOffset === 0) return `${time} today`;
  if (weekdayOffset === 1) return `${time} tomorrow`;
  return `${time} on ${DAY_NAMES[weekday]}`;
}

/** "5 hours ago" / "Yesterday" / "3 days ago" — the feed timestamp. */
export function relativeTime(iso, at = new Date()) {
  const then = new Date(iso);
  const mins = Math.round((at - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-SG", { timeZone: TZ, day: "numeric", month: "short" }).format(then);
}

/** 18000 → "$180". Cents are shown only when they are not zero. */
export function money(cents) {
  const whole = cents / 100;
  return Number.isInteger(whole) ? `$${whole}` : `$${whole.toFixed(2)}`;
}
