import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPluralForms, plural, pluralForm, type PluralForms } from "./plural";

/**
 * The tiles printed "3 дней", "4 дней" and "3 слов изучено" — the genitive
 * plural for every count, because each of those was ONE string in the
 * dictionary with a number concatenated in front of it. Spanish had the
 * mirror ("1 días").
 *
 * Every case below walks the same nine counts — 0, 1, 2, 3, 4, 5, 11, 21,
 * 101 — and they are not decoration:
 *
 *   1 / 21 / 101   the "one" form in Russian, singular in Spanish
 *   2 / 3 / 4      the "few" form, which Spanish does not have at all
 *   0 / 5          the "many" form
 *   11             the trap: it ends in 1 and still takes "many". A rule
 *                  written as `n % 10 === 1` passes 1, 21 and 101 and fails
 *                  here, so a test that stops at 5 cannot tell the two
 *                  implementations apart.
 *
 * THE POSITIVE CONTROL, and the reason this file is worth anything (rule
 * 4.1 in PROGRESS.md): `legacy` below is the behaviour these strings had
 * before this change — one invariant string, whatever the number. Every
 * table asserts both that the new form is right AND that the old one was
 * wrong for at least one of the nine counts. Delete the legacy half and the
 * remaining assertions would pass on the broken code too.
 */

const DIR = join(process.cwd(), "src", "dictionaries");
const es = JSON.parse(readFileSync(join(DIR, "es.json"), "utf8")) as Record<string, never>;
const ru = JSON.parse(readFileSync(join(DIR, "ru.json"), "utf8")) as Record<string, never>;

const COUNTS = [0, 1, 2, 3, 4, 5, 11, 21, 101];

/** What every one of these call sites did before: print the one string it
 * had, whatever the number standing next to it. */
function legacy(forms: PluralForms): string {
  return forms.many;
}

function dig(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], root);
}

function formsAt(root: unknown, path: string): PluralForms {
  const value = dig(root, path);
  if (!isPluralForms(value)) throw new Error(`${path} is not a plural-form group`);
  return value;
}

describe("pluralForm — the rule itself", () => {
  const ruForms: PluralForms = { one: "день", few: "дня", many: "дней" };
  const esForms: PluralForms = { one: "día", few: "días", many: "días" };

  it("picks the Russian form by the last digits, teens included", () => {
    expect(COUNTS.map((n) => `${n} ${pluralForm("ru", n, ruForms)}`)).toEqual([
      "0 дней",
      "1 день",
      "2 дня",
      "3 дня",
      "4 дня",
      "5 дней",
      "11 дней",
      "21 день",
      "101 день",
    ]);
  });

  it("picks the Spanish form: 1 is singular, everything else is not", () => {
    expect(COUNTS.map((n) => `${n} ${pluralForm("es", n, esForms)}`)).toEqual([
      "0 días",
      "1 día",
      "2 días",
      "3 días",
      "4 días",
      "5 días",
      "11 días",
      "21 días",
      "101 días",
    ]);
  });

  it("positive control: the old single-string behaviour is wrong, and on which numbers", () => {
    const wrongRu = COUNTS.filter((n) => legacy(ruForms) !== pluralForm("ru", n, ruForms));
    const wrongEs = COUNTS.filter((n) => legacy(esForms) !== pluralForm("es", n, esForms));
    // Not "some of them" — the exact list, so a change to the rule has to
    // change a number here rather than a sentence nobody reads.
    expect(wrongRu).toEqual([1, 2, 3, 4, 21, 101]);
    expect(wrongEs).toEqual([1]);
  });

  it("catches the teens trap that a bare `n % 10` rule would miss", () => {
    // 11, 12, 13, 14 end in 1-4 and still take the "many" form.
    for (const n of [11, 12, 13, 14, 111, 112]) {
      expect(pluralForm("ru", n, ruForms), String(n)).toBe("дней");
    }
    for (const n of [1, 2, 3, 4, 21, 22, 101, 102]) {
      expect(pluralForm("ru", n, ruForms), String(n)).not.toBe("дней");
    }
  });

  it("Spanish never reads `few`, and that is checked on data it could read", () => {
    // The dictionary invariant below ("keeps `few` out of Spanish") only
    // proves the FILES have few === many. If the selector itself started
    // reading `few` for Spanish, nothing in the files would notice, because
    // the two strings are identical everywhere. So this asks the question on
    // a group where they differ.
    const rigged: PluralForms = { one: "uno", few: "NEVER", many: "muchos" };
    expect(COUNTS.map((n) => pluralForm("es", n, rigged))).toEqual([
      "muchos",
      "uno",
      "muchos",
      "muchos",
      "muchos",
      "muchos",
      "muchos",
      "muchos",
      "muchos",
    ]);
    // …and Russian does read it, on the same group.
    expect(pluralForm("ru", 2, rigged)).toBe("NEVER");
  });

  it("still returns a form for a count no call site can produce", () => {
    expect(pluralForm("ru", -1, ruForms)).toBe("день");
    expect(pluralForm("ru", 1.5, ruForms)).toBe("дней");
    expect(pluralForm("es", 0.5, esForms)).toBe("días");
  });

  it("fills placeholders after choosing the form, not before", () => {
    const forms: PluralForms = { one: "{n} день", few: "{n} дня", many: "{n} дней" };
    expect(COUNTS.map((n) => plural("ru", n, forms, { n }))).toEqual([
      "0 дней",
      "1 день",
      "2 дня",
      "3 дня",
      "4 дня",
      "5 дней",
      "11 дней",
      "21 день",
      "101 день",
    ]);
  });
});

