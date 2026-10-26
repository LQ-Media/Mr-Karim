import Link from "next/link";
import Icon from "@/components/Icon";
import { PageTitle, SashChip, Empty } from "@/components/Bits";
import { getT } from "@/lib/i18n";
import { getVideos } from "@/lib/data";
import { SASHES } from "@/lib/sashes";
import { TOPICS } from "@/lib/library";

export const metadata = { title: "Perpustakaan" };

export default async function Library({ searchParams }) {
  const t = await getT();
  const lang = t.lang;
  const sp = await searchParams;
  const level = sp?.level === undefined || sp.level === "" ? null : Number(sp.level);
  const q = String(sp?.q || "").trim().toLowerCase();
  const all = await getVideos();
  const videos = all.filter(
    (v) =>
      (level === null || v.level === level) &&
      (!q || `${v.title_ms} ${v.title_en} ${v.topic}`.toLowerCase().includes(q))
  );

  return (
    <div className="ss-rise">
      <PageTitle kicker={t("Belajar", "Learn")} title={t("Perpustakaan video", "Video library")} />
      <form className="mb-3 flex items-center gap-2 rounded-[12px] border border-hairline bg-surface px-3" role="search">
        <Icon name="search" size={18} />
        <input name="q" defaultValue={sp?.q || ""} placeholder={t("Cari jurus, buah, tekpi…", "Search jurus, buah, tekpi…")} aria-label={t("Cari", "Search")} className="min-h-[46px] flex-1 bg-transparent text-[15px] outline-none" />
        {level !== null ? <input type="hidden" name="level" value={level} /> : null}
      </form>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("Tahap bengkung", "Sash level")}>
        <Link href="/library" className="shrink-0 rounded-full px-3.5 py-2 text-[13px] font-extrabold" style={level === null ? { background: "#17140F", color: "#F6F0E1" } : { border: "1.5px solid #17140F" }}>
          {t("Semua", "All")}
        </Link>
        {SASHES.map((s) => (
          <Link key={s.level} href={`/library?level=${s.level}`} className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold" style={level === s.level ? { background: "#17140F", color: "#F6F0E1" } : { border: "1.5px solid #17140F" }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color, border: "1px solid #8F8572" }} />
            {lang === "en" ? s.en : s.ms}
          </Link>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {videos.length === 0 ? (
          <Empty>
            {t(
              "Belum ada video untuk tahap ini. Jurulatih akan menambahnya tidak lama lagi.",
              "No videos for this level yet. Instructors will add them soon."
            )}
          </Empty>
        ) : (
          videos.map((v) => (
            <Link key={v.id} href={`/library/${v.id}`} className="flex items-center gap-3 rounded-[14px] bg-surface p-2.5 text-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`} alt="" width={120} height={68} className="h-[68px] w-[120px] shrink-0 rounded-[10px] bg-ink object-cover" loading="lazy" />
              <span className="flex min-w-0 flex-col gap-1">
                <strong className="text-[15px] leading-snug">{lang === "en" ? v.title_en : v.title_ms}</strong>
                <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                  {v.level !== null && v.level !== undefined ? <SashChip level={v.level} lang={lang} /> : null}
                  {TOPICS[v.topic]?.[lang] || v.topic}
                </span>
              </span>
            </Link>
          ))
        )}
      </div>
      <Link href="/workout" className="mt-4 flex items-center gap-3 rounded-[14px] p-4 text-white" style={{ background: "#B5332B" }}>
        <Icon name="clock" size={22} />
        <span className="flex flex-col">
          <strong>{t("Nak elak mengantuk lepas Subuh?", "Sleepy after Subuh?")}</strong>
          <span className="text-[13px]">{t("Senaman Tabata 4 minit dengan pemasa", "A 4-minute Tabata with a timer")}</span>
        </span>
      </Link>
    </div>
  );
}
