/**
 * Значок платности не обещает открытым то, что закрыто.
 *
 * ЗАЧЕМ. 07.09.2026 значки свели к одному признаку
 * (`src/lib/access-marks.ts`), и каталоги перестали врать. Но у сайта
 * есть ВТОРАЯ поверхность, которая печатает ту же пометку, — окно
 * поиска, — и она осталась со своим словарём из двух слов и со своей
 * копией правила у каждого раздела. Замер 09.09.2026 по настоящей базе:
 *
 *   пазлов        3277, индекс печатал «открыт» 2293, открыто анониму 83
 *                 → 2210 строк обещали открытое, будучи закрытыми;
 *   карточек      5771, индекс печатал «открыта» 4783, открыто анониму 230
 *                 → 4553 строки того же рода.
 *
 * ПРАВИЛО, которое держит этот сторож, — асимметричное, и асимметрия
 * здесь не поблажка, а признание того, чем бесплатность бывает:
 *
 *   1. Запись, помеченная «открыто» (`requires: "free"`), ОБЯЗАНА быть
 *      открыта анониму на самом деле. Проверяется не тем же выражением,
 *      каким пометка ставится, а правилом бесплатного образца —
 *      `isFreeWordGamePuzzle`, `isFreeTrialLesson`, колонкой
 *      `MediaItem.free`, колонкой `Story.isPremium`. Это другой код и
 *      другой путь; совпадения между ними никто не подпирает.
 *   2. Обратное — не падение, а число в отчёте. У карточек и идиом
 *      бесплатность ПОЗИЦИОННАЯ: открыты первые N в списке, а не строки
 *      с каким-то свойством. Про отдельную строку сказать «она в
 *      образце» нельзя, поэтому признак у них всегда «по подписке», и
 *      230 карточек из 5771 носят значок, хотя аноним их откроет. Это
 *      перестраховка в безопасную сторону; враньё было в другую.
 *
 * Запускать:
 *   npx tsx scripts/check-mark-truth.ts            # гейт
 *   npx tsx scripts/check-mark-truth.ts --plant    # позитивный контроль
 *
 * `--plant` базы не трогает вовсе: он строит заведомо здоровый индекс из
 * шести строк в памяти, портит по одной, и требует, чтобы каждая порча
 * была поймана, а здоровый индекс — молчал.
 */
import { buildSearchRecords, type SearchSources } from "@/lib/search/records";
import { isFreeWordGamePuzzle } from "@/lib/word-games/free-tier";
import { isFreeTrialLesson } from "@/lib/courses";
import type { SearchRecord } from "@/lib/search/types";
import { isEntryPoint } from "@/lib/entry-point";

const PLANT = process.argv.includes("--plant");

/** Разделы, у которых бесплатность — свойство СТРОКИ, а не позиции. */
type CheckableSection = "game" | "lesson" | "media" | "story";

interface Violation {
  section: string;
  id: string;
  said: string;
  really: string;
}

/**
 * Открыт ли объект анониму на самом деле — по правилу бесплатного
 * образца, а не по тому выражению, которым ставится пометка.
 *
 * `null` — «у этого раздела независимой проверки нет» (позиционная
 * бесплатность карточек и идиом, страницы без платности вовсе).
 */
function reallyOpenToAnonymous(record: SearchRecord, sources: SearchSources): boolean | null {
  switch (record.section as CheckableSection | string) {
    case "game": {
      const [type, level, sequence] = record.id.split("/");
      const puzzle = sources.puzzles.find(
        (p) => p.type === type && p.level === level && p.sequence === Number(sequence),
      );
      if (!puzzle) return null;
      // Платному по любой причине — не бесплатен, что бы ни говорил номер.
      if (puzzle.premiumOnly || puzzle.curved) return false;
      return isFreeWordGamePuzzle(puzzle);
    }
    case "lesson": {
      const [level, slug] = record.id.split("-");
      if (!level || !slug) return null;
      return isFreeTrialLesson(level, slug);
    }
    case "media": {
      const item = sources.media.find((m) => m.id === record.id);
      return item ? Boolean(item.free) : null;
    }
    case "story": {
      const story = sources.stories.find((s) => s.id === record.id);
      return story ? !story.isPremium : null;
    }
    default:
      return null;
  }
}

