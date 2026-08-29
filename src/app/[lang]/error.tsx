"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

/**
 * Backstop error boundary for everything under the locale layout.
 *
 * Why it exists — incident №1, 29.08.2026. `/es/courses` showed a signed-in
 * mobile user a bare English "Something went wrong" with no navbar and no
 * way back. That string comes from exactly one file in this repo,
 * src/app/global-error.tsx, and reaching it means the error escalated past
 * every boundary in between. There were none: only five subtrees (media,
 * profile, stories, vocabulary, word-games) had an error.tsx, leaving 55 of
 * 64 page routes — the whole /courses tree included — with nothing between
 * them and global-error.
 *
 * global-error replaces the entire document, so the user loses the header,
 * the footer, their language and any way to retry. This file keeps all of
 * that: the locale layout still renders around it, and reset() re-renders
 * the failed segment without a full reload.
 *
 * Measured on a local production build (see PROGRESS.md 7.31). Same planted
 * failure under /courses, arrived at by a client-side navigation:
 *   without this file — "Something went wrong", no header, no retry
 *   with it          — the panel below, header intact, retry works
 *
 * Bilingual rather than localized: Next passes error.tsx no params, and
 * reading `lang` from usePathname here would add a failure mode to the
 * component whose whole job is to still work when something else broke.
 * The five subtree boundaries already do the same.
 *
 * `digest` is shown deliberately. It is the id Next assigns the underlying
 * error and the only handle a user can read off the screen and quote — the
 * thing that was missing when this incident was reported and could not be
 * traced to a specific failure.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-xl font-semibold text-foreground">
        Algo salió mal · Что-то пошло не так
      </h1>
      <p className="text-sm text-foreground/70">
        No pudimos cargar esta página. Inténtalo de nuevo.
        <br />
        Не удалось загрузить страницу. Попробуйте ещё раз.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="tap rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-400)] active:scale-[0.97] active:bg-[var(--color-primary-400)]"
        >
          Reintentar · Повторить
        </button>
        <Link
          href="/"
          className="tap rounded-full border border-black/10 px-5 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-black/[.04] active:scale-[0.97] dark:border-white/30"
        >
          Inicio · Главная
        </Link>
      </div>
      {error.digest && (
        <p className="font-mono text-xs text-foreground/40">
          ref: {error.digest}
        </p>
      )}
    </div>
  );
}
