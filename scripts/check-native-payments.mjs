// ВНУТРИ ПРИЛОЖЕНИЯ ПЛАТНЫХ ПОВЕРХНОСТЕЙ НЕТ ВОВСЕ — ДОЛГИ 79 И 179.
//
// Что сторожится. Google Play Payments и App Store 3.1.1 запрещают уводить
// на внешнюю оплату цифрового содержимого, и это отклонение на ревью, а не
// замечание. Решение владельца от 13.09.2026 для первой подачи: внутри
// оболочки платных кнопок нет НИ ОДНОЙ — ни веб-кассы, ни витрины
// магазина, ни цен, ни способов оплаты. Платный материал остаётся
// закрытым, и человеку честно сказано, что он закрыт.
//
// ПОЧЕМУ СТОРОЖ ПЕРЕПИСАН, ХОТЯ ДОЛГ 79 ЧИСЛИЛСЯ ЗАКРЫТЫМ. Владелец снял
// на живом POCO X6 Pro (сборка 7191) полную веб-страницу цен ВНУТРИ
// приложения: переключатель «Карта / Наличные», инструкция OXXO, рабочая
// кнопка «Оплатить наличными». Прежний сторож этого увидеть не мог по
// построению: он спрашивал сервер ОДНИМ способом — запросом с токеном в
// User-Agent, — а телефон ходит ещё и вторым, которого сторож не знал.
// Переходы в приложении обслуживает наш service worker, и запрос, который
// он делает от имени страницы, токена не несёт вовсе (разбор — в шапке
// `src/lib/native-shell.ts`). Поэтому здесь теперь ТРИ обличья запроса, а
// не два, и третье — кука без токена — воспроизводит ровно тот случай,
// который увидел владелец.
//
// ДВЕ ПОЛОВИНЫ, И ОБЕ ОБЯЗАТЕЛЬНЫ.
//
//   1. ЖИВАЯ (`--base=http://localhost:3123`) — берёт ОТДАЧУ страниц в
//      трёх обличьях: веб, оболочка по токену, оболочка по куке. Позитивный
//      контроль встроен и не отключается: веб-отдача обязана СОДЕРЖАТЬ то,
//      чего в двух других быть не может. Проверка, которая не видит кассу
//      там, где она заведомо есть, зелёная ни о чём не говорит (ПРАВИЛА
//      ЗАМЕРА 4.1). Гоняется из scripts/verify-rendered.mjs.
//
//   2. СТАТИЧЕСКАЯ (без `--base`) — по исходникам, дешёвая, стоит в
//      `verify` и в `ci.yml` на каждом коммите. Она отвечает на вопрос, на
//      который живая ответить не может: жив ли САМ механизм — оба признака
//      оболочки, кука в middleware, запрет кеша у воркера, замок вместо
//      пейвола. Разбор идёт ПОСЛЕ вычёркивания комментариев: на «ветку
//      закомментировали» стоит отдельная подсадка (класс 7.182).
//
//   node scripts/check-native-payments.mjs                     # статическая
//   node scripts/check-native-payments.mjs --plant             # её контроль
//   node scripts/check-native-payments.mjs --base=http://…     # живая
//   node scripts/check-native-payments.mjs --base=http://… --plant
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { stripCommentsAndStrings } from "./check-no-runtime-tts.mjs";

const PAGE_FILE = "src/app/[lang]/pricing/page.tsx";
const NOTICE_FILE = "src/components/native/NativeAccessNotice.tsx";
const COPY_FILE = "src/lib/native-access-copy.ts";
const SHELL_FILE = "src/lib/native-shell.ts";
const TOKEN_FILE = "src/lib/native-shell-token.ts";
const PROXY_FILE = "src/proxy.ts";
const SW_FILE = "src/app/sw.ts";
const PAYWALL_FILE = "src/contexts/PaywallContext.tsx";
const CHECKOUT_FILE = "src/app/api/checkout/route.ts";
const HOME_FILE = "src/app/[lang]/page.tsx";
const NAVBAR_FILE = "src/components/Navbar.tsx";
const PROFILE_FILE = "src/app/[lang]/profile/page.tsx";
const CAPACITOR_FILE = "capacitor.config.ts";

