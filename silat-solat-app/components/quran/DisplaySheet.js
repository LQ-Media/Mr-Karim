"use client";

import { useMemo } from "react";
import Icon from "@/components/Icon";
import { parseTajweed, tajweedRule, rulesPresent } from "@/lib/quran/tajweed";
import { MAKHRAJ_REGIONS } from "@/lib/quran/makhraj";

const MODES = [
  { key: "plain", label: "Plain", icon: "type" },
  { key: "tajweed", label: "Tajweed", icon: "droplet" },
  { key: "makhraj", label: "Makhraj", icon: "mic" },
];

const SIZE_RANGE = {
  arabicSize: { label: "Arabic", min: 20, max: 60 },
  translitSize: { label: "Transliteration", min: 10, max: 26 },
  translationSize: { label: "Translation", min: 11, max: 26 },
};

const COLOR_KEYS = {
  arabicColor: "Arabic",
  translitColor: "Transliteration",
  translationColor: "Translation",
};

// Curated on-brand palette + a few high-contrast extras.
const SWATCHES = [
  "#2c2a22", "#7c7261", "#D88A4F", "#8C6239", "#B08442",
  "#8a5f14", "#5e7a3e", "#B0533A", "#2E8B70", "#111111",
];

export default function DisplaySheet({ state, store, onClose }) {
  const { settings, displayMode } = state;

  // Legend: for tajweed, only the rules that actually occur in this surah.
  const legend = useMemo(() => {
    if (displayMode === "tajweed") {
      const present = rulesPresent(state.verses.map((v) => parseTajweed(v.textTajweed)));
      return present.map((cls) => ({ ...tajweedRule(cls), key: cls }));
    }
    if (displayMode === "makhraj") {
      return Object.entries(MAKHRAJ_REGIONS).map(([key, r]) => ({ key, label: r.label, color: r.color }));
    }
    return [];
  }, [displayMode, state.verses]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/40" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Display settings"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[86vh] w-full max-w-[560px] flex-col rounded-t-[24px] bg-surface p-4 shadow-[0_-8px_24px_rgba(74,51,64,0.18)]"
      >
        <div className="mx-auto mb-3.5 h-1.5 w-11 flex-none rounded-pill bg-hairline" />

        <div className="flex-1 space-y-6 overflow-y-auto px-0.5 pb-2">
          {/* Translation language (lives here since the toolbar went compact) */}
          <Section title="Translation language" icon="globe">
            <select
              aria-label="Translation language"
              value={state.translationId}
              onChange={(e) => store.setTranslationId(e.target.value)}
              className="w-full rounded-control border-[0.5px] border-hairline bg-page px-3 py-2.5 text-[13px] text-ink outline-none focus:border-ink focus:ring-[1.5px] focus:ring-ink"
            >
              {state.translations.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.languageName} — {t.name}
                </option>
              ))}
            </select>
          </Section>

          {/* Show / hide layers */}
          <Section title="Show" icon="sliders">
            <div className="space-y-2.5">
              <Switch
                label="Transliteration"
                checked={state.showTransliteration}
                onChange={() => store.toggleTransliteration()}
              />
              <Switch
                label="Translation"
                checked={state.showTranslation}
                onChange={() => store.toggleTranslation()}
              />
            </div>
          </Section>

          {/* On-device copy */}
          <OfflineSection state={state} store={store} />

          {/* Arabic script mode */}
          <Section title="Arabic script" icon="feather">
            <div className="flex rounded-pill bg-surface-3 p-1" role="tablist">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={displayMode === m.key}
                  onClick={() => store.setDisplayMode(m.key)}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-pill py-2 text-[13px] font-semibold transition-colors ${
                    displayMode === m.key ? "bg-ink text-page shadow-sm" : "text-muted"
                  }`}
                >
                  <Icon name={m.icon} size={14} />
                  {m.label}
                </button>
              ))}
            </div>
            {displayMode !== "plain" && (
              <p className="mt-2 text-[12px] text-muted">
                {displayMode === "tajweed"
                  ? "Colour-coded tajweed rules. Word tap-to-translate pauses in this mode."
                  : "Letters coloured by articulation point (makhraj). و and ي join the cavity group when used for prolongation."}
              </p>
            )}
            {legend.length > 0 && (
              <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {legend.map((item) => (
                  <li key={item.key} className="flex items-center gap-2 text-[12px] text-ink">
                    <span
                      className="h-3 w-3 flex-none rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Text size */}
          <Section title="Text size" icon="type">
            <div className="space-y-3.5">
              {Object.entries(SIZE_RANGE).map(([key, cfg]) => (
                <label key={key} className="block">
                  <span className="mb-1 flex items-center justify-between text-[13px] text-ink">
                    {cfg.label}
                    <span className="text-[12px] tabular-nums text-muted">{settings[key]}px</span>
                  </span>
                  <input
                    type="range"
                    min={cfg.min}
                    max={cfg.max}
                    step={1}
                    value={settings[key]}
                    onChange={(e) => store.setSetting(key, Number(e.target.value))}
                    className="w-full accent-ink"
                    aria-label={`${cfg.label} text size`}
                  />
                </label>
              ))}
            </div>
          </Section>

          {/* Text colour */}
          <Section title="Text colour" icon="droplet">
            <div className="space-y-3.5">
              {Object.entries(COLOR_KEYS).map(([key, label]) => (
                <div key={key}>
                  <div className="mb-1.5 text-[13px] text-ink">{label}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {SWATCHES.map((hex) => {
                      const selected = settings[key].toLowerCase() === hex.toLowerCase();
                      return (
                        <button
                          key={hex}
                          type="button"
                          aria-label={`${label} colour ${hex}`}
                          aria-pressed={selected}
                          onClick={() => store.setSetting(key, hex)}
                          className={`h-7 w-7 rounded-full border transition-transform ${
                            selected ? "scale-110 border-ink" : "border-hairline"
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      );
                    })}
                    <label
                      className="flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-hairline"
                      title="Custom colour"
                    >
                      <input
                        type="color"
                        value={settings[key]}
                        onChange={(e) => store.setSetting(key, e.target.value)}
                        className="h-9 w-9 cursor-pointer border-0 bg-transparent p-0"
                        aria-label={`${label} custom colour`}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => store.resetSettings()}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              <Icon name="refresh" size={13} />
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-control bg-ink px-5 py-2 text-[14px] font-semibold text-page transition-colors hover:bg-ink-strong"
            >
              <Icon name="check" size={15} />
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Offline copy controls. Reading is already network-first with a cache
 * fallback, so this is about deliberately filling that cache for every surah
 * rather than only the ones the teacher happens to have opened.
 */
