/**
 * Чип темы, который отдаёт ноль карточек, — это падение.
 *
 * ЗАЧЕМ. 08.09.2026 замером (`docs/story-topic-2026-09-08.md`) найдено: на
 * проде `Story.topic` пуст во всех 325 строках, а ряд чипов рисуется из
 * константы `storyTopics` — восемь корзин независимо от данных. Семь чипов
 * из восьми на обеих локалях отдавали ПУСТОЙ список, и увидеть это могла
 * только проверка, которая нажимает чип и считает карточки. Ни одна
 * существующая этого не делала: `check:layout` ходит по геометрии,
 * `check:internal-links` — по ссылкам, `crawlable-surface.test.ts` — по
 * маршрутам. Фильтр может не фильтровать, и все три останутся зелёными.
 *
 * ДВА РЕЖИМА, и они отвечают на РАЗНЫЕ вопросы.
 *
 *   npm run check:story-topics
 *     ПО БАЗЕ. Считает строки `Story` по каждому из восьми ключей.
 *     Красный, если хоть одна корзина пуста, если `topic` пуст у строк,
 *     или если значение вне восьми ключей. Дёшево (один SELECT), поэтому
 *     стоит в `npm run verify`.
 *
 *   npm run check:story-topics:prod
 *     ПО ПРОДУКТУ. Живой сайт, аноним, обе локали, восемь нажатий на
 *     локаль. Открывает каталог, жмёт чип, дожимает «показать ещё» до
 *     конца и считает карточки — то есть спрашивает у страницы, а не у
 *     базы. Красный по тому же правилу.
 *
 * ПОЧЕМУ РЕЖИМ ПО БАЗЕ НЕ ЗАМЕНЯЕТ РЕЖИМ ПО ПРОДУКТУ. Между строкой и
 * карточкой стоит `stories-catalog.ts:86` — `isStoryTopic(row.topic) ?
 * row.topic : "other"`. Это приведение и превращало 325 пустых строк в
 * 325 карточек «Otros», то есть база и страница могут расходиться ровно
 * в том месте, ради которого проверка написана. Режим по продукту
 * отдельно требует, чтобы «other» НЕ отдавал весь каталог: как только
 * отдаёт — приведение снова подменило собой настоящие темы.
 *
 * ПУСТОЙ КАТАЛОГ — ТОЖЕ ПАДЕНИЕ, а не «нечего проверять». База без
 * рассказов (какова база CI) даёт вакуумно зелёный ответ, а он по
 * правилу 4.1 не результат. Это тот же класс пропуска ПО ДАННЫМ, что
 * разобран в PROGRESS 7.141 часть 3.
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ: `--plant`, обязателен по правилу 4.1.
 *   по базе    — из выборки в памяти вычёркивается одна тема целиком;
 *   по продукту— ответ сервера правится на лету так, что у одной темы не
 *                остаётся ни одного рассказа (перекраска ключа темы в
 *                flight-разметке). Оба обязаны стать красными.
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { storyTopics, type StoryTopic } from "../src/lib/stories";
import { isEntryPoint } from "../src/lib/entry-point";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const arg = (name: string) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const TOPIC_LABELS: Record<StoryTopic, { es: string; ru: string }> = {
  daily_life: { es: "Vida cotidiana", ru: "Повседневная жизнь" },
  family: { es: "Familia y relaciones", ru: "Семья и отношения" },
  work_study: { es: "Trabajo y estudios", ru: "Работа и учёба" },
  childhood: { es: "Infancia", ru: "Детство" },
  mystery: { es: "Misterio", ru: "Тайна и загадка" },
  nature_travel: { es: "Naturaleza y viajes", ru: "Природа и путешествия" },
  wisdom_morals: { es: "Sabiduría y moral", ru: "Мудрость и мораль" },
  other: { es: "Otros", ru: "Разное" },
};

interface CatalogRow {
  topic: string | null;
}

/** Правило целиком, отдельной функцией — чтобы `--plant` мог прогнать его
 * по испорченной выборке и доказать, что оно не слепое. */
