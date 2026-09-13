"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  getKeyboardOpenServerSnapshot,
  getKeyboardOpenSnapshot,
  registerPinnedLayer,
  subscribeToPinnedLayers,
  type PinnedEdge,
} from "@/lib/pinned-layers";

/**
 * Поставить прижатый к краю окна слой на ОБЩИЙ УЧЁТ (src/lib/pinned-layers.ts).
 *
 * Один вызов в самом слое — и больше ничего: ни `<body>`, ни карточка
 * перевода, ни доводка клетки кроссворда про новый слой не узнают и
 * править их не придётся. Ровно это и есть закрытие долга 161: до него
 * каждый из пяти прижатых слоёв знал только себя.
 *
 *   const ref = usePinnedLayer<HTMLElement>({ edge: "bottom", reserve: true, label: "BottomNav" });
 *   return <nav ref={ref} className="fixed inset-x-0 bottom-0 …" />;
 *
 * `active` — для слоя, который в разметке есть всегда, а на учёте обязан
 * стоять не всегда (панель, снятая на время поднятой клавиатуры).
 */
export function usePinnedLayer<T extends HTMLElement>({
  edge,
  reserve = false,
  label,
  active = true,
}: {
  edge: PinnedEdge;
  reserve?: boolean;
  label?: string;
  active?: boolean;
}) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !active) return;
    return registerPinnedLayer(element, { edge, reserve, label });
  }, [edge, reserve, label, active]);
  return ref;
}

/**
 * Поднята ли сейчас экранная клавиатура.
 *
 * Читается через `useSyncExternalStore`, а не через `useState` в эффекте:
 * серверный снимок здесь обязан быть `false`, иначе первый клиентский
 * рендер разойдётся с разметкой сервера.
 */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(
    subscribeToPinnedLayers,
    getKeyboardOpenSnapshot,
    getKeyboardOpenServerSnapshot,
  );
}
