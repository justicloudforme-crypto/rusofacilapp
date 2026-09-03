"use client";

import * as Sentry from "@sentry/nextjs";
import { isCancelledByLeaving } from "@/lib/report-boundary-error";
import { useEffect } from "react";
import Link from "next/link";

// Scoped error boundary for /{lang}/word-games (and its [type]/[level]/
// [sequence] puzzle pages) — same pattern as profile/error.tsx: a data
// failure in this section previously took down the entire page with
// Next's default unstyled 500. Bilingual (no `lang` param is passed to
// error.tsx by Next) to match the two audiences this route serves.
export default function WordGamesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Запрос, оборванный уходом со страницы, — не отказ сайта, и на
    // квоту Sentry он тратится зря. Настоящий отказ сети или API
    // остаётся видимым: правило и его тест — src/lib/report-boundary-error.ts.
    if (!isCancelledByLeaving(error)) Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-xl font-semibold text-foreground">
        Algo salió mal · Что-то пошло не так
      </h1>
      <p className="text-sm text-foreground/70">
        No pudimos cargar los juegos de palabras. Inténtalo de nuevo.
        <br />
        Не удалось загрузить игры со словами. Попробуйте ещё раз.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-400)] active:scale-[0.97] active:bg-[var(--color-primary-400)]"
        >
          Reintentar · Повторить
        </button>
        <Link
          href="/"
          className="rounded-full border border-black/10 px-5 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-black/[.04] active:scale-[0.97]"
        >
          Inicio · Главная
        </Link>
      </div>
    </div>
  );
}
