"use client";

import type { ReactNode } from "react";
import { ACCESS_MARK_ICON, type AccessRequirement } from "@/lib/access-marks";

export interface FilterChipOption<T extends string = string> {
  id: T;
  label: ReactNode;
  /**
   * ЗНАК ПЛАТНОСТИ НА ФИШКЕ ФИЛЬТРА — 7.196, часть 1.
   *
   * Рисуется здесь, а не собирается вызывающим в строку, по двум
   * причинам сразу. Первая: глиф объявлен ровно в одном месте
   * (`ACCESS_MARK_ICON`), и `check:access-marks` требует, чтобы узел с
   * ним нёс `data-access-mark`, — строка «C1 👑» этого нести не может.
   * Вторая: без этого признака прибор отрисованных поверхностей читает
   * текст метки как подпись ОРГАНА управления, и «C1 👑 Только Premium»
   * становится ложной находкой (замер 7.195: 2 подписи из 4).
   */
  accessMark?: Exclude<AccessRequirement, "free">;
  /** Подпись знака из словаря сайта. */
  accessLabel?: string;
}

/**
 * Shared chip style: primary-filled when active, primary-outlined when
 * not — replaces the black/gray-bordered pill style previously hand-copied
 * across stories/media/word-games filters (`bg-foreground text-background`
 * active state, `border-black/10` inactive). Exported standalone so a
 * single toggle chip (e.g. the stories "только классика" filter) can reuse
 * the exact same visual language without being forced into a
 * <FilterChipGroup> of one relevant option plus an "off" state.
 */
export function filterChipClass(active: boolean): string {
  return `tap inline-flex min-h-11 flex-shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-primary text-white"
      : "border border-primary/20 text-foreground/70 hover:text-foreground active:text-foreground dark:border-primary-400/30"
  }`;
}

/**
 * One row of horizontally-scrolling filter chips under a small uppercase
 * label (e.g. УРОВЕНЬ / NIVEL). Never wraps to a second line — scrolls
 * instead, same convention as `ui/TabBar.tsx`.
 */
export default function FilterChipGroup<T extends string = string>({
  label,
  options,
  activeId,
  onChange,
  className = "",
  testId,
}: {
  /** Small uppercase-tracked label rendered above the chip row. Omit for a
   * chip row that doesn't need its own heading (rare — most groups should
   * have one, per the design spec). */
  label?: string;
  options: FilterChipOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
  /** Признак для сторожа знаков (`check:access-signs`): по нему полоса
   *  находится на экране, а не по классам разметки. */
  testId?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <span className="block text-xs font-semibold uppercase tracking-wide text-foreground/50">{label}</span>
      )}
      <div data-testid={testId} className={`flex gap-2 overflow-x-auto ${label ? "mt-2" : ""}`}>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            data-level={opt.id}
            onClick={() => onChange(opt.id)}
            aria-pressed={activeId === opt.id}
            className={filterChipClass(activeId === opt.id)}
          >
            {opt.label}
            {opt.accessMark && (
              <span data-access-mark={opt.accessMark} aria-hidden className="ml-1" title={opt.accessLabel}>
                {ACCESS_MARK_ICON[opt.accessMark]}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
