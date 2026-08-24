"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeFlags, localeNames, type Locale } from "@/i18n/config";

// usePathname() never includes the query string, so a page whose state
// lives there (e.g. profile's `?tab=progress`) used to silently drop back
// to its default tab on every language switch — the path was preserved,
// but not "where you were" within it. search is threaded through so the
// switch is a true no-op on everything except the locale segment.
function withLocale(pathname: string, search: string, locale: Locale): string {
  const segments = pathname.split("/");
  segments[1] = locale;
  return (segments.join("/") || "/") + search;
}

export default function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  // Deliberately NOT next/navigation's useSearchParams(): reading it here
  // would force every page in the app to opt out of static rendering
  // (Navbar — and this switcher inside it — renders on every route via
  // the root layout), just to cover the rare case of a query-string tab
  // param. window.location.search read after mount gets the same value
  // for this one interaction without that site-wide cost — same
  // SSR-safe "start empty, correct after mount" pattern as SoundToggle.
  const [search, setSearch] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(window.location.search);
  }, [pathname]);

  return (
    <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white/60 p-1 dark:border-white/15 dark:bg-white/5">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={withLocale(pathname, search, locale)}
          aria-current={locale === current}
          className={`tap flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition-colors ${
            locale === current
              ? "bg-foreground text-background"
              : "text-foreground/70 hover:text-foreground active:text-foreground"
          }`}
        >
          <span aria-hidden>{localeFlags[locale]}</span>
          <span className="hidden sm:inline">{localeNames[locale]}</span>
        </Link>
      ))}
    </div>
  );
}
