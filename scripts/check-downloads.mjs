/**
 * СКАЧАННОЕ ПО КНОПКЕ — СТОРОЖ ЗАХОДА 7.231 (ОФЛАЙН-3), СТРОКИ 310 И 311.
 *
 * Шесть правил, и каждое стоит денег, если его уронить молча.
 *
 *   1. ИМЯ КЕША СКАЧАННОГО НЕ ЗАВИСИТ ОТ СБОРКИ. Прогоном, а не чтением:
 *      `pageCacheNames` вызывается тремя разными отпечатками, и имя
 *      обязано выйти одним и тем же. Отпечаток, попавший в это имя, унёс
 *      бы скачанное на первом же выкате — то есть ровно то, за что
 *      нажимали кнопку (долг 308).
 *   2. И ВЫКАТ ЕГО НЕ УНОСИТ. `staleCacheNames` на чужом отпечатке
 *      обязан оставить его в живых, а кеш содержания — выбросить. Второе
 *      здесь и есть обратный контроль: сторож, который говорит «жив» про
 *      всё, не сторож.
 *   3. А ВЫХОД ИЗ УЧЁТНОЙ ЗАПИСИ — УНОСИТ. `personalPageCaches` обязан
 *      его брать: скачанный платный урок на общем телефоне — это цена
 *      ошибки, из-за которой имя и начинается с `rf-pages`.
 *   4. КАРКАС ИЩЕТ В ЭТОМ ЖЕ КЕШЕ, И ПО ТОМУ ЖЕ АДРЕСУ ОПИСИ. Два файла,
 *      которые ничего друг у друга не импортируют (каркас — статический
 *      файл в пакете приложения), обязаны сойтись знак в знак.
 *   5. СТРОКА СПИСКА ПОЯВЛЯЕТСЯ ТОЛЬКО ПОД РЕАЛЬНО ЛЕЖАЩУЮ КОПИЮ
 *      (строка 310). Держится с двух сторон: запись сверяет копию до и
 *      после описи (`offline-save-client.ts`), а показ отсеивает строки
 *      по факту (`keepPresent` в каркасе).
 *   6. ЧАСТИЧНОЕ СКАЧИВАНИЕ ОТКАТЫВАЕТСЯ. В `downloads-client.ts` обязан
 *      быть откат, и опись обязана писаться ПОСЛЕ проверки целости.
 *   7. СКАЧАННОЕ НЕСЁТ СВОИ ЛИСТЫ СТИЛЕЙ (заход 7.233, строка 314). И
 *      скачивание, и сохранение кладут листы стилей в ТОТ ЖЕ кеш, что и
 *      копию, а `urlsOf` считает их частью материала. Иначе отсев 7.232
 *      («можно ли показать») привязывает судьбу скачанного к precache
 *      текущей сборки — и первый же выкат сайта гасит весь список при
 *      целом кеше. Прогон, который это показал: `.run7233/repro2.mjs`.
 *   8. ОПИСЬ ПУСТА, А КЕШ — НЕТ: СТРОКИ ВОССТАНАВЛИВАЮТСЯ (строка 315).
 *      И на сайте (`readDownloads` → `rowsFromCache`), и в каркасе
 *      (`restoreFromDownloadsCache`). Опись — утверждение о телефоне,
 *      кеш — сам телефон; верить телефону нужно в ОБЕ стороны.
 *   9. У СТРОКИ ЕСТЬ ВИДИМАЯ ПОМЕТКА ЯЗЫКА (строка 316) — и в кабинете,
 *      и в каркасе; дублей одного адреса в списке не бывает.
 *
 *   node scripts/check-downloads.mjs          # гейт
 *   node scripts/check-downloads.mjs --plant  # контроль подсадками
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");

const NAMES = "src/lib/sw-cache-names.ts";
const SIGNED_OUT = "src/lib/signed-out.ts";
const DOWNLOADS = "src/lib/downloads.ts";
const CLIENT = "src/lib/downloads-client.ts";
const SAVE_CLIENT = "src/lib/offline-save-client.ts";
const SHELL = "public/offline.html";
const PANEL = "src/components/profile/DownloadsPanel.tsx";
const FILES = [NAMES, SIGNED_OUT, DOWNLOADS, CLIENT, SAVE_CLIENT, SHELL, PANEL];

const load = () => Object.fromEntries(FILES.map((f) => [f, readFileSync(f, "utf8")]));
const withoutJsComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
const withoutHtmlComments = (html) => html.replace(/<!--[\s\S]*?-->/g, " ");

/** Имя кеша скачанного, прочитанное из объявления, а не переписанное сюда. */
function downloadsCacheName(namesSource) {
  return /export const DOWNLOADS_CACHE_NAME = "([^"]+)"/.exec(namesSource)?.[1] ?? "";
}

