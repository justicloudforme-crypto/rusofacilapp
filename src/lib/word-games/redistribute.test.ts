import { describe, it, expect } from "vitest";
import { boardSizeMismatches, dealWords, dealWordsToSizes, planLayout, sizeCombinations } from "./redistribute";
import { BOARD_SIZES, corridorFor, judge, LONGEST_OVER_SIDE_LIMIT } from "./quality";
import { DENSITY_SPLITS, densityTailCount, isDensityOwnedRung, findDensitySplit } from "./density-rungs";
import { occupancyStats } from "./word-search-audit";
import { isFreeWordGamePuzzle } from "./free-tier";
import { topicForPuzzle } from "./topics";

const WORDS = [
  "жаропонижающее","обескураженный","госпитализация","самоуправление","плиссированный",
  "определённость","самозанятость","решительность","самопринятие","галлюцинация",
  "оптимизация","психоанализ","калорийный","ипохондрия","сублимация",
  "рвануться","метеорит","подделка","принятие","плацебо",
  "зачатие","ветеран","пульсар","циклон","сюжет","склад","кураж",
].map((word) => ({ word, clue: `clue for ${word}` }));

describe("splitting an over-packed puzzle", () => {
  it("deals every word exactly once, and balances the long ones", () => {
    const buckets = dealWords(WORDS, 3);
    expect(buckets.flat().map((w) => w.word).sort()).toEqual(WORDS.map((w) => w.word).sort());
    const letters = buckets.map((b) => b.reduce((n, w) => n + w.word.length, 0));
    expect(Math.max(...letters) - Math.min(...letters)).toBeLessThanOrEqual(14);
  });

  it("keeps every word and lands every part inside the corridor", () => {
    const result = planLayout(WORDS, "test-seed");
    expect(result).not.toBeNull();
    expect([...result!.wordsOut].sort()).toEqual(WORDS.map((w) => w.word).sort());
    expect(result!.inCorridor).toBe(true);
    const { floor, ceiling } = corridorFor(false);
    for (const part of result!.parts) {
      expect(part.occupancy).toBeLessThanOrEqual(ceiling);
      expect(part.occupancy).toBeGreaterThanOrEqual(floor);
      expect(part.maxOverlap).toBeLessThanOrEqual(3);
      // Every stored placement in a part really spells its word.
      expect(occupancyStats(part.grid.grid, part.words).placementMismatches).toEqual([]);
    }
  });

  it("is deterministic — the same seed gives the same grids", () => {
    const a = planLayout(WORDS, "same-seed")!;
    const b = planLayout(WORDS, "same-seed")!;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("refuses rather than dropping a word it cannot place", () => {
    // A grid this small cannot hold these words; the planner must return
    // null, not a part with words missing.
    expect(planLayout(WORDS, "tiny", { sizes: [8] })).toBeNull();
  });

  it("раздаёт слова по ПЛОЩАДИ сеток, а не поровну", () => {
    const buckets = dealWordsToSizes(WORDS, [10, 18])!;
    const letters = buckets.map((b) => b.reduce((n, w) => n + w.word.length, 0));
    // 100 клеток против 324 — доля букв обязана идти в той же пропорции,
    // иначе меньшая сетка гарантированно перегружена.
    expect(letters[1] / letters[0]).toBeGreaterThan(2);
    expect(buckets.flat()).toHaveLength(WORDS.length);
  });

  it("не кладёт длинное слово в маленькую сетку, как бы та ни была пуста", () => {
    const buckets = dealWordsToSizes(WORDS, [10, 18])!;
    for (const w of buckets[0]) expect(w.word.length / 10).toBeLessThanOrEqual(LONGEST_OVER_SIDE_LIMIT);
  });

  it("наборы сторон перебираются от ровных к разнобойным", () => {
    const combos = sizeCombinations([8, 10, 12], 2);
    expect(combos).toHaveLength(6);
    // Сначала ровные, по возрастанию площади; разнобойные — после.
    expect(combos.slice(0, 3)).toEqual([[8, 8], [10, 10], [12, 12]]);
    expect(combos.at(-1)).toEqual([8, 12]);
    // Порядок фиксирован — это часть детерминированности плана.
    expect(sizeCombinations([8, 10, 12], 2)).toEqual(combos);
  });
});

describe("the redistribution manifest", () => {
  it("names only paid, unthemed rungs — in every round", () => {
    // Числом проверяется только ПРИМЕНЁННОЕ, то есть то, что уже лежит
    // в проде: двадцать рунгов кругов 1-2 (PROGRESS 7.83), сорок рунгов
    // коридора (7.86), сто двадцать четыре рунга порции 1 (7.101,
    // записана 03.09) и вся порция 2 целиком — двадцать пилота (7.106)
    // плюс оставшийся четыреста один (7.107), оба записаны 04.09, —
    // шестьсот пять. Длина всего манифеста НЕ фиксируется литералом
    // намеренно: новые порции приезжают правкой ДАННЫХ, и тест, который
    // надо править вместе с ними, ловил бы не дефект, а сам факт
    // правки. А вот применённое обязано совпадать с продом: расхождение
    // здесь однажды уже стоило бы 38 удалённых строк (PROGRESS 7.101),
    // и оно же три дня держало порцию 1 непомеченной, хотя прод её уже
    // носил (7.105).
    expect(DENSITY_SPLITS.filter((s) => s.applied)).toHaveLength(605);
    expect(DENSITY_SPLITS.length).toBeGreaterThanOrEqual(605);
    // Не `sequence > 10`: C1/10 платный (у C1 бесплатных рунгов нет), и
    // повтор правила своими словами именно на нём и ошибался.
    for (const s of DENSITY_SPLITS) {
      expect(isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: s.level, sequence: s.sequence })).toBe(false);
      expect(topicForPuzzle("WORD_SEARCH", s.level, s.sequence)).toBeNull();
    }
  });

  it("gives every leftover part its own tail sequence, with no collisions", () => {
    const all = DENSITY_SPLITS.flatMap((s) => s.tailSequences.map((n) => `${s.level}/${n}`));
    expect(new Set(all).size).toBe(all.length);
    for (const s of DENSITY_SPLITS) expect(s.tailSequences).toHaveLength(s.parts - 1);
    // A tail sequence must never collide with a split source either.
    const sources = new Set(DENSITY_SPLITS.map((s) => `${s.level}/${s.sequence}`));
    for (const t of all) expect(sources.has(t)).toBe(false);
  });

  it("counts the tail per level the way the generator's cleanup needs", () => {
    // Считается ИЗ манифеста, а не переписывается литералом: чистка
    // генератора удаляет всё, что старше расчётного максимума лестницы, и
    // ей нужно ровно это число, каким бы ни был очередной круг.
    for (const level of ["A1", "A2", "B1", "B2", "C1"]) {
      const expected = DENSITY_SPLITS.filter((s) => s.level === level).reduce(
        (n, s) => n + s.tailSequences.length,
        0,
      );
      expect(densityTailCount(level)).toBe(expected);
    }
    // Круги 1-2 дописали в хвост B2 десять строк, B1 одну, C1 девять;
    // сорок рунгов коридора (7.86) — ещё B2 двенадцать, B1 восемь,
    // C1 восемнадцать. Итого 58 хвостов на 60 применённых записей: два
    // рунга починились одной сменой размера доски и не дали ни строки.
    const applied = DENSITY_SPLITS.filter((s) => s.applied);
    expect(applied.filter((s) => s.level === "B2").flatMap((s) => s.tailSequences)).toHaveLength(22);
    expect(applied.filter((s) => s.level === "B1").flatMap((s) => s.tailSequences)).toHaveLength(9);
    expect(applied.filter((s) => s.level === "C1").flatMap((s) => s.tailSequences)).toHaveLength(27);
    expect(applied.reduce((n, s) => n + s.tailSequences.length, 0)).toBe(58);
    expect(densityTailCount("A1")).toBe(0);
  });

  it("у каждой записи сторон ровно столько же, сколько частей, и все из шести", () => {
    for (const s of DENSITY_SPLITS) {
      expect(s.sizes).toHaveLength(s.parts);
      for (const size of s.sizes) expect(BOARD_SIZES).toContain(size);
    }
  });

  it("claims ownership of both a split source and its tail, and of nothing else", () => {
    expect(isDensityOwnedRung("WORD_SEARCH", "B2", 44)).toBe(true);
    expect(isDensityOwnedRung("WORD_SEARCH", "B2", 328)).toBe(true);
    expect(isDensityOwnedRung("WORD_SEARCH", "B2", 45)).toBe(false);
    // Same numbers on the other game type must not be claimed.
    expect(isDensityOwnedRung("CROSSWORD", "B2", 44)).toBe(false);
    expect(findDensitySplit("C1", 114)?.parts).toBe(2);
    expect(findDensitySplit("C1", 114)?.tailSequences).toEqual([241]);
    expect(findDensitySplit("C1", 139)).toBeUndefined();
  });
});

