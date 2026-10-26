"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { COUNTRIES, BY_CODE, countryForTimezone } from "@/lib/countries";

/**
 * Today's prayer times on the Home screen — adapted from the teachers portal's
 * SolatWidget, restyled for the gold theme and simplified for parents:
 *
 * - Defaults to Singapore (MUIS calculation) rather than auto-detect, so the
 *   Home screen never opens with a location-permission prompt. "Auto-detect"
 *   stays available in the picker for families travelling.
 * - No azan playback controls — that is a teachers-portal feature.
 *
 * Times come from the Aladhan API with each country's official authority's
 * calculation method (lib/countries.js), cached one day per device.
 */
const PRAYERS = [
  { key: "Fajr", label: "Subuh", icon: "sunrise" },
  { key: "Dhuhr", label: "Zohor", icon: "sun" },
  { key: "Asr", label: "Asar", icon: "cloud-sun" },
  { key: "Maghrib", label: "Maghrib", icon: "sunset" },
  { key: "Isha", label: "Isyak", icon: "moon-star" },
];

const AUTO = "auto";
const DEFAULT_CHOICE = "SG";
const CHOICE_KEY = "ss_app_solat_country";
const CACHE_KEY = "ss_app_solat_cache_v1";

function cityFromTz(tz) {
  if (!tz) return "Your location";
  return tz.split("/").pop().replace(/_/g, " ");
}

