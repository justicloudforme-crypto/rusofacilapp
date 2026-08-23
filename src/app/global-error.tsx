"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// App Router's dedicated hook for errors thrown above the root layout —
// the only place a React render error in this app can be reported to
// Sentry, since there's no src/app/layout.tsx (routing is entirely under
// src/app/[lang]/layout.tsx). Next.js requires this file to render its own
// <html>/<body>, it isn't wrapped by anything else.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <h1>Something went wrong</h1>
      </body>
    </html>
  );
}
