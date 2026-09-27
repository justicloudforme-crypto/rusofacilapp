"use client";

import { useEffect, useState, type ReactNode } from "react";
import { activationState, subscribeActivation } from "@/lib/access-activation";

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
export default function ActivationAwareStatus({
  serverEntitled,
  whenGranted,
  children,
}: {
  serverEntitled: boolean;
  whenGranted: ReactNode;
  children: ReactNode;
}) {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGranted(activationState().kind === "granted");
    return subscribeActivation((live) => setGranted(live.kind === "granted"));
  }, []);
  if (granted && !serverEntitled) return <>{whenGranted}</>;
  return <>{children}</>;
}
