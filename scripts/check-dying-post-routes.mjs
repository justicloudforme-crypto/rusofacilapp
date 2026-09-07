/**
 * Сторож правила: ВСЯКИЙ `POST`, уходящий из умирающего документа,
 * обязан иметь свой маршрут в service worker.
 *
 * Зачем. 07.09.2026 (PROGRESS.md 7.134, часть 4) замерено: `POST
 * /api/search/log`, уходивший маячком из `pagehide`, не совпадал ни с
 * одним маршрутом `defaultCache` — все они про `GET`, — и Chromium
 * доставлял 6 и 8 из 16 против 16 из 16 у WebKit и 16 из 16 с
 * заблокированным воркером. То есть журнал спроса терял БОЛЬШЕ ПОЛОВИНЫ
 * выходов «ушёл на другой адрес» — перекос ровно в ту сторону, ради
 * устранения которой журнал и заводился. Лечение — одна строка
 * `registerCapture(..., "POST")` в `src/app/sw.ts`.
 *
 * Правило после этого было записано словами и не закреплено НИЧЕМ — ни
 * тестом, ни сторожем (долг 59). Второй такой запрос появился бы молча:
 * маячок пишется одной строкой, `sw.ts` при этом никто не открывает, а
 * потеря видна только счётчиком на живом браузере.
 *
 * Что делает скрипт. Ищет в `src/` все отправки, которые переживают
 * уход со страницы, — `navigator.sendBeacon(...)` и `fetch(..., {
 * keepalive: true })` — и требует, чтобы у КАЖДОЙ был свой
 * `serwist.registerCapture` с методом `"POST"` и тем же путём.
 *
 * Один уровень посредника скрипт проходит, и это не удобство. Отправка
 * может уходить не прямо, а через общий транспорт: `postReliably(url,
 * body)` в `src/lib/reliable-post.ts` шлёт `fetch(..., { keepalive: true
 * })` и добивает маячком, но адрес получает параметром. Останавливаться
 * на нём значило бы отчитаться «адрес вычисляется» и не увидеть ни одного
 * из настоящих адресов — а их за этим транспортом два. Поэтому файл, у
 * которого ВСЕ отправки идут по параметру `url` экспортируемой функции,
 * считается транспортом, и проверяются места его вызова.
 *
 * Чего скрипт НЕ умеет, и это сказано прямо: адрес он читает только
 * строковым литералом. Отправка по вычисленному адресу краснит прогон, а
 * не пропускается молча, — потому что «не смог проверить» и «проверил и
 * всё хорошо» обязаны выглядеть по-разному.
 *
 * Позитивный контроль (правило 4.1 PROGRESS.md):
 *
 *   --plant   снимает из читаемого текста `sw.ts` строку маршрута и
 *             требует, чтобы проверка покраснела; и отдельно подсаживает
 *             второй маячок на адрес, которого в `sw.ts` нет. Зелёный
 *             `--plant` — это провал сторожа, а не успех.
 *
 *   npm run check:dying-posts
 *   npm run check:dying-posts -- --plant
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Импорт этого файла не должен ни печатать, ни выходить — правило
// src/lib/entry-point.ts, закреплённое src/lib/entry-point.test.ts. Форма
// та же, что у scripts/check-brand-name.mjs.
const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");
const SW_FILE = join(ROOT, "src/app/sw.ts");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mts)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Литерал сразу после открывающей скобки вызова, или `null`. */
function firstStringArgument(source, callIndex) {
  const rest = source.slice(callIndex);
  const open = rest.indexOf("(");
  if (open < 0) return null;
  const match = /^\s*(["'`])([^"'`]*)\1/.exec(rest.slice(open + 1));
  return match ? match[2] : null;
}

/** Экспортируемые функции файла, первый параметр которых называется `url`. */
function urlTakingExports(source) {
  const names = [];
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(\s*url\b/g)) {
    names.push(match[1]);
  }
  return names;
}

/**
 * Отправки, переживающие уход со страницы. `sw.ts` из обхода исключён
 * намеренно: он и есть ответ, а не вопрос.
 */
function findDyingPosts() {
  const files = walk(SRC).filter((file) => file !== SW_FILE);
  const sources = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));

  const direct = [];
  for (const [file, source] of sources) {
    const where = relative(ROOT, file);

    for (const match of source.matchAll(/navigator\.sendBeacon\s*\(/g)) {
      direct.push({ file, where, kind: "sendBeacon", path: firstStringArgument(source, match.index) });
    }

    for (const match of source.matchAll(/\bfetch\s*\(/g)) {
      // Аргументы одного вызова: заглядываем вперёд ровно на длину
      // правдоподобного объекта опций. Длиннее — и `keepalive` соседнего
      // вызова засчитался бы этому.
      const window_ = source.slice(match.index, match.index + 600);
      if (!/keepalive\s*:\s*true/.test(window_)) continue;
      direct.push({ file, where, kind: "fetch keepalive", path: firstStringArgument(source, match.index) });
    }
  }

  const found = [];
  const byFile = new Map();
  for (const post of direct) {
    const list = byFile.get(post.file) ?? [];
    list.push(post);
    byFile.set(post.file, list);
  }

  for (const [file, posts] of byFile) {
    const source = sources.get(file);
    const transports = urlTakingExports(source);
    const allComputed = posts.every((post) => post.path === null);
    if (!(allComputed && transports.length > 0)) {
      found.push(...posts);
      continue;
    }
    // Транспорт: адреса лежат у тех, кто его зовёт.
    const where = relative(ROOT, file);
    let callSites = 0;
    for (const [callerFile, callerSource] of sources) {
      if (callerFile === file) continue;
      for (const name of transports) {
        for (const match of callerSource.matchAll(new RegExp(`\\b${name}\\s*\\(`, "g"))) {
          callSites++;
          found.push({
            file: callerFile,
            where: `${relative(ROOT, callerFile)} → ${name}()`,
            kind: "транспорт keepalive+маячок",
            path: firstStringArgument(callerSource, match.index),
          });
        }
      }
    }
    if (callSites === 0) {
      // Транспорт без единого вызова — это не «ноль проблем», а
      // проверка, которой нечего проверять.
      found.push({ file, where, kind: "транспорт без вызовов", path: null });
    }
  }

  return found;
}

/**
 * Пути, у которых в `sw.ts` есть свой маршрут с методом `POST`.
 *
 * Литералы берутся и прямо из блока `registerCapture`, и из массива-
 * константы, на которую блок ссылается по имени: правило одно на все
 * такие отправки, и записывать его списком правильнее, чем тремя
 * одинаковыми вызовами, — а сторож, умеющий читать только литерал внутри
 * скобок, заставил бы писать хуже, чтобы ему было удобнее.
 */
function routedPaths(swSource) {
  const paths = new Set();
  for (const match of swSource.matchAll(/registerCapture\s*\(([\s\S]*?)\)\s*;/g)) {
    const block = match[1];
    if (!/["']POST["']/.test(block)) continue;
    for (const literal of block.matchAll(/["'`](\/[^"'`]*)["'`]/g)) paths.add(literal[1]);
    for (const identifier of block.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
      const declaration = new RegExp(`const\\s+${identifier[1]}\\s*(?::[^=]*)?=\\s*\\[([\\s\\S]*?)\\]`).exec(swSource);
      if (!declaration) continue;
      for (const literal of declaration[1].matchAll(/["'`](\/[^"'`]*)["'`]/g)) paths.add(literal[1]);
    }
  }
  return paths;
}

function evaluate(posts, swSource) {
  const routed = routedPaths(swSource);
  const problems = [];
  for (const post of posts) {
    if (post.path === null) {
      problems.push(`${post.where}: ${post.kind} по вычисленному адресу — проверить нечем`);
      continue;
    }
    if (!routed.has(post.path)) {
      problems.push(`${post.where}: ${post.kind} на «${post.path}» — в sw.ts нет маршрута POST для этого пути`);
    }
  }
  return { problems, routed };
}

function main() {
  const plant = process.argv.includes("--plant");
  const posts = findDyingPosts();
  const swSource = readFileSync(SW_FILE, "utf8");

  console.log(`отправок, переживающих уход со страницы: ${posts.length}`);
  for (const post of posts) console.log(`  ${post.where} — ${post.kind} → ${post.path ?? "(адрес вычисляется)"}`);

  const { problems, routed } = evaluate(posts, swSource);
  console.log(`маршрутов POST в sw.ts: ${routed.size} (${[...routed].join(", ") || "—"})`);

  if (posts.length === 0) {
    // Пустое множество — не «всё в порядке». Ровно на этом сгорел
    // verify-density-rungs (7.113): проверка на пустом множестве зелёная
    // всегда и не значит ничего.
    console.error("ни одной такой отправки не найдено — либо их нет, либо сломан поиск по src/. Пустое множество не считается зелёным.");
    { process.exitCode = 1; return; }
  }

  if (plant) {
    // Подсадка 1: снять маршрут.
    const withoutRoute = swSource.replace(/serwist\.registerCapture\([\s\S]*?\);/, "");
    // Подсадка 1б: маршрут на месте, но из списка вынут один путь —
    // ровно та правка, которой новая отправка молча теряет свою строку.
    const withoutOnePath = swSource.replace('"/api/word-games/complete",', "");
    const one = evaluate(posts, withoutRoute).problems;
    // Подсадка 2: второй маячок, адреса которого в sw.ts нет.
    const two = evaluate([...posts, { where: "(подсадка)", kind: "sendBeacon", path: "/api/zz-нет-такого" }], swSource).problems;
    const three = evaluate([...posts, { where: "(подсадка)", kind: "sendBeacon", path: null }], swSource).problems;
    const four = evaluate(posts, withoutOnePath).problems;
    console.log(`подсадка «снят маршрут»: ${one.length > 0 ? "покраснела" : "ЗЕЛЁНАЯ — сторож слеп"}`);
    console.log(`подсадка «вынут один путь из списка»: ${four.length > 0 ? "покраснела" : "ЗЕЛЁНАЯ — сторож слеп"}`);
    console.log(`подсадка «второй маячок»: ${two.length > 0 ? "покраснела" : "ЗЕЛЁНАЯ — сторож слеп"}`);
    console.log(`подсадка «вычисленный адрес»: ${three.length > 0 ? "покраснела" : "ЗЕЛЁНАЯ — сторож слеп"}`);
    if (one.length === 0 || two.length === 0 || three.length === 0 || four.length === 0) { process.exitCode = 1; return; }
    console.log("4 из 4 подсадок пойманы");
    { process.exitCode = 0; return; }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    { process.exitCode = 1; return; }
  }
  console.log(`✔ ${posts.length} из ${posts.length}: у каждой отправки есть свой маршрут POST в sw.ts`);

}

if (IS_ENTRY_POINT) main();
