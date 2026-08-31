"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import SpeakButton from "@/components/lesson/SpeakButton";
import StoryAudioPlayer, { READ_ALOUD_RATES } from "@/components/stories/StoryAudioPlayer";
import { sanitizeTextForTTS } from "@/lib/speech";
import { getStoryProgress, saveStoryProgress, syncStoryProgress } from "@/lib/reading-progress";
import { buildStoryQueue, type StoryAudioSegment } from "@/lib/stories";
import {
  setNativeMediaMetadata,
  setNativePlaybackState,
  setNativeActionHandler,
  setNativeSeekToHandler,
  setNativePositionState,
} from "@/lib/native-media-session";

// Captures runs of Cyrillic letters (optionally hyphenated, e.g.
// "кто-то") as clickable tokens; everything else (spaces, punctuation)
// renders as plain text in between.
const WORD_SPLIT_REGEX = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
const CYRILLIC_WORD_REGEX = /^[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*$/u;

function tokenizeParagraph(text: string): string[] {
  return text.split(WORD_SPLIT_REGEX).filter((token) => token.length > 0);
}

/** Start offset of each token within its sentence — used to map a
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
  playLabel: string;
  pauseLabel: string;
  skipBackLabel: string;
  skipForwardLabel: string;
  seekLabel: string;
  completedBadge: string;
}

export default function StoryText({
  storyId,
  title,
  author,
  paragraphs,
  translationParagraphs,
  audioSegments,
  fullAudioUrl,
  sentenceOffsets,
  dict,
}: {
  /** Used as the localStorage key for per-story reading progress. Pass
   * `null` to disable progress tracking entirely — used for the
   * paywalled single-paragraph preview. */
  storyId: string | null;
  /** Shown on the lock screen / notification media controls via the Media
   * Session API — see the effect below. */
  title: string;
  author: string;
  paragraphs: string[];
  /** Spanish paragraphs aligned by index with `paragraphs` — rendered
   * permanently beneath each Russian paragraph (no toggle). */
  translationParagraphs?: string[];
  /** One narration clip per sentence, produced by generate-story-audio.ts.
   * Used when `fullAudioUrl` isn't available (a story concat-story-audio.ts
   * skipped — see its ELIGIBILITY note — or the paywalled preview, which
   * only ever gets per-sentence clips even for a fully-concatenated story,
   * see [id]/page.tsx). When neither this nor `fullAudioUrl` covers a
   * sentence, the reader falls back to browser TTS with no real
   * audio<->text sync. */
  audioSegments?: StoryAudioSegment[];
  /** One continuous mp3 for the whole story (concat-story-audio.ts) — the
   * preferred playback source whenever present: real background/lock-
   * screen playback (a single native <audio> element, not a chain of
   * per-sentence src swaps) and real seek/scrubbing, including on the
   * lock screen via Media Session's setPositionState. Must be paired with
   * `sentenceOffsets` covering every sentence, or it's ignored — see
   * hasFullAudio below. */
  fullAudioUrl?: string | null;
  /** Cumulative start offset (seconds) of each sentence within
   * `fullAudioUrl`, same order/length as buildStoryQueue(paragraphs) —
   * i.e. `Story.sentenceOffsetsJson`, already parsed. */
  sentenceOffsets?: number[] | null;
  dict: StoryTextDict;
}) {
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const [translation, setTranslation] = useState<TranslationState | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentenceRefs = useRef<Array<HTMLElement | null>>([]);

  const [ttsSupported, setTtsSupported] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<(typeof READ_ALOUD_RATES)[number]>(1);
  const [readingQueueIndex, setReadingQueueIndex] = useState<number | null>(null);
  const [readingToken, setReadingToken] = useState<number | null>(null);
  const [playerSticky, setPlayerSticky] = useState(false);
  // The site header is itself `sticky top-0` with a higher z-index — without
  // this offset, our sticky player would pin to the same y=0 and end up
  // hidden behind it as soon as the reader scrolls. Measured at runtime
  // (rather than a hardcoded height) since the header's height varies with
  // safe-area-inset padding on notched devices.
  const [navOffset, setNavOffset] = useState(0);
  const rateRef = useRef(rate);
  const playingRef = useRef(false);
  const pendingNextRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerSentinelRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  // Every intentional cancel (pause, word click, seek, rate change [TTS
  // mode], unmount) bumps this counter. Each utterance/clip captures the
  // counter's value when it starts; its onend/onerror only act if the
  // counter is still at that value. This replaced an earlier boolean "was
  // this a manual cancel" flag, which had to be reset back to false by the
  // very callback it was guarding — if that callback never fired, the flag
  // got stuck true and silently killed the queue after one item. A
  // monotonic counter can't get stuck: a stale utterance/clip simply never
  // matches the current generation, no reset step required.
  const playbackGenRef = useRef(0);
  // Chromium/Android has a well-known Web Speech API quirk: the first
  // speechSynthesis.speak() call after the engine has been idle clips the
  // very start of the utterance while the engine spins up — a device
  // report found exactly this ("the narrator skips the opening phrase")
  // on a free-tier story that falls back to browser TTS. Firing one
  // silent warm-up utterance immediately before the real first one (see
  // handlePlayPause) absorbs that clipped fraction of a second instead of
  // eating real content. Once per mount is enough — a new story page
  // remounts this component and gets a fresh ref, and the engine doesn't
  // go idle again just from a pause/seek within the same story.
  const ttsWarmedRef = useRef(false);

  const [isCompletedBadge, setIsCompletedBadge] = useState(false);
  const [resumeQueueIndex, setResumeQueueIndex] = useState<number | null>(null);
  const resumeQueueIndexRef = useRef<number | null>(null);
  // Timestamp (Date.now()) until which the popover's "close on scroll"
  // listener below should ignore scroll events — set right before we
  // programmatically scrollIntoView() a sentence (seek, auto-advance,
  // resume), so seeking to a word's own sentence right after opening its
  // popover doesn't immediately scroll-close it again.
  const suppressScrollCloseUntilRef = useRef(0);

  function setContainerScrollTop(container: HTMLElement, targetTop: number) {
    // A single instant write, not an eased rAF loop or CSS/native smooth
    // scroll — confirmed by direct testing that this exact page can leak a
    // sequence of scrollTop writes on this container into the outer
    // window's scroll position (the container's own box isn't always
    // fully inside the viewport — e.g. its bottom edge can sit below the
    // fold on a short mobile screen — and a RUN of scrollTop changes on it
    // gets treated like an in-progress scroll gesture bringing that box
    // into view, dragging the window along for the ride). A single
    // instant jump never reproduced it in testing, at every element
    // position tried. This trades the eased scroll animation for that
    // guarantee — an instant jump between two nearby sentences reads as a
    // small, unremarkable cut, not a jarring one.
    container.scrollTop = targetTop;
  }

  // Scrolls ONLY the reading pane, never Element.scrollIntoView() —
  // scrollIntoView walks up and animates EVERY scrollable ancestor, not
  // just the nearest one, so on this page it was also nudging the whole
  // window on every sentence auto-advance.
  function scrollSentenceIntoView(index: number) {
    const container = scrollContainerRef.current;
    const el = sentenceRefs.current[index];
    if (!container || !el) return;
    suppressScrollCloseUntilRef.current = Date.now() + 700;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const targetTop = container.scrollTop + (elRect.top - containerRect.top);
    setContainerScrollTop(container, targetTop);
  }

  const queue = useMemo(() => buildStoryQueue(paragraphs), [paragraphs]);
  const sentenceTokens = useMemo(() => queue.map((item) => tokenizeParagraph(item.text)), [queue]);

  const paragraphGroups = useMemo(() => {
    const groups: { paragraphIndex: number; queueIndexes: number[] }[] = [];
    queue.forEach((item, queueIndex) => {
      const last = groups[groups.length - 1];
      if (!last || last.paragraphIndex !== item.paragraphIndex) {
        groups.push({ paragraphIndex: item.paragraphIndex, queueIndexes: [queueIndex] });
      } else {
        last.queueIndexes.push(queueIndex);
      }
    });
    return groups;
  }, [queue]);

  const segmentUrlByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const segment of audioSegments ?? []) {
      map.set(`${segment.paragraphIndex}-${segment.sentenceIndex}`, segment.url);
    }
    return map;
  }, [audioSegments]);

  // One continuous file, the preferred mode — see fullAudioUrl's doc
  // comment above. Requires an offsets entry for every sentence in the
  // queue; a mismatch (stale data, or the paywalled preview truncating
  // `paragraphs` shorter than the full story the offsets were computed
  // against) falls through to the per-sentence/TTS modes below instead of
  // seeking into the wrong part of the file.
  const hasFullAudio = Boolean(fullAudioUrl) && sentenceOffsets != null && sentenceOffsets.length === queue.length;

  // Real narration drives playback whenever the story has ANY matching
  // per-sentence clips, not only when every single sentence does. A
  // story's text can drift out of sync with its once-generated audio (an
  // edit that splits or merges a sentence shifts every later
  // paragraphIndex-sentenceIndex key) — a real, confirmed case: 15 of 325
  // stories have a small number of sentences with no clip, the rest fully
  // covered. Requiring 100% coverage here used to throw away all of a
  // story's real audio over one missing sentence, silently downgrading
  // the whole reader to browser TTS (with no seek/skip support and much
  // less reliable pause/resume, especially on iOS Safari) — exactly what
  // real playback used to look like for those 15 stories. playSegmentAt()
  // below now narrates a missing sentence with TTS just for that one
  // sentence and hands back to real audio at the next one, so a handful
  // of gaps degrades a few sentences instead of the entire book. Only
  // relevant when hasFullAudio is false — a fully-concatenated story never
  // has a gap by construction (concat-story-audio.ts's own eligibility
  // check).
  const hasPerSentenceAudio = useMemo(
    () =>
      queue.length > 0 &&
      queue.some((item) => segmentUrlByKey.has(`${item.paragraphIndex}-${item.sentenceIndex}`)),
    [queue, segmentUrlByKey]
  );
  // "Some form of real (non-synthesized) audio is available" — drives UI
  // flags (skip buttons, media-session enablement) that don't care which
  // underlying mechanism is in play. Playback functions below always
  // check hasFullAudio first, since it takes priority whenever available.
  const hasRealAudio = hasFullAudio || hasPerSentenceAudio;
  const canPlay = hasRealAudio || ttsSupported;

  /** Largest sentence index whose offset is <= `time` — i.e. which
   * sentence `fullAudioUrl` is currently playing at that position.
   * `sentenceOffsets` is sorted ascending by construction (cumulative
   * durations), so a linear scan from the end is enough; queues are at
   * most ~60 sentences long in this library, no need for a binary search. */
  function indexAtTime(time: number): number {
    const offsets = sentenceOffsets ?? [];
    for (let i = offsets.length - 1; i >= 0; i--) {
      if (offsets[i] <= time) return i;
    }
    return 0;
  }

  // Cancels any in-flight utterance/clip and invalidates it for the queue
  // chain.
  function cancelSpeech() {
    playbackGenRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  useEffect(() => {
    // Same SSR/hydration-safe pattern as SpeakButton: start true, correct
    // right after mount so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Restore reading position on mount. A completed story reopens with just
  // the "read" badge; an in-progress one scrolls to and rings the saved
  // sentence once the queue is ready (see the effect below).
  useEffect(() => {
    if (!storyId) return;
    const stored = getStoryProgress(storyId);
    if (!stored) return;
    if (stored.isCompleted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCompletedBadge(true);
      return;
    }
    resumeQueueIndexRef.current = stored.queueIndex;
    // Runs once on mount only — storyId is stable for the lifetime of this
    // component (a different story is a full route/component remount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background reconciliation with the server copy of this story's
  // progress (if the user is logged in) — deliberately does NOT re-jump
  // the reader once rendered, even if the server turns out to have a newer
  // position from another device: that would be a jarring scroll jump
  // mid-read. It only updates localStorage so the NEXT visit already
  // reflects it.
  useEffect(() => {
    if (!storyId) return;
    syncStoryProgress();
  }, [storyId]);

  // Applies the saved sentence position once the queue is ready, then
  // scrolls it to the top of the reading pane. Self-consuming: the ref is
  // cleared right away, so this is a no-op on every later queue change.
  useEffect(() => {
    const idx = resumeQueueIndexRef.current;
    resumeQueueIndexRef.current = null;
    if (idx === null || idx < 0 || idx >= queue.length) return;
    setResumeQueueIndex(idx);
    requestAnimationFrame(() => scrollSentenceIntoView(idx));
  }, [queue]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Audio -> text sync: whenever the active sentence changes (auto-advance
  // during playback, a manual seek, or the resume-position restore above),
  // keep it pinned to the top of the scroll container.
  useEffect(() => {
    if (readingQueueIndex === null) return;
    scrollSentenceIntoView(readingQueueIndex);
  }, [readingQueueIndex]);

  // Stop any in-flight narration when the reader navigates away.
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (pendingNextRef.current) clearTimeout(pendingNextRef.current);
      playbackGenRef.current += 1;
      cancelSpeech();
      audio?.pause();
    };
  }, []);

  useEffect(() => {
    const header = document.querySelector("header");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (header) setNavOffset(header.getBoundingClientRect().height);
  }, []);

  // hasFullAudio mode: the <audio> element's `src` is set exactly once
  // here (never reassigned by a play/seek/click handler, unlike the
  // per-sentence chain's playSegmentAt()) — it's the same physical file
  // for the whole story, so there's nothing to swap. `timeupdate` maps
  // the element's real playback position back to a sentence index via
  // indexAtTime(), which is what drives the highlight/scroll/Media
  // Session position sync during playback; `ended` marks the story
  // complete, mirroring playSegmentAt()'s own end-of-queue handling.
  useEffect(() => {
    if (!hasFullAudio || !fullAudioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.src !== fullAudioUrl) audio.src = fullAudioUrl;

    const handleTimeUpdate = () => {
      const index = indexAtTime(audio.currentTime);
      setReadingQueueIndex((prev) => {
        if (prev === index) return prev;
        // Only on an actual sentence change, not every ~250ms timeupdate
        // tick — mirrors playSegmentAt()'s per-advance bookkeeping.
        setResumeQueueIndex(null);
        setIsCompletedBadge(false);
        if (storyId) saveStoryProgress(storyId, { currentPage: index + 1, totalPages: queue.length, queueIndex: index });
        return index;
      });
    };
    const handleEnded = () => {
      setPlaying(false);
      setReadingQueueIndex(null);
    };
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFullAudio, fullAudioUrl]);

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
  // keeps the queue alive for arbitrarily long stories. Only relevant to
  // the browser-TTS fallback — real <audio> playback has no such bug.
  useEffect(() => {
    if (!playing || hasRealAudio) return;
    const keepAlive = setInterval(() => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 5000);
    return () => clearInterval(keepAlive);
  }, [playing, hasRealAudio]);

  /** url -> duration in seconds, filled in as clips are actually played
   * (see the `loadedmetadata` handler below) or explicitly probed by
   * getClipDuration() when a ±15s skip needs to know a clip it hasn't
   * played yet. */
  const clipDurationCacheRef = useRef<Map<string, number>>(new Map());

  function cacheClipDuration(url: string, duration: number) {
    if (Number.isFinite(duration) && duration > 0) clipDurationCacheRef.current.set(url, duration);
  }

  /** Resolves a clip's duration without playing it — used by skipBy() to
   * walk across sentence boundaries. Falls back to a rough 3s guess if the
   * probe errors or takes too long, so a flaky/slow load can't hang the
   * skip button forever. */
  function getClipDuration(url: string): Promise<number> {
    const cached = clipDurationCacheRef.current.get(url);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve) => {
      const probe = new Audio();
      let settled = false;
      const finish = (value: number) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        const duration = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 3;
        cacheClipDuration(url, duration);
        finish(duration);
      };
      probe.onerror = () => finish(3);
      probe.src = url;
      setTimeout(() => finish(3), 4000);
    });
  }

  /** URLs already handed to the browser's own network/HTTP cache via
   * preloadSegment() below — a plain Set is enough since we only ever need
   * "have we already kicked this off", never to cancel it. */
  const preloadedUrlsRef = useRef<Set<string>>(new Set());

  /** Each real-audio sentence is a separate small file (a few seconds), so
   * every auto-advance in playSegmentAt() below needs a fresh network
   * fetch — on a real connection (not localhost) that fetch is exactly
   * what reads as "the story restarts": a silent stall between sentences
   * while the next clip downloads. Kicking off that fetch one sentence
   * ahead of time (while the current one is still playing) means it's
   * already sitting in the browser's HTTP cache by the time onended fires
   * below, so the `audio.load()` there resolves instantly instead of
   * stalling. A throwaway in-memory Audio object is enough to trigger the
   * fetch — it's never attached to the DOM or played.
   */
  function preloadSegment(index: number) {
    const item = queue[index];
    if (!item) return;
    const url = segmentUrlByKey.get(`${item.paragraphIndex}-${item.sentenceIndex}`);
    if (!url || preloadedUrlsRef.current.has(url)) return;
    preloadedUrlsRef.current.add(url);
    const preload = new Audio();
    preload.preload = "auto";
    preload.src = url;
  }

  /** Narrates a single sentence with browser TTS (no real clip for it —
   * see hasRealAudio's comment) and hands back to playSegmentAt() for the
   * next index once it ends, so the gap costs one sentence's worth of
   * synthesized voice instead of derailing the rest of the real-audio
   * queue. Mirrors speakQueueAt()'s onboundary/onend/onerror wiring
   * (word-highlight during the utterance, generation-guarded chaining) —
   * kept separate rather than reused because speakQueueAt() also owns the
   * TTS-only playback mode's own state (setReadingToken(null) up front,
   * etc.) that doesn't apply here. */
  function speakGapSentenceThenAdvance(index: number, generation: number) {
    const item = queue[index];
    const advance = () => {
      if (playbackGenRef.current !== generation) return;
      const next = index + 1;
      if (next < queue.length) {
        playSegmentAt(next);
      } else {
        setPlaying(false);
        setReadingQueueIndex(null);
        setReadingToken(null);
      }
    };

    if (!item || typeof window === "undefined" || !("speechSynthesis" in window)) {
      advance();
      return;
    }

    setReadingQueueIndex(index);
    setReadingToken(null);
    setResumeQueueIndex(null);
    setIsCompletedBadge(false);
    if (storyId) saveStoryProgress(storyId, { currentPage: index + 1, totalPages: queue.length, queueIndex: index });

    const utterance = new SpeechSynthesisUtterance(sanitizeTextForTTS(item.text));
    utterance.lang = "ru-RU";
    utterance.rate = rateRef.current;
    utterance.onboundary = (event) => {
      const tokens = sentenceTokens[index];
      const starts = tokenStarts(tokens);
      const tokenIndex = tokenIndexAtChar(tokens, starts, event.charIndex);
      setReadingToken(tokenIndex);
    };
    utterance.onend = advance;
    utterance.onerror = (event) => {
      if (playbackGenRef.current !== generation) return;
      console.error("[StoryText audio] gap-sentence TTS error:", event.error);
      advance();
    };
    window.speechSynthesis.speak(utterance);
  }

  /** `startOffset` seconds into the clip — used by skipBy() when a ±15s
   * skip lands mid-sentence rather than at its start. */
  function playSegmentAt(index: number, startOffset = 0) {
    const item = queue[index];
    if (!item) {
      setPlaying(false);
      setReadingQueueIndex(null);
      return;
    }
    const generation = playbackGenRef.current;
    const audio = audioRef.current;
    const url = segmentUrlByKey.get(`${item.paragraphIndex}-${item.sentenceIndex}`);
    if (!url || !audio) {
      speakGapSentenceThenAdvance(index, generation);
      return;
    }
    setReadingQueueIndex(index);
    setResumeQueueIndex(null);
    setIsCompletedBadge(false);
    if (hasPerSentenceAudio) preloadSegment(index + 1);
    if (storyId) saveStoryProgress(storyId, { currentPage: index + 1, totalPages: queue.length, queueIndex: index });

    audio.pause();
    audio.src = url;
    // Explicit load() after reassigning src: setting .src alone is
    // supposed to trigger this per spec, but on several Android
    // Chrome/WebView builds an element that just fired `ended` and gets a
    // new `src` synchronously (as happens on every auto-advance below)
    // can be left in a stale readyState that makes the immediate play()
    // call below reject — reliably enough to be the leading real-world
    // explanation for "plays the first sentence, then silently stops" on
    // Android specifically. load() forces a clean reset before play().
    audio.load();
    audio.playbackRate = rateRef.current;
    audio.onloadedmetadata = () => {
      cacheClipDuration(url, audio.duration);
      if (startOffset > 0) audio.currentTime = Math.min(startOffset, audio.duration || startOffset);
    };
    audio.onended = () => {
      if (playbackGenRef.current !== generation) return;
      const next = index + 1;
      if (next < queue.length) {
        playSegmentAt(next);
      } else {
        setPlaying(false);
        setReadingQueueIndex(null);
      }
    };
    audio.onerror = () => {
      if (playbackGenRef.current !== generation) return;
      console.error("[StoryText audio] playback error for", url);
      setPlaying(false);
    };
    // The auto-advance case (index > 0, no fresh user gesture) is where a
    // rejected play() previously failed completely silently — the catch
    // below swallowed it with no log line and no retry, which is exactly
    // why this bug shipped invisibly: nothing in the console pointed at
    // it. Now it retries once after a tick (some Android builds need a
    // moment to settle after load() before play() succeeds) and always
    // logs if it still fails, so a real device report is debuggable
    // instead of a mystery "it just stops."
    audio.play().catch((err) => {
      if (playbackGenRef.current !== generation) return;
      // AbortError specifically means this exact play() call was
      // interrupted by a pause()/new src before it resolved — the
      // browser's normal, always-benign signal for "something else took
      // over," not a playback failure. Retrying it would either no-op or
      // race whatever caused the interruption, so it's excluded from both
      // the log and the retry below; every other rejection reason still
      // gets both, unchanged.
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[StoryText audio] play() rejected for", url, err);
      window.setTimeout(() => {
        if (playbackGenRef.current !== generation) return;
        audio.play().catch((retryErr) => {
          if (playbackGenRef.current !== generation) return;
          if (retryErr instanceof DOMException && retryErr.name === "AbortError") return;
          console.error("[StoryText audio] retry also rejected for", url, retryErr);
          setPlaying(false);
        });
      }, 150);
    });
  }

  /** ±15s skip when a single `fullAudioUrl` is playing — trivial compared
   * to the per-sentence version below, since there's one real seekable
   * timeline instead of a chain of separate clips to walk across. */
  function skipByFull(deltaSeconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Infinity;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + deltaSeconds), duration);
  }

  /** ±15s skip, correctly crossing sentence boundaries (each clip is one
   * sentence, commonly just a few seconds — so 15s of real audio almost
   * always spans several of them). Walks the queue accumulating each
   * crossed clip's actual duration until `deltaSeconds` is used up, then
   * seeks into whichever sentence that lands on and re-syncs the
   * highlight/scroll there — same as any other seek. Per-sentence mode
   * only (no `fullAudioUrl`): speechSynthesis has no seekable timeline to
   * walk, and skipBy() below routes a fullAudioUrl story to
   * skipByFull() instead of this function entirely. */
  async function skipByPerSentence(deltaSeconds: number) {
    if (!hasPerSentenceAudio || readingQueueIndex === null) return;
    const audio = audioRef.current;
    const currentItem = queue[readingQueueIndex];
    const currentUrl = currentItem
      ? segmentUrlByKey.get(`${currentItem.paragraphIndex}-${currentItem.sentenceIndex}`)
      : undefined;
    if (!audio || !currentUrl) return;

    const currentDuration =
      Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : await getClipDuration(currentUrl);

    if (deltaSeconds > 0) {
      const available = currentDuration - audio.currentTime;
      if (deltaSeconds <= available) {
        audio.currentTime += deltaSeconds;
        return;
      }
      let remaining = deltaSeconds - available;
      for (let index = readingQueueIndex + 1; index < queue.length; index++) {
        const item = queue[index];
        const url = segmentUrlByKey.get(`${item.paragraphIndex}-${item.sentenceIndex}`);
        if (!url) break;
        const duration = await getClipDuration(url);
        if (remaining <= duration) {
          setPlaying(true);
          playSegmentAt(index, remaining);
          return;
        }
        remaining -= duration;
      }
      setPlaying(true);
      playSegmentAt(queue.length - 1);
    } else {
      const backAmount = -deltaSeconds;
      if (backAmount <= audio.currentTime) {
        audio.currentTime -= backAmount;
        return;
      }
      let remaining = backAmount - audio.currentTime;
      for (let index = readingQueueIndex - 1; index >= 0; index--) {
        const item = queue[index];
        const url = segmentUrlByKey.get(`${item.paragraphIndex}-${item.sentenceIndex}`);
        if (!url) break;
        const duration = await getClipDuration(url);
        if (remaining <= duration) {
          setPlaying(true);
          playSegmentAt(index, Math.max(0, duration - remaining));
          return;
        }
        remaining -= duration;
      }
      setPlaying(true);
      playSegmentAt(0);
    }
  }

  function skipBy(deltaSeconds: number) {
    if (hasFullAudio) {
      skipByFull(deltaSeconds);
      return;
    }
    void skipByPerSentence(deltaSeconds);
  }

  function speakQueueAt(index: number) {
    const item = queue[index];
    if (!item) {
      setPlaying(false);
      setReadingQueueIndex(null);
      setReadingToken(null);
      return;
    }
    // This utterance belongs to the current playback generation. If a
    // cancel happens later (pause, word click, seek, rate change,
    // unmount), playbackGenRef moves on and this closure's `generation`
    // goes stale — its onend/onerror then know to no-op instead of
    // continuing the chain.
    const generation = playbackGenRef.current;
    setReadingQueueIndex(index);
    setReadingToken(null);
    setResumeQueueIndex(null);
    setIsCompletedBadge(false);
    if (storyId) saveStoryProgress(storyId, { currentPage: index + 1, totalPages: queue.length, queueIndex: index });

    const utterance = new SpeechSynthesisUtterance(sanitizeTextForTTS(item.text));
    utterance.lang = "ru-RU";
    utterance.rate = rateRef.current;
    utterance.onboundary = (event) => {
      const tokens = sentenceTokens[index];
      const starts = tokenStarts(tokens);
      const tokenIndex = tokenIndexAtChar(tokens, starts, event.charIndex);
      setReadingToken(tokenIndex);
    };
    utterance.onend = () => {
      if (playbackGenRef.current !== generation) return;
      const next = index + 1;
      if (next < queue.length) {
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
        setReadingQueueIndex(null);
        setReadingToken(null);
      }
    };
    utterance.onerror = (event) => {
      if (playbackGenRef.current !== generation) {
        // Expected: this utterance was cancelled by our own cancelSpeech()
        // (rate change, word click, seek, pause, unmount).
        return;
      }
      console.error("[StoryText TTS] speechSynthesis error:", event.error);
      setPlaying(false);
    };
    window.speechSynthesis.speak(utterance);
  }

  function handlePlayPause() {
    if (queue.length === 0) return;
    if (hasFullAudio) {
      const audio = audioRef.current;
      if (!audio) return;
      if (playing) {
        audio.pause();
        setPlaying(false);
        return;
      }
      setPlaying(true);
      audio.play().catch(() => setPlaying(false));
      return;
    }
    if (hasPerSentenceAudio) {
      const audio = audioRef.current;
      if (!audio) return;
      if (playing) {
        audio.pause();
        setPlaying(false);
        return;
      }
      if (readingQueueIndex !== null && !audio.ended && audio.currentTime > 0) {
        setPlaying(true);
        audio.play().catch(() => setPlaying(false));
        return;
      }
      const startIndex = readingQueueIndex !== null && readingQueueIndex < queue.length - 1 ? readingQueueIndex : 0;
      setPlaying(true);
      playSegmentAt(startIndex);
      return;
    }

    if (!ttsSupported) return;
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
    const startIndex = readingQueueIndex !== null && readingQueueIndex < queue.length - 1 ? readingQueueIndex : 0;
    setPlaying(true);
    if (!ttsWarmedRef.current) {
      ttsWarmedRef.current = true;
      // Silent warm-up utterance, fired synchronously in the same click
      // gesture right before the real one — see ttsWarmedRef's comment.
      const warmup = new SpeechSynthesisUtterance(" ");
      warmup.volume = 0;
      window.speechSynthesis.speak(warmup);
    }
    speakQueueAt(startIndex);
  }

  function handleRateChange(nextRate: (typeof READ_ALOUD_RATES)[number]) {
    setRate(nextRate);
    rateRef.current = nextRate;
    if (hasRealAudio) {
      if (audioRef.current) audioRef.current.playbackRate = nextRate;
      return;
    }
    if (playing && readingQueueIndex !== null) {
      cancelSpeech();
      speakQueueAt(readingQueueIndex);
    }
  }

  // Text -> audio sync: clicking a sentence seeks playback straight to it.
  function handleSentenceClick(index: number) {
    if (!canPlay || queue.length === 0) return;
    if (hasFullAudio) {
      const audio = audioRef.current;
      const offset = sentenceOffsets?.[index];
      if (!audio || offset === undefined) return;
      audio.currentTime = offset;
      setReadingQueueIndex(index);
      setResumeQueueIndex(null);
      setIsCompletedBadge(false);
      if (storyId) saveStoryProgress(storyId, { currentPage: index + 1, totalPages: queue.length, queueIndex: index });
      setPlaying(true);
      audio.play().catch(() => setPlaying(false));
      return;
    }
    if (hasPerSentenceAudio) {
      setPlaying(true);
      playSegmentAt(index);
      return;
    }
    cancelSpeech();
    setPlaying(true);
    speakQueueAt(index);
  }

  function handleSentenceKeyDown(event: ReactKeyboardEvent, index: number) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSentenceClick(index);
  }

  // Lock-screen / notification media controls, and the signal mobile
  // browsers use to decide a backgrounded tab's audio should keep playing
  // instead of being suspended — this is what "background playback" (play
  // with the app minimized or the screen locked) actually runs on, there's
  // no separate "enable background mode" switch to flip.
  //
  // This used to be ONE effect with no dependency array, so that the
  // handlers always closed over the latest playback state. That worked,
  // and it also meant the effect's CLEANUP ran before every single render:
  // each render set all seven action handlers to null, reassigned
  // `metadata`, and put the handlers back. The OS rebuilds its
  // notification / lock-screen player when either of those happens, and
  // that is what the owner saw on a phone on 30.08.2026 — the rewind
  // button on the pulled-down player blinking on and off for the whole
  // story. Measured on production before the fix, over 15s of playback:
  // metadata reassigned 4×, and every one of the seven handlers removed
  // and re-added 4× (once per sentence advance); after it, 1 and 1.
  //
  // The split below keeps what the no-deps version was buying and drops
  // what it was costing. The registered function is stable; it reads the
  // current implementation out of a ref when the OS calls it, so the
  // handlers still see the latest state without being re-registered.
  const mediaActionsRef = useRef<{
    play: () => void;
    pause: () => void;
    seekBackward: () => void;
    seekForward: () => void;
    previousTrack: () => void;
    nextTrack: () => void;
    seekTo: (seekTime: number) => void;
  }>({
    play: () => {},
    pause: () => {},
    seekBackward: () => {},
    seekForward: () => {},
    previousTrack: () => {},
    nextTrack: () => {},
    seekTo: () => {},
  });

  // No dependency array on purpose — this one is meant to run every
  // render, and it is now the ONLY thing that does. It writes to a ref and
  // touches no browser or OS state, so re-running it rebuilds nothing.
  useEffect(() => {
    mediaActionsRef.current = {
      play: () => handlePlayPause(),
      pause: () => handlePlayPause(),
      seekBackward: () => skipBy(-15),
      seekForward: () => skipBy(15),
      previousTrack: () => handleSentenceClick(Math.max(0, (readingQueueIndex ?? 0) - 1)),
      nextTrack: () => handleSentenceClick(Math.min(queue.length - 1, (readingQueueIndex ?? 0) + 1)),
      seekTo: (seekTime: number) => {
        const audioEl = audioRef.current;
        if (audioEl) audioEl.currentTime = seekTime;
      },
    };
  });

  const hasMediaSessionTarget = canPlay && queue.length > 0;

  // Handlers: registered once per (can we play at all, is there a
  // seekable timeline) and left alone after that.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!hasMediaSessionTarget) return;
    const ms = navigator.mediaSession;

    const play = () => mediaActionsRef.current.play();
    const pause = () => mediaActionsRef.current.pause();
    const seekBackward = () => mediaActionsRef.current.seekBackward();
    const seekForward = () => mediaActionsRef.current.seekForward();
    const previousTrack = () => mediaActionsRef.current.previousTrack();
    const nextTrack = () => mediaActionsRef.current.nextTrack();

    ms.setActionHandler("play", play);
    ms.setActionHandler("pause", pause);
    ms.setActionHandler("seekbackward", seekBackward);
    ms.setActionHandler("seekforward", seekForward);
    ms.setActionHandler("previoustrack", previousTrack);
    ms.setActionHandler("nexttrack", nextTrack);
    // Real lock-screen scrubbing — only possible with one genuine seekable
    // timeline (fullAudioUrl); the per-sentence chain has no single
    // duration to report and speechSynthesis has no timeline at all, so
    // neither of those modes offers this action.
    ms.setActionHandler(
      "seekto",
      hasFullAudio
        ? (details) => {
            if (details.seekTime == null) return;
            mediaActionsRef.current.seekTo(details.seekTime);
          }
        : null
    );

    // Native half of the above — a no-op on web (see native-media-session.ts).
    // Android's System WebView, unlike Chrome, doesn't surface
    // navigator.mediaSession as a real OS notification/lock-screen player
    // on its own; this drives the same handlers through
    // @capgo/capacitor-media-session so the native shell gets one too.
    void setNativeActionHandler("play", play);
    void setNativeActionHandler("pause", pause);
    void setNativeActionHandler("seekbackward", seekBackward);
    void setNativeActionHandler("seekforward", seekForward);
    void setNativeActionHandler("previoustrack", previousTrack);
    void setNativeActionHandler("nexttrack", nextTrack);
    void setNativeSeekToHandler(hasFullAudio ? (seekTime) => mediaActionsRef.current.seekTo(seekTime) : null);

    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("seekbackward", null);
      ms.setActionHandler("seekforward", null);
      ms.setActionHandler("previoustrack", null);
      ms.setActionHandler("nexttrack", null);
      ms.setActionHandler("seekto", null);
      void setNativeActionHandler("play", null);
      void setNativeActionHandler("pause", null);
      void setNativeActionHandler("seekbackward", null);
      void setNativeActionHandler("seekforward", null);
      void setNativeActionHandler("previoustrack", null);
      void setNativeActionHandler("nexttrack", null);
      void setNativeSeekToHandler(null);
    };
  }, [hasMediaSessionTarget, hasFullAudio]);

  // Metadata: only when the story itself changes. Reassigning it is what
  // makes the OS re-read the artwork.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!hasMediaSessionTarget) return;
    const artwork = [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }];
    // Mutating the browser's global MediaSession object is the API's only
    // interface — it's namespaced under `navigator` rather than a
    // local/ref.
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: author, artwork });
    void setNativeMediaMetadata({ title, artist: author, artwork });
  }, [hasMediaSessionTarget, title, author]);

  // Playback state: only when it actually flips.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!hasMediaSessionTarget) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    void setNativePlaybackState(playing);
  }, [hasMediaSessionTarget, playing]);

  // Position: this one genuinely has to follow playback, and unlike the
  // two above it does not rebuild anything — it updates the scrubber the
  // OS already drew.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!hasMediaSessionTarget || !hasFullAudio) return;
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (!Number.isFinite(audioEl.duration) || audioEl.duration <= 0) return;
    const state = {
      duration: audioEl.duration,
      playbackRate: rate,
      position: Math.min(audioEl.currentTime, audioEl.duration),
    };
    navigator.mediaSession.setPositionState(state);
    void setNativePositionState(state);
  }, [hasMediaSessionTarget, hasFullAudio, playing, rate, readingQueueIndex]);

  const progress =
    queue.length > 0 && readingQueueIndex !== null ? (readingQueueIndex + 1) / queue.length : 0;

  async function handleWordClick(word: string, wordEl: HTMLElement) {
    const rect = wordEl.getBoundingClientRect();
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
    const container = scrollContainerRef.current;
    const handleScroll = () => {
      if (Date.now() < suppressScrollCloseUntilRef.current) return;
      close();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    container?.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      container?.removeEventListener("scroll", handleScroll);
    };
  }, [activeWord]);

  return (
    <div>
      {isCompletedBadge && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <span aria-hidden="true">✓</span> {dict.completedBadge}
        </div>
      )}

      {hasRealAudio && <audio ref={audioRef} preload={hasFullAudio ? "metadata" : "none"} className="hidden" />}

      {canPlay && queue.length > 0 && (
        <>
          <div ref={playerSentinelRef} />
          <StoryAudioPlayer
            dict={dict}
            navOffset={navOffset}
            sticky={playerSticky}
            hasRealAudio={hasRealAudio}
            playing={playing}
            progress={progress}
            rate={rate}
            queueLength={queue.length}
            readingQueueIndex={readingQueueIndex}
            onSkipBack={() => skipBy(-15)}
            onSkipForward={() => skipBy(15)}
            onPlayPause={handlePlayPause}
            onSeek={handleSentenceClick}
            onRateChange={handleRateChange}
          />
        </>
      )}

      <div
        ref={scrollContainerRef}
        // overscroll-contain: without it, a *programmatic* scrollTo() on
        // this container (our own scrollSentenceIntoView(), called on
        // every sentence auto-advance) was also chaining into the outer
        // page scroll — moving the window even though only this inner
        // pane should move. That stray window scroll is what made the
        // `position: sticky` player jitter/flicker during playback: its
        // pinned position tracks window scroll, so it was fighting our
        // own auto-scroll every single sentence.
        className="flex max-h-[70dvh] flex-col gap-6 overflow-y-auto overscroll-contain rounded-2xl border border-black/10 p-4 text-lg leading-8 dark:border-white/30 sm:max-h-[75dvh] sm:p-6 sm:text-xl sm:leading-9"
      >
        {paragraphGroups.map((group) => (
          <div key={group.paragraphIndex}>
            <p>
              {group.queueIndexes.map((queueIndex) => (
                <span
                  key={queueIndex}
                  ref={(el) => {
                    sentenceRefs.current[queueIndex] = el;
                  }}
                  role={canPlay ? "button" : undefined}
                  tabIndex={canPlay ? 0 : undefined}
                  // A tabIndex=0 element gets the browser's own native
                  // "scroll the newly-focused element into view" on click —
                  // separate from and in addition to our own
                  // scrollSentenceIntoView() call, and just as prone to
                  // cascading into a window-level scroll. Suppressing focus
                  // on mousedown (mouse/touch only, Tab-key focus is
                  // unaffected) avoids that duplicate, competing scroll —
                  // this was the other half of the sticky-player jitter.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event: ReactMouseEvent<HTMLElement>) => {
                    // Word buttons below deliberately carry no onClick of
                    // their own (see their comment) — with hundreds of
                    // Cyrillic words in a long story, giving each one its
                    // own React click prop measurably adds to hydration
                    // cost (Lighthouse TBT), so the popover lookup is
                    // handled here instead, via one delegated listener per
                    // sentence, matched back to the specific word element
                    // that was actually clicked.
                    const wordEl = (event.target as HTMLElement).closest<HTMLElement>("button[data-word]");
                    if (wordEl?.dataset.word) void handleWordClick(wordEl.dataset.word, wordEl);
                    handleSentenceClick(queueIndex);
                  }}
                  onKeyDown={(event) => handleSentenceKeyDown(event, queueIndex)}
                  className={`rounded transition-colors ${canPlay ? "tap cursor-pointer hover:bg-foreground/5 active:bg-foreground/5" : ""} ${
                    readingQueueIndex === queueIndex ? "bg-amber-400/20 dark:bg-amber-400/10" : ""
                  } ${
                    resumeQueueIndex === queueIndex
                      ? "ring-2 ring-amber-400/50 ring-offset-4 ring-offset-background"
                      : ""
                  }`}
                >
                  {sentenceTokens[queueIndex].map((token, tokenIndex) =>
                    CYRILLIC_WORD_REGEX.test(token) ? (
                      // No onClick prop here on purpose — see the wrapping
                      // sentence <span>'s onClick, which delegates word
                      // clicks via this data attribute instead of every
                      // single word registering its own React click
                      // handler (hundreds per long story).
                      <button
                        key={tokenIndex}
                        type="button"
                        data-word={token}
                        className={`tap rounded px-0.5 transition-colors hover:bg-foreground/10 focus:bg-foreground/10 active:bg-foreground/10 focus:outline-none ${
                          playing && readingQueueIndex === queueIndex && readingToken === tokenIndex
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
                </span>
              ))}
            </p>
            {translationParagraphs?.[group.paragraphIndex] && (
              <p className="mt-2 text-base leading-7 text-foreground/60 italic">
                {translationParagraphs[group.paragraphIndex]}
              </p>
            )}
          </div>
        ))}
      </div>

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
                className="tap text-foreground/50 hover:text-foreground active:text-foreground"
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
