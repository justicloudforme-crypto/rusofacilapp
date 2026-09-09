/**
 * Испанское название рассказа — сторож на три вопроса сразу.
 *
 * ЗАЧЕМ. Колонка `Story.titleEs` — это текст, который печатается крупнее
 * всего остального на странице рассказа и в каталоге. У такого поля есть
 * три способа испортиться молча, и ни один из них не виден ни одной
 * существующей проверке:
 *
 *   1. СМЕШЕНИЕ АЛФАВИТОВ. Кириллица в испанском названии — это либо
 *      русский оригинал, случайно положенный не в ту колонку, либо
 *      перевод, оборванный на полуслове. Опаснее второе: одна
 *      кириллическая «а» (U+0430) внутри латинского слова читается
 *      человеком как обычная «a». Этот класс уже стоил проекту красного
 *      CI (PROGRESS.md 4.6) — там он был в PROGRESS.md, здесь будет в
 *      боевой базе, где его никто не увидит вовсе.
 *   2. ПРОПАВШИЙ ОРИГИНАЛ. Русское название — не «то, что заменили», а
 *      оригинал изучаемого языка: ученик пришёл сюда именно за ним.
 *      Пустой `title` при заполненном `titleEs` означает, что рассказ
 *      потерял ровно ту строку, ради которой сайт существует.
 *   3. ЗАМОРОЗКА. 65 рассказов A1 (50 пилот + 15 контроль) участвуют в
 *      замере до 25.09.2026, и новой подачи они получать не должны. Это
 *      правило живёт в коде (`storyTitles`), и вопрос сторожа — не «есть
 *      ли у них `titleEs`» (есть, и это нормально: 25.09 ветка снимается
 *      одной строкой), а «показывается ли он им». Отвечает на это ровно
 *      та же функция, что и на странице, — прогнанная по живым строкам.
 *
 * ДВА РЕЖИМА, как у `check:story-topics`, и по той же причине.
 *
 *   npm run check:story-title-es
 *     ПО БАЗЕ. Один SELECT, дёшево, стоит в `npm run verify`.
 *
 *   npm run check:story-title-es -- --base=https://rusofacilapp.com
 *     ПО ПРОДУКТУ. Живой сайт, аноним: открывает страницу рассказа и
 *     спрашивает у неё, что напечатано в `<h1>`. Между строкой и
 *     страницей стоит `storyTitles`, то есть база и продукт могут
 *     разойтись ровно в том месте, ради которого сторож написан.
 *
 * ПУСТАЯ ТАБЛИЦА — НЕ «нечего проверять», а падение (правило 4.1): база
 * CI держит фикстуру из трёх рассказов, и на нуле строк ответ был бы
 * вакуумно зелёным. Поэтому в `ci.yml` стоит `--plant`, идущий по
 * заведомо здоровой выборке в памяти, а сама проверка — в `verify`.
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ: `--plant`, обязателен.
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { spanishTitleProblem, storyTitles } from "../src/lib/story-title";
import { isFrozenStory } from "../src/lib/story-pilot";
import { isEntryPoint } from "../src/lib/entry-point";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const arg = (name: string) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

export interface TitleRow {
  id: string;
  title: string;
  titleEs: string | null;
  level: string;
}

export interface Verdict {
  problems: string[];
  counts: { rows: number; withEs: number; frozen: number; frozenWithEs: number };
}

/** Правило целиком, отдельной функцией — чтобы `--plant` прогнал его по
 * испорченной выборке и доказал, что оно не слепое. */
export type TitleView = (row: TitleRow, lang: "es") => { primary: string; secondary: string | null };

