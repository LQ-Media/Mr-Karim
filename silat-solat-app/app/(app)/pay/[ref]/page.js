import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n";
import { query } from "@/lib/db";
import { sgd } from "@/lib/money";
import { paynowAccount, paynowPayload } from "@/lib/paynow";
import { qrSvg } from "@/lib/qr";
import { claimPaid } from "@/app/pay-actions";
import { Notice } from "@/components/Bits";

export const metadata = { title: "Bayaran" };

export default async function Pay({ params, searchParams }) {
  const { ref } = await params;
  const sp = await searchParams;
  const t = await getT();
  const { rows } = await query("select * from payments where ref = $1", [ref]);
  const p = rows[0];
  if (!p) notFound();
  const account = paynowAccount();
  const paid = p.status === "paid";

  let qr = null;
  if (p.method === "paynow" && !paid && account) {
    qr = await qrSvg(paynowPayload({ ...account, merchantName: account.name, amountCents: p.amount_cents, reference: p.ref }), { dark: "#7C1A6C" });
  }

  return (
    <div className="ss-rise flex flex-col items-center gap-4 pt-6 text-center">
      <p className="kicker text-accent-press">{t("Rujukan", "Reference")} {p.ref}</p>
      <h1 className="text-[34px]">{sgd(p.amount_cents)}{p.monthly ? t(" sebulan", " a month") : ""}</h1>
      {paid || sp?.done ? (
        <Notice tone="ok">
          {paid
            ? t("Diterima. Jazakallahu khairan!", "Received. Jazakallahu khairan!")
            : t("Terima kasih! Bayaran kad anda sedang disahkan.", "Thank you! Your card payment is being confirmed.")}
        </Notice>
      ) : null}
      {sp?.cancelled ? <Notice tone="warn">{t("Bayaran dibatalkan. Anda boleh cuba lagi.", "Payment cancelled. You can try again.")}</Notice> : null}
      {qr ? (
        <>
          <div className="w-[260px] rounded-[16px] bg-white p-3" style={{ border: "3px solid #7C1A6C" }}>
            <div aria-label={t("Kod QR PayNow", "PayNow QR code")} role="img" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-1 text-[13px] font-extrabold" style={{ color: "#7C1A6C" }}>PayNow · {account.name}</p>
          </div>
          <p className="max-w-[340px] text-[14px] leading-relaxed text-muted">
            {t(
              `Imbas dengan aplikasi bank anda. Jumlah dan rujukan ${p.ref} sudah diisi. Pastikan nama penerima ialah ${account.name}.`,
              `Scan with your banking app. The amount and reference ${p.ref} are filled in. Check the payee name is ${account.name}.`
            )}
          </p>
          {sp?.claimed || p.details?.claimed ? (
            <Notice>{t("Terima kasih. Admin akan sahkan bayaran anda.", "Thank you. An admin will confirm your payment.")}</Notice>
          ) : (
            <form action={claimPaid}>
              <input type="hidden" name="ref" value={p.ref} />
              <button className="btn btn-ink">{t("Saya sudah bayar", "I've paid")}</button>
            </form>
          )}
          {p.monthly ? (
            <p className="max-w-[340px] text-[13px] text-muted">
              {t("PayNow tidak boleh ditolak secara automatik setiap bulan. Kami akan ingatkan anda dengan kod QR baharu.", "PayNow can't be taken automatically each month. We'll remind you with a fresh QR code.")}
            </p>
          ) : null}
        </>
      ) : null}
      <Link href="/" className="text-[14px] font-bold text-accent-press">{t("Kembali ke utama", "Back to home")}</Link>
    </div>
  );
}
