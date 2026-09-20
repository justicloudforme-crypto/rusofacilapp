/**
 * КОГДА РЕГИСТРИРУЕТСЯ SERVICE WORKER И ЧТО СЧИТАТЬ ЕГО ОТКАЗОМ.
 *
 * Отдельный файл, а не тело `SerwistRegister.tsx`, по той же причине, что и
 * `sw-registration-failure.ts`: у правила должен быть тест, а компонент
 * React тестом «вызвано ровно один раз» не накрыть, не подняв браузер.
 *
 * ЧТО ИЗМЕРЕНО 20.09.2026 (заход 7.219, числа владельца по панели Sentry,
 * период 30 дней, незакрытых записей в проекте 38).
 *
 *   JAVASCRIPT-NEXTJS-9  Error «Rejected», `/:lang/login`, 1300 событий,
 *                        unhandled, последнее ~06.09.2026.
 *   JAVASCRIPT-NEXTJS-Q  Error «Rejected», `/:lang/privacy`, 11 событий,
 *                        handled, level warning, area
 *                        service-worker-registration, ЖИВАЯ (20.09.2026).
 *                        В событии: User-Agent `PlayStore-Google`.
 *   JAVASCRIPT-NEXTJS-1  Error «Rejected», `/:lang/stories/:id`, 8 событий.
 *   JAVASCRIPT-NEXTJS-N  SecurityError «Script …/sw.js load failed», 1 событие.
 *
 * ПОЧЕМУ ИМЕННО `/login`, ЧИСЛОМ. Ничего особенного в самой странице входа
 * нет: она серверная, без эффектов, воркер на ней регистрируется тем же
 * единственным вызовом, что и везде. Особенное — сколько на неё ведёт
 * ссылок. У ВЫШЕДШЕГО посетителя (а краулер всегда вышедший) `/[lang]/login`
 * стоит ссылкой на КАЖДОЙ странице сайта дважды — `Navbar.tsx` (кнопка
 * действия в шапке) и `BottomNav.tsx` (нижняя панель). В карте сайта прода
 * 20.09.2026 — 1913 адресов, то есть входящих ссылок на две страницы входа
 * около 3826, больше, чем у любой страницы содержимого. Сверх того на
 * `/login` сваливаются серверные переадресации кабинета и админки
 * (`proxy.ts`). Сам `/login` при этом в карте сайта отсутствует вовсе.
 * Значит распределение отказов повторяет распределение ОБХОДА, а не дефект
 * страницы, и три проверенные версии — «регистрация отменяется навигацией»,
 * «регистрация зовётся повторно», «страница перерисовывается и роняет
 * промис» — к числу 1300 отношения не имеют: вызов и до этой правки был
 * ровно один за загрузку (флаг уровня модуля, `4d426e9` 26.08.2026).
 *
 * ЧТО ЗДЕСЬ ПОЧИНЕНО.
 *
 *  1. Вызов уходит ПОСЛЕ полной загрузки страницы, а не в первом эффекте.
 *     Раньше `register()` соревновался за сеть с содержимым самой страницы.
 *  2. Вызов остаётся один на загрузку и переживает размонтирование: флаг
 *     лежит в модуле, а обработчик отказа не привязан ни к компоненту, ни к
 *     его эффекту. Уход со страницы во время регистрации не может дать
 *     необработанный отказ.
 *  3. `PlayStore-Google` — проверяющий Google Play, ходящий по ссылке на
 *     политику из консоли, — внесён в список неинтерактивных обходчиков:
 *     воркер индексатору не нужен, а его песочница возвращает промис,
 *     который нам не принадлежит и поймать который нечем.
 *  4. Неожиданный отказ уходит в Sentry ИМЕНОВАННЫМ событием с адресом
 *     скрипта и исходным текстом, а не голым словом «Rejected».
 */
import { isExpectedServiceWorkerFailure } from "./sw-registration-failure";

/**
 * Поисковые и магазинные обходчики гоняют песочный Chrome, у которого
 * `navigator.serviceWorker.register` подменён заглушкой. Заглушка создаёт
 * промис САМА и себе же его оставляет: наша цепочка этот объект не получает,
 * поэтому никакой `.catch()` пометить его обработанным не может. Здесь
 * остаётся ровно один ход — не делать вызова вовсе, и индексатор от этого не
 * теряет ничего: офлайн-кэш ему не нужен.
 *
 * Список ПОИМЁННЫЙ, а не общая проверка «похоже на бота»: живой браузер не
 * должен молча остаться без офлайна из-за слова в User-Agent.
 */
