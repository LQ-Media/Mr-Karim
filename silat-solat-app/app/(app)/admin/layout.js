import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export default async function AdminLayout({ children }) {
  await requireAdmin();
  const t = await getT();
  const links = [
    ["/admin", t("Ringkasan", "Overview")],
    ["/admin/classes", t("Kelas", "Classes")],
    ["/admin/people", t("Ahli & jurulatih", "People")],
    ["/admin/content", t("Kandungan", "Content")],
    ["/admin/payments", t("Bayaran", "Payments")],
  ];
  return (
    <div className="pt-4">
      <nav aria-label={t("Admin", "Admin")} className="mb-4 flex flex-wrap gap-1.5">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border-[1.5px] border-ink px-3.5 py-1.5 text-[13px] font-extrabold text-ink">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
