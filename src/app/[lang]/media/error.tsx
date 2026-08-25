"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

// Scoped error boundary for /{lang}/media (and its [id] player pages) —
// same pattern as profile/error.tsx: a data failure in this section
// previously took down the entire page with Next's default unstyled 500.
// Bilingual (no `lang` param is passed to error.tsx by Next) to match the
// two audiences this route serves.
export default function MediaError({
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
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-xl font-semibold text-foreground">
        Algo salió mal · Что-то пошло не так
      </h1>
      <p className="text-sm text-foreground/70">
        No pudimos cargar la sección de medios. Inténtalo de nuevo.
        <br />
        Не удалось загрузить раздел «Медиа». Попробуйте ещё раз.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-[var(--brand)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-light)] active:scale-[0.97] active:bg-[var(--brand-light)]"
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
