import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canViewMember } from "@/lib/access";
import { getT } from "@/lib/i18n";
import { query } from "@/lib/db";
import { getMember } from "@/lib/data";
import { sash } from "@/lib/sashes";
import { BY_SLUG } from "@/lib/branches";
import { SCHOOL_NAME, USTAZ_NAME } from "@/lib/brand";
import { PadiMark } from "@/components/Logo";
import PrintButton from "./PrintButton";

export const metadata = { title: "Sijil" };

/** A bilingual certificate. "Save as PDF" is the phone's own print sheet. */
export default async function Certificate({ params }) {
  const { id } = await params;
  const user = await requireUser(`/certificate/${id}`);
  const { rows } = await query(
    `select r.*, to_char(g.day,'DD.MM.YYYY') as day from grading_results r join gradings g on g.id = r.grading_id where r.id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r || !r.approved || r.result === "retry") notFound();
  const m = await getMember(r.member_id);
  if (!(await canViewMember(user, m))) notFound();
  const t = await getT();
  const s = sash(r.to_level);
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <article className="relative flex w-full max-w-[760px] flex-col items-center gap-3 rounded-[12px] border border-[#D8CDB4] bg-white px-6 py-10 text-center">
        <span aria-hidden="true" className="absolute inset-2 rounded-[8px] border-2 border-gold" />
        <PadiMark size={56} color="#B88A12" />
        <p className="kicker">Sijil Kenaikan Bengkung · Certificate of Grading</p>
        <h1 className="text-[34px]">{m.full_name}</h1>
        <p className="text-[16px]">
          telah lulus · has passed <strong>Bengkung {s.ms} · {s.en} sash</strong>
        </p>
        <span className="h-4 w-40 rounded-full" style={{ background: s.color, border: "1px solid #8F8572" }} aria-hidden="true" />
        <p className="text-[14px] text-muted">{SCHOOL_NAME} · {BY_SLUG[m.branch].name} · {r.day}</p>
        <div className="mt-6 flex flex-col items-center">
          <span className="w-56 border-t border-ink pt-1 text-[13px]">{USTAZ_NAME}</span>
          <span className="text-[12px] text-muted">Guru Utama · Head Teacher</span>
        </div>
      </article>
      <PrintButton label={t("Simpan sebagai PDF / cetak", "Save as PDF / print")} />
    </div>
  );
}
