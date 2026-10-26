"use client";

import { useEffect, useRef, useState } from "react";
import { makeT } from "@/lib/tr";

const MOVES = [
  ["Lompat bintang", "Jumping jacks"],
  ["Squat", "Squats"],
  ["Tumbukan lurus", "Straight punches"],
  ["Lutut tinggi", "High knees"],
  ["Tekan tubi", "Push-ups"],
  ["Tendangan depan", "Front kicks"],
  ["Lunge", "Lunges"],
  ["Plank", "Plank"],
];
const WORK = 20;
const REST = 10;
const ROUND = WORK + REST;
const TOTAL = ROUND * MOVES.length;

/** Tabata: 8 rounds of 20s work / 10s rest, with a beep at each change. */
export default function Timer({ lang }) {
  const t = makeT(lang);
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  const audio = useRef(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSec((s) => Math.min(TOTAL, s + 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Stop the clock at the end.
  if (running && sec >= TOTAL) setRunning(false);

  const done = sec >= TOTAL;
  const round = Math.min(MOVES.length, Math.floor(sec / ROUND) + 1);
  const inRound = sec % ROUND;
  const work = !done && inRound < WORK;
  const left = done ? 0 : work ? WORK - inRound : ROUND - inRound;
  const move = MOVES[round - 1];
  const next = MOVES[round % MOVES.length];

  useEffect(() => {
    if (!running || (inRound !== 0 && inRound !== WORK)) return;
    try {
      audio.current ??= new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audio.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = inRound === 0 ? 880 : 520;
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.35);
    } catch {}
  }, [inRound, running]);

  const bg = done ? "#3D6A2C" : work || sec === 0 ? "#17140F" : "#1E3E75";

  return (
    <div className="-mx-5 flex min-h-[calc(100dvh-140px)] flex-col items-center justify-between px-6 py-8 text-page lg:mx-0 lg:mt-5 lg:rounded-[20px]" style={{ background: bg }}>
      <p className="text-[14px] font-extrabold uppercase tracking-[0.2em]" aria-live="polite">
        {done ? t("Selesai!", "Done!") : `${t("Pusingan", "Round")} ${round} / ${MOVES.length} · ${work || sec === 0 ? t("Kerja", "Work") : t("Rehat", "Rest")}`}
      </p>
      <div className="flex h-[250px] w-[250px] flex-col items-center justify-center rounded-full border-[12px] border-gold" role="timer" aria-label={`${left} ${t("saat", "seconds")}`}>
        <span className="font-heading text-[110px] font-bold leading-none">{done ? "✓" : sec === 0 ? WORK : left}</span>
        {!done ? <span className="text-[14px] font-bold text-accent-soft">{t("saat", "seconds")}</span> : null}
      </div>
      <div className="text-center">
        <span className="text-[13px] font-bold text-accent-soft">{work || sec === 0 ? t("Gerakan", "Move") : t("Seterusnya", "Next")}</span>
        <p className="font-heading text-[30px] font-semibold">
          {done ? t("Alhamdulillah. Minum air!", "Alhamdulillah. Drink some water!") : (work || sec === 0 ? move : next)[lang === "en" ? 1 : 0]}
        </p>
      </div>
      <div className="flex w-full max-w-[420px] gap-2.5">
        <button className="btn btn-gold flex-1 text-[17px]" onClick={() => (done ? (setSec(0), setRunning(true)) : setRunning((r) => !r))}>
          {done ? t("Sekali lagi", "Again") : running ? t("Jeda", "Pause") : sec ? t("Sambung", "Resume") : t("Mula", "Start")}
        </button>
        <button className="btn border-[1.5px] border-page px-5 text-page" aria-label={t("Mula semula", "Restart")} onClick={() => { setRunning(false); setSec(0); }}>
          ↺
        </button>
      </div>
    </div>
  );
}