interface Report {
  checked: number;
  violations: Violation[];
  /** Строки, у которых значок есть, а аноним их всё же откроет. Не
   * падение — см. правило 2 в шапке. */
  overCautious: number;
  bySection: Map<string, { free: number; subscription: number; premiumTier: number }>;
}

export function auditRecords(records: readonly SearchRecord[], sources: SearchSources): Report {
  const violations: Violation[] = [];
  const bySection = new Map<string, { free: number; subscription: number; premiumTier: number }>();
  let checked = 0;
  let overCautious = 0;
  for (const record of records) {
    const requirement = record.requires ?? "free";
    const bucket = bySection.get(record.section) ?? { free: 0, subscription: 0, premiumTier: 0 };
    if (requirement === "free") bucket.free += 1;
    else if (requirement === "subscription") bucket.subscription += 1;
    else bucket.premiumTier += 1;
    bySection.set(record.section, bucket);

    const open = reallyOpenToAnonymous(record, sources);
    if (open === null) continue;
    checked += 1;
    if (requirement === "free" && !open) {
      violations.push({
        section: record.section,
        id: record.id,
        said: "открыто всем",
        really: "нужна подписка или план Premium",
      });
    }
    if (requirement !== "free" && open) overCautious += 1;
  }
  return { checked, violations, overCautious, bySection };
}

/** Заведомо здоровый индекс из шести строк — основа позитивного контроля. */
function healthyFixture(): { records: SearchRecord[]; sources: SearchSources } {
  const sources = {
    dictionaries: {} as SearchSources["dictionaries"],
    exams: [],
    stories: [
      { id: "s-free", title: "Репка", titleEs: null, level: "A1", isPremium: false, premiumOnly: false },
      { id: "s-paid", title: "Тихий Дон", titleEs: null, level: "C1", isPremium: true, premiumOnly: true },
    ],
    media: [
      { id: "m-free", title: "Катюша", level: "A1", free: true },
      { id: "m-paid", title: "Ирония судьбы", level: "B2", free: false },
    ],
    flashcards: [],
    idioms: [],
    glossary: [],
    puzzles: [
      { type: "WORD_SEARCH", level: "A1", sequence: 1, topic: null, wordCount: 10, premiumOnly: false, curved: false },
      { type: "WORD_SEARCH", level: "A1", sequence: 300, topic: null, wordCount: 10, premiumOnly: false, curved: false },
    ],
  } as unknown as SearchSources;

  const records: SearchRecord[] = [
    { section: "story", id: "s-free", path: "/stories/s-free", title: "Репка", requires: "free" },
    { section: "story", id: "s-paid", path: "/stories/s-paid", title: "Тихий Дон", requires: "premium-tier" },
    { section: "media", id: "m-free", path: "/media/m-free", title: "Катюша", requires: "free" },
    { section: "media", id: "m-paid", path: "/media/m-paid", title: "Ирония судьбы", requires: "subscription" },
    {
      section: "game",
      id: "WORD_SEARCH/A1/1",
      path: "/word-games/WORD_SEARCH/A1/1",
      title: "Sopa 1",
      requires: "free",
    },
    {
      section: "game",
      id: "WORD_SEARCH/A1/300",
      path: "/word-games/WORD_SEARCH/A1/300",
      title: "Sopa 300",
      requires: "subscription",
    },
    { section: "lesson", id: "a1-1", path: "/courses/a1/1", title: "Урок 1", requires: "free" },
    { section: "lesson", id: "a1-2", path: "/courses/a1/2", title: "Урок 2", requires: "subscription" },
  ];
  return { records, sources };
}

