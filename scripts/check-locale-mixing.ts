/**
 * СМЕШЕНИЕ ЯЗЫКОВ В ДАННЫХ — СТОРОЖ (заход 7.211, задача 3.1).
 *
 * ====================================================================
 * ЧТО СНЯЛ ВЛАДЕЛЕЦ
 * ====================================================================
 *
 * 18.09.2026, приложение, локаль `/es`, урок A1 · LECCIÓN 1, вкладка
 * Vocabulario, блок «TÉRMINOS DE ESTA LECCIÓN». Среди чипов —
 * дословно: **«caso vocativo (звательный падеж)»**. Испаноговорящему
 * ученику показана русская подпись ВНУТРИ испанского названия термина.
 *
 * Класс не новый: тем же был `Story.author` («Por Русская народная
 * сказка») — смешение языков живёт в ДАННЫХ, а не в отрисовке.
 *
 * ====================================================================
 * ЧТО ОКАЗАЛОСЬ НАХОДКОЙ, А ЧТО НЕТ (замер по проду, 119 записей)
 * ====================================================================
 *
 * Кириллица в испанских полях глоссария: 170 попаданий в 105 записях
 * (`definition` 67, `russianComparison` 78, `term` 25). Латиницы в
 * русском поле `russianEquivalent` — 0. Подавляющее большинство —
 * НАМЕРЕННОЕ: испанский текст объясняет русский язык и обязан его
 * цитировать.
 *
 * Настоящих находок — **6 из 25**, и признак у них проверяемый, а не
 * вкусовой: **скобочная кириллица в названии ДОСЛОВНО равна полю
 * `russianEquivalent`**, то есть это перевод самого названия, у
 * которого уже есть своё поле, и оно печатается на карточке отдельной
 * подписанной строкой (`GlossaryApp.tsx:234`). Шесть слугов:
 * `caso-vocativo`, `construccion-de-gerundio`, `construccion-participial`,
 * `gerundio-de-pasado`, `palabra-parentetica`, `segundo-caso-locativo`.
 *
 * Остальные 19 — не находки, и каждая названа ниже поимённо с причиной:
 * формула конструкции («в/на + acusativo»), цитата предмета в кавычках
 * («чем... тем...»), сам русский постфикс («con -ся»), пример («мне
 * холодно») и шесть пар глаголов движения, у которых испанского
 * названия не существует вовсе («идти / ходить»).
 *
 * ====================================================================
 * ЧТО СТЕРЕЖЁТСЯ
 * ====================================================================
 *
 *   1. КИРИЛЛИЦА В ИСПАНСКОМ НАЗВАНИИ (`term`) — красный, кроме
 *      поимённого списка `ALLOWED_CYRILLIC_TERMS` с причиной у каждой
 *      строки. Список обеих половин: слуг, которого нет в данных, и
 *      слуг, которому исключение больше не нужно, — тоже красный.
 *   2. ПЕРЕВОД НАЗВАНИЯ ВНУТРИ НАЗВАНИЯ — красный ВСЕГДА, и список
 *      исключений его не отменяет: если скобочная кириллица в `term`
 *      совпала с `russianEquivalent`, это ровно находка владельца.
 *   3. ЛАТИНИЦА В РУССКОМ ПОЛЕ (`russianEquivalent`) — красный.
 *   4. ВИТРИНЫ СЛОВАРЯ ИНТЕРФЕЙСА: темы словаря, подписи уровней,
 *      названия игр и плашки доступа — без кириллицы в `es.json` и без
 *      латинских СЛОВ в `ru.json`. Судится по словам, а не по буквам:
 *      подстановки `{count}`, коды уровней и имена собственные
 *      (Premium, RusoFácilapp) в русском тексте законны.
 *
 * Источник данных — `prisma/seed-glossary.ts`, то есть репозиторий:
 * сторож обязан гоняться в CI, где боевой базы нет. Сверка сида с
 * продом делается отдельно (`--against-prod`) и руками; 18.09.2026 она
 * совпала знак в знак: 119 = 119, расхождений 0 до правки.
 *
 *   npx tsx scripts/check-locale-mixing.ts
 *   npx tsx scripts/check-locale-mixing.ts --plant
 */
import { readFileSync } from "node:fs";
import { terms } from "../prisma/glossary-terms-data";
import { isEntryPoint } from "../src/lib/entry-point";

const CYRILLIC = /[Ѐ-ӿԀ-ԯ]/;
const LATIN_WORD = /[A-Za-z]{3,}/;

/** Разрешённая кириллица в испанском названии — поимённо, с причиной.
 *  Список закрытый: и лишняя строка, и недостающая роняют сторожа. */
