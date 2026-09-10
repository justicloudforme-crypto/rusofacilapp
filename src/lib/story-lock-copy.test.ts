import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import es from "../dictionaries/es.json";
import ru from "../dictionaries/ru.json";

/**
 * Текст замка обязан называть уровень САМОГО рассказа, а не константу.
 *
 * Долг 115, найден замером 09.09.2026 (PROGRESS.md 7.160): замок ставит
 * колонка `Story.premiumOnly` (`getStoryAccess`, entitlement.ts), а не
 * уровень, поэтому запертым оказывается и не-C1 рассказ. Словарь при этом
 * вшивал литерал «C1»/«nivel C1», и подписчику `standard` он врал на
 * **33 страницах из 98** запертых в каждой локали (живой прод, обе локали,
 * 09.09.2026). Значок уровня рядом при этом печатал правду — то есть на
 * одном экране стояли два разных уровня одного рассказа.
 *
 * Правило асимметричное, как у `check:mark-truth`: строка обязана нести
 * щель `{level}`, и в ней не должно остаться ни одного кода CEFR; обратное
 * (щель без подстановки) правилом не является и ловится вторым случаем —
 * страница обязана подставлять в неё `story.level`.
 */

const LOCK_BODY_PATH = "stories.premiumTierLockBody";
const CEFR = /\b(A1|A2|B1|B2|C1|C2)\b/;
const PAGE = join(process.cwd(), "src", "app", "[lang]", "stories", "[id]", "page.tsx");

const BODIES: Array<[string, string]> = [
  ["es", es.stories.premiumTierLockBody],
  ["ru", ru.stories.premiumTierLockBody],
];

describe("текст замка рассказа не вшивает уровень", () => {
  it("обе строки вообще найдены", () => {
    // Пустая выборка сделала бы утверждения ниже верными ни о чём —
    // PROGRESS.md 4.1.
    expect(BODIES).toHaveLength(2);
    for (const [lang, body] of BODIES) expect(body.length, lang).toBeGreaterThan(40);
  });

  for (const [lang, body] of BODIES) {
    it(`${lang}: ${LOCK_BODY_PATH} несёт щель {level}`, () => {
      expect(body).toContain("{level}");
    });

    it(`${lang}: ${LOCK_BODY_PATH} не называет ни одного уровня литералом`, () => {
      expect(CEFR.exec(body)?.[0] ?? null).toBeNull();
    });
  }

  it("страница подставляет в щель уровень рассказа", () => {
    const source = readFileSync(PAGE, "utf8");
    expect(source).toContain('dict.stories.premiumTierLockBody.replace("{level}", story.level)');
  });

  it("позитивный контроль: прежние строки словаря ловятся обеими проверками", () => {
    // Ровно то, что лежало в dictionaries/{es,ru}.json:889 до этой правки.
    const before = [
      "Tu suscripción actual da acceso a la mayoría de las historias, pero esta forma parte de la biblioteca ampliada de nivel C1, exclusiva para el plan Premium.",
      "Ваша текущая подписка открывает большинство историй, но эта — часть расширенной библиотеки уровня C1, доступной только владельцам плана Premium.",
    ];
    for (const body of before) {
      expect(body.includes("{level}"), body.slice(0, 20)).toBe(false);
      expect(CEFR.test(body), body.slice(0, 20)).toBe(true);
    }
  });

  it("позитивный контроль: страница без подстановки ловится", () => {
    const planted = "{needsPremiumUpgrade ? dict.stories.premiumTierLockBody : dict.stories.premiumLockBody}";
    expect(planted.includes('premiumTierLockBody.replace("{level}", story.level)')).toBe(false);
  });

  it("отрицательный контроль: соседняя строка замка уровня не называет и щели не требует", () => {
    // premiumLockBody — замок для НЕподписчика; он про подписку вообще, а
    // не про уровень, и правило на него не распространяется. Иначе
    // проверка бы требовала щель там, где подставлять нечего.
    for (const [lang, body] of [["es", es.stories.premiumLockBody], ["ru", ru.stories.premiumLockBody]]) {
      expect(body.includes("{level}"), lang).toBe(false);
      expect(CEFR.test(body), lang).toBe(false);
    }
  });
});
