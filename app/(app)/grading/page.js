import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { getFamily, memberProgress, nextGrading } from "@/lib/data";
import { query } from "@/lib/db";
import { BY_SLUG } from "@/lib/branches";
import { sashName } from "@/lib/sashes";
import { PageTitle, Empty } from "@/components/Bits";
import { clock, dateLabel } from "@/lib/tr";

export const metadata = { title: "Gred & sijil" };

export default async function Grading() {
  const user = await requireUser("/grading");
  const t = await getT();
  const lang = t.lang;
  const family = await getFamily(user.id);
  const rows = await Promise.all(
    family.map(async (m) => ({ m, p: await memberProgress(m), g: await nextGrading(m.branch) }))
  );
  const certs = family.length
    ? (
        await query(
          `select r.id::text, r.to_level, r.result, r.approved, to_char(g.day,'YYYY-MM-DD') as day, m.display_name
           from grading_results r join gradings g on g.id = r.grading_id join members m on m.id = r.member_id
           where m.account_id = $1 and r.result in ('pass','conditional') order by g.day desc`,
          [user.id]
        )
      ).rows
    : [];

  return (
    <div className="ss-rise flex flex-col gap-4">
      <PageTitle kicker={t("Gred", "Grading")} title={t("Gred & sijil", "Grading & certificates")} />
      {rows.length === 0 ? <Empty>{t("Daftar profil latihan dahulu.", "Register a training profile first.")}</Empty> : null}
      {rows.map(({ m, p, g }) => (
        <section key={m.id} className="card flex flex-col gap-2 p-4">
          <span className="kicker text-muted">{m.display_name} · {BY_SLUG[m.branch].short}</span>
          {g ? (
            <strong className="font-heading text-[21px]">{dateLabel(g.day, lang)} · {clock(g.starts, lang)}</strong>
          ) : (
            <strong className="font-heading text-[19px]">{t("Tarikh gred belum ditetapkan", "No grading date set yet")}</strong>
          )}
          {p.target ? (
            <span className="text-[14px] text-[#3E372D]">{sashName(m.level, lang)} → {sashName(p.target.level, lang)}</span>
          ) : null}
          {p.target ? (
            p.eligible ? (
              <p className="rounded-[10px] bg-ok-bg p-2.5 text-[14px] font-bold text-ok-fg">{t("Layak. Jurulatih akan jemput anda.", "Eligible. The instructor will invite you.")}</p>
            ) : (
              <p className="rounded-[10px] bg-accent-soft p-2.5 text-[13px] leading-relaxed">
                {!p.okItems ? t(`Lengkapkan ${p.itemsTotal - p.itemsDone} lagi item sukatan. `, `Finish ${p.itemsTotal - p.itemsDone} more syllabus items. `) : ""}
                {!p.okClasses ? t(`Perlu ${p.target.minClasses - p.classesSince} lagi kelas. `, `${p.target.minClasses - p.classesSince} more classes needed. `) : ""}
                {!p.okTime ? t(`Minimum ${p.target.minMonths} bulan pada tahap ini.`, `At least ${p.target.minMonths} months at this level.`) : ""}
              </p>
            )
          ) : null}
          <Link href={`/progress/${m.id}`} className="text-[14px] font-bold text-accent-press">{t("Lihat sukatan", "See the syllabus")}</Link>
        </section>
      ))}
      <h2 className="text-[20px]">{t("Sijil", "Certificates")}</h2>
      {certs.length === 0 ? (
        <Empty>{t("Sijil muncul di sini selepas lulus gred.", "Certificates appear here after a grading pass.")}</Empty>
      ) : (
        certs.map((c) => (
          <Link key={c.id} href={`/certificate/${c.id}`} className="flex items-center justify-between rounded-[14px] bg-surface p-4 text-ink">
            <span className="flex flex-col">
              <strong>{c.display_name} · {sashName(c.to_level, lang)}</strong>
              <span className="text-[13px] text-muted">{dateLabel(c.day, lang)}{!c.approved ? ` · ${t("menunggu kelulusan Ustaz", "awaiting the Ustaz's approval")}` : ""}</span>
            </span>
            <span className="text-[14px] font-bold text-accent-press">{t("Buka", "Open")}</span>
          </Link>
        ))
      )}
    </div>
  );
}
