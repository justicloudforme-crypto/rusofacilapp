import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import lessons from "@/lib/lessons/content.json";
import { bankKey } from "@/lib/translation-normalize";
import { WORD_BANK_BATCHES, batchKeyCount, lookupBatchKey } from "./index";

/**
 * ПЕРЕВОДЫ ПАРТИЙ НЕ ВЫДУМАНЫ — сторож долга 171 (заход 7.312).
 *
 * Правило владельца: в банк идёт только перевод, который уже есть в
 * проекте и проверен. Для партий это значит одно: у каждой строки в
 * `from` назван урок, в словаре (`vocabulary`) которого ТА ЖЕ словоформа
 * стоит отдельной строкой, и перевод партии равен переводу урока знак в
 * знак (несколько уроков — склейка через «; » в том же порядке). Любая
 * «поправка от себя» роняет этот тест.
 */
type Vocab = { word: string; translation: string };
const LESSONS = lessons as unknown as Record<string, { vocabulary?: Vocab[] }>;

function lessonTranslation(slug: string, word: string): string | null {
  const row = (LESSONS[slug]?.vocabulary ?? []).find((v) => v.word.trim().toLowerCase() === word);
  return row ? row.translation : null;
}

const all = WORD_BANK_BATCHES.flatMap((b) => b.entries);

describe("партии своего банка переводов (долг 171)", () => {

  it("каждая партия небольшая — не больше 150 слов (решение владельца 7.312)", () => {
    for (const batch of WORD_BANK_BATCHES) expect(batch.entries.length).toBeLessThanOrEqual(150);
    expect(all.length).toBeGreaterThan(0);
  });

  it("ключ — одна русская словоформа в записи bankKey, без повторов", () => {
    const seen = new Set<string>();
    for (const entry of all) {
      expect(bankKey(entry.word), entry.word).toBe(entry.word);
      expect(seen.has(entry.word), `повтор ${entry.word}`).toBe(false);
      seen.add(entry.word);
    }
    expect(batchKeyCount()).toBe(all.length);
  });

  it("перевод равен словарю названного урока знак в знак (партии «lesson-verbatim»)", () => {
    const bad: string[] = [];
    const lessonRows = WORD_BANK_BATCHES.filter((b) => (b.rule ?? "lesson-verbatim") === "lesson-verbatim").flatMap((b) => b.entries);
    expect(lessonRows.length).toBeGreaterThan(0);
    for (const entry of lessonRows) {
      if (!entry.from) {
        bad.push(`${entry.word}: у партии урока нет from`);
        continue;
      }
      expect(entry.from.length, entry.word).toBeGreaterThan(0);
      const parts = entry.from.map((slug) => lessonTranslation(slug, entry.word));
      if (parts.some((p) => p === null)) {
        bad.push(`${entry.word}: в ${entry.from.join(", ")} такой строки словаря нет`);
        continue;
      }
      const expected = parts.join("; ");
      if (entry.translation !== expected) bad.push(`${entry.word}: «${entry.translation}» ≠ урок «${expected}»`);
    }
    expect(bad).toEqual([]);
  });

  it("отклонённые слова не попали ни в свою партию, ни в более раннюю; в более позднюю — только по утверждению владельца", () => {
    WORD_BANK_BATCHES.forEach((batch, i) => {
      for (const r of batch.rejected) {
        expect(r.reason.length).toBeGreaterThan(10);
        WORD_BANK_BATCHES.forEach((other, j) => {
          const taken = other.entries.some((e) => e.word === r.word);
          if (j <= i) expect(taken, `${r.word}: отклонено в партии ${batch.batch}, но стоит в партии ${other.batch}`).toBe(false);
          // «всех»: в партии 1 отклонено (урок давал узкое «que todos»),
          // в партии 2 — перевод «todos (gen./acus.)», утверждённый владельцем.
          else if (taken) expect(other.rule, `${r.word} вернулось в партию ${other.batch} без утверждения`).toBe("owner-approved");
        });
      }
    });
  });

  it("поиск по ключу: слово партии находится, чужое — нет (позитивный и отрицательный контроль)", () => {
    expect(lookupBatchKey("ему")).toBe("a él");
    expect(lookupBatchKey("хорошо")).toBe("bien");
    expect(lookupBatchKey("показывает")).toBe("muestra");
    expect(lookupBatchKey("такова")).toBe("así es; es la siguiente");
    expect(lookupBatchKey("стоит")).toBeNull();
    expect(lookupBatchKey("за")).toBeNull();
    expect(lookupBatchKey("может")).toBeNull();
  });

  it("слова-пробы «Прода после выката» (scripts/prod-smoke.mjs) есть в своих партиях", () => {
    const smoke = readFileSync("scripts/prod-smoke.mjs", "utf-8");
    const probe = /const WORD_BANK_PROBE = "([^"]+)"/.exec(smoke)?.[1];
    expect(probe, "проба в prod-smoke.mjs не найдена").toBeTruthy();
    expect(lookupBatchKey(probe as string)).not.toBeNull();
    const probe2 = /const WORD_BANK_PROBE_2 = "([^"]+)"/.exec(smoke)?.[1];
    const token2 = /const WORD_BANK_PROBE_2_TOKEN = '([^']+)'/.exec(smoke)?.[1];
    const batch2 = WORD_BANK_BATCHES.find((b) => b.batch === 2)!;
    const row = batch2.entries.find((e) => e.word === probe2);
    expect(row, `проба партии 2 «${probe2}» не из партии 2`).toBeTruthy();
    expect(lookupBatchKey(probe2 as string)).toBe(row!.translation);
    expect(token2).toBe(`"translation":${JSON.stringify(row!.translation)},"source":"lesson"`);
    const probe3 = /const WORD_BANK_PROBE_3 = "([^"]+)"/.exec(smoke)?.[1];
    const token3 = /const WORD_BANK_PROBE_3_TOKEN = '([^']+)'/.exec(smoke)?.[1];
    const row3 = WORD_BANK_BATCHES.find((b) => b.batch === 3)!.entries.find((e) => e.word === probe3);
    expect(row3, `проба партии 3 «${probe3}» не из партии 3`).toBeTruthy();
    expect(lookupBatchKey(probe3 as string)).toBe(row3!.translation);
    expect(token3).toBe(`"translation":${JSON.stringify(row3!.translation)},"source":"lesson"`);
  });
});

