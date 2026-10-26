import Link from "next/link";
import { getT } from "@/lib/i18n";
import { query, getSetting } from "@/lib/db";
import { BY_SLUG, BRANCHES, STREAMS } from "@/lib/branches";
import { FREQUENCIES } from "@/lib/grading";
import { sashName } from "@/lib/sashes";
import { dateLabel, clock } from "@/lib/tr";
import { setGradingFrequency, approveResult } from "@/app/admin-actions";
import { BranchDot, Empty } from "@/components/Bits";
import { stripeConfigured } from "@/lib/stripe";
import { paynowAccount } from "@/lib/paynow";
import { googleConfigured } from "@/lib/oauth";

export const metadata = { title: "Admin" };

export default async function Admin() {
  const t = await getT();
  const lang = t.lang;
  const [counts, perBranch, trials, approvals, volunteers, freq] = await Promise.all([
    query(`select
      (select count(*) from members where status='active')::int as members,
      (select count(*) from payments where method='paynow' and status='pending' and details ? 'claimed')::int as paynow,
      (select count(*) from questions where not published and answer_ms is null)::int as questions,
      (select count(*) from trial_bookings where day >= current_date)::int as trials`),
    query("select branch, stream, count(*)::int as n from members where status='active' group by branch, stream"),
    query(
      `select t.name, t.contact, t.people, to_char(t.day,'YYYY-MM-DD') as day, c.branch, c.stream, c.starts
       from trial_bookings t left join classes c on c.id = t.class_id where t.day >= current_date - 1 order by t.day limit 20`
    ),
    query(
      `select r.id::text, m.full_name, r.to_level, to_char(g.day,'YYYY-MM-DD') as day from grading_results r
       join members m on m.id = r.member_id join gradings g on g.id = r.grading_id where not r.approved order by g.day`
    ),
    query("select v.name, v.contact, c.title_ms from volunteers v join campaigns c on c.id = v.campaign_id order by v.id desc limit 10"),
    getSetting("grading_frequency", "monthly"),
  ]);
  const c = counts.rows[0];
  const n = (b, s) => perBranch.rows.find((r) => r.branch === b && r.stream === s)?.n || 0;
  const setup = [
    [googleConfigured(), t("Log masuk Google", "Google sign-in")],
    [stripeConfigured(), t("Bayaran kad (Stripe)", "Card payments (Stripe)")],
    [Boolean(paynowAccount()), "PayNow"],
    [Boolean(process.env.APP_ORIGIN), "APP_ORIGIN"],
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[30px]">{t("Ringkasan", "Overview")}</h1>
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          [t("Ahli aktif", "Active members"), c.members, "/admin/people"],
          [t("PayNow untuk disahkan", "PayNow to confirm"), c.paynow, "/admin/payments"],
          [t("Soalan baharu", "New questions"), c.questions, "/admin/content#questions"],
          [t("Kelas percubaan", "Trial bookings"), c.trials, "#trials"],
        ].map(([label, value, href]) => (
          <Link key={label} href={href} className="flex flex-col rounded-[14px] bg-surface p-4 text-ink">
            <span className="text-[13px] font-extrabold text-muted">{label}</span>
            <strong className="font-heading text-[30px]">{value}</strong>
          </Link>
        ))}
      </section>

      <section className="flex flex-wrap gap-2">
        {setup.map(([ok, label]) => (
          <span key={label} className="chip" style={ok ? { background: "#E9F2E4", color: "#3D6A2C" } : { background: "#FBEFD6", color: "#8A5A12" }}>
            {ok ? "✓" : "○"} {label}
          </span>
        ))}
      </section>

      <section className="flex flex-col gap-2 rounded-[14px] bg-ink p-4 text-page">
        <h2 className="text-[18px]" style={{ color: "#E9C766" }}>{t("Kekerapan gred (lalai)", "Grading frequency (default)")}</h2>
        <form action={setGradingFrequency} className="flex gap-2">
          <select name="frequency" defaultValue={freq} aria-label={t("Kekerapan", "Frequency")} className="input flex-1">
            {Object.entries(FREQUENCIES).map(([k, v]) => (
              <option key={k} value={k}>{v[lang]}</option>
            ))}
          </select>
          <button className="btn btn-gold btn-sm">{t("Simpan", "Save")}</button>
        </form>
        <p className="text-[12px] text-[#DCD3BF]">{t("Jurulatih boleh tetapkan sendiri untuk cawangan mereka.", "Instructors can set their own branch's.")}</p>
      </section>

      {approvals.rows.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[20px]">{t("Bengkung Hitam menunggu kelulusan", "Black sashes awaiting approval")}</h2>
          {approvals.rows.map((a) => (
            <form key={a.id} action={approveResult} className="flex items-center gap-2 rounded-[14px] bg-surface p-3">
              <input type="hidden" name="resultId" value={a.id} />
              <span className="flex-1 text-[15px]"><strong>{a.full_name}</strong> · {sashName(a.to_level, lang)} · {dateLabel(a.day, lang)}</span>
              <button className="btn btn-ink btn-sm">{t("Luluskan", "Approve")}</button>
            </form>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-[20px]">{t("Ahli mengikut cawangan", "Members by branch")}</h2>
        <div className="overflow-x-auto rounded-[14px] bg-surface">
          <table className="w-full min-w-[480px] text-[14px]">
            <thead>
              <tr className="text-left text-[12px] uppercase text-muted">
                <th className="px-4 py-2.5">{t("Masjid", "Mosque")}</th>
                {Object.values(STREAMS).map((s) => <th key={s.en} className="px-4 py-2.5">{s[lang]}</th>)}
              </tr>
            </thead>
            <tbody>
              {BRANCHES.map((b) => (
                <tr key={b.slug} className="border-t border-hairline-2">
                  <td className="px-4 py-2.5 font-extrabold"><span className="mr-2 inline-flex align-middle"><BranchDot slug={b.slug} size={10} /></span>{b.short}</td>
                  {Object.keys(STREAMS).map((s) => <td key={s} className="px-4 py-2.5">{n(b.slug, s)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="trials" className="flex flex-col gap-2">
        <h2 className="text-[20px]">{t("Kelas percubaan", "Trial bookings")}</h2>
        {trials.rows.length === 0 ? <Empty>{t("Tiada tempahan.", "No bookings.")}</Empty> : null}
        {trials.rows.map((x, i) => (
          <div key={i} className="rounded-[14px] bg-surface p-3 text-[14px]">
            <strong>{x.name}</strong> ({x.people}) · {x.contact}
            <br />
            <span className="text-muted">{dateLabel(x.day, lang)} · {x.branch ? BY_SLUG[x.branch]?.short : ""} · {x.stream ? STREAMS[x.stream]?.[lang] : ""} · {x.starts ? clock(x.starts, lang) : ""}</span>
          </div>
        ))}
      </section>

      {volunteers.rows.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[20px]">{t("Sukarelawan", "Volunteers")}</h2>
          {volunteers.rows.map((v, i) => (
            <p key={i} className="rounded-[14px] bg-surface p-3 text-[14px]"><strong>{v.name}</strong> · {v.contact} · {v.title_ms}</p>
          ))}
        </section>
      ) : null}
    </div>
  );
}
