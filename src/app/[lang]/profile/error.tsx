"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

// Scoped error boundary for /{lang}/profile: a failure in any one tab's
// data (subscription, badges, progress, referral...) previously took down
// the entire page with Next's default unstyled 500. This renders in place
// of the page tree instead, with a retry action, so a transient/single-field
// failure degrades gracefully rather than looking like the whole account is
// broken. Bilingual (no `lang` param is passed to error.tsx by Next) to
// match the two audiences this route serves.
export default function ProfileError({
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
        No pudimos cargar tu perfil. Inténtalo de nuevo.
        <br />
        Не удалось загрузить профиль. Попробуйте ещё раз.
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
