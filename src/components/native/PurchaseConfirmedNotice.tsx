"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePinnedLayer } from "@/lib/usePinnedLayer";
import { useBackLayer } from "@/lib/useBackLayer";

/**
 * «¡LISTO! TU SUSCRIPCIÓN ESTÁ ACTIVA» ПОВЕРХ СТРАНИЦЫ — ЗАХОД 7.264.
 *
 * Видео первой настоящей покупки (13.10.2026): после «Se completó la
 * suscripción» и листа «Puntos de Google Play» наша шторка на 18,5–19,0 с
 * ещё говорила «Completando la compra…», на 19,5 с её уже не было, и
 * человек вернулся к списку рассказов без единого слова об успехе. Строка
 * «Listo: tu acceso ya está abierto.» существует, но живёт ВНУТРИ шторки
 * (`NativePurchasePanel`), а шторку закрыли раньше, чем сервер ответил.
 * Кто её закрыл (жест «назад», ✕, тап по фону), без журнала телефона не
 * назвать — и это не нужно: подтверждение теперь не зависит от шторки.
 *
 * Показывается ровно тогда, когда сервер назвал новый уровень доступа
 * («granted»), а экрана покупки на виду нет. Ничего не утверждает сам:
 * текст выбирается по уровню, который назвал сервер.
 */
const SHOW_MS = 8_000;

function subscribeNever() {
  return () => {};
}

export default function PurchaseConfirmedNotice({
  message,
  closeLabel,
  onDone,
}: {
  message: string;
  closeLabel: string;
  onDone: () => void;
}) {
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(true);
  // «Назад» Android сначала закрывает подтверждение, а не уходит со
  // страницы (`NativeBackButtonHandler`, долг 347).
  useBackLayer(open, () => setOpen(false));
  const pinnedRef = usePinnedLayer<HTMLDivElement>({ edge: "bottom", label: "PurchaseConfirmedNotice", active: open });

  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) onDone();
  }, [open, onDone]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={pinnedRef}
      role="status"
      aria-live="polite"
      data-testid="purchase-confirmed"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4 pb-safe"
    >
      <div className="animate-celebration-fade-in pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl bg-foreground py-1.5 pl-4 pr-1.5 text-sm font-medium text-background shadow-lg">
        <span aria-hidden>✓</span>
        <span className="py-1.5">{message}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={closeLabel}
          className="tap flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-background/80"
        >
          <span aria-hidden>✕</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
