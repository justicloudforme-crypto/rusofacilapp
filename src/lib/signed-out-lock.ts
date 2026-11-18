import type { SerwistPlugin } from "serwist";
import { signedOutCaches } from "./signed-out";

/**
 * ЗАМОК НА УБОРКУ ПОСЛЕ ВЫХОДА — ДОЛГ 318 (заход 7.291).
 *
 * ====================================================================
 * ЧТО БЫЛО
 * ====================================================================
 *
 * Уборщик выхода (`SignedOutCachePurge`) стирал кеши `rf-pages*` со
 * СТРАНИЦЫ, а воркер про выход не знал ничего. Каждый запрос страницы
 * воркер обслуживает так: сходить в сеть → дождаться ответа → положить
 * копию в кеш (`NetworkFirst`). Запрос, ушедший ДО выхода (с кукой
 * вошедшего человека), мог вернуться ПОСЛЕ уборки — и воркер клал его
 * ответ в только что стёртый кеш: `caches.open` создаёт кеш заново.
 * Обещание «выход стирает всё» держалось на том, что такие ответы
 * успевают раньше уборки, то есть на скорости, а не на замке.
 *
 * ====================================================================
 * ЧТО СТАЛО
 * ====================================================================
 *
 * У воркера есть счётчик выходов («эпоха»). Каждый запрос страницы в
 * момент старта запоминает эпоху (`handlerWillStart`). Страница после
 * выхода сначала сообщает воркеру «выход» (`SIGNED_OUT_MESSAGE`), и
 * воркер:
 *   1. увеличивает эпоху — с этой секунды ни один запрос, начатый ДО
 *      выхода, в кеш не ляжет (`cacheWillUpdate` → `null`);
 *   2. сам стирает личные кеши и только потом отвечает странице;
 *   3. если ответ старого запроса всё-таки проскочил проверку и лёг
 *      в кеш в ту же долю секунды (между проверкой и `cache.put` есть
 *      ожидания), `cacheDidUpdate` видит смену эпохи и стирает его.
 * Три шага закрывают все порядки событий: копия старого запроса либо
 * легла ДО уборки (её стирает уборка), либо после (её не пускает
 * проверка или стирает `cacheDidUpdate`).
 *
 * ЧЕГО ЗАМОК НЕ ДЕЛАЕТ — и это намеренно. Запросы, начатые ПОСЛЕ
 * выхода, ложатся в кеш как обычно: это страницы ГОСТЯ (кука уже
 * снята), личного в них нет, а офлайн гостю нужен так же, как
 * вошедшему. Запрет «ничего не кешировать до следующей навигации»
 * разобран и отвергнут: внутри приложения навигацию обслуживает
 * оболочка, а не воркер (7.228), и замок не снимался бы никогда.
 *
 * Логика вынесена сюда из `sw.ts`, чтобы её можно было проверить
 * юнит-тестом на подставных кешах (`signed-out-lock.test.ts`).
 */

/** Сообщение «человек вышел» от страницы к воркеру. */
export const SIGNED_OUT_MESSAGE = "rf-signed-out";

/** Минимум от `CacheStorage`, нужный замку; в тесте — подставной. */
export interface CacheStorageLike {
  keys(): Promise<string[]>;
  has(name: string): Promise<boolean>;
  open(name: string): Promise<{ delete(request: Request | string, options?: CacheQueryOptions): Promise<boolean> }>;
  delete(name: string): Promise<boolean>;
}

export interface SignedOutLock {
  /** Плагин для КАЖДОЙ стратегии, пишущей в кеш `rf-pages*`. */
  plugin: SerwistPlugin;
  /** Выход: поднять эпоху и стереть личные кеши. Возвращает стёртые имена. */
  signOut(): Promise<string[]>;
  /** Текущая эпоха — для теста. */
  epoch(): number;
}

export function createSignedOutLock(storage: CacheStorageLike): SignedOutLock {
  let epoch = 0;

  const plugin: SerwistPlugin = {
    handlerWillStart: async ({ state }) => {
      if (state) state.signedOutEpoch = epoch;
    },
    cacheWillUpdate: async ({ state, response }) => {
      if (state && state.signedOutEpoch !== epoch) return null;
      return response;
    },
    cacheDidUpdate: async ({ state, cacheName, request }) => {
      if (!state || state.signedOutEpoch === epoch) return;
      try {
        // `has`, а не сразу `open`: `open` заводит стёртый кеш заново.
        if (!(await storage.has(cacheName))) return;
        await (await storage.open(cacheName)).delete(request, { ignoreVary: true });
      } catch {
        // Хранилище недоступно — стирать нечего.
      }
    },
  };

  return {
    plugin,
    epoch: () => epoch,
    async signOut() {
      epoch += 1;
      const names = signedOutCaches(await storage.keys());
      await Promise.all(names.map((name) => storage.delete(name)));
      return names;
    },
  };
}