function OfflineSection({ state, store }) {
  const o = state.offline;
  const complete = o.savedCount >= o.total;
  const translationName = (() => {
    const t = state.translations.find((x) => Number(x.id) === Number(state.translationId));
    return t ? `${t.languageName} — ${t.name}` : "the selected translation";
  })();

  if (!o.supported) {
    return (
      <Section title="Offline copy" icon="download">
        <p className="text-[12px] text-muted">
          This browser cannot store an offline copy. The reader still works normally with a connection.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Offline copy" icon="download">
      <div className="rounded-card border-[0.5px] border-hairline bg-page p-3.5">
        <div className="flex items-start gap-2.5">
          <span className={`mt-0.5 flex-none ${complete ? "text-accent-press" : "text-muted"}`}>
            <Icon name={complete ? "check" : "download"} size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink">
              {o.saving
                ? `Saving… ${o.progress} of ${o.total} surahs`
                : complete
                  ? "All 114 surahs saved on this device"
                  : o.savedCount > 0
                    ? `${o.savedCount} of ${o.total} surahs saved`
                    : "Not saved on this device yet"}
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              The reader always loads from the internet when you have a connection, and falls back to
              the saved copy when you don’t. Saves the Arabic, transliteration and{" "}
              {translationName}. Recitation audio still needs a connection.
            </p>
          </div>
        </div>

        {o.saving && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-pill bg-surface-3">
            <div
              className="h-full rounded-pill bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${Math.round((o.progress / o.total) * 100)}%` }}
            />
          </div>
        )}

        {o.error && <p className="mt-2.5 text-[12px] text-danger-fg">{o.error}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {o.saving ? (
            <button
              type="button"
              onClick={() => store.stopSavingOffline()}
              className="inline-flex items-center gap-1.5 rounded-control border-[0.5px] border-hairline bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-3"
            >
              <Icon name="x" size={14} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => store.saveOffline()}
              className="inline-flex items-center gap-1.5 rounded-control bg-ink px-3.5 py-2 text-[13px] font-semibold text-page transition-[background-color,transform] duration-150 ease-out hover:bg-ink-strong active:scale-[0.98]"
            >
              <Icon name={complete ? "refresh" : "download"} size={14} />
              {complete ? "Refresh saved copy" : o.savedCount > 0 ? "Finish saving" : "Save for offline"}
            </button>
          )}
          {o.savedCount > 0 && !o.saving && (
            <button
              type="button"
              onClick={() => store.clearOffline()}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              <Icon name="trash" size={13} />
              Remove
            </button>
          )}
        </div>
      </div>
    </Section>
  );
}

function Section({ title, icon, children }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">
        {icon ? <Icon name={icon} size={13} className="shrink-0" /> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Switch({ label, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center justify-between text-[14px] text-ink"
    >
      {label}
      <span className={`relative h-6 w-11 flex-none rounded-pill transition-colors ${checked ? "bg-ink" : "bg-surface-3"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