const ALLOWED_CYRILLIC_TERMS: Record<string, string> = {
  "acusativo-de-direccion": "формула конструкции: русский предлог плюс испанское имя падежа",
  "dativo-de-direccion": "формула конструкции: «к + dativo»",
  "instrumental-de-compania": "формула конструкции: «с + instrumental»",
  "preposicional-de-tema": "формула конструкции: «о/об + preposicional»",
  "verbo-reflexivo-sya": "сам русский постфикс -ся и есть предмет термина",
  "dativo-impersonal": "пример на русском («мне холодно»), а не перевод названия",
  "conjuncion-concesiva": "сам русский союз «хотя» и есть предмет термина",
  "conjuncion-final": "сам русский союз «чтобы» и есть предмет термина",
  "contraste-to-nibud": "предмет термина — две русские частицы, названные в кавычках",
  "exclamacion-kakoy-kak": "предмет термина — два русских слова, названные в кавычках",
  "interrogativo-con-by-ni": "предмет термина — русская конструкция «бы ни»",
  "preposicion-v-na": "предмет термина — два русских предлога, названные в кавычках",
  "proporcionalidad-chem-tem": "предмет термина — русская конструкция «чем... тем...»",
  "par-bezhat-begat": "пара глаголов движения: испанского названия у неё не существует",
  "par-ehat-ezdit": "пара глаголов движения: испанского названия у неё не существует",
  "par-idti-hodit": "пара глаголов движения: испанского названия у неё не существует",
  "par-letet-letat": "пара глаголов движения: испанского названия у неё не существует",
  "par-nesti-nosit": "пара глаголов движения: испанского названия у неё не существует",
  "par-plyt-plavat": "пара глаголов движения: испанского названия у неё не существует",
};

/** Витрины словаря интерфейса, у которых смешения быть не может вовсе. */
const SURFACES = [
  "vocabulary.categoryLabels",
  "wordGames",
  "access",
  "paywall",
] as const;

/** Латиница, законная в русском тексте: подстановки, коды уровней,
 *  имена собственные и общепринятые заимствования, которые по-русски
 *  так и пишут. */
const LEGITIMATE_LATIN =
  /\{[^}]*\}|\b(RusoF[aá]cil(app)?|Premium|Stripe|Telegram|OXXO|MXN|USD|PDF|IndexedDB|JSON|Google|Play|Apple|App\s?Store|Android|iOS|iPhone|YouTube|Vercel|Sentry|Windows|Wi-?Fi|SEO|CEFR|URL|HTML|CSV|MP4|WebM|email|Email|exam|support@rusofacilapp\.com|you@example\.com|ES|RU|A1|A2|B1|B2|C1)\b/g;

export interface Finding {
  where: string;
  rule: string;
  text: string;
}

/** Кириллица в круглых скобках названия, если она есть. */
export function parentheticalCyrillic(term: string): string | null {
  const m = term.match(/\(([^)]*)\)/);
  if (!m) return null;
  return CYRILLIC.test(m[1]) ? m[1].trim() : null;
}

export interface TermRow {
  slug: string;
  term: string;
  russianEquivalent: string;
}

/** Правила 1–3 — по строкам глоссария. */
export function glossaryFindings(rows: readonly TermRow[]): Finding[] {
  const out: Finding[] = [];
  const seenAllowed = new Set<string>();
  for (const row of rows) {
    const paren = parentheticalCyrillic(row.term);
    // ПРАВИЛО 2 — сильнее списка исключений.
    if (paren && paren === row.russianEquivalent.trim()) {
      out.push({
        where: `GlossaryTerm.term[${row.slug}]`,
        rule: "перевод названия внутри названия: скобка дословно равна russianEquivalent",
        text: row.term,
      });
      continue;
    }
    // ПРАВИЛО 1.
    if (CYRILLIC.test(row.term)) {
      if (ALLOWED_CYRILLIC_TERMS[row.slug]) seenAllowed.add(row.slug);
      else
        out.push({
          where: `GlossaryTerm.term[${row.slug}]`,
          rule: "кириллица в испанском названии термина",
          text: row.term,
        });
    }
    // ПРАВИЛО 3.
    if (LATIN_WORD.test(row.russianEquivalent.replace(LEGITIMATE_LATIN, ""))) {
      out.push({
        where: `GlossaryTerm.russianEquivalent[${row.slug}]`,
        rule: "латиница в русском поле",
        text: row.russianEquivalent,
      });
    }
  }
  // Обе половины списка исключений.
  const slugs = new Set(rows.map((r) => r.slug));
  for (const slug of Object.keys(ALLOWED_CYRILLIC_TERMS)) {
    if (!slugs.has(slug))
      out.push({ where: `исключение[${slug}]`, rule: "исключение на слуг, которого нет в данных", text: "" });
    else if (!seenAllowed.has(slug))
      out.push({ where: `исключение[${slug}]`, rule: "исключение больше не нужно: кириллицы в названии нет", text: "" });
  }
  return out;
}