describe("planLayout — размер доски выбирается, а не наследуется", () => {
  const shortWords = ["кот", "дом", "лес", "сад", "мир", "сыр", "рис", "лук"].map((word) => ({
    word,
    clue: `clue for ${word}`,
  }));

  it("короткому списку даёт МАЛЕНЬКУЮ доску, а не 16×16", () => {
    const plan = planLayout(shortWords, "short-list")!;
    expect(plan).not.toBeNull();
    // 8 слов по 3 буквы — это 24 буквы; на 16×16 (256 клеток) занятость
    // была бы ниже 10%. Восьмёрка — самая маленькая доска банка, и даже на
    // ней такой список в коридор не попадает: 24/64 = 37,5%. Правильный
    // ответ здесь — «наименьшая доска и честное inCorridor: false», а не
    // «16×16 и молчание».
    expect(plan.parts).toHaveLength(1);
    expect(plan.parts[0].size).toBe(8);
    expect(plan.inCorridor).toBe(false);
  });

  it("список, который в коридор попадает, кладётся в коридор и на маленькой доске", () => {
    // Девять слов по 5-6 букв: на 16×16 это 20% занятости, на 10×10 — как
    // раз коридор.
    const words = ["сахар", "чайник", "молоко", "кухня", "ножницы", "полка", "сумка", "лампа", "ковёр"].map(
      (word) => ({ word, clue: `clue for ${word}` }),
    );
    const plan = planLayout(words, "small-list")!;
    expect(plan.inCorridor).toBe(true);
    expect(plan.parts[0].size).toBeLessThanOrEqual(12);
    const { floor, ceiling } = corridorFor(false);
    expect(plan.parts[0].occupancy).toBeGreaterThanOrEqual(floor);
    expect(plan.parts[0].occupancy).toBeLessThanOrEqual(ceiling);
  });

  it("длинному слову не даёт доску, на которой оно ляжет через всю сторону", () => {
    const plan = planLayout(WORDS, "long-words")!;
    for (const part of plan.parts) {
      const longest = Math.max(...part.words.map((w) => w.word.length));
      expect(longest / part.size).toBeLessThanOrEqual(LONGEST_OVER_SIDE_LIMIT);
    }
    // 14 букв ⇒ сторона 18: 14/16 = 0.875 выше потолка.
    expect(Math.max(...plan.parts.map((p) => p.size))).toBe(18);
  });

  it("выбирает размер из шести разрешённых и никакой другой", () => {
    for (const seed of ["a", "b", "c", "d"]) {
      const plan = planLayout(WORDS.slice(0, 12), seed)!;
      for (const part of plan.parts) expect(BOARD_SIZES).toContain(part.size);
    }
  });

  it("сначала пробует обойтись без деления — одна сетка дешевле новой строки", () => {
    // Двенадцать слов средней длины: в коридор попадают и одной сеткой, и
    // двумя. Взята обязана быть одна — новая часть стоит новой строки в
    // базе и нового URL, больший размер доски не стоит ничего.
    const words = [
      "молоко", "кухня", "полка", "сумка", "лампа", "ковёр",
      "чайник", "сахар", "ножницы", "тарелка", "кофейник", "занавеска",
    ].map((word) => ({ word, clue: `clue for ${word}` }));
    const plan = planLayout(words, "one-part")!;
    expect(plan.parts).toHaveLength(1);
    expect(plan.inCorridor).toBe(true);
  });

  it("список из одних длинных слов в коридор не кладётся — и это говорится вслух", () => {
    // Десять слов по 13–14 букв: сторона обязана быть 18 (14/16 выше
    // потолка), а десять таких слов на 324 клетках дают 41% — ниже пола.
    // Делить дальше только хуже. Честный ответ — лучший достижимый план и
    // inCorridor: false, а не молчаливая запись.
    const plan = planLayout(WORDS.slice(0, 10), "long-only")!;
    expect(plan.parts).toHaveLength(1);
    expect(plan.parts[0].size).toBe(18);
    expect(plan.inCorridor).toBe(false);
  });

  it("части одного рунга могут лежать на РАЗНЫХ сторонах — это разные строки", () => {
    // 27 слов с длиннейшим в 14 букв: одной сеткой это 81% (перегруз), а
    // двумя одинаковыми — либо снова перегруз, либо разрежённость. Ответ,
    // который перебор обязан найти, — две РАЗНЫЕ стороны.
    const plan = planLayout(WORDS, "mixed")!;
    expect(plan.inCorridor).toBe(true);
    expect(plan.parts).toHaveLength(2);
    expect(new Set(plan.parts.map((p) => p.size)).size).toBe(2);
    for (const part of plan.parts) expect(BOARD_SIZES).toContain(part.size);
  });

  it("★ судится по своему коридору", () => {
    const straight = corridorFor(false);
    const curved = corridorFor(true);
    expect(curved.ceiling).toBeLessThan(straight.ceiling);
    expect(judge({ occupancy: 0.6, longestOverMinSide: 0.5, curved: true }).zone).toBe("перегружен");
    expect(judge({ occupancy: 0.6, longestOverMinSide: 0.5, curved: false }).zone).toBe("коридор");
  });

  it("детерминирован: два прогона подряд дают побайтово одно и то же", () => {
    const a = planLayout(WORDS, "same-seed")!;
    const b = planLayout(WORDS, "same-seed")!;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("отказывается, а не роняет слово, если уложить не удалось нигде", () => {
    // Единственная разрешённая сторона — 8, а слова по 14 букв: на такой
    // доске они не помещаются ни при каком делении.
    expect(planLayout(WORDS, "impossible", { sizes: [8] })).toBeNull();
  });
});

describe("boardSizeMismatches", () => {
  const grid = (rows: number, cols: number) => ({
    grid: { grid: Array.from({ length: rows }, () => Array.from({ length: cols }, () => "а")) },
  });

  it("молчит, когда все части лежат на выбранной стороне", () => {
    expect(boardSizeMismatches(18, [grid(18, 18), grid(18, 18)])).toEqual([]);
  });

  it("ловит часть не того размера, что выбранная сторона", () => {
    const out = boardSizeMismatches(18, [grid(18, 18), grid(16, 16)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("часть 2");
    expect(out[0]).toContain("16×16");
  });

  it("ловит подмену в ПЕРВОЙ части — она пишется в существующую строку", () => {
    const out = boardSizeMismatches(16, [grid(14, 14), grid(16, 16)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("часть 1");
  });

  it("ловит сторону вне шести разрешённых", () => {
    // 20×20 не помещается на телефон, и никакой пазл банка так не лежит.
    const out = boardSizeMismatches(20, [grid(20, 20)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("не из разрешённых");
  });

  it("ловит неквадратную часть", () => {
    expect(boardSizeMismatches(16, [grid(16, 14)])).toHaveLength(1);
  });
});
