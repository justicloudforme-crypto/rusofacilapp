import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alphabetAudioKey } from "../lessons/audioKeys";
import { ALPHABET_PAGE_PATH, ALPHABET_TRAPS, CYRILLIC_ALPHABET } from "./cyrillic-alphabet";
import { alphabetAudioKeys } from "./alphabet-audio";

/**
 * Что здесь защищается, по пунктам — и почему каждый пункт не «на глаз».
 *
 * 1. Порядок 33 строк ДОЛЖЕН совпадать с массивом `alphabet` урока a1-1,
 *    потому что `itemKey` клипа с названием буквы — это её позиция там
 *    (`alphabetAudioKey`). Разъедься они — и буква «ж» заговорит голосом
 *    «зэ», молча и без единой ошибки в логах. Это ровно тот класс
 *    дефектов, из-за которого `audioKeys.ts` вообще появился (14 items,
 *    PROGRESS.md).
 * 2. Каждая тройка (contentType, contentId, itemKey) должна быть уникальна
 *    и указывать на УРОК, а не на карточку: `contentId` урока — слаг,
 *    одинаковый на локальной копии и на проде, а у карточки там cuid,
 *    который между базами расходится (правило №7).
 * 3. Транскрипции — по стандарту «ЗАКРЫТО #4/#5»: реальное произношение.
 *    Тест ловит не «красоту», а два механических признака побуквенной
 *    записи, которые проверяются однозначно.
 */

const LESSON_ALPHABET: { letter: string; name: string }[] = (
  JSON.parse(
    readFileSync(join(process.cwd(), "src", "lib", "lessons", "content.json"), "utf8"),
  ) as Record<string, { alphabet: { letter: string; name: string }[] }>
)["a1-1"].alphabet;

describe("CYRILLIC_ALPHABET", () => {
  it("покрывает ровно 33 буквы, без повторов", () => {
    expect(CYRILLIC_ALPHABET).toHaveLength(33);
    expect(new Set(CYRILLIC_ALPHABET.map((l) => l.letter)).size).toBe(33);
  });

  it("совпадает с массивом alphabet урока a1-1 построчно — буквой, названием и позицией", () => {
    expect(LESSON_ALPHABET).toHaveLength(33);
    for (const [index, entry] of CYRILLIC_ALPHABET.entries()) {
      expect(entry.lessonAlphabetIndex).toBe(index);
      expect(entry.letter).toBe(LESSON_ALPHABET[index].letter);
      expect(entry.name).toBe(LESSON_ALPHABET[index].name);
    }
  });

  it("у каждой буквы есть звук, испанское соответствие и слово-пример", () => {
    for (const entry of CYRILLIC_ALPHABET) {
      expect(entry.sound.length).toBeGreaterThan(0);
      expect(entry.spanish.length).toBeGreaterThan(10);
      expect(entry.example.ru.length).toBeGreaterThan(1);
      expect(entry.example.es.length).toBeGreaterThan(1);
      expect(entry.example.tr.length).toBeGreaterThan(1);
    }
  });

  it("слова-примеры не повторяются: 33 разных слова, а не одно на три буквы", () => {
    expect(new Set(CYRILLIC_ALPHABET.map((l) => l.example.ru)).size).toBe(33);
  });

  it("слово-пример действительно содержит свою букву", () => {
    for (const entry of CYRILLIC_ALPHABET) {
      const lower = entry.letter.split(" ")[1] ?? entry.letter;
      expect(entry.example.ru.toLowerCase()).toContain(lower);
    }
  });

  it("транскрипции записаны по реальному произношению, а не побуквенно", () => {
    const byLetter = new Map(CYRILLIC_ALPHABET.map((l) => [l.letter.split(" ")[0], l]));
    // Аканье: безударное «о» не пишется как «o».
    expect(byLetter.get("О")!.example.tr).toBe("aknó");
    expect(byLetter.get("Г")!.example.tr).toBe("górat");
    expect(byLetter.get("Я")!.example.tr).toBe("yáblaka");
    // Оглушение конечного согласного.
    expect(byLetter.get("Х")!.example.tr).toBe("khlyep");
    expect(byLetter.get("Э")!.example.tr).toBe("etásh");
    expect(byLetter.get("Ъ")!.example.tr).toBe("padyést");
    // Оглушение внутри слова, перед глухим.
    expect(byLetter.get("Ю")!.example.tr).toBe("yúpka");
    // Мягкость помечена апострофом.
    expect(byLetter.get("Ь")!.example.tr).toBe("mat'");
  });

  it("ни одна транскрипция не тянет за собой кириллицу", () => {
    for (const entry of CYRILLIC_ALPHABET) {
      expect(entry.example.tr).not.toMatch(/[А-Яа-яЁё]/);
    }
  });

  it("восемь букв-ловушек — те, что названы, и в том же порядке", () => {
    expect(ALPHABET_TRAPS.map((t) => t.letter.split(" ")[0])).toEqual([
      "В",
      "Р",
      "С",
      "Н",
      "У",
      "Х",
      "Ы",
      "Ь",
    ]);
  });

  it("путь страницы — один литерал", () => {
    expect(ALPHABET_PAGE_PATH).toBe("/alfabeto-cirilico");
  });
});