function plant(): number {
  const cases: Array<{ name: string; mutate: (r: SearchRecord[]) => void }> = [
    {
      name: "платный пазл объявлен открытым (тот самый класс: 2210 из 3277)",
      mutate: (r) => {
        r.find((x) => x.id === "WORD_SEARCH/A1/300")!.requires = "free";
      },
    },
    {
      name: "★/premiumOnly пазл объявлен открытым",
      mutate: (r) => {
        r.push({
          section: "game",
          id: "WORD_SEARCH/A1/301",
          path: "/word-games/WORD_SEARCH/A1/301",
          title: "Sopa 301",
          requires: "free",
        });
      },
    },
    {
      name: "второй урок уровня объявлен открытым",
      mutate: (r) => {
        r.find((x) => x.id === "a1-2")!.requires = "free";
      },
    },
    {
      name: "платное медиа объявлено открытым",
      mutate: (r) => {
        r.find((x) => x.id === "m-paid")!.requires = "free";
      },
    },
    {
      name: "платный рассказ объявлен открытым",
      mutate: (r) => {
        r.find((x) => x.id === "s-paid")!.requires = "free";
      },
    },
    {
      name: "поле requires снято совсем — отсутствие читается как «открыто»",
      mutate: (r) => {
        delete r.find((x) => x.id === "s-paid")!.requires;
      },
    },
  ];

  let caught = 0;
  for (const c of cases) {
    const { records, sources } = healthyFixture();
    if (c.name.includes("★/premiumOnly")) {
      (sources.puzzles as Array<Record<string, unknown>>).push({
        type: "WORD_SEARCH",
        level: "A1",
        sequence: 301,
        topic: null,
        wordCount: 10,
        premiumOnly: true,
        curved: true,
      });
    }
    c.mutate(records);
    const report = auditRecords(records, sources);
    const ok = report.violations.length >= 1;
    if (ok) caught += 1;
    console.log(`  ${ok ? "поймано" : "ПРОПУЩЕНО"}: ${c.name}`);
  }

  // Отрицательный контроль: здоровый индекс обязан молчать. Без него
  // «поймано 6 из 6» доказывало бы только то, что сторож всегда красный.
  const healthy = healthyFixture();
  const quiet = auditRecords(healthy.records, healthy.sources);
  const quietOk = quiet.violations.length === 0;
  console.log(`  ${quietOk ? "молчит" : "ЛОЖНАЯ ТРЕВОГА"}: здоровый индекс, проверено ${quiet.checked} строк`);
  console.log(`подсажено ${cases.length}, поймано ${caught} из ${cases.length}; отрицательный контроль ${quietOk ? "1 из 1" : "0 из 1"}`);
  return caught === cases.length && quietOk ? 0 : 1;
}

async function main(): Promise<number> {
  if (PLANT) return plant();

  const { loadSearchSources } = await import("@/lib/search/sources");
  const sources = await loadSearchSources();
  const records = buildSearchRecords(sources);
  const report = auditRecords(records, sources);

  console.log("[check:mark-truth] что требует каждая запись индекса:");
  for (const [section, b] of [...report.bySection].sort()) {
    console.log(
      `  ${section.padEnd(16)} открыто ${String(b.free).padStart(5)}  по подписке ${String(b.subscription).padStart(5)}  план Premium ${String(b.premiumTier).padStart(5)}`,
    );
  }
  console.log(
    `\nстрок с независимой проверкой бесплатности: ${report.checked}; ` +
      `значок стоит, хотя аноним откроет (позиционная бесплатность, не падение): ${report.overCautious}`,
  );

  if (report.checked === 0) {
    console.error(
      "проверять нечего: в этой базе нет ни рассказов, ни пазлов, ни уроков. " +
        "«Нарушений 0» на пустом множестве результатом не считается (PROGRESS.md 4.1).",
    );
    return 1;
  }

  if (report.violations.length) {
    console.error(`\nЗНАЧОК ОБЕЩАЕТ ОТКРЫТОЕ, А ОНО ЗАКРЫТО — ${report.violations.length} шт.:`);
    for (const v of report.violations.slice(0, 20)) {
      console.error(`  ${v.section} ${v.id}: сказано «${v.said}», на самом деле ${v.really}`);
    }
    if (report.violations.length > 20) console.error(`  …и ещё ${report.violations.length - 20}`);
    return 1;
  }
  console.log("нарушений 0 (контроль — npx tsx scripts/check-mark-truth.ts --plant).");
  return 0;
}

// Только когда этот файл — точка входа процесса: импорт его запускать не
// должен (см. src/lib/entry-point.ts и инцидент 29.08.2026).
if (isEntryPoint(import.meta.url)) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
