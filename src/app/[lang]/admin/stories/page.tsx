import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { db } from "@/lib/db";
import PremiumBadge from "@/components/ui/PremiumBadge";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/stories">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/admin/stories") };
}

export default async function AdminStoriesPage({
  params,
}: PageProps<"/[lang]/admin/stories">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const stories = await db.story.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">{dict.admin.stories.title}</h2>
          <p className="mt-1 text-sm text-foreground/60">{dict.admin.stories.subtitle}</p>
        </div>
        <Link
          href={`/${lang}/admin/stories/new`}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
        >
          + {dict.admin.stories.newButton}
        </Link>
      </div>

      {stories.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/60">{dict.admin.stories.emptyState}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50 dark:border-white/30">
                <th className="px-4 py-2">{dict.admin.stories.titleHeader}</th>
                <th className="px-4 py-2">{dict.admin.stories.authorHeader}</th>
                <th className="px-4 py-2">{dict.admin.stories.levelHeader}</th>
                <th className="px-4 py-2">{dict.admin.stories.premiumHeader}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {stories.map((story) => (
                <tr
                  key={story.id}
                  className="border-b border-black/5 last:border-0 dark:border-white/5"
                >
                  <td className="px-4 py-2.5">{story.title}</td>
                  <td className="px-4 py-2.5 text-foreground/70">{story.author}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium">
                      {story.level}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {story.isPremium ? (
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          {dict.admin.stories.premiumYes}
                        </span>
                      ) : (
                        <span className="text-foreground/50">{dict.admin.stories.premiumNo}</span>
                      )}
                      {story.premiumOnly && (
                        <span title={dict.admin.stories.premiumOnlyHelp}>
                          <PremiumBadge>{dict.admin.stories.premiumOnlyLabel}</PremiumBadge>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        href={`/${lang}/admin/stories/${story.id}`}
                        className="font-medium text-foreground/80 hover:text-foreground"
                      >
                        {dict.admin.stories.editButton}
                      </Link>
                      <form action="/api/admin/stories/delete" method="POST">
                        <input type="hidden" name="lang" value={lang} />
                        <input type="hidden" name="id" value={story.id} />
                        <button
                          type="submit"
                          className="font-medium text-red-600 hover:text-red-500 dark:text-red-400"
                        >
                          {dict.admin.stories.deleteButton}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
