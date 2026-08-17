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
 */
function estimateWordTimings(line: SubtitleLine): TimedWord[] {
  const parts = line.ru.split(/(\s+)/).filter((part) => part.length > 0);
  const words = parts.filter((part) => !/^\s+$/.test(part));
  const totalChars = words.reduce((sum, word) => sum + word.length, 0) || 1;
  const duration = Math.max(line.end - line.start, 0.1);

  let cursor = line.start;
  let wordIndex = 0;
  return parts.map((part) => {
    if (/^\s+$/.test(part)) return { text: part, start: cursor, end: cursor };
    const share = (part.length / totalChars) * duration;
    const start = cursor;
    const end = start + share;
    cursor = end;
    wordIndex += 1;
    return { text: part, start, end };
  });
}

function CaptionLine({ line, time }: { line: SubtitleLine; time: number }) {
  const words = useMemo(() => estimateWordTimings(line), [line]);

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

  return (
    <div className="flex min-h-[6.5rem] flex-col justify-center gap-2 rounded-2xl border border-black/10 bg-foreground/[0.03] px-4 py-4 dark:border-white/10">
      {activeLine ? (
        <>
          <MemoCaptionLine line={activeLine} time={time} />
          <p className="text-balance text-center text-sm text-foreground/60">{activeLine.es}</p>
        </>
      ) : (
        <p className="text-center text-sm text-foreground/40">···</p>
      )}
    </div>
  );
}

export default memo(MediaLiveCaption);
