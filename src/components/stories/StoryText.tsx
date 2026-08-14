"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import SpeakButton from "@/components/lesson/SpeakButton";
import { sanitizeTextForTTS } from "@/lib/speech";
import { getStoryProgress, saveStoryProgress, syncStoryProgress } from "@/lib/reading-progress";

// Captures runs of Cyrillic letters (optionally hyphenated, e.g.
// "кто-то") as clickable tokens; everything else (spaces, punctuation)
// renders as plain text in between.
const WORD_SPLIT_REGEX = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
const CYRILLIC_WORD_REGEX = /^[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*$/u;

// Splits a paragraph into sentences (kept together with their trailing
// punctuation/quotes). Chrome silently stops narrating an utterance longer
// than ~15s, so long paragraphs must be spoken as a queue of short
// utterances rather than one call to speak() per paragraph.
const SENTENCE_SPLIT_REGEX = /[^.!?…]+[.!?…]+[»"'\]) ]*|[^.!?…]+$/gu;

const READ_ALOUD_RATES = [0.8, 1, 1.2] as const;
const PAGE_SIZE = 5;

function tokenizeParagraph(paragraph: string): string[] {
  return paragraph.split(WORD_SPLIT_REGEX).filter((token) => token.length > 0);
}

/** Start offset of each token within the paragraph string — used to map a
 * SpeechSynthesis boundary event's charIndex back to a token to highlight. */
function tokenStarts(tokens: string[]): number[] {
  const starts: number[] = [];
  let offset = 0;
  for (const token of tokens) {
    starts.push(offset);
    offset += token.length;
  }
  return starts;
}

function tokenIndexAtChar(tokens: string[], starts: number[], charIndex: number): number | null {
  let candidate = -1;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= charIndex) candidate = i;
    else break;
  }
  if (candidate === -1) return null;
  // The boundary event should land on the start of a word, but nudge
  // forward to the nearest actual word token just in case it lands on
  // whitespace/punctuation instead.
  for (let i = candidate; i < tokens.length; i++) {
    if (CYRILLIC_WORD_REGEX.test(tokens[i])) return i;
  }
  return null;
}

interface Sentence {
  text: string;
  /** Offset of this sentence's first character within its paragraph. */
  start: number;
}

function splitSentences(paragraph: string): Sentence[] {
  const sentences: Sentence[] = [];
  SENTENCE_SPLIT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_SPLIT_REGEX.exec(paragraph))) {
    if (match[0].trim().length > 0) {
      sentences.push({ text: match[0], start: match.index });
    }
  }
  return sentences.length > 0 ? sentences : [{ text: paragraph, start: 0 }];
}

interface QueueItem {
  /** Index into the current page's paragraph array. */
  paragraphIndex: number;
  /** Offset of this sentence's first character within its paragraph. */
  start: number;
  text: string;
}

type TranslationState =
  | { status: "loading" }
  | { status: "done"; translation: string }
  | { status: "error" };

interface PopoverPosition {
  top: number;
  left: number;
}

const POPOVER_WIDTH = 288;
const POPOVER_HEIGHT_ESTIMATE = 120;
const POPOVER_MARGIN = 8;

export interface StoryTextDict {
  translationLoading: string;
  translationError: string;
  wordListenLabel: string;
  closeLabel: string;
  showTranslationButton: string;
  hideTranslationButton: string;
  playLabel: string;
  pauseLabel: string;
  pageLabel: string;
  prevPageLabel: string;
  nextPageLabel: string;
  completedBadge: string;
}

