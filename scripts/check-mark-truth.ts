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
 *   2. Обратное — не падение, а число в отчёте: у рассказов, пазлов,
 *      уроков и медиа его сегодня 0.
 *   3. КАРТОЧКИ И ИДИОМЫ — В ОБЕ СТОРОНЫ (7.294, долг 104). Их
 *      бесплатность ПОЗИЦИОННАЯ: открыты первые N в порядке выдачи, а не
 *      строки с каким-то свойством. До 7.294 индекс этого не знал, ставил
 *      «по подписке» всем, и 230 карточек из 5771 и 4 идиомы носили 🔒,
 *      хотя аноним их откроет, — а сторож эти два рода не проверял вовсе.
 *      Теперь правда считается здесь повтором выдачи для анонима: у
 *      карточек — срез `GET /api/flashcards` по теме (первые
 *      `FREE_TRIAL_LIMITS.flashcards` в порядке `createdAt`, без C1),
 *      написанный в этом файле заново, а не взятый у `openCardIds`, которым
 *      пометку ставит индекс; у идиом — те функции, которые зовёт сам
 *      маршрут `GET /api/idioms`. Падение — в любую сторону: «открыто» на
 *      закрытом И 🔒 на открытом. Корона на открытой анониму `literary` —
 *      не падение: 👑 — сорт материала, и вкладка печатает её так же.
 *
 * Запускать:
 *   npx tsx scripts/check-mark-truth.ts            # гейт
 *   npx tsx scripts/check-mark-truth.ts --plant    # позитивный контроль
 *
 * `--plant` базы не трогает вовсе: он строит заведомо здоровый индекс в
 * памяти, портит по одной, и требует, чтобы каждая порча
 * была поймана, а здоровый индекс — молчал.
 */
import { buildSearchRecords, type SearchSources } from "@/lib/search/records";
import { isFreeWordGamePuzzle } from "@/lib/word-games/free-tier";
import { isFreeTrialLesson } from "@/lib/courses";
import type { SearchRecord } from "@/lib/search/types";
import { isEntryPoint } from "@/lib/entry-point";
import { FREE_TRIAL_LIMITS, LITERARY_IDIOM_LIMITS } from "@/lib/free-trial-limits";
import { buildFreeIdiomSample, capLiteraryIdioms } from "@/lib/idioms/free-sample";

const PLANT = process.argv.includes("--plant");

/** Разделы, у которых бесплатность — свойство СТРОКИ, а не позиции. */
type CheckableSection = "game" | "lesson" | "media" | "story" | "flashcard" | "idiom";

/** Разделы с позиционной бесплатностью — проверяются в обе стороны (правило 3). */
const POSITIONAL = new Set(["flashcard", "idiom"]);

/**
 * Что аноним получает от `GET /api/flashcards` и `GET /api/idioms` — повтор
 * выдачи, а не вызов того, чем индекс ставит пометку. Источники обязаны
 * прийти в порядке выдачи (`createdAt` по возрастанию; `loadSearchSources`).
 */