export function judge(rows: TitleRow[], view: TitleView = storyTitles): Verdict {
  const problems: string[] = [];
  let withEs = 0;
  let frozen = 0;
  let frozenWithEs = 0;

  for (const row of rows) {
    const isFrozen = isFrozenStory(row);
    if (isFrozen) frozen += 1;

    // 2. Русское название на месте у всех — и особенно у тех, у кого
    //    есть испанское.
    if (!row.title || !row.title.trim()) {
      problems.push(`${row.id}: русское название пусто — оригинал изучаемого языка потерян`);
    }

    if (row.titleEs === null) continue;
    withEs += 1;
    if (isFrozen) frozenWithEs += 1;

    // 1. Смешение алфавитов и записанная пустота.
    const problem = spanishTitleProblem(row.titleEs);
    if (problem) problems.push(`${row.id} «${row.titleEs}»: ${problem}`);

    // Испанское название, побайтово равное русскому, — это не перевод, а
    // копия: две одинаковые строки одна под другой.
    if (row.titleEs.trim() === row.title.trim()) {
      problems.push(`${row.id}: испанское название побайтово равно русскому — это копия, а не название`);
    }

    // 3. Заморозка: вопрос не «есть ли данные», а «дошли ли они до
    //    страницы». Спрашиваем ту же функцию, что и страница.
    const shown = view(row, "es");
    if (isFrozen && shown.primary !== row.title) {
      problems.push(
        `${row.id} «${row.title}»: замороженная страница получила новую подачу («${shown.primary}») — эксперимент до 25.09.2026 этим обнуляется`,
      );
    }
    if (isFrozen && shown.secondary !== null) {
      problems.push(`${row.id} «${row.title}»: у замороженной страницы появилась вторая строка`);
    }
    if (!isFrozen && shown.primary !== row.titleEs.trim()) {
      problems.push(`${row.id}: испанское название записано, но страница печатает «${shown.primary}»`);
    }
    if (!isFrozen && shown.secondary !== row.title) {
      problems.push(`${row.id}: русский оригинал пропал из подачи — под испанским названием пусто`);
    }
  }

  if (rows.length === 0) {
    problems.push("в базе нет ни одного рассказа — вопрос о названиях здесь вакуумен, а вакуумный зелёный не результат");
  }

  return { problems, counts: { rows: rows.length, withEs, frozen, frozenWithEs } };
}

function report(label: string, verdict: Verdict): number {
  const { counts, problems } = verdict;
  console.log(`check:story-title-es — ${label}`);
  console.log(`  строк Story ${counts.rows}, с испанским названием ${counts.withEs}, замороженных ${counts.frozen} (из них с испанским названием ${counts.frozenWithEs})`);
  if (problems.length === 0) {
    console.log("  нарушений 0 (контроль — npm run check:story-title-es:plant).");
    return 0;
  }
  for (const problem of problems) console.error(`  ПРОБЛЕМА: ${problem}`);
  return 1;
}

async function runAgainstDatabase(): Promise<number> {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const remote = url.startsWith("libsql://") || url.startsWith("https://");
  const label = remote ? "боевая база (Turso)" : `локальная база (${url})`;
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    const result = await client.execute(`SELECT "id", "title", "titleEs", "level" FROM "Story"`);
    const rows: TitleRow[] = result.rows.map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      titleEs: r.titleEs === null || r.titleEs === undefined ? null : String(r.titleEs),
      level: String(r.level ?? ""),
    }));
    return report(label, judge(rows));
  } finally {
    client.close();
  }
}

/** Заведомо здоровая выборка: подсадка идёт в НЕЁ, а не в сегодняшнюю
 * базу. Иначе контроль зависел бы от того, здорова ли база сегодня —
 * пока `titleEs` пуст во всех строках, ни одна подсадка не была бы
 * отличима от нуля, и контроль молча выродился бы в ничто. */
function healthySample(): TitleRow[] {
  return [
    { id: "h1", title: "Хамелеон", titleEs: "El camaleón", level: "B1" },
    { id: "h2", title: "Первый снег", titleEs: null, level: "A2" },
    { id: "h3", title: "День стирки", titleEs: "Día de colada", level: "A1" }, // пилот
    { id: "h4", title: "Теремок", titleEs: "La casita", level: "A1" }, // контроль
  ];
}

