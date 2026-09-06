import { DatabaseSync } from "node:sqlite";
import type { Page, Request } from "@playwright/test";
import { test, expect } from "./helpers/test";

/**
 * Журнал спроса на поиск: **одна строка на заход, каким бы выходом заход
 * ни кончился**.
 *
 * Что здесь сторожится и почему это нельзя было проверить юнит-тестом. До
 * 06.09.2026 запись отправлялась ровно из `close()` компонента
 * `GlobalSearch`, то есть жила только у тех выходов, которые зовут
 * `close()`. Уход на другой адрес с открытым окном и закрытие вкладки
 * давали НОЛЬ записей — и перекос односторонний: «искал, ничего не нашёл
 * и ушёл» кончается уходом со страницы чаще, чем нажатием Escape, то есть
 * журнал недосчитывал именно те заходы, ради которых заводился. И
 * `pagehide`, и `visibilitychange`, и закрытие вкладки — события движка;
 * логику (однократность записи) держит
 * `src/lib/search/demand-session.test.ts`, а сюда вынесено другое: что
 * каждый из четырёх выходов действительно доходит до записи.
 *
 * ДВА СПОСОБА ЗАМЕРА, И ЭТО НЕ ПРИХОТЬ. Выходы делятся ровно надвое по
 * тому, жив ли документ в момент отправки:
 *
 *   * Escape и переход по строке выдачи оставляют документ живым —
 *     маячок виден событию `request` контекста, и тело у него читается;
 *   * уход на другой адрес и закрытие вкладки убивают документ, и
 *     Chromium **не сообщает** об этом запросе Playwright вовсе.
 *     Замерено, а не предположено: страница печатала в консоль
 *     `beacon → true` и `pagehide` наступал, а `context.on("request")`
 *     не давал ни одного события. Проверять там нечего — до сети
 *     инструмент не достаёт.
 *
 * Поэтому вторая половина меряется там, где след остаётся навсегда, — в
 * самой таблице `SearchQuery`. Строки помечены заведомо ненаходимой
 * строкой запроса, поэтому они не смешиваются ни с параллельным
 * прогоном, ни с чужой спекой, и убираются за собой. Это же делает
 * замер честнее: доказывается весь путь целиком (браузер → маячок →
 * маршрут → база), а не одна его браузерная половина.
 */

interface LoggedRecord {
  query: string;
  resultCount: number;
  lang: string;
  followed: boolean;
}

const RESULTS = '[data-testid="global-search-results"]';

/** Запросы к журналу, снятые событием контекста. Годится только для тех
 * выходов, которые оставляют документ живым, — см. шапку файла. */
async function collectDemandLog(page: Page): Promise<LoggedRecord[]> {
  const records: LoggedRecord[] = [];
  page.context().on("request", (request: Request) => {
    // Сравнение по ПУТИ, а не подстрокой по всему адресу: у сборки Next
    // есть файл чанка `/_next/static/chunks/app/api/search/log/route-*.js`,
    // и подстрока ловила его вместо маячка (стоило одного ложного
    // «запись ушла»).
    if (new URL(request.url()).pathname !== "/api/search/log") return;
    const body = request.postData();
    if (!body) return;
    try {
      records.push(JSON.parse(body) as LoggedRecord);
    } catch {
      records.push({ query: `<НЕ JSON: ${body.slice(0, 40)}>`, resultCount: -1, lang: "?", followed: false });
    }
  });
  return records;
}

/** Строки журнала с данной меткой, прочитанные прямо из базы, в которую
 * пишет поднятый этим прогоном сервер. */
function rowsFor(marker: string): LoggedRecord[] {
  const db = new DatabaseSync("dev.db", { readOnly: true, timeout: 10_000 });
  try {
    return db
      .prepare("SELECT query, resultCount, lang, followed FROM SearchQuery WHERE query = ?")
      .all(marker)
      .map((row) => {
        const r = row as { query: string; resultCount: number; lang: string; followed: number };
        return { query: r.query, resultCount: r.resultCount, lang: r.lang, followed: r.followed === 1 };
      });
  } finally {
    db.close();
  }
}

function dropRows(marker: string): void {
  // `timeout` здесь не украшение: спеки идут параллельно, база одна, и без
  // ожидания занятости прогон падал с «database is locked» — то есть по
  // причине, не имеющей отношения к тому, что он мерит.
  const db = new DatabaseSync("dev.db", { timeout: 10_000 });
  try {
    db.prepare("DELETE FROM SearchQuery WHERE query = ?").run(marker);
  } finally {
    db.close();
  }
}

/** Метка своя у каждого случая и у каждого проекта — иначе параллельные
 * прогоны считали бы чужие строки своими. Заведомо ненаходимая: заход,
 * который ничего не нашёл, — это и есть самая ценная запись журнала. */
function marker(name: string, project: string): string {
  return `zz-demand-${name}-${project}`;
}

async function openSearchAndType(page: Page, query: string) {
  await page.goto("/es");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.locator(RESULTS)).toBeVisible();
  await page.getByRole("searchbox").fill(query);
  return query;
}