describe("the live dictionary strings", () => {
  // Path → the nine expected renderings, in COUNTS order. Written out in
  // full rather than generated: a generator would reproduce whatever bug the
  // implementation has.
  const RU_CASES: Array<[string, string[], Record<string, string | number>]> = [
    [
      "profile.streakDaysUnit",
      ["дней", "день", "дня", "дня", "дня", "дней", "дней", "день", "день"],
      {},
    ],
    [
      "profile.wordsLearnedLabel",
      [
        "слов изучено",
        "слово изучено",
        "слова изучено",
        "слова изучено",
        "слова изучено",
        "слов изучено",
        "слов изучено",
        "слово изучено",
        "слово изучено",
      ],
      {},
    ],
    [
      "profile.lessonsCompleted",
      [
        "уроков сдано",
        "урок сдан",
        "урока сдано",
        "урока сдано",
        "урока сдано",
        "уроков сдано",
        "уроков сдано",
        "урок сдан",
        "урок сдан",
      ],
      {},
    ],
    [
      "nav.streakLabel",
      [
        "Серия: 0 дней",
        "Серия: 1 день",
        "Серия: 2 дня",
        "Серия: 3 дня",
        "Серия: 4 дня",
        "Серия: 5 дней",
        "Серия: 11 дней",
        "Серия: 21 день",
        "Серия: 101 день",
      ],
      { days: "COUNT" },
    ],
    [
      "vocabulary.cardCountLabel",
      ["0 слов", "1 слово", "2 слова", "3 слова", "4 слова", "5 слов", "11 слов", "21 слово", "101 слово"],
      { count: "COUNT" },
    ],
    [
      "groups.membersUnit",
      [
        "участников",
        "участник",
        "участника",
        "участника",
        "участника",
        "участников",
        "участников",
        "участник",
        "участник",
      ],
      {},
    ],
    [
      "courses.weeks",
      ["недель", "неделя", "недели", "недели", "недели", "недель", "недель", "неделя", "неделя"],
      {},
    ],
  ];

  const ES_CASES: Array<[string, string[], Record<string, string | number>]> = [
    [
      "profile.streakDaysUnit",
      ["días", "día", "días", "días", "días", "días", "días", "días", "días"],
      {},
    ],
    [
      "profile.wordsLearnedLabel",
      [
        "palabras aprendidas",
        "palabra aprendida",
        "palabras aprendidas",
        "palabras aprendidas",
        "palabras aprendidas",
        "palabras aprendidas",
        "palabras aprendidas",
        "palabras aprendidas",
        "palabras aprendidas",
      ],
      {},
    ],
    [
      "profile.lessonsCompleted",
      [
        "lecciones aprobadas",
        "lección aprobada",
        "lecciones aprobadas",
        "lecciones aprobadas",
        "lecciones aprobadas",
        "lecciones aprobadas",
        "lecciones aprobadas",
        "lecciones aprobadas",
        "lecciones aprobadas",
      ],
      {},
    ],
    [
      "nav.streakLabel",
      [
        "Racha: 0 días",
        "Racha: 1 día",
        "Racha: 2 días",
        "Racha: 3 días",
        "Racha: 4 días",
        "Racha: 5 días",
        "Racha: 11 días",
        "Racha: 21 días",
        "Racha: 101 días",
      ],
      { days: "COUNT" },
    ],
    [
      "vocabulary.cardCountLabel",
      [
        "0 palabras",
        "1 palabra",
        "2 palabras",
        "3 palabras",
        "4 palabras",
        "5 palabras",
        "11 palabras",
        "21 palabras",
        "101 palabras",
      ],
      { count: "COUNT" },
    ],
    [
      "groups.membersUnit",
      [
        "miembros",
        "miembro",
        "miembros",
        "miembros",
        "miembros",
        "miembros",
        "miembros",
        "miembros",
        "miembros",
      ],
      {},
    ],
    [
      "courses.weeks",
      ["semanas", "semana", "semanas", "semanas", "semanas", "semanas", "semanas", "semanas", "semanas"],
      {},
    ],
  ];

  function render(locale: "es" | "ru", root: unknown, path: string, vars: Record<string, string | number>) {
    const forms = formsAt(root, path);
    return COUNTS.map((n) => {
      const filled = Object.fromEntries(
        Object.entries(vars).map(([k, v]) => [k, v === "COUNT" ? n : v]),
      );
      return plural(locale, n, forms, filled);
    });
  }

  for (const [path, expected, vars] of RU_CASES) {
    it(`ru ${path} agrees with the number`, () => {
      expect(render("ru", ru, path, vars)).toEqual(expected);
    });
  }

  for (const [path, expected, vars] of ES_CASES) {
    it(`es ${path} agrees with the number`, () => {
      expect(render("es", es, path, vars)).toEqual(expected);
    });
  }

  it("positive control: the pre-fix string is wrong for at least one of the nine counts", () => {
    // The exact defect reported: "3 дней", "4 дней", "3 слов изучено", and
    // its Spanish mirror "1 días". If any of these ever came out equal, this
    // whole file would be checking nothing.
    const offenders: string[] = [];
    for (const [locale, root, cases] of [
      ["ru", ru, RU_CASES],
      ["es", es, ES_CASES],
    ] as const) {
      for (const [path, , vars] of cases) {
        const forms = formsAt(root, path);
        const wrong = COUNTS.filter((n) => {
          const filled = Object.fromEntries(
            Object.entries(vars).map(([k, v]) => [k, v === "COUNT" ? n : v]),
          );
          const old = Object.entries(filled).reduce(
            (s, [k, v]) => s.split(`{${k}}`).join(String(v)),
            legacy(forms),
          );
          return old !== plural(locale, n, forms, filled);
        });
        if (wrong.length > 0) offenders.push(`${locale} ${path}: ${wrong.join(",")}`);
      }
    }
    // Every single one of them, both locales. A key that could not be got
    // wrong has no business being in the tables above.
    expect(offenders).toHaveLength(RU_CASES.length + ES_CASES.length);
    expect(offenders).toContain("ru profile.streakDaysUnit: 1,2,3,4,21,101");
    expect(offenders).toContain("ru profile.wordsLearnedLabel: 1,2,3,4,21,101");
    expect(offenders).toContain("es profile.streakDaysUnit: 1");
  });
});

