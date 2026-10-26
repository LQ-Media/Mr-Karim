"use client";

import { useActionState, useState } from "react";
import { bookTrial } from "./actions";
import { BRANCHES, BY_SLUG, STREAMS } from "@/lib/branches";
import { DAYS, clock, makeT } from "@/lib/tr";

function nextDates(weekday, today, n = 3) {
  const out = [];
  const d = new Date(`${today.date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((weekday - today.weekday + 7) % 7));
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

export default function TryForm({ classes, lang, today, initialBranch }) {
  const t = makeT(lang);
  const [branch, setBranch] = useState(BY_SLUG[initialBranch] ? initialBranch : "an-nur");
  const options = classes.filter((c) => c.branch === branch);
  const [classId, setClassId] = useState(options[0]?.id || "");
  const chosen = options.find((c) => c.id === classId) || options[0];
  const dates = chosen ? nextDates(chosen.weekday, today) : [];
  const [day, setDay] = useState("");
  const pickedDay = dates.includes(day) ? day : dates[0];
  const [state, action, pending] = useActionState(bookTrial, null);

  const months = lang === "en" ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] : ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
  const nice = (iso) => `${Number(iso.slice(8))} ${months[Number(iso.slice(5, 7)) - 1]}`;

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-3 rounded-[16px] bg-surface p-5">
        <h2 className="text-[24px]">{t("Jumpa nanti, insya-Allah!", "See you there, insya-Allah!")}</h2>
        <p className="text-[15px] leading-relaxed">
          {BY_SLUG[chosen.branch].name} · {DAYS[lang][chosen.weekday]} {nice(pickedDay)} · {clock(chosen.starts, lang)}
        </p>
        <p className="rounded-[12px] bg-accent-soft p-3 text-[14px] leading-relaxed">
          <strong>{t("Apa perlu dibawa:", "What to bring:")}</strong>{" "}
          {t(
            "pakaian longgar menutup aurat, air minuman, tuala. Datang 10 minit awal.",
            "loose clothing covering the aurat, water, a towel. Come 10 minutes early."
          )}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[15px] font-extrabold">1. {t("Pilih masjid", "Choose a mosque")}</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {BRANCHES.map((b) => (
            <button
              key={b.slug}
              type="button"
              aria-pressed={b.slug === branch}
              onClick={() => {
                setBranch(b.slug);
                setClassId(classes.find((c) => c.branch === b.slug)?.id || "");
              }}
              className="flex flex-col items-center gap-1.5 rounded-[12px] bg-surface px-0.5 py-2.5 text-[11px] font-bold"
              style={{ border: `2px solid ${b.slug === branch ? "#17140F" : "transparent"}` }}
            >
              <span className="h-[22px] w-[22px] rounded-full" style={{ background: b.color, border: b.ring ? "2px solid #17140F" : 0 }} />
              {b.short.replace("Darul ", "")}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[15px] font-extrabold">2. {t("Pilih kelas", "Choose a class")}</legend>
        {options.map((c) => (
          <label key={c.id} className="flex items-center gap-2.5 rounded-[12px] bg-surface p-3 text-[15px]">
            <input type="radio" name="classId" value={c.id} checked={c.id === chosen?.id} onChange={() => setClassId(c.id)} className="h-5 w-5 accent-[#17140F]" />
            {STREAMS[c.stream][lang]} · {DAYS[lang][c.weekday]} {clock(c.starts, lang)}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[15px] font-extrabold">3. {t("Pilih tarikh", "Choose a date")}</legend>
        <div className="flex gap-2">
          {dates.map((d) => (
            <label key={d} className="flex min-h-[56px] flex-1 cursor-pointer flex-col items-center justify-center rounded-[12px] text-[14px] font-extrabold" style={d === pickedDay ? { background: "#17140F", color: "#F6F0E1" } : { background: "var(--surface)" }}>
              <input type="radio" name="day" value={d} checked={d === pickedDay} onChange={() => setDay(d)} className="sr-only" />
              {nice(d)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-[15px] font-extrabold">4. {t("Butiran anda", "Your details")}</legend>
        <label className="field">
          {t("Nama", "Name")}
          <input name="name" required autoComplete="name" className="input" />
        </label>
        <label className="field">
          {t("No. telefon atau e-mel", "Phone or email")}
          <input name="contact" required autoComplete="tel" className="input" />
        </label>
        <label className="field">
          {t("Berapa orang?", "How many people?")}
          <select name="people" className="input" defaultValue="1">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </fieldset>
      {state?.error ? <p className="text-[14px] font-bold text-danger-fg">{t("Sila isi nama dan cara menghubungi anda.", "Please fill in your name and how to reach you.")}</p> : null}
      <button className="btn btn-gold" disabled={pending}>
        {pending ? t("Menghantar…", "Sending…") : t("Sahkan tempahan", "Confirm booking")}
      </button>
    </form>
  );
}
