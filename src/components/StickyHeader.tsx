"use client";

import type { ReactNode } from "react";
import { usePinnedLayer } from "@/lib/usePinnedLayer";

/**
 * Шапка сайта, поставленная на ОБЩИЙ УЧЁТ прижатых слоёв
 * (src/lib/pinned-layers.ts).
 *
 * Отдельный компонент, а не `ref` прямо в `Navbar.tsx`, по одной
 * причине: `Navbar` — СЕРВЕРНЫЙ компонент (он зовёт `getCurrentUser`),
 * а хук учёта можно позвать только в клиентском. Внутрь по-прежнему
 * передаётся серверное дерево — клиентской границей становится ровно
 * одна рама, без единого серверного узла в ней.
 *
 * Места в конце документа шапка не резервирует (`reserve` не ставится):
 * она `position: sticky` и своё место в потоке занимает сама. На учёте
 * она ради ДРУГОЙ половины — чтобы карточка перевода и доводка клетки
 * кроссворда знали, что верх окна занят, и не ставили ничего под неё.
 */
export default function StickyHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const pinnedRef = usePinnedLayer<HTMLElement>({ edge: "top", label: "Navbar" });
  return (
    <header ref={pinnedRef} className={className}>
      {children}
    </header>
  );
}
