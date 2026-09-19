import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCESS_CODE_ALPHABET,
  NORMALIZATION_CLASSES,
  describeNormalization,
  formatAccessCode,
  normalizationTag,
  normalizeAccessCode,
} from "./access-code-format";

/**
 * Форма кода доступа: что именно нормализация выбрасывает и во что отображает
 * (PROGRESS.md 7.151).
 *
 * ОТКУДА ЭТОТ ФАЙЛ. 08.09.2026 владелец вставил код из мессенджера и получил
 * «код не найден»; тот же код руками, без дефисов, погасился. Разница была в
 * знаках, которых человек не видит: типографское тире вместо дефиса-минуса,
 * мягкий перенос, нулевая ширина. До правки нормализация снимала ровно
 * `[\s-]+` — то есть обычный ASCII-дефис и пробел, и больше ничего.
 *
 * Главное утверждение здесь — не список классов (он ниже, по строке на
 * каждый), а ДВА свойства, без которых правка была бы опасной:
 *
 *   1. нормализация — ТОЖДЕСТВО на любой строке, собранной из алфавита
 *      выпуска. Проверяется по всем 26 знакам, а не примером;
 *   2. она не стала «выбрасывать всё лишнее»: строка с посторонним знаком
 *      обязана остаться посторонней, иначе мусор начал бы попадать в живые
 *      коды. Контроль к этому свойству — сломанный нормализатор, который
 *      делает ровно эту ошибку, и на нём та же проверка ПАДАЕТ.
 */

/** Код той же формы, что выпускает генератор: приставка + 8 знаков алфавита. */
const ISSUED = "AMIGOK7M2QW9F";

describe("нормализация — тождество на алфавите выпуска", () => {
  it("ни один из 26 знаков алфавита не сдвигается", () => {
    const moved = [...ACCESS_CODE_ALPHABET].filter((c) => normalizeAccessCode(c) !== c);
    // Число, а не «пусто»: если алфавит когда-нибудь пополнят кириллицей,
    // здесь будет видно, сколько знаков поехало.
    expect(moved).toEqual([]);
    expect([...ACCESS_CODE_ALPHABET].length).toBe(26);
  });

  it("ни одна кириллическая буква из таблицы омоглифов в алфавит не входит — поэтому отображение не может склеить два выпущенных кода", () => {
    const sources = [..."АВЕКМНОРСТУХ"];
    expect(sources.length).toBe(12);
    const inAlphabet = sources.filter((c) => ACCESS_CODE_ALPHABET.includes(c));
    expect(inAlphabet).toEqual([]);
  });

  it("выпущенный код — неподвижная точка, и он же остаётся собой после печати группами и обратного разбора", () => {
    expect(normalizeAccessCode(ISSUED)).toBe(ISSUED);
    expect(normalizeAccessCode(formatAccessCode(ISSUED, "AMIGO"))).toBe(ISSUED);
  });
});

describe("классы знаков, из-за которых код не совпадал", () => {
  it.each([
    ["U+2013 en dash (тире из мессенджера)", "AMIGO–K7M2–QW9F"],
    ["U+2010 hyphen", "AMIGO‐K7M2‐QW9F"],
    ["U+2011 неразрывный дефис", "AMIGO‑K7M2‑QW9F"],
    ["U+2012 figure dash", "AMIGO‒K7M2‒QW9F"],
    ["U+2014 em dash", "AMIGO—K7M2—QW9F"],
    ["U+2015 horizontal bar", "AMIGO―K7M2―QW9F"],
    ["U+2212 знак минус", "AMIGO−K7M2−QW9F"],
    ["U+00AD мягкий перенос", "AMIGO­K7M2­QW9F"],
    ["U+200B нулевая ширина в хвосте", "AMIGO-K7M2-QW9F​"],
    ["U+200C нулевая ширина", "AMIGO-K7M2‌-QW9F"],
    ["U+200D нулевая ширина", "AMIGO‍-K7M2-QW9F"],
    ["U+FEFF BOM в начале", "﻿AMIGO-K7M2-QW9F"],
    ["U+00A0 неразрывный пробел", "AMIGO K7M2 QW9F"],
    ["кириллическая А", "АMIGO-K7M2-QW9F"],
    ["кириллическая М", "AМIGO-K7M2-QW9F"],
    ["кириллическая О", "AMIGО-K7M2-QW9F"],
    ["кириллические К и Т в теле", "AMIGO-К7M2-QW9F"],
    ["строчная кириллица — тот же список ловит её через верхний регистр", "аmigo-k7m2-qw9f"],
    ["всё сразу: тире, невидимое, кириллица, нижний регистр", "﻿аmigo–k7М2‑qw9f​"],
  ])("%s -> выпущенный код", (_name, raw) => {
    expect(normalizeAccessCode(raw)).toBe(ISSUED);
  });

  it("пустое поле остаётся пустым, а не превращается во что-то вводимое", () => {
    expect(normalizeAccessCode("")).toBe("");
    expect(normalizeAccessCode("   -- ")).toBe("");
    expect(normalizeAccessCode("–­​﻿")).toBe("");
  });

  it("прежние случаи не сломаны: обычный дефис, пробелы, нижний регистр", () => {
    expect(normalizeAccessCode("amigo-k7m2-qw9f")).toBe(ISSUED);
    expect(normalizeAccessCode("  AMIGO K7M2 QW9F  ")).toBe(ISSUED);
    expect(normalizeAccessCode("Amigo-K7m2-Qw9f")).toBe(ISSUED);
  });
});

