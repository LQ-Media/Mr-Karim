import Link from "next/link";
import { PadiMark, Wordmark } from "./Logo";
import { NAV } from "./nav";
import { setLang } from "@/app/actions";

/** Dark top bar: the mark, the BM/EN toggle and, on a computer, the links. */
export default function TopBar({ lang, user }) {
  return (
    <header data-topbar className="sticky top-0 z-40 bg-ink text-page" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-5 py-3 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-page">
          <PadiMark size={30} />
          <Wordmark />
        </Link>
        <nav aria-label="Sidebar" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-[10px] px-3 py-2 text-[15px] font-bold text-page hover:bg-white/10">
              {lang === "en" ? n.en : n.ms}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <form action={setLang} className="flex overflow-hidden rounded-full border border-[#5E564A] text-[13px] font-extrabold">
            <button name="lang" value="ms" aria-pressed={lang === "ms"} className="min-h-[34px] px-3" style={lang === "ms" ? { background: "#D9A521", color: "#17140F" } : { color: "#F6F0E1" }}>
              BM
            </button>
            <button name="lang" value="en" aria-pressed={lang === "en"} className="min-h-[34px] px-3" style={lang === "en" ? { background: "#D9A521", color: "#17140F" } : { color: "#F6F0E1" }}>
              EN
            </button>
          </form>
          {user ? (
            <Link href="/me" aria-label={lang === "en" ? "My page" : "Laman saya"} className="hidden h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#2E5AA6] font-extrabold text-white sm:flex">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt="" width={36} height={36} referrerPolicy="no-referrer" />
              ) : (
                (user.name || "?").slice(0, 1).toUpperCase()
              )}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