function anonymousOpenSets(sources: SearchSources): { cards: Set<string>; idioms: Set<string> } {
  const cards = new Set<string>();
  const taken = new Map<string, number>();
  for (const card of sources.flashcards) {
    if (card.level === "C1") continue; // canAccessLevel("free", "C1") === false
    const n = taken.get(card.category) ?? 0;
    if (n >= FREE_TRIAL_LIMITS.flashcards) continue;
    taken.set(card.category, n + 1);
    cards.add(card.id);
  }
  // Ровно цепочка маршрута для тарифа free без фильтра категории.
  const accessible = sources.idioms.filter((idiom) => idiom.level !== "C1");
  const sample = capLiteraryIdioms(buildFreeIdiomSample(accessible, FREE_TRIAL_LIMITS.idioms), LITERARY_IDIOM_LIMITS.free);
  return { cards, idioms: new Set(sample.map((idiom) => idiom.id)) };
}

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
function reallyOpenToAnonymous(
  record: SearchRecord,
  sources: SearchSources,
  open: { cards: Set<string>; idioms: Set<string> },
): boolean | null {
  switch (record.section as CheckableSection | string) {
    case "flashcard":
      return sources.flashcards.some((c) => c.id === record.id) ? open.cards.has(record.id) : null;
    case "idiom":
      return sources.idioms.some((i) => i.id === record.id) ? open.idioms.has(record.id) : null;
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
  const openSets = anonymousOpenSets(sources);
  for (const record of records) {
    const requirement = record.requires ?? "free";
    const bucket = bySection.get(record.section) ?? { free: 0, subscription: 0, premiumTier: 0 };
    if (requirement === "free") bucket.free += 1;
    else if (requirement === "subscription") bucket.subscription += 1;
    else bucket.premiumTier += 1;
    bySection.set(record.section, bucket);

    const open = reallyOpenToAnonymous(record, sources, openSets);
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
    if (requirement !== "free" && open) {
      // Правило 3: у карточек и идиом 🔒 на открытом — падение (долг 104).
      // Корона-сорт на открытой анониму фразе `literary` — нет.
      if (POSITIONAL.has(record.section) && requirement === "subscription") {
        violations.push({
          section: record.section,
          id: record.id,
          said: "по подписке (🔒)",
          really: "открыто анониму — бесплатный образец",
        });
      } else {
        overCautious += 1;
      }
    }
  }
  return { checked, violations, overCautious, bySection };
}

/** Заведомо здоровый индекс — основа позитивного контроля. */
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
    // Тема «food»: 11 карточек A1 (первые 10 — образец, 11-я — нет) и одна
    // C1 ПЕРВОЙ по порядку — образец обязан её пропустить, а не съесть ею
    // место. Идиомы: по кругу daily, proverbs, literary → образец d1, p1,
    // l1, d2, p2; d3 и l2 — закрыты.
    flashcards: [
      { id: "fc-c1", russian: "x", translationEs: "x", transcription: "x", category: "food", level: "C1" },
      ...Array.from({ length: 11 }, (_, i) => ({
        id: `fc-${i + 1}`,
        russian: "x",
        translationEs: "x",
        transcription: "x",
        category: "food",
        level: "A1",
      })),
    ],
    idioms: [
      { id: "d1", phrase: "x", spanishEquivalent: "x", level: "A2", category: "daily" },
      { id: "d2", phrase: "x", spanishEquivalent: "x", level: "A2", category: "daily" },
      { id: "d3", phrase: "x", spanishEquivalent: "x", level: "A2", category: "daily" },
      { id: "p1", phrase: "x", spanishEquivalent: "x", level: "A2", category: "proverbs" },
      { id: "p2", phrase: "x", spanishEquivalent: "x", level: "A2", category: "proverbs" },
      { id: "l1", phrase: "x", spanishEquivalent: "x", level: "A2", category: "literary" },
      { id: "l2", phrase: "x", spanishEquivalent: "x", level: "A2", category: "literary" },
    ],
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
    { section: "flashcard", id: "fc-c1", path: "/vocabulary", title: "x", requires: "premium-tier" },
    ...Array.from({ length: 11 }, (_, i): SearchRecord => ({
      section: "flashcard",
      id: `fc-${i + 1}`,
      path: "/vocabulary",
      title: "x",
      requires: i < 10 ? "free" : "subscription",
    })),
    ...(["d1", "d2", "p1", "p2"] as const).map((id): SearchRecord => ({ section: "idiom", id, path: "/vocabulary", title: "x", requires: "free" })),
    { section: "idiom", id: "d3", path: "/vocabulary", title: "x", requires: "subscription" },
    // Корона-сорт на открытой анониму `literary` — здоровое состояние.
    { section: "idiom", id: "l1", path: "/vocabulary", title: "x", requires: "premium-tier" },
    { section: "idiom", id: "l2", path: "/vocabulary", title: "x", requires: "premium-tier" },
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
      name: "карточка из бесплатного образца под замком (долг 104: 230 из 5771)",
      mutate: (r) => {
        r.find((x) => x.id === "fc-3")!.requires = "subscription";
      },
    },
    {
      name: "11-я карточка темы объявлена открытой (образец больше 10)",
      mutate: (r) => {
        r.find((x) => x.id === "fc-11")!.requires = "free";
      },
    },
    {
      name: "карточка C1 объявлена открытой",
      mutate: (r) => {
        r.find((x) => x.id === "fc-c1")!.requires = "free";
      },
    },
    {
      name: "идиома из образца под замком (долг 104: 4 из 771)",
      mutate: (r) => {
        r.find((x) => x.id === "p2")!.requires = "subscription";
      },
    },
    {
      name: "идиома вне образца объявлена открытой",
      mutate: (r) => {
        r.find((x) => x.id === "d3")!.requires = "free";
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
      `значок стоит, хотя аноним откроет (корона-сорт у фразы literary из образца, не падение): ${report.overCautious}`,
  );

  if (report.checked === 0) {
    console.error(
      "проверять нечего: в этой базе нет ни рассказов, ни пазлов, ни уроков. " +
        "«Нарушений 0» на пустом множестве результатом не считается (PROGRESS.md 4.1).",
    );
    return 1;
  }

  if (report.violations.length) {
    console.error(`\nЗНАЧОК НЕ СОВПАДАЕТ С ТЕМ, ЧТО АНОНИМ ОТКРОЕТ — ${report.violations.length} шт.:`);
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
