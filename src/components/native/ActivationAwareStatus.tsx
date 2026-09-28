"use client";

import { useEffect, useState, type ReactNode } from "react";
import { activationState, subscribeActivation, type ActivationState } from "@/lib/access-activation";

/**
 * «EXPIRADA» РЯДОМ С «LISTO: TU ACCESO YA ESTÁ ABIERTO» — ЗАХОД 7.239.
 *
 * Видео владельца, 1.0.10: сразу после покупки «Mes» кабинет около двух
 * секунд показывал одновременно значок «Expirada» (прошлая подписка,
 * нарисованная сервером до покупки) и строку панели покупки «Listo: tu
 * acceso ya está abierto». Панель узнаёт о доступе раньше страницы: она
 * получает «granted», когда СЕРВЕР уже назвал новый уровень
 * (`src/lib/access-activation.ts`), а перерисовка страницы
 * (`router.refresh()`) приходит следом.
 *
 * Здесь та же подписка: пока сервер ещё не перерисовал страницу
 * (`serverEntitled === false`), а доступ уже подтверждён им же, вместо
 * устаревшего содержимого показывается `whenGranted`. Когда придёт
 * перерисовка, `serverEntitled` станет `true` и снова виден серверный
 * ответ. Ничего не выдумывается: «granted» публикуется только по ответу
 * сервера.
 */
/*
 * ЗАХОД 7.240, ЗАДАЧА 3: «EXPIRADA» ~5 С ПОСЛЕ ПОКУПКИ.
 *
 * Видео владельца, 1.0.11: окно Google закрылось — и около пяти секунд
 * кабинет показывал «Expirada», «Venció el 27 de septiembre…» и тарифы, а
 * потом «Activa». Это время между ответом Google («оплачено») и ответом
 * НАШЕГО сервера (вебхук RevenueCat): состояние «waiting». 7.239 закрыл
 * только «granted», а «waiting» рисовал старый серверный ответ.
 *
 * Теперь: `waiting` → `whenWaiting` («Activando…»), `slow` (30 с без
 * подтверждения) → `whenSlow`. Ни одно из них не утверждает «Activa»:
 * это говорит только сервер (`granted`).
 */
export default function ActivationAwareStatus({
  serverEntitled,
  whenGranted,
  whenWaiting,
  whenSlow,
  children,
}: {
  serverEntitled: boolean;
  whenGranted: ReactNode;
  /** Google подтвердил оплату, сервер ещё нет. Не задано — как сервер. */
  whenWaiting?: ReactNode;
  /** Подтверждения нет дольше срока ожидания. Не задано — как сервер. */
  whenSlow?: ReactNode;
  children: ReactNode;
}) {
  const [live, setLive] = useState<ActivationState["kind"]>("idle");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLive(activationState().kind);
    return subscribeActivation((next) => setLive(next.kind));
  }, []);
  if (serverEntitled) return <>{children}</>;
  if (live === "granted") return <>{whenGranted}</>;
  // «Покупка идёт» (Ж.1, 7.243) говорит то же, что ожидание вебхука:
  // оплата в пути, «Expirada» сервера уже неправда.
  if ((live === "waiting" || live === "purchasing") && whenWaiting !== undefined) return <>{whenWaiting}</>;
  if (live === "slow" && whenSlow !== undefined) return <>{whenSlow}</>;
  return <>{children}</>;
}
