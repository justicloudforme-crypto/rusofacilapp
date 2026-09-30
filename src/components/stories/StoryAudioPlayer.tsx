// Presentational transport bar for StoryText's narrated-story reader.
// Deliberately holds no state or playback logic of its own — StoryText
// owns the <audio> wiring (queue advance, sentence sync,
// media-session integration, the sticky/scroll behavior) because the
// player and the reading text are bidirectionally coupled: a word tap
// seeks playback, and playback drives which sentence is highlighted and
// scrolled into view. Splitting that state across two components would
// turn a prop-drilling exercise into a real risk of breaking that sync;
// this only pulls the transport bar's markup out to style it on its own,
// unchanged behavior.
import { useEffect, useRef, useState, type RefObject } from "react";
import { usePinnedLayer } from "@/lib/usePinnedLayer";
import {
  seekGestureStep,
  seekIndexAt,
  seekPointerOf,
  type SeekGestureEvent,
  type SeekGestureState,
} from "@/lib/seek-gesture";

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
  audioRef,
  sentenceOffsets,
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
  /** Элемент одной дорожки рассказа — по нему полоска идёт по времени. */
  audioRef?: RefObject<HTMLAudioElement | null>;
  /** Начала строк в дорожке, с — вместе с `audioRef`. */
  sentenceOffsets?: number[] | null;
}) {
  /**
   * ПЕРЕМОТКА ПО ПОЛОСКЕ — ЗАХОД 7.254 (решение владельца 30.09.2026:
   * перемотка пальцем нужна; её отключение в 7.253 — не починка).
   *
   * Как было: поверх полоски лежал невидимый `<input type="range">`
   * высотой 24 px, и его `onChange` перематывал на КАЖДОМ шаге движения
   * пальца — прокрутка страницы, начатая на полоске, или палец держащей
   * руки уводили рассказ лесенкой по строкам в ноль (журнал POCO 30.09,
   * 12:56:23: касание x≈298, y≈609 CSS px — прямо на полоске). 7.253
   * отключил палец совсем.
   *
   * Как теперь: касанием полоски правит `seekGestureStep`
   * (`src/lib/seek-gesture.ts`) — тап переходит в точку, перетаскивание
   * двигает видимый бегунок и переходит ОДИН раз при отпускании, прокрутка
   * с полоски, долгое неподвижное касание, второй палец и отмена жеста
   * браузером не перематывают. Зона касания — 44 px по высоте,
   * `touch-action: pan-y` отдаёт браузеру только вертикальную прокрутку.
   * Мышь — переход сразу и на каждом шаге, как было. Клавиатура и TalkBack
   * — через тот же `range`, но указатель до него больше не доходит
   * (`pointer-events: none`).
   *
   * Полоска рассказа с одной дорожкой идёт по ВРЕМЕНИ — так же, как шкала
   * в шторке. До 7.254 она шла по номеру строки ((строка + 1) / всего), и
   * на видео 01.10 шторка показывала 24,9 из 89,2 с (28 %), а страница —
   * 50 %.
   */
  const trackRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<SeekGestureState | null>(null);
  const lastMouseSeek = useRef<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const clock = useAudioClock(audioRef ?? null);
  const timeline =
    sentenceOffsets && sentenceOffsets.length === queueLength && clock.duration > 0
      ? { offsets: sentenceOffsets, duration: clock.duration }
      : null;
  const shown = (() => {
    if (!timeline) return progress;
    if (clock.time > 0) return clock.time / timeline.duration;
    if (readingQueueIndex !== null) return (timeline.offsets[readingQueueIndex] ?? 0) / timeline.duration;
    return 0;
  })();
  const fill = Math.min(Math.max(preview ?? shown, 0), 1);

  function fractionAt(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function run(event: SeekGestureEvent) {
    const step = seekGestureStep(gestureRef.current, event);
    gestureRef.current = step.state;
    setPreview(step.preview);
    if (step.commit === null) return;
    const index = seekIndexAt(step.commit, queueLength, timeline);
    const pointer = step.state?.pointer ?? (event.type === "down" ? event.pointer : "touch");
    // Мышь перематывает на каждом шаге — но только когда сменилась строка,
    // как `onChange` прежнего ползунка.
    if (pointer === "mouse") {
      if (lastMouseSeek.current === index) return;
      lastMouseSeek.current = index;
    }
    onSeek(index);
  }

  /**
   * Плеер на ОБЩЕМ УЧЁТЕ прижатых слоёв (src/lib/pinned-layers.ts) — это
   * и есть закрытие долга 159: карточка перевода слова накрывала ряд
   * его кнопок, потому что ставилась «над словом» и о плеере не знала.
   * Замер 13.09.2026 до правки, все пять телефонных ширин: 6 закрытых
   * кнопок из 6, перекрытие 76..90 px.
   *
   * Места в конце документа не резервирует: `position: sticky` занимает
   * своё место в потоке само.
   */
  const pinnedRef = usePinnedLayer<HTMLDivElement>({ edge: "top", label: "StoryAudioPlayer" });
  return (
    <div
      ref={pinnedRef}
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
            data-rf-player="back"
            aria-label={dict.skipBackLabel}
            title={dict.skipBackLabel}
            className={`flex flex-shrink-0 items-center justify-center rounded-full text-primary-text/70 transition-colors hover:text-primary-text ${
              sticky ? "h-7 w-7 text-sm" : "h-9 w-9 text-base"
            }`}
          >
            <span aria-hidden="true">⏪</span>
          </button>
        )}

        <button
          type="button"
          onClick={onPlayPause}
          // Признаки для СКАЧАННОЙ КОПИИ (заход 7.240, долг 311): в копии
          // React не оживает, и проигрыватель там оживляет каркас
          // `public/offline.html` — по этим атрибутам он находит кнопку и
          // обе её подписи, не зная словаря сайта.
          data-rf-player="play"
          data-rf-play-label={dict.playLabel}
          data-rf-pause-label={dict.pauseLabel}
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
            data-rf-player="forward"
            aria-label={dict.skipForwardLabel}
            title={dict.skipForwardLabel}
            className={`flex flex-shrink-0 items-center justify-center rounded-full text-primary-text/70 transition-colors hover:text-primary-text ${
              sticky ? "h-7 w-7 text-sm" : "h-9 w-9 text-base"
            }`}
          >
            <span aria-hidden="true">⏩</span>
          </button>
        )}

        <div className="relative flex min-w-[60px] flex-1 items-center">
          <div ref={trackRef} className="relative h-1.5 w-full rounded-full bg-primary/10">
            <div
              data-rf-player="bar"
              className={`relative h-full rounded-full bg-premium-400 ${preview === null ? "transition-[width] duration-300" : ""}`}
              style={{ width: `${fill * 100}%` }}
            >
              {/* Видимый бегунок — на конце заливки, поэтому едет и в
                  скачанной копии, где ширину ставит каркас. */}
              <span
                aria-hidden="true"
                data-rf-player="thumb"
                className={`absolute right-0 top-1/2 block h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-premium-500 shadow ring-2 ring-background transition-transform ${
                  preview === null ? "" : "scale-125"
                }`}
              />
            </div>
          </div>
          {/* Зона касания — 44 px по высоте поверх полоски, места в ряду не
              занимает. Жест — `seekGestureStep`, см. комментарий выше. */}
          <div
            data-rf-player="seek-zone"
            aria-hidden="true"
            className="absolute inset-x-0 top-1/2 h-11 -translate-y-1/2 cursor-pointer touch-pan-y"
            onPointerDown={(event) => {
              if (queueLength === 0) return;
              if (event.pointerType === "mouse" && event.button !== 0) return;
              lastMouseSeek.current = null;
              if (event.pointerType === "mouse") event.currentTarget.setPointerCapture?.(event.pointerId);
              run({ type: "down", pointerId: event.pointerId, pointer: seekPointerOf(event.pointerType), isPrimary: event.isPrimary, x: event.clientX, y: event.clientY, t: event.timeStamp, fraction: fractionAt(event.clientX) });
            }}
            onPointerMove={(event) => {
              if (!gestureRef.current) return;
              const before = gestureRef.current.mode;
              run({ type: "move", pointerId: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, fraction: fractionAt(event.clientX) });
              // Перетаскивание решено — палец держим за полоской, даже если
              // он уйдёт с неё по вертикали.
              if (before === "pending" && gestureRef.current?.mode === "drag") event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerUp={(event) => {
              run({ type: "up", pointerId: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, fraction: fractionAt(event.clientX) });
            }}
            onPointerCancel={(event) => run({ type: "cancel", pointerId: event.pointerId })}
          />
          {/* Ползунок — для клавиатуры и TalkBack; указатель до него не
              доходит (`pointer-events-none`), касанием правит зона выше. */}
          <input
            type="range"
            min={0}
            max={Math.max(0, queueLength - 1)}
            step={1}
            value={readingQueueIndex ?? 0}
            disabled={queueLength === 0}
            data-rf-player="seek"
            onChange={(event) => onSeek(Number(event.target.value))}
            aria-label={dict.seekLabel}
            className="pointer-events-none absolute inset-x-0 top-1/2 h-6 w-full -translate-y-1/2 opacity-0"
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
                : "border border-primary/15 text-foreground/60 hover:text-primary-text"
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Время и длина одной дорожки — только для полоски плеера. Подписка
 * здесь, а не в `StoryText`: перерисовывается одна полоска, а не весь
 * текст рассказа на каждом `timeupdate`.
 */
function useAudioClock(audioRef: RefObject<HTMLAudioElement | null> | null): { time: number; duration: number } {
  const [clock, setClock] = useState({ time: 0, duration: 0 });
  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;
    const read = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      const time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      setClock((prev) => (prev.time === time && prev.duration === duration ? prev : { time, duration }));
    };
    read();
    const events = ["timeupdate", "seeked", "loadedmetadata", "durationchange", "emptied", "ended"] as const;
    for (const name of events) audio.addEventListener(name, read);
    return () => {
      for (const name of events) audio.removeEventListener(name, read);
    };
  }, [audioRef]);
  return clock;
}
