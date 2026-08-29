import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { loadFindings, loadDecisions, decisionKey } from "@/lib/audio-review";
import AudioReviewTable from "@/components/admin/AudioReviewTable";
import { routeAlternates } from "@/lib/site";

/**
 * Local-only story-audio QA tool. Lists everything
 * prisma/audit-story-audio.ts flagged as suspicious (empty/too-short
 * clips, duration not matching the text length, a voice outside the
 * fixed set the pipeline ever assigns, a narrator-sounding line voiced
 * as a character, duplicate files, and — if that script was run with
 * --whisper — a transcript mismatch), so the owner can listen and decide
 * "ok" or "regenerate" per fragment without reading code or a database.
 * This page and its data-saving API route never regenerate or touch
 * narration audio themselves — see PROGRESS.md's 2026-08-27 audio-review
 * section for the full story and prisma/fix-teremok-0-1.ts for what an
 * actual point-fix looks like once a human has reviewed a finding.
 *
 * HARD-BLOCKED IN PRODUCTION regardless of role — the owner explicitly
 * asked that this never be reachable on the live site, not even by a
 * logged-in admin. The shared /admin layout already requires a staff
 * login (see admin-auth.ts), but that alone still means a normal deployed
 * admin account could open it; this check makes the page 404 on any
 * production build no matter what, independent of auth.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/audio-review">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/admin/audio-review") };
}

export default async function AudioReviewPage({ params }: PageProps<"/[lang]/admin/audio-review">) {
  if (process.env.NODE_ENV === "production") notFound();

  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [findingsFile, decisions] = await Promise.all([loadFindings(), loadDecisions()]);

  if (!findingsFile) {
    return (
      <div className="rounded-lg border border-foreground/10 bg-surface p-6 text-sm">
        <p className="font-medium">Пока нет данных проверки.</p>
        <p className="mt-2 text-foreground/60">
          Запусти в терминале: <code className="font-mono">npx tsx prisma/audit-story-audio.ts</code>
          {" "}(добавь <code className="font-mono">-- --whisper</code>, если хочешь ещё и проверку через
          распознавание речи — это платно и дольше). Потом обнови страницу.
        </p>
      </div>
    );
  }

  const rows = findingsFile.findings.map((f) => ({
    ...f,
    key: decisionKey(f.storyId, f.itemKey),
    decision: decisions[decisionKey(f.storyId, f.itemKey)]?.decision ?? null,
  }));

  return (
    <div>
      <p className="mb-6 text-sm text-foreground/60">
        Проверка от {new Date(findingsFile.generatedAt).toLocaleString("ru-RU")} · всего клипов в библиотеке
        рассказов: {findingsFile.totalClips}. Эта страница ничего не перегенерирует сама — только показывает
        находки и сохраняет твои решения.
      </p>
      <AudioReviewTable lang={lang} rows={rows} />
    </div>
  );
}
