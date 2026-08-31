"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AvatarId } from "@/lib/avatars";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import Dropdown from "@/components/ui/Dropdown";

// Desktop-only header control (Navbar hides this below `sm`, where
// MobileMenu's own avatar trigger takes over) — replaces a bare email
// address with a proper "My profile" button + dropdown. `tabs` is the
// SAME array MobileMenu.tsx and /profile's own Tabs render use (built from
// getProfileTabs() in src/lib/profile-tabs.tsx) — this and the profile
// page cannot silently drift out of sync again (see AUDIT.md §7).
export default function ProfileMenu({
  lang,
  name,
  email,
  avatarId,
  isPremium,
  label,
  tabs,
  adminLink,
  logoutLabel,
}: {
  lang: string;
  name: string | null;
  email: string;
  avatarId: AvatarId;
  isPremium: boolean;
  label: string;
  tabs: { id: string; label: string; icon?: ReactNode }[];
  /** Staff only, and null for everyone else.
   *
   * It is here because of a gap, not for symmetry. Navbar hides the header's
   * "Administración" link below `md` (it is what pushed a staff account's
   * /profile 86px past a 640px viewport, PROGRESS.md 7.70), and MobileMenu —
   * which carries the admin group — is `sm:hidden`. That leaves 640–767 with
   * no route to /admin at all. This dropdown is `hidden sm:block`, so it
   * covers exactly that band and every width above it. */
  adminLink?: { href: string; label: string } | null;
  logoutLabel: string;
}) {
  return (
    <Dropdown
      rootClassName="hidden sm:block"
      panelClassName="w-64"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          className="tap flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10 active:bg-foreground/10"
        >
          <MatryoshkaAvatar id={avatarId} size={28} premium={isPremium} />
          {label}
        </button>
      )}
    >
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium">{name?.trim() || email}</p>
        {name?.trim() && <p className="truncate text-xs text-foreground/60">{email}</p>}
      </div>
      <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={`/${lang}/profile?tab=${tab.id}`}
          role="menuitem"
          className="tap flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-foreground/85 transition-colors hover:bg-foreground/10 active:bg-foreground/10"
        >
          {tab.icon && (
            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-foreground/50">{tab.icon}</span>
          )}
          {tab.label}
        </Link>
      ))}
      {adminLink && (
        <>
          <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
          <Link
            href={adminLink.href}
            role="menuitem"
            className="tap flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-foreground/85 transition-colors hover:bg-foreground/10 active:bg-foreground/10"
          >
            {adminLink.label}
          </Link>
        </>
      )}
      <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
      <form action="/api/auth/logout" method="POST">
        <input type="hidden" name="lang" value={lang} />
        <button
          type="submit"
          role="menuitem"
          className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm text-foreground/85 transition-colors hover:bg-foreground/10"
        >
          {logoutLabel}
        </button>
      </form>
    </Dropdown>
  );
}
