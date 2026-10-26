"use client";

import { useActionState } from "react";
import { createGrading } from "@/app/instructor-actions";
import { BY_SLUG } from "@/lib/branches";
import { makeT } from "@/lib/tr";

export default function GradingForm({ lang, branches, allowAll, suggested }) {
  const t = makeT(lang);
  const [state, action, pending] = useActionState(createGrading, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <label className="field col-span-3 sm:col-span-1">
          {t("Cawangan", "Branch")}
          <select name="branch" className="input">
            {allowAll ? <option value="">{t("Semua", "All")}</option> : null}
            {branches.map((b) => (
              <option key={b} value={b}>{BY_SLUG[b].short}</option>
            ))}
          </select>
        </label>
        <label className="field col-span-2 sm:col-span-1">
          {t("Tarikh", "Date")}
          <input type="date" name="day" required defaultValue={suggested || ""} className="input" />
        </label>
        <label className="field">
          {t("Masa", "Time")}
          <input type="time" name="starts" defaultValue="09:30" className="input" />
        </label>
      </div>
      {state?.ok ? <p className="text-[14px] font-bold text-ok-fg">{t("Hari gred dibuka dan diumumkan.", "Grading day opened and announced.")}</p> : null}
      {state?.error ? <p className="text-[14px] font-bold text-danger-fg">{t("Semak tarikh dan cawangan.", "Check the date and branch.")}</p> : null}
      <button className="btn btn-ink btn-sm self-start" disabled={pending}>{t("Buka hari gred", "Open grading day")}</button>
    </form>
  );
}
