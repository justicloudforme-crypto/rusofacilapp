import { describe, expect, it } from "vitest";
import { localizeStoryAuthor } from "./story-author";

/**
 * The 20 distinct `Story.author` values present in the content bank on
 * 30.08.2026, with their counts — the whole input domain this function has
 * to answer for, not a sample. Listed here rather than derived at run time
 * on purpose: the test must fail when production grows a value nobody
 * mapped, and a query would just silently follow it.
 */
const AUTHORS_IN_THE_BANK = [
  ["RusoFásil (relato original)", 277],
  ["Русская народная сказка", 12],
  ["А.П. Чехов", 7],
  ["Л.Н. Толстой", 6],
  ["Русская народная сказка (обработка)", 3],
  ["Л.Н. Толстой (пересказ)", 2],
  ["И.А. Крылов (пересказ)", 2],
  ["А.С. Пушкин (пересказ)", 2],
  ["А.П. Чехов (пересказ)", 2],
  ["А.И. Куприн", 2],
  ["Н.С. Лесков (пересказ)", 1],
  ["Н.В. Гоголь (пересказ)", 1],
  ["М.Е. Салтыков-Щедрин (пересказ)", 1],
  ["М. Горький (пересказ)", 1],
  ["Л.Н. Толстой (обработка)", 1],
  ["И.С. Тургенев (пересказ)", 1],
  ["И.С. Тургенев", 1],
  ["И.А. Бунин (пересказ)", 1],
  ["И.А. Бунин", 1],
  ["А.С. Пушкин", 1],
] as const;

const CYRILLIC = /[А-Яа-яЁё]/;

describe("localizeStoryAuthor", () => {
  it("leaves the Russian locale's byline exactly as the column holds it", () => {
    for (const [author] of AUTHORS_IN_THE_BANK) {
      // Кроме двух правок, обе про ОДНО значение из двадцати: опечатка
      // «RusoFásil» чинится в обеих локалях (долг 182), а испанский маркер
      // оригиналов на /ru называется по-русски (7.196, часть 4а). Все
      // остальные 19 значений — как в колонке.
      if (author.includes("relato original")) continue;
      expect(localizeStoryAuthor(author, "ru")).toBe(author);
    }
  });

  it("на /ru испанский маркер оригиналов называется по-русски — 7.196, часть 4а", () => {
    // Владелец снял на телефоне «Автор: RusoFácil (relato original)» под
    // русским заголовком. По боевой базе это 277 строк из 325.
    expect(localizeStoryAuthor("RusoFácil (relato original)", "ru")).toBe("RusoFácil (оригинальный рассказ)");
    // Отрицательный контроль: на /es маркер остаётся испанским — он там и
    // написан, и правка не имеет права его трогать. Вход со старым
    // написанием имени проверяется ниже, в пробе долга 182.
  });

  it("leaves no Cyrillic in any byline the Spanish locale can show", () => {
    // This is the defect itself, stated as an assertion: on /es the card
    // read «Por Русская народная сказка».
    const leftovers = AUTHORS_IN_THE_BANK.map(([author]) => localizeStoryAuthor(author, "es")).filter((value) =>
      CYRILLIC.test(value)
    );
    expect(leftovers).toEqual([]);
  });

  it("fixes the brand's spelling in the byline of the project's own originals", () => {
    // ДОЛГ 182. В колонке лежит «RusoFásil» — через `s`, — и владелец
    // увидел это на карточках рассказов на живом телефоне 13.09.2026.
    // Правится на отрисовке, обе локали, без единой записи в базу; форма
    // значения при этом не трогается — маркер оригиналов остаётся собой.
    expect(localizeStoryAuthor("RusoFásil (relato original)", "es")).toBe("RusoFácil (relato original)");
    expect(localizeStoryAuthor("RusoFásil (relato original)", "ru")).toBe("RusoFácil (оригинальный рассказ)");
  });

  it("leaves a correctly spelled byline untouched", () => {
    // Отрицательный контроль правки выше: она обязана быть починкой
    // ОПЕЧАТКИ, а не переписыванием всего, что похоже на имя проекта.
    expect(localizeStoryAuthor("RusoFácil (relato original)", "es")).toBe("RusoFácil (relato original)");
    expect(localizeStoryAuthor("А.П. Чехов", "ru")).toBe("А.П. Чехов");
  });

  it("translates the genre label and its qualifier together", () => {
    expect(localizeStoryAuthor("Русская народная сказка", "es")).toBe("Cuento popular ruso");
    expect(localizeStoryAuthor("Русская народная сказка (обработка)", "es")).toBe("Cuento popular ruso (adaptación)");
  });

  it("transliterates a classic author, with and without a qualifier", () => {
    expect(localizeStoryAuthor("А.П. Чехов", "es")).toBe("A. P. Chéjov");
    expect(localizeStoryAuthor("А.П. Чехов (пересказ)", "es")).toBe("A. P. Chéjov (versión libre)");
  });

  it("passes an unknown author through untouched rather than guessing", () => {
    // Production can hold a row this table has never seen; rendering it as
    // itself is the only safe answer.
    expect(localizeStoryAuthor("В.В. Набоков", "es")).toBe("В.В. Набоков");
    expect(localizeStoryAuthor("Some New Author", "es")).toBe("Some New Author");
  });

  it("refuses to translate half of a value", () => {
    // "А.П. Чехов (versión libre)" would be the same defect in a smaller
    // font, and so would "A. P. Chéjov (пересказ)".
    expect(localizeStoryAuthor("В.В. Набоков (пересказ)", "es")).toBe("В.В. Набоков (пересказ)");
    expect(localizeStoryAuthor("А.П. Чехов (сокращение)", "es")).toBe("А.П. Чехов (сокращение)");
  });

  it("handles an empty or blank column without inventing a byline", () => {
    expect(localizeStoryAuthor("", "es")).toBe("");
    expect(localizeStoryAuthor("   ", "es")).toBe("   ");
  });
});
