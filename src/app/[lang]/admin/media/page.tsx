import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getAllMedia, getOverrideMeta } from "@/lib/media/data";
import MediaSubtitlesTable from "@/components/admin/MediaSubtitlesTable";
import MediaEmbedStatusPanel from "@/components/admin/MediaEmbedStatusPanel";

export default async function AdminMediaPage({ params }: PageProps<"/[lang]/admin/media">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [items, overrideMeta] = await Promise.all([getAllMedia(), getOverrideMeta()]);
  const subtitleRows = items.map((item) => ({
    id: item.id,
    title: item.title,
    hasSubtitles: Boolean(item.subtitles && item.subtitles.length > 0),
  }));
  const embedRows = items.map((item) => ({
    id: item.id,
    title: item.title,
    embedStatus: item.embedStatus ?? "unchecked",
    lastCheckedAt: item.lastCheckedAt,
    manualOverride: overrideMeta.get(item.id)?.manualOverride ?? false,
    overrideNote: overrideMeta.get(item.id)?.note ?? undefined,
  }));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="font-medium">Enlaces de YouTube</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Comprueba contra la YouTube Data API si cada video sigue disponible y permite ser embebido — el
          catálogo público oculta automáticamente los que salgan &quot;rotos&quot;. Los videos pueden pasar de
          funcionar a no funcionar en cualquier momento (reclamación de Content-ID, canal eliminado), así que
          conviene repetir esta comprobación de vez en cuando, no solo al añadir contenido nuevo.
        </p>
        <div className="mt-6">
          <MediaEmbedStatusPanel rows={embedRows} />
        </div>
      </div>

      <div>
        <h2 className="font-medium">Catálogo de medios</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Entradas de <code className="font-mono">mediaData.json</code>. Las que no tienen subtítulos
          sincronizados (start/end + traducción) pueden generarse en un clic a partir de los subtítulos de
          YouTube en ruso.
        </p>
        <div className="mt-6">
          <MediaSubtitlesTable rows={subtitleRows} />
        </div>
      </div>
    </div>
  );
}
