// ВНУТРИ ПРИЛОЖЕНИЯ ВЕБ-КАССЫ НЕТ — ДОЛГ 79.
//
// Что сторожится. App Store 3.1.1 и Google Play Payments запрещают уводить
// на внешнюю оплату цифрового содержимого, и это отклонение на ревью, а не
// замечание. Решение владельца от 11.09.2026: внутри приложения покупка
// идёт ТОЛЬКО через магазин — увод наружу разрешён лишь в США, ЕС и
// нескольких отдельных странах, а Мексика и Латинская Америка, основные
// рынки проекта, в этот список не входят.
//
// Замер 7.180, ради которого сторож написан: `/es/pricing`, запрошенная с
// User-Agent мобильного Safari, отдавала ТЕ ЖЕ ТРИ формы
// `action="/api/checkout"`, что и вебу; ветка на нативную платформу
// существовала ровно в двух местах и у страницы цен её не было вовсе.
//
// ДВЕ ПОЛОВИНЫ, И ОБЕ ОБЯЗАТЕЛЬНЫ.
//
//   1. ЖИВАЯ (`--base=http://localhost:3123`) — берёт ОТДАЧУ страницы цен
//      в нативном режиме и ищет в ней `action="/api/checkout"` и домен
//      stripe.com. Позитивный контроль встроен и не отключается: та же
//      страница, запрошенная БЕЗ токена нативной оболочки, обязана эти
//      формы содержать. Проверка, которая не видит форм там, где они
//      заведомо есть, зелёная ни о чём не говорит (PROGRESS.md 4.1).
//      Гоняется из scripts/verify-rendered.mjs на уже поднятом сервере.
//
//   2. СТАТИЧЕСКАЯ (без `--base`) — по исходникам, дешёвая, стоит в
//      `verify` и в `ci.yml` на каждом коммите. Она отвечает на вопрос, на
//      который живая ответить не может: жива ли САМА ветка. Разбор идёт
//      ПОСЛЕ вычёркивания комментариев и содержимого строк — в 7.182
//      посчитано, что девятнадцать сторожей слепы к закомментированному
//      коду, и этот в их число не входит: на «ветку закомментировали»
//      стоит отдельная подсадка.
//
//   node scripts/check-native-payments.mjs                     # статическая
//   node scripts/check-native-payments.mjs --plant             # её контроль
//   node scripts/check-native-payments.mjs --base=http://…     # живая
//   node scripts/check-native-payments.mjs --base=http://… --plant
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { stripCommentsAndStrings } from "./check-no-runtime-tts.mjs";

const PAGE_FILE = "src/app/[lang]/pricing/page.tsx";
const PANEL_FILE = "src/components/pricing/NativePricingPanel.tsx";
const SHELL_FILE = "src/lib/native-shell.ts";
const CAPACITOR_FILE = "capacitor.config.ts";

// Строки, которых в нативной отдаче быть не должно. `action="/api/checkout"`
// — наша собственная веб-касса; `stripe.com` — домен внешнего платёжного
// сервиса. Второе в вебе и так не встречается (переход делает POST), но
// правило написано на будущее: вернуть ссылку наружу проще, чем форму.
const FORM_MARK = 'action="/api/checkout"';
const STRIPE_MARK = "stripe.com";

// Токен обязан совпадать в двух файлах, и сторож держит их вместе: в
// `capacitor.config.ts` его дописывает оболочка, в `native-shell.ts` его
// ищет сервер. Разойдись они — веб-касса вернулась бы внутрь приложения
// молча, и ни одна из половин по отдельности этого бы не заметила.
const TOKEN = "RusoFacilappNative";

function read(path) {
  return readFileSync(path, "utf8");
}

/** Статическая половина. Судит по ЖИВОМУ коду: комментарии и содержимое
 *  строковых литералов вычеркнуты. */
