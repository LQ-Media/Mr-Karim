import PayForm, { AmountPicker } from "@/components/PayForm";
import { getT } from "@/lib/i18n";
import { getUser } from "@/lib/auth";
import { SUPPORT_AMOUNTS } from "@/lib/money";
import { stripeConfigured } from "@/lib/stripe";
import { paynowAccount } from "@/lib/paynow";

export const metadata = { title: "Sokong kami" };

export default async function Support() {
  const t = await getT();
  const user = await getUser();
  const card = stripeConfigured();
  return (
    <div className="ss-rise flex flex-col gap-5 pt-5">
      <section className="flex flex-col gap-2 rounded-[20px] bg-ink p-6 text-page">
        <p className="kicker" style={{ color: "#D9A521" }}>Sahabat Padi</p>
        <h1 className="text-[30px] leading-[1.08]" style={{ color: "#F6F0E1" }}>{t("Sokong Silat & Solat", "Support Silat & Solat")}</h1>
        <p className="text-[14px] leading-relaxed text-[#DCD3BF]">
          {t(
            "Kelas kekal percuma. Sokongan anda membantu tikar, tekpi, pakaian untuk keluarga yang memerlukan, dan sumbangan kepada masjid.",
            "Classes stay free. Your support helps with mats, tekpi, uniforms for families who need them, and contributions to the mosques."
          )}
        </p>
      </section>
      <PayForm lang={t.lang} purpose="support" card={card} paynow={Boolean(paynowAccount())}>
        <fieldset className="grid grid-cols-2 gap-1 rounded-[12px] bg-surface-3 p-1">
          <legend className="sr-only">{t("Kekerapan", "How often")}</legend>
          {[
            ["1", t("Bulanan", "Monthly")],
            ["0", t("Sekali", "Once")],
          ].map(([v, label]) => (
            <label key={v} className="relative">
              <input type="radio" name="monthly" value={v} defaultChecked={v === "1"} className="peer sr-only" />
              <span className="flex min-h-[42px] cursor-pointer items-center justify-center rounded-[9px] text-[14px] font-extrabold peer-checked:bg-surface peer-focus-visible:outline peer-focus-visible:outline-2">
                {label}
              </span>
            </label>
          ))}
        </fieldset>
        <AmountPicker lang={t.lang} amounts={SUPPORT_AMOUNTS} initial={20} />
        {!user ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field">
              {t("Nama (pilihan)", "Name (optional)")}
              <input name="name" className="input" autoComplete="name" />
            </label>
            <label className="field">
              {t("E-mel untuk resit (pilihan)", "Email for a receipt (optional)")}
              <input name="contact" type="email" className="input" autoComplete="email" />
            </label>
          </div>
        ) : null}
        <p className="text-[13px] leading-relaxed text-muted">
          {t(
            "Semua bayaran masuk ke akaun bank Silat n Solat. Pelan bulanan dengan kad boleh dijeda atau dibatalkan bila-bila masa di profil anda. Dengan PayNow, kami akan mengingatkan anda setiap bulan.",
            "All payments go to the Silat n Solat bank account. A monthly card plan can be paused or cancelled any time from your profile. With PayNow, we'll remind you each month."
          )}
        </p>
      </PayForm>
    </div>
  );
}