export default function StoryText({
  storyId,
  paragraphs,
  translationParagraphs,
  dict,
}: {
  /** Used as the localStorage key for per-story reading progress. Pass
   * `null` to disable progress tracking entirely — used for the
   * paywalled single-paragraph preview, where "reading" it would
   * otherwise get saved as the whole (1-page) story being 100% done. */
  storyId: string | null;
  paragraphs: string[];
  /** Spanish paragraphs aligned by index with `paragraphs`. Optional —
   * when absent (or empty), the toggle button doesn't render at all and
   * only the per-word popover translation is available. */
  translationParagraphs?: string[];
  dict: StoryTextDict;
}) {
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const [translation, setTranslation] = useState<TranslationState | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  const totalPages = Math.max(1, Math.ceil(paragraphs.length / PAGE_SIZE));
  const [currentPage, setCurrentPage] = useState(0);
  const pageStart = currentPage * PAGE_SIZE;
  const pageParagraphs = useMemo(
    () => paragraphs.slice(pageStart, pageStart + PAGE_SIZE),
    [paragraphs, pageStart]
  );
  const pageTranslationParagraphs = useMemo(
    () => translationParagraphs?.slice(pageStart, pageStart + PAGE_SIZE) ?? [],
    [translationParagraphs, pageStart]
  );
  const hasParagraphTranslation = Boolean(translationParagraphs && translationParagraphs.length > 0);
  const containerTopRef = useRef<HTMLDivElement>(null);

  const [ttsSupported, setTtsSupported] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<(typeof READ_ALOUD_RATES)[number]>(1);
  const [readingParagraph, setReadingParagraph] = useState<number | null>(null);
  const [readingToken, setReadingToken] = useState<number | null>(null);
  const [readingQueueIndex, setReadingQueueIndex] = useState<number | null>(null);
  const [playerSticky, setPlayerSticky] = useState(false);
  const rateRef = useRef(rate);
  const playingRef = useRef(false);
  const pendingNextRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerSentinelRef = useRef<HTMLDivElement>(null);
  // Every intentional cancel (pause, word click, page change, rate change,
  // unmount) bumps this counter. Each utterance captures the counter's
  // value when it starts; its onend/onerror only act if the counter is
  // still at that value. This replaced an earlier boolean "was this a
  // manual cancel" flag, which had to be reset back to false by the very
  // callback it was guarding — if that callback never fired (cancel() on
  // an idle synth fires no events at all, and a cancelled utterance can
  // fire onerror instead of onend depending on the engine), the flag got
  // stuck true and silently killed the sentence-chain after one sentence.
  // A monotonic counter can't get stuck: a stale utterance simply never
  // matches the current generation, no reset step required.
  const playbackGenRef = useRef(0);

  // Reading-progress restore: a finished story reopens on page 1 with just
  // the "completed" badge (per spec), while an in-progress one jumps
  // straight to the page the reader left off on. `resumeQueueIndexRef`
  // carries the saved sentence index across the render where `currentPage`
  // updates to that page — it's consumed (and cleared) by the effect below
  // once `readingQueue` reflects the resumed page.
  const [isCompletedBadge, setIsCompletedBadge] = useState(false);
  const [resumeParagraphIndex, setResumeParagraphIndex] = useState<number | null>(null);
  const resumeQueueIndexRef = useRef<number | null>(null);
  const paragraphRefs = useRef<Array<HTMLDivElement | null>>([]);

  const tokenizedParagraphs = useMemo(() => pageParagraphs.map(tokenizeParagraph), [pageParagraphs]);

  // Cancels any in-flight utterance and invalidates it for the queue chain.
  function cancelSpeech() {
    playbackGenRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  const readingQueue = useMemo(() => {
    const queue: QueueItem[] = [];
    pageParagraphs.forEach((paragraph, paragraphIndex) => {
      for (const sentence of splitSentences(paragraph)) {
        // Sanitize right as each queue entry is built (not only later, at
        // speak() time) so a stray backslash can never reach the TTS
        // engine and get read aloud as "backslash" — belt-and-suspenders
        // with the sanitizeTextForTTS() call in speakQueueAt below.
        queue.push({ paragraphIndex, start: sentence.start, text: sanitizeTextForTTS(sentence.text) });
      }
    });
    return queue;
  }, [pageParagraphs]);

  useEffect(() => {
    // Same SSR/hydration-safe pattern as SpeakButton: start true, correct
    // right after mount so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Restore reading position on mount. A completed story reopens on page 1
  // with just the "read" badge; an in-progress one jumps to the saved page,
  // and the saved sentence index is applied once that page's readingQueue
  // is built (see the effect below).
  useEffect(() => {
    if (!storyId) return;
    const stored = getStoryProgress(storyId);
    if (!stored) return;
    if (stored.isCompleted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCompletedBadge(true);
      return;
    }
    // Applies whether or not the saved page differs from the default (page
    // 1) — resuming mid-sentence on page 1 itself needs this too, not just
    // jumps to page 2+.
    resumeQueueIndexRef.current = stored.queueIndex;
    if (stored.currentPage > 1 && stored.currentPage <= totalPages) {
      setCurrentPage(stored.currentPage - 1);
    }
    // Runs once on mount only — storyId is stable for the lifetime of this
    // component (a different story is a full route/component remount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background reconciliation with the server copy of this story's
  // progress (if the user is logged in) — deliberately does NOT re-jump
  // the reader to a different page once rendered, even if the server turns
  // out to have a newer position from another device: that would be a
  // jarring page change mid-read. It only updates localStorage so the
  // NEXT visit (this story or the catalog) already reflects it.
  useEffect(() => {
    if (!storyId) return;
    syncStoryProgress();
  }, [storyId]);

  // Applies the saved sentence position once the resumed page's
  // readingQueue is ready, then scrolls it into view. Self-consuming: the
  // ref is cleared right away, so this is a no-op on every later
  // readingQueue change (manual page turns, etc).
  useEffect(() => {
    const idx = resumeQueueIndexRef.current;
    resumeQueueIndexRef.current = null;
    if (idx === null || idx < 0 || idx >= readingQueue.length) return;
    const item = readingQueue[idx];
    setReadingQueueIndex(idx);
    setResumeParagraphIndex(item.paragraphIndex);
    requestAnimationFrame(() => {
      paragraphRefs.current[item.paragraphIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [readingQueue]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Reset narration and the word popover whenever the reader switches pages
  // — audio should only ever cover the page that's currently open. Done as
  // a direct event-handler call rather than an effect keyed on `currentPage`
  // so the reset isn't a synchronous setState-in-effect cascade.
  function goToPage(page: number) {
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
    cancelSpeech();
    setPlaying(false);
    setReadingParagraph(null);
    setReadingToken(null);
    setReadingQueueIndex(null);
    setResumeParagraphIndex(null);
    setIsCompletedBadge(false);
    setActiveWord(null);
    setPopoverPosition(null);
    setTranslation(null);
    setCurrentPage(page);
    containerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (storyId) saveStoryProgress(storyId, { currentPage: page + 1, totalPages, queueIndex: null });
  }

  // Stop any in-flight narration when the reader navigates away.
  useEffect(() => {
    return () => {
      if (pendingNextRef.current) clearTimeout(pendingNextRef.current);
      cancelSpeech();
    };
  }, []);

  // Shrink the player into a compact floating bar once the reader scrolls
  // past where it originally sat, so Play/Pause/speed stay reachable.
  useEffect(() => {
    const sentinel = playerSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setPlayerSticky(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Chromium has a long-standing bug where speechSynthesis silently stops
  // delivering events (onend/onboundary never fire again) after roughly
  // 15s of continuous speaking — it looks like playback "stops after the
  // first sentence" once the queue reaches that mark. Nudging the engine
  // with pause()+resume() every few seconds resets its internal timer and
  // keeps the queue alive for arbitrarily long pages.
  useEffect(() => {
    if (!playing) return;
    const keepAlive = setInterval(() => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 5000);
    return () => clearInterval(keepAlive);
  }, [playing]);

  function speakQueueAt(index: number) {
    const item = readingQueue[index];
    if (!item) {
      setPlaying(false);
      setReadingParagraph(null);
      setReadingToken(null);
      setReadingQueueIndex(null);
      return;
    }
    // This utterance belongs to the current playback generation. If a
    // cancel happens later (pause, word click, page change, rate change),
    // playbackGenRef moves on and this closure's `generation` goes stale —
    // its onend/onerror then know to no-op instead of continuing the chain.
    const generation = playbackGenRef.current;
    setReadingQueueIndex(index);
    setReadingParagraph(item.paragraphIndex);
    setReadingToken(null);
    setResumeParagraphIndex(null);
    setIsCompletedBadge(false);
    if (storyId) saveStoryProgress(storyId, { currentPage: currentPage + 1, totalPages, queueIndex: index });

    const utterance = new SpeechSynthesisUtterance(sanitizeTextForTTS(item.text));
    utterance.lang = "ru-RU";
    utterance.rate = rateRef.current;
    utterance.onboundary = (event) => {
      const tokens = tokenizedParagraphs[item.paragraphIndex];
      const starts = tokenStarts(tokens);
      const tokenIndex = tokenIndexAtChar(tokens, starts, item.start + event.charIndex);
      setReadingToken(tokenIndex);
    };
    utterance.onend = () => {
      if (playbackGenRef.current !== generation) return;
      const next = index + 1;
      if (next < readingQueue.length) {
        // Calling speak() synchronously from inside another utterance's
        // onend is itself flaky in Chromium (the new utterance can be
        // silently dropped) — deferring to the next tick works around it.
        pendingNextRef.current = setTimeout(() => {
          pendingNextRef.current = null;
          // The user may have hit Pause or navigated away during this
          // short gap between sentences (nothing was actively speaking
          // for speechSynthesis.pause() to catch) — respect that instead
          // of barreling ahead into the next sentence regardless.
          if (!playingRef.current || playbackGenRef.current !== generation) return;
          speakQueueAt(next);
        }, 50);
      } else {
        setPlaying(false);
        setReadingParagraph(null);
        setReadingToken(null);
        setReadingQueueIndex(null);
      }
    };
    utterance.onerror = (event) => {
      if (playbackGenRef.current !== generation) {
        // Expected: this utterance was cancelled by our own cancelSpeech()
        // (rate change, word click, page change, pause, unmount).
        return;
      }
      console.error("[StoryText TTS] speechSynthesis error:", event.error);
      setPlaying(false);
    };
    window.speechSynthesis.speak(utterance);
  }

  function stopReading() {
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
    cancelSpeech();
    setPlaying(false);
  }

  function handlePlayPause() {
    if (!ttsSupported || readingQueue.length === 0) return;
    if (playing) {
      window.speechSynthesis.pause();
      setPlaying(false);
      return;
    }
    if (window.speechSynthesis.paused && readingQueueIndex !== null) {
      window.speechSynthesis.resume();
      setPlaying(true);
      return;
    }
    const startIndex = readingQueueIndex !== null && readingQueueIndex < readingQueue.length - 1
      ? readingQueueIndex
      : 0;
    setPlaying(true);
    speakQueueAt(startIndex);
  }

  function handleRateChange(nextRate: (typeof READ_ALOUD_RATES)[number]) {
    setRate(nextRate);
    rateRef.current = nextRate;
    if (playing && readingQueueIndex !== null) {
      cancelSpeech();
      speakQueueAt(readingQueueIndex);
    }
  }

  const progress =
    readingQueue.length > 0 && readingQueueIndex !== null
      ? (readingQueueIndex + 1) / readingQueue.length
      : 0;

  async function handleWordClick(word: string, event: ReactMouseEvent<HTMLButtonElement>) {
    stopReading();

    const rect = event.currentTarget.getBoundingClientRect();
    const spaceAbove = rect.top;
    const placeAbove = spaceAbove > POPOVER_HEIGHT_ESTIMATE + POPOVER_MARGIN;
    const top = placeAbove
      ? rect.top - POPOVER_HEIGHT_ESTIMATE - POPOVER_MARGIN
      : rect.bottom + POPOVER_MARGIN;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - POPOVER_WIDTH / 2, POPOVER_MARGIN),
      window.innerWidth - POPOVER_WIDTH - POPOVER_MARGIN
    );
    setPopoverPosition({ top, left });
    setActiveWord(word);
    setTranslation({ status: "loading" });
    try {
      const res = await fetch(`/api/dictionary/translate?word=${encodeURIComponent(word)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.translation !== "string" || !data.translation) {
        setTranslation({ status: "error" });
        return;
      }
      setTranslation({ status: "done", translation: data.translation });
    } catch {
      setTranslation({ status: "error" });
    }
  }

  function close() {
    setActiveWord(null);
    setPopoverPosition(null);
    setTranslation(null);
  }

  useEffect(() => {
    if (!activeWord) return;
    // The popover is positioned with fixed viewport coordinates computed
    // at click time — close it on scroll rather than let it drift away
    // from the word it's supposed to be anchored to.
    const handleScroll = () => close();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeWord]);

  const pageLabelText = dict.pageLabel
    .replace("{page}", String(currentPage + 1))
    .replace("{total}", String(totalPages));

  return (
    <div ref={containerTopRef}>
      {isCompletedBadge && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <span aria-hidden="true">✓</span> {dict.completedBadge}
        </div>
      )}

      {ttsSupported && paragraphs.length > 0 && (
        <>
          <div ref={playerSentinelRef} />
          <div
            className={`sticky top-0 z-30 mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-black/10 bg-background/95 backdrop-blur transition-all dark:border-white/10 ${
              playerSticky ? "gap-3 p-2.5 shadow-lg" : "p-4"
            }`}
          >
            <button
              type="button"
              onClick={handlePlayPause}
              aria-label={playing ? dict.pauseLabel : dict.playLabel}
              title={playing ? dict.pauseLabel : dict.playLabel}
              className={`flex flex-shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all hover:opacity-85 ${
                playerSticky ? "h-8 w-8 text-sm" : "h-10 w-10"
              }`}
            >
              <span aria-hidden="true">{playing ? "⏸" : "▶"}</span>
            </button>

            <div className="h-1.5 min-w-[100px] flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-foreground transition-[width] duration-300"
                style={{ width: `${Math.min(progress * 100, 100)}%` }}
              />
            </div>

            <div className="flex items-center gap-1">
              {READ_ALOUD_RATES.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => handleRateChange(speed)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    rate === speed
                      ? "bg-foreground text-background"
                      : "border border-black/10 text-foreground/60 hover:text-foreground dark:border-white/15"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {hasParagraphTranslation && (
        <button
          type="button"
          onClick={() => setShowTranslation((prev) => !prev)}
          className="mb-4 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground dark:border-white/15"
        >
          {showTranslation ? dict.hideTranslationButton : dict.showTranslationButton}
        </button>
      )}

      <div className="flex flex-col gap-6 text-lg leading-8 sm:text-xl sm:leading-9">
        {pageParagraphs.map((paragraph, paragraphIndex) => (
          <div
            key={pageStart + paragraphIndex}
            ref={(el) => {
              paragraphRefs.current[paragraphIndex] = el;
            }}
            className={
              resumeParagraphIndex === paragraphIndex
                ? "rounded-lg ring-2 ring-amber-400/50 ring-offset-4 ring-offset-background transition-shadow"
                : ""
            }
          >
            <p>
              {tokenizedParagraphs[paragraphIndex].map((token, tokenIndex) =>
                CYRILLIC_WORD_REGEX.test(token) ? (
                  <button
                    key={tokenIndex}
                    type="button"
                    onClick={(event) => handleWordClick(token, event)}
                    className={`rounded px-0.5 transition-colors hover:bg-foreground/10 focus:bg-foreground/10 focus:outline-none ${
                      playing && readingParagraph === paragraphIndex && readingToken === tokenIndex
                        ? "bg-amber-400/40 dark:bg-amber-400/30"
                        : ""
                    }`}
                  >
                    {token}
                  </button>
                ) : (
                  <span key={tokenIndex}>{token}</span>
                )
              )}
            </p>
            {showTranslation && pageTranslationParagraphs[paragraphIndex] && (
              <p className="mt-2 text-base leading-7 text-foreground/60 italic">
                {pageTranslationParagraphs[paragraphIndex]}
              </p>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between gap-4 border-t border-black/10 pt-6 dark:border-white/10">
          <button
            type="button"
            onClick={() => goToPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            aria-label={dict.prevPageLabel}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15"
          >
            ← {dict.prevPageLabel}
          </button>
          <span className="text-sm text-foreground/60">{pageLabelText}</span>
          <button
            type="button"
            onClick={() => goToPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            aria-label={dict.nextPageLabel}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15"
          >
            {dict.nextPageLabel} →
          </button>
        </div>
      )}

      {activeWord && popoverPosition && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            data-testid="translation-popover"
            style={{ top: popoverPosition.top, left: popoverPosition.left, width: POPOVER_WIDTH }}
            className="fixed z-50 rounded-2xl border border-black/10 bg-background p-4 shadow-xl dark:border-white/15"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium">{activeWord}</span>
                <SpeakButton text={activeWord} label={dict.wordListenLabel} />
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={dict.closeLabel}
                className="text-foreground/50 hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm text-foreground/70">
              {translation?.status === "loading" && dict.translationLoading}
              {translation?.status === "done" && translation.translation}
              {translation?.status === "error" && dict.translationError}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
