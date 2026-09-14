"use client";

import Link from "next/link";
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
  /**
   * Link-mode (e.g. /profile?tab=x, URL is the source of truth): each tab
   * links to `${hrefBase}?tab=${id}`. A plain string, not a function — Tabs
   * is a Client Component, and a Server Component caller (profile/page.tsx)
   * can't pass a function prop across that boundary. Omit and pass onSelect
   * for local-state tabs instead.
   */
  hrefBase?: string;
  onSelect?: (id: string) => void;
}

// Active tab is bg-primary now, not the old bg-foreground (graphite) — that
// was one of the three competing "primary" accents the audit flagged (see
// AUDIT.md §2); every active/selected state in the app should converge on
// the one primary color.
// `grow` next to `flex-shrink-0` is the whole fix for the empty tail on the
// right of the strip, and the two flags do not fight: shrink-0 keeps every
// pill at its intrinsic width when the row does not fit (so the strip
// scrolls, exactly as before), and grow hands out the LEFTOVER space when it
// does. Measured on /profile before the change: the bar is 710px of inner
// width, the five pills come to 548 (ru) / 557 (es), and the last 154–163px
// were bare bar at 768, 820, 834 and 1024 alike — the strip was drawn full
// width and filled to content. There is no width at which both apply, so
// nothing about the narrow behaviour changes.
const TAB_BASE =
  "tap flex min-h-11 grow flex-shrink-0 scroll-mx-4 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const TAB_ACTIVE = "bg-primary text-white";
const TAB_INACTIVE = "text-foreground/70 hover:text-foreground active:text-foreground";

export default function Tabs({ items, activeId, label, className = "", hrefBase, onSelect }: TabsProps) {
  return (
    // The fade mask is a cheap scroll-affordance fix for AUDIT.md's
    // "profile tabs look cut off, no hint that the row scrolls" finding —
    // pure CSS, no JS, no extra markup per tab.
    //
    // ЛЕВОГО КРАЯ У МАСКИ БОЛЬШЕ НЕТ, И ЭТО ПОЧИНКА, А НЕ ВКУС (долг 189).
    // Владелец снял на живом телефоне: «полоса вкладок кабинета срезана
    // слева, первый пункт нечитаем». Замер на 360 px подтвердил причину
    // ровно: полоса 328 px при содержимом 556 px, то есть она прокручена в
    // НАЧАЛО и остаётся там, пока человек её не тронет; первая плитка
    // начинается в 5 px от края, а маска гасила всё до 12 px — то есть
    // 7 px активной плитки (она залита `bg-primary`) и всю левую скруглину
    // рамки, ВСЕГДА, а не когда слева действительно что-то скрыто.
    // Подсказка «строка прокручивается» нужна там, где содержимое реально
    // уходит за край, — справа; слева при `scrollLeft = 0` скрывать нечего.
    // Сделать градиент зависящим от прокрутки без JS нечем: `scroll()` как
    // временную шкалу WebKit не поддерживает вовсе, а в этом проекте
    // оболочка собирается и под iOS.
    <div
      className="relative"
      style={{
        maskImage: "linear-gradient(to right, black 0, black calc(100% - 12px), transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, black 0, black calc(100% - 12px), transparent 100%)",
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
          if (hrefBase) {
            return (
              <Link
                key={item.id}
                href={`${hrefBase}?tab=${item.id}`}
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