function runPlant(): number {
  const healthy = healthySample();
  const clean = judge(healthy);
  console.log(`check:story-title-es --plant — здоровая выборка ${healthy.length} строк, жалоб на ней ${clean.problems.length} (отрицательная половина)`);
  if (clean.problems.length !== 0) {
    for (const p of clean.problems) console.error(`    ${p}`);
    console.error("  КОНТРОЛЬ ПУСТ: здоровая выборка сама даёт жалобы — подсадка ничего не доказала бы.");
    return 1;
  }
  // Заодно доказывается, что здоровая выборка НЕ вырождена: замороженные
  // строки в ней есть, и испанское название у них записано — иначе третье
  // правило проверялось бы на пустом множестве.
  if (clean.counts.frozenWithEs === 0) {
    console.error("  КОНТРОЛЬ ПУСТ: в здоровой выборке нет замороженной строки с испанским названием.");
    return 1;
  }

  const planted: Array<{ name: string; rows: TitleRow[] }> = [
    {
      name: "кириллическая «а» (U+0430) внутри латинского слова",
      rows: healthy.map((r) => (r.id === "h1" ? { ...r, titleEs: "El cаmaleón" } : r)),
    },
    {
      name: "в испанское поле лёг русский оригинал целиком",
      rows: healthy.map((r) => (r.id === "h1" ? { ...r, titleEs: "Хамелеон" } : r)),
    },
    {
      name: "русское название пропало у рассказа с испанским",
      rows: healthy.map((r) => (r.id === "h1" ? { ...r, title: "" } : r)),
    },
    {
      name: "записанная пустота вместо NULL",
      rows: healthy.map((r) => (r.id === "h2" ? { ...r, titleEs: "  " } : r)),
    },
    { name: "таблица рассказов пуста", rows: [] },
  ];

  // Подсадка в САМО ПРАВИЛО подачи, а не в данные: «замороженный рассказ
  // получил новую подачу» нельзя изобразить строкой — рассказ, у которого
  // переписали уровень, просто перестаёт быть замороженным, и требовать
  // от него старого вида было бы неправильно. Ломается то, что и может
  // сломаться на самом деле: ветка `isFrozenStory` внутри `storyTitles`.
  const blindToFreeze: TitleView = (row) =>
    row.titleEs ? { primary: row.titleEs, secondary: row.title } : { primary: row.title, secondary: null };
  const droppedOriginal: TitleView = (row) =>
    row.titleEs && !isFrozenStory(row) ? { primary: row.titleEs, secondary: null } : storyTitles(row, "es");

  const plantedRules: Array<{ name: string; view: TitleView }> = [
    { name: "правило подачи перестало видеть заморозку", view: blindToFreeze },
    { name: "русский оригинал перестал печататься второй строкой", view: droppedOriginal },
  ];

  let caught = 0;
  for (const p of plantedRules) {
    const got = judge(healthy, p.view);
    const grew = got.problems.length > clean.problems.length;
    console.log(`  ${grew ? "поймано" : "ПРОПУЩЕНО"}: ${p.name} — жалоб ${got.problems.length} против ${clean.problems.length} без подсадки`);
    if (grew) caught += 1;
  }
  for (const p of planted) {
    const got = judge(p.rows);
    const grew = got.problems.length > clean.problems.length;
    console.log(`  ${grew ? "поймано" : "ПРОПУЩЕНО"}: ${p.name} — жалоб ${got.problems.length} против ${clean.problems.length} без подсадки`);
    if (!grew) for (const q of got.problems) console.log(`      ${q}`);
    if (grew) caught += 1;
  }
  const total = planted.length + plantedRules.length;
  console.log(`  поймано ${caught} из ${total}`);
  return caught === total ? 0 : 1;
}

/**
 * Замер по ПРОДУКТУ: что напечатано в `<h1>` живой страницы. База может
 * быть здорова, а страница — нет: между ними стоит `storyTitles`.
 */
async function runAgainstSite(base: string): Promise<number> {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  let rows: TitleRow[];
  try {
    const result = await client.execute(`SELECT "id", "title", "titleEs", "level" FROM "Story" WHERE "titleEs" IS NOT NULL`);
    rows = result.rows.map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      titleEs: String(r.titleEs),
      level: String(r.level ?? ""),
    }));
  } finally {
    client.close();
  }

  const problems: string[] = [];
  let measured = 0;
  for (const row of rows) {
    const response = await fetch(`${base}/es/stories/${row.id}`);
    if (response.status !== 200) {
      problems.push(`${row.id}: страница ответила ${response.status} — измерить нечего`);
      continue;
    }
    const html = await response.text();
    const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "";
    const text = h1
      .replace(/<[^>]*>/g, "")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/\s+/g, " ")
      .trim();
    measured += 1;
    const expected = storyTitles(row, "es");
    const want = expected.secondary ? `${expected.primary}${expected.secondary}` : expected.primary;
    if (text.replace(/\s+/g, "") !== want.replace(/\s+/g, "")) {
      problems.push(`${row.id}: <h1> печатает «${text}», а правило требует «${want}»`);
    }
  }

  console.log(`check:story-title-es --base=${base} — аноним, ${measured} страниц измерено из ${rows.length} строк с испанским названием`);
  if (measured === 0) {
    console.error("  ПРОБЛЕМА: не измерено ни одной страницы — этот зелёный ничего не значит");
    return 1;
  }
  if (problems.length === 0) {
    console.log("  все измеренные страницы печатают ровно то, что требует правило.");
    return 0;
  }
  for (const problem of problems) console.error(`  ПРОБЛЕМА: ${problem}`);
  return 1;
}

async function main() {
  if (flag("plant")) {
    process.exitCode = runPlant();
    return;
  }
  const base = arg("base");
  process.exitCode = base ? await runAgainstSite(base) : await runAgainstDatabase();
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error("[check:story-title-es] упало:", error);
    process.exit(1);
  });
}
