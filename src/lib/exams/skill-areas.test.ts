import { describe, expect, it } from "vitest";
import ruDictionary from "@/dictionaries/ru.json";
import esDictionary from "@/dictionaries/es.json";
import examContent from "./content.json";
import { localizeSkillAreaTitle } from "./localize";
import { SKILL_AREA_TITLES_RU } from "./skill-area-titles";
import type { ExamContent } from "./types";

const RU = ruDictionary.courses.skillAreaNames;
const ES = esDictionary.courses.skillAreaNames;

const EXAMS = examContent as unknown as Record<string, ExamContent>;
const TITLES = Object.values(EXAMS).flatMap((exam) => exam.skillAreas.map((area) => area.title));

/** Кириллическая буква. Проверяем ею, потому что «переведено» здесь — это
 * не «отличается от исходного», а «читается по-русски». */
const CYRILLIC = /\p{Script=Cyrillic}/u;

describe("названия тематических блоков экзамена на /ru", () => {
  it("замер: блоков 139, различных названий 138, русских вариантов в данных 0", () => {
    // Числа, из-за которых заход вообще случился. Без этого случая всё
    // остальное доказывало бы работу перевода на выборке неизвестного
    // размера.
    expect(TITLES.length).toBe(139);
    expect(new Set(TITLES).size).toBe(138);
    // «Русского варианта в данных нет» — не то же самое, что «нет
    // кириллицы»: четыре названия цитируют русские слова («где?»,
    // «идти y ходить»). Считаем названия, у которых ИСПАНСКОГО нет вовсе.
    const withoutSpanish = TITLES.filter((t) => !/[a-záéíóúñü]/i.test(t));
    expect(withoutSpanish.length).toBe(0);
  });

  it("все 139 названий переводятся, и ни одно не остаётся испанским", () => {
    const untranslated = TITLES.filter((title) => localizeSkillAreaTitle(title, "ru", RU) === title);
    expect(untranslated).toEqual([]);
    for (const title of TITLES) {
      expect(localizeSkillAreaTitle(title, "ru", RU)).toMatch(CYRILLIC);
    }
  });

  it("испанская локаль не меняется ни на знак", () => {
    // Главная граница захода. Проверяется на ВСЕХ 139, а не на образце.
    for (const title of TITLES) {
      expect(localizeSkillAreaTitle(title, "es", ES)).toBe(title);
    }
  });

  it("три формы скобочного хвоста переводятся каждая своим шаблоном", () => {
    expect(localizeSkillAreaTitle("Alfabeto y pronunciación (lección 1)", "ru", RU)).toBe(
      "Алфавит и произношение (урок 1)",
    );
    expect(localizeSkillAreaTitle("Alfabeto y saludos (lecciones 1-2)", "ru", RU)).toBe(
      "Алфавит и приветствия (уроки 1-2)",
    );
    expect(localizeSkillAreaTitle("Pedir, querer y poder (lecciones 5, 10)", "ru", RU)).toBe(
      "Просить, хотеть и мочь (уроки 5, 10)",
    );
    expect(
      localizeSkillAreaTitle(
        "Verbos de movimiento: seis pares y sus prefijos (lección 29 y nivel A2 completo)",
        "ru",
        RU,
      ),
    ).toBe("Глаголы движения: шесть пар и их приставки (урок 29 и весь уровень A2)");
  });

  it("название без скобочного хвоста берётся целиком", () => {
    expect(localizeSkillAreaTitle("El pasado de los verbos", "ru", RU)).toBe("Прошедшее время глаголов");
    // …в том числе то, у которого своя скобка — русская, а не ссылка на урок.
    expect(localizeSkillAreaTitle("Caso preposicional: lugares (где?)", "ru", RU)).toBe(
      "Предложный падеж: места (где?)",
    );
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: чужое имя проходит насквозь целиком", () => {
    // Экзамен можно переписать через /admin/exams. Имя, данное человеком,
    // обязано печататься как есть.
    expect(localizeSkillAreaTitle("Mi bloque de repaso", "ru", RU)).toBe("Mi bloque de repaso");
    expect(localizeSkillAreaTitle("Repaso rápido (lección 3)", "ru", RU)).toBe("Repaso rápido (lección 3)");
    expect(localizeSkillAreaTitle("Мой блок", "ru", RU)).toBe("Мой блок");
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: половинчатого перевода не бывает", () => {
    // Знакомый хвост при незнакомой теме не должен давать «Repaso (урок 3)»:
    // такая строка выглядит опечаткой, а не непереведённым содержимым.
    const out = localizeSkillAreaTitle("Tema inventado (lecciones 4-5)", "ru", RU);
    expect(out).toBe("Tema inventado (lecciones 4-5)");
    expect(out).not.toContain("уроки");
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: приписка спереди или сзади снимает совпадение", () => {
    expect(localizeSkillAreaTitle("Bloque 1 — Alfabeto y pronunciación (lección 1)", "ru", RU)).toBe(
      "Bloque 1 — Alfabeto y pronunciación (lección 1)",
    );
    expect(localizeSkillAreaTitle("Alfabeto y pronunciación (lección 1) [borrador]", "ru", RU)).toBe(
      "Alfabeto y pronunciación (lección 1) [borrador]",
    );
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: щель {list} — номера уроков, а не любой текст", () => {
    expect(localizeSkillAreaTitle("Alfabeto y pronunciación (lección uno)", "ru", RU)).toBe(
      "Alfabeto y pronunciación (lección uno)",
    );
    expect(localizeSkillAreaTitle("Alfabeto y pronunciación (lecciones iniciales)", "ru", RU)).toBe(
      "Alfabeto y pronunciación (lecciones iniciales)",
    );
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ на сам тест: пустая таблица обязана всё вернуть как есть", () => {
    // Иначе «все 139 переводятся» проходило бы и у правила, которое
    // переводит что попало.
    for (const title of TITLES.slice(0, 10)) {
      expect(localizeSkillAreaTitle(title, "ru", RU, {})).toBe(title);
    }
  });

  it("таблица не несёт ключей, которых нет в содержимом", () => {
    // Мёртвая строка в таблице — это перевод, который никто не проверяет.
    const re = /^(.*?)\s*\((?:lecci[oó]n|lecciones)\s+[^)]*\)$/;
    const bases = new Set(TITLES.map((t) => re.exec(t)?.[1] ?? t));
    const orphans = Object.keys(SKILL_AREA_TITLES_RU).filter((key) => !bases.has(key));
    expect(orphans).toEqual([]);
    expect(Object.keys(SKILL_AREA_TITLES_RU).length).toBe(138);
  });
});
