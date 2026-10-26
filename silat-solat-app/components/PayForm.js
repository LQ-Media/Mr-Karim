"use client";

import { useActionState, useState } from "react";
import { startPayment } from "@/app/pay-actions";
import { makeT } from "@/lib/tr";

/** The pay buttons and error line shared by support, book and campaign forms. */
export default function PayForm({ lang, purpose, children, card, paynow, payLabel, hidden = {} }) {
  const t = makeT(lang);
  const [state, action, pending] = useActionState(startPayment, null);
  const errors = {
    "card-off": t("Bayaran kad belum dibuka.", "Card payments aren't switched on yet."),
    "paynow-off": t("PayNow belum dibuka.", "PayNow isn't switched on yet."),
    "card-failed": t("Stripe tidak dapat dibuka. Cuba PayNow.", "Couldn't open Stripe. Try PayNow."),
    amount: t("Pilih jumlah.", "Choose an amount."),
    address: t("Isi alamat pos.", "Fill in the postal address."),
    contact: t("Isi nama dan cara menghubungi anda.", "Fill in your name and contact."),
    offline: t("Bayaran belum tersedia.", "Payments aren't available yet."),
  };
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="purpose" value={purpose} />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      {state?.error ? <p className="text-[14px] font-bold text-danger-fg" role="alert">{errors[state.error] || errors.offline}</p> : null}
      <div className="flex flex-col gap-2">
        {paynow ? (
          <button name="method" value="paynow" className="btn btn-gold" disabled={pending}>
            {payLabel ? `${payLabel} · PayNow` : t("Bayar dengan PayNow", "Pay with PayNow")}
          </button>
        ) : null}
        {card ? (
          <button name="method" value="card" className="btn btn-line" disabled={pending}>
            {t("Bayar dengan kad", "Pay by card")}
          </button>
        ) : null}
        {!card && !paynow ? (
          <p className="rounded-[12px] bg-warn-bg p-3 text-[14px] text-warn-fg">
            {t("Bayaran dalam talian akan dibuka tidak lama lagi. Hubungi jurulatih di kelas.", "Online payment opens soon. Speak to an instructor at class.")}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function AmountPicker({ lang, amounts, name = "amount", initial }) {
  const [v, setV] = useState(initial ?? amounts[1]);
  return (
    <div role="radiogroup" aria-label={lang === "en" ? "Amount" : "Jumlah"} className="grid grid-cols-5 gap-2">
      {amounts.map((a) => (
        <label key={a} className="flex min-h-[46px] cursor-pointer items-center justify-center rounded-[10px] border-2 border-ink text-[15px] font-extrabold" style={a === v ? { background: "#17140F", color: "#F6F0E1" } : { background: "var(--surface)" }}>
          <input type="radio" name={name} value={a} checked={a === v} onChange={() => setV(a)} className="sr-only" />${a}
        </label>
      ))}
    </div>
  );
}
