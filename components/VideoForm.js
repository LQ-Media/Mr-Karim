"use client";

import { useActionState } from "react";
import { saveVideo } from "@/app/admin-actions";
import { SASHES } from "@/lib/sashes";
import { TOPICS } from "@/lib/library";
import { makeT } from "@/lib/tr";

export default function VideoForm({ lang }) {
  const t = makeT(lang);
  const [state, action, pending] = useActionState(saveVideo, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="field">
        {t("Pautan YouTube", "YouTube link")}
        <input name="youtube" required placeholder="https://youtu.be/…" className="input" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">{t("Tajuk (BM)", "Title (Malay)")}<input name="titleMs" required className="input" /></label>
        <label className="field">{t("Tajuk (EN)", "Title (English)")}<input name="titleEn" className="input" /></label>
        <label className="field">
          {t("Tahap", "Level")}
          <select name="level" className="input" defaultValue="">
            <option value="">{t("Untuk semua", "For everyone")}</option>
            {SASHES.map((s) => <option key={s.level} value={s.level}>{lang === "en" ? s.en : s.ms}</option>)}
          </select>
        </label>
        <label className="field">
          {t("Topik", "Topic")}
          <select name="topic" className="input">
            {Object.entries(TOPICS).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
          </select>
        </label>
        <label className="field">{t("Langkah (BM, satu setiap baris)", "Steps (Malay, one per line)")}<textarea name="stepsMs" rows={3} className="input" /></label>
        <label className="field">{t("Langkah (EN)", "Steps (English)")}<textarea name="stepsEn" rows={3} className="input" /></label>
        <label className="field">{t("Nota adab (BM)", "Adab note (Malay)")}<textarea name="adabMs" rows={2} className="input" /></label>
        <label className="field">{t("Nota adab (EN)", "Adab note (English)")}<textarea name="adabEn" rows={2} className="input" /></label>
      </div>
      <p className="text-[12px] text-muted">{t("Pastikan setiap orang dalam video telah memberi kebenaran media. Video Muslimah memerlukan kelulusan jurulatih wanita.", "Check everyone in the video gave media consent. Sisters' videos need the female instructor's approval.")}</p>
      {state?.ok ? <p className="text-[14px] font-bold text-ok-fg">{t("Ditambah.", "Added.")}</p> : null}
      {state?.error ? <p className="text-[14px] font-bold text-danger-fg">{t("Semak pautan dan tajuk.", "Check the link and title.")}</p> : null}
      <button className="btn btn-ink btn-sm self-start" disabled={pending}>{t("Tambah video", "Add video")}</button>
    </form>
  );
}
