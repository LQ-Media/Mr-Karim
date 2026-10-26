"use client";

import { useActionState } from "react";
import { saveAccount } from "@/app/member-actions";
import { makeT } from "@/lib/tr";

export default function AccountForm({ lang, user }) {
  const t = makeT(lang);
  const [state, action, pending] = useActionState(saveAccount, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="field">
        {t("Panggil saya", "Call me")}
        <input name="callMe" defaultValue={user.call_me || ""} placeholder={user.name} className="input" />
      </label>
      <label className="field">
        {t("No. telefon (untuk jurulatih)", "Phone (for instructors)")}
        <input name="phone" type="tel" defaultValue={user.phone || ""} className="input" autoComplete="tel" />
      </label>
      <button className="btn btn-ink btn-sm self-start" disabled={pending}>{state?.saved ? t("Disimpan ✓", "Saved ✓") : t("Simpan", "Save")}</button>
    </form>
  );
}
