import { BY_SLUG } from "@/lib/branches";
import { sash, sashName } from "@/lib/sashes";

/** A branch's colour dot. White gets an ink ring so it shows on cream. */
export function BranchDot({ slug, size = 12 }) {
  const b = BY_SLUG[slug];
  if (!b) return null;
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: b.color, border: b.ring ? "2px solid #17140F" : "1px solid rgba(23,20,15,.15)" }}
    />
  );
}

/** "Bengkung Putih" with its colour swatch. */
export function SashChip({ level, stripes = 0, lang = "ms" }) {
  const s = sash(level);
  const label = sashName(level, lang);
  return (
    <span className="chip" style={{ background: "#fff", border: "1px solid #C9BEA4" }}>
      <span aria-hidden="true" className="inline-block h-[10px] w-[10px] rounded-full" style={{ background: s.color, border: "1px solid #8F8572" }} />
      {label}
      {stripes ? <span className="text-muted">· {stripes}</span> : null}
    </span>
  );
}

export function PageTitle({ kicker, title, children }) {
  return (
    <header className="mb-5 mt-6 flex flex-col gap-2">
      {kicker ? <p className="kicker text-accent-press">{kicker}</p> : null}
      <h1 className="text-[30px] leading-[1.08] lg:text-[36px]">{title}</h1>
      {children ? <div className="text-[15px] leading-relaxed text-muted">{children}</div> : null}
    </header>
  );
}

export function Notice({ tone = "info", children }) {
  const tones = {
    info: "bg-accent-soft text-ink",
    ok: "bg-ok-bg text-ok-fg",
    warn: "bg-warn-bg text-warn-fg",
    danger: "bg-danger-bg text-danger-fg",
  };
  return <div className={`rounded-[12px] px-4 py-3 text-[14px] leading-relaxed ${tones[tone]}`}>{children}</div>;
}

export function Empty({ children }) {
  return <p className="rounded-[14px] border border-dashed border-muted-3 px-4 py-6 text-center text-[14px] text-muted">{children}</p>;
}
