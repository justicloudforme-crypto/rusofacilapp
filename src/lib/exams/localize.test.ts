import { describe, expect, it } from "vitest";
import { localizeExamText } from "./localize";
import es from "@/dictionaries/es.json";
import ru from "@/dictionaries/ru.json";
import content from "./content.json";
import type { ExamContent } from "./types";

/**
 * Названия экзаменов на `/ru` (PROGRESS.md 7.129, часть 4).
 *
 * Проверяются обе половины правила, и вторая важнее первой: строка,
 * отвечающая шаблону, обязана перевестись, а строка, ему НЕ отвечающая, —
 * обязана пройти насквозь. Без второй половины правка превратилась бы в
 * подмену любого имени, которое админ дал экзамену через `/admin/exams`.
 */

const RU = ru.courses.examNames;
const ES = es.courses.examNames;
const exams = Object.values(content as unknown as Record<string, ExamContent>);

describe("названия экзаменов в русской локали", () => {
  it("читает содержимое и находит там ровно двенадцать экзаменов", () => {
    // Без этой строки пустой разбор сделал бы все утверждения ниже
    // истинными на пустом множестве.
    expect(exams).toHaveLength(12);
  });

  it("все двенадцать названий и все двенадцать подписей сегодня по-испански", () => {
    const cyrillic = /[а-яё]/i;
    expect(exams.filter((e) => cyrillic.test(e.title))).toHaveLength(0);
    expect(exams.filter((e) => cyrillic.test(e.lessonRangeLabel))).toHaveLength(0);
  });

  it("переводит все двенадцать названий и все двенадцать подписей", () => {
    const cyrillic = /[а-яё]/i;
    const titles = exams.map((e) => localizeExamText(e.title, "ru", RU));
    const labels = exams.map((e) => localizeExamText(e.lessonRangeLabel, "ru", RU));
    expect(titles.filter((t) => cyrillic.test(t))).toHaveLength(12);
    expect(labels.filter((t) => cyrillic.test(t))).toHaveLength(12);
  });

  it("называет уровень и номера уроков теми же значениями, что испанская строка", () => {
    expect(localizeExamText("Examen A1 · Lecciones 1 a 10", "ru", RU)).toBe("Экзамен A1 · Уроки 1–10");
    expect(localizeExamText("Examen B2 · Lecciones 11 a 20", "ru", RU)).toBe("Экзамен B2 · Уроки 11–20");
    expect(localizeExamText("Examen final del nivel A2", "ru", RU)).toBe("Итоговый экзамен уровня A2");
    expect(localizeExamText("Lecciones 11-20", "ru", RU)).toBe("Уроки 11-20");
    expect(localizeExamText("Lecciones 1-30 (nivel B1 completo)", "ru", RU)).toBe("Уроки 1-30 (весь уровень B1)");
  });

  it("испанскую локаль не трогает вовсе", () => {
    for (const exam of exams) {
      expect(localizeExamText(exam.title, "es", ES)).toBe(exam.title);
      expect(localizeExamText(exam.lessonRangeLabel, "es", ES)).toBe(exam.lessonRangeLabel);
    }
  });

  it("отрицательный контроль: имя, данное админом, проходит насквозь", () => {
    // Ровно тот случай, ради которого перевод сделан совпадением с
    // шаблоном, а не таблицей из двенадцати строк.
    for (const custom of [
      "Prueba sorpresa de la unidad 3",
      "Examen de repaso",
      "Examen A1 · Lecciones 1 a 10 (versión corta)",
      "Мой экзамен",
      "",
      "   ",
    ]) {
      expect(localizeExamText(custom, "ru", RU)).toBe(custom);
    }
  });

  it("отрицательный контроль: щель не глотает произвольный текст", () => {
    // `{level}` — короткий код, а не «что угодно до следующей точки».
    expect(localizeExamText("Examen de nivel intermedio · Lecciones 1 a 10", "ru", RU)).toBe(
      "Examen de nivel intermedio · Lecciones 1 a 10",
    );
    expect(localizeExamText("Examen final del nivel intermedio", "ru", RU)).toBe("Examen final del nivel intermedio");
  });

  it("отрицательный контроль: приписка спереди или сзади снимает совпадение", () => {
    expect(localizeExamText("Repaso — Examen A1 · Lecciones 1 a 10", "ru", RU)).toBe(
      "Repaso — Examen A1 · Lecciones 1 a 10",
    );
    expect(localizeExamText("Examen final del nivel A1 (2026)", "ru", RU)).toBe("Examen final del nivel A1 (2026)");
  });

  it("позитивный контроль на сам тест: подсаженный сломанный шаблон роняет перевод", () => {
    // Если русский шаблон потеряет щели, значения подставить будет некуда —
    // и это обязано быть видно, а не превратиться в одну строку на все
    // двенадцать экзаменов.
    const broken = { ...RU, range: "Экзамен" };
    expect(localizeExamText("Examen A1 · Lecciones 1 a 10", "ru", broken)).toBe("Экзамен");
    expect(localizeExamText("Examen A1 · Lecciones 1 a 10", "ru", RU)).not.toBe("Экзамен");
  });

  it("уровень, которого сегодня нет, переводится так же — правило про форму, а не про список", () => {
    expect(localizeExamText("Examen C1 · Lecciones 1 a 10", "ru", RU)).toBe("Экзамен C1 · Уроки 1–10");
  });
});
