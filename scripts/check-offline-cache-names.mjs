// ИМЯ КЕША, КОТОРОЕ ИЩЕТ КАРКАС, ОБЯЗАНО НАХОДИТЬ КЕШ, КОТОРЫЙ ПИШЕТ САЙТ
// (заход 7.230, ОФЛАЙН-2б, строка 309).
//
// ПОЧЕМУ ЭТОТ СТОРОЖ ВООБЩЕ ЗАВЕДЁН. Заход 7.229 закрыл строку 307 и
// собрал приборы, но ни один из них не сличал ДВЕ СТОРОНЫ ОДНОГО ИМЕНИ:
// каркас `public/offline.html` зашит в пакет приложения (собирается на
// другой машине и в другой день), а кеши наполняет сайт на Vercel. Между
// ними нет ни импорта, ни общего модуля — только два текста, и разойтись
// они могут молча. Владелец 25.09.2026 увидел ровно молчаливый разрыв:
// каркас, каркас и ещё раз каркас, без единой синей полосы.
//
// ЧТО ПРОВЕРЯЕТСЯ — восемь утверждений.
//
//  1. Каркас ищет кеши по ЖИВОМУ списку `caches.keys()`, а не по зашитому
//     имени: отпечаток сборки в имени обязателен (долг 14, строка 308), и
//     знай каркас «свой» отпечаток, он перестал бы находить кеш после
//     первого же выката сайта — молча.
//  2. Каждое имя, которое строит `pageCacheNames` для документов
//     (`html`, `content`, `section`), ЛОВИТСЯ хотя бы одной регуляркой
//     каркаса. Это и есть «то, что пишет сайт, каркас находит».
//  3. Чужие имена (`rf-audio`, precache Serwist, кеш другого приложения)
//     каркасом НЕ ловятся: сторож, который говорит «да» на всё, не
//     сторож.
//  4. Кеш содержания спрашивается раньше кеша разделов, а тот — раньше
//     общего: у них разные потолки и разные сроки.
//  5. Вид страницы каркас и сайт определяют ОДИНАКОВО — таблица адресов
//     прогоняется через регулярки обоих файлов, и расхождение краснеет.
//  6. Адрес описи (`OFFLINE_INDEX_PATH`) в обоих файлах один и тот же.
//  7. Опись не совпадает ни с одной страницей сайта: иначе читалка
//     однажды показала бы человеку JSON вместо урока.
//  8. Потолки, по которым страница чистит сохранённое, берутся из той же
//     таблицы бюджетов, что и потолки воркера, а не объявлены второй раз.
//
//   node scripts/check-offline-cache-names.mjs
//   node scripts/check-offline-cache-names.mjs --plant
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");

const SHELL = "public/offline.html";
const NAMES = "src/lib/sw-cache-names.ts";
const POLICY = "src/lib/sw-cache-policy.ts";
const SAVE = "src/lib/offline-save.ts";
const CLIENT = "src/lib/offline-save-client.ts";

const read = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
};

const withoutHtmlComments = (html) => html.replace(/<!--[\s\S]*?-->/g, " ");
const withoutJsComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Отпечаток, которого нет ни в одном файле: имена строятся с ним, чтобы
 *  совпадение не могло выйти случайно из какой-нибудь литеральной строки. */
const FINGERPRINT = "zq7v3k";

/** Имена кешей документов, которые СТРОИТ САЙТ, — прочитанные из
 *  `pageCacheNames`, а не переписанные сюда руками. */
export function siteCacheNames(namesSource) {
  const body = /export function pageCacheNames\([^)]*\)\s*\{([\s\S]*?)\n\}/.exec(namesSource)?.[1] ?? "";
  const prefix = /export const PAGE_CACHE_PREFIX = "([^"]+)"/.exec(namesSource)?.[1] ?? "";
  if (!body || !prefix) return {};
  const out = {};
  const line = /(\w+):\s*`\$\{PAGE_CACHE_PREFIX\}-?([a-z-]*)\$\{fingerprint\}`/g;
  let match;
  while ((match = line.exec(body)) !== null) {
    out[match[1]] = `${prefix}-${match[2]}${FINGERPRINT}`.replace(/--+/g, "-");
  }
  return out;
}

