"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";
import Dropdown from "@/components/ui/Dropdown";

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

// Compact ES/RU dropdown — a flag doesn't identify a language (Spanish
// isn't Mexico's flag or Spain's flag, and two flag pills used to burn
// roughly half the header's useful width for a 2-way choice). Shows the
// current locale's 2-letter code as the trigger, full names in the panel.
export default function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  // Deliberately NOT next/navigation's useSearchParams(): reading it here
  // would force every page in the app to opt out of static rendering
  // (Navbar — and this switcher inside it — renders on every route via
  // the root layout), just to cover the rare case of a query-string tab
  // param. window.location.search read after mount gets the same value
  // for this one interaction without that site-wide cost — same
  // SSR-safe "start empty, correct after mount" pattern as SoundToggle.
  //
  // useLayoutEffect, not useEffect: it runs synchronously after the DOM
  // updates but before the browser paints, so the corrected href (with the
  // query string restored) is already in place before the link is ever
  // visible to tap. A plain useEffect leaves a real — if usually brief —
  // window where the link's href still points at the query-string-less
  // fallback; on a slower device (a real reported case: Android, where JS
  // parse/hydration can trail a fast first paint by much longer than on a
  // fast iPhone) that window is long enough for an eager tap to land on it,
  // silently dropping e.g. /profile?tab=progress back to the default tab.
  const [search, setSearch] = useState("");
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(window.location.search);
  }, [pathname]);

  return (
    <Dropdown
      panelClassName="w-40"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={localeNames[current]}
          className="tap flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-sm font-semibold uppercase text-foreground/80 transition-colors hover:bg-foreground/10 active:bg-foreground/10"
        >
          {current}
        </button>
      )}
    >
      {locales.map((locale) => (
        <Link
          key={locale}
          href={withLocale(pathname, search, locale)}
          role="menuitem"
          aria-current={locale === current}
          className={`tap flex min-h-10 items-center justify-between rounded-lg px-3 text-sm transition-colors ${
            locale === current ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-foreground/10 active:bg-foreground/10"
          }`}
        >
          {localeNames[locale]}
          {locale === current && <span aria-hidden>✓</span>}
        </Link>
      ))}
    </Dropdown>
  );
}
