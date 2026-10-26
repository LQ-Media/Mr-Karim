import Link from "next/link";
import Icon from "@/components/Icon";
import ClassCard from "@/components/ClassCard";
import SolatWidget from "@/components/SolatWidget";
import { getT } from "@/lib/i18n";
import { getUser, firstName } from "@/lib/auth";
import { getClasses, sortFromToday, withPrayer } from "@/lib/data";
import { SCHOOL_NAME } from "@/lib/brand";
import { Notice } from "@/components/Bits";

export default async function Home({ searchParams }) {
  const t = await getT();
  const lang = t.lang;
  const sp = await searchParams;
  const user = await getUser();
  const classes = await withPrayer(sortFromToday((await getClasses()).filter((c) => c.stream === "adults")).slice(0, 3));

  const tiles = [
    { href: "/library", icon: "play", color: "#2E5AA6", title: t("Perpustakaan video", "Video library"), sub: t("Jurus, buah, tekpi", "Jurus, buah, tekpi") },
    { href: "/workout", icon: "clock", color: "#B5332B", title: t("Senaman Tabata", "Tabata workout"), sub: t("Ikut bersama, 4 minit", "Follow along, 4 min") },
    { href: "/quran", icon: "book-open", color: "#3E7B4F", title: t("Baca Al-Quran", "Quran reader"), sub: t("Dengan audio dan tajwid", "With audio and tajweed") },
    { href: "/ask", icon: "message", color: "#8A6B1E", title: t("Tanya Ustaz Silat", "Ask Ustaz Silat"), sub: t("Silat itu syirik?", "Is silat syirik?") },
    { href: "/support", icon: "heart", color: "#17140F", title: t("Sokong kami", "Support us"), sub: t("Dari S$10 sebulan", "From S$10 a month") },
    { href: "/shop", icon: "book-marked", color: "#A9800F", title: t("Buku Silat & Solat", "The Silat & Solat book"), sub: t("Pesan dalam aplikasi", "Order in the app") },
  ];

  return (
    <div className="ss-rise flex flex-col gap-6 pt-5">
      {sp?.deleted ? <Notice tone="ok">{t("Akaun anda telah dipadam.", "Your account has been deleted.")}</Notice> : null}

      <section className="flex flex-col gap-3 rounded-[20px] bg-ink p-6 text-page">
        <p className="kicker" style={{ color: "#D9A521" }}>{SCHOOL_NAME}</p>
        <h1 className="text-[38px] leading-[1.02]" style={{ color: "#F6F0E1" }}>
          {t("Lepas silat,", "After silat,")}
          <br />
          {t("solat.", "solat.")}
        </h1>
        <p className="text-[15px] leading-relaxed text-[#DCD3BF]">
          {user
            ? t(`Assalamualaikum, ${firstName(user)}. Jumpa di kelas!`, `Assalamualaikum, ${firstName(user)}. See you in class!`)
            : t(
                "Belajar silat di masjid, kemudian solat berjemaah. Percuma untuk semua peringkat umur.",
                "Learn silat at the mosque, then pray together. Free, for every age."
              )}
        </p>
        <div className="mt-1 flex gap-2.5">
          <Link href="/try" className="btn btn-gold flex-1">
            {t("Cuba kelas percuma", "Try a free class")}
          </Link>
          <Link href={user ? "/me" : "/signin"} className="btn border-[1.5px] border-page text-page">
            {user ? t("Laman saya", "My page") : t("Log masuk", "Sign in")}
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[21px]">{t("Kelas akan datang", "Coming up")}</h2>
          <Link href="/schedule" className="text-[14px] font-bold text-accent-press">
            {t("Semua jadual", "Full schedule")}
          </Link>
        </div>
        {classes.map((c) => (
          <ClassCard key={c.id} c={c} lang={lang} prayer={c.prayer} />
        ))}
      </section>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {tiles.map((x) => (
          <Link key={x.href} href={x.href} className="flex flex-col gap-1.5 rounded-[14px] bg-surface p-3.5 text-ink">
            <span style={{ color: x.color }}>
              <Icon name={x.icon} size={24} />
            </span>
            <strong className="text-[15px] leading-tight">{x.title}</strong>
            <span className="text-[13px] text-muted">{x.sub}</span>
          </Link>
        ))}
      </section>

      <SolatWidget />

      <Link href="/story" className="flex items-center justify-between rounded-[14px] bg-accent-soft p-4 text-ink">
        <span className="flex flex-col">
          <strong className="font-heading text-[18px]">{t("Makin berisi, makin tunduk", "The fuller it grows, the lower it bows")}</strong>
          <span className="text-[13px] text-muted">{t("Kisah Si Rumpun Padi", "The story of Si Rumpun Padi")}</span>
        </span>
        <Icon name="chevron-right" size={20} />
      </Link>
    </div>
  );
}
