import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GRAMMAR_GUIDES } from "./guides";

/**
 * `pageTitle` каждого гида обязан совпадать с настоящим заголовком его
 * страницы.
 *
 * Почему это тест, а не импорт. Правильнее было бы, чтобы страница гида
 * брала свой `<h1>` отсюда — тогда расхождение стало бы невозможным. Но
 * все четыре страницы `/es/gramatica/*` входят в 330 замороженных до
 * 25.09.2026 (docs/frozen-baseline-2026-08-30.json), а заморозка
 * запрещает трогать их HTML вообще. Импорт сам по себе HTML не меняет, но
 * правка файла страницы — это правка замороженной страницы, и разбираться
 * потом, «изменился ли байт», дороже, чем один тест.
 *
 * Строка нужна поиску: замер 05.09.2026 отдельно называет
 * «El género de los sustantivos en ruso» как запрос, дававший ноль, — а
 * это ровно заголовок страницы, а не короткое имя гида в индексе.
 */
const APP = join(process.cwd(), "src", "app", "[lang]", "gramatica");

describe("гиды по грамматике", () => {
  it("их пять: индекс и четыре гида", () => {
    expect(GRAMMAR_GUIDES).toHaveLength(4);
  });

  it("pageTitle каждого гида стоит в исходнике его страницы", () => {
    for (const guide of GRAMMAR_GUIDES) {
      const slug = guide.href.replace("/es/gramatica/", "");
      const source = readFileSync(join(APP, slug, "page.tsx"), "utf8");
      expect(source, `${slug}: pageTitle разошёлся с заголовком страницы`).toContain(guide.pageTitle);
      // И короткое имя — тоже настоящее: оно печатается в индексе.
      expect(readFileSync(join(APP, "page.tsx"), "utf8")).toContain("GRAMMAR_GUIDES");
    }
  });

  it("контроль: сверка умеет сказать «нет»", () => {
    // Без этого случая предыдущий проходил бы и на пустом списке, и на
    // строке, которой в файле нет.
    const source = readFileSync(join(APP, "genero-sustantivos-ruso", "page.tsx"), "utf8");
    expect(source).not.toContain("El género de los sustantivos en ruso: cómo NO reconocerlo");
  });
});
