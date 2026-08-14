function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1) || null;
    if (parsed.hostname.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/embed/")[1] ?? null;
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/shorts/")[1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Renders a YouTube embed for youtube.com/youtu.be links, otherwise falls
 * back to a plain HTML5 <video> tag for direct file URLs. Nothing renders
 * if `videoUrl` is empty — the video block is optional per lesson. */
export default function VideoPlayer({ videoUrl, title }: { videoUrl: string | undefined; title: string }) {
  if (!videoUrl) return null;

  const youTubeId = extractYouTubeId(videoUrl);

  return (
    <div className="mb-8 mt-6 overflow-hidden rounded-2xl border border-black/10 bg-black dark:border-white/10">
      <div className="relative aspect-video w-full">
        {youTubeId ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${youTubeId}`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video className="absolute inset-0 h-full w-full" src={videoUrl} controls preload="none" />
        )}
      </div>
    </div>
  );
}
