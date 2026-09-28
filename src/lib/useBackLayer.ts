"use client";

import { useEffect, useRef } from "react";
import { pushBackLayer } from "@/lib/back-layers";

/**
 * Слой (лист, меню, окно) встаёт на учёт кнопки «Назад» Android, пока
 * `active` (заход 7.242, долг 347; устройство — `src/lib/back-layers.ts`).
 * `onClose` читается через ref: слой не переставляется в стеке от того,
 * что родитель отрисовался заново и передал новую функцию.
 */
export function useBackLayer(active: boolean, onClose: () => void): void {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!active) return;
    return pushBackLayer(() => close.current());
  }, [active]);
}
