"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AvatarId } from "@/lib/avatars";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

// Desktop-only header control (Navbar hides this below `sm`, where
// MobileMenu's own CTA link takes over) — replaces a bare email address
// with a proper "My profile" button + dropdown, same client-island split
// as LanguageSwitcher.tsx/MobileMenu.tsx (Navbar itself stays a server
// component that awaits getCurrentUser()).
export default function ProfileMenu({
  lang,
  name,
  email,
  avatarId,
  isPremium,
  label,
  tabs,
  logoutLabel,
}: {
  lang: string;
  name: string | null;
  email: string;
  avatarId: AvatarId;
  isPremium: boolean;
  label: string;
  tabs: { id: string; label: string }[];
  logoutLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="tap flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10 active:bg-foreground/10"
      >
        <MatryoshkaAvatar id={avatarId} size={28} premium={isPremium} />
        {label}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-black/10 bg-background p-2 shadow-lg dark:border-white/10"
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
              className="tap flex min-h-10 items-center rounded-lg px-3 text-sm text-foreground/85 transition-colors hover:bg-foreground/10 active:bg-foreground/10"
            >
              {tab.label}
            </Link>
          ))}
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
        </div>
      )}
    </div>
  );
}