/**
 * ПАРТИЯ 2 = УТВЕРЖДЁННЫЙ ВЛАДЕЛЬЦЕМ СПИСОК — сторож долга 171 (заход 7.314).
 *
 * Список составил заход 7.313 (`docs/word-bank-batch-02-proposal.md`, таблица
 * «Итог» — 64 строки, «Отложено» — 32), владелец 26.11.2026 утвердил его
 * целиком с двумя поправками. Тест читает таблицу документа, накладывает
 * поправки (ниже, дословно из решения владельца) и требует, чтобы файл
 * партии совпал с этим знак в знак: те же слова в том же порядке, те же
 * переводы, у каждого — источник с отметкой утверждения. Подмена любого
 * перевода, лишнее или пропавшее слово, «тихое» слово из «Отложено» —
 * красный `npm run test`.
 */
const OWNER_CORRECTIONS: Record<number, string> = {
  45: "así es; es la siguiente", // «такова»: «Такова жизнь» — así es, «Мораль такова» — es la siguiente
  54: "compañía, empresa", // «компании»: и фирма, и компания людей
};

function proposalTables(path = "docs/word-bank-batch-02-proposal.md"): { accepted: { n: number; word: string; translation: string; source: string; uses: number }[]; deferred: string[] } {
  const doc = readFileSync(path, "utf-8");
  const accepted: { n: number; word: string; translation: string; source: string; uses: number }[] = [];
  const deferred: string[] = [];
  let section: "acc" | "def" | null = null;
  for (const line of doc.split("\n")) {
    if (line.startsWith("## ")) section = line.startsWith("## Итог") ? "acc" : line.startsWith("## Отложено") ? "def" : null;
    if (!line.startsWith("| ") || line.startsWith("|---")) continue;
    const cells = line.trim().replace(/^\|\s*|\s*\|$/g, "").split(" | ").map((c) => c.trim());
    if (section === "acc" && /^\d+$/.test(cells[0])) {
      accepted.push({ n: Number(cells[0]), word: cells[1], translation: cells[2], source: cells[3], uses: Number(cells[4]) });
    } else if (section === "def" && cells[0] !== "слово") {
      deferred.push(cells[0]);
    }
  }
  return { accepted, deferred };
}

