import type { Page } from "@playwright/test";
import { expect } from "./test";

/**
 * ЛИЧНОЕ В КЕШАХ ПОСЛЕ ВЫХОДА — ОБЩИЙ ПРИБОР (долги 318 и 390, заход 7.291).
 *
 * ЧТО БЫЛО. Две пробы судили «осталось ли личное» по КОСВЕННЫМ признакам:
 * `offline-shell.spec.ts` — «в кешах `rf-pages*` ровно ноль записей»,
 * `offline-orphan-row.spec.ts` — «нет ничего, кроме гостевой `/es`». Обе
 * ломаются о ЗАКОННОЕ поведение: после выхода человек уже гость, и воркер
 * кладёт в кеш его гостевые страницы (без этого гостю не будет офлайна).
 * Какие именно гостевые записи успеют лечь до проверки — решает скорость,
 * отсюда «со второй попытки».
 *
 * ЧТО СТАЛО. Личное узнаётся по ВЛАДЕЛЬЦУ, а не по адресу и не по счёту.
 * Каждую страницу вошедшего сервер рисует с меткой владельца
 * (`OwnerChangeCachePurge owner={ownerScopeFor(user.id)}`, 16 hex-знаков),
 * и та же метка лежит у страницы в `localStorage["rf-pages-owner"]`.
 * Копия, в теле которой есть метка вошедшего, — его копия; гостевая
 * несёт `anon`. Признак уникален для человека, не зависит от адреса и от
 * того, какие гостевые страницы успел положить воркер.
 */

const PERSONAL_CACHE = /^rf-pages|^(pages|pages-rsc|pages-rsc-prefetch|others|apis)$/;

/** Метка владельца, которую страница вошедшего записала себе. */
export async function ownerScope(page: Page): Promise<string> {
  const scope = await page.evaluate(() => window.localStorage.getItem("rf-pages-owner"));
  if (!scope || scope === "anon" || !/^[0-9a-f]{16}$/.test(scope)) {
    throw new Error(`ПРИБОР СЛЕП: у вошедшего нет метки владельца (rf-pages-owner = ${scope})`);
  }
  return scope;
}

/** Записи кешей, стираемых при выходе, в теле которых есть метка `scope`. */
export async function entriesOwnedBy(page: Page, scope: string): Promise<string[]> {
  return page.evaluate(
    async ({ scope, pattern }) => {
      const personal = new RegExp(pattern);
      const found: string[] = [];
      for (const name of await caches.keys()) {
        if (!personal.test(name)) continue;
        // 7.292 (долг 391): уборщик выхода стирает кеши одновременно с этой
        // пробой, а `caches.open` на стёртом имени заводит его заново. Стёртый
        // между списком и открытием — пропускаем (окно сужено до одного
        // вызова; полностью без `open` ключи кеша не прочитать).
        if (!(await caches.has(name))) continue;
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          const body = (await (await cache.match(request, { ignoreVary: true }))?.text()) ?? "";
          if (body.includes(scope)) found.push(`${name} ${new URL(request.url).pathname}`);
        }
      }
      return found;
    },
    { scope, pattern: PERSONAL_CACHE.source },
  );
}

/**
 * ЛИЧНЫЕ ОТВЕТЫ `/api`. Метки владельца в них нет, но гостю эти адреса
 * отвечают 401 (замер 7.291 на `next start`), а 401 воркер в кеш не
 * кладёт. Значит, после выхода такой записи в `apis` быть не может ВОВСЕ:
 * любая найденная — копия, снятая под учётной записью.
 */
const PERSONAL_API_PATHS = ["/api/reading-progress", "/api/flashcard-progress"];

export async function personalApiEntries(page: Page): Promise<string[]> {
  return page.evaluate(async (paths) => {
    if (!(await caches.has("apis"))) return [];
    const cache = await caches.open("apis");
    return (await cache.keys())
      .map((request) => new URL(request.url).pathname)
      .filter((path) => paths.includes(path))
      .map((path) => `apis ${path}`);
  }, PERSONAL_API_PATHS);
}

/** Всё личное, что прибор умеет узнать: документы с меткой + ответы `/api`. */
export async function personalLeft(page: Page, scope: string): Promise<string[]> {
  return [...(await entriesOwnedBy(page, scope)), ...(await personalApiEntries(page))];
}

/**
 * ПОСЛЕ ВЫХОДА ЛИЧНОГО НЕТ — И НЕ ПОЯВЛЯЕТСЯ СНОВА. Сначала ждём уборку
 * (она фоновая), потом даём гостевой странице дойти до покоя — загрузиться,
 * разослать заготовки ссылок, — и проверяем ЕЩЁ РАЗ. Второй замер и есть
 * долг 318: до замка запрос, начатый до выхода, мог лечь в кеш после
 * уборки.
 */
export async function expectNothingPersonalAfterSignOut(page: Page, scope: string): Promise<void> {
  await expect
    .poll(() => personalLeft(page, scope), { message: "после выхода в кешах остались копии прежнего человека", timeout: 20_000 })
    .toEqual([]);
  await page.waitForLoadState("load");
  await page.waitForTimeout(5000);
  expect(await personalLeft(page, scope), "копии прежнего человека вернулись в кеш ПОСЛЕ уборки (долг 318)").toEqual([]);
}
