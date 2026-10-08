// ССЫЛКА НА ПРИЛОЖЕНИЕ В GOOGLE PLAY: В БРАУЗЕРЕ ЕСТЬ, В ПРИЛОЖЕНИИ НЕТ —
// заход 7.258.
//
// ОТКУДА. Приложение «RusoFácil: aprender ruso» опубликовано в Google Play
// 07.10.2026 (продакшн, сборка 14 / 1.0.13). До захода 7.258 на сайте не
// было ни одной ссылки на его страницу, а `/download` и «О проекте»
// по-прежнему говорили «Próximamente» и «это не приложение из Google
// Play». Бейдж (`src/components/PlayStoreBadge.tsx`) стоит на главной, на
// странице цен, в подвале и на `/download`; внутри приложения его нет —
// предлагать установку тому, кто уже в приложении, неправда (долг 154).
//
// ЧТО СТЕРЕЖЁТСЯ.
//   1. СТАТИЧЕСКАЯ (без `--base`). Компонент возвращает `null` в
//      приложении ДО разметки; ссылка — ровно `PLAY_STORE_URL` из
//      `pwa-manifest.ts`, и этот адрес — страница пакета `APP_ID`; три
//      места (главная, цены, подвал) и `/download` передают признак
//      приложения с сервера; файлы бейджей на месте и 646×250; в подписях
//      нет «лучший»/«бесплатно»/эмодзи, испанский — на tú; в словарях
//      `/download` и в «О проекте» нет «скоро» и «это не приложение из
//      Google Play». `--plant` — подсадки в исходники.
//   2. ЖИВАЯ (`--base=…`). Обе локали: главная, цены, `/download`,
//      глоссарий (подвал без своего бейджа). В браузере каждое место
//      обязано найтись ровно один раз с точным адресом; в ответе
//      приложения (токен User-Agent + кука-метка) адреса магазина,
//      `data-rf-play-link` и файла бейджа — 0 в ИСХОДНОМ коде целиком (с
//      данными отрисовки), и у него обязан быть `data-shell="1"`, иначе
//      «0» доказан не тем ответом. Пустая выборка — красная. `--plant` —
//      бейдж убран из браузера, подсажен в приложение, выборка пуста,
//      приложение без признака; настоящая отдача — отрицательный контроль.
//
//   node scripts/check-play-link.mjs [--plant]
//   node scripts/check-play-link.mjs --base=http://… [--plant]
//   node scripts/check-play-link.mjs --base=https://rusofacilapp.com   (прод после выката)
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const APP_ID = "com.rusofacilapp.app";
export const PLAY_URL = `https://play.google.com/store/apps/details?id=${APP_ID}`;

const FILES = {
  badge: "src/components/PlayStoreBadge.tsx",
  manifest: "src/lib/pwa-manifest.ts",
  brand: "src/lib/brand.ts",
  home: "src/app/[lang]/page.tsx",
  pricing: "src/app/[lang]/pricing/page.tsx",
  footer: "src/components/Footer.tsx",
  download: "src/app/[lang]/download/page.tsx",
  about: "src/lib/about-content.ts",
  es: "src/dictionaries/es.json",
  ru: "src/dictionaries/ru.json",
};
const BADGES = ["public/badges/google-play-es.png", "public/badges/google-play-ru.png"];

