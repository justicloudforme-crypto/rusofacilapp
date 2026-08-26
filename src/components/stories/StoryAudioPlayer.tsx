// Presentational transport bar for StoryText's narrated-story reader.
// Deliberately holds no state or playback logic of its own — StoryText
// owns the <audio>/speechSynthesis wiring (queue advance, sentence sync,
// media-session integration, the sticky/scroll behavior) because the
// player and the reading text are bidirectionally coupled: a word tap
// seeks playback, and playback drives which sentence is highlighted and
// scrolled into view. Splitting that state across two components would
// turn a prop-drilling exercise into a real risk of breaking that sync;
// this only pulls the transport bar's markup out to style it on its own,
// unchanged behavior.
export const READ_ALOUD_RATES = [0.8, 1, 1.2] as const;
export type ReadAloudRate = (typeof READ_ALOUD_RATES)[number];

export interface StoryAudioPlayerDict {
  playLabel: string;
  pauseLabel: string;
  skipBackLabel: string;
  skipForwardLabel: string;
  seekLabel: string;
}

export default function StoryAudioPlayer({
  dict,
  navOffset,
  sticky,
  hasRealAudio,
  playing,
  progress,
  rate,
  queueLength,
  readingQueueIndex,
  onSkipBack,
  onSkipForward,
  onPlayPause,
  onSeek,
  onRateChange,
}: {
  dict: StoryAudioPlayerDict;
  navOffset: number;
  sticky: boolean;
  hasRealAudio: boolean;
  playing: boolean;
  /** 0..1 fraction of the queue completed so far. */
  progress: number;
  rate: ReadAloudRate;
  queueLength: number;
  readingQueueIndex: number | null;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onPlayPause: () => void;
  onSeek: (index: number) => void;
  onRateChange: (rate: ReadAloudRate) => void;
}) {
  return (
    <div
      style={{ top: navOffset }}
      // A flex-wrap row of skip/play/progress/rate controls was too much
      // for a ~390px phone width and wrapped unevenly (a device report
      // called it "asymmetric/crooked") — explicit rows instead of relying
      // on wrap: transport controls + progress share one row, and only the
      // rate buttons drop to their own full-width row on narrow screens.
      className={`sticky z-30 mb-6 flex flex-col gap-2 rounded-2xl border border-primary/15 bg-background/95 backdrop-blur transition-all sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 ${
        sticky ? "p-2.5 shadow-lg" : "p-4"
      }`}
    >
      <div className="flex items-center gap-3 sm:contents">
        {hasRealAudio && (
          <button
            type="button"
            onClick={onSkipBack}
            aria-label={dict.skipBackLabel}
            title={dict.skipBackLabel}
            className={`flex flex-shrink-0 items-center justify-center rounded-full text-primary/70 transition-colors hover:text-primary ${
              sticky ? "h-7 w-7 text-sm" : "h-9 w-9 text-base"
            }`}
          >
            <span aria-hidden="true">⏪</span>
          </button>
        )}

        <button
          type="button"
          onClick={onPlayPause}
          aria-label={playing ? dict.pauseLabel : dict.playLabel}
          title={playing ? dict.pauseLabel : dict.playLabel}
          className={`flex flex-shrink-0 items-center justify-center rounded-full bg-primary text-white transition-all hover:bg-primary-400 ${
            sticky ? "h-8 w-8 text-sm" : "h-10 w-10"
          }`}
        >
          <span aria-hidden="true">{playing ? "⏸" : "▶"}</span>
        </button>

        {hasRealAudio && (
          <button
            type="button"
            onClick={onSkipForward}
            aria-label={dict.skipForwardLabel}
            title={dict.skipForwardLabel}
            className={`flex flex-shrink-0 items-center justify-center rounded-full text-primary/70 transition-colors hover:text-primary ${
              sticky ? "h-7 w-7 text-sm" : "h-9 w-9 text-base"
            }`}
          >
            <span aria-hidden="true">⏩</span>
          </button>
        )}

        <div className="relative flex min-w-[60px] flex-1 items-center">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-premium-400 transition-[width] duration-300"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>
          {/* Transparent range input on top of the visual bar above — reuses
              its look while getting native drag/keyboard/touch seek behavior
              for free. React's onChange fires on every drag step (not just
              on release), so the text highlight and scroll follow the thumb
              live — the player -> text sync side of the two-way sync. */}
          <input
            type="range"
            min={0}
            max={Math.max(0, queueLength - 1)}
            step={1}
            value={readingQueueIndex ?? 0}
            disabled={queueLength === 0}
            onChange={(event) => onSeek(Number(event.target.value))}
            aria-label={dict.seekLabel}
            className="absolute inset-x-0 top-1/2 h-6 w-full -translate-y-1/2 cursor-pointer opacity-0"
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-1 sm:justify-start">
        {READ_ALOUD_RATES.map((speed) => (
          <button
            key={speed}
            type="button"
            onClick={() => onRateChange(speed)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              rate === speed
                ? "bg-folk-red text-white"
                : "border border-primary/15 text-foreground/60 hover:text-primary"
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}
