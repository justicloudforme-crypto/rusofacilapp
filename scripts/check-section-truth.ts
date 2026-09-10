/**
 * Раздел обязан показывать то, что обещает о себе.
 *
 * ЗАЧЕМ. 10.09.2026 владелец открыл `/es/vocabulary/sinonimos-y-antonimos`
 * и увидел голый список слов. Описание раздела обещало другое: «Pares de
 * sinónimos y antónimos rusos…» — ПАРЫ. Пары при этом в базе были (247
 * карточек с синонимами и 225 с антонимами из 296), их не выводила
 * страница: в разметке не было ни одной ссылки на `card.synonyms` и
 * `card.antonyms`. То есть врало не описание, а страница.
 *
 * Этот класс расхождения не видит ни один прежний сторож: `check:layout`
 * смотрит на геометрию, `check:rendered` — на то, что страница вообще
 * отрисовалась, `check:intro-numbers` — на числа вводной деки. «Текст
 * обещает поле, которого разметка не печатает» проходит их все.
 *
 * ПРАВИЛО — то же, что у `check:legal-truth`, и такое же асимметричное:
 *
 *   если раздел ОБЕЩАЕТ показать что-то, разметка обязана это печатать;
 *   обратное правилом не является (страница вправе показывать больше,
 *   чем обещает).
 *
 * ДВЕ ПОЛОВИНЫ.
 *
 * 1. СТАТИЧЕСКАЯ (по умолчанию; ни сети, ни базы — стоит в `verify`/CI).
 *    Обещания берутся из ТЕКСТОВ (`vocabulary-categories.ts`, метаданные
 *    хаба), доказательства — из РАЗМЕТКИ соответствующей `page.tsx`.
 *
 * 2. ПО БАЗЕ (`--data`, боевые ключи). Обещание «у каждого слова
 *    транскрипция, перевод и фраза-пример» проверяется по строкам, а не
 *    по разметке, и отдельно считается, у скольких карточек раздела пар
 *    действительно нет.
 *
 * Запускать:
 *   npx tsx scripts/check-section-truth.ts
 *   npx tsx scripts/check-section-truth.ts --plant
 *   npx tsx scripts/check-section-truth.ts --data
 */
import { readFileSync } from "node:fs";
import { isEntryPoint } from "@/lib/entry-point";
import { VOCABULARY_CATEGORY_PAGES, PUBLIC_VOCABULARY_LEVELS } from "@/lib/vocabulary-categories";

const PLANT = process.argv.includes("--plant");
const DATA = process.argv.includes("--data");

const CATEGORY_PAGE = "src/app/[lang]/vocabulary/[categoria]/page.tsx";
const HUB_PAGE = "src/app/[lang]/vocabulary/page.tsx";

interface Promise_ {
  /** Где раздел это о себе говорит. */
  where: string;
  /** Что обещано — человеческими словами. */
  said: string;
  /** Чем доказывается, что это правда. */
  evidence: string;
  ok: boolean;
}

/** Обещание «пары синонимов и антонимов» в любом из текстов раздела. */
const PROMISES_PAIRS = /pares de sin[oó]nimos|sin[oó]nimos y ant[oó]nimos|su contrario|ant[oó]nimos/i;
/** Обещание транскрипции / перевода / фразы-примера. */
const PROMISES_TRANSCRIPTION = /transcripci[oó]n/i;
const PROMISES_TRANSLATION = /traducci[oó]n/i;
const PROMISES_EXAMPLE = /frase de ejemplo|ejemplo/i;

