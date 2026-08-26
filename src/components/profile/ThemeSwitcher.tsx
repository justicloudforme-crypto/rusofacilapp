"use client";

import { useEffect, useState } from "react";
import type { ThemePreference } from "@/lib/theme";

export default function ThemeSwitcher({
  initialTheme,
  options,
}: {
  initialTheme: ThemePreference;
  options: { id: ThemePreference; label: string; description: string; swatch: string }[];
}) {
  const [theme, setTheme] = useState(initialTheme);

  // <html> already carries the server-rendered data-theme from the cookie —
  // this effect just keeps it in sync with client state after a click, so
  // the whole page (not just this component) reflects the choice instantly,
  // with no reload/flash needed.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  async function selectTheme(next: ThemePreference) {
    setTheme(next);
    try {
      await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
    } catch {
      // The DOM already reflects the choice for this tab; a failed request
      // just means it won't survive a reload — not worth surfacing an error
      // for a display preference.
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => selectTheme(option.id)}
          aria-pressed={theme === option.id}
          className={`tap flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors ${
            theme === option.id
              ? "border-primary bg-primary/5"
              : "border-black/10 hover:bg-black/[.03] active:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.05] dark:active:bg-white/[.05]"
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className="h-5 w-5 flex-shrink-0 rounded-full border border-black/10 dark:border-white/20"
              style={{ background: option.swatch }}
              aria-hidden
            />
            <span className="text-sm font-medium">{option.label}</span>
          </span>
          <span className="text-xs text-foreground/60">{option.description}</span>
        </button>
      ))}
    </div>
  );
}
