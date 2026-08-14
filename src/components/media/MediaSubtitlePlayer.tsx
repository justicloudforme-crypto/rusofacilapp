"use client";

import { useRef } from "react";
import type { SubtitleLine } from "@/lib/video-lesson/types";
import YouTubePlayer, { type YouTubePlayerHandle } from "@/components/video-lesson/YouTubePlayer";
import SubtitleTrack from "@/components/video-lesson/SubtitleTrack";

export default function MediaSubtitlePlayer({
  youtubeVideoId,
  title,
  subtitles,
  transcriptHeading,
}: {
  youtubeVideoId: string;
  title: string;
  subtitles: SubtitleLine[];
  transcriptHeading: string;
}) {
  const playerRef = useRef<YouTubePlayerHandle>(null);

  return (
    <div className="flex flex-col gap-4">
      <YouTubePlayer ref={playerRef} youtubeVideoId={youtubeVideoId} title={title} />
      <div>
        <h2 className="mb-2 text-lg font-medium">{transcriptHeading}</h2>
        <SubtitleTrack subtitles={subtitles} playerRef={playerRef} />
      </div>
    </div>
  );
}
