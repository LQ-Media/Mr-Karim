import Link from "next/link";
import Icon from "@/components/Icon";
import { requireInstructor, instructorScope, isAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { query, getSetting } from "@/lib/db";
import { memberProgress, todaySgt } from "@/lib/data";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { sashName, TOP_LEVEL } from "@/lib/sashes";
import { FREQUENCIES, suggestNextGrading } from "@/lib/grading";
import { dateLabel, clock } from "@/lib/tr";
import { recordResult, setBranchFrequency } from "@/app/instructor-actions";
import { Empty } from "@/components/Bits";
import GradingForm from "@/components/GradingForm";

export const metadata = { title: "Hari gred" };

export default async function InstructorGrading() {
  const user = await requireInstructor("/instructor/grading");
  const t = await getT();
  const lang = t.lang;
  const scope = await instructorScope(user);
  const branches = scope === null ? Object.keys(BY_SLUG) : [...new Set(scope.map((s) => s.branch))];
  const today = todaySgt();
  const globalFreq = await getSetting("grading_frequency", "monthly");
  const branchFreq = Object.fromEntries(
    await Promise.all(branches.map(async (b) => [b, await getSetting(`grading_frequency:${b}`, "")]))
  );
  const firstFreq = branchFreq[branches[0]] || globalFreq;

  const { rows: gradings } = await query(
    `select id::text, branch, to_char(day,'YYYY-MM-DD') as day, starts from gradings
     where day >= $1::date - 14 and (branch is null or branch = any($2)) order by day`,
    [today, branches]
  );

  // Members in scope who are ready, plus anyone already given a result.
  const { rows: members } = await query(
    `select *, id::text as id, account_id::text as account_id from members where status = 'active' and branch = any($1) order by display_name`,
    [branches]
  );
  const inScope = members.filter((m) => scope === null || scope.some((s) => s.branch === m.branch && s.stream === m.stream));
  const withProgress = await Promise.all(inScope.map(async (m) => ({ m, p: await memberProgress(m) })));
  const { rows: results } = await query(
    `select grading_id::text, member_id::text, result, approved from grading_results where grading_id = any($1::bigint[])`,
    [gradings.map((g) => g.id)]
  );

  return (
    <div className="ss-rise flex flex-col gap-4">
      <div className="flex items-center gap-1 pt-4">
        <Link href="/instructor" aria-label={t("Kembali", "Back")} className="-ml-2 flex h-11 w-11 items-center justify-center text-ink">
          <Icon name="chevron-left" size={24} />
        </Link>
        <h1 className="text-[28px]">{t("Hari gred", "Grading days")}</h1>
      </div>

      <section className="card flex flex-col gap-3 p-4">
        <h2 className="text-[18px]">{t("Kekerapan gred", "How often to grade")}</h2>
        <p className="text-[13px] text-muted">
          {t("Lalai admin:", "Admin default:")} {FREQUENCIES[globalFreq]?.[lang]}. {t("Anda boleh tetapkan untuk cawangan anda.", "You can set your own branch's.")}
        </p>
        {branches.map((b) => (
          <form key={b} action={setBranchFrequency} className="flex items-center gap-2">
            <input type="hidden" name="branch" value={b} />
            <span className="w-28 text-[14px] font-bold">{BY_SLUG[b].short}</span>
            <select name="frequency" defaultValue={branchFreq[b]} aria-label={`${t("Kekerapan", "Frequency")} ${BY_SLUG[b].short}`} className="input flex-1 text-[14px]">
              <option value="">{t("Ikut lalai", "Use default")}</option>
              {Object.entries(FREQUENCIES).map(([k, v]) => (
                <option key={k} value={k}>{v[lang]}</option>
              ))}
            </select>
            <button className="btn btn-line btn-sm">{t("Simpan", "Save")}</button>
          </form>
        ))}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-[18px]">{t("Buka hari gred", "Open a grading day")}</h2>
        <GradingForm lang={lang} branches={branches} allowAll={isAdmin(user)} suggested={suggestNextGrading(firstFreq, today)} />
      </section>

      {gradings.length === 0 ? <Empty>{t("Tiada hari gred dibuka.", "No grading days open.")}</Empty> : null}
      {gradings.map((g) => {
        const here = withProgress.filter(({ m, p }) => (!g.branch || m.branch === g.branch) && (p.eligible || results.some((r) => r.grading_id === g.id && r.member_id === m.id)));
        return (
          <section key={g.id} className="flex flex-col gap-2">
            <h2 className="text-[19px]">
              {dateLabel(g.day, lang)} · {clock(g.starts, lang)} · {g.branch ? BY_SLUG[g.branch].short : t("Semua cawangan", "All branches")}
            </h2>
            {here.length === 0 ? <Empty>{t("Belum ada ahli yang layak.", "Nobody eligible yet.")}</Empty> : null}
            {here.map(({ m }) => {
              const r = results.find((x) => x.grading_id === g.id && x.member_id === m.id);
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-[14px] bg-surface p-3">
                  <span className="flex min-w-[180px] flex-1 flex-col">
                    <strong className="text-[15px]">{m.display_name}</strong>
                    <span className="text-[12px] text-muted">{STREAMS[m.stream][lang]} · {sashName(m.level, lang)} → {sashName(Math.min(TOP_LEVEL, m.level + 1), lang)}</span>
                  </span>
                  {r ? (
                    <span className="chip">{r.result === "pass" ? t("Lulus", "Pass") : r.result === "conditional" ? t("Lulus bersyarat", "Conditional") : t("Cuba lagi", "Retry")}{!r.approved ? ` · ${t("menunggu Ustaz", "awaiting Ustaz")}` : ""}</span>
                  ) : g.day > today ? (
                    <span className="text-[12px] font-bold text-muted">{t("Dibuka pada hari gred", "Opens on the day")}</span>
                  ) : (
                    ["pass", "conditional", "retry"].map((res) => (
                      <form key={res} action={recordResult}>
                        <input type="hidden" name="memberId" value={m.id} />
                        <input type="hidden" name="gradingId" value={g.id} />
                        <input type="hidden" name="result" value={res} />
                        <button className="min-h-[38px] rounded-[10px] border-[1.5px] border-ink px-2.5 text-[12px] font-extrabold" style={res === "pass" ? { background: "#17140F", color: "#F6F0E1" } : undefined}>
                          {res === "pass" ? t("Lulus", "Pass") : res === "conditional" ? t("Bersyarat", "Conditional") : t("Cuba lagi", "Retry")}
                        </button>
                      </form>
                    ))
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