describe("ключи звука", () => {
  it("их ровно 66: 33 названия букв и 33 слова-примера", () => {
    expect(alphabetAudioKeys()).toHaveLength(66);
  });

  it("все 66 троек различны — ни одна кнопка не повторяет чужую", () => {
    const keys = alphabetAudioKeys().map((k) => `${k.lessonId} ${k.itemKey}`);
    expect(new Set(keys).size).toBe(66);
  });

  it("названия букв берутся у урока a1-1 по позиции буквы", () => {
    const letters = alphabetAudioKeys().slice(0, 33);
    for (const [index, key] of letters.entries()) {
      expect(key.lessonId).toBe("a1-1");
      expect(key.itemKey).toBe(alphabetAudioKey(index));
    }
  });

  it("каждый contentId — слаг урока вида «a1-1», а не cuid карточки", () => {
    for (const key of alphabetAudioKeys()) {
      expect(key.lessonId).toMatch(/^[abc][12]-\d{1,2}$/);
    }
  });
});

/**
 * Урок 7.94: 78 из 160 URL родились сиротами — страница есть, в карте
 * сайта есть, а ребра к ней нет ни одного. Здесь входящие ссылки
 * зафиксированы как требование, а не как разовая проверка: удали любую из
 * четырёх — и этот файл назовёт, какую именно.
 *
 * Читается ИСХОДНИК, а не отрендеренный HTML, нарочно: юнит-набор бежит
 * без базы и без сборки (check:no-db-in-tests), а живой обход всё равно
 * делается отдельно перед мержем — он проверяет другое, достижимость от
 * корня локали.
 */
describe("входящие ссылки на страницу", () => {
  const SOURCES = [
    "src/app/[lang]/gramatica/alfabeto-ruso/page.tsx",
    "src/app/[lang]/gramatica/page.tsx",
    "src/app/[lang]/sopa-de-letras-alfabeto-cirilico/page.tsx",
    "src/app/[lang]/juegos-para-aprender-ruso/page.tsx",
  ];

  it.each(SOURCES)("%s ссылается на /es/alfabeto-cirilico", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    expect(source).toContain(`href="/es${ALPHABET_PAGE_PATH}"`);
  });

  it("страница ссылается назад на все три соседние страницы про алфавит", () => {
    const page = readFileSync(
      join(process.cwd(), "src", "app", "[lang]", "alfabeto-cirilico", "page.tsx"),
      "utf8",
    );
    for (const href of [
      "/es/gramatica/alfabeto-ruso",
      "/es/courses/a1/1",
      "/es/sopa-de-letras-alfabeto-cirilico",
    ]) {
      expect(page).toContain(`href="${href}"`);
    }
  });
});