/** Строка `downloads:` внутри `pageCacheNames`, как она написана. */
function downloadsLine(namesSource) {
  const body = /export function pageCacheNames\([^)]*\)\s*\{([\s\S]*?)\n\}/.exec(namesSource)?.[1] ?? "";
  return /\n\s*downloads:\s*([^,\n]+),/.exec(body)?.[1]?.trim() ?? "";
}

/** Префикс, на котором висит уборка при выходе. */
function pagePrefix(namesSource) {
  return /export const PAGE_CACHE_PREFIX = "([^"]+)"/.exec(namesSource)?.[1] ?? "";
}

export function violations(sources) {
  const bad = [];
  const names = withoutJsComments(sources[NAMES] ?? "");
  const signedOut = withoutJsComments(sources[SIGNED_OUT] ?? "");
  const downloads = withoutJsComments(sources[DOWNLOADS] ?? "");
  const client = withoutJsComments(sources[CLIENT] ?? "");
  const saveClient = withoutJsComments(sources[SAVE_CLIENT] ?? "");
  const shell = withoutHtmlComments(sources[SHELL] ?? "");
  const panel = withoutJsComments(sources[PANEL] ?? "");
  if (FILES.some((f) => !(sources[f] ?? "").trim())) {
    bad.push("одного из файлов нет — сличать нечего");
    return bad;
  }

  const cacheName = downloadsCacheName(names);
  const prefix = pagePrefix(names);

  // 1
  if (!cacheName) {
    bad.push(`${NAMES}: DOWNLOADS_CACHE_NAME не объявлено — скачанному негде лежать`);
    return bad;
  }
  const line = downloadsLine(names);
  if (!line) {
    bad.push(
      `${NAMES}: pageCacheNames не строит имя «downloads» — значит staleCacheNames не знает его «своим», и первый же выкат сайта унесёт скачанное (долг 308)`,
    );
  } else if (/fingerprint/.test(line)) {
    bad.push(
      `${NAMES}: в имени кеша скачанного стоит отпечаток сборки (${line}) — обещание «скачано» прожило бы до первого выката, а нажимали кнопку именно ради обратного`,
    );
  }

  // 2 и 3 — прогоном по настоящим функциям (ниже, в gate/plant через runtime).

  // 3
  if (!cacheName.startsWith(prefix)) {
    bad.push(
      `${SIGNED_OUT}: имя «${cacheName}» не начинается с «${prefix}» — выход из учётной записи его не унесёт, и скачанный платный урок останется на общем телефоне`,
    );
  }
  if (!/name\.startsWith\(PAGE_CACHE_PREFIX\)/.test(signedOut)) {
    bad.push(`${SIGNED_OUT}: personalPageCaches перестал брать кеши по префиксу — скачанное переживёт выход`);
  }

  // 4
  const indexPath = /export const DOWNLOADS_INDEX_PATH = "([^"]+)"/.exec(downloads)?.[1] ?? "";
  if (!indexPath) bad.push(`${DOWNLOADS}: DOWNLOADS_INDEX_PATH не объявлено`);
  const shellIndex = /var DOWNLOADS_INDEX_PATH = "([^"]+)"/.exec(shell)?.[1] ?? "";
  const shellCache = /var DOWNLOADS_CACHE = "([^"]+)"/.exec(shell)?.[1] ?? "";
  if (shellIndex !== indexPath) {
    bad.push(
      `${SHELL}: каркас ищет опись скачанного по «${shellIndex || "нигде"}», а кнопка кладёт её по «${indexPath}» — скачанное лежит на телефоне и недостижимо`,
    );
  }
  if (shellCache !== cacheName) {
    bad.push(
      `${SHELL}: каркас ищет скачанное в кеше «${shellCache || "нигде"}», а кнопка кладёт в «${cacheName}»`,
    );
  }
  if (!new RegExp(`/\\^${cacheName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\$/`).test(shell)) {
    bad.push(
      `${SHELL}: documentCacheNames не берёт кеш скачанного — без сети скачанная страница не откроется ни из списка, ни по адресу`,
    );
  }
  if (!/data-downloads-remove-all/.test(shell) || !/data-downloads-list/.test(shell)) {
    bad.push(`${SHELL}: в каркасе нет блока скачанного с кнопками удаления — человеку негде спросить, за что заняты мегабайты`);
  }
  if (!/function armClips\(/.test(shell) || !/data-rf-clip/.test(shell)) {
    bad.push(`${SHELL}: каркас не озвучивает сохранённую копию по data-rf-clip — скачанный звук молчит`);
  }

  // 5 — строка только под копию
  if (!/copyIsThere\(/.test(saveClient) || (saveClient.match(/copyIsThere\(/g) ?? []).length < 3) {
    bad.push(
      `${SAVE_CLIENT}: копия не сверяется и ДО, и ПОСЛЕ записи описи — вернётся серая строка «No disponible» (строка 310)`,
    );
  }
  if (!/"lost-race"/.test(saveClient)) {
    bad.push(`${SAVE_CLIENT}: исход «копию унесло» не назван — значит он молча выдаётся за «сохранено»`);
  }
  if (!/function keepPresent\(/.test(shell) || !/keepPresent\(clean, names\)/.test(shell)) {
    bad.push(
      `${SHELL}: список не отсеивает строки без копии (keepPresent) — опись обещала бы больше, чем лежит (строка 310)`,
    );
  }

  // 6 — откат частичного
  if (!/const rollback = async/.test(client) || (client.match(/await rollback\(\)/g) ?? []).length < 4) {
    bad.push(
      `${CLIENT}: у скачивания нет отката на каждом отказе — частичное скачивание выдалось бы за готовое («Descargado ✓» на рассказе, у которого молчит середина)`,
    );
  }
  if (!/if \(!\(await isComplete\(args\.caches, row\)\)\)/.test(client)) {
    bad.push(`${CLIENT}: опись скачанного пишется без проверки целости — то же, что строка 310, но про клипы`);
  }
  if (!/askPersistence/.test(client)) {
    bad.push(`${CLIENT}: navigator.storage.persist() не спрашивается — браузер вправе унести «скачанное» в тесный день`);
  }
  if (!/mode: "cors"/.test(client) || !/credentials: "omit"/.test(client)) {
    bad.push(
      `${CLIENT}: клип берётся не простым запросом с CORS — источник отвечает на OPTIONS 405, и скачивание молча отказало бы (замер 7.218)`,
    );
  }

  // 7 — свои листы стилей
  if (!/sheetUrlsInHtml/.test(client) || !/sheets: laidSheets/.test(client)) {
    bad.push(
      `${CLIENT}: скачивание не кладёт листы стилей рядом с материалом — отсев «можно ли показать» привяжет скачанное к precache сборки, и первый выкат погасит весь список при целом кеше (строка 314)`,
    );
  }
  if (!/\.\.\.row\.sheets/.test(downloads)) {
    bad.push(`${DOWNLOADS}: urlsOf не считает листы стилей частью материала — «лежит целиком» стало бы неправдой (строка 314)`);
  }
  if (!/await keepSheetsBeside\(deps\.caches/.test(saveClient)) {
    bad.push(
      `${SAVE_CLIENT}: сохранение не кладёт листы стилей рядом с копией — строка списка будет появляться и исчезать вместе с чужим precache (строка 314)`,
    );
  }
  if (!/needed\.has\(victim\)/.test(client)) {
    bad.push(`${CLIENT}: удаление одного материала уносит лист стилей, нужный соседу — погаснут все остальные строки (строка 314)`);
  }
  if (!/if \(typeof sheets\[k\] === "string" && !needed\[sheets\[k\]\]\)/.test(shell)) {
    bad.push(
      `${SHELL}: удаление из каркаса уносит лист стилей, нужный соседу, или не уносит свой вовсе — оба конца правила 314 держатся только вместе`,
    );
  }

  // 8 — опись восстанавливается из кеша
  if (!/await rowsFromCache\(cache, origin, listed\)/.test(client)) {
    bad.push(
      `${CLIENT}: потерянная опись не восстанавливается из самого кеша — скачанное лежит, а списка нет (строка 315)`,
    );
  }
  if (!/function restoreFromDownloadsCache\(/.test(shell) || !/return restoreFromDownloadsCache\(cache, url/.test(shell)) {
    bad.push(`${SHELL}: каркас не восстанавливает строки из кеша скачанного при потерянной описи (строка 315)`);
  }
  if (!/names\.indexOf\(DOWNLOADS_CACHE\) === -1/.test(shell)) {
    bad.push(
      `${SHELL}: каркас заводит кеш скачанного ЧТЕНИЕМ (caches.open на несуществующем имени создаёт его) — перепись кешей начнёт показывать то, чего человек не делал`,
    );
  }

  // 9 — пометка языка и отсутствие дублей
  if (!/function langMarkOf\(/.test(shell) || (shell.match(/langMarkOf\(row\.path\)/g) ?? []).length < 3) {
    bad.push(
      `${SHELL}: в каркасе нет пометки языка у строки — две локали одной страницы выглядят одинаково и различить их нечем (строка 316)`,
    );
  }
  if (!/langMark\(langOfPath\(row\.path\)/.test(panel)) {
    bad.push(`${PANEL}: в кабинете нет пометки языка у строки скачанного (строка 316)`);
  }
  if (!/withoutDuplicates\(/.test(panel)) {
    bad.push(`${PANEL}: список скачанного не снимает дубли одного адреса (строка 316)`);
  }

  return bad;
}

/** Правила 2 и 3 — прогоном по настоящим функциям, а не по тексту. */
async function runtimeViolations() {
  const bad = [];
  const { pageCacheNames, staleCacheNames, DOWNLOADS_CACHE_NAME } = await import("../src/lib/sw-cache-names.ts");
  const { personalPageCaches } = await import("../src/lib/signed-out.ts");

  const fps = ["aaa111", "bbb222", "ccc333"];
  const built = new Set(fps.map((fp) => pageCacheNames(fp).downloads));
  if (built.size !== 1) {
    bad.push(`${NAMES}: имя кеша скачанного разное на разных отпечатках (${[...built].join(", ")}) — выкат унесёт скачанное`);
  }
  const contentNames = new Set(fps.map((fp) => pageCacheNames(fp).content));
  if (contentNames.size !== fps.length) {
    bad.push(`${NAMES}: имя кеша СОДЕРЖАНИЯ перестало зависеть от сборки — обратный контроль провален (долг 14)`);
  }

  const live = [pageCacheNames("aaa111").downloads, pageCacheNames("aaa111").content];
  const stale = staleCacheNames(live, "bbb222");
  if (stale.includes(DOWNLOADS_CACHE_NAME)) {
    bad.push(`${NAMES}: staleCacheNames уносит скачанное на чужом отпечатке — это и есть долг 308, только теперь по кнопке`);
  }
  if (!stale.includes(pageCacheNames("aaa111").content)) {
    bad.push(`${NAMES}: staleCacheNames не уносит чужой кеш содержания — обратный контроль провален`);
  }

  if (!personalPageCaches([DOWNLOADS_CACHE_NAME, "rf-audio"]).includes(DOWNLOADS_CACHE_NAME)) {
    bad.push(`${SIGNED_OUT}: выход из учётной записи не уносит скачанное — платный урок останется на общем телефоне`);
  }
  if (personalPageCaches(["rf-audio"]).length !== 0) {
    bad.push(`${SIGNED_OUT}: personalPageCaches берёт чужое имя — сторож, который говорит «да» на всё, не сторож`);
  }
  return bad;
}

async function plant() {
  const live = load();
  const cases = [];
  const base = violations(live);
  cases.push({ name: "отрицательный контроль: на живых файлах молчит", ok: base.length === 0 });

  const add = (name, file, mutate, expect) => {
    const mutated = { ...live, [file]: mutate(live[file]) };
    if (mutated[file] === live[file]) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(mutated).some((x) => x.includes(expect)) });
  };

  add(
    "подсадка: в имени кеша скачанного появился отпечаток сборки",
    NAMES,
    (s) => s.replace("downloads: DOWNLOADS_CACHE_NAME,", "downloads: `${DOWNLOADS_CACHE_NAME}-${fingerprint}`,"),
    "стоит отпечаток сборки",
  );
  add(
    "подсадка: имя вынесли из pageCacheNames — выкат унесёт скачанное",
    NAMES,
    (s) => s.replace("downloads: DOWNLOADS_CACHE_NAME,", ""),
    "не строит имя «downloads»",
  );
  add(
    "подсадка: имя перестало начинаться с rf-pages — выход не унесёт платное",
    NAMES,
    (s) => s.replace('DOWNLOADS_CACHE_NAME = "rf-pages-downloads"', 'DOWNLOADS_CACHE_NAME = "rf-downloads"'),
    "выход из учётной записи его не унесёт",
  );
  add(
    "подсадка: уборка при выходе перестала смотреть на префикс",
    SIGNED_OUT,
    (s) => s.replace("name.startsWith(PAGE_CACHE_PREFIX)", "false"),
    "перестал брать кеши по префиксу",
  );
  add(
    "подсадка: адрес описи скачанного разъехался между кнопкой и каркасом",
    SHELL,
    (s) => s.replace('var DOWNLOADS_INDEX_PATH = "/__rf-downloads-index"', 'var DOWNLOADS_INDEX_PATH = "/__rf-dl"'),
    "каркас ищет опись скачанного",
  );
  add(
    "подсадка: каркас перестал брать кеш скачанного в список кешей документов",
    SHELL,
    (s) => s.replace("/^rf-pages-downloads$/", "/^rf-pages-nothing$/"),
    "documentCacheNames не берёт кеш скачанного",
  );
  add(
    "подсадка: каркас перестал отсеивать строки без копии (возврат строки 310)",
    SHELL,
    (s) => s.replace("return keepPresent(clean, names);", "return clean;"),
    "не отсеивает строки без копии",
  );
  add(
    "подсадка: каркас разучился озвучивать копию",
    SHELL,
    (s) => s.replace("function armClips(", "function armClipsUnused("),
    "не озвучивает сохранённую копию",
  );
  add(
    "подсадка: страница перестала сверять копию до и после описи",
    SAVE_CLIENT,
    (s) => s.replace(/copyIsThere\(/g, "Boolean("),
    "не сверяется и ДО, и ПОСЛЕ",
  );
  add(
    "подсадка: у скачивания убрали откат — частичное выдаётся за готовое",
    CLIENT,
    (s) => s.replace(/await rollback\(\);\n/g, ""),
    "нет отката на каждом отказе",
  );
  add(
    "подсадка: опись скачанного пишется без проверки целости",
    CLIENT,
    (s) => s.replace("if (!(await isComplete(args.caches, row))) {", "if (false) {"),
    "без проверки целости",
  );
  add(
    "подсадка: скачивание перестало класть свои листы стилей (строка 314)",
    CLIENT,
    (s) => s.replace("sheets: laidSheets,", "sheets: [],").replace(/sheetUrlsInHtml/g, "noSheets"),
    "не кладёт листы стилей рядом с материалом",
  );
  add(
    "подсадка: листы стилей выпали из «лежит целиком» (строка 314)",
    DOWNLOADS,
    (s) => s.replace("...row.sheets", ""),
    "urlsOf не считает листы стилей",
  );
  add(
    "подсадка: сохранение перестало класть листы рядом с копией (строка 314)",
    SAVE_CLIENT,
    (s) => s.replace("await keepSheetsBeside(", "await Promise.resolve("),
    "сохранение не кладёт листы стилей",
  );
  add(
    "подсадка: удаление уносит лист, нужный соседу (строка 314)",
    CLIENT,
    (s) => s.replace("if (needed.has(victim)) continue;", ""),
    "уносит лист стилей, нужный соседу",
  );
  add(
    "подсадка: удаление из каркаса уносит общий лист стилей (строка 314)",
    SHELL,
    (s) => s.replace('if (typeof sheets[k] === "string" && !needed[sheets[k]])', 'if (typeof sheets[k] === "string")'),
    "удаление из каркаса уносит лист стилей",
  );
  add(
    "подсадка: потерянная опись больше не восстанавливается (строка 315)",
    CLIENT,
    (s) => s.replace("(await rowsFromCache(cache, origin, listed))", "[]"),
    "не восстанавливается из самого кеша",
  );
  add(
    "подсадка: каркас перестал восстанавливать строки из кеша (строка 315)",
    SHELL,
    (s) => s.replace("return restoreFromDownloadsCache(cache, url, seen, out);", "return out;"),
    "не восстанавливает строки из кеша скачанного",
  );
  add(
    "подсадка: каркас снова заводит кеш скачанного чтением",
    SHELL,
    (s) => s.replace("if (names.indexOf(DOWNLOADS_CACHE) === -1) return null;", ""),
    "заводит кеш скачанного ЧТЕНИЕМ",
  );
  add(
    "подсадка: из каркаса убрали пометку языка (строка 316)",
    SHELL,
    (s) => s.replace(/langMarkOf\(row\.path\)/g, '""'),
    "нет пометки языка у строки",
  );
  add(
    "подсадка: из кабинета убрали пометку языка (строка 316)",
    PANEL,
    (s) => s.replace("{langMark(langOfPath(row.path) || row.lang)} · ", ""),
    "в кабинете нет пометки языка",
  );
  add(
    "подсадка: кабинет перестал снимать дубли адреса (строка 316)",
    PANEL,
    (s) => s.replace("withoutDuplicates(await readDownloads", "(await readDownloads"),
    "не снимает дубли одного адреса",
  );
  add(
    "подсадка: persist() больше не спрашивается",
    CLIENT,
    (s) => s.replace(/askPersistence/g, "skipPersistence"),
    "persist() не спрашивается",
  );
  add(
    "подсадка: клип берётся без CORS — источник откажет на OPTIONS",
    CLIENT,
    (s) => s.replace('mode: "cors"', 'mode: "no-cors"'),
    "не простым запросом с CORS",
  );

  for (const c of cases) {
    console.log(`  ${c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО"} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(
    ok
      ? `check:downloads --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль`
      : "check:downloads --plant — FAILED",
  );
  process.exitCode = ok ? 0 : 1;
}

async function gate() {
  const bad = [...violations(load()), ...(await runtimeViolations())];
  if (bad.length) {
    console.error(`check:downloads — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    "check:downloads — 9 правил (из них 2 прогоном), нарушений 0 (заходы 7.231 и 7.233, офлайн-3; строки 310, 311, 314, 315, 316)",
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) await plant();
  else await gate();
}