export function judgeByRows(rows: CatalogRow[]): { counts: Record<string, number>; problems: string[] } {
  const counts: Record<string, number> = Object.fromEntries(storyTopics.map((t) => [t, 0]));
  const problems: string[] = [];
  let empty = 0;
  let unknown = 0;

  for (const row of rows) {
    if (row.topic === null || row.topic === "") {
      empty += 1;
      continue;
    }
    if (!(row.topic in counts)) {
      unknown += 1;
      continue;
    }
    counts[row.topic] += 1;
  }

  if (rows.length === 0) {
    problems.push("в базе нет ни одного рассказа — проверка о чипах каталога здесь вакуумна, а вакуумный зелёный не результат");
    return { counts, problems };
  }
  if (empty > 0) problems.push(`пустой topic у ${empty} строк из ${rows.length} — эти рассказы попадут в «Otros» приведением, а не по смыслу`);
  if (unknown > 0) problems.push(`значение вне восьми ключей у ${unknown} строк`);
  for (const topic of storyTopics) {
    if (counts[topic] === 0) problems.push(`чип «${topic}» отдаёт 0 карточек`);
  }
  return { counts, problems };
}

async function runAgainstDatabase(): Promise<number> {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const remote = url.startsWith("libsql://") || url.startsWith("https://");
  const label = remote ? "боевая база (Turso)" : `локальная база (${url})`;
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    const result = await client.execute(`SELECT "topic" FROM "Story"`);
    const rows: CatalogRow[] = result.rows.map((r) => ({
      topic: r.topic === null || r.topic === undefined ? null : String(r.topic),
    }));

    if (flag("plant")) {
      // Подсадка идёт в ЗАВЕДОМО ЗДОРОВУЮ выборку, а не в текущую базу.
      // Иначе контроль зависел бы от того, здорова ли база сегодня: пока
      // корзины пусты, «жалоб стало больше» не сказать ни про одну
      // подсадку, и контроль молча выродился бы в ничто.
      const healthy: CatalogRow[] = storyTopics.flatMap((topic) => [{ topic }, { topic }, { topic }]);
      const clean = judgeByRows(healthy);
      console.log(`check:story-topics --plant — здоровая выборка ${healthy.length} строк, жалоб на ней ${clean.problems.length} (отрицательная половина)`);
      let caught = clean.problems.length === 0 ? 0 : -1;
      if (caught === -1) {
        console.error("  КОНТРОЛЬ ПУСТ: здоровая выборка сама даёт жалобы — подсадка ничего не доказала бы.");
        return 1;
      }
      const planted: { name: string; rows: CatalogRow[] }[] = [
        { name: "тема «mystery» вычеркнута из выборки целиком", rows: healthy.filter((r) => r.topic !== "mystery") },
        { name: "у половины строк topic обнулён", rows: healthy.map((r, i) => (i % 2 === 0 ? { topic: null } : r)) },
        { name: "значение вне восьми ключей", rows: healthy.map((r, i) => (i === 0 ? { topic: "не_тема" } : r)) },
        { name: "каталог пуст", rows: [] },
      ];
      for (const p of planted) {
        const got = judgeByRows(p.rows);
        const grew = got.problems.length > clean.problems.length;
        console.log(`  ${grew ? "поймано" : "ПРОПУЩЕНО"}: ${p.name} — жалоб ${got.problems.length} против ${clean.problems.length} без подсадки`);
        if (grew) caught += 1;
      }
      console.log(`  поймано ${caught} из ${planted.length}`);
      console.log(`  (текущая база — ${label}, жалоб на ней ${judgeByRows(rows).problems.length}; это НЕ часть контроля)`);
      return caught === planted.length ? 0 : 1;
    }

    const { counts, problems } = judgeByRows(rows);
    console.log(`check:story-topics — ${label}, строк Story ${rows.length}`);
    for (const topic of storyTopics) console.log(`  ${topic}: ${counts[topic]}`);
    if (problems.length === 0) {
      console.log("  каждая из восьми корзин непуста (контроль — npm run check:story-topics:plant).");
      return 0;
    }
    for (const problem of problems) console.error(`  ПРОБЛЕМА: ${problem}`);
    return 1;
  } finally {
    client.close();
  }
}

interface ChipMeasurement {
  lang: string;
  topic: StoryTopic;
  cards: number;
  indexLinks: number;
}

