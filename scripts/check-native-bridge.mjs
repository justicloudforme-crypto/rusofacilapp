// МОСТ И МАРШРУТЫ ОБОЛОЧКИ ТОЛЬКО ДОБАВЛЯЮТСЯ, НЕ УДАЛЯЮТСЯ — правилом, а
// не просьбой в комментарии.
//
// ЗАЧЕМ (заход 7.189, долг 173 → пункт 4 части 2). У нативной оболочки есть
// класс правок, у которых цена не видна ни в одном обычном прогоне: снять
// один хост из `allowNavigation` — и переход, который раньше оставался в
// приложении, уедет в системный браузер (ровно этот отказ приходил с живого
// устройства и описан в `capacitor.config.ts`); снять плагин из `plugins` —
// и нативная настройка перестанет применяться, а ошибки не будет; снять
// пакет плагина из `package.json` — и вызов молча уйдёт в веб-заглушку.
// Ни лес, ни типы, ни один браузерный прогон этого не увидят: код
// компилируется, страницы рендерятся, падать нечему. Увидит это владелец
// на телефоне — через несколько дней после мержа, если повезёт.
//
// Просьба «не удаляйте» в комментарии от этого не спасает: комментарии в
// этом файле уже стоят, и ровно их наличие и есть повод написать правило.
//
// ЧТО ИМЕННО СЧИТАЕТСЯ МОСТОМ. Четыре множества, все читаются из кода:
//   routes   — хосты `server.allowNavigation` (литералы);
//   server   — ключи блока `server` (`url`, `cleartext`, `errorPath`, …);
//   plugins  — имена блоков в `plugins` конфига;
//   packages — пакеты плагинов из `dependencies` (`@capacitor/*`,
//              `@capgo/*`, `*-capacitor*`).
//
// ТРИ НАПРАВЛЕНИЯ, И КАЖДОЕ ОБЯЗАНО КРАСНЕТЬ.
//   1. базовый список ⊆ код — запись исчезла из кода: УДАЛЕНИЕ;
//   2. код ⊆ базовый список — запись появилась в коде и не записана:
//      добавлять можно, молча — нельзя, иначе через месяц правило стережёт
//      половину моста и об этом никто не знает;
//   3. базовый список в `HEAD` ⊆ базовый список на диске — иначе правило
//      обходится в одну строку: удалить запись И из кода, И из базового
//      списка. Поэтому сам базовый список тоже только дописывается, и это
//      проверяется по git, а не по доверию.
//
// Контроль: `node scripts/check-native-bridge.mjs --plant`.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

const CAP_CONFIG = "capacitor.config.ts";
const BASELINE = "docs/native-bridge-baseline-2026-09-13.json";
const PACKAGE_RE = /^(@capacitor\/|@capgo\/)|capacitor/i;

/** Тот же отрез комментариев, что в scripts/check-native-shell.mjs, и по
 *  той же причине: закомментированная настройка для регэкспа неотличима от
 *  живой (7.178, 7.181). Объявлен здесь заново намеренно — сторож обязан
 *  судить о файле, ничего из проверяемого дерева не импортируя. */
function stripComments(text) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** Тело блока по имени ключа, с учётом вложенных скобок. Регэкспом до
 *  закрывающей скобки взять нельзя: у `plugins` внутри ещё два блока. */
function blockBody(text, key) {
  const start = text.indexOf(`${key}: {`);
  if (start < 0) return null;
  let depth = 0;
  for (let i = text.indexOf("{", start); i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(text.indexOf("{", start) + 1, i);
    }
  }
  return null;
}

