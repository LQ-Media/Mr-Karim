// The book, until the real details are confirmed (spec: placeholder price).
export const BOOK = {
  title: "Silat & Solat",
  author: "Ustaz Mohammad Bahrul-Ulum",
  format: { ms: "Kulit lembut · Bahasa Melayu", en: "Softcover · Malay" },
  priceCents: Number(process.env.BOOK_PRICE_CENTS || 1500),
  postageCents: Number(process.env.BOOK_POSTAGE_CENTS || 300),
  blurb: {
    ms: "Manifesto gerakan ini: mengapa silat, apabila dilakukan dengan betul, menjadi wasilah dakwah dan jalan kembali ke masjid.",
    en: "The movement's manifesto: why silat, done right, is a way into dakwah and back to the mosque.",
  },
};