describe("the two files stay a matched pair", () => {
  function collect(root: unknown, prefix = "", out: Record<string, PluralForms> = {}) {
    if (root && typeof root === "object") {
      if (isPluralForms(root)) {
        out[prefix] = root;
        return out;
      }
      for (const [k, v] of Object.entries(root as Record<string, unknown>)) {
        collect(v, prefix ? `${prefix}.${k}` : k, out);
      }
    }
    return out;
  }

  const ES = collect(es);
  const RU = collect(ru);

  it("finds the plural groups at all", () => {
    // Without this, an empty collection would make everything below pass.
    expect(Object.keys(ES).length).toBeGreaterThan(20);
    expect(Object.keys(ES)).toContain("profile.streakDaysUnit");
  });

  it("has the same plural groups in both files", () => {
    expect(Object.keys(ES).filter((k) => !(k in RU))).toEqual([]);
    expect(Object.keys(RU).filter((k) => !(k in ES))).toEqual([]);
  });

  it("keeps `few` out of Spanish", () => {
    // Spanish has two forms. `few` exists only so the two files carry the
    // same key set (dictionary-parity.test.ts requires it) and is never
    // read; making it equal to `many` is what states that in the data
    // instead of in a comment.
    const invented = Object.entries(ES)
      .filter(([, f]) => f.few !== f.many)
      .map(([k]) => k);
    expect(invented).toEqual([]);
  });

  it("carries every placeholder in every form", () => {
    // A form that dropped {count} would print a sentence with a hole in it
    // for exactly one of the nine counts — the hardest kind of copy defect
    // to notice.
    const broken: string[] = [];
    for (const [name, groups] of [
      ["es", ES],
      ["ru", RU],
    ] as const) {
      for (const [path, forms] of Object.entries(groups)) {
        const wanted = [...forms.many.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        for (const which of ["one", "few"] as const) {
          const got = [...forms[which].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
          if (got.join(",") !== wanted.join(",")) broken.push(`${name} ${path}.${which}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
