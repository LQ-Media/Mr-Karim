import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { SashChip } from "@/components/Bits";
import { getT } from "@/lib/i18n";
import { getVideos } from "@/lib/data";
import { TOPICS } from "@/lib/library";

export default async function VideoPage({ params }) {
  const { id } = await params;
  const v = (await getVideos()).find((x) => x.id === id);
  if (!v) notFound();
  const t = await getT();
  const lang = t.lang;
  const steps = (lang === "en" ? v.steps_en : v.steps_ms) || "";
  const adab = lang === "en" ? v.adab_en : v.adab_ms;
  return (
    <div className="ss-rise -mx-5 lg:mx-0">
      <div className="relative aspect-video w-full bg-ink lg:mt-5 lg:overflow-hidden lg:rounded-[16px]">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}?rel=0`}
          title={lang === "en" ? v.title_en : v.title_ms}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex flex-col gap-4 px-5 pt-4 lg:px-0">
        <Link href="/library" className="flex items-center gap-1 text-[14px] font-bold text-accent-press">
          <Icon name="chevron-left" size={18} /> {t("Perpustakaan", "Library")}
        </Link>
        <div className="flex flex-wrap gap-1.5">
          {v.level !== null && v.level !== undefined ? <SashChip level={v.level} lang={lang} /> : null}
          <span className="chip" style={{ background: "#E6EDF8", color: "#1E3E75" }}>{TOPICS[v.topic]?.[lang] || v.topic}</span>
        </div>
        <h1 className="text-[26px] leading-[1.15]">{lang === "en" ? v.title_en : v.title_ms}</h1>
        {steps ? (
          <ol className="list-decimal pl-5 text-[15px] leading-relaxed">
            {steps.split("\n").filter(Boolean).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        ) : null}
        {adab ? (
          <div className="flex flex-col gap-1.5 rounded-[14px] bg-ink p-4 text-page">
            <span className="kicker" style={{ color: "#D9A521" }}>{t("Nota adab", "Adab note")}</span>
            <p className="text-[15px] leading-relaxed text-[#DCD3BF]">{adab}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
