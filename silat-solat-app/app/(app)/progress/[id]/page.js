import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import SashLadder from "@/components/SashLadder";
import { requireUser } from "@/lib/auth";
import { canViewMember, canCoachMember } from "@/lib/access";
import { getT } from "@/lib/i18n";
import { getMember, memberProgress } from "@/lib/data";
import { query } from "@/lib/db";
import { sashName, MAX_STRIPES } from "@/lib/sashes";

export const metadata = { title: "Kemajuan" };

export default async function Progress({ params }) {
  const { id } = await params;
  const user = await requireUser(`/progress/${id}`);
  const m = await getMember(id);
  if (!m || !(await canViewMember(user, m))) notFound();
  const t = await getT();
  const lang = t.lang;
  const p = await memberProgress(m);
  const notes = (await query("select body, at from member_notes where member_id = $1 order by at desc limit 5", [m.id])).rows;
  const coach = await canCoachMember(user, m);
  const isKid = m.stream === "kids";

  return (
    <div className="ss-rise flex flex-col gap-4">
      <section className="-mx-5 flex flex-col gap-4 bg-ink px-5 pb-5 pt-3 text-page lg:mx-0 lg:mt-5 lg:rounded-[18px]">
        <div className="flex items-center gap-1">
          <Link href={`/me?m=${m.id}`} aria-label={t("Kembali", "Back")} className="-ml-2 flex h-11 w-11 items-center justify-center text-page">
            <Icon name="chevron-left" size={24} />
          </Link>
          <h1 className="text-[22px]" style={{ color: "#F6F0E1" }}>{m.display_name} · {t("perjalanan bengkung", "sash journey")}</h1>
        </div>
        <SashLadder level={m.level} lang={lang} />
      </section>
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label={t("Sukatan", "Syllabus")} value={p.target ? `${p.itemsDone}/${p.itemsTotal}` : "✓"} ok={p.okItems} />
        <Stat label={t("Kehadiran", "Attendance")} value={p.target ? `${p.classesSince}/${p.target.minClasses}` : "—"} ok={p.okClasses} />
        <Stat label={t("Bulan", "Months")} value={p.target ? `${p.monthsSince}/${p.target.minMonths}` : "—"} ok={p.okTime} />
      </div>
      {isKid ? (
        <p className="text-[14px] text-muted">
          {t("Jalur dalam bengkung ini:", "Stripes on this sash:")} <strong>{m.stripes} / {MAX_STRIPES}</strong>
        </p>
      ) : null}
      {p.target ? (
        <>
          <h2 className="text-[20px]">{t("Sukatan", "Syllabus for")} {sashName(p.target.level, lang)}</h2>
          <ul className="overflow-hidden rounded-[14px] bg-surface">
            {p.target.items.map(([itemId, ms, en]) => {
              const done = p.done.has(itemId);
              return (
                <li key={itemId} className="flex items-center gap-2.5 border-b border-hairline-2 px-4 py-3 text-[14px] last:border-0">
                  {done ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-label={t("Ditandatangani", "Signed off")} role="img"><circle cx="12" cy="12" r="10" fill="#17140F" /><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#F6F0E1" strokeWidth="2.4" /></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8F8572" strokeWidth="2" aria-label={t("Belum", "Not yet")} role="img"><circle cx="12" cy="12" r="9.5" /></svg>
                  )}
                  <span className="flex-1">{lang === "en" ? en : ms}</span>
                  <span className="text-[12px] text-muted">{done ? t("Ditandatangani", "Signed off") : t("Belum", "Not yet")}</span>
                </li>
              );
            })}
          </ul>
          <p className="rounded-[12px] bg-accent-soft p-3 text-[14px] leading-relaxed">
            <strong>{t("Adab untuk tahap ini:", "Adab at this level:")}</strong> {p.target.adab[lang]}
          </p>
          {p.eligible ? (
            <p className="rounded-[12px] bg-ok-bg p-3 text-[14px] font-bold text-ok-fg">{t("Layak untuk gred seterusnya!", "Ready for the next grading!")}</p>
          ) : null}
        </>
      ) : null}
      {notes.length ? (
        <>
          <h2 className="text-[20px]">{t("Nota jurulatih", "Instructor notes")}</h2>
          {notes.map((n, i) => (
            <p key={i} className="rounded-[12px] bg-surface p-3 text-[14px] leading-relaxed">{n.body}</p>
          ))}
        </>
      ) : null}
      <div className="flex flex-col gap-2">
        <Link href="/grading" className="btn btn-ink">{t("Hari gred & sijil", "Grading days & certificates")}</Link>
        {coach ? <Link href={`/instructor/member/${m.id}`} className="btn btn-line">{t("Tandatangan sukatan", "Sign off syllabus")}</Link> : null}
      </div>
    </div>
  );
}

function Stat({ label, value, ok }) {
  return (
    <div className="flex flex-col rounded-[14px] bg-surface p-3">
      <span className="text-[12px] font-extrabold text-muted">{label}</span>
      <strong className="font-heading text-[22px]" style={{ color: ok ? "#3D6A2C" : "#17140F" }}>{value}</strong>
    </div>
  );
}
