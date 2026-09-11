/**
 * Чтения боевой базы — это БЮДЖЕТ. Долг 135, заход 7.172.
 *
 * ЦЕНА, ЗАПЛАЧЕННАЯ 11.09.2026. Боевая база перестала отдавать чтения:
 * исчерпана месячная квота тарифа Turso, и живой сайт лёг — 500 у 330
 * замороженных URL из 330, 500 у `/es/stories` и `/sitemap.xml`.
 * Починил это только владелец, деньгами (переход на тариф Developer).
 * До этого дня ни одна проверка не знала, во сколько строк она обходится,
 * и «прогнать ещё разок» ничего не стоило на вид.
 *
 * ЧТО ИЗМЕРЕНО (7.172, часть 2; числа — `rows_read` из ответов
 * `/v2/pipeline` боевой базы, а не оценка):
 *
 *   * вся боевая база — 47 287 строк, из них 36 316 в `AudioAsset`;
 *   * ОДИН рендер медиа-страницы — 36 328 строк, потому что
 *     `clipsByText` (`src/lib/audio-reuse.ts`) ищет клипы по колонке
 *     `AudioAsset.text`, у которой НЕТ индекса. Шесть нужных строк
 *     достаются полным проходом по 36 316. Медиа-страниц в карте сайта
 *     552 — это 91% цены полного обхода сайта краулером;
 *   * один прогон `check:listen-buttons --census` — 1 236 782 строки
 *     (33 полных прохода по `AudioAsset` за один прогон);
 *   * один прогон `check:frozen` — 7 300 400 строк (200 медиа-страниц и
 *     130 рассказов живого сайта);
 *   * один полный обход карты сайта (1913 URL) — около 21,9 млн строк.
 *
 * ЧТО ИЗМЕНИЛОСЬ 11.09.2026 ВЕЧЕРОМ (7.173). Индекс
 * `AudioAsset_text_idx` создан на проде, и полный проход ушёл — замерено
 * `rows_read` до и после на одном и том же наборе запросов:
 * медиа-страница **36 328 → 36**, `/api/word-audio` **36 316 → 5**,
 * прочие 16 поверхностей — до строки те же. Поэтому цены ниже
 * пересчитаны; числа выше оставлены как есть, потому что это запись
 * аварии, а не текущая цена. Индекс помогает ТОЛЬКО запросам по
 * `AudioAsset.text`: самыми дорогими поверхностями стали `/es` (45 683)
 * и `/es/vocabulary/<тема>` (37 972), и там цену дают полные проходы по
 * `FlashcardCard`, а не озвучка (7.173, часть 1).
 *
 * ОТСЮДА ПРАВИЛО, которое сторожит этот файл:
 *
 *   тяжёлая перепись работает по ЛОКАЛЬНОМУ СНИМКУ прода; чтобы пойти в
 *   боевую базу или на живой сайт, нужен явный флаг `--against-prod`, и
 *   ожидаемая цена в строках печатается ДО первого запроса.
 *
 * Обратная половина, без которой правило было бы украшением: запуск
 * против прода БЕЗ флага обязан ОТКАЗАТЬ, а не молча сходить. Ровно это
 * изображает подсадка (`--plant`): каждому охраняемому скрипту
 * подставляется боевой адрес базы без флага, и скрипт обязан упасть.
 *
 * Цены ниже — не украшение и не догадка: они печатаются пользователю и
 * попадают в отчёт захода, из которого владелец вычитает их из показаний
 * панели Turso. Если цена изменилась — её меняют здесь, вместе с датой
 * замера, а не подгоняют на глаз.
 *
 *   node scripts/prod-read-budget.mjs            # печать таблицы цен
 *   node scripts/prod-read-budget.mjs --plant    # позитивный контроль
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export const PROD_FLAG = "--against-prod";

/** Каталог, куда кладётся снимок прода (в репозиторий не попадает). */
export const SNAPSHOT_DIR = "prisma/snapshots";
export const DEFAULT_SNAPSHOT = path.join(SNAPSHOT_DIR, "prod-latest.db");

/**
 * Цена одного прогона в ПРОСМОТРЕННЫХ СТРОКАХ боевой базы.
 * `measured` — замерено `rows_read` 11.09.2026 (7.172, часть 2);
 * `estimated` — сложено из замеренных цен рендера и числа URL.
 */
export const PRICES = {
  "check:listen-buttons": {
    rows: 37_000,
    kind: "estimated",
    what: "сплошная перепись органов «слушать»: 32 поиска по индексу AudioAsset_text_idx плюс один полный проход по voice (36 316)",
  },
  "check:frozen": {
    rows: 41_000,
    kind: "estimated",
    what: "330 URL живого сайта: 200 медиа-страниц по 36 строк и 130 рассказов по 260",
  },
  "check:reachability": {
    rows: 1_944_000,
    kind: "estimated",
    what: "обход всей карты сайта по ссылкам: 1913 URL; дороже всего теперь 23 страницы словаря по темам (37 972), а не 552 медиа-страницы",
  },
};

const isRemote = (url) => !!url && /^(libsql|wss?|https?):\/\//i.test(url) && !/^file:/i.test(url);

/** Указывает ли `--base=…` на живой прод. */
export function baseIsProd(base) {
  return typeof base === "string" && /rusofacilapp\.com/i.test(base);
}

