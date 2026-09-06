/**
 * Сторож охвата поиска: КАЖДЫЙ раздел сайта обязан находиться по названию
 * своего живого объекта.
 *
 * Зачем. Замер 05.09.2026 (PROGRESS.md 7.127, часть 2) взял по одному
 * живому объекту из каждого раздела прода и ввёл его точное название в
 * окно поиска: **0 из 13**. Ни `Три медведя`, ни `Катюша`, ни
 * `sustantivo`, ни собственный `<title>` страницы цен. И молчал этот ноль
 * годами именно потому, что «раздел» нигде не был назван списком, за
 * который кто-то отвечает.
 *
 * Что делает скрипт. Собирает настоящий индекс из настоящей базы, берёт
 * из каждого раздела один объект (детерминированно — первый по
 * отсортированному id, чтобы прогон был повторяемым), вводит его точное
 * название и требует, чтобы объект оказался в выдаче. Печатает таблицу
 * «раздел → строка → нашёл → место».
 *
 * Позитивные контроли, без которых зелёный ничего не значит:
 *
 *   --plant         по очереди вырезает КАЖДЫЙ раздел из индекса и
 *                   требует, чтобы проверка на нём покраснела. Зелёный
 *                   `--plant` — это провал: значит, проверка не умеет
 *                   находить проблему.
 *   несуществующая  строка `zzqqxwv-нет-такого` обязана дать пустую
 *                   выдачу — иначе «нашлось» ничего не доказывает.
 *
 * Против какой базы считает — говорит первой строкой. Без
 * `TURSO_DATABASE_URL` это локальная dev.db.
 *
 *   npx tsx scripts/check-search-coverage.ts
 *   npx tsx scripts/check-search-coverage.ts --plant
 */
import { isEntryPoint } from "../src/lib/entry-point";
import { searchRecords, hrefFor, titleOf } from "../src/lib/search/match";
import { collapsedHrefsFor } from "../src/lib/search/query";
import { SEARCH_SECTIONS, COLLAPSED_SECTIONS, type SearchRecord, type SearchSection } from "../src/lib/search/types";
import type { Locale } from "../src/i18n/config";

const NONSENSE = "zzqqxwv-нет-такого";

interface Probe {
  section: SearchSection;
  lang: Locale;
  query: string;
  found: boolean;
  /** Место в плоской выдаче, считая с 1. */
  place: number | null;
  total: number;
}

/** Один объект раздела — первый по отсортированному id. Детерминированно,
 * чтобы два прогона подряд проверяли одно и то же. */
function representative(records: readonly SearchRecord[], section: SearchSection, lang: Locale): SearchRecord | null {
  const inSection = records
    .filter((r) => r.section === section && hrefFor(r, lang) !== null)
    .filter((r) => titleOf(r, lang).trim().length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  return inSection[0] ?? null;
}

function probe(records: readonly SearchRecord[], section: SearchSection, lang: Locale): Probe | null {
  const record = representative(records, section, lang);
  if (!record) return null;
  const query = titleOf(record, lang);
  const response = searchRecords(records, query, {
    lang,
    tier: "free",
    collapsedHrefs: collapsedHrefsFor(lang),
  });

  // Свёрнутый раздел поштучных строк не печатает по построению — от него
  // требуется, чтобы он вообще попал в выдачу и назвал число.
  if (COLLAPSED_SECTIONS.includes(section)) {
    let place = 0;
    for (const s of response.sections) {
      if (s.collapsed) {
        place += 1;
        if (s.section === section) {
          return { section, lang, query, found: s.total > 0, place, total: s.total };
        }
        continue;
      }
      place += s.hits.length;
    }
    return { section, lang, query, found: false, place: null, total: 0 };
  }

  let place = 0;
  for (const s of response.sections) {
    if (s.collapsed) {
      place += 1;
      continue;
    }
    for (const hit of s.hits) {
      place += 1;
      if (hit.section === section && hit.id === record.id) {
        return { section, lang, query, found: true, place, total: response.total };
      }
    }
  }
  return { section, lang, query, found: false, place: null, total: response.total };
}

function runOnce(records: readonly SearchRecord[]): { probes: Probe[]; missing: SearchSection[] } {
  const probes: Probe[] = [];
  const missing: SearchSection[] = [];
  for (const section of SEARCH_SECTIONS) {
    // Раздел проверяется на той локали, где он вообще существует: гиды по
    // грамматике, лендинги и тематические страницы словаря живут только
    // под /es (это свойство сайта, а не поиска).
    const es = probe(records, section, "es");
    const ru = probe(records, section, "ru");
    if (!es && !ru) {
      missing.push(section);
      continue;
    }
    if (es) probes.push(es);
    if (ru && ru.query !== es?.query) probes.push(ru);
  }
  return { probes, missing };
}

function evaluate(records: readonly SearchRecord[]): { ok: boolean; probes: Probe[]; reasons: string[] } {
  const { probes, missing } = runOnce(records);
  const reasons: string[] = [];
  for (const section of missing) reasons.push(`раздел «${section}» не дал ни одного объекта — индексу нечего искать`);
  for (const p of probes) if (!p.found) reasons.push(`раздел «${p.section}» (${p.lang}): «${p.query}» не найден`);
  return { ok: reasons.length === 0, probes, reasons };
}

function table(probes: Probe[]): string {
  const rows = probes.map((p) => [
    p.section,
    p.lang,
    p.query.length > 52 ? `${p.query.slice(0, 51)}…` : p.query,
    p.found ? "да" : "НЕТ",
    p.place === null ? "—" : String(p.place),
  ]);
  const header = ["раздел", "лок", "искал", "нашёл", "место"];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => [...r[i]].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [line(header), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)].join("\n");
}

