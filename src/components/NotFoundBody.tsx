import Link from "next/link";
import type { Locale } from "@/i18n/config";
import OpenSearchButton from "@/components/OpenSearchButton";

/**
 * Содержимое страницы 404 — долг 129. Серверный компонент: локаль и словарь
 * приходят сверху (`src/app/global-not-found.tsx`), поэтому текст стоит в
 * серверном HTML, а не появляется после гидрации.
 *
 * ЗВУКА ЗДЕСЬ НЕТ НИ ОДНОЙ КНОПКИ. На странице нет ни слова, которому
 * платили за озвучку, а орган «слушать» без записи — ровно то, что заход
 * 7.168 убирал с сайта (`docs/audio-passport.md`, правило 0). Сторож
 * `check:404` это проверяет отдельной строкой.
 */
export interface NotFoundDict {
  code: string;
  title: string;
  lead: string;
  homeCta: string;
  catalogCta: string;
  searchCta: string;
  searchHint: string;
}

export default function NotFoundBody({ lang, dict }: { lang: Locale; dict: NotFoundDict }) {
  return (
    <div
      data-testid="not-found-page"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-6 py-16 text-center"
    >
      <p className="font-mono text-5xl font-bold text-primary/70">{dict.code}</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{dict.title}</h1>
      <p className="mt-4 text-foreground/75">{dict.lead}</p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
        <Link
          href={`/${lang}`}
          data-testid="not-found-home"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-400"
        >
          {dict.homeCta}
        </Link>
        <Link
          href={`/${lang}/courses`}
          data-testid="not-found-catalog"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-6 text-sm font-semibold transition-colors hover:border-foreground/40 dark:border-white/15"
        >
          {dict.catalogCta}
        </Link>
        <OpenSearchButton label={dict.searchCta} />
      </div>
      <p className="mt-3 text-xs text-foreground/55">{dict.searchHint}</p>
    </div>
  );
}