function ddmmyyyy(d) {
  const p = (n) => (n < 10 ? "0" : "") + n;
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export default function SolatWidget() {
  const [choice, setChoice] = useState(DEFAULT_CHOICE);
  const [ready, setReady] = useState(false);
  const [timings, setTimings] = useState(null);
  const [placeLabel, setPlaceLabel] = useState("");
  const [authority, setAuthority] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Restore the saved country after mount (localStorage is unavailable during
  // SSR, so reading it in a lazy initializer would cause a hydration mismatch).
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(CHOICE_KEY);
    } catch {
      // ignore availability errors
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved && (saved === AUTO || BY_CODE[saved])) setChoice(saved);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const today = new Date().toDateString();
    const dateStr = ddmmyyyy(new Date());

    // Same country + same day → reuse the cached timings, no refetch.
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached?.date === today && cached.choice === choice && cached.timings) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTimings(cached.timings);
        setPlaceLabel(cached.label || "");
        setAuthority(cached.authority || "");
        setError(null);
        return;
      }
    } catch {
      // ignore malformed cache
    }

    setLoading(true);
    setError(null);

    function store(t, label, auth) {
      if (cancelled) return;
      setTimings(t);
      setPlaceLabel(label);
      setAuthority(auth);
      setLoading(false);
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ date: today, choice, timings: t, label, authority: auth })
        );
      } catch {
        // ignore quota/availability errors
      }
    }

    function fail() {
      if (cancelled) return;
      setLoading(false);
      setError("Prayer times unavailable — check your connection.");
    }

    async function fetchTimings(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error("request failed");
      const json = await res.json();
      const t = json?.data?.timings;
      if (!t) throw new Error("malformed");
      return { timings: t, meta: json?.data?.meta };
    }

    async function loadByCity(spec) {
      const { timings: t } = await fetchTimings(
        `https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=${encodeURIComponent(spec.city)}&country=${encodeURIComponent(spec.name)}&method=${spec.method}`
      );
      store(t, spec.city, spec.authority);
    }

    async function loadByCoords(lat, lng, spec, tz) {
      const { timings: t, meta } = await fetchTimings(
        `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${spec.method}`
      );
      store(t, cityFromTz(meta?.timezone || tz), spec.authority);
    }

    if (choice === AUTO) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const spec = countryForTimezone(tz) || BY_CODE.SG;
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            loadByCoords(pos.coords.latitude.toFixed(4), pos.coords.longitude.toFixed(4), spec, tz).catch(() =>
              loadByCity(spec).catch(fail)
            ),
          () => loadByCity(spec).catch(fail), // permission denied → timezone-based city
          { timeout: 8000, maximumAge: 3_600_000 }
        );
      } else {
        loadByCity(spec).catch(fail);
      }
    } else {
      // Explicit country: its reference city, so the result is predictable and
      // needs no location permission. This is the default (Singapore).
      loadByCity(BY_CODE[choice] || BY_CODE.SG).catch(fail);
    }

    return () => {
      cancelled = true;
    };
  }, [choice, ready]);

  function pick(value) {
    setChoice(value);
    try {
      localStorage.setItem(CHOICE_KEY, value);
    } catch {
      // ignore availability errors
    }
  }

  const picker = (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">Country for prayer times</span>
      <span style={{ color: "var(--muted-2)" }}>
        <Icon name="globe" size={14} />
      </span>
      <select
        value={choice}
        onChange={(e) => pick(e.target.value)}
        className="max-w-[180px] cursor-pointer rounded-[10px] border border-hairline bg-surface px-2 py-1 text-[12px] font-semibold text-ink outline-none"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
        <option value={AUTO}>Auto-detect my location</option>
      </select>
    </label>
  );

  const frame = (children) => (
    <section
      className="rounded-[22px] p-[18px] lg:rounded-[24px] lg:p-[24px]"
      style={{
        background: "var(--metal-cream)",
        border: "1px solid var(--gold-line)",
        boxShadow: "var(--shadow-metal)",
      }}
    >
      <div className="mb-[14px] flex flex-wrap items-center justify-between gap-2">
        <span className="kicker flex items-center gap-[6px]" style={{ color: "var(--accent-press)" }}>
          <Icon name="moon-star" size={14} strokeWidth={2.25} />
          Prayer times{placeLabel ? ` · ${placeLabel}` : ""}
        </span>
        {picker}
      </div>
      {children}
    </section>
  );

  if (error) {
    return frame(<p className="text-[13px]" style={{ color: "var(--danger-fg)" }}>{error}</p>);
  }

  if (!timings || loading) {
    return frame(
      <div className="grid grid-cols-5 gap-2">
        {PRAYERS.map((p) => (
          <div key={p.key} className="h-[72px] animate-pulse rounded-[14px]" style={{ background: "var(--surface-3)" }} />
        ))}
      </div>
    );
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const parsed = PRAYERS.map((p) => {
    const [h, m] = (timings[p.key] || "00:00").split(":").map(Number);
    return { ...p, minutes: h * 60 + m, time: timings[p.key] };
  });
  const nextIndex = parsed.findIndex((p) => p.minutes > nowMinutes);
  const next = nextIndex === -1 ? parsed[0] : parsed[nextIndex]; // wraps to tomorrow's Subuh
  const diff = (((next.minutes - nowMinutes) % 1440) + 1440) % 1440;
  const countdown = diff >= 60 ? `${Math.floor(diff / 60)}h ${diff % 60}m` : `${diff}m`;

  return frame(
    <>
      <div className="mb-[14px] grid grid-cols-5 justify-items-center gap-2">
        {parsed.map((p, i) => {
          const isNext = i === (nextIndex === -1 ? 0 : nextIndex);
          const isPast = nextIndex !== -1 && i < nextIndex;
          return (
            <div key={p.key} className={`text-center ${isPast ? "opacity-45" : ""}`}>
              <div
                className={`mx-auto mb-[7px] flex h-[46px] w-[46px] items-center justify-center rounded-full ${
                  isNext ? "metal-chip" : ""
                }`}
                style={
                  isNext
                    ? undefined
                    : { background: "var(--accent-wash)", color: "var(--accent-deep)", border: "1px solid var(--gold-line)" }
                }
              >
                <Icon name={p.icon} size={21} />
              </div>
              <div className="text-[12.5px] font-bold text-ink-strong">{p.label}</div>
              <div className="text-[11.5px] tabular-nums" style={{ color: "var(--muted-2)" }}>
                {p.time}
              </div>
            </div>
          );
        })}
      </div>
      <div className="metal-gold-fill flex items-center justify-center gap-2 rounded-full px-4 py-[9px] text-[13px] font-bold">
        <Icon name="clock" size={15} className="shrink-0" />
        <span>Next prayer:</span>
        <span className="text-[14.5px] font-extrabold">{next.label}</span>
        <span>in {countdown}</span>
      </div>
      <div className="mt-[10px] text-center text-[11px]" style={{ color: "var(--muted-3)" }}>
        Source:{" "}
        <a
          href="https://aladhan.com/prayer-times-api"
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold underline underline-offset-2"
          style={{ color: "var(--muted-2)" }}
        >
          Aladhan API
        </a>
        {authority ? ` · ${authority} calculation` : ""}
      </div>
    </>
  );
}
