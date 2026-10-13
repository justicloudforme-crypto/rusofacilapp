/**
 * ОЖИДАНИЕ ДОСТУПА ПЕРЕЖИВАЕТ ЗАКРЫТИЕ ШТОРКИ — ЗАХОД 7.229, ДОЛГ 304.
 *
 * ====================================================================
 * ЧТО ИМЕННО БЫЛО СЛОМАНО, И ЭТО ВОСПРОИЗВЕДЕНО ПРОГОНОМ
 * ====================================================================
 *
 * Строка долга 304 дословно: «знаки „🔒 По подписке“ на странице уровня
 * у активного подписчика — увидены один раз и не воспроизведены». В
 * заходе 7.226 её не удалось воспроизвести ПЯТЬЮ способами, и все пять
 * выдавали доступ ВНЕ вкладки. Владелец 24.09.2026 снял на видео шестой
 * способ — тот, которого в списке не было: покупка ИЗ ШТОРКИ поверх
 * страницы уровня.
 *
 * Прогон 24.09.2026 (Chromium, настоящий мост Capacitor, подставной
 * магазин, вебхук доезжает через 6 секунд — ровно порядок с телефона):
 *
 *   | шаг                                             | знаков платного |
 *   |-------------------------------------------------|-----------------|
 *   | страница уровня A1 до покупки                   | 32              |
 *   | покупка прошла, шторка ОСТАЛАСЬ открытой        | **0** через 0,5 с |
 *   | покупка прошла, шторка ЗАКРЫТА на «Activando…»  | **32** и через 15 с |
 *
 * ПРИЧИНА, СТРОКОЙ. Ожидание доступа жило внутри экрана покупки
 * (`src/components/native/` — панель покупки), а тот живёт ровно столько,
 * сколько открыта шторка: `Modal` при `open === false` возвращает `null`,
 * то есть размонтирует поддерево. В цикле ожидания стояло два выхода по
 * `alive.current` — и оба срабатывали ПЕРЕД `router.refresh()`. Значит
 * закрытая шторка убивала не «лишний setState», а саму перерисовку
 * страницы: оплата прошла, сервер доступ открыл, а замки на странице
 * остались до следующего перехода. Владелец это и описал: «ушёл в „Мой
 * профиль“ и вернулся — замков нет».
 *
 * ПОЧЕМУ ШТОРКА ЗАКРЫВАЕТСЯ САМА — ЗДЕСЬ НЕ РЕШАЕТСЯ И НЕ УГАДЫВАЕТСЯ.
 * Кандидатов на телефоне несколько (возврат из системного листа Google
 * Play, аппаратная кнопка «назад», пересоздание окна), и назвать
 * виновного без устройства нечем. Но это и не нужно: правка закрывает
 * ВЕСЬ КЛАСС — чем бы ни закрылась шторка, ожидание доступа продолжается
 * и страница перечитывается.
 *
 * ====================================================================
 * КАК ЭТО УСТРОЕНО
 * ====================================================================
 *
 * Ожидание живёт в МОДУЛЕ, а не в компоненте: у модуля нет ни
 * монтирования, ни размонтирования. Экран покупки на него ПОДПИСЫВАЕТСЯ
 * (чтобы рисовать «активируем» и «готово», пока он открыт), а
 * перечитывает страницу тот, кто в оболочке смонтирован всегда, —
 * `NativeStoreIdentity` в корневом макете.
 *
 * Своего понятия «доступ открыт» здесь нет и быть не может: ответ
 * сервера — единственное определение (`/api/subscription/status`,
 * строку пишет вебхук). Модуль лишь спрашивает и сравнивает.
 */

/** Что сейчас с ожиданием доступа. Пять состояний. */
export type ActivationState =
  /** Ничего не ждём. */
  | { kind: "idle" }
  /** Ж.1 (аудит 7.241, Р17; заход 7.243): человек нажал тариф, окно Google
   *  открыто или только что закрылось, а `purchasePackage` ещё не ответил —
   *  RevenueCat отправляет чек на свой сервер (~1,5 с). Экран говорит
   *  «Activando…», а не серверное «Expirada». Отмена возвращает `idle`. */
  | { kind: "purchasing" }
  /** Оплата подтверждена магазином, ждём, когда сервер откроет доступ. */
  | { kind: "waiting" }
  /** Сервер назвал НОВЫЙ уровень доступа. */
  | { kind: "granted"; tier: string }
  /** Срок вышел, а уровень не изменился. Деньги при этом не потеряны —
   *  у экрана есть «Восстановить покупки». */
  | { kind: "slow" };

/**
 * Сколько ждём событие вебхука после подтверждённой оплаты. Доставка
 * события RevenueCat идёт через их очередь, типичная задержка — единицы
 * секунд (видео владельца 28.09.2026: «Activa» через ~5 с). До 7.240 было
 * 60 с; владелец попросил 30: дольше держать человека перед «Activando…»
 * незачем, а после срока у него есть «Reintentar» — новое ожидание.
 */
export const ACTIVATION_TIMEOUT_MS = 30_000;
export const ACTIVATION_POLL_MS = 3_000;

type Listener = (state: ActivationState) => void;

const listeners = new Set<Listener>();
let state: ActivationState = { kind: "idle" };
let running = false;

function publish(next: ActivationState): void {
  state = next;
  for (const listener of [...listeners]) listener(next);
}

/** Текущее состояние — для того, кто подписался позже начала ожидания
 *  (шторку могли закрыть и открыть снова). */
export function activationState(): ActivationState {
  return state;
}

