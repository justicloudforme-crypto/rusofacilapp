"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SubtitleLine, WordGloss } from "@/lib/video-lesson/types";
import { normalizeToken } from "@/lib/video-lesson/normalizeToken";
import WordTooltip from "./WordTooltip";
import type { YouTubePlayerHandle } from "./YouTubePlayer";

function findActiveLineId(subtitles: SubtitleLine[], time: number): string | null {
  for (const line of subtitles) {
    if (time >= line.start && time <= line.end) return line.id;
  }
  return null;
}

function SubtitleLineRow({
  line,
  isActive,
  glossary,
  openWord,
  onToggleWord,
  onSeek,
}: {
  line: SubtitleLine;
  isActive: boolean;
  glossary: Record<string, WordGloss>;
  openWord: string | null;
  onToggleWord: (wordId: string) => void;
  onSeek: (line: SubtitleLine) => void;
}) {
  const tokens = useMemo(() => line.ru.split(/(\s+)/), [line.ru]);

  return (
    <div
      data-line-id={line.id}
      role="button"
      tabIndex={0}
      onClick={() => onSeek(line)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSeek(line);
        }
      }}
      className={`flex cursor-pointer flex-col gap-1 rounded-xl px-3 py-2 text-left transition-colors hover:bg-foreground/5 ${
        isActive ? "bg-foreground/10" : ""
      }`}
    >
      <p className={`leading-relaxed ${isActive ? "text-base font-medium" : "text-sm text-foreground/70"}`}>
        {tokens.map((token, index) => {
          if (/^\s+$/.test(token)) return <Fragment key={index}>{token}</Fragment>;

          const key = normalizeToken(token);
          const gloss = key ? glossary[key] : undefined;
          const wordId = `${line.id}-${index}`;

          if (!gloss) return <Fragment key={index}>{token}</Fragment>;

          return (
            <span key={index} className="relative inline-block">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleWord(wordId);
                }}
                className="rounded px-0.5 underline decoration-dotted decoration-2 underline-offset-4 transition-colors hover:bg-foreground/10"
              >
                {token}
              </button>
              {openWord === wordId && <WordTooltip gloss={gloss} onClose={() => onToggleWord(wordId)} />}
            </span>
          );
        })}
      </p>
      <p className={`text-sm ${isActive ? "text-foreground/80" : "text-foreground/50"}`}>{line.es}</p>
    </div>
  );
}

const MemoSubtitleLineRow = memo(SubtitleLineRow);

/**
 * Fully self-contained: reads the player's time itself (via `playerRef`,
 * an imperative handle — no React state passed down from an ancestor) and
 * only calls its own local `setState` when the active line actually
 * changes. A parent rendering this component never re-renders because of
 * playback — only this subtree does, and only once per line change instead
 * of on every poll tick.
 */
function SubtitleTrack({
  subtitles,
  glossary = {},
  playerRef,
}: {
  subtitles: SubtitleLine[];
  glossary?: Record<string, WordGloss>;
  playerRef: RefObject<YouTubePlayerHandle | null>;
}) {
  const [openWord, setOpenWord] = useState<string | null>(null);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const activeLineIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frameId: number;

    function tick() {
      const time = playerRef.current?.getCurrentTime() ?? 0;
      const matchId = findActiveLineId(subtitles, time);
      if (matchId !== activeLineIdRef.current) {
        activeLineIdRef.current = matchId;
        setActiveLineId(matchId);
      }
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [subtitles, playerRef]);

  useEffect(() => {
    if (!activeLineId || !containerRef.current) return;
    const row = containerRef.current.querySelector(`[data-line-id="${activeLineId}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLineId]);

  const toggleWord = useCallback((wordId: string) => {
    setOpenWord((current) => (current === wordId ? null : wordId));
  }, []);

  const handleSeek = useCallback(
    (line: SubtitleLine) => {
      playerRef.current?.seekTo(line.start);
      // Optimistic: highlight immediately instead of waiting for the next tick.
      activeLineIdRef.current = line.id;
      setActiveLineId(line.id);
    },
    [playerRef],
  );

  if (subtitles.length === 0) {
    return (
      <div className="flex min-h-[6rem] items-center justify-center rounded-2xl border border-black/10 px-4 py-6 text-center text-sm text-foreground/40 dark:border-white/10">
        Esta lección todavía no tiene transcripción.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-2xl border border-black/10 p-3 dark:border-white/10"
    >
      {subtitles.map((line) => (
        <MemoSubtitleLineRow
          key={line.id}
          line={line}
          isActive={activeLineId === line.id}
          glossary={glossary}
          openWord={openWord}
          onToggleWord={toggleWord}
          onSeek={handleSeek}
        />
      ))}
    </div>
  );
}

export default memo(SubtitleTrack);
