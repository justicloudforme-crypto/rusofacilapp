import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * КАРКАС БЕЗ СЕТИ ПОКАЗЫВАЕТ ОДНУ ЛОКАЛЬ — ЗАХОДЫ 7.218 И 7.227.
 *
 * Надписи переехали 23.09.2026: экран перестал утверждать «Вы не в сети»
 * по одному упавшему запросу (долг 278) и теперь несёт ДВА состояния —
 * «страница не открылась» (ничего о сети не утверждает, показывается
 * первым) и «нет соединения» (только по признаку). Разметочные правила
 * от этого не изменились: половина ровно одна, и она той локали, что в
 * адресе. Здесь же заперт КАРКАС: пять вкладок получают адреса своей
 * локали — иначе человек с `/ru` уезжал бы в испанский раздел.
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

/** Видимый текст: без тела `<script>`. Русские подписи заголовка вкладки
 *  живут в скрипте, и `body.textContent` их считает — правило же про то,
 *  что ЧИТАЕТ человек. */
function visibleText(doc: Document): string {
  const copy = doc.body.cloneNode(true) as HTMLElement;
  for (const node of copy.querySelectorAll("script, style")) node.remove();
  return copy.textContent ?? "";
}

describe("офлайн-заглушка", () => {
  beforeEach(() => {
    document.title = "";
  });

  it("на русском адресе печатает только русское", () => {
    const doc = renderOfflineScreenAt("/ru/stories/cmt07mslt0000bance9fb6rkw");
    const text = visibleText(doc);
    expect(text).toContain("Нет соединения");
    expect(text).toContain("Страница не открылась");
    expect(text).not.toContain("Estás sin conexión");
    expect(doc.documentElement.lang).toBe("ru");
    // Заголовок вкладки говорит то же, что экран: первым показывается
    // состояние, которое о сети ничего не утверждает.
    expect(doc.title).toContain("Страница не открылась");
    expect(doc.querySelectorAll('[data-locale="es"]').length).toBe(0);
  });

  it("вкладки каркаса получают адреса своей локали", () => {
    const doc = renderOfflineScreenAt("/ru/glossary");
    const hrefs = [...doc.querySelectorAll("nav.tabs a")].map((a) => a.getAttribute("href"));
    expect(hrefs, "вкладок в нижней панели не пять").toHaveLength(5);
    expect(hrefs).toEqual(["/ru/stories", "/ru/courses", "/ru/vocabulary", "/ru/word-games", "/ru/login"]);
    expect(doc.querySelector("header a")?.getAttribute("href"), "имя в шапке ведёт не на главную своей локали").toBe("/ru");
  });

  it("ни одна вкладка каркаса не ведёт в кабинет, в админку или на страницу цен", () => {
    const doc = renderOfflineScreenAt("/es/stories");
    const hrefs = [...doc.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.filter((href) => /profile|admin|pricing/.test(href))).toEqual([]);
  });

  it("на испанском адресе печатает только испанское", () => {
    const doc = renderOfflineScreenAt("/es/pricing");
    const text = visibleText(doc);
    expect(text).toContain("Estás sin conexión");
    expect(text).not.toContain("Нет соединения");
    expect(doc.documentElement.lang).toBe("es");
    expect(doc.querySelectorAll('[data-locale="ru"]').length).toBe(0);
  });

  it("на адресе без локали остаётся язык по умолчанию — испанский, и он ОДИН", () => {
    const doc = renderOfflineScreenAt("/offline.html");
    const text = visibleText(doc);
    expect(text).toContain("Estás sin conexión");
    expect(text).not.toContain("Нет соединения");
  });

  it("в самой разметке лежат ОБЕ половины — без JS человек прочтёт две, а не ноль", () => {
    expect(HTML).toContain('data-locale="es"');
    expect(HTML).toContain('data-locale="ru"');
    expect(HTML).toContain("Нет соединения");
    expect(HTML).toContain("Estás sin conexión");
    // Оба состояния лежат в разметке: то, которое о сети молчит, и то,
    // которое утверждает (долг 278).
    expect(HTML).toContain('data-state="error"');
    expect(HTML).toContain('data-state="offline"');
  });
});
