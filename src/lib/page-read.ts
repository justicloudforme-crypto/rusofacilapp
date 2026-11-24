import { unstable_rethrow } from "next/navigation";

/**
 * ЗАХОД 7.305 — то же правило, что у уроков в 7.304 (долг 295): всё, что
 * лежит в коде, страница показывает и без базы.
 *
 * Чтение базы для СТРАНИЦЫ, которой база только помогает: игровые лендинги
 * (`/es/sopa-de-letras-ruso*`, `/es/crucigramas-ruso-principiantes`,
 * `/es/juegos-para-aprender-ruso`) — это текст, заголовок и ссылки из кода
 * плюс один пазл или перечень пазлов из базы. Пока загрузчик бросал отказ
 * наверх, авария базы заменяла ВСЮ страницу экраном ошибки (замер 7.304:
 * 9 лендингов из 17 «границ»). Теперь отказ превращается в `{ ok: false }`,
 * и страница рисует свой текст и ссылки, а на месте пазла — заметку
 * `PuzzleUnavailable`.
 *
 * Сами загрузчики (`getPuzzle`, `getLandingPuzzleForTopic`) остаются
 * громкими (`MUST_FAIL_LOUDLY` в `db-read-resilience.test.ts`): страница
 * пазла `/word-games/...` без строки базы показывать нечего, там граница
 * ошибок — честный ответ. Обёртка — только у лендингов.
 *
 * `{ ok: true, value: null }` («строки нет») и `{ ok: false }` («база не
 * ответила») — разные вещи: первое страница по-прежнему отдаёт 404, второе
 * — свой текст без пазла. Статусы при живой базе не меняются.
 *
 * Ничего не кешируется: следующий запрос снова спросит базу.
 */
export type PageRead<T> = { ok: true; value: T } | { ok: false };

export async function readForPage<T>(what: string, read: () => Promise<T>): Promise<PageRead<T>> {
  try {
    return { ok: true, value: await read() };
  } catch (error) {
    // notFound(), redirect() и служебные сигналы Next — не отказ базы.
    unstable_rethrow(error);
    console.error(`[page-read] ${what} unreadable — rendering the page without it`, error);
    return { ok: false };
  }
}
