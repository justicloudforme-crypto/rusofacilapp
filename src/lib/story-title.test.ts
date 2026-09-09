import { describe, expect, it } from "vitest";
import { spanishTitleProblem, storySearchTerms, storyTitles } from "./story-title";
import { STORY_CONTROL_SIZE, STORY_PILOT_SIZE, isFrozenStory } from "./story-pilot";
import groups from "../../docs/experiment-groups-2026-08-28.json";

/**
 * Правило подачи названия — одно на весь сайт, и здесь оно проверяется
 * ровно с трёх сторон, потому что цена ошибки у каждой своя:
 *
 *   1. пусто → страница не сдвигается ни на знак (это и есть обещание,
 *      на котором стоит PR кода: без данных ничего не меняется);
 *   2. заморозка → 65 рассказов A1 не получают новую подачу до 25.09.2026,
 *      даже когда `titleEs` у них уже записан;
 *   3. есть данные и рассказ не заморожен → две строки, и в правильном
 *      порядке.
 */

const DAY_OF_LAUNDRY = { title: "День стирки", level: "A1" } as const; // пилот
const TEREMOK = { title: "Теремок", level: "A1" } as const; // контроль
const FREE = { title: "Хамелеон", level: "B1" } as const; // вне эксперимента

describe("storyTitles", () => {
  it("без испанского названия отдаёт ровно то, что было до колонки — на обеих локалях", () => {
    for (const lang of ["es", "ru"] as const) {
      expect(storyTitles(FREE, lang)).toEqual({ primary: "Хамелеон", secondary: null });
      expect(storyTitles({ ...FREE, titleEs: null }, lang)).toEqual({ primary: "Хамелеон", secondary: null });
      // Пробел — это не название. Иначе случайно сохранённый пробел
      // выключил бы русский оригинал и оставил читателя без обеих строк.
      expect(storyTitles({ ...FREE, titleEs: "   " }, lang)).toEqual({ primary: "Хамелеон", secondary: null });
    }
  });

  it("на /es с испанским названием: оно первое, русский оригинал второй", () => {
    expect(storyTitles({ ...FREE, titleEs: "El camaleón" }, "es")).toEqual({
      primary: "El camaleón",
      secondary: "Хамелеон",
    });
  });

  it("на /ru не меняется ничего — там русское название и есть название", () => {
    expect(storyTitles({ ...FREE, titleEs: "El camaleón" }, "ru")).toEqual({
      primary: "Хамелеон",
      secondary: null,
    });
  });

  it("замороженные 65 новой подачи не получают, даже когда испанское название записано", () => {
    for (const frozen of [DAY_OF_LAUNDRY, TEREMOK]) {
      expect(isFrozenStory(frozen)).toBe(true);
      expect(storyTitles({ ...frozen, titleEs: "Día de colada" }, "es")).toEqual({
        primary: frozen.title,
        secondary: null,
      });
    }
  });

  it("заморозка задана парой (title, level), а не одним названием", () => {
    // Тот же заголовок на другом уровне — это другой рассказ, и он
    // подачу получает. Иначе список из 65 строк тихо накрывал бы чужие.
    expect(storyTitles({ title: "День стирки", level: "B1", titleEs: "Día de colada" }, "es")).toEqual({
      primary: "Día de colada",
      secondary: "День стирки",
    });
  });

  it("вся замороженная группа целиком, а не её кусок", () => {
    const all = [...groups.storyPilot, ...groups.storyControl];
    expect(all.length).toBe(STORY_PILOT_SIZE + STORY_CONTROL_SIZE);
    expect(all.length).toBe(65);
  });
});

describe("storySearchTerms", () => {
  it("русское название остаётся строкой поиска и тогда, когда печатается испанское", () => {
    expect(storySearchTerms({ ...FREE, titleEs: "El camaleón" })).toEqual(["Хамелеон", "El camaleón"]);
    expect(storySearchTerms(FREE)).toEqual(["Хамелеон"]);
  });
});

describe("spanishTitleProblem", () => {
  it("ловит кириллицу — целую строку и одну букву внутри слова", () => {
    expect(spanishTitleProblem("День стирки")).toBe("кириллица в испанском названии");
    // Одна кириллическая «а» (U+0430) внутри латинского слова: ровно тот
    // класс, на котором 04.09.2026 покраснел CI (PROGRESS.md 4.6).
    expect(spanishTitleProblem("El cаmaleón")).toBe("кириллица в испанском названии");
  });

  it("пропускает нейтральный испанский со всей его диакритикой и знаками", () => {
    for (const ok of [
      "Día de colada",
      "El niño y el pingüino",
      "¿Cuántos platos?",
      "La zorra y la grulla",
      "Kolobok",
      "A. P. Chéjov",
    ]) {
      expect(spanishTitleProblem(ok)).toBeNull();
    }
  });

  it("записанная пустота — это дефект, а не «названия нет»", () => {
    expect(spanishTitleProblem("")).not.toBeNull();
    expect(spanishTitleProblem("   ")).not.toBeNull();
  });
});
