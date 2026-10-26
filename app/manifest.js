import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE } from "@/lib/brand";

const ICON_VERSION = "2026-10-26";

export default function manifest() {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_TAGLINE,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ms",
    background_color: "#17140F",
    theme_color: "#17140F",
    categories: ["education", "sports", "lifestyle"],
    icons: [
      { src: `/icon-192.png?v=${ICON_VERSION}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/icon-512.png?v=${ICON_VERSION}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/icon-maskable-512.png?v=${ICON_VERSION}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Jadual kelas", short_name: "Jadual", url: "/schedule" },
      { name: "Daftar hadir", short_name: "Hadir", url: "/me" },
      { name: "Al-Quran", short_name: "Quran", url: "/quran" },
    ],
  };
}