/** Регулярки, которыми каркас отбирает кеши документов. */
export function shellCacheMatchers(shellSource) {
  const body = /function documentCacheNames\(names\)\s*\{([\s\S]*?)\n        \}/.exec(shellSource)?.[1] ?? "";
  const found = [...body.matchAll(/\/(\^rf-[^/]+\$)\//g)].map((m) => m[1]);
  const order = [...body.matchAll(/\/\^rf-pages-([a-z-]*)\[/g)].map((m) => m[1].replace(/-$/, ""));
  return { patterns: found, order, body };
}

/** Таблица адресов, на которой сличаются два определения вида. */
const PATHS = [
  ["/ru/courses/a1/1", "lesson"],
  ["/es/courses/b2/12", "lesson"],
  ["/es/stories/snegurochka", "story"],
  ["/ru/vocabulary", "vocabulary"],
  ["/es/vocabulary/comida", "vocabulary"],
  ["/es/courses", "section"],
  ["/ru/stories", "section"],
  ["/es/word-games", null],
  ["/ru/profile", null],
  ["/es", null],
  ["/__rf-offline-index", null],
];

function kindBySite(policy, path) {
  const content = /const CONTENT_PATH = (\/.*\/);/.exec(policy)?.[1];
  const section = /const SECTION_PATH = (\/.*\/);/.exec(policy)?.[1];
  if (!content || !section) return "НЕ ПРОЧИТАНО";
  const isContent = new RegExp(content.slice(1, -1)).test(path);
  const isSection = new RegExp(section.slice(1, -1)).test(path);
  if (!isContent) return isSection ? "section" : null;
  if (/^\/(es|ru)\/courses\//.test(path)) return "lesson";
  if (/^\/(es|ru)\/stories\//.test(path)) return "story";
  return "vocabulary";
}

function kindByShell(shell, path) {
  const body = /function kindOfPath\(path\)\s*\{([\s\S]*?)\n        \}/.exec(shell)?.[1];
  if (!body) return "НЕ ПРОЧИТАНО";
  const rules = [...body.matchAll(/if \((\/.*?\/)\.test\(path\)\) return "([a-z]+)";/g)];
  for (const [, source, kind] of rules) {
    if (new RegExp(source.slice(1, -1)).test(path)) return kind;
  }
  return null;
}

export function violations(sources) {
  const bad = [];
  const shell = withoutHtmlComments(sources[SHELL] ?? "");
  const names = withoutJsComments(sources[NAMES] ?? "");
  const policy = withoutJsComments(sources[POLICY] ?? "");
  const save = withoutJsComments(sources[SAVE] ?? "");
  const client = withoutJsComments(sources[CLIENT] ?? "");

  if (!shell.trim() || !names.trim() || !policy.trim()) {
    bad.push("одного из файлов нет — сличать нечего");
    return bad;
  }

  // 1
  if (!/caches\s*\.\s*keys\s*\(/.test(shell)) {
    bad.push(
      `${SHELL}: каркас не берёт имена кешей из живого списка caches.keys() — с зашитым именем он перестанет находить сохранённое после первого же выката сайта, и никто об этом не узнает (строка 308)`,
    );
  }

  const site = siteCacheNames(names);
  const { patterns, order } = shellCacheMatchers(shell);
  if (patterns.length === 0) {
    bad.push(`${SHELL}: в documentCacheNames не нашлось ни одной регулярки имени кеша — каркас ищет вслепую`);
    return bad;
  }
  const matches = (name) => patterns.some((p) => new RegExp(p).test(name));

  // 2
  for (const key of ["html", "content", "section"]) {
    const name = site[key];
    if (!name) {
      bad.push(`${NAMES}: pageCacheNames не строит имя «${key}» — половина сохранённого окажется в кеше, которого никто не ищет`);
      continue;
    }
    if (!matches(name)) {
      bad.push(
        `${SHELL}: имя «${name}», под которым пишет САЙТ ТОЙ ЖЕ СБОРКИ, не ловится ни одной регуляркой каркаса — сохранённое лежит на телефоне и недостижимо (ровно видео владельца 25.09.2026)`,
      );
    }
  }

  // 3
  for (const foreign of ["rf-audio", "serwist-precache-v2-https://rusofacilapp.com/", "rf-pages", "other-app-pages-zq7v3k"]) {
    if (matches(foreign)) {
      bad.push(`${SHELL}: каркас считает кешем документов чужое имя «${foreign}» — сторож, который говорит «да» на всё, не сторож`);
    }
  }

  // 4
  const expected = ["content", "section", ""];
  if (order.join(",") !== expected.join(",")) {
    bad.push(
      `${SHELL}: порядок кешей «${order.join(",") || "пусто"}», а обязан быть «content, section, общий» — у них разные потолки и разные сроки, и содержание обязано побеждать`,
    );
  }

  // 5
  for (const [path, expectedKind] of PATHS) {
    const bySite = kindBySite(policy, path);
    const byShell = kindByShell(shell, path);
    if (bySite !== expectedKind) {
      bad.push(`${POLICY}: адрес ${path} считается «${bySite}», а обязан «${expectedKind}»`);
    }
    if (byShell !== expectedKind) {
      bad.push(`${SHELL}: адрес ${path} считается «${byShell}», а обязан «${expectedKind}» — каркас и сайт разошлись в том, что чем является`);
    }
  }

  // 6
  const sitePath = /export const OFFLINE_INDEX_PATH = "([^"]+)"/.exec(save)?.[1] ?? "";
  const shellPath = /var INDEX_PATH = "([^"]+)"/.exec(shell)?.[1] ?? "";
  if (!sitePath || sitePath !== shellPath) {
    bad.push(
      `${SHELL}: адрес описи у каркаса «${shellPath}», у сайта «${sitePath}» — список «Guardado en este teléfono» окажется пустым при полном телефоне`,
    );
  }

  // 7
  if (sitePath && kindBySite(policy, sitePath) !== null) {
    bad.push(`${SAVE}: адрес описи совпадает со страницей сайта — читалка однажды покажет человеку JSON вместо урока`);
  }

  // 8
  if (!/CACHE_BUDGET_BY_KEY/.test(save)) {
    bad.push(`${SAVE}: потолки сохранённого объявлены мимо таблицы бюджетов — два числа в двух файлах разойдутся молча (тот же класс, что долг 75)`);
  }
  if (!/rf-cache-names/.test(client)) {
    bad.push(`${CLIENT}: страница не спрашивает имена кешей у воркера — значит угадывает отпечаток сборки, а угадать его нечем`);
  }

  return bad;
}

function load() {
  return Object.fromEntries([SHELL, NAMES, POLICY, SAVE, CLIENT].map((p) => [p, read(p)]));
}

function plant() {
  const live = load();
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(live).length === 0 }];
  const add = (name, file, mutate, expect) => {
    const mutated = { ...live, [file]: mutate(live[file]) };
    if (mutated[file] === live[file]) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(mutated).some((x) => x.includes(expect)) });
  };

  add(
    "подсадка: сайт переименовал кеш содержания, каркас об этом не знает",
    NAMES,
    (s) => s.replace("content: `${PAGE_CACHE_PREFIX}-content-${fingerprint}`", "content: `${PAGE_CACHE_PREFIX}-saved-${fingerprint}`"),
    "не ловится ни одной регуляркой каркаса",
  );
  add(
    "подсадка: сайт завёл кеш разделов, а каркас его не ищет",
    SHELL,
    (s) => s.replace('/^rf-pages-section-[a-z0-9]+$/', '/^rf-pages-nothing-[a-z0-9]+$/'),
    "не ловится ни одной регуляркой каркаса",
  );
  add(
    "подсадка: каркас ищет ЗАШИТЫЙ отпечаток — молчаливая смерть после выката",
    SHELL,
    (s) => s.replace(/caches\s*\.\s*keys\(/g, "Object.keys("),
    "не берёт имена кешей из живого списка",
  );
  add(
    "подсадка: регулярка каркаса стала всеядной",
    SHELL,
    (s) => s.replace('/^rf-pages-[a-z0-9]+$/', '/^rf-[a-z0-9-]*$/'),
    "чужое имя",
  );
  add(
    "подсадка: общий кеш документов спрашивается раньше содержания",
    SHELL,
    (s) =>
      s.replace(
        'if (/^rf-pages-content-[a-z0-9]+$/.test(names[i])) content.push(names[i]);\n            else if (/^rf-pages-section-[a-z0-9]+$/.test(names[i])) section.push(names[i]);\n            else if (/^rf-pages-[a-z0-9]+$/.test(names[i])) pages.push(names[i]);',
        'if (/^rf-pages-[a-z0-9]+$/.test(names[i])) pages.push(names[i]);\n            else if (/^rf-pages-content-[a-z0-9]+$/.test(names[i])) content.push(names[i]);\n            else if (/^rf-pages-section-[a-z0-9]+$/.test(names[i])) section.push(names[i]);',
      ),
    "порядок кешей",
  );
  add(
    "подсадка: сайт и каркас разошлись в том, что такое рассказ",
    SHELL,
    (s) => s.replace('if (/^\\/(es|ru)\\/stories\\/[^/]+\\/?$/.test(path)) return "story";', 'if (/^\\/(es|ru)\\/nothing\\/[^/]+\\/?$/.test(path)) return "story";'),
    "каркас и сайт разошлись",
  );
  add(
    "подсадка: адрес описи разъехался",
    SHELL,
    (s) => s.replace('var INDEX_PATH = "/__rf-offline-index"', 'var INDEX_PATH = "/__rf-index"'),
    "адрес описи",
  );
  add(
    "подсадка: опись стала совпадать со страницей сайта",
    SAVE,
    (s) => s.replace('export const OFFLINE_INDEX_PATH = "/__rf-offline-index"', 'export const OFFLINE_INDEX_PATH = "/ru/vocabulary"'),
    "совпадает со страницей сайта",
  );
  add(
    "подсадка: потолки сохранённого объявлены вторым числом мимо таблицы",
    SAVE,
    (s) => s.replace(/CACHE_BUDGET_BY_KEY/g, "LOCAL_BUDGETS"),
    "мимо таблицы бюджетов",
  );
  add(
    "подсадка: страница перестала спрашивать имена у воркера и угадывает отпечаток",
    CLIENT,
    (s) => s.replace(/rf-cache-names/g, "rf-guessed-names"),
    "не спрашивает имена кешей у воркера",
  );

  for (const c of cases) {
    console.log(`  ${c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО"} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(
    ok
      ? `check:offline-cache-names --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль`
      : "check:offline-cache-names --plant — FAILED",
  );
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(load());
  if (bad.length) {
    console.error(`check:offline-cache-names — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:offline-cache-names — 8 правил, нарушений 0 (заход 7.230, офлайн-2б)");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