describe("позитивный контроль: несуществующий код обязан остаться несуществующим", () => {
  /**
   * Сломанный намеренно нормализатор — та самая короткая запись, которой
   * велик соблазн заменить явный список: «выброси всё, что не буква и не
   * цифра». Она чинит вставку из мессенджера ровно так же — и заодно
   * превращает в живой код любую строку с мусором на конце.
   */
  const stripEverythingElse = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const GHOST = "AMIGO-K7M2-QW9F!!!";

  it("строка с посторонним знаком не становится выпущенным кодом", () => {
    expect(normalizeAccessCode(GHOST)).not.toBe(ISSUED);
    // Именно так она и уйдёт в базу: посторонний знак сохранён, совпадения по
    // `where { code }` не будет, и человек получит `unknown`.
    expect(normalizeAccessCode(GHOST)).toBe(`${ISSUED}!!!`);
  });

  it("КОНТРОЛЬ: та же проверка на сломанном нормализаторе падает — значит она не пуста", () => {
    // Если бы проверка выше проходила при любой реализации, её «зелено» не
    // значило бы ничего. Здесь показано, что она различает две реализации.
    expect(stripEverythingElse(GHOST)).toBe(ISSUED);
    expect(stripEverythingElse(GHOST)).not.toBe(normalizeAccessCode(GHOST));
  });

  it("КОНТРОЛЬ на вторую сторону: старая нормализация не справлялась с тире — иначе чинить было бы нечего", () => {
    const before = (raw: string) => raw.trim().toUpperCase().replace(/[\s-]+/g, "");
    expect(before("AMIGO–K7M2–QW9F")).not.toBe(ISSUED);
    expect(normalizeAccessCode("AMIGO–K7M2–QW9F")).toBe(ISSUED);
  });
});

describe("нормализация одна на записи и на чтении", () => {
  /**
   * Разойдись она хоть в одном знаке — выпущенная партия перестала бы
   * погашаться молча. Поэтому здесь не «по договорённости», а чтение
   * исходников всех четырёх мест, которые с кодом работают.
   */
  const CALLERS = [
    "src/lib/access-code.ts",
    "src/app/api/test/access-code/route.ts",
    "scripts/generate-access-codes.ts",
    "scripts/revoke-access-codes.ts",
  ];

  it.each(CALLERS)("%s берёт нормализацию из общего модуля и своей не заводит", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf-8");
    expect(source, `${file} обязан импортировать общую нормализацию`).toMatch(
      /import\s*\{[^}]*normalizeAccessCode[^}]*\}\s*from\s*["'][^"']*access-code-format["']/
    );
    expect(source, `${file} не должен объявлять свою normalizeAccessCode`).not.toMatch(
      /function\s+normalizeAccessCode\s*\(/
    );
  });

  it("объявление ровно одно на весь репозиторий", () => {
    const home = readFileSync(join(process.cwd(), "src/lib/access-code-format.ts"), "utf-8");
    expect(home.match(/export function normalizeAccessCode\s*\(/g)?.length).toBe(1);
  });
});

