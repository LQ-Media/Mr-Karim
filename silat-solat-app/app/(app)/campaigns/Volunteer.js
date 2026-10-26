"use client";

import { useActionState, useState } from "react";
import { volunteer } from "./actions";
import { makeT } from "@/lib/tr";

export default function Volunteer({ lang, slug }) {
  const t = makeT(lang);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(volunteer, null);
  if (state?.ok) return <p className="text-[14px] font-bold text-ok-fg">{t("Terima kasih! Kami akan hubungi anda.", "Thank you! We'll be in touch.")}</p>;
  if (!open) {
    return (
      <button type="button" className="btn btn-line btn-sm" onClick={() => setOpen(true)}>
        {t("Jadi sukarelawan", "Volunteer")}
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="campaign" value={slug} />
      <input name="name" required placeholder={t("Nama", "Name")} aria-label={t("Nama", "Name")} className="input" />
      <input name="contact" required placeholder={t("Telefon atau e-mel", "Phone or email")} aria-label={t("Telefon atau e-mel", "Phone or email")} className="input" />
      <button className="btn btn-ink btn-sm" disabled={pending}>{t("Daftar", "Sign me up")}</button>
    </form>
  );
}