const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** Ширина и высота PNG из заголовка IHDR; null — не PNG. */
export function pngSize(buf) {
  if (!buf || buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

/** Слова, которых в подписях бейджа быть не должно (поручение владельца 7.258). */
const BANNED = /mejor|gratis|gratuit|лучш|бесплатн|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/iu;
/** Испанский — на tú: формы на usted в подписях запрещены. */
const USTED = /\busted\b|\bdescargue\b|\binstale\b|\bestudia usted\b/i;

/** Строки словаря `/download` и «О проекте», ставшие неправдой 07.10.2026. */
const STALE = [
  /Próximamente/,
  /Todavía no hay nada que instalar/,
  /Estamos preparando una app/,
  /Скоро"/,
  /Устанавливать пока нечего/,
  /Мы готовим приложение/,
  /no es una aplicación de App Store o Google Play/,
  /не приложение из App Store или Google Play/,
];

export function judgeStatic(files, pngs) {
  const f = Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, strip(files[p] ?? "")]));
  const bad = [];
  const need = (cond, msg) => {
    if (!cond) bad.push(msg);
  };
  // Компонент.
  const gate = f.badge.indexOf("if (nativeShell) return null;");
  const anchor = f.badge.indexOf("<a");
  need(gate !== -1 && anchor !== -1 && gate < anchor, "PlayStoreBadge.tsx: ссылка рисуется в приложении (нет `if (nativeShell) return null;` до разметки)");
  need(/href=\{PLAY_STORE_URL\}/.test(f.badge), "PlayStoreBadge.tsx: ссылка ведёт не на PLAY_STORE_URL");
  need(/data-rf-play-link=\{placement\}/.test(f.badge), "PlayStoreBadge.tsx: нет метки data-rf-play-link — живой половине нечего считать");
  need(/import \{ PLAY_STORE_URL \} from "@\/lib\/pwa-manifest";/.test(f.badge), "PlayStoreBadge.tsx: адрес взят не из pwa-manifest.ts");
  need(/rel="noopener noreferrer"/.test(f.badge) && /target="_blank"/.test(f.badge), "PlayStoreBadge.tsx: внешняя ссылка без target/rel");
  // Адрес.
  need(/export const PLAY_STORE_URL = `https:\/\/play\.google\.com\/store\/apps\/details\?id=\$\{APP_ID\}`;/.test(f.manifest), "pwa-manifest.ts: PLAY_STORE_URL — не страница пакета APP_ID");
  need(new RegExp(`export const APP_ID = "${APP_ID.replace(/\./g, "\\.")}";`).test(f.brand), `brand.ts: APP_ID не ${APP_ID}`);
  // Места.
  need(/<PlayStoreBadge lang=\{lang\} nativeShell=\{nativeShell\} placement="home" \/>/.test(f.home), "page.tsx (главная): бейджа нет или признак приложения не передан");
  need(/\[[^\]]*nativeShell\] = await Promise\.all\(\[[\s\S]*?isNativeShellRequest\(\),\s*\]\)/.test(f.home), "page.tsx (главная): nativeShell не из isNativeShellRequest()");
  need(/<PlayStoreBadge lang=\{lang\} nativeShell=\{nativeShell\} placement="pricing" \/>/.test(f.pricing), "pricing/page.tsx: бейджа нет или признак приложения не передан");
  need(/const nativeShell = await isNativeShellRequest\(\);/.test(f.pricing), "pricing/page.tsx: nativeShell не из isNativeShellRequest()");
  need(/<PlayStoreBadge lang=\{lang\} nativeShell=\{nativeShell\} placement="footer" \/>/.test(f.footer), "Footer.tsx: бейджа нет или признак приложения не передан");
  need(/\{playTrademarkNote\(lang\)\}/.test(f.footer), "Footer.tsx: нет строки о товарных знаках Google рядом с бейджем");
  need(/<PlayStoreBadge lang=\{lang\} nativeShell=\{nativeShell\} placement="download" \/>/.test(f.download), "download/page.tsx: бейджа нет или признак приложения не передан");
  need(/const nativeShell = await isNativeShellRequest\(\);/.test(f.download), "download/page.tsx: nativeShell не из isNativeShellRequest()");
  // Подписи.
  const copy = /const COPY[\s\S]*?\n\};/.exec(files[FILES.badge] ?? "")?.[0] ?? "";
  need(copy.length > 0, "PlayStoreBadge.tsx: таблицы подписей COPY нет");
  const banned = copy.match(BANNED);
  if (banned) bad.push(`PlayStoreBadge.tsx: в подписях «${banned[0]}» — запрещено («лучший», «бесплатно», эмодзи)`);
  const usted = copy.match(USTED);
  if (usted) bad.push(`PlayStoreBadge.tsx: испанский на usted («${usted[0]}») — нужен tú`);
  // Правда текстов после публикации.
  for (const key of ["es", "ru"]) {
    let dl = "";
    try {
      dl = JSON.stringify(JSON.parse(files[FILES[key]] ?? "{}").download ?? {});
    } catch {
      bad.push(`${FILES[key]}: не JSON`);
    }
    for (const re of STALE) if (re.test(dl)) bad.push(`${FILES[key]} → download: «${re.source}» — приложение уже в Google Play`);
  }
  for (const re of STALE) if (re.test(files[FILES.about] ?? "")) bad.push(`about-content.ts: «${re.source}» — приложение уже в Google Play`);
  // Файлы бейджей.
  for (const p of BADGES) {
    const size = pngs[p];
    if (size !== "646x250") bad.push(`${p}: ${size === undefined ? "файла нет" : `размер ${size}, ожидается 646x250 (официальный бейдж без правок)`}`);
  }
  return bad;
}

