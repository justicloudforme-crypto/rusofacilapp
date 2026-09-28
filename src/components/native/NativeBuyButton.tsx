"use client";

import { usePaywall, type PaywallReason } from "@/contexts/PaywallContext";
import type { LockedKind } from "@/lib/native-access-copy";

/**
 * Кнопка на карточке замка ВНУТРИ ОБОЛОЧКИ, КОТОРАЯ УМЕЕТ ПОКУПАТЬ —
 * заход 7.242, долг 346. Открывает то же окно, что тап по закрытой плитке
 * каталога (`NativeLockedLink`), а в нём при `canBuyInsideShell` стоит
 * панель покупки Google Play (`PaywallContext`). Своей покупки у кнопки
 * нет: путь к оплате один, и он в окне.
 *
 * Рисуется только когда сервер решил `canBuyInsideShell()` — в вебе и в
 * старых оболочках её нет в дереве вовсе.
 */
export default function NativeBuyButton({
  label,
  reason,
  kind,
}: {
  label: string;
  reason: PaywallReason;
  kind: LockedKind;
}) {
  const { openPaywall } = usePaywall();
  return (
    <button
      type="button"
      data-rf-native-buy={kind}
      onClick={() => openPaywall(reason, kind)}
      className="tap mt-4 inline-flex min-h-11 items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
    >
      {label}
    </button>
  );
}