function judgeSources(sources) {
  const problems = [];
  const page = stripCommentsAndStrings(sources[PAGE_FILE]);
  const panel = stripCommentsAndStrings(sources[PANEL_FILE]);
  const shell = sources[SHELL_FILE];
  const capacitor = sources[CAPACITOR_FILE];

  // Сравниваются ВЫЗОВ и ОТРИСОВКА, а не имена: строка импорта
  // `import { isNativeShellRequest }` стоит в начале файла всегда, и
  // сравнение по ней показывало бы «ветка раньше карточек» даже тогда,
  // когда ветки в теле функции нет вовсе. Поймано первой же подсадкой.
  const branchAt = page.indexOf("isNativeShellRequest(");
  if (branchAt === -1) {
    problems.push(`${PAGE_FILE}: ветки на нативную оболочку нет в живом коде (isNativeShellRequest не вызывается)`);
  }
  const panelAt = page.indexOf("<NativePricingPanel");
  if (panelAt === -1) {
    problems.push(`${PAGE_FILE}: нативная витрина NativePricingPanel не отрисовывается`);
  }
  // Порядок важнее наличия: ветка, стоящая ПОСЛЕ сборки карточек, не
  // мешает им отрисоваться — она только добавляет разметку сверху.
  const webAt = page.indexOf("<SubscriptionCard");
  if (branchAt !== -1 && webAt !== -1 && branchAt > webAt) {
    problems.push(`${PAGE_FILE}: ветка на нативную оболочку стоит ПОСЛЕ веб-карточек — формы успеют отрисоваться`);
  }

  // Строки вычеркнуты, поэтому literal "/api/checkout" внутри витрины так
  // не поймать — ищем по сырому тексту без комментариев.
  const panelRaw = stripCommentsOnly(sources[PANEL_FILE]);
  for (const mark of ["/api/checkout", "stripe"]) {
    if (panelRaw.includes(mark)) {
      problems.push(`${PANEL_FILE}: нативная витрина упоминает «${mark}» — внутри приложения это увод на внешнюю оплату`);
    }
  }
  if (!panel.includes("restore")) {
    problems.push(`${PANEL_FILE}: нет восстановления покупок — без этой кнопки Apple заворачивает на ревью`);
  }
  if (!panel.includes("hasAccessElsewhere")) {
    problems.push(`${PANEL_FILE}: витрина не спрашивает про уже активное право доступа — это путь к двойной оплате`);
  }

  const shellLive = stripCommentsOnly(shell);
  const capacitorLive = stripCommentsOnly(capacitor);
  if (!shellLive.includes(TOKEN)) {
    problems.push(`${SHELL_FILE}: токена нативной оболочки «${TOKEN}» нет в живом коде`);
  }
  if (!capacitorLive.includes(TOKEN)) {
    problems.push(`${CAPACITOR_FILE}: токена «${TOKEN}» нет в живом коде — оболочка перестанет отличаться от браузера`);
  }
  if (!capacitorLive.includes("appendUserAgent")) {
    problems.push(`${CAPACITOR_FILE}: appendUserAgent не задан — сервер не увидит оболочку вовсе`);
  }
  return problems;
}

/** Только комментарии, строки на месте: часть правил спрашивает именно про
 *  строковые литералы (токен, адрес кассы). */
function stripCommentsOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

function countOf(haystack, needle) {
  return haystack.split(needle).length - 1;
}

