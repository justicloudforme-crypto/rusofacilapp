"use client";

import { useEffect, useState } from "react";

// Covers the gap the Service Worker's offline fallback (see
// src/app/offline/) doesn't: most of the app's own data (flashcards,
// exercise progress, glossary lookups) is fetched client-side after the
// page has already loaded, and those fetches just fail silently offline
// (see ExercisesTab.tsx's queuePendingProgress/flushPendingProgress for the
// retry side of that). This banner is the visible half — telling the
// student why things aren't updating instead of leaving them guessing.
export default function OfflineBanner({ message }: { message: string }) {
  // Starts false on both server and client so hydration output matches —
  // navigator.onLine isn't available during SSR, so the real value is read
  // right after mount, same pattern as ExercisesTab's passed-state read.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffline(!navigator.onLine);
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="bg-amber-500/15 px-4 py-2 text-center text-sm font-medium text-amber-900 dark:bg-amber-400/10 dark:text-amber-200"
    >
      {message}
    </div>
  );
}
