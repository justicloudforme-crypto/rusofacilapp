"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { useRevenueCat } from "@/hooks/useRevenueCat";
import { getCurrentOffering, purchasePackage } from "@/lib/revenuecat-client";

export interface NativePricingDict {
  heading: string;
  subtitle: string;
  loading: string;
  emptyHeading: string;
  emptyBody: string;
  errorHeading: string;
  errorBody: string;
  retry: string;
  buyCta: string;
  restoreButton: string;
  restoreNothing: string;
  activeHeading: string;
  activeBody: string;
  manageButton: string;
  elsewhereHeading: string;
  elsewhereBody: string;
  storeNote: string;
}

type Status = "loading" | "ready" | "failed";

/**
 * Витрина покупки ВНУТРИ приложения (долг 79).
 *
 * Что она заменяет. До 12.09.2026 страница цен внутри нативной оболочки
 * была той же самой веб-страницей: три формы `action="/api/checkout"`,
 * уводящие на внешнюю оплату. App Store 3.1.1 и Google Play Payments это
 * запрещают, и это отклонение на ревью, а не замечание. Решение владельца
 * от 11.09.2026: внутри приложения покупка идёт ТОЛЬКО через магазин —
 * увод на внешнюю оплату разрешён лишь в США, ЕС и нескольких отдельных
 * странах, а Мексика и Латинская Америка, то есть основные рынки проекта,
 * в этот список не входят.
 *
 * Цены здесь НЕ наши. Печатается `priceString` из магазина — строка,
 * которую Apple и Google собрали сами из базовой цены в песо по своей
 * таблице для страны покупателя. Поэтому в этом файле нет ни одной цифры
 * цены и быть не должно.
 *
 * ПУСТОЙ СПИСОК ПРОДУКТОВ — ЭТО НОРМАЛЬНОЕ СОСТОЯНИЕ, А НЕ ОШИБКА.
 * На 12.09.2026 продуктов в консолях магазинов не существует вовсе
 * (аккаунта Apple нет, карточка приложения в Play не заведена), значит
 * первая же сборка получит от RevenueCat офферинг без пакетов — или не
 * получит офферинга вообще. Здесь это отдельное состояние с понятным
 * текстом, а не белый экран, не вечный индикатор и не падение.
 */
export default function NativePricingPanel({
  userId,
  dict,
  hasAccessElsewhere,
}: {
  userId: string | null;
  dict: NativePricingDict;
  /** Право доступа, УЖЕ активное у аккаунта и полученное не в этом
   * магазине: оплата на сайте, код доступа, сотрудник. Считает сервер
   * (getEntitlementTier), а не эта витрина — источник оплаты на доступ не
   * влияет, поэтому покупать второй раз тут нечего. */
  hasAccessElsewhere: boolean;
}) {
  const router = useRouter();
  const { loading: sdkLoading, isPro, restore, openCustomerCenter } = useRevenueCat(userId);
  const [status, setStatus] = useState<Status>("loading");
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [restoredNothing, setRestoredNothing] = useState(false);
  // Счётчик попыток, а не функция загрузки: кнопка «Повторить» его
  // увеличивает, и эффект ниже перезапускается. Вызов общей `load()` из
  // эффекта пришлось бы начинать с `setStatus("loading")` прямо в теле
  // эффекта — это ловит правило react-hooks/set-state-in-effect, и ловит
  // по делу: лишний синхронный проход рендера на каждом заходе.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Пока SDK настраивается, спрашивать офферинги бессмысленно:
    // getCurrentOffering() до configure() отдаёт null, и пустой список
    // показался бы там, где он ещё ничего не значит.
    if (sdkLoading) return;
    let cancelled = false;
    void (async () => {
      try {
        const offering = await getCurrentOffering();
        if (cancelled) return;
        setPackages(offering?.availablePackages ?? []);
        setStatus("ready");
      } catch {
        // Связи нет, магазин не отвечает, ключ не настроен — всё это одно
        // и то же для читателя: список показать не получилось. Отдельное
        // состояние от «продуктов нет»: там повторять нечего, здесь есть.
        if (cancelled) return;
        setPackages([]);
        setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sdkLoading, attempt]);

  const retry = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  const buy = useCallback(
    async (pkg: PurchasesPackage) => {
      setBusy(pkg.identifier);
      try {
        await purchasePackage(pkg);
        router.refresh();
      } catch {
        // Отмена покупки пользователем приходит сюда же, поэтому это не
        // ошибка витрины: просто ничего не изменилось.
      } finally {
        setBusy(null);
      }
    },
    [router]
  );

  const onRestore = useCallback(async () => {
    setRestoredNothing(false);
    setBusy("restore");
    await restore();
    setBusy(null);
    // Кнопка «Восстановить покупки» обязательна для ревью Apple, и она
    // обязана что-то ГОВОРИТЬ: молчаливая кнопка неотличима от сломанной.
    setRestoredNothing(true);
    router.refresh();
  }, [restore, router]);

  const section = "rounded-2xl border border-black/10 p-5 dark:border-white/30 sm:p-6";

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict.heading}</h1>
      <p className="mt-3 text-foreground/70">{dict.subtitle}</p>

      <div className="mt-10 flex flex-col gap-4">
        {isPro ? (
          <section className={section}>
            <h2 className="font-medium">{dict.activeHeading}</h2>
            <p className="mt-2 text-sm text-foreground/70">{dict.activeBody}</p>
            <button
              type="button"
              onClick={() => void openCustomerCenter()}
              className="mt-4 w-full rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] sm:w-auto"
            >
              {dict.manageButton}
            </button>
          </section>
        ) : hasAccessElsewhere ? (
          <section className={section}>
            <h2 className="font-medium">{dict.elsewhereHeading}</h2>
            <p className="mt-2 text-sm text-foreground/70">{dict.elsewhereBody}</p>
          </section>
        ) : sdkLoading || status === "loading" ? (
          <section className={section} aria-busy="true">
            <p className="text-sm text-foreground/70">{dict.loading}</p>
          </section>
        ) : status === "failed" ? (
          <section className={section}>
            <h2 className="font-medium">{dict.errorHeading}</h2>
            <p className="mt-2 text-sm text-foreground/70">{dict.errorBody}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 w-full rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] sm:w-auto"
            >
              {dict.retry}
            </button>
          </section>
        ) : packages.length === 0 ? (
          <section className={section}>
            <h2 className="font-medium">{dict.emptyHeading}</h2>
            <p className="mt-2 text-sm text-foreground/70">{dict.emptyBody}</p>
          </section>
        ) : (
          packages.map((pkg) => (
            <section key={pkg.identifier} className={section}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">{pkg.product.title}</h2>
                <span className="text-xl font-semibold">{pkg.product.priceString}</span>
              </div>
              {pkg.product.description && (
                <p className="mt-2 text-sm text-foreground/70">{pkg.product.description}</p>
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void buy(pkg)}
                className="mt-4 w-full rounded-full bg-foreground px-5 py-2.5 text-center text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-60"
              >
                {dict.buyCta}
              </button>
            </section>
          ))
        )}

        {/* Обязательна на ревью Apple и показывается ВСЕГДА — в том числе
            при пустом списке продуктов: человек, переустановивший
            приложение, восстанавливает покупку именно ей. */}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void onRestore()}
          className="w-full rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/[.06]"
        >
          {dict.restoreButton}
        </button>
        {restoredNothing && !isPro && (
          <p role="status" className="text-center text-sm text-foreground/60">
            {dict.restoreNothing}
          </p>
        )}
        <p className="text-center text-xs text-foreground/50">{dict.storeNote}</p>
      </div>
    </div>
  );
}