async function fetchPage(base, path, native) {
  // Токен дописан к обычному User-Agent мобильного Safari — ровно так его
  // и пришлёт оболочка (appendUserAgent, а не overrideUserAgent).
  const safari =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
  const res = await fetch(`${base}${path}`, {
    headers: { "user-agent": native ? `${safari} ${TOKEN}` : safari },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${path} ответил ${res.status}`);
  return res.text();
}

async function live(base, plant) {
  const paths = ["/es/pricing", "/ru/pricing"];
  const problems = [];
  for (const path of paths) {
    const web = await fetchPage(base, path, false);
    const nativeHtml = plant ? web : await fetchPage(base, path, true);
    const webForms = countOf(web, FORM_MARK);
    // ОБЯЗАТЕЛЬНАЯ ПОЛОВИНА: если форм не видно там, где они есть, то и
    // «0 в нативной отдаче» ничего не значит.
    if (webForms === 0) {
      problems.push(`${path}: в ВЕБ-отдаче не найдено ни одной ${FORM_MARK} — измеритель слеп, его ноль ничего не доказывает`);
    }
    const nativeForms = countOf(nativeHtml, FORM_MARK);
    const nativeStripe = countOf(nativeHtml, STRIPE_MARK);
    console.log(
      `  ${path}: веб ${webForms} форм; ${plant ? "ПОДСАДКА (веб-отдача судится по нативным правилам)" : "нативная отдача"} — ${nativeForms} форм, ${nativeStripe} упоминаний ${STRIPE_MARK}`,
    );
    if (nativeForms > 0) problems.push(`${path}: в нативной отдаче ${nativeForms} форм ${FORM_MARK}`);
    if (nativeStripe > 0) problems.push(`${path}: в нативной отдаче ${nativeStripe} упоминаний ${STRIPE_MARK}`);
  }
  return problems;
}

async function main() {
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  const plant = process.argv.includes("--plant");

  if (baseArg) {
    const base = baseArg.slice("--base=".length);
    const problems = await live(base, plant);
    if (plant) {
      const caught = problems.length > 0;
      console.log(
        caught
          ? "check:native-payments (живая) --plant — поймано: веб-касса, отданная в нативном режиме, роняет сторож"
          : "check:native-payments (живая) --plant — ПРОПУЩЕНО",
      );
      return caught ? 0 : 1;
    }
    if (problems.length) {
      console.error("\nВЕБ-КАССА ВЕРНУЛАСЬ ВНУТРЬ ПРИЛОЖЕНИЯ:");
      for (const p of problems) console.error(`  ${p}`);
      return 1;
    }
    console.log("check:native-payments (живая) — в нативной отдаче 0 форм и 0 упоминаний stripe.com.");
    return 0;
  }

  const sources = Object.fromEntries(
    [PAGE_FILE, PANEL_FILE, SHELL_FILE, CAPACITOR_FILE].map((f) => [f, read(f)]),
  );

  if (plant) {
    let ok = judgeSources(sources).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые исходники (отрицательный контроль)`);

    const plants = [
      [
        "ветка на нативную оболочку ЗАКОММЕНТИРОВАНА целиком (слепота к комментариям)",
        { [PAGE_FILE]: commentOutBranch(sources[PAGE_FILE]) },
      ],
      [
        "ветка цела, но переехала ПОСЛЕ веб-карточек",
        { [PAGE_FILE]: moveBranchToTheEnd(sources[PAGE_FILE]) },
      ],
      [
        "вызов ветки заменён на чужое имя, импорт оставлен на месте",
        { [PAGE_FILE]: sources[PAGE_FILE].replace("await isNativeShellRequest()", "await нетТакойВетки()") },
      ],
      [
        "в нативную витрину вернулась форма /api/checkout",
        { [PANEL_FILE]: sources[PANEL_FILE].replace("const section =", 'const back = "/api/checkout";\n  const section =') },
      ],
      [
        "кнопка восстановления покупок убрана",
        { [PANEL_FILE]: sources[PANEL_FILE].replace(/restore/g, "неВосстанавливаем") },
      ],
      [
        "витрина перестала спрашивать про уже активный доступ",
        { [PANEL_FILE]: sources[PANEL_FILE].replace(/hasAccessElsewhere/g, "неважно") },
      ],
      [
        "токен в capacitor.config.ts разошёлся с токеном сервера",
        { [CAPACITOR_FILE]: sources[CAPACITOR_FILE].replace(TOKEN, "RusoFacilappNativo") },
      ],
      [
        "appendUserAgent убран из конфигурации оболочки",
        { [CAPACITOR_FILE]: sources[CAPACITOR_FILE].replace(/appendUserAgent/g, "неДописываем") },
      ],
    ];

    let caught = 0;
    for (const [name, patch] of plants) {
      const found = judgeSources({ ...sources, ...patch });
      const hit = found.length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}${hit ? ` (${found[0]})` : ""}`);
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:native-payments --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
        : "check:native-payments --plant — FAILED",
    );
    return ok ? 0 : 1;
  }

  const problems = judgeSources(sources);
  if (problems.length) {
    console.error("ВЕБ-КАССА ВНУТРИ ПРИЛОЖЕНИЯ — ИСХОДНИКИ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    "check:native-payments — ветка на нативную оболочку жива и стоит первой, витрина без веб-кассы, токен сходится в двух файлах; контроль — --plant.",
  );
  console.log("  Живая половина (по отдаче страницы) гоняется из scripts/verify-rendered.mjs с --base=.");
  return 0;
}

/** Подсадка «ветка переехала вниз»: блок вырезается целиком и
 *  вставляется в самый конец функции — текстуально он на месте, а
 *  карточки собираются раньше него. Правило порядка обязано это увидеть. */
function moveBranchToTheEnd(source) {
  const startMark = "  if (await isNativeShellRequest()) {";
  const start = source.indexOf(startMark);
  if (start === -1) throw new Error("подсадка не нашла ветку — сторож и подсадка разошлись");
  const endMark = "\n  }\n";
  const end = source.indexOf(endMark, start);
  if (end === -1) throw new Error("подсадка не нашла конец ветки");
  const block = source.slice(start, end + endMark.length);
  const without = source.slice(0, start) + source.slice(end + endMark.length);
  return without.replace(/\n\}\n$/, `\n${block}}\n`);
}

/** Подсадка «ветку закомментировали»: живой код исчезает, текст остаётся.
 *  Ровно эта слепота найдена у девятнадцати сторожей в 7.182. */
function commentOutBranch(source) {
  return source
    .split("\n")
    .map((line) =>
      line.includes("isNativeShellRequest") || line.includes("NativePricingPanel") ? `// ${line}` : line,
    )
    .join("\n");
}

// Только когда этот файл — точка входа процесса: импорт его запускать не
// должен (см. src/lib/entry-point.ts).
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
