import { getUser, isAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const cell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Keep spreadsheet formulas out of the export.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Every payment as CSV, for the treasurer. Admins only. */
export async function GET() {
  const user = await getUser();
  if (!isAdmin(user)) return new Response("Not allowed", { status: 403 });
  const { rows } = await query(
    `select p.ref, p.created_at, p.paid_at, p.status, p.purpose, c.title_ms as campaign, p.method, p.monthly,
       p.amount_cents, p.payer_name, p.payer_contact from payments p left join campaigns c on c.id = p.campaign_id order by p.created_at`
  );
  const head = ["ref", "created", "paid", "status", "purpose", "campaign", "method", "monthly", "amount_sgd", "name", "contact"];
  const lines = rows.map((r) =>
    [r.ref, r.created_at?.toISOString(), r.paid_at?.toISOString() || "", r.status, r.purpose, r.campaign, r.method, r.monthly, (r.amount_cents / 100).toFixed(2), r.payer_name, r.payer_contact]
      .map(cell)
      .join(",")
  );
  return new Response([head.join(","), ...lines].join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="silat-solat-payments.csv"' },
  });
}
