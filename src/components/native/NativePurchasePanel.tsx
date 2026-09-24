"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";
import type { Locale } from "@/i18n/config";
import type { NativeAccessCopy } from "@/lib/native-access-copy";
import { loadStore, purchasePackage, restorePurchases, storeFailureCode } from "@/lib/revenuecat-client";
import {
  activationState,
  readTier,
  startActivationWatch,
  subscribeActivation,
} from "@/lib/access-activation";
import type { StoreFailure, StoreStep } from "@/lib/revenuecat-client";

/**
 * ЕДИНСТВЕННЫЙ ЭКРАН ПОКУПКИ ВНУТРИ ПРИЛОЖЕНИЯ — заход 7.224.
 *
 * Сюда ведут ВСЕ замки оболочки: окно поверх закрытого материала, страница
 * цен внутри приложения, метка «👑 Solo Premium». Один экран, а не пять
 * похожих: пять мест, рисующих покупку, — это пять мест, где она может
 * разойтись (ровно так жил долг 191).
 *
 * ЧЕТЫРЕ ПРАВИЛА, КОТОРЫЕ ЭТОТ ФАЙЛ ОБЯЗАН СОБЛЮДАТЬ, И ИХ СТОРОЖИТ
 * `npm run check:native-purchase`:
 *
 *   1. ЦЕНА — СТРОКОЙ ИЗ МАГАЗИНА (`pkg.product.priceString`). Ни одной
 *      цифры цены здесь нет и быть не может: в Play месяц стоит 149 песо,
 *      на сайте — 150, и записанное число однажды соврало бы.
 *   2. НИ СЛОВА О ПЛАТЁЖНЫХ СИСТЕМАХ (долг 196). Системный лист покупки
 *      рисует магазин — это не наш интерфейс.
 *   3. НИ ОДНОГО ВХОДА НА ВЕБ-КАССУ (долг 79): ни `/api/checkout`, ни
 *      `/pricing`, ни OXXO.
 *   4. ДОСТУП ОТКРЫВАЕТ СЕРВЕР, А НЕ ЭТОТ ЭКРАН. Магазин подтверждает
 *      ОПЛАТУ; право доступа появляется, когда вебхук RevenueCat допишет
 *      строку `Subscription`. Поэтому после покупки экран честно говорит
 *      «активируем» и СПРАШИВАЕТ СЕРВЕР, а не рисует «готово» сам. Ложное
 *      «готово» — худшее, что тут можно сделать: человек заплатил и
 *      упёрся бы в тот же замок.
 */

type Stage =
  | { kind: "loading" }
  | { kind: "ready" }
  /** Отказ с ИМЕНЕМ. До 7.225 здесь стоял безымянный `unavailable`, и
   *  четыре разные причины выглядели одинаково — см. `native-access-copy.ts`. */
  | { kind: "unavailable"; reason: StoreFailure; step: StoreStep; code: string }
  | { kind: "buying" }
  | { kind: "activating" }
  | { kind: "activated" }
  | { kind: "slow" }
  | { kind: "pending" }
  | { kind: "offline" }
  | { kind: "failed" }
  | { kind: "restoredNothing" }
  | { kind: "restoredExpired" };

