"use client";

import * as Sentry from "@sentry/nextjs";
import { isCancelledByLeaving } from "@/lib/report-boundary-error";
import { useEffect } from "react";

/**
 * App Router's dedicated hook for errors thrown above the root layout —
 * the only place a React render error in this app can be reported to
 * Sentry, since there's no src/app/layout.tsx (routing is entirely under
 * src/app/[lang]/layout.tsx). Next.js requires this file to render its own
 * <html>/<body>, it isn't wrapped by anything else.
 *
 * Two consequences, both learned from incident №1 (29.08.2026), where a
 * signed-in mobile user got this page on /es/courses:
 *
 * 1. It replaces the whole document. No header, no footer, no locale, no
 *    theme — and globals.css is imported by [lang]/layout.tsx, which is
 *    exactly what did not render, so Tailwind classes do nothing here.
 *    Everything below is inline style on purpose; do not "tidy" it into
 *    class names.
 * 2. Reaching it at all now means something above the locale layout broke
 *    (that layout itself, or the request that renders it) — every route
 *    beneath it is covered by [lang]/error.tsx since this incident. So this
 *    page is rare and serious, not routine.
 *
 * It used to be a single unstyled English <h1> with no way out. A user who
 * lands here can now retry and can read a reference to quote, which is the
 * information that was missing when the incident was reported.
 */
export default function GlobalError({
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
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem 1.5rem",
          textAlign: "center",
          background: "#f6efdc",
          color: "#2a2118",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
          Algo salió mal · Что-то пошло не так
        </h1>
        <p style={{ fontSize: "0.875rem", opacity: 0.7, margin: 0, lineHeight: 1.6 }}>
          No pudimos cargar la página. Inténtalo de nuevo.
          <br />
          Не удалось загрузить страницу. Попробуйте ещё раз.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              minHeight: 44,
              padding: "0.5rem 1.25rem",
              borderRadius: 999,
              border: "none",
              background: "#2d5f8a",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reintentar · Повторить
          </button>
          {/* A plain <a>, not next/link, on purpose. Reaching this page
              means the locale layout itself failed to render; a soft
              client navigation would re-enter that same broken tree, while
              a full document load is the thing most likely to recover. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/es"
            style={{
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              padding: "0.5rem 1.25rem",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,.15)",
              color: "inherit",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Inicio · Главная
          </a>
        </div>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", opacity: 0.45, margin: 0, fontFamily: "ui-monospace, monospace" }}>
            ref: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
