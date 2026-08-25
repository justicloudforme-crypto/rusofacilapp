"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AvatarId } from "@/lib/avatars";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

export interface MobileMenuLink {
  href: string;
  label: string;
}

export interface MobileMenuGroup {
  label: string;
  links: MobileMenuLink[];
}

interface MobileMenuUser {
  name: string | null;
  email: string;
  avatarId: AvatarId;
  isPremium: boolean;
}

// Client island for the hamburger menu shown below the `sm` breakpoint,
// where Navbar.tsx's own `hidden ... sm:flex` nav disappears with no
// replacement. Navbar stays a server component (it awaits getCurrentUser())
// and just passes the already-resolved, serializable links/labels down —
// same split as LanguageSwitcher.tsx.
//
// Renders as a bottom sheet (not a dropdown under the header) so the
// touch targets sit near the user's thumb, and folds the desktop
// ProfileMenu's profile/tabs/logout content in as the sheet's first
// section for logged-in users, rather than a single "go to profile" link.
export default function MobileMenu({
  lang,
  user,
  groups,
  loggedOutHref,
  loggedOutLabel,
  profileLabel,
  profileTabs,
  logoutLabel,
  openLabel,
  closeLabel,
}: {
  lang: string;
  user: MobileMenuUser | null;
  groups: MobileMenuGroup[];
  loggedOutHref: string;
  loggedOutLabel: string;
  profileLabel: string;
  profileTabs: { id: string; label: string }[];
  logoutLabel: string;
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Fallback close-on-navigation for paths that don't go through one of
  // this panel's own links below (browser back/forward, a programmatic
  // redirect elsewhere in the app). Every in-panel Link/button already
  // closes synchronously in its own onClick — a real, confirmed bug: when
  // this was the ONLY close mechanism, it fired reactively off the
  // `pathname` change itself, which raced with Next's own route-transition
  // DOM swap (both touching this portal's document.body subtree around
  // the same commit) and threw a genuine
  // "Failed to execute 'removeChild' on 'Node'" crash on slower Android
  // devices (confirmed via a Sentry event: transaction /vocabulary, URL
  // landed on /profile — i.e. mid-tap-on-a-panel-link). Adjusted during
  // render (React's documented pattern for "reset state when a prop
  // changes") rather than in an effect, which would cause an extra render
  // pass just to flip `open` back to false a tick after the real
  // navigation.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? closeLabel : openLabel}
        className="tap flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-brand/10 active:bg-brand/10"
      >
        <span className="relative flex h-4 w-5 flex-col justify-between" aria-hidden>
          <span
            className={`h-0.5 w-full rounded-full bg-current transition-transform ${open ? "translate-y-[7px] rotate-45" : ""}`}
          />
          <span className={`h-0.5 w-full rounded-full bg-current transition-opacity ${open ? "opacity-0" : ""}`} />
          <span
            className={`h-0.5 w-full rounded-full bg-current transition-transform ${open ? "-translate-y-[7px] -rotate-45" : ""}`}
          />
        </span>
      </button>

      {open &&
        createPortal(
          <>
            {/* Portalled to <body> rather than rendered in place: this
                sheet is nested inside Navbar's <header>, and that header
                has `backdrop-blur` — CSS gives `backdrop-filter` (like
                `transform`) the side effect of becoming the containing
                block for any `position: fixed` descendant. Without the
                portal, `fixed inset-x-0 bottom-0` below resolved against
                the header's own small box instead of the viewport, so the
                sheet rendered pinned above the header and mostly
                off-screen instead of docked to the bottom of the screen. */}
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => setOpen(false)}
              className="animate-celebration-fade-in fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] dark:bg-black/50"
            />

          <nav className="sheet-slide-up fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-brand/15 bg-background pb-safe shadow-[0_-8px_30px_-8px_rgba(36,28,21,0.25)]">
            <div className="mx-auto mt-2.5 h-1 w-9 flex-shrink-0 rounded-full bg-foreground/15" aria-hidden />

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
              {user ? (
                <>
                  <Link
                    href={`/${lang}/profile`}
                    onClick={() => setOpen(false)}
                    className="tap flex min-h-14 items-center gap-3 rounded-2xl border border-brand/15 bg-brand/5 px-3 transition-colors hover:bg-brand/10 active:bg-brand/10"
                  >
                    <MatryoshkaAvatar id={user.avatarId} size={36} premium={user.isPremium} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {user.name?.trim() || user.email}
                      </span>
                      <span className="block truncate text-xs text-foreground/60">{profileLabel}</span>
                    </span>
                  </Link>
                  <div className="mt-2 flex flex-col gap-0.5">
                    {profileTabs.map((tab) => (
                      <Link
                        key={tab.id}
                        href={`/${lang}/profile?tab=${tab.id}`}
                        onClick={() => setOpen(false)}
                        className="tap flex min-h-11 items-center rounded-lg px-3 text-sm text-foreground/75 transition-colors hover:bg-foreground/10 active:bg-foreground/10"
                      >
                        {tab.label}
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <Link
                  href={loggedOutHref}
                  onClick={() => setOpen(false)}
                  className="tap flex min-h-12 items-center justify-center rounded-full bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-light active:bg-brand-light"
                >
                  {loggedOutLabel}
                </Link>
              )}

              {groups.map((group) => (
                <div key={group.label} className="mt-4">
                  <p className="px-3 pb-1.5 font-mono text-[0.65rem] font-medium uppercase tracking-wider text-foreground/45">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="tap flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-foreground/85 transition-colors hover:bg-brand/10 active:bg-brand/10"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {user && (
                <form action="/api/auth/logout" method="POST" className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
                  <input type="hidden" name="lang" value={lang} />
                  <button
                    type="submit"
                    className="tap flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-brand-accent transition-colors hover:bg-brand-accent/10 active:bg-brand-accent/10"
                  >
                    {logoutLabel}
                  </button>
                </form>
              )}
            </div>
          </nav>
        </>,
        document.body,
      )}
    </div>
  );
}
