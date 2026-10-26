import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { requireInstructor } from "@/lib/auth";
import { canCoachMember } from "@/lib/access";
import { getT } from "@/lib/i18n";
import { getMember, memberProgress } from "@/lib/data";
import { query } from "@/lib/db";
import { sashName, MAX_STRIPES } from "@/lib/sashes";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { dateLabel } from "@/lib/tr";
import { toggleSignoff, addNote, setStripes } from "@/app/instructor-actions";

export const metadata = { title: "Tandatangan sukatan" };

export default async function SignOff({ params }) {
  const { id } = await params;
  const user = await requireInstructor(`/instructor/member/${id}`);
  const m = await getMember(id);
  if (!m || !(await canCoachMember(user, m))) notFound();
  const t = await getT();
  const lang = t.lang;
  const p = await memberProgress(m);
  const [notes, parent] = await Promise.all([
    query("select body, at from member_notes where member_id = $1 order by at desc limit 10", [m.id]),
    query("select name, email, phone from app_users where id = $1", [m.account_id]),
  ]);
  const pct = p.itemsTotal ? Math.round((p.itemsDone / p.itemsTotal) * 100) : 100;
  const contact = parent.rows[0];

  return (
    <div className="ss-rise flex flex-col gap-4">
      <section className="-mx-5 flex flex-col gap-1 bg-ink px-5 pb-4 pt-3 text-page lg:mx-0 lg:mt-5 lg:rounded-[18px]">
        <div className="flex items-center gap-1">
          <Link href="/instructor" aria-label={t("Kembali", "Back")} className="-ml-2 flex h-11 w-11 items-center justify-center text-page">
            <Icon name="chevron-left" size={24} />
          </Link>
          <p className="kicker" style={{ color: "#D9A521" }}>{t("Tandatangan sukatan", "Syllabus sign-off")}</p>
        </div>
        <h1 className="text-[24px]" style={{ color: "#F6F0E1" }}>{m.full_name}</h1>
        <p className="text-[14px] text-[#DCD3BF]">
          {BY_SLUG[m.branch].short} · {STREAMS[m.stream][lang]} · {sashName(m.level, lang, m.stripes)}
          {p.target ? ` → ${sashName(p.target.level, lang)}` : ""}
        </p>
      </section>

      {m.medical_notes ? <p className="rounded-[12px] bg-warn-bg p-3 text-[14px] font-bold text-warn-fg">⚕ {m.medical_notes}</p> : null}

      {p.target ? (
        <>
          <div>
            <div className="flex justify-between text-[14px] font-extrabold">
              <span>{t("Item ditandatangani", "Items signed off")}</span>
              <span>{p.itemsDone} / {p.itemsTotal}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-hairline">
              <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {t("Kehadiran", "Attendance")} {p.classesSince}/{p.target.minClasses} · {t("bulan", "months")} {p.monthsSince}/{p.target.minMonths}
            </p>
          </div>
          <ul className="overflow-hidden rounded-[14px] bg-surface">
            {p.target.items.map(([itemId, ms, en]) => {
              const on = p.done.has(itemId);
              return (
                <li key={itemId} className="border-b border-hairline-2 last:border-0">
                  <form action={toggleSignoff} className="flex items-center gap-3 px-4 py-2">
                    <input type="hidden" name="memberId" value={m.id} />
                    <input type="hidden" name="item" value={itemId} />
                    <input type="hidden" name="on" value={on ? "0" : "1"} />
                    <span className="flex-1 text-[15px]">{lang === "en" ? en : ms}</span>
                    <button aria-pressed={on} className="min-h-[40px] min-w-[96px] rounded-[10px] border-[1.5px] border-ink px-3 text-[13px] font-extrabold" style={on ? { background: "#17140F", color: "#F6F0E1" } : undefined}>
                      {on ? `✓ ${t("Lulus", "Done")}` : t("Tandatangan", "Sign off")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          {p.eligible ? (
            <p className="rounded-[12px] bg-ok-bg p-3 text-[14px] font-bold text-ok-fg">
              {t(`Semua lengkap: ${m.display_name} akan dijemput ke gred seterusnya.`, `All complete: ${m.display_name} will be invited to the next grading.`)}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[15px]">{t("Bengkung Hitam: tiada sukatan lagi.", "Black sash: no further syllabus.")}</p>
      )}

      {m.stream === "kids" ? (
        <form action={setStripes} className="card flex items-center gap-3 p-4">
          <input type="hidden" name="memberId" value={m.id} />
          <label className="flex-1 text-[15px] font-bold" htmlFor="stripes">{t("Jalur (cula)", "Stripes (cula)")}</label>
          <select id="stripes" name="stripes" defaultValue={m.stripes} className="input w-24">
            {Array.from({ length: MAX_STRIPES + 1 }, (_, i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <button className="btn btn-ink btn-sm">{t("Simpan", "Save")}</button>
        </form>
      ) : null}

      <form action={addNote} className="card flex flex-col gap-2 p-4">
        <input type="hidden" name="memberId" value={m.id} />
        <label className="field">
          {t("Nota untuk ahli (dilihat oleh keluarga)", "Note for the member (the family sees it)")}
          <textarea name="body" rows={2} placeholder={t("Cth: kuda-kuda lebih rendah semasa elakan", "e.g. lower stance during evasions")} className="input" />
        </label>
        <button className="btn btn-ink btn-sm self-start">{t("Tambah nota", "Add note")}</button>
      </form>
      {notes.rows.map((n, i) => (
        <p key={i} className="rounded-[12px] bg-surface p-3 text-[14px]">
          <span className="text-[12px] font-bold text-muted">{dateLabel(n.at, lang)}</span>
          <br />
          {n.body}
        </p>
      ))}

      {contact ? (
        <section className="card p-4 text-[14px]">
          <span className="kicker text-muted">{m.stream === "kids" ? t("Ibu bapa", "Parent") : t("Hubungi", "Contact")}</span>
          <p className="mt-1">
            <strong>{contact.name}</strong>
            <br />
            <a href={`mailto:${contact.email}`} className="text-accent-press">{contact.email}</a>
            {contact.phone ? (
              <>
                <br />
                <a href={`tel:${contact.phone}`} className="text-accent-press">{contact.phone}</a>
              </>
            ) : null}
          </p>
        </section>
      ) : null}
    </div>
  );
}
