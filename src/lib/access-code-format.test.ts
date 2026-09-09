import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCESS_CODE_ALPHABET, formatAccessCode, normalizeAccessCode } from "./access-code-format";

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
