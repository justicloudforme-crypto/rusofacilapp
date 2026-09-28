import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { routeAlternates } from "@/lib/site";
import { accountDeletionCopy, PLAY_SUBSCRIPTIONS_URL } from "@/lib/legal/account-deletion";
import LinkifiedText from "@/components/legal/LinkifiedText";

/**
 * ПУБЛИЧНАЯ СТРАНИЦА УДАЛЕНИЯ АККАУНТА — заход 7.242, долг 345 (аудит
 * 7.241, Р4). Адрес для поля «Delete account URL» анкеты Google Play.
 *
 * Без входа: страница не читает сессию вовсе, поэтому гость, вошедший и
 * проверяющий Google видят одно и то же. Состояние по правилу сайта —
 * «в карте сайта» (`src/app/sitemap.ts`, рядом с `/terms` и `/privacy`):
 * это правовая страница, и Google обязан до неё дойти.
 *
 * Тексты и чем заземлён каждый факт — `src/lib/legal/account-deletion.ts`.
 */
export async function generateMetadata({ params }: PageProps<"/[lang]/eliminar-cuenta">): Promise<Metadata> {
  const { lang } = await params;
  const alternates = routeAlternates(lang, "/eliminar-cuenta");
  if (!isLocale(lang)) return { alternates };
  const copy = accountDeletionCopy(lang);
  return { title: `${copy.title} | RusoFácilapp`, description: copy.metaDescription, alternates };
}

export default async function AccountDeletionPage({ params }: PageProps<"/[lang]/eliminar-cuenta">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const copy = accountDeletionCopy(lang);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16" data-rf-account-deletion-page>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h1>
      <p className="mt-6 text-foreground/80">{copy.intro}</p>

      <div className="mt-10 space-y-8">
        {copy.sections.map((section) => {
          const List = section.ordered ? "ol" : "ul";
          return (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground/75">
                {section.paragraphs?.map((p) => (
                  <p key={p}>
                    <LinkifiedText text={p} />
                  </p>
                ))}
                {section.items && (
                  <List className={`space-y-2 pl-5 ${section.ordered ? "list-decimal" : "list-disc"}`}>
                    {section.items.map((item) => (
                      <li key={item}>
                        <LinkifiedText text={item} />
                      </li>
                    ))}
                  </List>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a
          href={PLAY_SUBSCRIPTIONS_URL}
          target="_blank"
          rel="noreferrer"
          className="tap inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-5 py-2.5 text-center text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
        >
          {copy.playLinkLabel}
        </a>
        <Link
          href={`/${lang}/privacy#tus-derechos`}
          className="tap inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-5 py-2.5 text-center text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
        >
          {copy.privacyLinkLabel}
        </Link>
      </div>
    </div>
  );
}
