import Link from "next/link";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { DAYS, DAYS_SHORT, clock } from "@/lib/tr";
import { BranchDot } from "./Bits";

/** One class in a list: day, branch colour, times, and the prayer inside it. */
export default function ClassCard({ c, lang, prayer, href, badge }) {
  const b = BY_SLUG[c.branch];
  const t = (ms, en) => (lang === "en" ? en : ms);
  return (
    <Link
      href={href || `/branches/${c.branch}`}
      className="flex items-center gap-3 rounded-[14px] bg-surface p-3.5 text-ink"
      style={badge ? { outline: "2px solid var(--gold)" } : undefined}
    >
      <span className="flex w-[52px] shrink-0 flex-col items-center">
        <strong className="font-heading text-[18px]">{DAYS_SHORT[lang][c.weekday]}</strong>
        <span className="text-[12px] text-muted">{clock(c.starts, lang).replace(/:00/, "")}</span>
      </span>
      <BranchDot slug={c.branch} />
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="text-[15px]">{b.short}</strong>
        <span className="text-[13px] text-muted">
          {STREAMS[c.stream][lang]} · {DAYS[lang][c.weekday]} {clock(c.starts, lang)}–{clock(c.ends, lang)}
        </span>
        {!c.confirmed ? (
          <span className="text-[12px] font-bold text-warn-fg">{t("Masa belum disahkan", "Time to be confirmed")}</span>
        ) : null}
      </span>
      {badge ? (
        <span className="chip shrink-0" style={{ background: "#17140F", color: "#F6F0E1" }}>
          {badge}
        </span>
      ) : prayer ? (
        <span className="chip shrink-0 whitespace-nowrap">
          {prayer.after ? t("Lepas itu", "Then") : ""} {prayer.name} {clock(prayer.at, lang)}
        </span>
      ) : null}
    </Link>
  );
}
