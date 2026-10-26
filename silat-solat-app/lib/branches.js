// The five mosque bases, each in the colour the group already uses for it on
// Instagram (@perguruansirumpunpadi). Changing a colour here changes it
// everywhere. Class times live in the database (admin › Classes).
export const BRANCHES = [
  {
    slug: "an-nur",
    name: "Masjid An-Nur",
    short: "An-Nur",
    area: "Woodlands",
    address: "6 Admiralty Road, Singapore 739983",
    color: "#E3B23C",
    colorName: { ms: "kuning", en: "yellow" },
    ring: false,
  },
  {
    slug: "alkaff",
    name: "Masjid Alkaff Kampung Melayu",
    short: "Alkaff",
    area: "Bedok",
    address: "200 Bedok Reservoir Road, Singapore 479221",
    color: "#C2362F",
    colorName: { ms: "merah", en: "red" },
    ring: false,
  },
  {
    slug: "ar-raudhah",
    name: "Masjid Ar-Raudhah",
    short: "Ar-Raudhah",
    area: "Bukit Batok",
    address: "30 Bukit Batok East Ave 2, Singapore 659919",
    color: "#FFFFFF",
    colorName: { ms: "putih", en: "white" },
    ring: true,
  },
  {
    slug: "darul-ghufran",
    name: "Masjid Darul Ghufran",
    short: "Darul Ghufran",
    area: "Tampines",
    address: "503 Tampines Ave 5, Singapore 529651",
    color: "#17140F",
    colorName: { ms: "hitam", en: "black" },
    ring: false,
  },
  {
    slug: "sallim-mattar",
    name: "Masjid Sallim Mattar",
    short: "Sallim Mattar",
    area: "MacPherson",
    address: "1 Mattar Road, Singapore 387725",
    color: "#2E5AA6",
    colorName: { ms: "biru", en: "blue" },
    ring: false,
  },
];

export const BY_SLUG = Object.fromEntries(BRANCHES.map((b) => [b.slug, b]));

export const STREAMS = {
  adults: { ms: "Dewasa & remaja", en: "Adults & teens" },
  sisters: { ms: "Muslimah", en: "Sisters" },
  kids: { ms: "Kanak-kanak 7–12", en: "Kids 7–12" },
};

export function mapsUrl(branch) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.name + " " + branch.address)}`;
}

// The starting timetable (spec, 25 Oct 2026). Only An-Nur Friday and Alkaff
// Saturday 8pm are published by the group; the rest are proposals for the
// Ustaz to confirm in admin › Classes.
export const SEED_CLASSES = [
  ["an-nur", "adults", 5, "20:00", "22:00", true],
  ["an-nur", "sisters", 0, "09:30", "11:00", false],
  ["an-nur", "kids", 0, "11:15", "12:30", false],
  ["alkaff", "adults", 6, "20:00", "22:00", true],
  ["alkaff", "sisters", 0, "09:30", "11:00", false],
  ["alkaff", "kids", 0, "11:15", "12:30", false],
  ["sallim-mattar", "adults", 2, "20:00", "22:00", false],
  ["sallim-mattar", "sisters", 6, "09:30", "11:00", false],
  ["sallim-mattar", "kids", 6, "11:15", "12:30", false],
  ["ar-raudhah", "adults", 4, "20:00", "22:00", false],
  ["ar-raudhah", "sisters", 6, "09:30", "11:00", false],
  ["ar-raudhah", "kids", 6, "11:15", "12:30", false],
  ["darul-ghufran", "adults", 3, "20:00", "22:00", false],
  ["darul-ghufran", "sisters", 6, "09:30", "11:00", false],
  ["darul-ghufran", "kids", 6, "11:15", "12:30", false],
];