// ---------------------------------------------------------------- отдача
const UA = "Mozilla/5.0 (Linux; Android 16; POCO) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Mobile Safari/537.36";
const APP_UA = `${UA} RFNativeShell/14`;

/** Где и сколько раз бейдж обязан стоять в БРАУЗЕРЕ. */
export const EXPECT = {
  "": { home: 1, footer: 1 },
  "/pricing": { pricing: 1, footer: 1 },
  "/download": { download: 1, footer: 1 },
  "/glossary": { footer: 1 },
};
export const LANGS = ["es", "ru"];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Бейджи в одном ответе: по местам, с точным адресом; плюс сырые приметы. */
export function measure(html) {
  const places = {};
  let wrongHref = 0;
  for (const tag of html.match(/<a\b[^>]*data-rf-play-link="[^"]*"[^>]*>/gi) ?? []) {
    const place = /data-rf-play-link="([^"]*)"/i.exec(tag)[1];
    const href = /\bhref="([^"]*)"/i.exec(tag)?.[1]?.replace(/&amp;/g, "&");
    if (href === PLAY_URL) places[place] = (places[place] ?? 0) + 1;
    else wrongHref++;
  }
  return {
    places,
    wrongHref,
    rawStore: (html.match(new RegExp(escapeRe("play.google.com/store/apps"), "g")) ?? []).length,
    rawMark: (html.match(/data-rf-play-link/g) ?? []).length,
    rawBadge: (html.match(/google-play-(es|ru)\.png/g) ?? []).length,
    shellAttr: /<html\b[^>]*\bdata-shell="1"/.test(html),
  };
}

/** Суд над выборкой `rows` = [{ lang, path, web, app }]. Пусто — красное. */
export function judgeLive(rows) {
  const problems = [];
  if (rows.length === 0) return ["выборка пуста — «0 в приложении» доказан пустотой"];
  const expected = LANGS.length * Object.keys(EXPECT).length;
  if (rows.length < expected) problems.push(`ответов ${rows.length} из ${expected} — часть страниц не открылась`);
  for (const { lang, path, web, app } of rows) {
    const where = `/${lang}${path}`;
    if (web == null) problems.push(`${where} (браузер): страница не отдала 200`);
    else {
      const m = measure(web);
      const want = EXPECT[path] ?? {};
      for (const [place, n] of Object.entries(want)) {
        if ((m.places[place] ?? 0) !== n) problems.push(`${where} (браузер): бейдж «${place}» ${m.places[place] ?? 0} раз, ожидается ${n}`);
      }
      for (const place of Object.keys(m.places)) if (!(place in want)) problems.push(`${where} (браузер): лишний бейдж «${place}»`);
      if (m.wrongHref) problems.push(`${where} (браузер): ${m.wrongHref} бейдж(ей) ведут не на ${PLAY_URL}`);
      if (m.shellAttr) problems.push(`${where} (браузер): у <html> data-shell — ответ браузеру принят за приложение`);
    }
    if (app == null) problems.push(`${where} (приложение): страница не отдала 200`);
    else {
      const m = measure(app);
      if (!m.shellAttr) problems.push(`${where} (приложение): у <html> нет data-shell — это не ответ приложению, и «0» ничего не доказывает`);
      if (m.rawStore || m.rawMark || m.rawBadge) {
        problems.push(`${where} (приложение): адрес магазина ${m.rawStore}, меток data-rf-play-link ${m.rawMark}, файла бейджа ${m.rawBadge} — в приложении их быть не должно`);
      }
    }
  }
  return problems;
}

async function get(base, path, app) {
  const headers = { "user-agent": app ? APP_UA : UA };
  if (app) headers.cookie = "rf_native_shell=1; rf_shell_version=14";
  const res = await fetch(`${base}${path}`, { headers, redirect: "manual", signal: AbortSignal.timeout(60_000) });
  return res.status === 200 ? res.text() : null;
}

