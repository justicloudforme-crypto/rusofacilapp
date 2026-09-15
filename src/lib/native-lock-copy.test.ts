/**
 * ТЕКСТ ОКНА «ЭТОТ МАТЕРИАЛ ЗАКРЫТ» ЗАВИСИТ ОТ ТИПА МАТЕРИАЛА — 7.196, ч. 3.
 *
 * Владелец снял с телефона один и тот же текст по тапу на закрытый пазл
 * филворда и на закрытый рассказ: «Он относится к закрытой части КУРСА».
 * Ни пазл, ни рассказ курсом не являются.
 *
 * Перепись здесь — типы × две локали, и у каждой клетки свой текст.
 * Позитивный контроль обязателен: подсадка чужого текста роняет прогон.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LOCKED_KINDS, nativeAccessCopy, nativeLockBody, type LockedKind } from "./native-access-copy";
import { locales } from "@/i18n/config";

describe("перепись: тип × локаль", () => {
  it("у каждого из семи типов свой текст в каждой из двух локалей", () => {
    const seen = new Map<string, string>();
    let cells = 0;
    for (const lang of locales) {
      for (const kind of LOCKED_KINDS) {
        const text = nativeLockBody(lang, kind, false);
        expect(text.length).toBeGreaterThan(40);
        const key = `${lang}/${text}`;
        expect(seen.has(key)).toBe(false); // два типа с одним текстом — это и был дефект
        seen.set(key, kind);
        cells += 1;
      }
    }
    // Без этой строки «ни одного совпадения» могло бы значить «проверено
    // ноль клеток».
    expect(cells).toBe(locales.length * LOCKED_KINDS.length);
    expect(cells).toBe(14);
  });

  it("слово «курс» стоит только там, где речь действительно о курсе", () => {
    // Дефект владельца, записанный утверждением: пазл и рассказ курсом не
    // являются, и текст не имеет права называть их частью курса.
    const notCourse: LockedKind[] = ["story", "puzzle", "video", "flashcard", "idiom"];
    for (const kind of notCourse) {
      expect(nativeLockBody("ru", kind, false)).not.toMatch(/курс/i);
      expect(nativeLockBody("es", kind, false)).not.toMatch(/curso/i);
    }
    // И обратная половина: у урока и экзамена курс назван.
    expect(nativeLockBody("ru", "lesson", false)).toMatch(/курс/i);
    expect(nativeLockBody("es", "lesson", false)).toMatch(/curso/i);
  });

  it("премиальный сорт называет план, и только он", () => {
    for (const lang of locales) {
      for (const kind of LOCKED_KINDS) {
        const plain = nativeLockBody(lang, kind, false);
        const premium = nativeLockBody(lang, kind, true);
        expect(plain).not.toMatch(/Premium/);
        expect(premium).toMatch(/Premium/);
        expect(premium.startsWith(plain)).toBe(true);
      }
    }
  });

  it("ни в одном тексте нет призыва купить и ни одной ссылки — правило 7.192 в силе", () => {
    // Блокер магазина: внутри оболочки нет ни цены, ни кнопки, ни ссылки
    // на оплату. Проверяется здесь по самим строкам, а не «по намерению».
    const forbidden = [
      /suscr[ií]bete/i,
      /оформ/i,
      /купи/i,
      /comprar/i,
      /\bhttps?:\/\//,
      /\/pricing/,
      /\bMXN\b|\bUSD\b|\$\d/,
    ];
    for (const lang of locales) {
      for (const kind of LOCKED_KINDS) {
        for (const premium of [false, true]) {
          const text = nativeLockBody(lang, kind, premium);
          for (const pattern of forbidden) expect([kind, lang, pattern.source, pattern.test(text)]).toEqual([kind, lang, pattern.source, false]);
        }
      }
    }
  });
});

describe("позитивный контроль", () => {
  it("подсадка прежнего поведения — один текст на всё — роняет перепись", () => {
    // Ровно то, что стояло до правки: `lock.body` строкой, а не таблицей.
    const planted = Object.fromEntries(LOCKED_KINDS.map((k) => [k, nativeAccessCopy("ru").lock.body.lesson])) as Record<
      LockedKind,
      string
    >;
    const texts = LOCKED_KINDS.map((k) => planted[k]);
    expect(new Set(texts).size).toBe(1); // подсадка действительно одинаковая
    // …а живая таблица даёт семь разных.
    expect(new Set(LOCKED_KINDS.map((k) => nativeAccessCopy("ru").lock.body[k])).size).toBe(LOCKED_KINDS.length);
  });

  it("каждый вызов окна называет тип: умолчаний в исходниках нет ни одного", () => {
    // Перепись по коду, а не по памяти: `openPaywall(reason)` без второго
    // аргумента вернул бы пазлу текст урока — ровно дефект владельца.
    const files = [
      "src/components/stories/StoriesCatalog.tsx",
      "src/components/media/MediaCatalog.tsx",
      "src/components/word-games/WordGamesPicker.tsx",
      "src/components/flashcards/FreeTrialLimitBanner.tsx",
      "src/components/native/NativeLockedLink.tsx",
    ];
    let calls = 0;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/openPaywall\(([^)]*)\)/g)) {
        const args = match[1].trim();
        if (!args) continue; // объявление типа, не вызов
        expect([file, args, args.includes(",")]).toEqual([file, args, true]);
        calls += 1;
      }
    }
    expect(calls).toBe(files.length);
  });
});
