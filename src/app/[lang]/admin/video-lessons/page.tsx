import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getAllSavedVideoLessons } from "@/lib/video-lesson/lessonStore";
import VideoLessonGenerator from "@/components/admin/VideoLessonGenerator";

export default async function AdminVideoLessonsPage({ params }: PageProps<"/[lang]/admin/video-lessons">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const savedLessons = await getAllSavedVideoLessons();

  return (
    <div>
      <h2 className="font-medium">Lecciones de video</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Genera automáticamente el contenido de una lección de video a partir de sus subtítulos de
        YouTube en ruso.
      </p>
      <div className="mt-6">
        <VideoLessonGenerator />
      </div>

      <div className="mt-10">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          Lecciones guardadas ({savedLessons.length})
        </h3>
        {savedLessons.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/50">Todavía no hay ninguna lección guardada.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50 dark:border-white/10">
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Título</th>
                  <th className="px-4 py-2">Nivel</th>
                  <th className="px-4 py-2">YouTube</th>
                </tr>
              </thead>
              <tbody>
                {savedLessons.map((lesson) => (
                  <tr key={lesson.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                    <td className="px-4 py-2.5 font-mono text-xs">{lesson.id}</td>
                    <td className="px-4 py-2.5">{lesson.title}</td>
                    <td className="px-4 py-2.5">{lesson.level}</td>
                    <td className="px-4 py-2.5">
                      <a
                        href={`https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground/70 hover:text-foreground"
                      >
                        {lesson.youtubeVideoId} ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