async function live(base, plant) {
  const rows = [];
  for (const lang of LANGS) {
    for (const path of Object.keys(EXPECT)) {
      rows.push({ lang, path, web: await get(base, `/${lang}${path}`, false), app: await get(base, `/${lang}${path}`, true) });
    }
  }
  const problems = judgeLive(rows);
  const web = rows.reduce((s, r) => s + (r.web ? Object.values(measure(r.web).places).reduce((a, b) => a + b, 0) : 0), 0);
  const appRaw = rows.reduce((s, r) => s + (r.app ? measure(r.app).rawStore + measure(r.app).rawMark + measure(r.app).rawBadge : 0), 0);
  console.log(`  страниц ${rows.length} (2 локали × ${Object.keys(EXPECT).length}): бейджей в браузере ${web}, примет магазина в приложении ${appRaw}`);
  if (plant) {
    const strip1 = (html) => html.replace(/<a\b[^>]*data-rf-play-link="(home|pricing)"[\s\S]*?<\/a>/i, "");
    const stripFooter = (html) => html.replace(/<a\b[^>]*data-rf-play-link="footer"[\s\S]*?<\/a>/i, "");
    const inject = (html) => html.replace("</body>", `<a href="${PLAY_URL}" data-rf-play-link="footer"><img src="/badges/google-play-es.png" alt=""></a></body>`);
    const cases = [
      ["бейдж убран с главной и цен в браузере", rows.map((r) => ({ ...r, web: r.web && strip1(r.web) }))],
      ["бейдж убран из подвала в браузере", rows.map((r) => ({ ...r, web: r.web && stripFooter(r.web) }))],
      ["бейдж ведёт не туда", rows.map((r) => ({ ...r, web: r.web && r.web.replaceAll(`href="${PLAY_URL.replace(/&/g, "&amp;")}"`, 'href="https://play.google.com/store/apps/details?id=x"') }))],
      ["бейдж подсажен в ответ приложения", rows.map((r) => ({ ...r, app: r.app && inject(r.app) }))],
      ["адрес магазина в данных отрисовки приложения", rows.map((r) => ({ ...r, app: r.app && r.app.replace("</body>", `<script>self.__next_f.push([1,"${PLAY_URL}"])</script></body>`) }))],
      ["ответ браузера выдан за ответ приложения", rows.map((r) => ({ ...r, app: r.web }))],
      ["выборка пуста", []],
      ["пол выборки: одна страница", rows.slice(0, 1)],
    ];
    let caught = 0;
    for (const [name, sample] of cases) {
      const hit = judgeLive(sample).length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    const clean = problems.length === 0;
    console.log(`  ${clean ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящая отдача (отрицательный контроль)`);
    const ok = clean && caught === cases.length;
    console.log(ok ? `check:play-link --base --plant — ${caught} из ${cases.length} подсадок, 1 из 1 отрицательный контроль` : "check:play-link --base --plant — FAILED");
    return ok ? 0 : 1;
  }
  if (problems.length) {
    console.error("check:play-link (живая) — ОТКАЗ:");
    for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
    return 1;
  }
  console.log(`check:play-link (живая) — бейдж Google Play на ${web} местах в браузере (главная, цены, /download, подвал; es и ru), в ответах приложения 0.`);
  return 0;
}

function readAll() {
  const files = {};
  for (const p of Object.values(FILES)) files[p] = readFileSync(p, "utf8");
  const pngs = {};
  for (const p of BADGES) {
    try {
      pngs[p] = pngSize(readFileSync(p));
    } catch {
      // файла нет — правило это и скажет
    }
  }
  return { files, pngs };
}

async function main() {
  const plant = process.argv.includes("--plant");
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  if (baseArg) return live(baseArg.slice("--base=".length).replace(/\/$/, ""), plant);
  const { files, pngs } = readAll();
  const bad = judgeStatic(files, pngs);
  if (plant) {
    let ok = bad.length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие исходники`);
    const edit = (key, from, to) => {
      const p = FILES[key];
      const next = files[p].replace(from, to);
      return next === files[p] ? null : { ...files, [p]: next };
    };
    const cases = [
      ["бейдж рисуется в приложении", edit("badge", "  if (nativeShell) return null;\n", ""), "рисуется в приложении"],
      ["бейдж убран с главной", edit("home", '<PlayStoreBadge lang={lang} nativeShell={nativeShell} placement="home" />', ""), "главная"],
      ["главная передаёт «не приложение» всегда", edit("home", 'nativeShell={nativeShell} placement="home"', 'nativeShell={false} placement="home"'), "главная"],
      ["бейдж убран с цен", edit("pricing", '<PlayStoreBadge lang={lang} nativeShell={nativeShell} placement="pricing" />', ""), "pricing/page.tsx"],
      ["бейдж убран из подвала", edit("footer", '<PlayStoreBadge lang={lang} nativeShell={nativeShell} placement="footer" />', ""), "Footer.tsx: бейджа нет"],
      ["строка о товарных знаках убрана", edit("footer", "{playTrademarkNote(lang)}", ""), "товарных знаках"],
      ["бейдж убран с /download", edit("download", '<PlayStoreBadge lang={lang} nativeShell={nativeShell} placement="download" />', ""), "download/page.tsx"],
      ["адрес магазина — чужой пакет", edit("manifest", "details?id=${APP_ID}`;", "details?id=com.example.app`;"), "PLAY_STORE_URL"],
      ["ссылка не на PLAY_STORE_URL", edit("badge", "href={PLAY_STORE_URL}", 'href="https://play.google.com/store"'), "не на PLAY_STORE_URL"],
      ["метка data-rf-play-link убрана", edit("badge", "data-rf-play-link={placement}", ""), "data-rf-play-link"],
      ["в подписи «gratis»", edit("badge", "ya está en Google Play.", "ya está gratis en Google Play."), "запрещено"],
      ["в подписи «лучшее»", edit("badge", "Приложение для Android уже в Google Play.", "Лучшее приложение для Android уже в Google Play."), "запрещено"],
      ["в подписи эмодзи", edit("badge", "ya está en Google Play.", "ya está en Google Play 🎉"), "запрещено"],
      ["испанский на usted", edit("badge", "¿Estudias en el celular?", "¿Usted estudia en el celular?"), "usted"],
      ["/download снова «Próximamente»", edit("es", '"badge": "Android",', '"badge": "Próximamente",'), "download: «Próximamente»"],
      ["«О проекте» снова «не приложение из Google Play»", edit("about", "и как приложение из Google Play", "и это не приложение из App Store или Google Play"), "about-content.ts"],
    ];
    let caught = 0;
    for (const [name, patched, expect] of cases) {
      if (!patched) {
        console.log(`  НЕ ПРИМЕНИЛАСЬ — ${name}`);
        ok = false;
        continue;
      }
      const hit = judgeStatic(patched, pngs).some((m) => m.includes(expect));
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    const noFile = judgeStatic(files, { [BADGES[0]]: pngs[BADGES[0]] }).some((m) => m.includes(BADGES[1]));
    const resized = judgeStatic(files, { ...pngs, [BADGES[0]]: "300x116" }).some((m) => m.includes("646x250"));
    console.log(`  ${noFile ? "поймано" : "ПРОПУЩЕНО"} — файла бейджа нет`);
    console.log(`  ${resized ? "поймано" : "ПРОПУЩЕНО"} — бейдж пережат`);
    const probe = measure(`<html><body><a class="x" href="${PLAY_URL}" data-rf-play-link="footer"><img src="/badges/google-play-ru.png"></a></body></html>`);
    const probeOk = probe.places.footer === 1 && probe.rawStore === 1 && probe.rawMark === 1 && probe.rawBadge === 1 && !probe.shellAttr;
    console.log(`  ${probeOk ? "поймано" : "ПРОПУЩЕНО"} — измеритель отдачи: подвал 1, адрес 1, метка 1, файл 1`);
    const total = cases.length + 3;
    const got = caught + Number(noFile) + Number(resized) + Number(probeOk);
    ok &&= got === total;
    console.log(ok ? `check:play-link --plant — ${got} из ${total} подсадок, 1 из 1 отрицательный контроль` : "check:play-link --plant — FAILED");
    return ok ? 0 : 1;
  }
  if (bad.length) {
    console.error("check:play-link — ОТКАЗ:");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("check:play-link — бейдж Google Play на главной, в ценах, в подвале и на /download закрыт признаком приложения с сервера; адрес — страница com.rusofacilapp.app; подписи без «лучший»/«бесплатно»/эмодзи; «Próximamente» и «не приложение из Google Play» нет. Контроль — --plant; живая — --base=.");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) main().then((c) => (process.exitCode = c)).catch((e) => { console.error(e); process.exitCode = 1; });