/** Ждём именно ВЫДАЧУ, а не таймер: без этого запись ушла бы с
 * `resultCount = 0` просто потому, что ответ не успел прийти, и тест
 * мерил бы скорость сети вместо поведения журнала. */
async function awaitResults(page: Page) {
  await expect(page.locator(RESULTS).locator('[data-testid="search-result"]').first()).toBeVisible();
}

/** …а для заведомо ненаходимой строки — ждём «ничего не найдено», по той
 * же причине: пока ответа нет, окно ещё не знает, что найдено ноль. */
async function awaitEmpty(page: Page) {
  await expect(page.locator(RESULTS).getByText("No se encontraron resultados")).toBeVisible();
}

test("выход 1 — Escape: одна строка, перехода нет", async ({ page }) => {
  const records = await collectDemandLog(page);
  await openSearchAndType(page, "Cuentos");
  await awaitResults(page);

  await page.keyboard.press("Escape");
  await expect(page.locator(RESULTS)).toBeHidden();

  await expect.poll(() => records.length, { timeout: 5_000 }).toBe(1);
  expect(records[0]).toMatchObject({ query: "Cuentos", lang: "es", followed: false });
  expect(records[0].resultCount).toBeGreaterThan(0);

  // Пауза не для красоты: без неё «строка ровно одна» доказывало бы
  // только то, что вторая не успела прийти.
  await page.waitForTimeout(500);
  expect(records.length).toBe(1);
});

test("выход 2 — переход по строке выдачи: одна строка, и переход отмечен", async ({ page }) => {
  const records = await collectDemandLog(page);
  await openSearchAndType(page, "Cuentos");
  await awaitResults(page);

  const result = page.locator(RESULTS).getByRole("link", { name: "Cuentos", exact: true });
  await Promise.all([page.waitForURL("**/es/stories"), result.click()]);

  await expect.poll(() => records.length, { timeout: 5_000 }).toBe(1);
  // Ровно то поле, про которое 7.128 писала, что оно есть, и которое до
  // этого захода никто не видел в браузере.
  expect(records[0]).toMatchObject({ query: "Cuentos", lang: "es", followed: true });
  await page.waitForTimeout(500);
  expect(records.length).toBe(1);
});

test("выход 3 — ушёл на другой адрес с открытым окном: одна строка", async ({ page }, testInfo) => {
  const q = marker("goto", testInfo.project.name);
  dropRows(q);
  try {
    await openSearchAndType(page, q);
    await awaitEmpty(page);

    // Настоящий уход документа, а не router.push: так уходят по строке
    // браузера, по внешней ссылке и по кнопке «назад».
    await page.goto("/es/pricing");

    await expect.poll(() => rowsFor(q).length, { timeout: 10_000 }).toBe(1);
    expect(rowsFor(q)[0]).toMatchObject({ resultCount: 0, lang: "es", followed: false });
  } finally {
    dropRows(q);
  }
});

test("выход 4 — закрыл вкладку: одна строка", async ({ page }, testInfo) => {
  const q = marker("close", testInfo.project.name);
  dropRows(q);
  try {
    await openSearchAndType(page, q);
    await awaitEmpty(page);

    // Простое `page.close()`, а НЕ `{ runBeforeUnload: true }`. Замерено
    // по трём вариантам закрытия в обоих движках: простое закрытие даёт
    // строку и в Chromium, и в WebKit, а `runBeforeUnload` в WebKit не
    // даёт её ни разу. Флаг обещает выполнить обработчики `beforeunload`,
    // которых у этой страницы нет вовсе, и в WebKit платой за него
    // оказывается пропущенный `pagehide`.
    await page.close();

    await expect.poll(() => rowsFor(q).length, { timeout: 10_000 }).toBe(1);
    expect(rowsFor(q)[0]).toMatchObject({ resultCount: 0, lang: "es", followed: false });
  } finally {
    dropRows(q);
  }
});

test("Escape и следом закрытие вкладки — по-прежнему ОДНА строка", async ({ page }, testInfo) => {
  // Отрицательный контроль к четырём выходам выше: четыре повода записать
  // не должны превращаться в четыре записи. Без этого случая заход,
  // закрывший долг 52, мог бы закрыть его удвоением журнала.
  const q = marker("twice", testInfo.project.name);
  dropRows(q);
  try {
    await openSearchAndType(page, q);
    await awaitEmpty(page);

    await page.keyboard.press("Escape");
    await expect(page.locator(RESULTS)).toBeHidden();
    await expect.poll(() => rowsFor(q).length, { timeout: 10_000 }).toBe(1);

    await page.close();
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(rowsFor(q).length).toBe(1);
  } finally {
    dropRows(q);
  }
});

test("окно открыли и закрыли, ничего не набрав, — записи нет", async ({ page }) => {
  // Второй отрицательный контроль, и он про другое: журнал не должен
  // наполняться шумом «открыл и передумал». Пустая строка отсекается на
  // клиенте (log-client.ts), поэтому здесь обязан быть ноль запросов, а
  // не запрос с пустым полем.
  const records = await collectDemandLog(page);
  await page.goto("/es");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.locator(RESULTS)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(RESULTS)).toBeHidden();

  await page.waitForTimeout(800);
  expect(records.length).toBe(0);
});