function refuse(name, reason, hint) {
  const price = PRICES[name];
  console.error(`[${name}] ОТКАЗ: ${reason}`);
  if (price) {
    console.error(
      `[${name}] один такой прогон стоит ${price.rows.toLocaleString("ru-RU")} просмотренных строк боевой базы (${price.kind === "measured" ? "замерено" : "оценка"}).`
    );
  }
  console.error(`[${name}] ${hint}`);
  console.error(
    `[${name}] правило: чтения боевой базы — бюджет (долг 135). Перепись работает по снимку; в прод — только с ${PROD_FLAG}.`
  );
  return 1;
}

/**
 * Общий страж для проверок, которые ходят на ЖИВОЙ САЙТ.
 * Возвращает 0, если идти можно (и печатает цену), иначе код выхода.
 */
export function guardLiveCrawl({ name, argv, base }) {
  if (!baseIsProd(base)) return 0;
  if (!argv.includes(PROD_FLAG)) {
    return refuse(
      name,
      `запуск против живого прода (${base}) без флага ${PROD_FLAG}.`,
      `если прогон действительно нужен — добавьте ${PROD_FLAG}; цена будет напечатана до первого запроса.`
    );
  }
  announce(name);
  return 0;
}

/**
 * Общий страж для переписей, которые ходят в БОЕВУЮ БАЗУ напрямую.
 * Возвращает `{ url }` — адрес базы, по которому переписи и работать,
 * либо `{ exitCode }`, если идти нельзя.
 */
export function resolveCensusDb({ name, argv, env = process.env }) {
  const snapshotArg = argv.find((a) => a.startsWith("--snapshot="))?.slice("--snapshot=".length);
  const snapshot = snapshotArg ?? env.PROD_SNAPSHOT ?? DEFAULT_SNAPSHOT;
  const configured = env.TURSO_DATABASE_URL ?? env.DATABASE_URL ?? "file:./dev.db";

  if (argv.includes(PROD_FLAG)) {
    if (!isRemote(configured)) {
      console.error(`[${name}] ОТКАЗ: ${PROD_FLAG} задан, но TURSO_DATABASE_URL не боевой (${configured}).`);
      return { exitCode: 1 };
    }
    announce(name);
    return { url: configured, againstProd: true };
  }

  if (existsSync(snapshot)) {
    console.log(`[${name}] по снимку прода: ${snapshot} (боевая база не читается, цена 0 строк)`);
    return { url: `file:${path.resolve(snapshot)}`, againstProd: false };
  }

  if (isRemote(configured)) {
    return {
      exitCode: refuse(
        name,
        `TURSO_DATABASE_URL указывает на боевую базу, а флага ${PROD_FLAG} нет и снимка «${snapshot}» на диске нет.`,
        `сначала снимите снимок: npm run snapshot:prod — и перепись пойдёт по нему бесплатно.`
      ),
    };
  }

  return { url: configured, againstProd: false };
}

function announce(name) {
  const price = PRICES[name];
  if (!price) return;
  console.log(
    `[${name}] ПРОТИВ БОЕВОЙ БАЗЫ. Ожидаемая цена одного прогона — ${price.rows.toLocaleString("ru-RU")} просмотренных строк (${price.kind === "measured" ? "замерено 11.09.2026" : "оценка"}): ${price.what}.`
  );
}

function printTable() {
  console.log("цена одного прогона в просмотренных строках боевой базы (7.172, долг 135):\n");
  for (const [name, p] of Object.entries(PRICES)) {
    console.log(
      `  ${name.padEnd(24)} ${String(p.rows.toLocaleString("ru-RU")).padStart(12)}  ${p.kind === "measured" ? "замерено" : "оценка  "}  ${p.what}`
    );
  }
  console.log(`\nбез флага ${PROD_FLAG} эти проверки в боевую базу не ходят.`);
}

/**
 * Позитивный контроль. Каждому охраняемому скрипту подставляется БОЕВОЙ
 * адрес базы (несуществующий хост — до сети дело не дойдёт) и НЕ даётся
 * флага. Скрипт обязан отказать. Подсадка ловит ровно ту дыру, ради
 * которой всё это написано: «сходил в прод молча».
 */
function plant() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const cases = [
    {
      name: "check:listen-buttons",
      cmd: ["npx", "tsx", "scripts/check-listen-buttons.ts", "--census"],
      env: { TURSO_DATABASE_URL: "libsql://plant.invalid", PROD_SNAPSHOT: "prisma/snapshots/__нет-такого__.db" },
    },
    {
      name: "check:frozen",
      cmd: ["node", "scripts/check-frozen-delta.mjs", "--baseline=docs/frozen-baseline-2026-08-30.json"],
      env: {},
    },
    {
      name: "check:reachability",
      cmd: ["npx", "tsx", "scripts/check-reachability.ts", "--base=https://rusofacilapp.com"],
      env: {},
    },
  ];
  let caught = 0;
  for (const c of cases) {
    const r = spawnSync(c.cmd[0], c.cmd.slice(1), {
      cwd: root,
      env: { ...process.env, ...c.env },
      encoding: "utf8",
      timeout: 120_000,
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    const refused = r.status !== 0 && out.includes("ОТКАЗ");
    console.log(`  ${refused ? "ок" : "ОТКАЗ СТОРОЖА"}: ${c.name} — запуск против прода без ${PROD_FLAG}`);
    if (!refused) console.log(out.split("\n").slice(0, 6).map((l) => "      " + l).join("\n"));
    if (refused) caught++;
  }
  console.log(`[check:prod-reads --plant] пройдено ${caught} из ${cases.length}`);
  return caught === cases.length ? 0 : 1;
}

// Импорт этого модуля не должен делать НИЧЕГО: он же общий страж, и его
// импортируют сами охраняемые скрипты. См. src/lib/entry-point.ts.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  process.exitCode = process.argv.includes("--plant") ? plant() : (printTable(), 0);
}

