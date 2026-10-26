// The standard six-sash silat ladder and its starter syllabus (spec, 25 Oct
// 2026). Each sash lists what you learn, and how long you train, to EARN it.
// A new member starts with no sash (level -1) and works on the white sash's
// syllabus; the first grading gives them the white sash. Item ids are stored with each instructor sign-off, so never reuse or
// renumber an id; add new ones instead. Kids (7–12) wear the same colours with
// up to three stripes (cula) inside each sash.

export const SASHES = [
  {
    level: 0,
    key: "putih",
    ms: "Putih",
    en: "White",
    color: "#FFFFFF",
    stage: { ms: "Asas", en: "Foundation" },
    adab: { ms: "Niat dan hormat kepada guru", en: "Intention and respect for the guru" },
    minMonths: 2,
    minClasses: 8,
    items: [
      ["p1", "Salam hormat", "Salam hormat (salute)"],
      ["p2", "Kuda-kuda asas", "Basic stances (kuda-kuda)"],
      ["p3", "Langkah 4 arah", "Footwork in 4 directions"],
      ["p4", "Tumbukan dan tendangan asas", "Basic punches and kicks"],
      ["p5", "Jatuh dengan selamat", "Falling safely"],
      ["p6", "Adab: niat dan hormat", "Adab: intention and respect"],
    ],
  },
  {
    level: 1,
    key: "kuning",
    ms: "Kuning",
    en: "Yellow",
    color: "#F2D24B",
    stage: { ms: "Asas lanjutan", en: "Advanced foundation" },
    adab: { ms: "Sabar dan kawal diri", en: "Patience and self-control" },
    minMonths: 3,
    minClasses: 12,
    items: [
      ["k1", "Elakan (4 arah)", "Evasions (4 directions)"],
      ["k2", "Tangkisan dalam dan luar", "Inside and outside blocks"],
      ["k3", "Langkah 8 arah", "Footwork in 8 directions"],
      ["k4", "Jurus 1", "Jurus 1"],
      ["k5", "Ujian kecergasan", "Fitness benchmark"],
      ["k6", "Adab: sabar dan kawal diri", "Adab: patience and self-control"],
    ],
  },
  {
    level: 2,
    key: "hijau",
    ms: "Hijau",
    en: "Green",
    color: "#3E9B5C",
    stage: { ms: "Pertengahan", en: "Intermediate" },
    adab: { ms: "Rendah diri, seperti padi", en: "Humility, like the bowing padi" },
    minMonths: 4,
    minClasses: 16,
    items: [
      ["h1", "Tangkapan", "Catches (tangkapan)"],
      ["h2", "Buah 1–5 (balas tumbukan)", "Buah 1–5 (counters to punches)"],
      ["h3", "Jurus 2", "Jurus 2"],
      ["h4", "Latihan berpasangan", "Partner drills"],
      ["h5", "Asas toya", "Staff (toya) basics"],
      ["h6", "Ujian kecergasan", "Fitness benchmark"],
      ["h7", "Adab: rendah diri", "Adab: humility"],
    ],
  },
  {
    level: 3,
    key: "biru",
    ms: "Biru",
    en: "Blue",
    color: "#4A78C8",
    stage: { ms: "Pertengahan lanjutan", en: "Upper intermediate" },
    adab: { ms: "Persaudaraan dan bantu junior", en: "Brotherhood and helping juniors" },
    minMonths: 6,
    minClasses: 24,
    items: [
      ["b1", "Buah 6–10 (balas pegangan dan tendangan)", "Buah 6–10 (counters to grabs and kicks)"],
      ["b2", "Kuncian", "Locks (kuncian)"],
      ["b3", "Jatuhan", "Takedowns (jatuhan)"],
      ["b4", "Jurus 3", "Jurus 3"],
      ["b5", "Asas tekpi", "Tekpi basics"],
      ["b6", "Ujian kecergasan", "Fitness benchmark"],
      ["b7", "Adab: persaudaraan", "Adab: brotherhood"],
    ],
  },
  {
    level: 4,
    key: "merah",
    ms: "Merah",
    en: "Red",
    color: "#D9554C",
    stage: { ms: "Lanjutan", en: "Advanced" },
    adab: { ms: "Kawal marah, adil dalam pertandingan", en: "Controlling anger; fairness in contest" },
    minMonths: 6,
    minClasses: 24,
    items: [
      ["m1", "Buah 11–15", "Buah 11–15"],
      ["m2", "Sambut (bertarung bebas)", "Free sparring (sambut)"],
      ["m3", "Latihan berbilang penyerang", "Multiple-attacker drills"],
      ["m4", "Jurus Tekpi", "Jurus Tekpi"],
      ["m5", "Ujian kecergasan", "Fitness benchmark"],
      ["m6", "Adab: kawal marah", "Adab: controlling anger"],
    ],
  },
  {
    level: 5,
    key: "hitam",
    ms: "Hitam",
    en: "Black",
    color: "#17140F",
    stage: { ms: "Jurulatih", en: "Instructor track" },
    adab: { ms: "Kepimpinan dan amanah", en: "Leadership and amanah" },
    minMonths: 12,
    minClasses: 48,
    items: [
      ["x1", "Ulang kaji seluruh sukatan", "Full syllabus review"],
      ["x2", "Mengajar kelas junior", "Teaching a junior class"],
      ["x3", "Seni dan bunga silat", "Seni and bunga silat"],
      ["x4", "Tekpi dan toya digunakan", "Tekpi and toya applied"],
      ["x5", "Persembahan", "Demonstration"],
      ["x6", "Adab: kepimpinan dan amanah", "Adab: leadership and amanah"],
    ],
  },
];

