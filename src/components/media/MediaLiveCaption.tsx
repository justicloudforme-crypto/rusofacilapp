"use client";

import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SubtitleLine } from "@/lib/video-lesson/types";
import type { YouTubePlayerHandle } from "@/components/video-lesson/YouTubePlayer";

interface TimedWord {
  text: string;
  start: number;
  end: number;
}

function findActiveLine(subtitles: SubtitleLine[], time: number): SubtitleLine | null {
  for (const line of subtitles) {
    if (time >= line.start && time <= line.end) return line;
  }
  return null;
}

/**
 * We only have line-level timestamps, not per-word ones. Estimate word
 * boundaries by splitting the line's duration proportionally to each
 * word's character length — long words "get" more time than short ones,
 * which tracks real speech closely enough for a karaoke-style highlight.
 * Takes the actual spoken text directly (not the SubtitleLine) so it works
 * for both a Russian example line and a Spanish narration line — whichever
 * one is the real speech for that segment (see CaptionLine below).
 */
function estimateWordTimings(text: string, start: number, end: number): TimedWord[] {
  const parts = text.split(/(\s+)/).filter((part) => part.length > 0);
  const words = parts.filter((part) => !/^\s+$/.test(part));
  const totalChars = words.reduce((sum, word) => sum + word.length, 0) || 1;
  const duration = Math.max(end - start, 0.1);

  let cursor = start;
  return parts.map((part) => {
    if (/^\s+$/.test(part)) return { text: part, start: cursor, end: cursor };
    const share = (part.length / totalChars) * duration;
    const wordStart = cursor;
    const wordEnd = wordStart + share;
    cursor = wordEnd;
    return { text: part, start: wordStart, end: wordEnd };
  });
}

/**
 * Word-by-word karaoke highlight for whichever text is the ACTUAL spoken
 * content of this segment — the Russian example when there is one, or the
 * teacher's Spanish narration when there isn't (see REGLA ABSOLUTA 2 in
 * generateSubtitlesWithClaude.ts). Highlighting only the Russian half and
 * leaving Spanish narration as static text would mean most of a grammar
 * video (which is mostly Spanish explanation) never highlights at all —
 * this makes every currently-spoken word highlighted, in either language.
 */
function CaptionLine({ text, start, end, time }: { text: string; start: number; end: number; time: number }) {
  const words = useMemo(() => estimateWordTimings(text, start, end), [text, start, end]);

  return (
    <p className="text-balance text-center text-lg font-medium leading-relaxed sm:text-xl">
      {words.map((word, index) => {
        if (/^\s+$/.test(word.text)) return <Fragment key={index}>{word.text}</Fragment>;
        const isSpoken = time >= word.start && time <= word.end;
        return (
          <span
            key={index}
            className={
              isSpoken
                ? "rounded bg-amber-400/90 px-0.5 text-black dark:bg-amber-300"
                : "text-foreground"
            }
          >
            {word.text}
          </span>
        );
      })}
    </p>
  );
}

const MemoCaptionLine = memo(CaptionLine);

/**
 * A fixed-position "now playing" caption bar, distinct from the scrollable
 * full transcript below it. Never reflows or scrolls the page — it always
 * occupies the same spot right under the video, with the actively-spoken
 * word highlighted. Russian on top, Spanish translation underneath, per
 * the site's standing subtitle convention.
 */
function MediaLiveCaption({
  subtitles,
  playerRef,
}: {
  subtitles: SubtitleLine[];
  playerRef: RefObject<YouTubePlayerHandle | null>;
}) {
  const [activeLine, setActiveLine] = useState<SubtitleLine | null>(null);
  const [time, setTime] = useState(0);
  const activeLineIdRef = useRef<string | null>(null);

  useEffect(() => {
    let frameId: number;

    function tick() {
      const currentTime = playerRef.current?.getCurrentTime() ?? 0;
      const line = findActiveLine(subtitles, currentTime);
      if (line?.id !== activeLineIdRef.current) {
        activeLineIdRef.current = line?.id ?? null;
        setActiveLine(line);
      }
      setTime(currentTime);
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [subtitles, playerRef]);

  if (subtitles.length === 0) return null;

  // Bilingual grammar-explainer subtitles include narration-only lines
  // (the teacher's Spanish explanation, no Russian at all — see
  // generateSubtitlesWithClaude.ts's REGLA ABSOLUTA 2). The spoken text to
  // highlight is `ru` when there is one, `es` otherwise — never both, and
  // never neither (the schema guarantees `es` is non-empty either way).
  const isNarrationOnly = Boolean(activeLine) && activeLine!.ru.trim().length === 0;
  const spokenText = activeLine ? (isNarrationOnly ? activeLine.es : activeLine.ru) : "";

  return (
    <div className="flex min-h-[6.5rem] flex-col justify-center gap-2 rounded-2xl border border-black/10 bg-foreground/[0.03] px-4 py-4 dark:border-white/30">
      {activeLine ? (
        isNarrationOnly ? (
          <MemoCaptionLine text={spokenText} start={activeLine.start} end={activeLine.end} time={time} />
        ) : (
          <>
            <MemoCaptionLine text={spokenText} start={activeLine.start} end={activeLine.end} time={time} />
            <p className="text-balance text-center text-sm text-foreground/60">{activeLine.es}</p>
          </>
        )
      ) : (
        <p className="text-center text-sm text-foreground/40">···</p>
      )}
    </div>
  );
}

export default memo(MediaLiveCaption);
