/**
 * «Одноразовый токен не стоит в строке запроса» — сторож долга 164
 * (заход 7.187).
 *
 * ЧТО БЫЛО. Ссылка из письма выглядела как
 * `…/reset-password?token=<действующий токен>`, а браузерный SDK Sentry
 * включён на проде (`sentry-environment=vercel-production` в HTML) и
 * прикладывает ПОЛНЫЙ адрес страницы к каждому событию. Любая ошибка на
 * той странице — и токен сброса пароля уехал в чужое хранилище. Тем же
 * способом уезжал токен подтверждения УДАЛЕНИЯ учётной записи: тот же
 * класс, найден тем же чтением, чинится той же правкой.
 *
 * ПРАВИЛО, три части, и порознь ни одна не закрывает дыру:
 *
 *  1) ни один файл под `src/` не строит адрес с `?token=` и не ставит
 *     `searchParams.set("token", …)`;
 *  2) обе страницы, принимающие токен, берут его из ФРАГМЕНТА
 *     (`HashTokenForm`), а не из `searchParams`;
 *  3) обе точки Sentry чистят адреса (`scrubTokensFromEvent`) — вторая
 *     стена на те миллисекунды, пока фрагмент ещё не стёрт из адреса.
 *
 * СТРОКОВЫЕ ЛИТЕРАЛЫ НЕ СНИМАЮТСЯ, А КОММЕНТАРИИ СНИМАЮТСЯ — и это не
 * половинчатость, а единственное верное деление: адрес с токеном и ЕСТЬ
 * строковый литерал, снять его значило бы ослепить сторож ровно на том,
 * за чем он поставлен; а объяснение в комментарии (вроде того, что вы
 * читаете) нарушением не является и ронять сборку не должно.
 *
 *   node scripts/check-reset-token-not-in-url.mjs          # гейт
 *   node scripts/check-reset-token-not-in-url.mjs --plant  # позитивный и отрицательный контроль
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const PLANT = process.argv.slice(2).includes("--plant");

/** Токен в СТРОКЕ ЗАПРОСА, в обеих написанных формах. */
const IN_QUERY = [
  { re: /[?&]token=/, why: "адрес с токеном в строке запроса" },
  { re: /searchParams\s*\.\s*set\s*\(\s*["']token["']/, why: "токен дописан в строку запроса" },
];
/** Чтение токена страницей ИЗ строки запроса. */
const READ_FROM_QUERY = /query\.token|searchParams\.get\(\s*["']token["']\s*\)/;

const TOKEN_PAGES = [
  "src/app/[lang]/reset-password/page.tsx",
  "src/app/[lang]/confirm-delete-account/page.tsx",
];
const SENTRY_POINTS = ["sentry.client.config.ts", "sentry.server.config.ts"];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full) && !/\.(test|spec)\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/** Снимает комментарии (и только их), сохраняя число строк. */
export function stripComments(source) {
  const out = source.split("");
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i++) if (out[i] !== "\n") out[i] = " ";
  };
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      let j = i;
      while (j < n && source[j] !== "\n") j++;
      blank(i, j);
      i = j;
    } else if (c === "/" && next === "*") {
      let j = source.indexOf("*/", i + 2);
      j = j === -1 ? n : j + 2;
      blank(i, j);
      i = j;
    } else if (c === '"' || c === "'" || c === "`") {
      // Литерал ПРОПУСКАЕТСЯ целиком и остаётся нетронутым — см. шапку.
      let j = i + 1;
      while (j < n) {
        if (source[j] === "\\") { j += 2; continue; }
        if (source[j] === c) { j++; break; }
        j++;
      }
      i = j;
    } else {
      i++;
    }
  }
  return out.join("");
}

/** Находки в одном файле — вынесено, чтобы подсадка меряла ту же функцию. */
export function hitsIn(rawSource, path) {
  const hits = [];
  stripComments(rawSource).split("\n").forEach((line, idx) => {
    for (const { re, why } of IN_QUERY) {
      if (re.test(line)) hits.push({ path, line: idx + 1, why, text: line.trim().slice(0, 120) });
    }
  });
  return hits;
}

