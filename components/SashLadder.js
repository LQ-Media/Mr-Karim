import { SASHES } from "@/lib/sashes";

/** The six sashes in a row: passed ones ticked, the one being worked on ringed. */
export default function SashLadder({ level, lang }) {
  return (
    <ol aria-label={lang === "en" ? "Sash ladder" : "Tangga bengkung"} className="grid grid-cols-6 gap-1 text-center text-[11px] font-bold">
      {SASHES.map((s) => {
        const passed = s.level <= level;
        const next = s.level === level + 1;
        return (
          <li key={s.level} className="flex flex-col items-center gap-1.5" style={{ color: passed || next ? "#F6F0E1" : "#B8AE98" }}>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{
                background: passed ? s.color : "transparent",
                border: `2px solid ${s.color === "#17140F" ? "#8F8572" : s.color}`,
                outline: next ? "3px solid #D9A521" : 0,
                outlineOffset: 3,
              }}
            >
              {passed ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.level === 5 ? "#D9A521" : "#17140F"} strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              ) : null}
            </span>
            {lang === "en" ? s.en : s.ms}
          </li>
        );
      })}
    </ol>
  );
}
