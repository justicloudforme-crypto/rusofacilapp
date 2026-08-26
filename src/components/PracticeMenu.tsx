"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Dropdown from "@/components/ui/Dropdown";

export interface PracticeLink {
  href: string;
  label: string;
  icon?: ReactNode;
}

/**
 * Desktop-only "Практика" dropdown: Рассказы / Аудио и видео / Слова /
 * Игры со словами (+ Группы for a logged-in user — a way to practice
 * together, not an account setting, so it lives here rather than in the
 * profile dropdown). Replaces 4-5 flat top-level nav links that used to
 * wrap to a second line around tablet width (AUDIT.md's confirmed bug) —
 * fixed by construction: these items now live inside a fixed-width panel,
 * not the shrinking flex row.
 */
export default function PracticeMenu({ label, links }: { label: string; links: PracticeLink[] }) {
  const pathname = usePathname();
  const active = links.some((link) => pathname.startsWith(link.href));

  return (
    <Dropdown
      align="left"
      panelClassName="w-56"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`tap flex items-center gap-1 rounded-full px-1 py-1 text-sm font-medium transition-colors hover:text-primary active:text-primary ${
            active ? "text-primary" : ""
          }`}
        >
          {label}
          <svg aria-hidden viewBox="0 0 20 20" fill="none" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          role="menuitem"
          className="tap flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-foreground/85 transition-colors hover:bg-foreground/10 active:bg-foreground/10"
        >
          {link.icon && (
            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-foreground/50">{link.icon}</span>
          )}
          {link.label}
        </Link>
      ))}
    </Dropdown>
  );
}