async function runAgainstSite(base: string): Promise<number> {
  const { chromium } = await import("playwright");
  const plant = flag("plant");
  const PLANT_TOPIC: StoryTopic = "mystery";

  const browser = await chromium.launch();
  // Аноним и без воркера: кэш service worker в чистом контексте Playwright
  // отдаёт ответ мимо page.route (PROGRESS 7.141 часть 3), и подсадка
  // тогда доказывает не то.
  const context = await browser.newContext({ serviceWorkers: "block" });

  if (plant) {
    await context.route("**/stories", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      // Замена ОБЯЗАНА быть той же длины: flight-разметка React несёт
      // длины кусков, и подстановка другой длины ломает не фильтр, а
      // разбор страницы целиком — первая попытка подсадки («mystery» →
      // «childhood») именно так и упала, не доказав ничего. Поэтому
      // ключ портится регистром: `isStoryTopic` его не признаёт, и
      // рассказы темы уезжают в «other» тем самым приведением из
      // stories-catalog.ts:86, ради которого проверка и написана.
      route.fulfill({ response, body: body.split(PLANT_TOPIC).join("mystEry") });
    });
  }

  const measurements: ChipMeasurement[] = [];
  try {
    for (const lang of ["es", "ru"] as const) {
      const page = await context.newPage();
      await page.goto(`${base}/${lang}/stories`, { waitUntil: "networkidle" });
      const indexLinks = await page.locator('[data-testid="story-link-index"] a').count();

      for (const topic of storyTopics) {
        const label = TOPIC_LABELS[topic][lang];
        const chip = page.getByRole("button", { name: label, exact: true });
        await chip.click();
        // Дожать «показать ещё» до конца: сетка рисует по 24, а вопрос
        // проверки — сколько рассказов у темы, а не сколько влезло.
        for (let guard = 0; guard < 40; guard++) {
          const more = page.getByRole("button", { name: /Cargar más|Показать ещё/ });
          if ((await more.count()) === 0) break;
          await more.first().click();
        }
        // Карточки сетки — это все ссылки на рассказ ВНЕ серверного
        // индекса: индекс от фильтра не зависит (он для краулера) и,
        // попади он в счёт, каждый чип отдал бы одно и то же число.
        const gridCards = await page.evaluate(() => {
          const index = document.querySelector('[data-testid="story-link-index"]');
          return [...document.querySelectorAll('a[href*="/stories/"]')].filter((a) => !index?.contains(a)).length;
        });
        measurements.push({ lang, topic, cards: gridCards, indexLinks });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`check:story-topics --base=${base} — аноним, обе локали, ${measurements.length} нажатий`);
  const problems: string[] = [];
  for (const lang of ["es", "ru"]) {
    const own = measurements.filter((m) => m.lang === lang);
    const total = own.reduce((sum, m) => sum + m.cards, 0);
    console.log(`  /${lang}/stories — ссылок в серверном индексе ${own[0]?.indexLinks ?? 0}`);
    for (const m of own) console.log(`    ${m.topic}: карточек ${m.cards}`);
    console.log(`    сумма по восьми чипам: ${total}`);
    for (const m of own) {
      if (m.cards === 0) problems.push(`/${lang}: чип «${m.topic}» отдаёт 0 карточек`);
    }
    const other = own.find((m) => m.topic === "other");
    if (other && own[0] && other.cards >= (own[0].indexLinks || Infinity)) {
      problems.push(`/${lang}: чип «other» отдаёт ${other.cards} карточек при ${own[0].indexLinks} рассказах — приведение null → "other" снова подменяет собой настоящие темы`);
    }
  }

  if (plant) {
    const caught = problems.some((p) => p.includes(PLANT_TOPIC));
    console.log(`\n  ПОДСАДКА: тема «${PLANT_TOPIC}» перекрашена в ответе сервера — ${caught ? "поймано" : "ПРОПУЩЕНО"}`);
    return caught ? 0 : 1;
  }

  if (problems.length === 0) {
    console.log("  каждый из 16 чипов отдал непустой список (контроль — тот же вызов с --plant).");
    return 0;
  }
  for (const problem of problems) console.error(`  ПРОБЛЕМА: ${problem}`);
  return 1;
}

async function main() {
  const base = arg("base");
  process.exitCode = base ? await runAgainstSite(base) : await runAgainstDatabase();
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error("[check:story-topics] упало:", error);
    process.exit(1);
  });
}
