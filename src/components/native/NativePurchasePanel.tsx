"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";
import type { Locale } from "@/i18n/config";
import type { NativeAccessCopy } from "@/lib/native-access-copy";
import { OFFERING_PACKAGE_ORDER } from "@/lib/revenuecat-config";
import {
  configureRevenueCat,
  getCurrentOffering,
  loginRevenueCat,
  purchasePackage,
  restorePurchases,
} from "@/lib/revenuecat-client";

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

/** Что о доступе этой учётной записи говорит СЕРВЕР прямо сейчас.
 *  Единственное определение «доступ открыт» на этом экране. */
async function readTier(): Promise<string | null> {
  const res = await fetch("/api/subscription/status", { cache: "no-store" });
  if (!res.ok) return null;
  const body: { tier?: string } = await res.json();
  return body.tier ?? null;
}

type Stage =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "unavailable" }
  | { kind: "buying" }
  | { kind: "activating" }
  | { kind: "activated" }
  | { kind: "slow" }
  | { kind: "pending" }
  | { kind: "offline" }
  | { kind: "failed" }
  | { kind: "restoredNothing" };

/** Сколько ждём событие вебхука после подтверждённой оплаты. Шестьдесят
 *  секунд — это не «на глазок»: доставка события RevenueCat идёт через их
 *  очередь, и типичная задержка — единицы секунд, а не минуты. Дольше
 *  держать человека перед крутящимся кружком незачем: у экрана есть
 *  честное «ещё не доехало» и кнопка повтора. */
const ACTIVATION_TIMEOUT_MS = 60_000;
const ACTIVATION_POLL_MS = 3_000;

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
  const router = useRouter();
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
   */
  const readStore = useCallback(async (): Promise<PurchasesPackage[] | null> => {
    try {
      const ok = await configureRevenueCat();
      if (!ok) return null;
      if (userId) await loginRevenueCat(userId);
      baselineTier.current = await readTier();
      const offering = await getCurrentOffering();
      const available = offering?.availablePackages ?? [];
      if (available.length === 0) return null;
      // Порядок показа — наш (`OFFERING_PACKAGE_ORDER`), а не тот, в
      // котором пакеты приехали: он в консоли меняется мышью.
      const rank = (p: PurchasesPackage) => {
        const at = OFFERING_PACKAGE_ORDER.indexOf(p.identifier as (typeof OFFERING_PACKAGE_ORDER)[number]);
        return at === -1 ? OFFERING_PACKAGE_ORDER.length : at;
      };
      return [...available].sort((a, b) => rank(a) - rank(b));
    } catch {
      return null;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const found = await readStore();
      if (cancelled || !alive.current) return;
      if (!found) {
        setStage({ kind: "unavailable" });
        return;
      }
      setPackages(found);
      setStage({ kind: "ready" });
    })();
    return () => {
      cancelled = true;
    };
  }, [readStore, userId]);

  const retry = useCallback(() => {
    setStage({ kind: "loading" });
    void (async () => {
      const found = await readStore();
      if (!alive.current) return;
      if (!found) {
        setStage({ kind: "unavailable" });
        return;
      }
      setPackages(found);
      setStage({ kind: "ready" });
    })();
  }, [readStore]);

  /** Спрашивает СЕРВЕР, изменился ли уровень доступа. Ответ сервера — это
   *  и есть определение «доступ открыт»: строку пишет вебхук. */
  const waitForAccess = useCallback(async () => {
    setStage({ kind: "activating" });
    const before = baselineTier.current;
    const deadline = Date.now() + ACTIVATION_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const tier = await readTier();
        if (tier && tier !== before) {
          if (!alive.current) return;
          setStage({ kind: "activated" });
          router.refresh();
          return;
        }
      } catch {
        // Сеть моргнула — это не повод бросать ожидание: оплата уже
        // прошла, и следующий круг попробует снова.
      }
      await new Promise((resolve) => setTimeout(resolve, ACTIVATION_POLL_MS));
      if (!alive.current) return;
    }
    setStage({ kind: "slow" });
  }, [router]);

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
        setStage({ kind: "restoredNothing" });
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
              : stage.kind === "activating"
                ? copy.activating
                : stage.kind === "activated"
                  ? copy.activated
                  : stage.kind === "loading"
                    ? copy.loading
                    : stage.kind === "unavailable"
                      ? copy.unavailable
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
        <button
          type="button"
          onClick={retry}
          className="tap mt-4 w-full rounded-full border border-foreground/20 px-5 py-2.5 text-sm font-medium text-foreground"
        >
          {copy.retry}
        </button>
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
