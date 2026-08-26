"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hapticTap } from "@/lib/haptics";
import { HomeIcon, GraduationCapIcon, DictionaryIcon, BookIcon, PersonalIcon } from "@/components/profile/ProfileIcons";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/**
 * Persistent 5-item bottom bar for the mobile web app — a real device
 * report found the existing hamburger sheet (MobileMenu.tsx) too many taps
 * away for the handful of destinations used every session. Deliberately
 * NOT a replacement for MobileMenu: this covers only the five
 * highest-traffic routes, everything else (word games, media, groups,
 * language, admin) stays in the hamburger untouched. `sm:hidden` mirrors
 * MobileMenu's own breakpoint — desktop keeps the top nav bar only.
 */
export default function BottomNav({
  lang,
  dict,
  isLoggedIn,
}: {
  lang: Locale;
  dict: Dictionary;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();

  const items = [
    { href: `/${lang}`, label: dict.nav.home, icon: HomeIcon, exact: true },
    { href: `/${lang}/courses`, label: dict.nav.courses, icon: GraduationCapIcon, exact: false },
    { href: `/${lang}/vocabulary`, label: dict.nav.vocabulary, icon: DictionaryIcon, exact: false },
    { href: `/${lang}/stories`, label: dict.nav.stories, icon: BookIcon, exact: false },
    {
      href: isLoggedIn ? `/${lang}/profile` : `/${lang}/login`,
      label: isLoggedIn ? dict.nav.profile : dict.nav.cta,
      icon: PersonalIcon,
      exact: false,
    },
  ];

  return (
    <nav
      aria-label="Navegación principal"
      // No backdrop-blur: a `fixed` blurred bar forces the Android WebView
      // compositor to repaint the blur region on every frame of whatever
      // scrolls under it — a real device report found this made every tap
      // here feel laggy. bg-background alone (no /opacity) is already
      // fully opaque, so nothing needs blurring behind it.
      className="pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-black/10 bg-background sm:hidden dark:border-white/10"
    >
      {items.map((item) => {
        // The home route needs an exact match (every other route also
        // starts with "/"); every other item matches its own subtree so a
        // nested page (e.g. /courses/a1/1) still highlights "Курсы".
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => hapticTap()}
            aria-current={active}
            className={`tap flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium transition-transform active:scale-95 ${
              active ? "text-primary" : "text-foreground/55 hover:text-foreground/80"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