function scan() {
  const files = walk(join(ROOT, "src"));
  const hits = [];
  for (const f of files) hits.push(...hitsIn(readFileSync(f, "utf8"), relative(ROOT, f)));
  return { files: files.length, hits };
}

function structure() {
  const bad = [];
  for (const page of TOKEN_PAGES) {
    const src = readFileSync(join(ROOT, page), "utf8");
    if (!/HashTokenForm/.test(src)) bad.push(`${page}: токен берётся не из фрагмента (нет HashTokenForm)`);
    if (READ_FROM_QUERY.test(src)) bad.push(`${page}: страница снова читает токен из строки запроса`);
  }
  for (const point of SENTRY_POINTS) {
    const src = readFileSync(join(ROOT, point), "utf8");
    if (!/scrubTokensFromEvent/.test(src)) bad.push(`${point}: адреса событий не чистятся — вторая стена снята`);
  }
  return bad;
}

function plant() {
  const cases = [];
  const say = (name, ok) => cases.push({ name, ok });

  say(
    "подсадка: НАСТОЯЩАЯ старая строка письма — поймана",
    hitsIn("const resetUrl = `${origin}/${lang}/reset-password" + "?token=" + "${encodeURIComponent(t)}`;", "x.ts").length === 1,
  );
  say(
    "подсадка: возврат токена через searchParams.set — пойман",
    hitsIn('url.searchParams.set("token", token);', "x.ts").length === 1,
  );
  say(
    "подсадка: токен вторым параметром (&token=) — пойман",
    hitsIn("const u = `/x?error=1" + "&token=" + "${t}`;", "x.ts").length === 1,
  );
  say(
    "отрицательный контроль: фрагмент нарушением НЕ считается",
    hitsIn("const resetUrl = `${origin}/${lang}/reset-password#token=${encodeURIComponent(t)}`;", "x.ts").length === 0,
  );
  say(
    "отрицательный контроль: скрытое поле формы нарушением НЕ считается",
    hitsIn('<input type="hidden" name="token" value={token} />', "x.tsx").length === 0,
  );
  say(
    "отрицательный контроль: объяснение в комментарии нарушением НЕ считается",
    hitsIn("// ссылка выглядела как /reset-password" + "?token=" + "<токен>\nconst x = 1;", "x.ts").length === 0,
  );
  say(
    "подсадка: тот же адрес, но КОДОМ, а не комментарием — пойман",
    hitsIn("const u = \"/reset-password" + "?token=\" + t;", "x.ts").length === 1,
  );
  say("отрицательный контроль: живой src/ сегодня чист", scan().hits.length === 0);
  say("отрицательный контроль: структура сегодня на месте", structure().length === 0);

  // Подсадки в структуру — на НАСТОЯЩИХ файлах.
  const page = readFileSync(join(ROOT, TOKEN_PAGES[0]), "utf8");
  say("подсадка: страница снова читает токен из query — поймана", READ_FROM_QUERY.test(page + '\nconst token = query.token;'));
  const sentry = readFileSync(join(ROOT, SENTRY_POINTS[0]), "utf8");
  say("подсадка: чистку событий сняли — поймано", !/scrubTokensFromEvent/.test(sentry.replaceAll("scrubTokensFromEvent", "identity")));

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:reset-token --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const { files, hits } = scan();
  if (files === 0) {
    console.error("проверять нечего: в src/ не нашлось ни одного файла — пустое множество результатом не считается");
    return 1;
  }
  const bad = structure();
  console.log(`[check:reset-token] файлов просмотрено: ${files}`);
  if (hits.length || bad.length) {
    console.error("\nОДНОРАЗОВЫЙ ТОКЕН СНОВА В АДРЕСЕ (долг 164):");
    for (const h of hits) console.error(`  ${h.path}:${h.line} ${h.why} — ${h.text}`);
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("токенов в строке запроса 0; обе страницы читают фрагмент, обе точки Sentry чистят адреса (контроль — --plant).");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
