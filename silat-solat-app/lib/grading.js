// How often gradings happen. The admin sets the default; an instructor can set
// their own branch's (settings "grading_frequency:<branch>"). The app suggests
// the next date: the last Saturday of a grading month.
export const FREQUENCIES = {
  monthly: { ms: "Bulanan", en: "Monthly", every: 1 },
  bimonthly: { ms: "Setiap 2 bulan", en: "Every 2 months", every: 2 },
  quarterly: { ms: "Suku tahunan", en: "Quarterly", every: 3 },
  adhoc: { ms: "Ikut keperluan", en: "As needed", every: 0 },
};

function lastSaturday(year, month0) {
  const d = new Date(Date.UTC(year, month0 + 1, 0));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
  return d.toISOString().slice(0, 10);
}

/** The suggested next grading date on or after todayISO, or null for "as needed". */
export function suggestNextGrading(freq, todayISO) {
  const every = FREQUENCIES[freq]?.every ?? 1;
  if (!every) return null;
  let y = Number(todayISO.slice(0, 4));
  let m = Number(todayISO.slice(5, 7)) - 1;
  for (let i = 0; i < 24; i++) {
    if ((m + 1) % every === 0) {
      const d = lastSaturday(y, m);
      if (d >= todayISO) return d;
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return null;
}
