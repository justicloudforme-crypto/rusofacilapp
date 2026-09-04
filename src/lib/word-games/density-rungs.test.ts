// Invariants the density manifest has to satisfy BEFORE anything runs it
// against production. Everything here is checkable without a database:
// the manifest is a promise about a final state, and a promise that
// contradicts itself should fail in CI, not in a prod write.
import { describe, expect, it } from "vitest";
import {
  DENSITY_SPLITS,
  densityLevels,
  densityTailCount,
  densityTails,
  findDensitySplit,
  isDensityOwnedRung,
  ladderGaps,
  PORTION_5_SOURCES,
} from "./density-rungs";
import { FREE_TRIAL_LIMITS } from "@/lib/entitlement";
import { EXTRA_FREE_WORD_GAME_RUNGS, isFreeWordGamePuzzle } from "./free-tier";
import { BOARD_SIZES } from "./quality";
import { topicForPuzzle } from "./topics";

describe("density-rungs manifest", () => {
  it("promises exactly as many tail rungs as it promises parts", () => {
    for (const s of DENSITY_SPLITS) {
      expect(s.tailSequences.length, `${s.level}/${s.sequence}`).toBe(s.parts - 1);
    }
  });

  // Через isFreeWordGamePuzzle, а не через `sequence > лимит`. Бесплатность
  // — это `level !== "C1" && sequence <= 10`, и сравнение по одному номеру
  // объявляло бы бесплатным C1/10, который бесплатным не был никогда: у C1
  // бесплатных рунгов нет вовсе. Тест, повторяющий правило своими словами,
  // сторожит свою копию правила, а не правило.
  //
  // ХВОСТ и набор URL в sitemap.xml. Набор выведен из free-tier.ts, а не
  // из базы, поэтому новая строка добавляет файлу страницу ровно в двух
  // случаях: её номер попал в бесплатную десятку — этого не делает и не
  // имеет права сделать ни одна порция, — либо координата названа
  // поимённо в EXTRA_FREE_WORD_GAME_RUNGS.
  //
  // 05.09.2026 (7.110) названы три: хвосты B1/668, B1/669 и B2/405, куда
  // порция 5 унесла половину слов трёх бесплатных тематических страниц.
  // Утверждение от этого не ослабло, а разошлось надвое: неназванный
  // хвост бесплатным быть не может по-прежнему, а названный обязан быть
  // настоящим хвостом манифеста и стоять ЗА десяткой — то есть имя не
  // прикрывает попадание в неё.
  const FREED_TAILS = new Set(
    EXTRA_FREE_WORD_GAME_RUNGS.map((r) => `${r.type}/${r.level}/${r.sequence}`),
  );

  it("never puts a tail on a free rung, except the ones freed by name", () => {
    for (const s of DENSITY_SPLITS) {
      for (const seq of s.tailSequences) {
        if (FREED_TAILS.has(`WORD_SEARCH/${s.level}/${seq}`)) continue;
        expect(
          isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: s.level, sequence: seq }),
          `${s.level}/${seq} is a free rung`,
        ).toBe(false);
      }
    }
  });

  it("names only real tails, only WORD_SEARCH, and only past the free ten", () => {
    const tails = new Set(
      DENSITY_SPLITS.flatMap((s) => s.tailSequences.map((seq) => `WORD_SEARCH/${s.level}/${seq}`)),
    );
    expect(EXTRA_FREE_WORD_GAME_RUNGS).toHaveLength(3);
    for (const r of EXTRA_FREE_WORD_GAME_RUNGS) {
      const key = `${r.type}/${r.level}/${r.sequence}`;
      // Сверка в обе стороны: имя, которого нет среди хвостов манифеста,
      // открывало бы страницу, за которую манифест не отвечает.
      expect(tails.has(key), `${key} — не хвост манифеста`).toBe(true);
      expect(r.type).toBe("WORD_SEARCH");
      expect(r.sequence, key).toBeGreaterThan(FREE_TRIAL_LIMITS.wordGamePuzzlesPerLevel);
      // И у названного хвоста темы нет — тематический заголовок на
      // странице без темы был бы обещанием, которого она не держит.
      expect(topicForPuzzle("WORD_SEARCH", r.level, r.sequence), key).toBeNull();
    }
    // Ровно те три, о которых 7.110, и ни одной больше.
    expect([...FREED_TAILS].sort()).toEqual([
      "WORD_SEARCH/B1/668",
      "WORD_SEARCH/B1/669",
      "WORD_SEARCH/B2/405",
    ]);
  });

  it("control: a tail landing in the free ten is still caught, list or no list", () => {
    // Позитивный контроль в обе стороны к двум тестам выше.
    //
    // 1. Хвост, попавший в бесплатную десятку, правило признаёт
    //    бесплатным, а список его не покрывает — значит цикл выше на нём
    //    и упал бы. Без этого «кроме названных» проходило бы на функции,
    //    которая бесплатных вообще не видит.
    const planted = { type: "WORD_SEARCH", level: "B2", sequence: 9 };
    expect(isFreeWordGamePuzzle(planted)).toBe(true);
    expect(FREED_TAILS.has("WORD_SEARCH/B2/9")).toBe(false);
    // 2. А названный хвост правило ДЕЙСТВИТЕЛЬНО пускает — иначе
    //    исключение было бы мёртвым, и тесты выше зеленели бы впустую.
    expect(isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: "B1", sequence: 668 })).toBe(true);
    // 3. И соседний по номеру хвост, которого в списке нет, остаётся
    //    платным: список не расползается на диапазон.
    expect(isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: "B1", sequence: 667 })).toBe(false);
    expect(isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: "B2", sequence: 404 })).toBe(false);
  });

  // ИСТОЧНИК бесплатным быть может — но только в порции 5, и только тем,
  // что названы поимённо. Это не ослабление прежнего безусловного
  // запрета, а его замена на более узкое утверждение: прежнее «ни один»
  // проверялось одной строкой и после порции 5 стало бы ложным, а
  // «кроме бесплатных» не проверяло бы ничего. Список сверяется в ОБЕ
  // стороны, поэтому ни лишний бесплатный рунг в манифесте, ни
  // выпавшая из манифеста запись списка мимо теста не пройдут.
  it("allows a free source only for the 26 rungs portion 5 names", () => {
    const freeSources = DENSITY_SPLITS
      .filter((s) => isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: s.level, sequence: s.sequence }))
      .map((s) => `${s.level}/${s.sequence}`);
    expect(PORTION_5_SOURCES).toHaveLength(26);
    expect([...freeSources].sort()).toEqual([...PORTION_5_SOURCES].sort());
    // И каждый ключ списка обязан быть в манифесте — иначе список
    // разрешал бы то, чего нет, и молча пережил бы удаление записи.
    for (const key of PORTION_5_SOURCES) {
      const [level, seq] = key.split("/");
      expect(findDensitySplit(level, Number(seq)), key).toBeDefined();
      expect(isFreeWordGamePuzzle({ type: "WORD_SEARCH", level, sequence: Number(seq) }), key).toBe(true);
    }
  });

  // Та же проверка с другой стороны: правило не должно молчать, если рунг
  // ДЕЙСТВИТЕЛЬНО бесплатный. Без этого предыдущий тест зелен и на пустом
  // манифесте, и на сломанной isFreeWordGamePuzzle.
  it("would catch a genuinely free rung", () => {
    expect(isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: "B2", sequence: 10 })).toBe(true);
    expect(isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: "C1", sequence: 10 })).toBe(false);
    expect(FREE_TRIAL_LIMITS.wordGamePuzzlesPerLevel).toBe(10);
  });

  it("names no rung twice — neither as a source nor as a tail", () => {
    const seen = new Set<string>();
    for (const s of DENSITY_SPLITS) {
      for (const seq of [s.sequence, ...s.tailSequences]) {
        const key = `${s.level}/${seq}`;
        expect(seen.has(key), `${key} appears twice in the manifest`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("keeps every level's tail block contiguous with the ladder it extends", () => {
    // The manifest cannot know how long a level's ladder is — that is a
    // database fact — but it CAN be checked for a gap inside its own tail
    // block: 328,329,331 is wrong no matter what the ladder ends at.
    for (const level of densityLevels()) {
      const tails = densityTails(level);
      const expected = Array.from({ length: tails.length }, (_, i) => tails[0] + i);
      expect(tails, `${level} tail block has a hole`).toEqual(expected);
    }
  });

  it("counts tails per level the way the generator's ladder maths does", () => {
    for (const level of densityLevels()) {
      expect(densityTailCount(level)).toBe(densityTails(level).length);
    }
    // Было 0 до 04.09.2026: до порции 3 ни одна запись A1 не делилась на
    // части. Порция 3 дала уровню два хвоста — 197 и 198.
    expect(densityTailCount("A1")).toBe(2);
  });

  // Добавлено 03.09.2026 (PROGRESS 7.101). Размер доски перестал быть
  // наследством и стал ЧАСТЬЮ манифеста (7.85), а сторож на него так и
  // не завели: `sizes` мог разойтись с `parts` или назвать сторону,
  // которой банк не держит, и поймалось бы это только у прода.
  it("gives every part a side, and only a side the bank actually has", () => {
    for (const s of DENSITY_SPLITS) {
      expect(s.sizes, `${s.level}/${s.sequence}`).toHaveLength(s.parts);
      for (const size of s.sizes) {
        expect(BOARD_SIZES, `${s.level}/${s.sequence}`).toContain(size);
      }
    }
  });

  // Смена размера доски — часть, не создающая строки (7.85). Раньше
  // такой записи в манифесте не бывало, и `parts: 1` с непустым хвостом
  // ничем не отлавливался.
  it("asks for no tail when one board is enough", () => {
    const sizeOnly = DENSITY_SPLITS.filter((s) => s.parts === 1);
    expect(sizeOnly.length).toBeGreaterThan(0);
    for (const s of sizeOnly) expect(s.tailSequences, `${s.level}/${s.sequence}`).toEqual([]);
  });

  // Сторож против ровно того расхождения, которое уже случилось:
  // код-PR захода 7.85/7.86 не был смёржен, `DENSITY_SPLITS` в main
  // описывал 20 записей при 78 строках, тронутых в проде, и первый
  // полный прогон генератора удалил бы 38 из них как «устаревшие»
  // (PROGRESS 7.101). Числа тут — про ПРИМЕНЁННОЕ, то есть про то, что
  // прод носит прямо сейчас; неприменённые порции сюда не входят
  // намеренно.
  it("describes every row already written to production", () => {
    const applied = DENSITY_SPLITS.filter((s) => s.applied);
    expect(applied).toHaveLength(847);
    expect(applied.reduce((n, s) => n + s.tailSequences.length, 0)).toBe(277);
    expect(applied.filter((s) => s.level === "A1").flatMap((s) => s.tailSequences)).toHaveLength(2);
    expect(applied.filter((s) => s.level === "A2").flatMap((s) => s.tailSequences)).toHaveLength(23);
    expect(applied.filter((s) => s.level === "B1").flatMap((s) => s.tailSequences)).toHaveLength(107);
    expect(applied.filter((s) => s.level === "B2").flatMap((s) => s.tailSequences)).toHaveLength(78);
    expect(applied.filter((s) => s.level === "C1").flatMap((s) => s.tailSequences)).toHaveLength(67);
  });

  // Порция 1 (124 рунга, записана 03.09) хвостов не создаёт вовсе:
  // parts: 1 — это UPDATE существующей строки и ничего больше. Число
  // хвостов выше поэтому осталось 58, хотя применённых записей стало
  // 184, — и именно это здесь и проверяется, чтобы «184 против 58» не
  // выглядело опечаткой в следующем заходе.
  it("counts the 03.09 portion as applied without adding a single tail", () => {
    const p1 = DENSITY_SPLITS.filter((s) => s.applied === "2026-09-03");
    expect(p1).toHaveLength(124);
    expect(p1.every((s) => s.parts === 1 && s.tailSequences.length === 0)).toBe(true);
    expect(p1.filter((s) => s.sizes.includes(18))).toHaveLength(0);
    expect(Object.entries(
      p1.reduce<Record<string, number>>((a, s) => ({ ...a, [s.level]: (a[s.level] ?? 0) + 1 }), {}),
    ).sort()).toEqual([["A1", 39], ["A2", 51], ["B1", 24], ["B2", 6], ["C1", 4]]);
  });

  // Записи 04.09.2026 — это ТРИ порции сразу: 2 (421 рунг, одна доска
  // 18×18 и ноль новых строк), 3 (34 рунга, деление надвое, вторая
  // сторона не больше 16) и 4 (182 рунга, деление надвое со второй
  // стороной 18). Утверждение адресуется группе по ДАТЕ, а не «всем
  // неприменённым»: неприменённых не осталось вовсе, и версия «через
  // !applied» проходила бы на пустом множестве — тот самый ноль без
  // контроля. Непустота группы проверяется отдельной строкой ПЕРЕД
  // всеми `every`: без неё они зелены на пустом массиве.
  //
  // Внутри группы порции разводятся по числу частей — по той самой
  // величине, которая и есть цена порции (parts: 1 — UPDATE строки и
  // ничего больше; parts: 2 — новая строка и два новых URL). Строка
  // «третьего вида не бывает» стоит здесь именно затем, чтобы запись с
  // parts: 3 не провалилась мимо обеих проверок молча.
  it("splits the 04.09 day into portion 2 and portions 3-4 by what each costs", () => {
    const day = DENSITY_SPLITS.filter((s) => s.applied === "2026-09-04");
    expect(day.length).toBeGreaterThan(0);
    expect(day).toHaveLength(637);
    const portion2 = day.filter((s) => s.parts === 1);
    const portions34 = day.filter((s) => s.parts === 2);
    expect(portion2.length + portions34.length).toBe(day.length);

    // Порция 2: ноль новых строк, одна доска 18×18 на запись.
    expect(portion2).toHaveLength(421);
    expect(portion2.every((s) => s.tailSequences.length === 0)).toBe(true);
    expect(portion2.every((s) => s.sizes.length === 1 && s.sizes[0] === 18)).toBe(true);
    expect(new Set(portion2.map((s) => s.level))).toEqual(new Set(["A1", "A2", "B1", "B2", "C1"]));
    // Разбивка по уровням — перемер против живого прода 04.09 (7.107):
    // пилот A1 3 / A2 3 / B1 6 / B2 5 / C1 3 плюс остаток
    // A1 20 / A2 86 / B1 140 / B2 95 / C1 60.
    expect(Object.entries(
      portion2.reduce<Record<string, number>>((a, s) => ({ ...a, [s.level]: (a[s.level] ?? 0) + 1 }), {}),
    ).sort()).toEqual([["A1", 23], ["A2", 89], ["B1", 146], ["B2", 100], ["C1", 63]]);

    // Порции 3 и 4: ровно один хвост на запись — это и есть новая строка
    // и два новых URL, по одному на локаль.
    expect(portions34).toHaveLength(216);
    expect(portions34.every((s) => s.tailSequences.length === 1)).toBe(true);
    expect(portions34.every((s) => s.sizes.length === 2)).toBe(true);
    // Порция 3 — потолок стороны 16, порция 4 — вторая часть на 18.
    // Разводятся именно так, а не по дате: дата у них одна.
    const p3 = portions34.filter((s) => Math.max(...s.sizes) <= 16);
    const p4 = portions34.filter((s) => s.sizes[1] === 18);
    expect(p3.length + p4.length).toBe(portions34.length);
    expect(p3).toHaveLength(34);
    expect(p4).toHaveLength(182);
    // Перемер против живого прода 04.09 (7.108).
    expect(Object.entries(
      p3.reduce<Record<string, number>>((a, s) => ({ ...a, [s.level]: (a[s.level] ?? 0) + 1 }), {}),
    ).sort()).toEqual([["A1", 2], ["A2", 4], ["B1", 22], ["B2", 3], ["C1", 3]]);
    expect(Object.entries(
      p4.reduce<Record<string, number>>((a, s) => ({ ...a, [s.level]: (a[s.level] ?? 0) + 1 }), {}),
    ).sort()).toEqual([["A2", 19], ["B1", 74], ["B2", 52], ["C1", 37]]);
  });

  // Весь манифест применён — значит прогон разгрузки без --only= сейчас
  // не выбрал бы ни одного рунга. С порцией 5 (05.09.2026) коридор
  // закрыт целиком: пятой очереди больше нет.
  //
  // Само по себе «неприменённых 0» — это ноль на пустом множестве, и
  // доказывать им нечего. Поэтому рядом стоит группа по ДАТЕ 05.09,
  // непустота которой проверяется ПЕРЕД любым `every`: если запись
  // порции 5 потеряет `applied`, упадёт первая строка; если потеряется
  // вся порция, упадёт вторая.
  it("has nothing pending — the corridor is closed", () => {
    expect(DENSITY_SPLITS.filter((s) => !s.applied)).toHaveLength(0);
    const portion5 = DENSITY_SPLITS.filter((s) => s.applied === "2026-09-05");
    expect(portion5.length).toBeGreaterThan(0);
    expect(portion5).toHaveLength(26);
  });

  // Порция 5 — рунги 1-10 не-C1 (7.109). Разводится по цене ровно так
  // же, как группа 04.09: parts: 1 — смена размера доски и ничего
  // больше, parts: 2 — новая строка и два новых URL. Строка «третьего
  // вида не бывает» стоит здесь по той же причине, что и там: запись с
  // parts: 3 иначе провалилась бы мимо обеих проверок молча.
  it("splits the 05.09 portion into a resize half and a split half", () => {
    const day = DENSITY_SPLITS.filter((s) => s.applied === "2026-09-05");
    expect(day.length).toBeGreaterThan(0);
    expect(day).toHaveLength(26);
    const resize = day.filter((s) => s.parts === 1);
    const split = day.filter((s) => s.parts === 2);
    expect(resize.length + split.length).toBe(day.length);
    expect(resize).toHaveLength(23);
    expect(resize.every((s) => s.tailSequences.length === 0)).toBe(true);
    expect(split).toHaveLength(3);
    expect(split.every((s) => s.tailSequences.length === 1)).toBe(true);
    expect(split.map((s) => `${s.level}/${s.sequence}`).sort()).toEqual(["B1/10", "B1/9", "B2/10"]);
    expect(split.flatMap((s) => s.tailSequences).sort((a, b) => a - b)).toEqual([405, 668, 669]);
    // Перемер против живого прода 05.09 (7.109): A1 2 / A2 7 / B1 9 / B2 8,
    // и ни одного C1 — у C1 бесплатных рунгов нет вовсе.
    expect(Object.entries(
      day.reduce<Record<string, number>>((a, s) => ({ ...a, [s.level]: (a[s.level] ?? 0) + 1 }), {}),
    ).sort()).toEqual([["A1", 2], ["A2", 7], ["B1", 9], ["B2", 8]]);
    expect(day.some((s) => s.level === "C1")).toBe(false);
  });

  it("owns exactly the rungs it names, and only for WORD_SEARCH", () => {
    const s = DENSITY_SPLITS[0];
    expect(isDensityOwnedRung("WORD_SEARCH", s.level, s.sequence)).toBe(true);
    expect(isDensityOwnedRung("WORD_SEARCH", s.level, s.tailSequences[0])).toBe(true);
    expect(isDensityOwnedRung("CROSSWORD", s.level, s.sequence)).toBe(false);
    expect(findDensitySplit(s.level, s.sequence)).toBe(s);
    expect(findDensitySplit(s.level, 999_999)).toBeUndefined();
  });
});

describe("ladderGaps", () => {
  it("is silent on a ladder that stays 1…N", () => {
    expect(ladderGaps([1, 2, 3], [4, 5])).toEqual([]);
  });

  it("names the missing numbers when the tail starts past the end", () => {
    // The real failure: 3 rows, a tail written at 5 — the picker renders
    // links 1…4, so row 5 is unreachable and link 4 is a 404.
    expect(ladderGaps([1, 2, 3], [5])).toEqual([4]);
  });

  it("names a hole left inside an existing ladder too", () => {
    expect(ladderGaps([1, 3], [])).toEqual([2]);
  });

  it("treats an empty ladder as gapless rather than as a hole at 1", () => {
    expect(ladderGaps([], [])).toEqual([]);
  });
});
