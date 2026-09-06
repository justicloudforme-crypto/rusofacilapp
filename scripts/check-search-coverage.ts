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
 * Против ЖИВОГО сайта — `--base=https://rusofacilapp.com`. В этом режиме
 * индекс по-прежнему собирается локально (чтобы знать, какие объекты
 * вообще существуют и как они называются), но ИЩЕТ не он: точное название
 * каждого представителя уходит в `/api/search` живого сайта, и от него
 * требуется найти объект. Плюс перепись: у шести разделов из двенадцати
 * есть строка, совпадающая со ВСЕМИ их записями (проверяется локально на
 * каждом прогоне), и по ней у живого сайта спрашивается размер раздела.
 * Остальные шесть перепись честно оставляет пустыми, а не выдумывает
 * число — см. таблицу CENSUS_PROBES.
 *
 * Зачем это понадобилось: 06.09.2026 (7.129) выяснилось, что против прода
 * эта проверка не запускается вовсе — она читает базу, а боевых кредов
 * Turso в рабочем окружении нет и по правилу проекта быть не должно. То
 * есть «12 из 12» относилось к локальной копии, а прод не был замерен ни
 * разу.
 *
 *   npx tsx scripts/check-search-coverage.ts
 *   npx tsx scripts/check-search-coverage.ts --plant
 *   npx tsx scripts/check-search-coverage.ts --base=https://rusofacilapp.com
 */
import { isEntryPoint } from "../src/lib/entry-point";
import { searchRecords, hrefFor, titleOf } from "../src/lib/search/match";
import { collapsedHrefsFor } from "../src/lib/search/query";
import {
  SEARCH_SECTIONS,
  COLLAPSED_SECTIONS,
  type SearchRecord,
  type SearchResponse,
  type SearchSection,
} from "../src/lib/search/types";
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

/**
 * Что живой сайт отвечает на строку. Единственное место, где скрипт ходит
 * в сеть.
 */
async function askLive(base: string, query: string, lang: Locale): Promise<SearchResponse> {
  const url = `${base.replace(/\/$/, "")}/api/search?q=${encodeURIComponent(query)}&lang=${lang}`;
  const response = await fetch(url, { headers: { "user-agent": "check-search-coverage" } });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return (await response.json()) as SearchResponse;
}

/**
 * Перепись разделов на живом сайте.
 *
 * Ключ — строка, совпадающая со ВСЕМИ записями раздела. У шести разделов
 * такой строки нет вовсе (у рассказа, песни, идиомы и термина глоссария
 * название — собственное имя, общей подстроки у них не бывает), и здесь
 * стоит `null`: перепись печатает прочерк, а не выдуманное число.
 *
 * Каждая непустая строка ПРОВЕРЯЕТСЯ на локальном индексе на каждом
 * прогоне: если она перестала совпадать со всеми, прогон краснеет. Иначе
 * перепись начала бы молча занижать размер раздела при первой же правке
 * шаблона названия.
 */
const CENSUS_PROBES: Record<SearchSection, { query: string; lang: Locale } | null> = {
  page: { query: "/es", lang: "es" },
  lesson: { query: "lección", lang: "es" },
  exam: { query: "examen", lang: "es" },
  flashcard: { query: "—", lang: "es" },
  alphabet: { query: "alfabeto", lang: "es" },
  game: { query: "en ruso", lang: "es" },
  story: null,
  media: null,
  idiom: null,
  glossary: null,
  grammar: null,
  vocabularyTopic: null,
};

function sectionTotal(response: SearchResponse, section: SearchSection): number {
  return response.sections.find((s) => s.section === section)?.total ?? 0;
}

/**
 * Место первой строки нужного раздела в плоской выдаче, считая с 1.
 * Свёрнутый раздел занимает ровно одну строку.
 *
 * Сверка идёт по НАЗВАНИЮ, а не по `id` строки, и это не небрежность.
 * Замер 06.09.2026: у 315 рассказов из 325 `id` в локальной `dev.db` и на
 * проде РАЗНЫЕ (совпадают 10) — это разные вставки одного содержимого, а
 * не одна база. Вопрос, который задаёт эта проверка, — «находит ли живой
 * сайт объект с таким названием», а не «лежит ли у него строка с таким
 * первичным ключом»; сверка по `id` отвечала бы «НЕТ» на здоровый сайт.
 */