function flatten(obj: unknown, prefix: string, acc: [string, string][]): void {
  if (typeof obj === "string") {
    acc.push([prefix, obj]);
    return;
  }
  if (obj && typeof obj === "object")
    for (const [k, v] of Object.entries(obj as Record<string, unknown>))
      flatten(v, prefix ? `${prefix}.${k}` : k, acc);
}

function at(dict: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], dict);
}

/** Правило 4 — по витринам словаря интерфейса. */
export function surfaceFindings(es: unknown, ru: unknown): { findings: Finding[]; measured: number } {
  const out: Finding[] = [];
  let measured = 0;
  for (const path of SURFACES) {
    for (const [dict, locale] of [
      [es, "es"],
      [ru, "ru"],
    ] as const) {
      const node = at(dict, path);
      if (node === undefined) {
        out.push({ where: `${locale}.${path}`, rule: "витрины нет в словаре — правило стережёт пустоту", text: "" });
        continue;
      }
      const rows: [string, string][] = [];
      flatten(node, `${locale}.${path}`, rows);
      measured += rows.length;
      for (const [key, value] of rows) {
        if (locale === "es" && CYRILLIC.test(value))
          out.push({ where: key, rule: "кириллица в испанской витрине", text: value });
        if (locale === "ru" && LATIN_WORD.test(value.replace(LEGITIMATE_LATIN, "")))
          out.push({ where: key, rule: "латинское слово в русской витрине", text: value });
      }
    }
  }
  // Подписи уровней — только сами названия уровней: названия УРОКОВ
  // цитируют русские конструкции намеренно (36 строк, замер 7.211).
  for (const [dict, locale] of [
    [es, "es"],
    [ru, "ru"],
  ] as const) {
    const levels = at(dict, "courses.levels") as Record<string, { title?: string }> | undefined;
    if (!levels) {
      out.push({ where: `${locale}.courses.levels`, rule: "подписей уровней нет в словаре", text: "" });
      continue;
    }
    for (const [code, level] of Object.entries(levels)) {
      const title = level?.title;
      if (typeof title !== "string") continue;
      measured += 1;
      if (locale === "es" && CYRILLIC.test(title))
        out.push({ where: `es.courses.levels.${code}.title`, rule: "кириллица в испанской подписи уровня", text: title });
      if (locale === "ru" && LATIN_WORD.test(title.replace(LEGITIMATE_LATIN, "")))
        out.push({ where: `ru.courses.levels.${code}.title`, rule: "латинское слово в русской подписи уровня", text: title });
    }
  }
  return { findings: out, measured };
}

function readDicts(): { es: unknown; ru: unknown } {
  return {
    es: JSON.parse(readFileSync("src/dictionaries/es.json", "utf8")) as unknown,
    ru: JSON.parse(readFileSync("src/dictionaries/ru.json", "utf8")) as unknown,
  };
}

