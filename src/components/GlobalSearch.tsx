"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

interface Destination {
  href: string;
  label: string;
}

/**
 * Cmd/Ctrl+K on desktop, a 🔍 tap on any breakpoint — scoped deliberately
 * to static navigation destinations, not full-text content search. A real
 * content search (stories/glossary/lessons) would need a new aggregating
 * API route querying the DB; that's a data/business-logic decision on its
 * own, out of scope for a navigation-layer change. This can grow into that
 * later without changing where it's triggered from.
 */
export default function GlobalSearch({
  lang,
  dict,
  isLoggedIn,
}: {
  lang: Locale;
  dict: Dictionary;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const destinations = useMemo<Destination[]>(() => {
    const base: Destination[] = [
      { href: `/${lang}`, label: dict.nav.home },
      { href: `/${lang}/courses`, label: dict.nav.courses },
      { href: `/${lang}/stories`, label: dict.nav.stories },
      { href: `/${lang}/media`, label: dict.nav.media },
      { href: `/${lang}/vocabulary`, label: dict.nav.vocabulary },
      { href: `/${lang}/word-games`, label: dict.nav.wordGames },
      { href: `/${lang}/pricing`, label: dict.nav.pricing },
      { href: `/${lang}/glossary`, label: dict.nav.glossary },
    ];
    if (isLoggedIn) {
      base.push({ href: `/${lang}/profile`, label: dict.nav.profile }, { href: `/${lang}/groups`, label: dict.nav.groups });
    }
    return base;
  }, [lang, dict, isLoggedIn]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return destinations;
    return destinations.filter((d) => d.label.toLowerCase().includes(q));
  }, [destinations, query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={dict.nav.search}
        title={dict.nav.searchShortcutHint}
        className="tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-black/[.04] hover:text-foreground active:bg-black/[.04] active:text-foreground dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="m17 17-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <Modal open={open} onClose={close} closeLabel={dict.nav.closeMenu} title={dict.nav.searchTitle} fullScreenOnMobile>
        <Input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.nav.searchPlaceholder}
          aria-label={dict.nav.searchTitle}
        />
        <ul className="mt-3 flex flex-col gap-0.5">
          {results.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                onClick={close}
                className="tap flex min-h-11 items-center rounded-lg px-3 text-sm text-foreground/85 transition-colors hover:bg-foreground/10 active:bg-foreground/10"
              >
                {d.label}
              </Link>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-4 text-sm text-foreground/50">{dict.nav.searchEmpty}</li>}
        </ul>
      </Modal>
    </>
  );
}
