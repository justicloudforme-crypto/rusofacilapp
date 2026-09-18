/**
 * ПЛАШКА ЗАКРЫТОГО ВИДНА И В БРАУЗЕРЕ — ЗНАЧИТ НЕ ГОВОРИТ «ПРИЛОЖЕНИЕ»
 * (заход 7.211, задача 3.2, пункт 4).
 *
 * Что снял владелец: в БРАУЗЕРЕ, `/ru/vocabulary?level=B1`, гостем —
 * «В этой версии приложения закрыто 1791 слово уровня B1». Слово
 * «приложение» в браузере неуместно: человек ни в каком приложении не
 * находится.
 *
 * Перепись 18.09.2026 по живой сборке, 36 страниц (2 места × 2 локали ×
 * 9 адресов): формулировка доезжает до БРАУЗЕРА ровно на трёх адресах
 * словаря в каждой локали — `?level=B1`, `?level=B2`, `?level=C1`, по
 * одному вхождению. Все три печатает `NativeLockedNotice` из блока
 * `locked`. Остальные вхождения («покупок нет» на `/pricing`) живут
 * ТОЛЬКО внутри оболочки, где они верны, и здесь не трогаются.
 *
 * Отсюда правило: блок `locked` — единственный, который видит и
 * браузер, — обязан быть НЕЗАВИСИМЫМ ОТ МЕСТА. Отрицательный контроль
 * рядом: у блока `paywall`, который браузеру не показывается никогда,
 * слово «приложение» остаётся и обязано остаться.
 */
import { describe, expect, it } from "vitest";
import { nativeAccessCopy } from "./native-access-copy";

const PLACE_WORDS = {
  ru: /приложени/i,
  es: /aplicaci[oó]n/i,
};

describe("тексты закрытого материала не называют место", () => {
  for (const lang of ["ru", "es"] as const) {
    it(`${lang}: в блоке locked нет слова о приложении`, () => {
      const locked = nativeAccessCopy(lang).locked;
      const strings = [locked.closed, locked.closedAtLevel, locked.closedInTopic, locked.closedAtLevelInTopic, locked.rest];
      expect(strings.length).toBe(5);
      for (const s of strings) expect(s).not.toMatch(PLACE_WORDS[lang]);
    });

    it(`${lang}: подстановки на месте — текст не потерял ни числа, ни уровня, ни темы`, () => {
      const locked = nativeAccessCopy(lang).locked;
      expect(locked.closed).toContain("{items}");
      expect(locked.closedAtLevel).toContain("{items}");
      expect(locked.closedAtLevel).toContain("{level}");
      expect(locked.closedInTopic).toContain("{topic}");
      expect(locked.closedAtLevelInTopic).toContain("{level}");
      expect(locked.closedAtLevelInTopic).toContain("{topic}");
    });

    it(`${lang}: ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ — у витрины, которой браузер не видит, слово о приложении остаётся`, () => {
      expect(nativeAccessCopy(lang).notice.body).toMatch(PLACE_WORDS[lang]);
    });
  }
});
