/** The bowing rice stalk: a stand-in mark until the group's own logo file. */
export function PadiMark({ size = 30, color = "#D9A521", title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : "true"}>
      <path d="M8 28C9 18 13 10 22 4" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="22" cy="5" rx="2.4" ry="4.4" fill={color} transform="rotate(40 22 5)" />
      <ellipse cx="18" cy="8" rx="2.4" ry="4.4" fill={color} transform="rotate(-20 18 8)" />
      <ellipse cx="16" cy="13" rx="2.4" ry="4.4" fill={color} transform="rotate(50 16 13)" />
      <ellipse cx="13" cy="15" rx="2.4" ry="4.4" fill={color} transform="rotate(-25 13 15)" />
    </svg>
  );
}

export function Wordmark({ className = "" }) {
  return (
    <span className={`font-heading text-[22px] font-semibold tracking-wide ${className}`}>
      Silat <span style={{ color: "#D9A521" }}>&amp;</span> Solat
    </span>
  );
}
