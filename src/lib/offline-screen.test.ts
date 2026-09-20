import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ОФЛАЙН-ЗАГЛУШКА ПОКАЗЫВАЕТ ОДНУ ЛОКАЛЬ — ЗАХОД 7.218.
 *
 * Меряется НАСТОЯЩИЙ файл `public/offline.html`, а не его копия: и
 * разметка, и тот самый скрипт, который поедет к человеку. Условие
 * задаётся так же, как у него в браузере, — адресом страницы, на которой
 * заглушка подставлена вместо ответа (адрес в строке остаётся исходным,
 * см. комментарий в шапке файла).
 *
 * Живой браузерной пробе это не отдано намеренно: навигация при
 * выключенной сети под Playwright ненадёжна не по вине продукта —
 * замерено и записано в `e2e/offline.spec.ts` ещё в августе. Правило же
 * тут чисто разметочное, и jsdom проверяет его точнее.
 */
const HTML = readFileSync(join(process.cwd(), "public", "offline.html"), "utf8");

/** Ставит документ заглушки по адресу `path` и исполняет её скрипт —
 *  ровно то, что делает браузер, когда воркер подставил файл. */
function renderOfflineScreenAt(path: string): Document {
  window.history.replaceState({}, "", path);
  document.open();
  document.write(HTML);
  document.close();
  // jsdom не исполняет `document.write`-скрипты в этой конфигурации,
  // поэтому скрипт файла берётся из него же и запускается здесь — то же
  // тело, без копии.
  const source = /<script>([\s\S]*?)<\/script>/.exec(HTML);
  expect(source, "в заглушке нет скрипта выбора локали").not.toBeNull();
  new Function(source![1])();
  return document;
}

describe("офлайн-заглушка", () => {
  beforeEach(() => {
    document.title = "";
  });

  it("на русском адресе печатает только русское", () => {
    const doc = renderOfflineScreenAt("/ru/stories/cmt07mslt0000bance9fb6rkw");
    const text = doc.body.textContent ?? "";
    expect(text).toContain("Вы не в сети");
    expect(text).not.toContain("Estás sin conexión");
    expect(doc.documentElement.lang).toBe("ru");
    expect(doc.title).toContain("Нет соединения");
    expect(doc.querySelectorAll('[data-locale="es"]').length).toBe(0);
  });

  it("на испанском адресе печатает только испанское", () => {
    const doc = renderOfflineScreenAt("/es/pricing");
    const text = doc.body.textContent ?? "";
    expect(text).toContain("Estás sin conexión");
    expect(text).not.toContain("Вы не в сети");
    expect(doc.documentElement.lang).toBe("es");
    expect(doc.querySelectorAll('[data-locale="ru"]').length).toBe(0);
  });

  it("на адресе без локали остаётся язык по умолчанию — испанский, и он ОДИН", () => {
    const doc = renderOfflineScreenAt("/offline.html");
    const text = doc.body.textContent ?? "";
    expect(text).toContain("Estás sin conexión");
    expect(text).not.toContain("Вы не в сети");
  });

  it("в самой разметке лежат ОБЕ половины — без JS человек прочтёт две, а не ноль", () => {
    expect(HTML).toContain('data-locale="es"');
    expect(HTML).toContain('data-locale="ru"');
    expect(HTML).toContain("Вы не в сети");
    expect(HTML).toContain("Estás sin conexión");
  });
});
