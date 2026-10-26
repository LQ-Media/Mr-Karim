import Link from "next/link";
import ClassCard from "@/components/ClassCard";
import { PageTitle, Empty } from "@/components/Bits";
import { getT } from "@/lib/i18n";
import { getClasses, sortFromToday, withPrayer } from "@/lib/data";
import { STREAMS } from "@/lib/branches";
import Icon from "@/components/Icon";

export const metadata = { title: "Jadual" };

export default async function Schedule({ searchParams }) {
  const t = await getT();
  const lang = t.lang;
  const sp = await searchParams;
  const stream = STREAMS[sp?.stream] ? sp.stream : "adults";
  const classes = await withPrayer(sortFromToday((await getClasses()).filter((c) => c.stream === stream)));

  return (
    <div className="ss-rise">
      <PageTitle kicker={t("Lima masjid", "Five mosques")} title={t("Jadual kelas", "Class schedule")}>
        {t("Setiap kelas berhenti untuk solat berjemaah.", "Every class stops for congregational prayer.")}
      </PageTitle>
      <div role="group" aria-label={t("Aliran", "Stream")} className="mb-4 flex flex-wrap gap-2">
        {Object.entries(STREAMS).map(([key, label]) => (
          <Link
            key={key}
            href={`/schedule?stream=${key}`}
            aria-current={key === stream ? "true" : undefined}
            className="min-h-[38px] rounded-full px-4 py-2 text-[13px] font-extrabold"
            style={key === stream ? { background: "#17140F", color: "#F6F0E1" } : { border: "1.5px solid #17140F" }}
          >
            {label[lang]}
          </Link>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {classes.length ? classes.map((c) => <ClassCard key={c.id} c={c} lang={lang} prayer={c.prayer} />) : <Empty>{t("Tiada kelas.", "No classes.")}</Empty>}
      </div>
      <div className="mt-4 flex items-start gap-2.5 rounded-[12px] bg-accent-soft px-4 py-3 text-[13px] leading-relaxed">
        <Icon name="moon-star" size={18} />
        <span>
          {t(
            "Waktu solat ikut kaedah MUIS (melalui Aladhan) untuk tarikh kelas seterusnya.",
            "Prayer times follow MUIS's method (via Aladhan) for each class's next date."
          )}
        </span>
      </div>
      <Link href="/try" className="btn btn-gold mt-5 w-full">
        {t("Tempah kelas percubaan", "Book a trial class")}
      </Link>
    </div>
  );
}