const SOURCES = [
  PAGE_FILE, NOTICE_FILE, COPY_FILE, SHELL_FILE, TOKEN_FILE, PROXY_FILE, SW_FILE,
  PAYWALL_FILE, CHECKOUT_FILE, HOME_FILE, NAVBAR_FILE, PROFILE_FILE, CAPACITOR_FILE,
];

// Строки, которых в нативной отдаче быть не должно.
//   `action="/api/checkout"` — наша собственная веб-касса;
//   `stripe.com`             — домен внешнего платёжного сервиса;
//   `MXN`                    — цена; внутри приложения цен нет вовсе;
//   `OXXO`                   — сторонний способ оплаты, названный по имени;
//   `/pricing`               — вход на страницу цен.
const FORM_MARK = 'action="/api/checkout"';
const STRIPE_MARK = "stripe.com";
const PRICE_MARK = "MXN";
const CASH_MARK = "OXXO";

const TOKEN = "RFNativeShell";
const COOKIE = "rf_native_shell";

function read(path) {
  return readFileSync(path, "utf8");
}

/** Только комментарии, строки на месте: часть правил спрашивает именно про
 *  строковые литералы (токен, адрес кассы, имя куки). */
function stripCommentsOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/** Статическая половина. Судит по ЖИВОМУ коду. */
function judgeSources(sources) {
  const problems = [];
  const live = Object.fromEntries(SOURCES.map((f) => [f, stripCommentsAndStrings(sources[f])]));
  const text = Object.fromEntries(SOURCES.map((f) => [f, stripCommentsOnly(sources[f])]));

  // --- 1. страница цен уходит на объяснение ПЕРВОЙ строкой ---------------
  //
  // Отсчёт идёт от тела САМОЙ страницы, а не от начала файла: с 13.09.2026
  // ветка на оболочку есть ещё и в `generateMetadata` (описание страницы
  // тоже называло OXXO). Считай сторож от начала файла — подсадка «ветка
  // переехала вниз» проходила бы насквозь, потому что первое вхождение
  // стоит выше любых карточек всегда. Поймано прогоном verify.
  const bodyAt = live[PAGE_FILE].indexOf("export default async function PricingPage");
  const body = bodyAt === -1 ? live[PAGE_FILE] : live[PAGE_FILE].slice(bodyAt);
  if (bodyAt === -1) {
    problems.push(`${PAGE_FILE}: не найдено тело страницы (export default async function PricingPage)`);
  }
  const branchAt = body.indexOf("isNativeShellRequest(");
  if (branchAt === -1) {
    problems.push(`${PAGE_FILE}: ветки на нативную оболочку нет в живом коде (isNativeShellRequest не вызывается)`);
  }
  if (body.indexOf("<NativeAccessNotice") === -1) {
    problems.push(`${PAGE_FILE}: честное объяснение NativeAccessNotice не отрисовывается`);
  }
  const webAt = body.indexOf("<SubscriptionCard");
  if (branchAt !== -1 && webAt !== -1 && branchAt > webAt) {
    problems.push(`${PAGE_FILE}: ветка на оболочку стоит ПОСЛЕ веб-карточек — формы успеют отрисоваться`);
  }
  // Витрина магазина возвращаться не должна: пока продуктов в консолях нет,
  // её кнопка не делает ничего (замер 7.192), а нерабочая кнопка — дефект.
  if (text[PAGE_FILE].includes("NativePricingPanel")) {
    problems.push(`${PAGE_FILE}: вернулась витрина магазина NativePricingPanel — её кнопка покупки не работает без продуктов`);
  }

  // --- 2. в объяснении нет ничего платного --------------------------------
  for (const file of [NOTICE_FILE, COPY_FILE]) {
    for (const mark of ["/api/checkout", "stripe", CASH_MARK, PRICE_MARK]) {
      if (text[file].includes(mark)) {
        problems.push(`${file}: упоминает «${mark}» — внутри приложения это платёжная поверхность`);
      }
    }
    // Цифра цены: `$150`, «150 песо», «150 pesos». Не голый «$» — он стоит
    // в каждой подстановке шаблонной строки (`${lang}`) и поймал бы ссылку
    // на курс. Поймано первым же прогоном.
    const priceLike = text[file].match(/\$\s?\d|\d+\s*(?:MXN|песо|pesos)/i);
    if (priceLike) {
      problems.push(`${file}: содержит цену «${priceLike[0]}» — внутри приложения цен нет вовсе`);
    }
    if (/<button/.test(live[file])) {
      problems.push(`${file}: содержит кнопку — внутри приложения платных органов управления нет ни одного`);
    }
  }

  // --- 3. признаков оболочки ДВА, и второй — кука -------------------------
  if (!live[SHELL_FILE].includes("userAgentIsNativeShell")) {
    problems.push(`${SHELL_FILE}: признак по User-Agent не спрашивается`);
  }
  if (!live[SHELL_FILE].includes("NATIVE_SHELL_COOKIE")) {
    problems.push(
      `${SHELL_FILE}: признака по КУКЕ нет. Переходы в приложении делает service worker, и его ` +
        `запрос токена в User-Agent не несёт — ровно так веб-касса и вернулась внутрь приложения (долг 179)`,
    );
  }
  if (!text[TOKEN_FILE].includes(`"${TOKEN}"`)) {
    problems.push(`${TOKEN_FILE}: токена нативной оболочки «${TOKEN}» нет в живом коде`);
  }
  if (!text[TOKEN_FILE].includes(`"${COOKIE}"`)) {
    problems.push(`${TOKEN_FILE}: имени куки «${COOKIE}» нет в живом коде`);
  }
  if (!text[CAPACITOR_FILE].includes(`"${TOKEN}"`)) {
    problems.push(`${CAPACITOR_FILE}: токена «${TOKEN}» нет — оболочка перестанет отличаться от браузера`);
  }
  if (!text[CAPACITOR_FILE].includes("appendUserAgent")) {
    problems.push(`${CAPACITOR_FILE}: appendUserAgent не задан — сервер не увидит оболочку вовсе`);
  }

  // --- 4. куку ставит middleware, и на ЛЮБОМ ответе ------------------------
  if (!live[PROXY_FILE].includes("userAgentIsNativeShell")) {
    problems.push(`${PROXY_FILE}: middleware не узнаёт оболочку — куку ставить некому`);
  }
  if (!/response\.cookies\.set\(\s*NATIVE_SHELL_COOKIE/.test(live[PROXY_FILE])) {
    problems.push(`${PROXY_FILE}: кука нативной оболочки не ставится`);
  }

  // --- 5. воркер не кеширует платёжные страницы ---------------------------
  if (!live[SW_FILE].includes("PAYMENT_PATH")) {
    problems.push(
      `${SW_FILE}: платёжные страницы снова кешируются. Копия веб-кассы, однажды положенная в кеш, ` +
        `переживёт любую серверную ветку и покажется внутри приложения (долг 179)`,
    );
  }
  if (!live[SW_FILE].includes("dropCachedPaymentPages")) {
    problems.push(`${SW_FILE}: уже лежащие в кеше копии страницы цен не убираются при выкате`);
  }

  // --- 6. вместо пейвола — замок, и ни одной платной кнопки ---------------
  if (!live[PAYWALL_FILE].includes("NativeLockedModal")) {
    problems.push(`${PAYWALL_FILE}: внутри оболочки не открывается замок — по тапу на закрытое не будет ничего`);
  }
  for (const mark of ["useRevenueCat", "presentNativePaywall", "Capacitor"]) {
    if (live[PAYWALL_FILE].includes(mark)) {
      problems.push(
        `${PAYWALL_FILE}: снова зовёт «${mark}». Витрина магазина без заведённых продуктов молча ` +
          `отвечает отказом, и наружу это выглядит как кнопка, не делающая ничего (часть 2 захода 7.192)`,
      );
    }
  }

  // --- 7. касса отказывает оболочке и на уровне маршрута ------------------
  if (!live[CHECKOUT_FILE].includes("userAgentIsNativeShell")) {
    problems.push(`${CHECKOUT_FILE}: маршрут кассы не отказывает оболочке — скрытый орган не закрытая дверь`);
  }

  // --- 8. остальные платные поверхности ветвятся --------------------------
  for (const [file, what] of [
    [HOME_FILE, "главная (плитка OXXO и полоса цен)"],
    [NAVBAR_FILE, "шапка и мобильное меню (ссылка «Цены»)"],
    [PROFILE_FILE, "личный кабинет (кнопка подписки и апсейлы)"],
  ]) {
    if (!live[file].includes("isNativeShellRequest")) {
      problems.push(`${file}: ${what} не спрашивает про оболочку — платный вход остался на месте`);
    }
  }
  return problems;
}

function countOf(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/**
 * ВИДИМЫЙ документ: всё, кроме `<script>` и `<template>`.
 *
 * Замер первого же прогона этого сторожа, и он стоит того, чтобы быть
 * записанным: в нативной отдаче `/es/pricing` форм кассы 0 и ссылок на
 * цены 0, а слов «MXN» — 10 и «OXXO» — 9. Все они лежат ВО FLIGHT-РАЗМЕТКЕ,
 * внутри `<script>`, и попадают туда не со страницы цен, а из корневого
 * макета: `Navbar`, `Footer` и `BottomNav` — клиентские компоненты и
 * получают `dict` ЦЕЛИКОМ, то есть весь словарь уезжает в каждую из 1913
 * страниц (это же замерено в 7.183 и в шапке `src/lib/native-access-copy.ts`).
 *
 * Правило судит по видимому документу, и граница названа честно: обнулить
 * словарь во flight-разметке эта правка не может — это отдельная и
 * немаленькая работа по тому, как макет передаёт словарь клиентским рамам.
 * На ревью магазина смотрят на ЭКРАН и на то, куда ведут органы
 * управления; ни адресной строки, ни «просмотра исходного кода» внутри
 * приложения нет вовсе.
 */
function visibleDocument(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ");
}

/** Три обличья запроса. `web` — обычный браузер; `token` — оболочка, как её
 *  видит прямой переход webview; `cookie` — оболочка, как её видит запрос
 *  service worker'а: токена нет, кука есть. Третье и есть тот случай,
 *  который увидел владелец на телефоне. */
async function fetchPage(base, path, disguise) {
  const safari =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
  const headers = { "user-agent": disguise === "token" ? `${safari} ${TOKEN}` : safari };
  if (disguise === "cookie") headers.cookie = `${COOKIE}=1`;
  const res = await fetch(`${base}${path}`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${path} ответил ${res.status}`);
  return res.text();
}

/** Что обязано быть в ВЕБ-отдаче каждой страницы (позитивный контроль) и
 *  чего не может быть в двух других. Признаки выбраны так, чтобы не
 *  зависеть от страны прогона: `OXXO` на localhost может не отдаваться и
 *  вебу (правило 7.117), поэтому позитивным контролем он не служит. */
const LIVE_PAGES = [
  { path: "/es/pricing", control: [FORM_MARK, PRICE_MARK] },
  { path: "/ru/pricing", control: [FORM_MARK, PRICE_MARK] },
  { path: "/es", control: ['href="/es/pricing"', PRICE_MARK] },
  { path: "/ru", control: ['href="/ru/pricing"', PRICE_MARK] },
];

const FORBIDDEN = [FORM_MARK, STRIPE_MARK, PRICE_MARK, CASH_MARK];

async function live(base, plant) {
  const problems = [];
  for (const page of LIVE_PAGES) {
    const web = await fetchPage(base, page.path, "web");
    for (const mark of page.control) {
      if (countOf(mark.startsWith("href=") ? web : visibleDocument(web), mark) === 0) {
        problems.push(
          `${page.path}: в ВЕБ-отдаче не найдено «${mark}» — измеритель слеп, его ноль ничего не доказывает`,
        );
      }
    }
    for (const disguise of ["token", "cookie"]) {
      // ПОДСАДКА: обеим оболочкам подсовывается веб-отдача. Сторож обязан
      // покраснеть — иначе он не умеет отличать одно от другого вовсе.
      const raw = plant ? web : await fetchPage(base, page.path, disguise);
      const html = visibleDocument(raw);
      const counts = FORBIDDEN.map((m) => [m, countOf(html, m)]);
      // Ссылка — орган управления, и она считается по ВСЕМУ ответу: ссылка
      // внутри flight-разметки становится настоящей после гидрации.
      const linkCount = countOf(raw, `href="${page.path.slice(0, 3)}/pricing"`);
      console.log(
        `  ${page.path.padEnd(12)} ${plant ? "ПОДСАДКА" : "оболочка"} по ${disguise.padEnd(6)} — ` +
          counts.map(([m, n]) => `${m}: ${n}`).join(", ") + `, ссылок на цены: ${linkCount}`,
      );
      for (const [mark, n] of counts) {
        if (n > 0) problems.push(`${page.path} (${disguise}): в нативной отдаче ${n} вхождений «${mark}»`);
      }
      if (linkCount > 0) {
        problems.push(`${page.path} (${disguise}): ${linkCount} ссылок на страницу цен`);
      }
    }
  }
  return problems;
}

/** Подсадка «ветку закомментировали»: живой код исчезает, текст остаётся. */
function commentOutBranch(source) {
  return source
    .split("\n")
    .map((line) =>
      line.includes("isNativeShellRequest") || line.includes("NativeAccessNotice") ? `// ${line}` : line,
    )
    .join("\n");
}

/** Подсадка «ветка переехала вниз»: блок вырезается и вставляется в конец
 *  функции — текстуально он на месте, а карточки собираются раньше него. */
function moveBranchToTheEnd(source) {
  const startMark = "  if (await isNativeShellRequest()) {";
  // От тела страницы, а не от начала файла: такая же ветка стоит выше, в
  // `generateMetadata`, и подсадка двигала бы ЕЁ — то есть изображала бы
  // дефект там, где правило не смотрит. Поймано прогоном verify.
  const from = source.indexOf("export default async function PricingPage");
  const start = source.indexOf(startMark, from === -1 ? 0 : from);
  if (start === -1) throw new Error("подсадка не нашла ветку — сторож и подсадка разошлись");
  const endMark = "\n  }\n";
  const end = source.indexOf(endMark, start);
  if (end === -1) throw new Error("подсадка не нашла конец ветки");
  const block = source.slice(start, end + endMark.length);
  const without = source.slice(0, start) + source.slice(end + endMark.length);
  return without.replace(/\n\}\n$/, `\n${block}}\n`);
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
          ? "check:native-payments (живая) --plant — поймано: веб-отдача, выданная за нативную, роняет сторож"
          : "check:native-payments (живая) --plant — ПРОПУЩЕНО",
      );
      return caught ? 0 : 1;
    }
    if (problems.length) {
      console.error("\nПЛАТЁЖНАЯ ПОВЕРХНОСТЬ ВЕРНУЛАСЬ ВНУТРЬ ПРИЛОЖЕНИЯ:");
      for (const p of problems) console.error(`  ${p}`);
      return 1;
    }
    console.log("check:native-payments (живая) — в обеих оболочках 0 форм, 0 цен, 0 упоминаний OXXO и stripe.com.");
    return 0;
  }

  const sources = Object.fromEntries(SOURCES.map((f) => [f, read(f)]));

  if (plant) {
    let ok = judgeSources(sources).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые исходники (отрицательный контроль)`);

    const plants = [
      ["ветка на оболочку ЗАКОММЕНТИРОВАНА целиком (слепота к комментариям)",
        { [PAGE_FILE]: commentOutBranch(sources[PAGE_FILE]) }],
      ["ветка цела, но переехала ПОСЛЕ веб-карточек",
        { [PAGE_FILE]: moveBranchToTheEnd(sources[PAGE_FILE]) }],
      ["вызов ветки заменён на чужое имя, импорт оставлен на месте",
        { [PAGE_FILE]: sources[PAGE_FILE].replaceAll("await isNativeShellRequest()", "await нетТакойВетки()") }],
      ["на странице цен снова витрина магазина с кнопкой покупки",
        { [PAGE_FILE]: sources[PAGE_FILE].replace("<NativeAccessNotice", "<NativePricingPanel") }],
      ["в честное объяснение вернулась цена",
        { [COPY_FILE]: sources[COPY_FILE].replace("profileNote:", 'price: "150 MXN",\n      profileNote:') }],
      ["в честное объяснение вернулось упоминание OXXO",
        { [NOTICE_FILE]: sources[NOTICE_FILE].replace("const copyHeading", "const oxxo").replace("{copy.backCta}", "OXXO {copy.backCta}") }],
      ["признак по КУКЕ убран — остался только User-Agent, которого нет у service worker",
        { [SHELL_FILE]: sources[SHELL_FILE].replace(/NATIVE_SHELL_COOKIE/g, "НЕТ_ТАКОЙ_КУКИ") }],
      ["middleware перестал ставить куку",
        { [PROXY_FILE]: sources[PROXY_FILE].replace("response.cookies.set(NATIVE_SHELL_COOKIE", "response.headers.get(NATIVE_SHELL_COOKIE") }],
      ["воркер снова кеширует страницу цен",
        { [SW_FILE]: sources[SW_FILE].replace(/PAYMENT_PATH/g, "ЛЮБОЙ_ПУТЬ") }],
      ["уже лежащие в кеше копии больше не убираются",
        { [SW_FILE]: sources[SW_FILE].replace(/dropCachedPaymentPages/g, "ничегоНеУбираем") }],
      ["вместо замка снова витрина RevenueCat",
        { [PAYWALL_FILE]: sources[PAYWALL_FILE].replace("NativeLockedModal", "useRevenueCat") }],
      ["маршрут кассы перестал отказывать оболочке",
        { [CHECKOUT_FILE]: sources[CHECKOUT_FILE].replace(/userAgentIsNativeShell/g, "ктоУгодно") }],
      ["полоса цен на главной вернулась в приложение",
        { [HOME_FILE]: sources[HOME_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем") }],
      ["ссылка «Цены» вернулась в шапку приложения",
        { [NAVBAR_FILE]: sources[NAVBAR_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем") }],
      ["кнопка подписки вернулась в кабинет приложения",
        { [PROFILE_FILE]: sources[PROFILE_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем") }],
      ["токен в capacitor.config.ts разошёлся с токеном сервера",
        { [CAPACITOR_FILE]: sources[CAPACITOR_FILE].replace(TOKEN, "RFNativeShim") }],
      ["appendUserAgent убран из конфигурации оболочки",
        { [CAPACITOR_FILE]: sources[CAPACITOR_FILE].replace(/appendUserAgent/g, "неДописываем") }],
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
    console.error("ПЛАТЁЖНАЯ ПОВЕРХНОСТЬ ВНУТРИ ПРИЛОЖЕНИЯ — ИСХОДНИКИ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    "check:native-payments — оболочку узнают по ДВУМ признакам, кассы нет ни на одной поверхности, " +
      "вместо пейвола замок, воркер платёжных страниц не кеширует; контроль — --plant.",
  );
  console.log("  Живая половина (по отдаче страниц, три обличья запроса) гоняется из scripts/verify-rendered.mjs с --base=.");
  return 0;
}

// Только когда этот файл — точка входа процесса.
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
