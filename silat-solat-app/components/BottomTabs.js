"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import { NAV } from "./nav";

/** Phone navigation, always in thumb reach. Hidden on a computer (top bar). */
export default function BottomTabs({ lang }) {
  const pathname = usePathname();
  // "Tanya" also lives under Belajar; only one tab lights at a time.
  const active = NAV.findLast((n) => n.match(pathname));
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}
    >
      <ul className="mx-auto grid max-w-[560px] grid-cols-5">
        {NAV.map((n) => {
          const on = active === n;
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={on ? "page" : undefined}
                className="flex min-h-[56px] flex-col items-center justify-center gap-[3px] pt-2 text-[11px]"
                style={{ color: on ? "var(--ink)" : "var(--muted-2)", fontWeight: on ? 800 : 700 }}
              >
                <Icon name={n.icon} size={22} />
                {lang === "en" ? n.en : n.ms}
                <span aria-hidden="true" className="h-[3px] w-[18px] rounded-full" style={{ background: on ? "var(--gold)" : "transparent" }} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