export const NON_INTERACTIVE_CRAWLERS =
  /Google-InspectionTool|GoogleOther|Googlebot|AdsBot-Google|Mediapartners-Google|Google-Site-Verification|PlayStore-Google|Chrome-Lighthouse|Bingbot|YandexBot|DuckDuckBot|Applebot/i;

export function isKnownNonInteractiveCrawler(userAgent: string): boolean {
  return NON_INTERACTIVE_CRAWLERS.test(userAgent);
}

/**
 * Что Sentry покажет в заголовке события. Голое «Error: Rejected» не
 * называет ни места, ни скрипта, ни движка; здесь всё это стоит в одной
 * строке, а исходная ошибка остаётся в `cause`.
 */
export class ServiceWorkerRegistrationFailed extends Error {
  constructor(swUrl: string, cause: unknown) {
    const detail =
      cause instanceof Error
        ? `${cause.name}: ${cause.message}`
        : typeof cause === "string"
          ? cause
          : String(cause);
    super(`Service worker registration for ${swUrl} was refused — ${detail}`);
    this.name = "ServiceWorkerRegistrationFailed";
    this.cause = cause;
  }
}

export type RegistrationOutcome =
  | "registered"
  | "failed-expected"
  | "failed-unexpected"
  | "skipped-already-registered"
  | "skipped-crawler"
  | "skipped-no-service-worker"
  | "skipped-no-serwist";

export interface RegistrationDeps {
  /** Объект @serwist/window; `null`/`undefined`, пока провайдер его не создал. */
  serwist: { register(): Promise<unknown> } | null | undefined;
  userAgent: string;
  /** Есть ли `serviceWorker` у navigator: в приватном окне его нет вовсе. */
  hasServiceWorker: boolean;
  /** Резолвится, когда страница догрузилась целиком. */
  pageLoaded: () => Promise<void>;
  /** Адрес скрипта — только для текста события. */
  swUrl: string;
  /** Ожидаемый отказ: пишется в консоль и в Sentry НЕ уходит. */
  onExpectedFailure: (error: unknown) => void;
  /** Неожиданный: уходит в Sentry именованным событием. */
  onUnexpectedFailure: (error: ServiceWorkerRegistrationFailed) => void;
  /** Пропуск по названной причине — только в консоль. */
  onSkip?: (reason: RegistrationOutcome) => void;
}

/**
 * Флаг уровня МОДУЛЯ, а не состояния компонента: `SerwistRegister` может
 * смонтироваться второй раз на той же загрузке (клиентская навигация на тот
 * же адрес — реальный случай, Sentry 8de70b2c), и состояние компонента этого
 * не переживает. Собственная защита @serwist/window от повторной регистрации
 * существует только в dev-сборке и из боевой вырезается.
 */
let registrationStarted = false;

/** Только для тестов: вернуть модуль в состояние «страница только что загрузилась». */
export function resetRegistrationStateForTests(): void {
  registrationStarted = false;
}

export function hasRegistrationStarted(): boolean {
  return registrationStarted;
}

export async function registerServiceWorkerOnce(
  deps: RegistrationDeps,
): Promise<RegistrationOutcome> {
  const skip = (reason: RegistrationOutcome): RegistrationOutcome => {
    deps.onSkip?.(reason);
    return reason;
  };

  if (!deps.serwist) return skip("skipped-no-serwist");
  if (registrationStarted) return skip("skipped-already-registered");
  if (isKnownNonInteractiveCrawler(deps.userAgent)) return skip("skipped-crawler");
  if (!deps.hasServiceWorker) return skip("skipped-no-service-worker");

  // Флаг ставится ДО ожидания загрузки, а не после. Иначе два монтирования
  // в одном кадре оба прошли бы проверку и оба дождались бы `load` — то
  // есть ровно та двойная регистрация, от которой флаг и заводился.
  registrationStarted = true;

  await deps.pageLoaded();

  try {
    await deps.serwist.register();
    return "registered";
  } catch (error) {
    // Обработчик НЕ привязан ни к компоненту, ни к его эффекту: уход со
    // страницы во время регистрации не должен оставить отказ без хозяина.
    if (isExpectedServiceWorkerFailure(error)) {
      deps.onExpectedFailure(error);
      return "failed-expected";
    }
    deps.onUnexpectedFailure(new ServiceWorkerRegistrationFailed(deps.swUrl, error));
    return "failed-unexpected";
  }
}