function currentSurface() {
  const cap = stripComments(readFileSync(CAP_CONFIG, "utf8"));
  const server = blockBody(cap, "server") ?? "";
  const plugins = blockBody(cap, "plugins") ?? "";

  const navLine = server.match(/allowNavigation:\s*\[([\s\S]*?)\]/);
  const routes = navLine ? [...navLine[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];

  // Ключи ВЕРХНЕГО уровня блока: отступ ровно четыре пробела в этом файле.
  const serverKeys = [...server.matchAll(/^\s{4}([A-Za-z]\w*):/gm)].map((m) => m[1]);
  const pluginNames = [...plugins.matchAll(/^\s{4}([A-Z]\w*):\s*\{/gm)].map((m) => m[1]);

  const deps = Object.keys(JSON.parse(readFileSync("package.json", "utf8")).dependencies ?? {});
  const packages = deps.filter((d) => PACKAGE_RE.test(d));

  return {
    routes: [...new Set(routes)].sort(),
    server: [...new Set(serverKeys)].sort(),
    plugins: [...new Set(pluginNames)].sort(),
    packages: [...new Set(packages)].sort(),
  };
}

const GROUPS = [
  ["routes", "хост в `server.allowNavigation`", "переход по нему уедет в системный браузер вместо приложения"],
  ["server", "ключ блока `server`", "настройка перестанет применяться, и ошибки при этом не будет"],
  ["plugins", "нативный плагин в `plugins`", "его нативная настройка перестанет применяться молча"],
  ["packages", "пакет плагина в `dependencies`", "вызов молча уйдёт в веб-заглушку или упадёт только на устройстве"],
];

/** Базовый список таким, каким он лежит В ИСТОРИИ, либо «истории ещё нет».
 *
 *  Спрашивается сначала `origin/main`, потом `HEAD`. Порядок именно такой, и
 *  он не декоративный: правило обходится удалением записи И из кода, И из
 *  базового списка ОДНИМ коммитом — против такого обхода `HEAD` бесполезен
 *  (в нём уже лежит урезанный список), а `origin/main` — нет. `HEAD` остаётся
 *  второй линией для прогона без сети и без настроенного upstream.
 *
 *  «Истории ещё нет» (ветка, в которой файл только создан, и в `origin/main`
 *  его пока нет) — не отказ, а ПРЕДУПРЕЖДЕНИЕ вслух: прогон без третьего
 *  направления слабее полного, и молчать об этом нельзя. После мержа в `main`
 *  третье направление включается само. */
function baselineInHistory() {
  for (const ref of ["origin/main", "HEAD"]) {
    try {
      const raw = execFileSync("git", ["show", `${ref}:${BASELINE}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { ref, parsed: JSON.parse(raw) };
    } catch {
      // Этой версии файла нет — пробуем следующую ссылку.
    }
  }
  return null;
}

/**
 * @param historyOverride Версия базового списка «из истории», подставленная
 *   вместо git. Единственный её потребитель — позитивный контроль: третье
 *   направление сравнивает диск с историей, а в ветке, где файл только
 *   создан, истории ещё нет — и подсадка не имела бы чему противоречить.
 *   Сравнение при этом остаётся продуктовым: подставляется ВХОД, а не
 *   ответ. Шов назван, а не спрятан.
 */
function scan(historyOverride = null) {
  const failures = [];
  const current = currentSurface();
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  } catch (error) {
    return {
      failures: [
        `${BASELINE} не читается (${String(error).slice(0, 80)}). Базовый список моста — ` +
          `часть правила, а не справка: без него проверять нечего, и удаление файла ` +
          `обходило бы правило целиком.`,
      ],
      current,
      counts: {},
      removed: 0,
      added: 0,
    };
  }
  const history = historyOverride ?? baselineInHistory();
  const counts = {};
  let removed = 0;
  let added = 0;

  for (const [group, what, cost] of GROUPS) {
    const base = baseline[group] ?? [];
    const now = current[group] ?? [];
    counts[group] = `${now.length}/${base.length}`;
    for (const entry of base) {
      if (now.includes(entry)) continue;
      removed += 1;
      failures.push(
        `УДАЛЕНО: ${what} «${entry}» был в ${BASELINE} и в коде его больше нет. ` +
          `Цена такой правки: ${cost}. Мост и маршруты оболочки только добавляются — ` +
          `если удаление действительно нужно, это решение владельца, а не правка по дороге.`,
      );
    }
    for (const entry of now) {
      if (base.includes(entry)) continue;
      added += 1;
      failures.push(
        `НЕ ЗАПИСАНО: ${what} «${entry}» есть в коде и нет в ${BASELINE}. ` +
          `Добавлять можно, молча — нельзя: незаписанную запись это правило завтра не защитит.`,
      );
    }
  }

  if (history === null) {
    counts.history = `${BASELINE} ещё нет ни в origin/main, ни в HEAD — третье направление в этом прогоне не проверялось`;
  } else {
    for (const [group] of GROUPS) {
      for (const entry of history.parsed[group] ?? []) {
        if ((baseline[group] ?? []).includes(entry)) continue;
        failures.push(
          `ИЗ САМОГО БАЗОВОГО СПИСКА УДАЛЕНО: «${entry}» (${group}) есть в ${history.ref} и нет на диске. ` +
            `Список только дописывается — это и есть вторая половина правила, и без неё оно обходится ` +
            `удалением записи сразу из двух мест.`,
        );
      }
    }
    counts.history = `третье направление проверено против ${history.ref}`;
  }

  return { failures, current, counts, removed, added };
}

function report(r) {
  if (r.failures.length) {
    console.error("check:native-bridge — ОТКАЗ\n");
    for (const f of r.failures) console.error(`  ${f}\n`);
    return false;
  }
  console.log("check:native-bridge — мост и маршруты оболочки на месте, удалённых 0.");
  for (const [group] of GROUPS) {
    console.log(`  ${group.padEnd(9)} ${r.counts[group]} (в коде / в базовом списке): ${r.current[group].join(", ")}`);
  }
  if (r.counts.history) console.log(`  ВНИМАНИЕ: ${r.counts.history}`);
  return true;
}

function plantControls() {
  const swap = (file, from, to) => {
    const before = readFileSync(file, "utf8");
    if (!before.includes(from)) throw new Error(`подсадка не нашла «${from.slice(0, 60)}» в ${file}`);
    writeFileSync(file, before.replace(from, to));
    return () => writeFileSync(file, before);
  };
  /** Подставная «версия из истории» для подсадки третьего направления:
   *  снимок базового списка, сделанный ДО того, как подсадка его урезала. */
  let history = null;
  const dropFromBaseline = (group, entry) => {
    const before = readFileSync(BASELINE, "utf8");
    const parsed = JSON.parse(before);
    parsed[group] = parsed[group].filter((x) => x !== entry);
    writeFileSync(BASELINE, `${JSON.stringify(parsed, null, 2)}\n`);
    return () => writeFileSync(BASELINE, before);
  };

  const controls = [
    {
      name: "УДАЛЕНИЕ: хост убран из allowNavigation — переход уедет в системный браузер",
      plant: () => swap(CAP_CONFIG, '"rusofacilapp.com", "*.rusofacilapp.com"', '"rusofacilapp.com"'),
      expect: (r) => r.failures.some((m) => m.startsWith("УДАЛЕНО") && m.includes("*.rusofacilapp.com")),
    },
    {
      name: "УДАЛЕНИЕ: ключ errorPath убран из блока server",
      plant: () => swap(CAP_CONFIG, 'errorPath: "error.html",', ""),
      expect: (r) => r.failures.some((m) => m.startsWith("УДАЛЕНО") && m.includes("errorPath")),
    },
    {
      name: "УДАЛЕНИЕ: плагин StatusBar убран из конфига",
      plant: () => swap(CAP_CONFIG, "    StatusBar: {", "    XStatusBar: {"),
      expect: (r) => r.failures.some((m) => m.startsWith("УДАЛЕНО") && m.includes("StatusBar")),
    },
    {
      name: "УДАЛЕНИЕ: пакет плагина убран из dependencies",
      plant: () => swap("package.json", '"@capacitor/haptics":', '"haptics-removed":'),
      expect: (r) => r.failures.some((m) => m.startsWith("УДАЛЕНО") && m.includes("@capacitor/haptics")),
    },
    {
      name: "ЗАКОММЕНТИРОВАННАЯ запись не считается живой (класс 7.178 и 7.181)",
      plant: () => swap(CAP_CONFIG, '    errorPath: "error.html",', '    // errorPath: "error.html",'),
      expect: (r) => r.failures.some((m) => m.startsWith("УДАЛЕНО") && m.includes("errorPath")),
    },
    {
      name: "НЕ ЗАПИСАНО: новый хост появился в коде и не внесён в базовый список",
      plant: () => swap(CAP_CONFIG, '"rusofacilapp.com", "*.rusofacilapp.com"', '"rusofacilapp.com", "*.rusofacilapp.com", "cdn.example.net"'),
      expect: (r) => r.failures.some((m) => m.startsWith("НЕ ЗАПИСАНО") && m.includes("cdn.example.net")),
    },
    {
      name: "ОБХОД ПРАВИЛА: запись удалена И из кода, И из базового списка — ловится по git",
      plant: () => {
        history = JSON.parse(readFileSync(BASELINE, "utf8"));
        const undoCode = swap(CAP_CONFIG, '"rusofacilapp.com", "*.rusofacilapp.com"', '"rusofacilapp.com"');
        const undoBase = dropFromBaseline("routes", "*.rusofacilapp.com");
        return () => {
          undoBase();
          undoCode();
          history = null;
        };
      },
      expect: (r) => r.failures.some((m) => m.startsWith("ИЗ САМОГО БАЗОВОГО СПИСКА УДАЛЕНО") && m.includes("*.rusofacilapp.com")),
    },
    {
      name: "ОТРИЦАТЕЛЬНЫЙ: здоровое дерево — удалённых 0 и незаписанных 0",
      plant: () => () => {},
      expect: (r) => r.failures.length === 0 && r.removed === 0 && r.added === 0,
      negative: true,
    },
  ];

  let ok = true;
  let pos = 0;
  let neg = 0;
  for (const c of controls) {
    const undo = c.plant();
    let caught;
    try {
      caught = c.expect(scan(history === null ? null : { ref: "подставленный снимок истории", parsed: history }));
    } finally {
      undo();
    }
    const verb = c.negative ? (caught ? "промолчал" : "ЛОЖНО КРАСНЫЙ") : caught ? "поймано" : "ПРОПУЩЕНО";
    console.log(`  ${verb} — ${c.name}`);
    if (caught) {
      if (c.negative) neg++;
      else pos++;
    }
    ok &&= caught;
  }
  const clean = scan().failures.length === 0;
  console.log(`  ${clean ? "чисто" : "ВСЁ ЕЩЁ ГРЯЗНО"} — после отката всех подсадок`);
  ok &&= clean;
  const positives = controls.filter((c) => !c.negative).length;
  console.log(
    ok
      ? `check:native-bridge --plant — ${pos} из ${positives} подсадок поймано, ${neg} из ${controls.length - positives} отрицательных контролей промолчали`
      : "check:native-bridge --plant — FAILED",
  );
  return ok;
}

if (IS_ENTRY_POINT) {
  const ok = process.argv.includes("--plant") ? plantControls() : report(scan());
  process.exitCode = ok ? 0 : 1;
}
