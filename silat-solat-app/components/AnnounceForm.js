"use client";

import { useActionState } from "react";
import { postAnnouncement } from "@/app/instructor-actions";
import { BY_SLUG, STREAMS } from "@/lib/branches";
import { makeT } from "@/lib/tr";

/** Post to a branch (and optionally one stream). Admins may also post to all. */
export default function AnnounceForm({ lang, branches, allowAll }) {
  const t = makeT(lang);
  const [state, action, pending] = useActionState(postAnnouncement, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="field">
          {t("Kepada", "To")}
          <select name="branch" className="input">
            {allowAll ? <option value="">{t("Semua cawangan", "All branches")}</option> : null}
            {branches.map((b) => (
              <option key={b} value={b}>{BY_SLUG[b].short}</option>
            ))}
          </select>
        </label>
        <label className="field">
          {t("Aliran", "Stream")}
          <select name="stream" className="input">
            <option value="">{t("Semua", "All")}</option>
            {Object.entries(STREAMS).map(([k, v]) => (
              <option key={k} value={k}>{v[lang]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        {t("Tajuk", "Title")}
        <input name="title" required className="input" />
      </label>
      <label className="field">
        {t("Mesej", "Message")}
        <textarea name="body" required rows={3} className="input" />
      </label>
      {state?.ok ? <p className="text-[14px] font-bold text-ok-fg">{t("Dihantar.", "Posted.")}</p> : null}
      {state?.error ? <p className="text-[14px] font-bold text-danger-fg">{t("Tidak dapat dihantar.", "Couldn't post that.")}</p> : null}
      <button className="btn btn-ink btn-sm self-start" disabled={pending}>{t("Hantar pengumuman", "Post announcement")}</button>
    </form>
  );
}
