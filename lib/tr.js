// The same pair helper for client components, which get `lang` as a prop.
export function makeT(lang) {
  const t = (ms, en) => (lang === "en" ? en : ms);
  t.lang = lang;
  return t;
}

export const DAYS = {
  ms: ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
export const DAYS_SHORT = {
  ms: ["AHD", "ISN", "SEL", "RAB", "KHA", "JUM", "SAB"],
  en: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
};

/** "20:00" -> "8:00 mlm" / "8:00 pm". */
export function clock(hhmm, lang = "ms") {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  const h12 = ((h + 11) % 12) + 1;
  let suffix;
  if (lang === "en") suffix = h < 12 ? "am" : "pm";
  else suffix = h < 12 ? "pg" : h < 14 ? "tgh" : h < 19 ? "ptg" : "mlm";
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const MONTHS = {
  ms: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** "2026-11-29" (or a Date) -> "Sab, 29 Nov 2026" / "Sat, 29 Nov 2026". */
export function dateLabel(value, lang = "ms", { weekday = true } = {}) {
  const iso = value instanceof Date ? value.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }) : String(value).slice(0, 10);
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const day = (lang === "en" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Ahd", "Isn", "Sel", "Rab", "Kha", "Jum", "Sab"])[d.getUTCDay()];
  const text = `${d.getUTCDate()} ${MONTHS[lang][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return weekday ? `${day}, ${text}` : text;
}