/**
 * ДОЛГ 103 — ЧТО ИМЕННО НОРМАЛИЗАЦИЯ УБРАЛА ИЗ СТРОКИ.
 *
 * Сторож `check:redeem-normalization` читает код. Здесь — поведение
 * признака на настоящих строках, включая ту, которой долг и заведён:
 * код, вставленный из мессенджера с типографским тире.
 */
describe("долг 103: признак «строка изменилась нормализацией»", () => {
  const CODE = "AMIGO-JY9D-TAVG";

  it("код, набранный ровно как напечатан, даёт только класс тире", () => {
    const r = describeNormalization(CODE);
    expect(r.changed).toBe(true);
    expect(r.classes).toEqual(["dash"]);
    expect(r.counts.dash).toBe(2);
    expect(normalizationTag(r)).toBe("dash");
  });

  it("код без дефисов не меняется вовсе — признак говорит none", () => {
    const r = describeNormalization("AMIGOJY9DTAVG");
    expect(r.changed).toBe(false);
    expect(normalizationTag(r)).toBe("none");
  });

  it("вставка из мессенджера: типографское тире и мягкий перенос — РАЗНЫЕ классы", () => {
    // Ровно та строка, на которой долг 103 и стоит: отказ от невидимого
    // знака обязан быть отличим от отказа от опечатки.
    const r = describeNormalization("AMIGO–JY9D­TAVG");
    expect(r.classes).toEqual(["dash", "invisible"]);
    expect(r.counts.dash).toBe(1);
    expect(r.counts.invisible).toBe(1);
    expect(normalizationTag(r)).toBe("dash+invisible");
  });

  it("русская раскладка: омоглифы считаются своим классом", () => {
    const r = describeNormalization("АМIGО-JY9D-TAVG");
    expect(r.counts.homoglyph).toBe(3);
    expect(normalizationTag(r)).toBe("dash+homoglyph");
  });

  it("нижний регистр и пробелы вместо дефисов — два класса, оба названы", () => {
    const r = describeNormalization("amigo jy9d tavg");
    expect(r.classes).toEqual(["case", "space"]);
    expect(r.counts.space).toBe(2);
  });

  it("ПЯТЫЙ КЛАСС: знак, переживший нормализацию и не буква и не цифра", () => {
    // До 19.09.2026 такой отказ приходил как `unknown` неотличимо от
    // опечатки — это и есть «пятый класс, если он есть» из строки долга.
    const r = describeNormalization(`${CODE}!`);
    expect(r.counts.other).toBe(1);
    expect(normalizationTag(r)).toBe("dash+other");
  });

  it("ГРАНИЦА КЛАССА `other` — латиница и цифры, а НЕ алфавит выпуска", () => {
    // Приставка партии печатается словом, и в слове стоят `I` и `O` —
    // буквы, которых в алфавите выпуска нет по замыслу. Считай мы «нет в
    // алфавите выпуска», каждый законный код сообщал бы о двух
    // посторонних знаках, и признак умер бы в первый же день.
    expect(describeNormalization("AMIGOJY9DTAVG").counts.other).toBe(0);
  });

  it("КОНТРОЛЬ: признак не врёт ни на одном знаке алфавита выпуска", () => {
    for (const ch of ACCESS_CODE_ALPHABET) {
      expect(describeNormalization(ch).changed, ch).toBe(false);
    }
  });

  it("КОНТРОЛЬ: имена классов — закрытый список, и он весь под проверкой", () => {
    expect([...NORMALIZATION_CLASSES]).toEqual(["case", "space", "dash", "invisible", "homoglyph", "other"]);
  });

  it("ЗНАЧЕНИЯ КОДА В ПРИЗНАКЕ НЕТ: тег собран только из имён классов", () => {
    const tag = normalizationTag(describeNormalization("amigo–JY9D TAVG!"));
    for (const ch of "AMIGOJY9DTAVG") expect(tag.includes(ch)).toBe(false);
    for (const part of tag.split("+")) {
      expect([...NORMALIZATION_CLASSES] as string[]).toContain(part);
    }
  });
});
