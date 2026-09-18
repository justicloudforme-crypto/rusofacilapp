import { describe, expect, it } from "vitest";
import { compileWithoutLookbehind, findLookbehind } from "./legacy-regexp";
import {
  buildVocabularyIndex,
  detectGrammarFeatures,
  matchVocabulary,
  stemRu,
  type VocabularyCard,
} from "./story-insights";

const cards: VocabularyCard[] = [
  { russian: "медведь", transcription: "myedvyét'", translationEs: "oso" },
  { russian: "тарелка", transcription: "taryélka", translationEs: "plato" },
  { russian: "стол", transcription: "stol", translationEs: "mesa" },
  { russian: "пустой", transcription: "pustóy", translationEs: "vacío" },
  { russian: "пока", transcription: "paká", translationEs: "chao" },
  { russian: "добрый день", transcription: "dóbryy dyen'", translationEs: "buenos días" },
];

describe("stemRu", () => {
  it("strips inflectional endings down to a shared stem", () => {
    expect(stemRu("медведя")).toBe(stemRu("медведь"));
    expect(stemRu("тарелки")).toBe(stemRu("тарелка"));
  });

  it("normalises ё so «зелёный» and «зеленый» agree", () => {
    expect(stemRu("зелёный")).toBe(stemRu("зеленый"));
  });

  it("leaves short words alone rather than stemming them to nothing", () => {
    // Stripping "а" here would leave a 2-letter stem that collides with
    // half the dictionary.
    expect(stemRu("она")).toBe("она");
  });
});

describe("matchVocabulary", () => {
  const index = buildVocabularyIndex(cards);

  it("matches inflected forms back to the dictionary form", () => {
    const found = matchVocabulary("Три медведя сидели за столом.", index);
    expect(found.map((f) => f.russian)).toEqual(["медведь", "стол"]);
    expect(found[0].translationEs).toBe("oso");
  });

  it("rejects the пусти/пустой collision the naive stemmer produced", () => {
    // Both stem to "пуст". This exact pair was offered as a real match —
    // "пусти → пустой (vacío)" — on a live story before sharesPrefix.
    expect(matchVocabulary("Пусти меня домой!", index)).toEqual([]);
  });

  it("skips function words, where card senses rarely fit the story", () => {
    // The card for "пока" means "chao"; in a story it is almost always
    // "mientras". Linking it would teach the wrong sense.
    expect(matchVocabulary("Пока мама готовила, дети играли.", index)).toEqual([]);
  });

  it("never matches multi-word cards", () => {
    expect(matchVocabulary("Добрый день!", index)).toEqual([]);
  });

  it("reports each word once and honours the limit", () => {
    const text = "Стол, стол, столе, тарелка, медведь.";
    expect(matchVocabulary(text, index).map((f) => f.russian)).toEqual([
      "стол",
      "тарелка",
      "медведь",
    ]);
    expect(matchVocabulary(text, index, 2)).toHaveLength(2);
  });
});

describe("detectGrammarFeatures", () => {
  it("finds reflexive verbs and quotes the word from the text", () => {
    const found = detectGrammarFeatures("Девочка улыбнулась и вернулась домой.");
    const reflexive = found.find((f) => f.slug === "verbo-reflexivo-sya");
    expect(reflexive?.examples).toEqual(["улыбнулась", "вернулась"]);
  });

  it("matches across Cyrillic word boundaries", () => {
    // The patterns originally used \b, which is ASCII-only in JS and so
    // matched nothing at all in Russian — 0 hits across 130 stories.
    expect(detectGrammarFeatures("Два медведя").some((f) => f.slug === "numeral")).toBe(true);
  });

  it("does not fire on a word that merely contains the ending", () => {
    // "лиса" ends in -са, not the reflexive -ся.
    expect(detectGrammarFeatures("Лиса и заяц")).toEqual([]);
  });

  it("does not label an ordinary adjective a passive participle", () => {
    // "жёлтая" was rendered as a passive participle on a live page before
    // the feature was removed; "синее" as a comparative.
    const found = detectGrammarFeatures("Жёлтая бабочка и синее небо.");
    expect(found.map((f) => f.slug)).not.toContain("participio-pasivo");
    expect(found.map((f) => f.slug)).not.toContain("grado-comparativo");
  });

  it("does not call подушка a diminutive", () => {
    expect(detectGrammarFeatures("Подушка и лягушка.")).toEqual([]);
  });

  it("only treats unambiguous imperative endings as imperatives", () => {
    // "говорите" is equally the 2nd-person plural present.
    expect(detectGrammarFeatures("Вы говорите быстро.").map((f) => f.slug)).not.toContain(
      "modo-imperativo",
    );
    expect(detectGrammarFeatures("Делайте так.").map((f) => f.slug)).toContain("modo-imperativo");
  });

  it("caps examples and keeps them unique", () => {
    const found = detectGrammarFeatures("Один, один, одна, одно, два.", 2);
    const numeral = found.find((f) => f.slug === "numeral");
    expect(numeral?.examples).toHaveLength(2);
    expect(new Set(numeral?.examples).size).toBe(2);
  });

  it("returns nothing for text with no detectable feature", () => {
    expect(detectGrammarFeatures("Мама мыла раму.")).toEqual([]);
  });
});