describe("партия 2 своего банка = список, утверждённый владельцем 26.11.2026 (долг 171)", () => {
  const batch = WORD_BANK_BATCHES.find((b) => b.batch === 2)!;
  const { accepted, deferred } = proposalTables();

  it("документ разобран целиком: 64 принятых, 32 отложенных (пустой разбор — красный)", () => {
    expect(accepted.length).toBe(64);
    expect(deferred.length).toBe(32);
    expect(batch.rule).toBe("owner-approved");
    expect(batch.approval?.list).toBe("docs/word-bank-batch-02-proposal.md");
    expect(batch.approval?.date).toBe("2026-11-26");
    expect(batch.approval?.corrections).toEqual(Object.fromEntries(Object.entries(OWNER_CORRECTIONS)));
  });

  it("каждое слово, перевод и порядок — как в утверждённом списке с поправками владельца", () => {
    const expected = accepted.map((r) => ({ n: r.n, word: r.word, translation: OWNER_CORRECTIONS[r.n] ?? r.translation, storyUses: r.uses }));
    const actual = batch.entries.map((e) => ({ n: e.n, word: e.word, translation: e.translation, storyUses: e.storyUses }));
    expect(actual).toEqual(expected);
  });

  it("у каждого слова назван источник и отметка утверждения владельца", () => {
    const bad: string[] = [];
    for (const entry of batch.entries) {
      const row = accepted.find((r) => r.n === entry.n)!;
      const src = entry.source ?? "";
      if (!/владельц[а-я]* 26\.11\.2026/.test(src)) bad.push(`${entry.word}: нет отметки владельца`);
      if (OWNER_CORRECTIONS[entry.n!] !== undefined) {
        if (!src.includes("поправка владельца")) bad.push(`${entry.word}: поправка владельца не названа`);
      } else if (row.source === "перевод предложен агентом") {
        if (!src.startsWith("перевод предложен агентом")) bad.push(`${entry.word}: источник «агент» потерян`);
      } else {
        // Урок/карточка из списка — дословно, «форма — агент» — с отметкой.
        const base = row.source.replace("форма — агент", "форма предложена агентом");
        if (!src.startsWith(base)) bad.push(`${entry.word}: источник «${src}» ≠ списку «${row.source}»`);
      }
      // Названный урок существует.
      for (const slug of src.match(/урок ([abc][12]-\d+)/g) ?? []) {
        if (!LESSONS[slug.slice(5)]) bad.push(`${entry.word}: урока ${slug} нет в content.json`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("32 отложенных многозначных слова не попали ни в одну партию", () => {
    const keys = new Set(all.map((e) => e.word));
    expect(deferred.filter((w) => keys.has(w))).toEqual([]);
    expect(deferred.every((w) => lookupBatchKey(w) === null)).toBe(true);
    expect(batch.rejected.map((r) => r.word).sort()).toEqual([...deferred].sort());
  });
});

/**
 * ПАРТИЯ 3 = УТВЕРЖДЁННЫЙ ВЛАДЕЛЬЦЕМ СПИСОК — сторож долга 171 (заход 7.316).
 *
 * Список составил заход 7.315 (`docs/word-bank-batch-03-proposal.md`, таблица
 * «Итог» — 150 строк, «Отложено» — 21). Владелец 27.11.2026 утвердил его с
 * решениями по 15 спорным словам: десять поправок перевода (ниже, дословно из
 * решения, по номеру строки «Итога»); «берёт», «знает», «любит», «ради»,
 * «рыбка», «оказывается» — как предложено; «навстречу» — не записывать, к
 * отложенным (в «Итог» оно и не входило, поэтому записаны все 150 строк).
 * Тест читает таблицы документа, накладывает поправки и требует совпадения
 * файла партии знак в знак — как у партии 2.
 */
const OWNER_CORRECTIONS_3: Record<number, string> = {
  20: "patio", // дворе
  62: "más fuerte; más", // сильнее
  63: "anciana, vieja", // старуха — anciana первой
  69: "se sienta; se sube", // садится
  70: "sabía, conocía", // знал — оба глагола
  102: "sabía, conocía", // знала — оба глагола
  108: "final", // конце
  116: "niños, hijos", // детей — оба
  122: "fuerte; profundamente", // крепко
  144: "lado, parte", // стороны
};
/** Решение владельца 27.11.2026: не записывать, перенести к отложенным. */
const OWNER_DEFERRED_3 = ["навстречу"];

describe("партия 3 своего банка = список, утверждённый владельцем 27.11.2026 (долг 171)", () => {
  const batch = WORD_BANK_BATCHES.find((b) => b.batch === 3)!;
  const { accepted, deferred } = proposalTables("docs/word-bank-batch-03-proposal.md");

  it("документ разобран целиком: 150 принятых, 21 отложенное (пустой разбор — красный)", () => {
    expect(batch, "партии 3 нет в WORD_BANK_BATCHES").toBeTruthy();
    expect(accepted.length).toBe(150);
    expect(deferred.length).toBe(21);
    expect(batch.rule).toBe("owner-approved");
    expect(batch.approval?.list).toBe("docs/word-bank-batch-03-proposal.md");
    expect(batch.approval?.date).toBe("2026-11-27");
    expect(batch.approval?.corrections).toEqual(Object.fromEntries(Object.entries(OWNER_CORRECTIONS_3)));
  });

  it("каждое слово, перевод и порядок — как в утверждённом списке с поправками владельца", () => {
    const expected = accepted
      .filter((r) => !OWNER_DEFERRED_3.includes(r.word))
      .map((r) => ({ n: r.n, word: r.word, translation: OWNER_CORRECTIONS_3[r.n] ?? r.translation, storyUses: r.uses }));
    const actual = batch.entries.map((e) => ({ n: e.n, word: e.word, translation: e.translation, storyUses: e.storyUses }));
    expect(actual).toEqual(expected);
  });

  it("у каждого слова назван источник и отметка утверждения владельца", () => {
    const bad: string[] = [];
    for (const entry of batch.entries) {
      const row = accepted.find((r) => r.n === entry.n)!;
      const src = entry.source ?? "";
      if (!/владельц[а-я]* 27\.11\.2026/.test(src)) bad.push(`${entry.word}: нет отметки владельца`);
      if (OWNER_CORRECTIONS_3[entry.n!] !== undefined && !src.includes("поправка владельца")) bad.push(`${entry.word}: поправка владельца не названа`);
      if (row.source === "перевод предложен агентом") {
        if (!src.startsWith("перевод предложен агентом") && !src.startsWith("перевод — поправка владельца")) bad.push(`${entry.word}: источник «агент» потерян`);
      } else {
        const base = row.source.replace("форма — агент", "форма предложена агентом");
        if (!src.startsWith(base)) bad.push(`${entry.word}: источник «${src}» ≠ списку «${row.source}»`);
      }
      for (const slug of src.match(/урок ([abc][12]-\d+)/g) ?? []) {
        if (!LESSONS[slug.slice(5)]) bad.push(`${entry.word}: урока ${slug} нет в content.json`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("21 отложенное слово списка и «навстречу» не попали ни в одну партию", () => {
    const keys = new Set(all.map((e) => e.word));
    const off = [...deferred, ...OWNER_DEFERRED_3];
    expect(off.filter((w) => keys.has(w))).toEqual([]);
    expect(off.every((w) => lookupBatchKey(w) === null)).toBe(true);
    expect(batch.rejected.map((r) => r.word).sort()).toEqual([...off].sort());
  });

  it("«coger» нет ни в одном переводе партий (в Мексике — грубое слово)", () => {
    expect(all.filter((e) => /\bcoger\b|\bcog[eií]/i.test(e.translation)).map((e) => e.word)).toEqual([]);
  });
});
