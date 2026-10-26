import { getT } from "@/lib/i18n";
import { query } from "@/lib/db";
import { sgd } from "@/lib/money";
import { dateLabel } from "@/lib/tr";
import { setPaymentStatus } from "@/app/admin-actions";
import { Empty } from "@/components/Bits";
import Link from "next/link";

export const metadata = { title: "Admin · Bayaran" };

export default async function Payments({ searchParams }) {
  const t = await getT();
  const lang = t.lang;
  const sp = await searchParams;
  const filter = ["pending", "paid", "cancelled"].includes(sp?.status) ? sp.status : "pending";
  const [rows, totals] = await Promise.all([
    query(
      `select p.*, p.id::text as id, c.title_ms as campaign from payments p left join campaigns c on c.id = p.campaign_id
       where p.status = $1 order by (p.details ? 'claimed') desc, p.created_at desc limit 200`,
      [filter]
    ),
    query(
      `select purpose, coalesce(sum(amount_cents),0)::int as total from payments
       where status = 'paid' and paid_at >= date_trunc('month', now()) group by purpose`
    ),
  ]);
  const purposes = { support: t("Sokongan", "Support"), book: t("Buku", "Book"), campaign: t("Kempen", "Campaign") };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[30px]">{t("Bayaran", "Payments")}</h1>
      <section className="grid grid-cols-3 gap-2.5">
        {Object.entries(purposes).map(([k, label]) => (
          <div key={k} className="flex flex-col rounded-[14px] bg-surface p-3">
            <span className="text-[12px] font-extrabold text-muted">{label} · {t("bulan ini", "this month")}</span>
            <strong className="font-heading text-[22px]">{sgd(totals.rows.find((r) => r.purpose === k)?.total || 0)}</strong>
          </div>
        ))}
      </section>
      <div className="flex flex-wrap items-center gap-2">
        {["pending", "paid", "cancelled"].map((s) => (
          <Link key={s} href={`/admin/payments?status=${s}`} className="rounded-full px-3.5 py-1.5 text-[13px] font-extrabold" style={s === filter ? { background: "#17140F", color: "#F6F0E1" } : { border: "1.5px solid #17140F" }}>
            {s === "pending" ? t("Menunggu", "Pending") : s === "paid" ? t("Diterima", "Paid") : t("Dibatalkan", "Cancelled")}
          </Link>
        ))}
        <a href="/api/admin/payments" className="ml-auto text-[13px] font-bold text-accent-press">{t("Muat turun CSV", "Download CSV")}</a>
      </div>
      {rows.rows.length === 0 ? <Empty>{t("Tiada bayaran.", "No payments.")}</Empty> : null}
      {rows.rows.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-[14px] bg-surface p-3 text-[14px]">
          <span className="flex flex-1 flex-col">
            <strong>
              {sgd(p.amount_cents)}{p.monthly ? t("/bln", "/mo") : ""} · {purposes[p.purpose]}{p.campaign ? ` · ${p.campaign}` : ""}
            </strong>
            <span className="text-[12px] text-muted">
              {p.ref} · {p.method === "card" ? t("kad", "card") : "PayNow"} · {p.payer_name || "—"} {p.payer_contact || ""} · {dateLabel(p.created_at, lang, { weekday: false })}
              {p.details?.delivery ? ` · ${p.details.delivery === "post" ? `${t("pos", "post")}: ${p.details.address}` : `${t("ambil", "collect")}: ${p.details.branch}`} ×${p.details.qty}` : ""}
            </span>
          </span>
          {p.details?.claimed && p.status === "pending" ? <span className="chip" style={{ background: "#FBEFD6", color: "#8A5A12" }}>{t("Penderma kata sudah bayar", "Payer says paid")}</span> : null}
          {p.status !== "paid" ? (
            <form action={setPaymentStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="paid" /><button className="btn btn-ink btn-sm">{t("Tanda diterima", "Mark paid")}</button></form>
          ) : null}
          {p.status === "pending" ? (
            <form action={setPaymentStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="cancelled" /><button className="btn btn-line btn-sm">{t("Batal", "Cancel")}</button></form>
          ) : null}
        </div>
      ))}
      <p className="text-[12px] text-muted">{t("Padankan rujukan (SS-…) dengan penyata bank Silat n Solat sebelum menanda diterima.", "Match the reference (SS-…) against the Silat n Solat bank statement before marking paid.")}</p>
    </div>
  );
}