/**
 * ====================================================================
 * ГРАНИЦА СЛОВА БЕЗ ПРОСМОТРА НАЗАД — 18.09.2026
 * ====================================================================
 *
 * `ru()` писал границу слева как `(?<!\p{L})`. Это ES2018, и на iOS его
 * нет до Safari 16.4: `new RegExp` там бросает `SyntaxError` на
 * построении. Сегодня этот модуль собирается только на сервере, но
 * правило «в `src/` просмотра назад нет» держит `check:no-lookbehind`, и
 * исключений у него нет — один чужой импорт, и модуль уедет в браузер
 * молча.
 *
 * Правка обязана быть незаметной на современном движке, и это
 * проверяется сравнением, а не рассуждением.
 */
describe("детектор грамматики собирается без просмотра назад", () => {
  /** Редакция ДО правки, оставленная здесь ради «до/после». */
  const legacy = (body: string) => new RegExp(`(?<!\\p{L})(?:${body})(?!\\p{L})`, "giu");
  const current = (body: string) => new RegExp(`(^|[^\\p{L}])((?:${body}))(?!\\p{L})`, "giu");

  const BODIES = [
    "[а-яё]{4,}(?:ся|сь)",
    "[а-яё]{3,}(?:ющ|ущ|ащ|ящ|вш)(?:ий|ая|ее|ие|его|ую|им|ым|их|ем|ей)",
    "лучше|хуже|больше|меньше|старше|младше|выше|ниже|дальше|ближе",
    "[а-яё]{2,}(?:йте|ьте)",
    "два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|один|одна|одно",
    "бы",
    "[а-яё]{3,}(?:вши|вшись)",
  ];

  /** Настоящий русский текст: каждая строка — кусок рассказа или примера
   * из урока, взятый дословно. Пол ниже не даёт выборке усохнуть. */
  const RUSSIAN = [
    "Медведь шёл по лесу и увидел домик. Он постучался: «Кто в теремочке живёт?»",
    "Девочка попросила: «Скажите, пожалуйста, где здесь аптека?» — и улыбнулась.",
    "Мальчик был бы рад, если бы кто-нибудь помог ему найти дорогу домой.",
    "Учительница сказала: «Читайте внимательно и пишите аккуратно, дети».",
    "Река стала шире, а лес — гуще; идти дальше было труднее, чем раньше.",
    "Три брата, две сестры и один старый пёс жили в маленькой деревне у моря.",
    "Услышав шум, он остановился, оглянувшись, и увидел бегущую по тропинке лису.",
    "Дед вернулся домой, умылся, переоделся и сел за стол, где уже стоял самовар.",
    "Кошка спряталась под крыльцом, испугавшись громкого лая соседской собаки.",
    "Больше всего на свете старик любил тишину, и потому уходил в поле один.",
  ];

  it("исходники выражений не содержат просмотра назад", () => {
    for (const body of BODIES) {
      expect(findLookbehind(current(body).source), body).toBeNull();
      expect(() => compileWithoutLookbehind(current(body).source, "giu"), body).not.toThrow();
    }
  });

  it("ПОЗИТИВНЫЙ КОНТРОЛЬ: редакция ДО правки на том же движке падает", () => {
    for (const body of BODIES) {
      expect(findLookbehind(legacy(body).source), body).toBe("(?<!");
      expect(() => compileWithoutLookbehind(legacy(body).source, "giu"), body).toThrow(SyntaxError);
    }
  });

  it("до и после находят одно и то же на настоящем русском тексте", () => {
    // Пол: две пустые выборки сравнивать нельзя (условие захода).
    expect(RUSSIAN.length).toBeGreaterThan(5);
    let hits = 0;
    const divergent: string[] = [];
    for (const text of RUSSIAN) {
      for (const body of BODIES) {
        const before = [...text.matchAll(legacy(body))].map((m) => [m.index, m[0]]);
        const after = [...text.matchAll(current(body))].map((m) => [m.index! + m[1].length, m[2]]);
        hits += before.length;
        if (JSON.stringify(before) !== JSON.stringify(after)) divergent.push(`${body} — ${text.slice(0, 40)}`);
      }
    }
    expect(divergent).toEqual([]);
    expect(hits).toBeGreaterThan(20);
  });

  it("сам детектор по-прежнему называет слово, а не слово со знаком слева", () => {
    // Нулевая группа теперь включает съеденную границу; если бы вызывающий
    // остался на `match[0]`, примеры печатались бы как « бы» и « три».
    const features = detectGrammarFeatures("Он сказал, что три брата умылись бы, услышав это.");
    for (const feature of features) {
      for (const example of feature.examples) {
        expect(example, `${feature.slug}: «${example}»`).toBe(example.trim());
        expect(/^[а-яё]/.test(example), `${feature.slug}: «${example}»`).toBe(true);
      }
    }
    expect(features.length).toBeGreaterThan(0);
  });
});