export const TOP_LEVEL = SASHES.length - 1;
export const NO_SASH_LEVEL = -1;
export const MAX_STRIPES = 3;

export const NO_SASH = {
  level: NO_SASH_LEVEL,
  key: "tiada",
  ms: "Belum berbengkung",
  en: "No sash yet",
  color: "#E2D8C2",
  items: [],
};

function toLevel(level) {
  const n = Number(level);
  return Number.isFinite(n) ? Math.max(NO_SASH_LEVEL, Math.min(TOP_LEVEL, Math.trunc(n))) : NO_SASH_LEVEL;
}

export function sash(level) {
  const l = toLevel(level);
  return l < 0 ? NO_SASH : SASHES[l];
}

/** The syllabus a member works on now: the items of the NEXT sash. */
export function nextSash(level) {
  const l = toLevel(level);
  return l >= TOP_LEVEL ? null : SASHES[l + 1];
}

export function sashName(level, lang = "ms", stripes = 0) {
  const s = sash(level);
  if (s === NO_SASH) return lang === "en" ? s.en : s.ms;
  const base = lang === "en" ? `${s.en} sash` : `Bengkung ${s.ms}`;
  if (!stripes) return base;
  return lang === "en" ? `${base} · ${stripes} stripe${stripes > 1 ? "s" : ""}` : `${base} · ${stripes} jalur`;
}

/**
 * May this member be invited to the next grading?
 * done: Set of signed-off item ids. classesSince: attendance since their last
 * grading (or joining). monthsSince: whole months since then.
 */
export function eligibility({ level, done, classesSince, monthsSince }) {
  const target = nextSash(level);
  if (!target) return { target: null, eligible: false, itemsDone: 0, itemsTotal: 0 };
  const itemsTotal = target.items.length;
  const itemsDone = target.items.filter(([id]) => done.has(id)).length;
  const okItems = itemsDone === itemsTotal;
  const okClasses = classesSince >= target.minClasses;
  const okTime = monthsSince >= target.minMonths;
  return {
    target,
    itemsDone,
    itemsTotal,
    classesSince,
    monthsSince,
    okItems,
    okClasses,
    okTime,
    eligible: okItems && okClasses && okTime,
  };
}