async function main() {
  const plant = process.argv.includes("--plant");
  const target = process.env.TURSO_DATABASE_URL ? "Turso (боевая)" : (process.env.DATABASE_URL ?? "file:./dev.db");
  console.log(`База: ${target}`);

  const { loadSearchSources } = await import("../src/lib/search/sources");
  const { buildSearchRecords } = await import("../src/lib/search/records");
  const records = buildSearchRecords(await loadSearchSources());
  console.log(`Записей в индексе: ${records.length}`);

  const counts = new Map<SearchSection, number>();
  for (const r of records) counts.set(r.section, (counts.get(r.section) ?? 0) + 1);
  console.log(
    `По разделам: ${SEARCH_SECTIONS.map((s) => `${s}=${counts.get(s) ?? 0}`).join(", ")}\n`,
  );

  const result = evaluate(records);
  console.log(table(result.probes));

  // Отрицательный контроль: несуществующая строка обязана дать пустую
  // выдачу. Без него «нашлось» доказывало бы только то, что стенд
  // возвращает что попало.
  const empty = searchRecords(records, NONSENSE, { lang: "es", tier: "free", collapsedHrefs: collapsedHrefsFor("es") });
  const emptyRu = searchRecords(records, NONSENSE, { lang: "ru", tier: "free", collapsedHrefs: collapsedHrefsFor("ru") });
  const emptyOk = empty.total === 0 && emptyRu.total === 0;
  console.log(`\nОтрицательный контроль «${NONSENSE}»: es=${empty.total}, ru=${emptyRu.total} — ${emptyOk ? "ok" : "FAIL"}`);

  // Правило игр: сколько бы пазлов ни совпало, строк раздела игр в выдаче
  // ровно одна.
  const gameQueries = ["sopa de letras", "crucigrama", "филворд", "кроссворд"];
  let gameRuleOk = true;
  for (const q of gameQueries) {
    for (const lang of ["es", "ru"] as const) {
      const res = searchRecords(records, q, { lang, tier: "free", collapsedHrefs: collapsedHrefsFor(lang) });
      const gameRows = res.sections.filter((s) => s.section === "game").reduce((n, s) => n + (s.collapsed ? 1 : s.hits.length), 0);
      const matched = res.sections.find((s) => s.section === "game")?.total ?? 0;
      console.log(`Игры: «${q}» (${lang}) — совпало ${matched}, строк в выдаче ${gameRows}`);
      if (gameRows > 1) gameRuleOk = false;
    }
  }

  let failed = !result.ok || !emptyOk || !gameRuleOk;
  for (const reason of result.reasons) console.log(`FAIL — ${reason}`);

  if (plant) {
    // Подсадка: по очереди вырезаем каждый раздел и требуем, чтобы
    // проверка это заметила.
    console.log("\nПодсадка — вырезаю по одному разделу:");
    let caught = 0;
    for (const section of SEARCH_SECTIONS) {
      const without = records.filter((r) => r.section !== section);
      const check = evaluate(without);
      const noticed = !check.ok;
      console.log(`  ${noticed ? "ok  " : "FAIL"} без раздела «${section}» проверка ${noticed ? "краснеет" : "МОЛЧИТ"}`);
      if (noticed) caught++;
    }
    console.log(`\nПодсадка: ${caught} из ${SEARCH_SECTIONS.length}`);
    if (caught !== SEARCH_SECTIONS.length) failed = true;
  }

  if (failed) {
    console.log("\nFAIL");
    process.exit(1);
  }
  console.log("\nOK");
}

// Скрипт читает базу — он не должен начинаться оттого, что файл кто-то
// импортировал (правило 7.30).
if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
