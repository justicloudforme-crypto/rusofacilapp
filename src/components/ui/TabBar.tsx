"use client";

import type { ReactNode } from "react";

export interface TabBarItem<T extends string = string> {
  id: T;
  label: ReactNode;
}

/**
 * Shared text-based tab bar: single row, horizontal scroll (never wraps to
 * a second line), active tab marked by a 2px underline — no outer
 * bordering container around the group. Distinct from `ui/Tabs.tsx` (the
 * filled-pill segmented-control style already used on /profile, the
 * flashcards vocabulary picker, styleguide, and the pricing cards) —
 * that component stays as-is, this one is for section/type tabs that read
 * as text navigation rather than a toggle control.
 *
 * Keeps the `role="tablist"`/`role="tab"` aria pattern the call sites
 * already used before this component existed.
 */
export default function TabBar<T extends string = string>({
  items,
  activeId,
  onSelect,
  label,
  className = "",
}: {
  items: TabBarItem<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  /** Accessible name for the tablist (not visible). */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex min-h-11 flex-nowrap gap-5 overflow-x-auto ${className}`}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(item.id)}
            className={`tap flex-shrink-0 whitespace-nowrap border-b-2 px-1 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-primary text-foreground"
                : "border-transparent text-foreground/60 hover:text-foreground active:text-foreground"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