export default function NativePurchasePanel({
  lang,
  copy,
  userId,
  next,
  withHeading = true,
}: {
  lang: Locale;
  copy: NativeAccessCopy["purchase"];
  /** `null` — человек не вошёл. Покупать может только вошедший: покупка
   *  привязывается к учётной записи САЙТА через `logIn`, и у анонима
   *  привязывать её не к чему. */
  userId: string | null;
  /** Куда вернуться после входа. */
  next: string;
  /** `false` там, где заголовок и вступление уже напечатаны рамой
   *  (страница цен внутри приложения) — иначе они стояли бы дважды. */
  withHeading?: boolean;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const alive = useRef(true);
  /**
   * Уровень доступа ДО покупки. Спрашивается у сервера здесь, на клиенте,
   * а не приезжает свойством с сервера — и это не мелочь: свойство с
   * сервера означало бы ещё одно чтение базы на КАЖДОЙ странице сайта,
   * включая 1913 страниц в браузере, где покупки нет вовсе. Экран живёт
   * только внутри приложения, и платит за этот вопрос только он.
   */
  const baselineTier = useRef<string | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * Чтение магазина БЕЗ единого setState — только данные.
   *
   * Разделение не косметическое: состояние, выставленное синхронно внутри
   * эффекта, даёт каскадную отрисовку (за этим следит правило
   * `react-hooks/set-state-in-effect`). Здесь эффект получает результат и
   * ставит состояние уже после ожидания, а кнопка «Повторить» ставит
   * «загружаем» сама — ей это нужно, иначе нажатие выглядит как
   * ничего не делающее.
   *
   * ЦЕПОЧКИ ОБРАЩЕНИЙ К МАГАЗИНУ ЗДЕСЬ БОЛЬШЕ НЕТ — заход 7.225. До этого
   * экран сам звал `configureRevenueCat` → `loginRevenueCat` →
   * `getCurrentOffering` и сводил ЛЮБОЙ исход в одно немое `null`. Весь
   * путь переехал в `loadStore()`, и он отвечает НАЗВАННЫМ исходом с
   * шагом и коротким кодом. Обещание `loadStore` — она всегда
   * завершается; экран, который может ждать вечно, и был дефектом.
   */
  const readStore = useCallback(async (uid: string) => {
    // Уровень доступа ДО покупки спрашиваем ПЕРВЫМ и отдельно: это наш
    // сервер, а не магазин, и его отказ не должен выглядеть как отказ
    // магазина. Не дождались — покупка всё равно возможна, просто
    // сравнивать будет не с чем, и ожидание доступа упрётся в свой срок.
    try {
      baselineTier.current = await readTier();
    } catch {
      baselineTier.current = null;
    }
    return loadStore(uid);
  }, []);

  /**
   * КАЖДЫЙ ОТКАЗ — СОБЫТИЕ В SENTRY, И В НЁМ НАЗВАН ШАГ.
   *
   * Личных данных не отправляется: ни `userId`, ни почты, ни чего-либо
   * ещё об учётной записи — только имя исхода, шаг и код. Этого хватает,
   * чтобы отличить «оболочка старая» от «магазин молчит» и от «аккаунт не
   * в списке тестировщиков», а больше ничего для этого и не нужно.
   */
  const report = useCallback((reason: StoreFailure, step: StoreStep) => {
    Sentry.captureMessage(`NativeStorePurchaseBlocked: ${reason}`, {
      level: "warning",
      tags: { area: "native-purchase", reason, step, code: storeFailureCode(reason, step) },
    });
  }, []);

  const apply = useCallback(
    (found: Awaited<ReturnType<typeof loadStore>>) => {
      if (!found.ok) {
        report(found.reason, found.step);
        setStage({ kind: "unavailable", reason: found.reason, step: found.step, code: found.code });
        return;
      }
      setPackages(found.packages);
      // Шторку могли закрыть и открыть снова, пока доступ активируется:
      // тогда список вариантов показывать нечего, разговор уже идёт.
      const live = activationState();
      if (live.kind === "waiting") setStage({ kind: "activating" });
      else if (live.kind === "granted") setStage({ kind: "activated" });
      else if (live.kind === "slow") setStage({ kind: "slow" });
      else setStage({ kind: "ready" });
    },
    [report],
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const found = await readStore(userId);
      if (cancelled || !alive.current) return;
      apply(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [apply, readStore, userId]);

  const retry = useCallback(() => {
    if (!userId) return;
    setStage({ kind: "loading" });
    void (async () => {
      const found = await readStore(userId);
      if (!alive.current) return;
      apply(found);
    })();
  }, [apply, readStore, userId]);

  /**
   * ОЖИДАНИЕ ДОСТУПА НАЧИНАЕТСЯ ЗДЕСЬ, НО ЖИВЁТ НЕ ЗДЕСЬ — ДОЛГ 304.
   *
   * До 24.09.2026 весь цикл ожидания стоял в этом компоненте, и в нём
   * было два выхода по `alive.current` — оба ПЕРЕД `router.refresh()`.
   * Значит закрытая шторка (а она закрывается: возврат из системного
   * листа Google Play, кнопка «назад», пересоздание окна) убивала не
   * лишний `setState`, а саму перерисовку страницы: оплата прошла,
   * сервер доступ открыл, а замки на странице уровня остались.
   * Воспроизведено прогоном 24.09.2026 — 32 знака платного и через 15
   * секунд после выдачи доступа.
   *
   * Теперь ожидание живёт в модуле (`src/lib/access-activation.ts`), у
   * которого нет ни монтирования, ни размонтирования, а перечитывает
   * страницу `NativeStoreIdentity` — он в оболочке смонтирован всегда.
   * Этот экран лишь ПОКАЗЫВАЕТ ход дела, пока открыт.
   */
  const waitForAccess = useCallback(async () => {
    setStage({ kind: "activating" });
    await startActivationWatch(baselineTier.current);
  }, []);

  /** Ход ожидания приходит подпиской — в том числе если шторку закрыли и
   *  открыли снова, пока доступ активируется. */
  useEffect(
    () =>
      subscribeActivation((live) => {
        if (!alive.current) return;
        if (live.kind === "waiting") setStage({ kind: "activating" });
        else if (live.kind === "granted") setStage({ kind: "activated" });
        else if (live.kind === "slow") setStage({ kind: "slow" });
      }),
    [],
  );

  const buy = useCallback(
    async (pkg: PurchasesPackage) => {
      setStage({ kind: "buying" });
      const outcome = await purchasePackage(pkg);
      if (!alive.current) return;
      switch (outcome.kind) {
        case "purchased":
          await waitForAccess();
          return;
        // Человек закрыл системный лист сам. Это не сбой, и сообщать о нём
        // нечего: экран просто возвращается к выбору.
        case "cancelled":
          setStage({ kind: "ready" });
          return;
        case "pending":
          setStage({ kind: "pending" });
          return;
        case "offline":
          setStage({ kind: "offline" });
          return;
        default:
          setStage({ kind: "failed" });
      }
    },
    [waitForAccess],
  );

  const restore = useCallback(async () => {
    setStage({ kind: "buying" });
    try {
      const info = await restorePurchases();
      if (!alive.current) return;
      if (!info || Object.keys(info.entitlements.active).length === 0) {
        /* ДВА ИСХОДА, А НЕ ОДИН — заход 7.226. «Прежних покупок не
           нашлось» было неправдой ровно для того человека, ради которого
           кнопка и существует: он платил, а срок доступа кончился.
           Различает их `allPurchasedProductIdentifiers` — перепись ВСЕХ
           когда-либо купленных товаров, которую магазин отдаёт независимо
           от того, действует доступ или нет. Пусто — покупок не было
           вовсе; не пусто при пустом `entitlements.active` — покупки были,
           но истекли. */
        const everBought = info?.allPurchasedProductIdentifiers?.length ?? 0;
        setStage({ kind: everBought > 0 ? "restoredExpired" : "restoredNothing" });
        return;
      }
      await waitForAccess();
    } catch {
      if (alive.current) setStage({ kind: "failed" });
    }
  }, [waitForAccess]);

  if (!userId) {
    return (
      <div data-testid="native-purchase" className="mt-4">
        <p className="text-sm leading-6 text-foreground/70">{copy.signInFirst}</p>
        <Link
          href={`/${lang}/login?next=${encodeURIComponent(next)}`}
          className="tap mt-4 inline-flex w-full items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background"
        >
          {copy.signInCta}
        </Link>
      </div>
    );
  }

  const note = (identifier: string) =>
    identifier === "$rc_annual"
      ? copy.noteAnnual
      : identifier === "$rc_lifetime"
        ? copy.noteLifetime
        : copy.noteMonthly;
  const name = (identifier: string) =>
    identifier === "$rc_annual"
      ? copy.planAnnual
      : identifier === "$rc_lifetime"
        ? copy.planLifetime
        : copy.planMonthly;

  /** Отказ магазина → текст. Четыре исхода, четыре разговора (7.225). */
  const failureText = (reason: StoreFailure) =>
    reason === "plugin-missing"
      ? copy.failPlugin
      : reason === "offline"
        ? copy.offline
        : reason === "no-products"
          ? copy.failProducts
          : copy.failConnect;

  const message =
    stage.kind === "pending"
      ? copy.pending
      : stage.kind === "offline"
        ? copy.offline
        : stage.kind === "failed"
          ? copy.failed
          : stage.kind === "slow"
            ? copy.activationSlow
            : stage.kind === "restoredNothing"
              ? copy.restoredNothing
              : stage.kind === "restoredExpired"
                ? copy.restoredExpired
                : stage.kind === "activating"
                  ? copy.activating
                  : stage.kind === "activated"
                    ? copy.activated
                    : stage.kind === "loading"
                      ? copy.loading
                      : stage.kind === "unavailable"
                        ? failureText(stage.reason)
                        : null;

  const busy = stage.kind === "buying" || stage.kind === "activating" || stage.kind === "loading";
  const showList = packages.length > 0 && stage.kind !== "activated";

  return (
    <div data-testid="native-purchase" className="mt-4">
      {withHeading ? (
        <>
          <h3 className="text-base font-semibold text-foreground">{copy.heading}</h3>
          <p className="mt-2 text-sm leading-6 text-foreground/70">{copy.intro}</p>
        </>
      ) : null}

      {message ? (
        <p data-testid="native-purchase-message" className="mt-4 text-sm leading-6 text-foreground/80">
          {message}
        </p>
      ) : null}

      {showList ? (
        <ul className="mt-4 space-y-2">
          {packages.map((pkg) => (
            <li key={pkg.identifier}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void buy(pkg)}
                data-testid="native-purchase-option"
                className="tap flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/15 px-4 py-3 text-left disabled:opacity-50"
              >
                <span>
                  <span className="block text-sm font-medium text-foreground">{name(pkg.identifier)}</span>
                  <span className="block text-xs leading-5 text-foreground/60">{note(pkg.identifier)}</span>
                </span>
                {/* Цена — строка магазина. Ни одной цифры с нашей стороны. */}
                <span className="shrink-0 text-sm font-semibold text-foreground">{pkg.product.priceString}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {stage.kind === "unavailable" ? (
        <>
          {/* КОД МЕЛКИМ ШРИФТОМ — чтобы владелец мог прислать фотографию,
              а не пересказ. Он же стоит меткой у события Sentry. */}
          <p data-testid="native-purchase-code" className="mt-2 text-[11px] leading-4 text-foreground/45">
            {copy.codeLabel}: {stage.code}
          </p>
          <button
            type="button"
            data-testid="native-purchase-retry"
            onClick={retry}
            className="tap mt-4 w-full rounded-full border border-foreground/20 px-5 py-2.5 text-sm font-medium text-foreground"
          >
            {copy.retry}
          </button>
        </>
      ) : null}

      {stage.kind === "activated" ? null : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void restore()}
          className="tap mt-3 w-full rounded-full px-5 py-2.5 text-sm font-medium text-foreground/70 disabled:opacity-50"
        >
          {copy.restoreCta}
        </button>
      )}
    </div>
  );
}
