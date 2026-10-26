"use client";

import { useActionState, useState } from "react";
import { saveMember } from "@/app/member-actions";
import { BRANCHES, STREAMS } from "@/lib/branches";
import { makeT } from "@/lib/tr";

/** Add or edit one training profile (self, child, spouse). */
export default function MemberForm({ lang, member, accountName }) {
  const t = makeT(lang);
  const [state, action, pending] = useActionState(saveMember, null);
  const [stream, setStream] = useState(member?.stream || "adults");
  const [gender, setGender] = useState(member?.gender || "male");
  const errors = {
    missing: t("Sila isi nama, cawangan dan kelas.", "Please fill in name, branch and class."),
    year: t("Tahun lahir tidak sah.", "That birth year doesn't look right."),
    sisters: t("Kelas Muslimah untuk wanita dan kanak-kanak perempuan sahaja.", "Sisters' classes are for women and girls only."),
    kids: t("Kelas kanak-kanak untuk umur 7 hingga 12.", "The kids' class is for ages 7 to 12."),
    many: t("Maksimum 10 profil bagi setiap akaun.", "Up to 10 profiles per account."),
  };
  return (
    <form action={action} className="flex flex-col gap-4">
      {member ? <input type="hidden" name="id" value={member.id} /> : null}
      <label className="field">
        {t("Nama penuh", "Full name")}
        <input name="fullName" required defaultValue={member?.full_name || accountName || ""} className="input" autoComplete="off" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">
          {t("Nama panggilan", "Called")}
          <input name="displayName" defaultValue={member?.display_name || ""} className="input" />
        </label>
        <label className="field">
          {t("Tahun lahir", "Birth year")}
          <input name="birthYear" type="number" inputMode="numeric" min="1930" max="2026" defaultValue={member?.birth_year || ""} className="input" />
        </label>
      </div>
      <fieldset className="flex gap-2">
        <legend className="mb-2 text-[14px] font-bold">{t("Jantina", "Gender")}</legend>
        {[
          ["male", t("Lelaki", "Male")],
          ["female", t("Perempuan", "Female")],
        ].map(([v, label]) => (
          <label key={v} className="flex flex-1 items-center gap-2 rounded-[12px] bg-surface p-3 text-[15px]">
            <input type="radio" name="gender" value={v} checked={gender === v} onChange={() => { setGender(v); if (v === "male" && stream === "sisters") setStream("adults"); }} className="h-5 w-5 accent-[#17140F]" />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[14px] font-bold">{t("Kelas", "Class")}</legend>
        {Object.entries(STREAMS)
          .filter(([k]) => k !== "sisters" || gender === "female")
          .map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 rounded-[12px] bg-surface p-3 text-[15px]">
              <input type="radio" name="stream" value={k} checked={stream === k} onChange={() => setStream(k)} className="h-5 w-5 accent-[#17140F]" />
              {label[lang]}
            </label>
          ))}
      </fieldset>
      <label className="field">
        {t("Cawangan", "Branch")}
        <select name="branch" defaultValue={member?.branch || "an-nur"} className="input">
          {BRANCHES.map((b) => (
            <option key={b.slug} value={b.slug}>{b.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        {t("Nota perubatan untuk jurulatih (pilihan)", "Medical notes for instructors (optional)")}
        <input name="medical" defaultValue={member?.medical_notes || ""} placeholder={t("Cth: asma, kecederaan lutut", "e.g. asthma, knee injury")} className="input" />
      </label>
      <label className="flex items-start gap-2.5 text-[14px] leading-snug">
        <input type="checkbox" name="consent" defaultChecked={member ? member.media_consent : false} className="mt-0.5 h-5 w-5 shrink-0 accent-[#17140F]" />
        {stream === "kids"
          ? t("Saya benarkan foto dan video latihan anak saya dikongsi di perpustakaan awam (nama penuh tidak akan dipaparkan).", "I allow photos and training videos of my child in the public library (full names are never shown).")
          : t("Saya benarkan foto dan video latihan dikongsi di perpustakaan awam.", "I allow training photos and videos to be shared in the public library.")}
      </label>
      {stream === "sisters" ? (
        <p className="rounded-[12px] bg-accent-soft p-3 text-[13px] leading-relaxed">
          {t("Rakaman kelas Muslimah tidak disiarkan tanpa kebenaran setiap peserta dan jurulatih wanita.", "Sisters' class footage is never published without each sister's and the female instructor's approval.")}
        </p>
      ) : null}
      {state?.error ? <p role="alert" className="text-[14px] font-bold text-danger-fg">{errors[state.error]}</p> : null}
      <button className="btn btn-ink" disabled={pending}>{member ? t("Simpan", "Save") : t("Daftar", "Register")}</button>
    </form>
  );
}