export function auditVocabularySection(categorySource: string, hubSource: string): Promise_[] {
  const out: Promise_[] = [];
  const printsSynonyms = /card\.synonyms/.test(categorySource);
  const printsAntonyms = /card\.antonyms/.test(categorySource);
  const printsTranscription = /card\.transcription/.test(categorySource);
  const printsTranslation = /card\.translationEs/.test(categorySource);
  const printsExample = /card\.exampleRu/.test(categorySource);

  for (const page of VOCABULARY_CATEGORY_PAGES) {
    const texts = [page.metaTitle, page.metaDescription, ...page.intro].join(" ");
    // Обещание пар считается только по НАЗВАНИЮ и ОПИСАНИЮ: вводный текст
    // любой темы вправе объяснять, что такое антоним, ничего не обещая.
    const headline = `${page.metaTitle} ${page.metaDescription} ${page.h1}`;
    if (PROMISES_PAIRS.test(headline)) {
      out.push({
        where: `/es/vocabulary/${page.slug} · title+description`,
        said: "показывает пары синонимов и антонимов",
        evidence: `${CATEGORY_PAGE}: card.synonyms ${printsSynonyms ? "печатается" : "НЕ печатается"}, card.antonyms ${printsAntonyms ? "печатается" : "НЕ печатается"}`,
        ok: printsSynonyms && printsAntonyms,
      });
    }
    if (PROMISES_TRANSCRIPTION.test(texts)) {
      out.push({
        where: `/es/vocabulary/${page.slug}`,
        said: "у каждого слова транскрипция",
        evidence: `${CATEGORY_PAGE}: card.transcription ${printsTranscription ? "печатается" : "НЕ печатается"}`,
        ok: printsTranscription,
      });
    }
    if (PROMISES_TRANSLATION.test(texts)) {
      out.push({
        where: `/es/vocabulary/${page.slug}`,
        said: "у каждого слова перевод на испанский",
        evidence: `${CATEGORY_PAGE}: card.translationEs ${printsTranslation ? "печатается" : "НЕ печатается"}`,
        ok: printsTranslation,
      });
    }
    if (PROMISES_EXAMPLE.test(texts)) {
      out.push({
        where: `/es/vocabulary/${page.slug}`,
        said: "у каждого слова фраза-пример",
        evidence: `${CATEGORY_PAGE}: card.exampleRu ${printsExample ? "печатается" : "НЕ печатается"}`,
        ok: printsExample,
      });
    }
  }

  // Хаб называет ЧИСЛО списков. Оно обязано совпасть с таблицей.
  const claimed = [...hubSource.matchAll(/(\d+)\s+listas/g)].map((m) => Number(m[1]));
  for (const n of claimed) {
    out.push({
      where: `${HUB_PAGE} · «${n} listas»`,
      said: `списков ровно ${n}`,
      evidence: `VOCABULARY_CATEGORY_PAGES.length = ${VOCABULARY_CATEGORY_PAGES.length}`,
      ok: n === VOCABULARY_CATEGORY_PAGES.length,
    });
  }
  if (claimed.length === 0) {
    out.push({
      where: `${HUB_PAGE}`,
      said: "хаб называет число списков",
      evidence: "ни одного «N listas» в исходнике",
      ok: false,
    });
  }
  return out;
}

function report(rows: Promise_[]): number {
  const broken = rows.filter((r) => !r.ok);
  const bySaid = new Map<string, { total: number; broken: number }>();
  for (const r of rows) {
    const b = bySaid.get(r.said) ?? { total: 0, broken: 0 };
    b.total += 1;
    if (!r.ok) b.broken += 1;
    bySaid.set(r.said, b);
  }
  console.log("[check:section-truth] обещано → правда ли:");
  for (const [said, b] of [...bySaid].sort()) {
    console.log(`  ${b.broken === 0 ? "✓" : "✗"} ${said.padEnd(48)} мест ${String(b.total).padStart(3)}  расходится ${b.broken}`);
  }
  for (const r of broken.slice(0, 10)) console.log(`    ✗ ${r.where}: обещано «${r.said}», доказательство: ${r.evidence}`);
  if (broken.length > 10) console.log(`    …и ещё ${broken.length - 10}`);
  return broken.length;
}

function plant(): void {
  console.log("[check:section-truth] ПОДСАДКА: из разметки убраны обе строки card.synonyms/card.antonyms");
  const source = readFileSync(CATEGORY_PAGE, "utf8")
    .replaceAll("card.synonyms", "card.__planted_away__")
    .replaceAll("card.antonyms", "card.__planted_away__");
  const rows = auditVocabularySection(source, readFileSync(HUB_PAGE, "utf8"));
  const broken = report(rows);
  if (broken === 0) {
    console.error("ПОДСАДКА НЕ НАЙДЕНА — проверка не умеет находить то, ради чего заведена");
    process.exitCode = 1;
    return;
  }
  console.log(`подсадка найдена: расхождений ${broken} — проверка работает`);
}

async function data(): Promise<void> {
  const { getFlashcardIndex } = await import("@/lib/flashcards/cache");
  const index = await getFlashcardIndex();
  const publicLevels = new Set<string>(PUBLIC_VOCABULARY_LEVELS);
  console.log("[check:section-truth] по боевой базе: у скольких слов раздела есть обещанное:");
  let broken = 0;
  for (const page of VOCABULARY_CATEGORY_PAGES) {
    const cards = index.filter((c) => c.category === page.category && publicLevels.has(c.level));
    const missing = cards.filter((c) => !c.transcription || !c.translationEs || !c.exampleRu || !c.exampleEs).length;
    const pairs = cards.filter((c) => c.synonyms.length > 0 || c.antonyms.length > 0).length;
    const promisesPairs = PROMISES_PAIRS.test(`${page.metaTitle} ${page.metaDescription} ${page.h1}`);
    const bad = missing > 0 || (promisesPairs && pairs === 0);
    if (bad) broken += 1;
    console.log(
      `  ${bad ? "✗" : "✓"} ${page.slug.padEnd(26)} слов ${String(cards.length).padStart(4)}  без обещанного ${String(missing).padStart(3)}  с парой ${String(pairs).padStart(4)}${promisesPairs ? "  (пары обещаны)" : ""}`,
    );
  }
  if (broken) process.exitCode = 1;
}

async function main(): Promise<void> {
  if (PLANT) return plant();
  if (DATA) return data();
  const broken = report(auditVocabularySection(readFileSync(CATEGORY_PAGE, "utf8"), readFileSync(HUB_PAGE, "utf8")));
  if (broken) process.exitCode = 1;
  else console.log("  ни одно обещание раздела не расходится с разметкой (контроль — --plant)");
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
