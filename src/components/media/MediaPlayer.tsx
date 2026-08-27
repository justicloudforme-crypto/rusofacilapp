import YouTubePlayer from "@/components/video-lesson/YouTubePlayer";

export default function MediaPlayer({
  youtubeVideoId,
  title,
  emptyLabel,
  brokenLabel,
}: {
  youtubeVideoId: string;
  title: string;
  emptyLabel: string;
  brokenLabel?: string;
}) {
  if (!youtubeVideoId) {
    return (
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-black dark:border-white/30">
        <div className="relative aspect-video w-full">
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
            {emptyLabel}
          </div>
        </div>
      </div>
    );
  }

  // Delegates to the same JS-API-based player used by the transcript view
  // (rather than a bare <iframe>) so it also gets onError detection —
  // a plain iframe has no way to tell the parent page "this video is
  // actually broken", it just silently shows YouTube's own error screen.
  return <YouTubePlayer youtubeVideoId={youtubeVideoId} title={title} unavailableLabel={brokenLabel} />;
}
