import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { getT } from "@/lib/i18n";
import { BY_SLUG, STREAMS, mapsUrl } from "@/lib/branches";
import { getClasses, withPrayer } from "@/lib/data";
import { DAYS, clock } from "@/lib/tr";
import { USTAZ_NAME } from "@/lib/brand";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return { title: BY_SLUG[slug]?.name || "Cawangan" };
}

export default async function Branch({ params }) {
  const { slug } = await params;
  const b = BY_SLUG[slug];
  if (!b) notFound();
  const t = await getT();
  const lang = t.lang;
  const classes = await withPrayer((await getClasses()).filter((c) => c.branch === slug));
  const dark = b.slug === "darul-ghufran" || b.slug === "sallim-mattar" || b.slug === "alkaff";

  return (
    <div className="ss-rise -mx-5 lg:mx-0">
      <header className="flex flex-col gap-1.5 px-5 pb-6 pt-5 lg:rounded-b-[20px]" style={{ background: b.color, color: dark ? "#FBF8F0" : "#17140F", borderBottom: b.ring ? "1px solid #E2D8C2" : 0 }}>
        <Link href="/schedule" aria-label={t("Kembali", "Back")} className="-ml-2 flex h-11 w-11 items-center justify-center" style={{ color: "inherit" }}>
          <Icon name="chevron-left" size={24} />
        </Link>
        <p className="kicker">{t(`Cawangan ${b.colorName.ms}`, `The ${b.colorName.en} branch`)}</p>
        <h1 className="text-[32px] leading-[1.05]" style={{ color: "inherit" }}>{b.name}</h1>
        <p className="text-[14px] font-semibold">{b.address}</p>
      </header>
      <div className="flex flex-col gap-3 px-5 pt-4 lg:px-0">
        <div className="flex gap-2">
          <a href={mapsUrl(b)} target="_blank" rel="noopener noreferrer" className="btn btn-ink flex-1">
            <Icon name="map-pin" size={18} /> {t("Arah ke sini", "Directions")}
          </a>
          <Link href={`/try?branch=${b.slug}`} className="btn btn-line flex-1">
            {t("Cuba kelas", "Try a class")}
          </Link>
        </div>
        <h2 className="mt-2 text-[20px]">{t("Kelas", "Classes")}</h2>
        {classes.map((c) => (
          <div key={c.id} className="flex flex-col gap-1 rounded-[14px] bg-surface p-3.5">
            <div className="flex flex-wrap justify-between gap-2">
              <strong className="text-[15px]">{STREAMS[c.stream][lang]}</strong>
              <span className="text-[14px] font-bold">
                {DAYS[lang][c.weekday]} {clock(c.starts, lang)}–{clock(c.ends, lang)}
              </span>
            </div>
            <span className="text-[13px] text-muted">
              {c.stream === "sisters"
                ? t("Jurulatih wanita · ruang tertutup", "Female instructor · closed room")
                : c.stream === "kids"
                  ? t("Termasuk latihan wuduk dan solat", "Includes wudhu and solat practice")
                  : c.prayer
                    ? t(`${c.prayer.name} berjemaah, ${clock(c.prayer.at, lang)}`, `${c.prayer.name} in jemaah, ${clock(c.prayer.at, lang)}`)
                    : t("Solat berjemaah bersama", "Prayer together")}
              {!c.confirmed ? ` · ${t("masa belum disahkan", "time to be confirmed")}` : ""}
            </span>
          </div>
        ))}
        <h2 className="mt-2 text-[20px]">{t("Guru", "Teacher")}</h2>
        <div className="flex items-center gap-3 rounded-[14px] bg-surface p-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink font-extrabold text-gold">U</span>
          <span className="text-[14px] leading-snug">
            <strong>{USTAZ_NAME}</strong>
            <br />
            <span className="text-muted">{t("Guru utama, Perguruan Si Rumpun Padi", "Head teacher, Perguruan Si Rumpun Padi")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
