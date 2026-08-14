/** Renders nothing when `audioUrl` is empty — the audio narration is
 * optional per story, same convention as the lesson VideoPlayer. */
export default function AudioPlayer({
  audioUrl,
  label,
}: {
  audioUrl: string | null;
  label: string;
}) {
  if (!audioUrl) return null;

  return (
    <div className="mt-6 rounded-2xl border border-black/10 bg-foreground/[.03] p-4 dark:border-white/10">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">{label}</p>
      <audio controls preload="none" src={audioUrl} className="w-full" />
    </div>
  );
}
