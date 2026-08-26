"use client";

import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import { hapticTap } from "@/lib/haptics";

export interface TabItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  label: string;
  className?: string;
  /** Link-mode (e.g. /profile?tab=x, URL is the source of truth). Omit and pass onSelect for local-state tabs instead. */
  getHref?: (id: string) => LinkProps["href"];
  onSelect?: (id: string) => void;
}

// Active tab is bg-primary now, not the old bg-foreground (graphite) — that
// was one of the three competing "primary" accents the audit flagged (see
// AUDIT.md §2); every active/selected state in the app should converge on
// the one primary color.
const TAB_BASE =
  "tap flex min-h-11 flex-shrink-0 scroll-mx-4 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const TAB_ACTIVE = "bg-primary text-white";
const TAB_INACTIVE = "text-foreground/70 hover:text-foreground active:text-foreground";

export default function Tabs({ items, activeId, label, className = "", getHref, onSelect }: TabsProps) {
  return (
    // The fade masks are a cheap scroll-affordance fix for AUDIT.md's
    // "profile tabs look cut off, no hint that the row scrolls" finding —
    // pure CSS, no JS, no extra markup per tab.
    <div
      className="relative"
      style={{
        maskImage: "linear-gradient(to right, transparent 0, black 12px, black calc(100% - 12px), transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, black 12px, black calc(100% - 12px), transparent 100%)",
      }}
    >
      <nav
        role="tablist"
        aria-label={label}
        className={`flex gap-1 overflow-x-auto rounded-full border border-black/10 bg-white/60 p-1 dark:border-white/15 dark:bg-white/5 ${className}`}
      >
        {items.map((item) => {
          const active = item.id === activeId;
          const cls = `${TAB_BASE} ${active ? TAB_ACTIVE : TAB_INACTIVE}`;
          if (getHref) {
            return (
              <Link
                key={item.id}
                href={getHref(item.id)}
                role="tab"
                aria-selected={active}
                className={cls}
                onClick={() => hapticTap()}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={cls}
              onClick={() => {
                hapticTap();
                onSelect?.(item.id);
              }}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
