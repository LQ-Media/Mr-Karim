import Link from "next/link";
import Icon from "@/components/Icon";
import { PageTitle } from "@/components/Bits";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Belajar" };

export default async function Learn() {
  const t = await getT();
  const items = [
    { href: "/library", icon: "play", color: "#2E5AA6", title: t("Perpustakaan video", "Video library"), sub: t("Jurus, buah, tekpi dan tazkirah, ikut bengkung", "Jurus, buah, tekpi and talks, by sash") },
    { href: "/workout", icon: "clock", color: "#B5332B", title: t("Senaman Tabata", "Tabata workout"), sub: t("8 gerakan, 4 minit, dengan pemasa", "8 moves, 4 minutes, with a timer") },
    { href: "/quran", icon: "book-open", color: "#3E7B4F", title: t("Baca Al-Quran", "Quran reader"), sub: t("Teks, terjemahan, audio dan tajwid", "Text, translation, audio and tajweed") },
    { href: "/solat", icon: "moon-star", color: "#17140F", title: t("Waktu solat", "Prayer times"), sub: t("Hari ini, ikut kaedah MUIS", "Today, by MUIS's method") },
    { href: "/ask", icon: "message", color: "#8A6B1E", title: t("Tanya Ustaz Silat", "Ask Ustaz Silat"), sub: t("Soalan lazim tentang silat dan Islam", "Common questions on silat and Islam") },
    { href: "/story", icon: "flower", color: "#A9800F", title: t("Kisah & warisan", "Story & heritage"), sub: t("Si Rumpun Padi dan silat di Singapura", "Si Rumpun Padi and silat in Singapore") },
  ];
  return (
    <div className="ss-rise">
      <PageTitle kicker={t("Terbuka untuk semua", "Open to everyone")} title={t("Belajar", "Learn")}>
        {t("Semua kandungan percuma, sebagai dakwah.", "Everything here is free, as dakwah.")}
      </PageTitle>
      <div className="flex flex-col gap-2.5">
        {items.map((x) => (
          <Link key={x.href} href={x.href} className="flex items-center gap-4 rounded-[14px] bg-surface p-4 text-ink">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-white" style={{ background: x.color }}>
              <Icon name={x.icon} size={22} />
            </span>
            <span className="flex flex-1 flex-col">
              <strong className="text-[16px]">{x.title}</strong>
              <span className="text-[13px] text-muted">{x.sub}</span>
            </span>
            <Icon name="chevron-right" size={20} />
          </Link>
        ))}
      </div>
    </div>
  );
}
