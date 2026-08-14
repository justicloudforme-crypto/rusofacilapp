"use client";

import { useRef } from "react";
import type { VideoLessonData } from "@/lib/video-lesson/types";
import YouTubePlayer, { type YouTubePlayerHandle } from "./YouTubePlayer";
import SubtitleTrack from "./SubtitleTrack";
import HistoricalContextAccordion from "./HistoricalContextAccordion";
import VocabularyGrid from "./VocabularyGrid";
import VideoLessonQuiz from "./VideoLessonQuiz";

export default function VideoLessonCard({ lesson }: { lesson: VideoLessonData }) {
  const playerRef = useRef<YouTubePlayerHandle>(null);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/40">
          Nivel {lesson.level}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
      </header>

      <section className="flex flex-col gap-4">
        <YouTubePlayer ref={playerRef} youtubeVideoId={lesson.youtubeVideoId} title={lesson.title} />
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground/50">
            Texto / transcripción
          </h2>
          <SubtitleTrack subtitles={lesson.subtitles} glossary={lesson.glossary} playerRef={playerRef} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Contexto histórico y cultural</h2>
        <HistoricalContextAccordion sections={lesson.historicalContext} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Vocabulario clave</h2>
        <VocabularyGrid cards={lesson.vocabulary} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Cuestionario interactivo</h2>
        <VideoLessonQuiz questions={lesson.quiz} />
      </section>
    </article>
  );
}