function placeOf(response: SearchResponse, section: SearchSection, title: string | null): number | null {
  let place = 0;
  for (const s of response.sections) {
    if (s.collapsed) {
      place += 1;
      if (s.section === section) return place;
      continue;
    }
    for (const hit of s.hits) {
      place += 1;
      if (hit.section === section && (title === null || hit.title === title)) return place;
    }
  }
  return null;
}

/** Совпал ли у живого сайта `id` строки с локальным. Не приговор, а
 * сведение: расхождение означает, что локальная копия — другая вставка
 * того же содержимого, и адрес объекта локально другой. */
function liveIdOf(response: SearchResponse, section: SearchSection, title: string): string | null {
  for (const s of response.sections) {
    for (const hit of s.hits) if (hit.section === section && hit.title === title) return hit.id;
  }
  return null;
}

async function runAgainstLive(base: string, records: readonly SearchRecord[], plant: boolean): Promise<boolean> {
  console.log(`\nЖивой сайт: ${base}\n`);
  let failed = false;
  const rows: string[][] = [];
  const idDrift: string[] = [];
  const sectionsProbed = new Set<SearchSection>();
  const sectionsSurvived = new Set<SearchSection>();

  for (const section of SEARCH_SECTIONS) {
    for (const lang of ["es", "ru"] as Locale[]) {
      const record = representative(records, section, lang);
      if (!record) continue;
      const realQuery = titleOf(record, lang);
      // Подсадка для живого режима: вырезать раздел из чужого индекса
      // нечем, но можно подменить строку заведомо ненаходимой — и тогда
      // КАЖДЫЙ раздел обязан покраснеть. Зелёный прогон с `--base-plant`
      // означал бы, что проверка не умеет находить проблему.
      const query = plant ? NONSENSE : realQuery;
      // Одна и та же строка в обеих локалях спрашивается один раз.
      if (lang === "ru" && realQuery === titleOf(representative(records, section, "es") ?? record, "es")) {
        const es = rows.find((r) => r[0] === section && r[1] === "es");
        if (es) continue;
      }
      const response = await askLive(base, query, lang);
      const total = sectionTotal(response, section);
      const collapsed = COLLAPSED_SECTIONS.includes(section);
      const place = placeOf(response, section, collapsed ? null : query);
      const found = total > 0 && (collapsed || place !== null);
      rows.push([section, lang, query.length > 52 ? `${query.slice(0, 51)}…` : query, found ? "да" : "НЕТ", place === null ? "—" : String(place)]);
      if (plant) sectionsProbed.add(section);
      if (plant && found) sectionsSurvived.add(section);
      if (!found) {
        failed = true;
        console.log(`FAIL — раздел «${section}» (${lang}): «${query}» на живом сайте не найден`);
      }
      if (!collapsed && found) {
        const liveId = liveIdOf(response, section, query);
        if (liveId && liveId !== record.id) idDrift.push(`${section}/${lang}: локально «${record.id}», на живом «${liveId}»`);
      }
    }
  }

  const header = ["раздел", "лок", "искал", "нашёл", "место"];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => [...r[i]].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log([line(header), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)].join("\n"));

  if (plant) {
    const caught = sectionsProbed.size - sectionsSurvived.size;
    console.log(`\nПодсадка ненаходимой строки: покраснело ${caught} из ${sectionsProbed.size} разделов`);
    // В этом режиме красный — это успех, поэтому вердикт переворачивается.
    return caught === sectionsProbed.size && sectionsProbed.size === SEARCH_SECTIONS.length;
  }

  if (idDrift.length > 0) {
    // Не провал: сайт находит объект по его названию, а это и есть
    // вопрос проверки. Но знать об этом надо — локальные адреса таких
    // объектов не те же, что боевые.
    console.log(`\nid строк разошлись у ${idDrift.length} представителей — локальная копия это другая вставка того же содержимого:`);
    for (const line of idDrift) console.log(`  ${line}`);
  }

  // Отрицательный контроль на живом сайте.
  const emptyEs = await askLive(base, NONSENSE, "es");
  const emptyRu = await askLive(base, NONSENSE, "ru");
  const emptyOk = emptyEs.total === 0 && emptyRu.total === 0;
  console.log(`\nОтрицательный контроль «${NONSENSE}»: es=${emptyEs.total}, ru=${emptyRu.total} — ${emptyOk ? "ok" : "FAIL"}`);
  if (!emptyOk) failed = true;

  // Правило игр на живом сайте.
  for (const q of ["sopa de letras", "crucigrama", "филворд", "кроссворд"]) {
    for (const lang of ["es", "ru"] as Locale[]) {
      const res = await askLive(base, q, lang);
      const gameRows = res.sections.filter((s) => s.section === "game").reduce((n, s) => n + (s.collapsed ? 1 : s.hits.length), 0);
      console.log(`Игры: «${q}» (${lang}) — совпало ${sectionTotal(res, "game")}, строк в выдаче ${gameRows}`);
      if (gameRows > 1) failed = true;
    }
  }

  // Перепись: сколько записей в каждом разделе у живого сайта против
  // локальной копии.
  console.log("\nПерепись разделов (живой сайт против локального индекса):");
  const localCounts = new Map<SearchSection, number>();
  for (const r of records) localCounts.set(r.section, (localCounts.get(r.section) ?? 0) + 1);
  let liveTotal = 0;
  let censusComplete = true;
  for (const section of SEARCH_SECTIONS) {
    const probe = CENSUS_PROBES[section];
    const local = localCounts.get(section) ?? 0;
    if (!probe) {
      censusComplete = false;
      console.log(`  ${section.padEnd(16)} локально ${String(local).padStart(5)}  живой     —  (строки, совпадающей со всеми записями раздела, не существует)`);
      continue;
    }
    // Самопроверка строки на локальном индексе — без неё число живого
    // сайта нечем читать.
    const localResponse = searchRecords(records, probe.query, {
      lang: probe.lang,
      tier: "free",
      collapsedHrefs: collapsedHrefsFor(probe.lang),
    });
    const localMatched = sectionTotal(localResponse, section);
    if (localMatched !== local) {
      failed = true;
      console.log(`FAIL — строка переписи «${probe.query}» совпала локально с ${localMatched} из ${local} записей раздела «${section}»`);
      continue;
    }
    const live = sectionTotal(await askLive(base, probe.query, probe.lang), section);
    liveTotal += live;
    const delta = live - local;
    console.log(`  ${section.padEnd(16)} локально ${String(local).padStart(5)}  живой ${String(live).padStart(5)}  ${delta === 0 ? "совпало" : (delta > 0 ? `+${delta}` : String(delta))}`);
  }
  if (!censusComplete) {
    console.log("  (перепись неполная по построению — итога по всему индексу здесь нет и быть не может)");
  }

  return !failed;
}

async function main() {
  const plant = process.argv.includes("--plant");
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  const basePlant = process.argv.includes("--base-plant");
  const base = baseArg ? baseArg.slice("--base=".length) : null;
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

  // Против живого сайта — отдельный режим: ищет ОН, а локальный индекс
  // только называет, что искать. Подсадка здесь не применима: вырезать
  // раздел из чужого индекса нечем, и делать вид, что применима, нельзя.
  if (base) {
    if (plant) {
      console.log("\n--plant с --base не работает: вырезать раздел из индекса живого сайта нечем. Есть --base-plant.");
      process.exit(1);
    }
    const ok = await runAgainstLive(base, records, basePlant);
    console.log(ok ? "\nOK" : "\nFAIL");
    process.exit(ok ? 0 : 1);
  }

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
