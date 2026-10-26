"use client";

import Icon from "@/components/Icon";

export default function MiniPlayer({ state, store }) {
  const p = state.playback;
  const total = state.verses.length;
  const currentIndex = p.verseKey ? state.verses.findIndex((v) => v.verseKey === p.verseKey) : -1;
  const isPlaying = p.playing || p.loading;
  const scroll = state.autoscroll;
  const chapter = state.chapters.find((c) => c.id === Number(state.chapterId));

  return (
    <div className="flex-none border-t-[0.5px] border-hairline bg-surface px-4 py-2.5 sm:px-5">
      <div className="mx-auto max-w-[760px]">
        {/* Row 1 — "Play surah", NU-Online-style */}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-muted">
              <Icon name="volume" size={11} strokeWidth={2.25} />
              Play surah
            </div>
            <div className="truncate text-[14px] font-bold text-ink">
              {chapter ? chapter.nameSimple : ""}
              <span className="ml-1.5 font-semibold text-muted">
                {currentIndex >= 0 ? `${currentIndex + 1}/${total}` : total > 0 ? `${total} ayahs` : ""}
              </span>
            </div>
          </div>
          <ControlButton label="Previous ayah" onClick={() => store.prev()}>
            <Icon name="skip-back" size={15} />
          </ControlButton>
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Play surah"}
            onClick={() => (isPlaying ? store.pause() : store.playChapter())}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-page shadow-sm transition-[background-color,transform] duration-150 ease-out hover:bg-ink-strong active:scale-95"
          >
            <Icon name={isPlaying ? "pause" : "play"} size={17} />
          </button>
          <ControlButton label="Next ayah" onClick={() => store.next()}>
            <Icon name="skip-forward" size={15} />
          </ControlButton>
        </div>

        {/* Row 2 — reciter + hands-free auto-scroll */}
        <div className="mt-2 flex items-center gap-2">
          <Icon name="mic" size={14} className="flex-none text-muted" />
          <select
            aria-label="Reciter"
            value={state.reciterId}
            onChange={(e) => store.setReciterId(e.target.value)}
            className="min-w-0 flex-1 rounded-control border-[0.5px] border-hairline bg-page px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-ink focus:ring-[1.5px] focus:ring-ink"
          >
            {state.reciters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.style ? ` (${r.style})` : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            role="switch"
            aria-checked={scroll.active}
            onClick={() => store.toggleAutoscroll()}
            title="Scroll the page automatically at a steady speed"
            className={`flex flex-none items-center gap-1.5 rounded-pill border-[0.5px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              scroll.active ? "border-ink bg-ink text-page" : "border-hairline bg-surface text-muted hover:text-ink"
            }`}
          >
            <Icon name="chevrons-down" size={14} />
            Auto-scroll
          </button>
          {scroll.active && (
            <div className="flex flex-none items-center gap-1">
              <StepButton
                label="Slower"
                disabled={scroll.speed <= 1}
                onClick={() => store.setAutoscrollSpeed(scroll.speed - 1)}
              >
                <Icon name="minus" size={13} />
              </StepButton>
              <span className="w-4 text-center text-[12px] tabular-nums text-muted" aria-label="Scroll speed">
                {scroll.speed}
              </span>
              <StepButton
                label="Faster"
                disabled={scroll.speed >= 10}
                onClick={() => store.setAutoscrollSpeed(scroll.speed + 1)}
              >
                <Icon name="plus" size={13} />
              </StepButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ControlButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border-[0.5px] border-hairline bg-surface text-[13px] text-muted transition-colors hover:bg-surface-3 hover:text-ink"
    >
      {children}
    </button>
  );
}

function StepButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-6 w-6 items-center justify-center rounded-full border-[0.5px] border-hairline bg-surface text-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}
