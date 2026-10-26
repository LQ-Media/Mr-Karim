// The five tabs on a phone; the same links sit in the top bar on a computer.
export const NAV = [
  { href: "/", icon: "home", ms: "Utama", en: "Home", match: (p) => p === "/" },
  { href: "/schedule", icon: "calendar", ms: "Jadual", en: "Schedule", match: (p) => p.startsWith("/schedule") || p.startsWith("/branches") || p.startsWith("/try") },
  { href: "/learn", icon: "play", ms: "Belajar", en: "Learn", match: (p) => ["/learn", "/library", "/workout", "/quran", "/solat", "/ask", "/story"].some((x) => p.startsWith(x)) },
  { href: "/ask", icon: "message", ms: "Tanya", en: "Ask", match: (p) => p.startsWith("/ask") },
  { href: "/me", icon: "user", ms: "Saya", en: "Me", match: (p) => ["/me", "/profile", "/register", "/progress", "/grading", "/news", "/checkin", "/instructor", "/admin", "/signin"].some((x) => p.startsWith(x)) },
];
