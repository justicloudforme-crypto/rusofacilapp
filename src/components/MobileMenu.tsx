"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface MobileMenuLink {
  href: string;
  label: string;
}

// Client island for the hamburger menu shown below the `sm` breakpoint,
// where Navbar.tsx's own `hidden ... sm:flex` nav disappears with no
// replacement. Navbar stays a server component (it awaits getCurrentUser())
// and just passes the already-resolved, serializable links/labels down —
// same split as LanguageSwitcher.tsx.
export default function MobileMenu({
  links,
  ctaHref,
  ctaLabel,
  openLabel,
  closeLabel,
}: {
  links: MobileMenuLink[];
  ctaHref: string;
  ctaLabel: string;
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close automatically on navigation, so a link tap doesn't leave the
  // panel open over the new page. Adjusted during render (React's
  // documented pattern for "reset state when a prop changes") rather than
  // in an effect, which would cause an extra render pass just to flip
  // `open` back to false a tick after the real navigation.
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
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10"
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

      {open && (
        <>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[calc(4rem+var(--safe-top))] z-40 bg-black/20 backdrop-blur-[1px] dark:bg-black/40"
          />
          <nav className="absolute inset-x-0 top-full z-50 flex flex-col gap-1 border-b border-black/10 bg-background p-4 shadow-lg dark:border-white/10">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-foreground/85 transition-colors hover:bg-foreground/10"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={ctaHref}
              className="mt-2 flex min-h-11 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
            >
              {ctaLabel}
            </Link>
          </nav>
        </>
      )}
    </div>
  );
}
