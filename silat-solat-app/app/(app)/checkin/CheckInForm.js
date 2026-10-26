"use client";

import { useActionState } from "react";
import Link from "next/link";
import { checkIn } from "@/app/member-actions";
import { makeT } from "@/lib/tr";

export default function CheckInForm({ lang, c, d, s, members }) {
  const t = makeT(lang);
  const [state, action, pending] = useActionState(checkIn, null);
  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <svg width="96" height="96" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#D9A521" /><path d="M7 12.5l3.2 3L17 9" fill="none" stroke="#17140F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <h2 className="text-[30px]" style={{ color: "#F6F0E1" }}>{t("Hadir dicatat", "Checked in")}</h2>
        <Link href="/me" className="btn btn-gold">{t("Selesai", "Done")}</Link>
      </div>
    );
  }
  const errors = {
    bad: t("Kod QR ini tidak sah.", "This QR code isn't valid."),
    old: t("Kod QR ini untuk hari lain. Minta kod hari ini daripada jurulatih.", "This QR code is for another day. Ask the instructor for today's."),
    none: t("Pilih sekurang-kurangnya seorang.", "Choose at least one person."),
    signin: t("Sila log masuk.", "Please sign in."),
  };
  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <input type="hidden" name="c" value={c} />
      <input type="hidden" name="d" value={d} />
      <input type="hidden" name="s" value={s} />
      <p className="text-[15px] font-bold">{t("Siapa yang hadir?", "Who's here?")}</p>
      {members.map((m) => (
        <label key={m.id} className="flex min-h-[52px] items-center gap-3 rounded-[12px] bg-[#2A251E] px-4 text-[16px]">
          <input type="checkbox" name="member" value={m.id} defaultChecked={m.match} className="h-5 w-5 accent-[#D9A521]" />
          <span className="flex-1">{m.display_name}</span>
          {!m.match ? <span className="text-[12px] text-[#B8AE98]">{t("kelas lain", "other class")}</span> : null}
        </label>
      ))}
      {state?.error ? <p role="alert" className="font-bold text-[#F3B4AE]">{errors[state.error]}</p> : null}
      <button className="btn btn-gold mt-2" disabled={pending}>{t("Daftar hadir", "Check in")}</button>
    </form>
  );
}
