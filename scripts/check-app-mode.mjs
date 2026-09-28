// ПРИЛОЖЕНИЕ НЕ ПОХОЖЕ НА САЙТ — заход 7.243 (аудит 7.241, Р7, Р8, Р10).
//
// ОТКУДА. Видео владельца 28.09 (POCO, 1.0.12): в приложении веб-подвал
// «RusoFácilapp.com … Descargar la app · Glosario · … · ©» (и под серым
// каркасом загрузки кабинета), блок «comunidad oficial / Unirme al canal de
// Telegram» в «Mi perfil → Ajustes», у гостя плитка «OXXO · Pago en
// efectivo» и пункт «Precios» в меню «≡», подписи шапки и кнопок
// выделяются долгим нажатием. Кука-метка приложения жила 365 дней с первого
// запуска и не продлевалась.
//
// ЧТО СТЕРЕЖЁТСЯ.
//   1. СТАТИЧЕСКАЯ (без `--base`). Каждое место, где сайт рисует примету
//      сайта, стоит за признаком приложения с сервера; кука продлевается на
//      каждом запросе с токеном; правило «рамы» в globals.css и исключение
//      для текста рассказа на месте. `--plant` — подсадки в исходники.
//   2. ЖИВАЯ (`--base=…`, сервер с `E2E_TEST_SEED=1`). Вся перепись адресов
//      (`route-census.mjs`) гостем и подписчиком, в приложении и в браузере
//      (страна MX — чтобы в браузере была плитка OXXO): в приложении
//      веб-подвалов, ссылок и слов Telegram, упоминаний OXXO/Stripe/checkout
//      и ссылок на цены/кассу, «Descargar la app» — 0; в браузере каждый
//      счётчик > 0 (иначе ноль ничего не значит). Кука: запрос приложения с
//      уже стоящей меткой получает её снова на 365 дней, браузер — нет.
//      `--plant` подсаживает подвал и плитку OXXO в отдачу приложения.
//
//   node scripts/check-app-mode.mjs [--plant]
//   node scripts/check-app-mode.mjs --base=http://… [--plant]
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { collectAddresses } from "./route-census.mjs";
import { visibleDocument } from "./purchase-surface-rules.mjs";

const FILES = {
  footer: "src/components/Footer.tsx",
  layout: "src/app/[lang]/layout.tsx",
  notFound: "src/app/global-not-found.tsx",
  profile: "src/app/[lang]/profile/page.tsx",
  home: "src/app/[lang]/page.tsx",
  courses: "src/app/[lang]/courses/page.tsx",
  navbar: "src/components/Navbar.tsx",
  proxy: "src/proxy.ts",
  cookie: "src/components/NativeShellCookie.tsx",
  css: "src/app/globals.css",
  story: "src/components/stories/StoryText.tsx",
  subtitles: "src/components/video-lesson/SubtitleTrack.tsx",
  pageDictionary: "src/i18n/page-dictionary.ts",
  appDictionary: "src/i18n/app-dictionary.ts",
};

/** Долг 356 (7.244): кто отвечает на запрос страницей — макет и страницы
 *  `[lang]`, 404, общая страница тематических игр. Каждый обязан брать
 *  словарь через `getPageDictionary`, иначе словарь веб-оплаты снова
 *  уйдёт в данные отрисовки приложения. */
function pageSources() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx|ts)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
    }
  };
  walk("src/app/[lang]");
  out.push("src/app/global-not-found.tsx", "src/components/word-games/TopicLandingPage.tsx");
  return out;
}

const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

