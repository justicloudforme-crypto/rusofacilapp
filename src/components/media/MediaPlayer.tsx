export default function MediaPlayer({
  youtubeVideoId,
  title,
  emptyLabel,
}: {
  youtubeVideoId: string;
  title: string;
  emptyLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-black dark:border-white/10">
      <div className="relative aspect-video w-full">
        {youtubeVideoId ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${youtubeVideoId}`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}
