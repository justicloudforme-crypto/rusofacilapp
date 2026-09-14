"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { PlanId } from "@/lib/plans";
import { nativeLockBody, type LockedKind, type NativeAccessCopy } from "@/lib/native-access-copy";
import NativeLockedModal from "@/components/native/NativeLockedModal";
import PaywallModal, { type PaywallModalDict, type PaywallPlanCopy } from "@/components/subscription/PaywallModal";

export type PaywallReason = "free" | "premium";

interface PaywallContextValue {
  /**
   * Открывает окно поверх закрытого материала.
   *
   * В ВЕБЕ это прежняя модалка с тремя планами, кнопки которой уходят в
   * `/api/checkout` и возвращаются обратно по `next` — не тронута ни одной
   * строкой.
   *
   * ВНУТРИ ПРИЛОЖЕНИЯ это замок и объяснение, без единой платной кнопки
   * (долг 179). До 13.09.2026 здесь звалась витрина RevenueCat, которая
   * молча отвечала отказом, потому что SDK не сконфигурирован, — снаружи
   * это выглядело как кнопка, не делающая ничего.
   */
  openPaywall: (reason?: PaywallReason, kind?: LockedKind) => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function PaywallProvider({
  lang,
  dict,
  plans,
  priceNote,
  nativeLock,
  children,
}: {
  lang: Locale;
  dict: PaywallModalDict;
  plans: Record<PlanId, PaywallPlanCopy>;
  /** The conversion footnote, or undefined when the prices above it are
   * already in the reader's own money (Mexico) or could not be converted.
   * Built on the server — see src/lib/pricing-display.ts. */
  priceNote?: string;
  /**
   * Тексты замка ВНУТРИ ПРИЛОЖЕНИЯ, или null в вебе (долг 179).
   *
   * Признак приходит с СЕРВЕРА (`isNativeShellRequest()` в корневом
   * макете), а не спрашивается у Capacitor на клиенте, и это важно по
   * двум причинам сразу. Первая: сервер и клиент обязаны судить об
   * оболочке ОДИНАКОВО, иначе страница цен отдаётся честная, а окно
   * поверх неё — платное. Вторая: `null` в вебе весит несколько байт, а
   * сами строки во flight-разметку веба не уезжают вовсе (цена любой
   * строки здесь — её вес, умноженный на 1913 адресов; замер 7.183).
   */
  nativeLock: NativeAccessCopy["lock"] | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<PaywallReason>("free");
  /**
   * ТИП МАТЕРИАЛА, ПО КОТОРОМУ ОТКРЫЛОСЬ ОКНО — 7.196, часть 3.
   *
   * Умолчание — "lesson", и оно НЕ «на всякий случай»: это ровно тот
   * текст, который стоял здесь один на всё до правки, и на него приходят
   * только вызовы, забывшие назвать тип. Сторож требует, чтобы таких
   * вызовов не было ни одного, — перепись берётся из исходников.
   */
  const [kind, setKind] = useState<LockedKind>("lesson");

  const openPaywall = useCallback((nextReason: PaywallReason = "free", nextKind: LockedKind = "lesson") => {
    setReason(nextReason);
    setKind(nextKind);
    setOpen(true);
  }, []);

  const value = useMemo<PaywallContextValue>(() => ({ openPaywall }), [openPaywall]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      {/* Внутри приложения окно ровно одно, и в нём нет ни одной
          платной кнопки. Веб-модалка при этом не рендерится вовсе —
          не «прячется», а не существует в дереве. */}
      {nativeLock ? (
        <NativeLockedModal
          open={open}
          onClose={() => setOpen(false)}
          copy={nativeLock}
          body={nativeLockBody(lang, kind, reason === "premium")}
        />
      ) : (
        <PaywallModal
          lang={lang}
          open={open}
          reason={reason}
          next={pathname}
          dict={dict}
          plans={plans}
          priceNote={priceNote}
          onClose={() => setOpen(false)}
        />
      )}
    </PaywallContext.Provider>
  );
}

/** Call from any client component to trigger the paywall — e.g. when a
 * gated fetch comes back `limited: true`/403, or when the user taps a
 * visibly Premium-locked tile (★ word game, C1 category). Pass
 * reason: "premium" when the visitor already has an active subscription
 * but this specific content needs the Premium/lifetime plan specifically. */
export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be used within a PaywallProvider");
  return ctx;
}