export function judgeStatic(files) {
  const f = Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, strip(files[p] ?? "")]));
  const css = files[FILES.css] ?? "";
  const bad = [];
  const need = (cond, msg) => {
    if (!cond) bad.push(msg);
  };
  // Подвал.
  const firstReturn = f.footer.indexOf("return (");
  const gate = f.footer.indexOf("if (nativeShell) return null;");
  need(gate !== -1 && gate < firstReturn, "Footer.tsx: подвал рисуется в приложении (нет `if (nativeShell) return null;` до разметки)");
  need(/<Footer dict=\{dict\} lang=\{lang\} nativeShell=\{nativeShell\} \/>/.test(f.layout), "layout.tsx: подвал не получает признак приложения с сервера");
  need(/<Footer[^>]*nativeShell=\{await isNativeShellRequest\(\)\}/.test(f.notFound), "global-not-found.tsx: подвал 404 не получает признак приложения");
  // Telegram.
  need(/\{!nativeShell && theme !== "reading" && <TelegramFloatButton/.test(f.layout), "layout.tsx: плавающая кнопка Telegram рисуется в приложении");
  need(
    /\{nativeShell \? \(\s*<div[^>]*data-rf-legal-links[\s\S]*?href=\{`\/\$\{lang\}\/terms`\}[\s\S]*?href=\{`\/\$\{lang\}\/privacy`\}[\s\S]*?\) : \([\s\S]*?TELEGRAM_INVITE_URL/.test(f.profile),
    "profile/page.tsx: в «Ajustes» приложения нет Условий и Политики или блок Telegram не в ветке браузера",
  );
  need((f.profile.match(/TELEGRAM_INVITE_URL/g) ?? []).length === 2, "profile/page.tsx: ссылка на Telegram появилась вне ветки браузера (ожидается импорт + 1)");
  need(/nativeShell \? introSlidesForApp\(/.test(f.courses), "courses/page.tsx: колода введения в приложении с Telegram");
  // Оплата сайта.
  need(/const cashAvailable = cashAvailableForCountry && !nativeShell;/.test(f.home), "page.tsx: плитка OXXO на главной рисуется в приложении");
  for (const [re, what] of [
    [/\{!nativeShell && checkout === "mock" &&/, "пробный режим кассы"],
    [/\{!nativeShell && checkout === "success" &&/, "исход оплаты Stripe"],
    [/\{!nativeShell && \(openVoucher !== null \|\| checkout === "oxxo_pending"\) &&/, "талон OXXO"],
  ]) need(re.test(f.profile), `profile/page.tsx: баннер «${what}» рисуется в приложении`);
  need((f.navbar.match(/nativeShell \? \[legalGroup\] : \[\{ label: dict\.nav\.pricing/g) ?? []).length === 2, "Navbar.tsx: в меню «≡» приложения «Precios» или нет документов (нужно у гостя и у вошедшего)");
  // Кука-метка.
  need(
    /if \(userAgentIsNativeShell\(request\.headers\.get\("user-agent"\)\)\) \{\s*response\.cookies\.set\(NATIVE_SHELL_COOKIE,/.test(f.proxy),
    "proxy.ts: метка приложения ставится не на каждом запросе с токеном — срок не продлевается",
  );
  need(/if \(shellVersion !== null\) \{\s*response\.cookies\.set\(NATIVE_SHELL_VERSION_COOKIE/.test(f.proxy), "proxy.ts: кука версии приложения не продлевается");
  const set = f.cookie.indexOf("setNativeShellCookie();");
  const early = f.cookie.indexOf("if (present) return;");
  need(set !== -1 && early !== -1 && set < early, "NativeShellCookie.tsx: клиент не продлевает метку на каждой загрузке");
  // Выделение.
  need(/data-shell=\{nativeShell \? "1" : undefined\}/.test(f.layout), "layout.tsx: у <html> нет признака приложения для CSS");
  need(/html\[data-shell\] :is\([^)]*header[^)]*nav[^)]*button[^)]*\):not\(\[data-rf-selectable\], \[data-rf-selectable\] \*\) \{[^}]*-webkit-user-select: none;\s+user-select: none;\s+-webkit-touch-callout: none;/.test(css), "globals.css: нет правила «рама приложения не выделяется»");
  need(/data-rf-selectable/.test(f.story), "StoryText.tsx: текст рассказа (кнопки-слова) перестал выделяться в приложении");
  need(/data-rf-selectable/.test(f.subtitles), "SubtitleTrack.tsx: субтитры перестали выделяться в приложении");
  // Словарь в данных отрисовки (долг 356).
  need(
    /return \(await isNativeShellRequest\(\)\) \? withoutWebPaymentStrings\(dict\) : dict;/.test(f.pageDictionary),
    "page-dictionary.ts: приложение получает словарь со строками веб-оплаты",
  );
  need(
    /const WEB_PAYMENT_WORD = \/OXXO\/;/.test(f.appDictionary) && /WEB_ONLY_KEYS = new Set\(\["footer\.appLink"\]\)/.test(f.appDictionary),
    "app-dictionary.ts: из словаря приложения не убираются «OXXO» или «Descargar la app»",
  );
  for (const [path, src] of Object.entries(files)) {
    if (!path.startsWith("src/app/[lang]/") && path !== FILES.notFound && !path.endsWith("TopicLandingPage.tsx")) continue;
    if (/\bgetDictionary\(/.test(strip(src))) bad.push(`${path}: словарь страницы через getDictionary — в приложение уйдёт словарь веб-оплаты (нужен getPageDictionary)`);
  }
  return bad;
}

// ---------------------------------------------------------------- отдача
const text = (html) =>
  visibleDocument(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
const tags = (html) => visibleDocument(html).match(/<(a|form|button)\b[^>]*>/gi) ?? [];
const LEGAL = /^\/(es|ru)\/(terms|privacy|eliminar-cuenta)$/;

/** Приметы сайта в одном ответе. `path` — для исключения Stripe в документах. */
export function measure(html, path = "") {
  const t = text(html);
  const tg = tags(html);
  const stripeWords = (t.match(/Stripe/g) ?? []).length;
  return {
    footer: (html.match(/<footer\b[^>]*data-rf-web-footer/g) ?? []).length,
    telegram: (t.match(/Telegram/g) ?? []).length + tg.filter((x) => /t\.me\//.test(x)).length,
    // Stripe в Условиях, Политике и на странице удаления — правда документа
    // (обработчик платежей сайта хранит записи о сделках, `check:legal-truth`,
    // `check:account-deletion`), это не путь к оплате; OXXO и цены из
    // документов в приложении убраны ещё 7.199 (долг 196).
    pay:
      (t.match(/OXXO|checkout/gi) ?? []).length +
      (LEGAL.test(path) ? 0 : stripeWords) +
      tg.filter((x) => /(href|action)="[^"]*(\/api\/checkout|stripe\.com|\/pricing|\/precios|oxxo-voucher)/i.test(x)).length,
    download: (t.match(/Descargar la app|Скачать приложение/g) ?? []).length + tg.filter((x) => /href="\/(es|ru)\/download"/.test(x)).length,
    shellAttr: /<html\b[^>]*\bdata-shell="1"/.test(html) ? 1 : 0,
    // Долг 356 (7.244): ИСХОДНЫЙ код ответа целиком, с <script> и данными
    // отрисовки, — то, что покажет «просмотр кода». Видимый текст выше
    // этого не видит (словарь в <script> не считается — так и задумано).
    rawOxxo: (html.match(/OXXO/g) ?? []).length,
    rawDownload: (html.match(/Descargar la app|Скачать приложение/g) ?? []).length,
  };
}

const UA = "Mozilla/5.0 (Linux; Android 16; POCO) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Mobile Safari/537.36";
const APP_UA = `${UA} RFNativeShell/13`;

async function session(base) {
  const email = `appmode-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
    body: new URLSearchParams({ email, password: "TestPass123!", lang: "es", redirectTo: "/es" }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const jar = res.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("=")).join("; ");
  if (!jar) throw new Error(`роль не завелась: register ответил ${res.status} без куки (сервер без E2E_TEST_SEED=1?)`);
  const g = await fetch(`${base}/api/test/grant-subscription`, { method: "POST", headers: { cookie: jar, "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(30_000) });
  if (!g.ok) throw new Error(`подписка роли не выдана: ${g.status}`);
  return jar;
}

async function get(base, path, app, jar) {
  const headers = { "user-agent": app ? APP_UA : UA, "x-vercel-ip-country": "MX" };
  if (jar) headers.cookie = jar;
  const res = await fetch(`${base}${path}`, { headers, redirect: "manual", signal: AbortSignal.timeout(60_000) });
  return res.status === 200 ? res.text() : null;
}

async function pool(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

/** Кука-метка: приложение с уже стоящей меткой получает её снова на год; браузер — нет. */
export async function cookieRefresh(base) {
  const probe = async (ua, cookie) => {
    const res = await fetch(`${base}/es`, { headers: { "user-agent": ua, ...(cookie ? { cookie } : {}) }, redirect: "manual", signal: AbortSignal.timeout(60_000) });
    const sets = res.headers.getSetCookie();
    const age = (name) => {
      const c = sets.find((x) => x.startsWith(`${name}=`));
      const m = c?.match(/Max-Age=(\d+)/i);
      return m ? Number(m[1]) : null;
    };
    return { shell: age("rf_native_shell"), version: age("rf_shell_version") };
  };
  const year = 364 * 24 * 3600;
  const app = await probe(APP_UA, "rf_native_shell=1; rf_shell_version=13");
  const web = await probe(UA, null);
  const problems = [];
  if (!(app.shell >= year)) problems.push(`кука-метка: запрос приложения с уже стоящей меткой не продлил её (Max-Age ${app.shell})`);
  if (!(app.version >= year)) problems.push(`кука версии: запрос приложения с той же версией не продлил её (Max-Age ${app.version})`);
  if (web.shell !== null || web.version !== null) problems.push("кука-метка: браузер получил метку приложения");
  return { app, web, problems };
}

async function live(base, plant) {
  const census = await collectAddresses(base, { perDynamic: 2 });
  const addresses = census.addresses.filter((a) => !a.includes("/admin"));
  const roles = [["гость", null], ["подписчик", await session(base)]];
  const problems = [];
  const web = { footer: 0, telegram: 0, pay: 0, download: 0, shellAttr: 0, rawOxxo: 0, rawDownload: 0 };
  const app = { footer: 0, telegram: 0, pay: 0, download: 0, shellAttr: 0, rawOxxo: 0, rawDownload: 0 };
  let judged = 0;
  let planted = { footer: 0, oxxo: 0, raw: 0 };
  for (const [role, jar] of roles) {
    const rows = await pool(addresses, 6, async (path) => ({ path, app: await get(base, path, true, jar), web: await get(base, path, false, jar) }));
    for (const row of rows) {
      if (row.web) for (const [k, v] of Object.entries(measure(row.web, row.path))) web[k] += v;
      if (!row.app) continue;
      judged++;
      const m = measure(row.app, row.path);
      for (const [k, v] of Object.entries(m)) app[k] += v;
      for (const k of ["footer", "telegram", "pay", "download", "rawOxxo", "rawDownload"]) if (m[k]) problems.push(`${row.path} (${role}, приложение): ${k} ${m[k]}`);
      if (!m.shellAttr) problems.push(`${row.path} (${role}, приложение): у <html> нет data-shell`);
      if (plant) {
        const withFooter = measure(row.app.replace("</body>", '<footer data-rf-web-footer><a href="/es/download">Descargar la app</a></footer></body>'), row.path);
        if (withFooter.footer > m.footer && withFooter.download > m.download) planted.footer++;
        const withOxxo = measure(row.app.replace("</body>", "<dl><dt>OXXO</dt><dd>Pago en efectivo</dd></dl></body>"), row.path);
        if (withOxxo.pay > m.pay) planted.oxxo++;
        // Словарь в данных отрисовки — невидимо, ловит только исходник.
        const withDict = measure(row.app.replace("</body>", '<script>self.__next_f.push([1,"{\\"appLink\\":\\"Descargar la app\\",\\"paymentMethodsNote\\":\\"Aceptamos tarjetas y efectivo OXXO\\"}"])</script></body>'), row.path);
        if (withDict.rawOxxo > m.rawOxxo && withDict.rawDownload > m.rawDownload && withDict.pay === m.pay) planted.raw++;
      }
    }
  }
  const cookie = await cookieRefresh(base);
  problems.push(...cookie.problems);
  console.log(`  адресов ${addresses.length} × ролей ${roles.length}: ответов приложения ${judged}`);
  console.log(`  приложение: подвалов ${app.footer}, Telegram ${app.telegram}, оплата сайта ${app.pay}, «Descargar la app» ${app.download}, data-shell ${app.shellAttr}/${judged}; в исходном коде — OXXO ${app.rawOxxo}, «Descargar la app» ${app.rawDownload}`);
  console.log(`  браузер (контроль): подвалов ${web.footer}, Telegram ${web.telegram}, оплата сайта ${web.pay}, «Descargar la app» ${web.download}, data-shell ${web.shellAttr}; в исходном коде — OXXO ${web.rawOxxo}, «Descargar la app» ${web.rawDownload}`);
  console.log(`  кука: приложение Max-Age ${cookie.app.shell}/${cookie.app.version}, браузер ${cookie.web.shell}/${cookie.web.version}`);
  for (const k of ["footer", "telegram", "pay", "download", "rawOxxo", "rawDownload"]) if (web[k] === 0) problems.push(`КОНТРОЛЬ: в браузере «${k}» 0 — измеритель слеп`);
  if (web.shellAttr) problems.push(`браузер: data-shell у ${web.shellAttr} ответов`);
  if (judged === 0) problems.push("ни одного ответа приложения — перепись пуста");
  if (plant) {
    const ok = problems.length === 0 && planted.footer === judged && planted.oxxo === judged && planted.raw === judged;
    console.log(ok ? `check:app-mode --base --plant — подвал пойман в ${planted.footer}/${judged}, плитка OXXO в ${planted.oxxo}/${judged}, словарь оплаты в данных страницы в ${planted.raw}/${judged}; настоящая отдача молчит` : `check:app-mode --base --plant — FAILED (подвал ${planted.footer}, OXXO ${planted.oxxo}, словарь ${planted.raw} из ${judged}; проблем ${problems.length})`);
    return ok ? 0 : 1;
  }
  if (problems.length) {
    console.error("check:app-mode (живая) — ОТКАЗ:");
    for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
    if (problems.length > 40) console.error(`  … ещё ${problems.length - 40}`);
    return 1;
  }
  console.log(`check:app-mode (живая) — в приложении 0 примет сайта на ${judged} ответах; в браузере они на месте.`);
  return 0;
}

function readAll() {
  const out = {};
  for (const p of [...Object.values(FILES), ...pageSources()]) out[p] = readFileSync(p, "utf8");
  return out;
}

async function main() {
  const plant = process.argv.includes("--plant");
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  if (baseArg) return live(baseArg.slice("--base=".length), plant);
  const files = readAll();
  const bad = judgeStatic(files);
  if (plant) {
    let ok = bad.length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие исходники`);
    const edit = (key, from, to) => {
      const p = FILES[key];
      const next = files[p].replace(from, to);
      return next === files[p] ? null : { ...files, [p]: next };
    };
    const editPath = (p, from, to) => {
      const next = (files[p] ?? "").replace(from, to);
      return next === files[p] ? null : { ...files, [p]: next };
    };
    const cases = [
      ["подвал вернулся в приложение", edit("footer", "  if (nativeShell) return null;\n", ""), "Footer.tsx: подвал рисуется"],
      ["плитка OXXO вернулась на главную приложения", edit("home", "cashAvailableForCountry && !nativeShell;", "cashAvailableForCountry;"), "плитка OXXO"],
      ["плавающая кнопка Telegram в приложении", edit("layout", "{!nativeShell && theme !== \"reading\" && <TelegramFloatButton", "{theme !== \"reading\" && <TelegramFloatButton"), "кнопка Telegram"],
      ["блок Telegram в Ajustes приложения", edit("profile", "{nativeShell ? (\n            <div className=\"mt-6 rounded-2xl border border-foreground/10 p-5 sm:p-6\" data-rf-legal-links>", "{false ? (\n            <div className=\"mt-6 rounded-2xl border border-foreground/10 p-5 sm:p-6\" data-rf-legal-links>"), "Условий и Политики"],
      ["талон OXXO в кабинете приложения", edit("profile", "{!nativeShell && (openVoucher !== null", "{(openVoucher !== null"), "талон OXXO"],
      ["«Precios» в меню гостя приложения", edit("navbar", "nativeShell ? [legalGroup] : [{ label: dict.nav.pricing", "[{ label: dict.nav.pricing"), "Navbar.tsx"],
      ["колода введения с Telegram в приложении", edit("courses", "nativeShell ? introSlidesForApp(deck) : deck", "deck"), "колода введения"],
      ["кука-метка снова только «если нет»", edit("proxy", 'if (userAgentIsNativeShell(request.headers.get("user-agent"))) {\n    response.cookies.set(NATIVE_SHELL_COOKIE,', 'if (\n    userAgentIsNativeShell(request.headers.get("user-agent")) &&\n    request.cookies.get(NATIVE_SHELL_COOKIE)?.value !== NATIVE_SHELL_COOKIE_VALUE\n  ) {\n    response.cookies.set(NATIVE_SHELL_COOKIE,'), "срок не продлевается"],
      ["клиент продлевает только отсутствующую метку", edit("cookie", "    setNativeShellCookie();\n    if (present) return;", "    if (present) return;\n    setNativeShellCookie();"), "NativeShellCookie.tsx"],
      ["текст рассказа перестал выделяться", edit("story", " data-rf-selectable>", ">"), "StoryText.tsx"],
      ["правило «рамы» пропало", edit("css", "user-select: none;\n  -webkit-touch-callout", "user-select: auto;\n  -webkit-touch-callout"), "globals.css"],
      ["долг 356: приложение снова получает словарь целиком", edit("pageDictionary", "(await isNativeShellRequest()) ? withoutWebPaymentStrings(dict) : dict", "dict"), "page-dictionary.ts"],
      ["долг 356: «Descargar la app» больше не убирается", edit("appDictionary", 'new Set(["footer.appLink"])', "new Set([])"), "app-dictionary.ts"],
      ["долг 356: главная снова берёт словарь мимо признака", editPath("src/app/[lang]/page.tsx", "getPageDictionary(lang)", "getDictionary(lang)"), "src/app/[lang]/page.tsx: словарь страницы"],
      ["долг 356: макет снова берёт словарь мимо признака", editPath("src/app/[lang]/layout.tsx", "const dict = await getPageDictionary(lang);", "const dict = await getDictionary(lang);"), "layout.tsx: словарь страницы"],
    ];
    let caught = 0;
    for (const [name, patched, expect] of cases) {
      if (!patched) {
        console.log(`  НЕ ПРИМЕНИЛАСЬ — ${name}`);
        ok = false;
        continue;
      }
      const hit = judgeStatic(patched).some((m) => m.includes(expect));
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    // Контроль измерителя отдачи на строках из настоящей разметки.
    const probe = measure(
      '<html data-shell="1"><body><footer class="x" data-rf-web-footer><a href="/es/download">Descargar la app</a></footer><a href="https://t.me/+x">Unirme al canal de Telegram</a><dl><dt>OXXO</dt></dl><a href="/es/pricing">Precios</a><script>{"appLink":"Descargar la app","oxxo":"OXXO"}</script></body></html>',
      "/es",
    );
    const probeOk = probe.footer === 1 && probe.download === 2 && probe.telegram === 2 && probe.pay === 2 && probe.shellAttr === 1 && probe.rawOxxo === 2 && probe.rawDownload === 2;
    console.log(`  ${probeOk ? "поймано" : "ПРОПУЩЕНО"} — измеритель отдачи: подвал 1, «Descargar» 2, Telegram 2, оплата 2, словарь в <script> не считается (${JSON.stringify(probe)})`);
    const legalOk = measure("<p>Stripe</p>", "/es/privacy").pay === 0 && measure("<p>Stripe</p>", "/es/stories").pay === 1;
    console.log(`  ${legalOk ? "поймано" : "ПРОПУЩЕНО"} — Stripe прощается только Условиям и Политике`);
    ok &&= caught === cases.length && probeOk && legalOk;
    console.log(ok ? `check:app-mode --plant — ${caught + 2} из ${cases.length + 2} подсадок, 1 из 1 отрицательный контроль` : "check:app-mode --plant — FAILED");
    return ok ? 0 : 1;
  }
  if (bad.length) {
    console.error("check:app-mode — ОТКАЗ:");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("check:app-mode — подвал, Telegram, оплата сайта и «Descargar la app» в приложении закрыты сервером; метка продлевается на каждом запросе; «рама» не выделяется, текст рассказа — выделяется. Контроль — --plant; живая — --base=.");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) main().then((c) => (process.exitCode = c)).catch((e) => { console.error(e); process.exitCode = 1; });
