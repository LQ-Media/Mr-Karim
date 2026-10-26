// The first videos in the library: the two public YouTube uploads found in the
// research (25 Oct 2026). Instructors add technique clips in admin › Library;
// none are invented here. Levels: null = for everyone.
export const TOPICS = {
  jurus: { ms: "Jurus", en: "Jurus" },
  buah: { ms: "Buah", en: "Buah" },
  tekpi: { ms: "Tekpi", en: "Tekpi" },
  adab: { ms: "Adab", en: "Adab" },
  fitness: { ms: "Senaman", en: "Fitness" },
  tazkirah: { ms: "Tazkirah", en: "Talks" },
  seni: { ms: "Seni & persembahan", en: "Demonstrations" },
};

export const SEED_VIDEOS = [
  {
    youtube: "KdU79Sj_12E",
    ms: "Belajar silat dan solat? Macam mana tu",
    en: "Learning silat and solat? How does that work",
    topic: "tazkirah",
    adabMs: "Silat sebagai wasilah dakwah: latih tubuh di masjid, kemudian berdiri bersama untuk solat.",
    adabEn: "Silat as a way into dakwah: train the body in the mosque, then stand together for solat.",
  },
  {
    youtube: "mVpucGt95Rw",
    ms: "Persembahan silat Si Rumpun Padi, UIA (2003)",
    en: "Si Rumpun Padi silat demonstration, IIUM (2003)",
    topic: "seni",
  },
];

/** "https://youtu.be/x", "...watch?v=x", "x" -> "x" (11 chars), else "". */
export function youtubeId(input) {
  const s = String(input || "").trim();
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/) || s.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : "";
}
