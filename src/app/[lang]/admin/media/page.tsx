import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getAllMedia } from "@/lib/media/data";
import MediaSubtitlesTable from "@/components/admin/MediaSubtitlesTable";

export default async function AdminMediaPage({ params }: PageProps<"/[lang]/admin/media">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const items = await getAllMedia();
  const rows = items.map((item) => ({
    id: item.id,
    title: item.title,
    hasSubtitles: Boolean(item.subtitles && item.subtitles.length > 0),
  }));

  return (
    <div>
      <h2 className="font-medium">Catálogo de medios</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Entradas de <code className="font-mono">mediaData.json</code>. Las que no tienen subtítulos
        sincronizados (start/end + traducción) pueden generarse en un clic a partir de los subtítulos de
        YouTube en ruso.
      </p>
      <div className="mt-6">
        <MediaSubtitlesTable rows={rows} />
      </div>
    </div>
  );
}