export function main(): number {
  const plant = process.argv.includes("--plant");
  const rows: TermRow[] = terms.map((t) => ({
    slug: t.slug,
    term: t.term,
    russianEquivalent: t.russianEquivalent,
  }));

  if (plant) {
    let ok = true;
    const say = (good: boolean, text: string) => {
      console.log(`  ${good ? "верно" : "ОШИБКА"} — ${text}`);
      if (!good) ok = false;
    };
    const { es, ru } = readDicts();

    // ОТРИЦАТЕЛЬНЫЙ контроль: живые данные молчат.
    const healthy = glossaryFindings(rows);
    const healthySurfaces = surfaceFindings(es, ru);
    say(healthy.length === 0, `ОТРИЦАТЕЛЬНЫЙ контроль: живой глоссарий, находок ${healthy.length}`);
    say(
      healthySurfaces.findings.length === 0 && healthySurfaces.measured > 60,
      `ОТРИЦАТЕЛЬНЫЙ контроль: живые витрины, измерено строк ${healthySurfaces.measured}, находок ${healthySurfaces.findings.length}`,
    );

    // 1. ровно находка владельца, возвращённая обратно
    const back = rows.map((r) =>
      r.slug === "caso-vocativo" ? { ...r, term: "caso vocativo (звательный падеж)" } : r,
    );
    const f1 = glossaryFindings(back);
    say(
      f1.length === 1 && f1[0].where.includes("caso-vocativo"),
      `находка владельца подсажена обратно: находок ${f1.length}` + (f1.length ? ` — ${f1[0].rule}` : ""),
    );

    // 2. русское слово в испанском названии, которого в списке нет
    const f2 = glossaryFindings(
      rows.map((r) => (r.slug === "adjetivo" ? { ...r, term: "adjetivo (имя прилагательное)" } : r)),
    );
    say(f2.length >= 1, `русское слово в чужом испанском названии: находок ${f2.length}`);

    // 3. список исключений НЕ спасает от перевода названия внутри названия
    const f3 = glossaryFindings(
      rows.map((r) =>
        r.slug === "par-idti-hodit" ? { ...r, term: "par de movimiento (идти / ходить)" } : r,
      ),
    );
    say(
      f3.some((f) => f.where.includes("par-idti-hodit")),
      `слуг ИЗ СПИСКА ИСКЛЮЧЕНИЙ с переводом названия внутри названия — всё равно находка: ${f3.length}`,
    );

    // 4. латиница в русском поле
    const f4 = glossaryFindings(
      rows.map((r) => (r.slug === "adjetivo" ? { ...r, russianEquivalent: "imya prilagatelnoye" } : r)),
    );
    say(f4.length >= 1, `латиница в russianEquivalent: находок ${f4.length}`);

    // 5. обе половины списка исключений
    const f5 = glossaryFindings(rows.filter((r) => r.slug !== "par-idti-hodit"));
    say(
      f5.some((f) => f.where.includes("исключение[par-idti-hodit]")),
      `исключение на исчезнувший слуг — находка: ${f5.length}`,
    );
    const f6 = glossaryFindings(
      rows.map((r) => (r.slug === "par-idti-hodit" ? { ...r, term: "par de movimiento" } : r)),
    );
    say(
      f6.some((f) => f.rule.includes("больше не нужно")),
      `исключение, которое больше не нужно, — находка: ${f6.length}`,
    );

    // 7. кириллица в испанской витрине словаря
    const brokenEs = JSON.parse(JSON.stringify(es)) as Record<string, Record<string, Record<string, string>>>;
    brokenEs.vocabulary.categoryLabels.health = "Salud (Здоровье)";
    const f7 = surfaceFindings(brokenEs, ru);
    say(f7.findings.length === 1, `русская подпись в испанской теме словаря: находок ${f7.findings.length}`);

    // 8. ОТРИЦАТЕЛЬНЫЙ: подстановки и имена собственные в русской витрине — не отказ
    const brokenRu = JSON.parse(JSON.stringify(ru)) as Record<string, Record<string, string>>;
    brokenRu.wordGames.premiumTierLabel = "Только Premium · {count} из {total}";
    const f8 = surfaceFindings(es, brokenRu);
    say(f8.findings.length === 0, `подстановки и «Premium» в русской витрине — не отказ: находок ${f8.findings.length}`);

    // 9. а настоящее испанское слово там же — отказ
    const brokenRu2 = JSON.parse(JSON.stringify(ru)) as Record<string, Record<string, string>>;
    brokenRu2.wordGames.premiumTierLabel = "Solo Premium";
    const f9 = surfaceFindings(es, brokenRu2);
    say(f9.findings.length === 1, `испанское слово в русской витрине: находок ${f9.findings.length}`);

    console.log(
      ok
        ? "check:locale-mixing --plant — 7 из 7 подсадок, 3 из 3 отрицательных контроля"
        : "check:locale-mixing --plant — FAILED",
    );
    return ok ? 0 : 1;
  }

  /** ПОЛ: выборка обязана собраться (правило 4.1). */
  if (rows.length < 100) {
    console.error(`check:locale-mixing — терминов ${rows.length}: выборка не собралась`);
    return 1;
  }
  const { es, ru } = readDicts();
  const surfaces = surfaceFindings(es, ru);
  if (surfaces.measured < 60) {
    console.error(`check:locale-mixing — строк витрин ${surfaces.measured}: витрины не собрались`);
    return 1;
  }
  const findings = [...glossaryFindings(rows), ...surfaces.findings];
  if (findings.length) {
    console.error("СМЕШЕНИЕ ЯЗЫКОВ В ДАННЫХ (испаноговорящему ученику показан русский текст или наоборот):");
    for (const f of findings) console.error(`  ${f.where} — ${f.rule}${f.text ? ` … ${f.text}` : ""}`);
    return 1;
  }
  console.log(
    `check:locale-mixing — терминов ${rows.length}, строк витрин ${surfaces.measured}, ` +
      `исключений ${Object.keys(ALLOWED_CYRILLIC_TERMS).length} (все названы поимённо): смешений 0.`,
  );
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main();
}