export function subscribeActivation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Уровень доступа этой учётной записи ПО ОТВЕТУ СЕРВЕРА. */
export async function readTier(): Promise<string | null> {
  const res = await fetch("/api/subscription/status", { cache: "no-store" });
  if (!res.ok) return null;
  const body: { tier?: string } = await res.json();
  return body.tier ?? null;
}

/** Точки, которые подменяются в примерах. Названы явно: `vi.fn` без
 *  названного аргумента не даёт прочитать аргументы вызова (ловушка
 *  7.228, пункт 3). */
export interface ActivationDeps {
  readTier: () => Promise<string | null>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

const realDeps: ActivationDeps = {
  readTier,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

/**
 * НАЧАТЬ ЖДАТЬ ДОСТУП. Возвращает обещание, но ждать его НЕ обязательно:
 * состояние приходит подписчикам, и в этом весь смысл правки.
 *
 * Повторный вызов, пока ожидание уже идёт, ничего не начинает: две
 * очереди опроса одного и того же сервера — это вдвое больше запросов и
 * ноль пользы.
 */
export async function startActivationWatch(
  baselineTier: string | null,
  deps: ActivationDeps = realDeps,
): Promise<ActivationState> {
  // Заход 7.264: сервер мог открыть доступ ещё пока магазин отвечал
  // (`purchasing`, см. `beginPurchase`). Ждать нечего — и опускаться из
  // «granted» обратно в «waiting» значило бы показать «Activando…» после
  // «Listo».
  if (state.kind === "granted") return state;
  if (running) return state;
  running = true;
  publish({ kind: "waiting" });
  const deadline = deps.now() + ACTIVATION_TIMEOUT_MS;
  try {
    while (deps.now() < deadline) {
      try {
        const tier = await deps.readTier();
        if (tier && tier !== baselineTier) {
          publish({ kind: "granted", tier });
          return state;
        }
      } catch {
        // Сеть моргнула — это не повод бросать ожидание: оплата уже
        // прошла, и следующий круг попробует снова.
      }
      await deps.sleep(ACTIVATION_POLL_MS);
    }
    publish({ kind: "slow" });
    return state;
  } finally {
    running = false;
  }
}

/**
 * ПОКУПКА ИДЁТ — с нажатия тарифа до ответа магазина (Ж.1). Не начинается
 * поверх уже идущего ожидания доступа или выданного доступа.
 *
 * СЕРВЕР СПРАШИВАЕТСЯ УЖЕ ЗДЕСЬ — ЗАХОД 7.264. Первая настоящая покупка
 * (13.10.2026, видео): Google взял оплату на ~6 с, вебхук записал доступ
 * через 10,6 с (≈16,9 с видео), а ответ магазина (`purchasePackage`)
 * пришёл только после листа «Puntos de Google Play» — после 19,0 с: всё
 * это время экран говорил «Completando la compra…», а замки висели до
 * 20,5 с. Поэтому, пока покупка идёт, сервер опрашивается тем же
 * вопросом, что и после неё, — и сразу при возврате в приложение
 * (`visibilitychange`). Новый уровень — это ответ сервера, а не догадка:
 * «granted» публикуется на тех же основаниях, что и в
 * `startActivationWatch`.
 */
export function beginPurchase(baselineTier: string | null = null, deps: ActivationDeps = realDeps): void {
  if (state.kind !== "idle" && state.kind !== "slow") return;
  publish({ kind: "purchasing" });
  void watchWhilePurchasing(baselineTier, deps);
}

/** Сколько опрашивать сервер, пока магазин не ответил: окно Google может
 *  висеть долго (человек читает условия), но не вечно. */
export const PURCHASING_WATCH_MS = 5 * 60_000;

let purchasingWatch = false;

async function watchWhilePurchasing(baselineTier: string | null, deps: ActivationDeps): Promise<void> {
  if (purchasingWatch) return;
  purchasingWatch = true;
  const deadline = deps.now() + PURCHASING_WATCH_MS;
  let wake: (() => void) | null = null;
  const onVisible = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") wake?.();
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
  try {
    while (state.kind === "purchasing" && deps.now() < deadline) {
      await Promise.race([
        deps.sleep(ACTIVATION_POLL_MS),
        new Promise<void>((resolve) => {
          wake = resolve;
        }),
      ]);
      wake = null;
      if (state.kind !== "purchasing") return;
      try {
        const tier = await deps.readTier();
        if (state.kind === "purchasing" && tier && tier !== baselineTier) {
          publish({ kind: "granted", tier });
          return;
        }
      } catch {
        // Сеть моргнула — следующий круг спросит снова.
      }
    }
  } finally {
    purchasingWatch = false;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
  }
}

/** Магазин ответил не «куплено» (отмена, отказ, отложено) — назад к серверу. */
export function endPurchase(): void {
  if (state.kind === "purchasing") publish({ kind: "idle" });
}

/**
 * ОТКРЫТ ЛИ ЭКРАН ПОКУПКИ — заход 7.264. Подтверждение оплаты поверх
 * страницы показывается, только когда экрана покупки на виду нет: шторку
 * на видео 13.10.2026 закрыли до ответа сервера, и «Listo» внутри неё
 * никто не увидел.
 */
let purchaseScreens = 0;

export function registerPurchaseScreen(): () => void {
  purchaseScreens += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    purchaseScreens -= 1;
  };
}

export function purchaseScreenOpen(): boolean {
  return purchaseScreens > 0;
}

/** Только для примеров: вернуть модуль в исходное состояние. */
export function resetActivationForTests(): void {
  running = false;
  purchasingWatch = false;
  purchaseScreens = 0;
  state = { kind: "idle" };
  listeners.clear();
}
