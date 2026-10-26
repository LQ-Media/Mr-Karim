"use client";

import { useActionState } from "react";
import { askQuestion } from "./actions";
import { makeT } from "@/lib/tr";

export default function AskForm({ lang }) {
  const t = makeT(lang);
  const [state, action, pending] = useActionState(askQuestion, null);
  if (state?.ok) {
    return <p className="rounded-[14px] bg-ok-bg p-4 text-[15px] text-ok-fg">{t("Terima kasih. Soalan anda telah dihantar kepada Ustaz.", "Thank you. Your question has gone to the Ustaz.")}</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[16px] border-2 border-dashed border-muted-3 p-4">
      <h2 className="text-[19px]">{t("Hantar soalan anda", "Send your question")}</h2>
      <label className="field">
        {t("Soalan", "Question")}
        <textarea name="question" required rows={3} className="input" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          {t("Nama (pilihan)", "Name (optional)")}
          <input name="name" className="input" autoComplete="name" />
        </label>
        <label className="field">
          {t("E-mel untuk jawapan (pilihan)", "Email for a reply (optional)")}
          <input name="email" type="email" className="input" autoComplete="email" />
        </label>
      </div>
      {state?.error ? <p className="text-[14px] font-bold text-danger-fg">{t("Sila tulis soalan anda.", "Please write your question.")}</p> : null}
      <button className="btn btn-ink" disabled={pending}>{t("Hantar", "Send")}</button>
    </form>
  );
}
