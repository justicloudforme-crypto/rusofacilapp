/**
 * МАНИФЕСТ ОБЕЩАЕТ ТО, ЧТО ЕСТЬ — ДОЛГ 83 (заход 7.217).
 *
 * Строка долга дословно: «`src/app/manifest.ts` отдаётся (200, 614 байт),
 * четыре иконки на месте и все четыре отдают 200 с верными размерами, но в
 * нём нет `lang`, `id`, `scope`, `categories`, `screenshots`,
 * `orientation`, `related_applications`, и он **один на обе локали**:
 * `name` и `short_name` — `RusoFácilapp` (строки 9, 10), описание только
 * по-испански (строка 11) → установка как PWA и, отдельно, сборка Google
 * TWA, которая строится из этого манифеста → без `related_applications` и
 * `id` магазин не связывает установку с приложением, без `screenshots`
 * установочная карточка Chrome выглядит обрезанной».
 *
 * ШЕСТЬ ПРАВИЛ:
 *   а) все семь недостающих полей на месте — поимённо, а не «какие-то»;
 *   б) манифест зависит от локали, и описание у локалей РАЗНОЕ: русское
 *      обязано быть по-русски (иначе долг вернулся ровно тем, чем был);
 *   в) `<link rel="manifest">` страницы ведёт на локальный адрес, а не на
 *      корневой — иначе локальный манифест никто не прочитает;
 *   г) снимки экрана СУЩЕСТВУЮТ файлами, и объявленные размеры совпадают
 *      с настоящими пикселями PNG;
 *   д) обе формы карточки установки (`narrow` и `wide`) на месте: без
 *      второй Chrome показывает урезанную карточку;
 *   е) `related_applications` непусто ТОГДА И ТОЛЬКО ТОГДА, когда
 *      `STORE_LIVE` — ссылка на несуществующую карточку магазина хуже
 *      отсутствующей.
 *   ж) ЗАХОД 7.259 — ПРЕДЛОЖЕНИЕ ПРИЛОЖЕНИЯ. Приложение в Google Play с
 *      07.10.2026, и владелец решил 08.10.2026: Chrome на Android
 *      предлагает приложение, а не установку сайта. Значит: `STORE_LIVE`
 *      поднят; в карточках ровно одна — `platform: "play"`, `id: APP_ID`,
 *      `url: PLAY_STORE_URL`; `APP_ID` в `brand.ts` — тот же пакет, что
 *      `applicationId` в `android/app/build.gradle`, и это
 *      `com.rusofacilapp.app`; `prefer_related_applications` равен
 *      `STORE_LIVE`; карточки App Store нет (iPhone-версии нет — манифест
 *      её не обещает).
 *
 *   ЖИВАЯ ПОЛОВИНА (`--base=…`, шаг «Rendered surface»): правило «ж» по
 *   ОТДАННОМУ сервером JSON — корень `/manifest.webmanifest` (его адрес
 *   записан у уже установленных копий) и `/es`, `/ru`; плюс страница каждой
 *   локали ведёт `<link rel="manifest">` на свой манифест. Ни одного
 *   прочитанного манифеста — красный («ослеп»). `--plant` — подсадки в
 *   отданный JSON: признак опущен, карточка убрана, `id` испорчен,
 *   добавлен App Store, выборка пуста.
 *
 *   node scripts/check-pwa-manifest.mjs                     # гейт (статика)
 *   node scripts/check-pwa-manifest.mjs --plant             # контроль
 *   node scripts/check-pwa-manifest.mjs --base=http://…     # отдача сервера
 *   node scripts/check-pwa-manifest.mjs --base=… --plant    # её контроль
 *   node scripts/check-pwa-manifest.mjs --base=https://rusofacilapp.com  # прод после выката
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const BASE = (process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length) ?? "").replace(/\/$/, "");
const LIB = "src/lib/pwa-manifest.ts";
const BRAND = "src/lib/brand.ts";
const GRADLE = "android/app/build.gradle";

/** Пакет приложения в Google Play — записан здесь буквой, а не взят из
 *  кода: сторож обязан заметить, если код и магазин разошлись. */
export const PLAY_APP_ID = "com.rusofacilapp.app";
export const PLAY_URL = `https://play.google.com/store/apps/details?id=${PLAY_APP_ID}`;
const ROUTE = "src/app/[lang]/manifest.webmanifest/route.ts";
const LAYOUT = "src/app/[lang]/layout.tsx";

const REQUIRED_FIELDS = ["id", "lang", "dir", "scope", "categories", "screenshots", "orientation", "related_applications"];
const CYRILLIC = /[а-яёА-ЯЁ]/;

/** Ширина и высота PNG — из заголовка IHDR, без единой зависимости. */
export function pngSize(buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(12) !== 0x49484452) return null;
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
}

/**
 * Правило «ж» по уже разобранному манифесту (живая половина). Возвращает
 * список нарушений; `where` — адрес, чтобы отказ говорил, какой файл врёт.
 */
export function storeViolations(manifest, where) {
  const bad = [];
  if (!manifest || typeof manifest !== "object") return [`${where}: манифест не разобран — сторож ослеп, а не доволен`];
  if (manifest.prefer_related_applications !== true) {
    bad.push(
      `${where}: prefer_related_applications = ${JSON.stringify(manifest.prefer_related_applications)}, а не true — Chrome на Android снова предложит поставить сайт, а не приложение`,
    );
  }
  const apps = Array.isArray(manifest.related_applications) ? manifest.related_applications : [];
  const play = apps.filter((a) => a?.platform === "play");
  if (play.length !== 1) {
    bad.push(`${where}: карточек Google Play в related_applications ${play.length}, а не 1 — Chrome не знает, какое приложение предлагать`);
  }
  for (const a of play) {
    if (a.id !== PLAY_APP_ID) bad.push(`${where}: id карточки Google Play «${a.id}», а не «${PLAY_APP_ID}» — Chrome будет искать чужое или несуществующее приложение`);
    if (a.url !== undefined && a.url !== PLAY_URL) bad.push(`${where}: url карточки Google Play «${a.url}», а не «${PLAY_URL}»`);
  }
  const others = apps.filter((a) => a?.platform !== "play");
  if (others.length) {
    bad.push(`${where}: в related_applications лишние карточки (${others.map((a) => a?.platform).join(", ")}) — приложения есть только в Google Play, iPhone-версию манифест не обещает`);
  }
  return bad;
}

export function violations(libRaw, routeRaw, layoutRaw, pngs, brandRaw = read(BRAND), gradleRaw = read(GRADLE)) {
  const bad = [];
  if (!libRaw) {
    bad.push(`${LIB}: файла нет — сторож ослеп, а не доволен`);
    return bad;
  }
  for (const field of REQUIRED_FIELDS) {
    if (!new RegExp(`(^|\\n)\\s*${field}[:,]`).test(libRaw)) {
      bad.push(`${LIB}: поля \`${field}\` в манифесте нет — долг 83 вернулся этим полем`);
    }
  }
  if (!/prefer_related_applications:/.test(libRaw)) {
    bad.push(`${LIB}: поля \`prefer_related_applications\` нет — магазину нечем сказать, что предпочесть`);
  }

  // б) описание зависит от локали, русское — по-русски
  const table = /const DESCRIPTION: Record<Locale, string> = \{([\s\S]*?)\n\};/.exec(libRaw)?.[1] ?? "";
  const es = /es:\s*"([^"]*)"/.exec(table)?.[1] ?? "";
  const ru = /ru:\s*"([^"]*)"/.exec(table)?.[1] ?? "";
  if (!es || !ru) {
    bad.push(`${LIB}: описания на обе локали не объявлены — манифест снова один на всех (долг 83)`);
  } else {
    if (es === ru) bad.push(`${LIB}: описание у локалей одно и то же — русская карточка установки снова по-испански (долг 83)`);
    if (!CYRILLIC.test(ru)) bad.push(`${LIB}: русское описание без единой кириллической буквы (долг 83)`);
  }
  if (!/description: DESCRIPTION\[lang\]/.test(libRaw)) {
    bad.push(`${LIB}: манифест не берёт описание по локали`);
  }

  // в) страница ведёт на локальный манифест
  if (!routeRaw) bad.push(`${ROUTE}: локального манифеста нет вовсе (долг 83)`);
  if (layoutRaw && !/manifest: `\/\$\{lang\}\/manifest\.webmanifest`/.test(layoutRaw)) {
    bad.push(`${LAYOUT}: <link rel="manifest"> ведёт не на локальный адрес — локальный манифест никто не прочитает (долг 83)`);
  }

  // г, д) снимки экрана
  const shots = [...libRaw.matchAll(/src:\s*"(\/screenshots\/[^"]+)",\s*\n\s*sizes:\s*"(\d+x\d+)"[\s\S]*?form_factor:\s*"(\w+)"/g)].map(
    (m) => ({ src: m[1], sizes: m[2], form: m[3] }),
  );
  if (shots.length === 0) bad.push(`${LIB}: снимков экрана не объявлено ни одного — карточка установки останется обрезанной (долг 83)`);
  for (const shot of shots) {
    const real = pngs[shot.src];
    if (real === undefined) bad.push(`${LIB}: снимок ${shot.src} объявлен, а файла нет (долг 83)`);
    else if (real !== shot.sizes) bad.push(`${LIB}: у ${shot.src} объявлено ${shot.sizes}, а в файле ${real} (долг 83)`);
  }
  for (const form of ["narrow", "wide"]) {
    if (!shots.some((s) => s.form === form)) bad.push(`${LIB}: формы «${form}» среди снимков нет — Chrome покажет урезанную карточку (долг 83)`);
  }

  // е) карточки магазинов — только когда они есть
  const live = /export const STORE_LIVE = (true|false);/.exec(libRaw)?.[1];
  if (live === undefined) {
    bad.push(`${LIB}: признака STORE_LIVE нет — нечем сказать, стоит ли приложение в магазинах`);
  } else {
    const listings = /STORE_LISTINGS[\s\S]*?=\s*STORE_LIVE\s*\n?\s*\?\s*\[([\s\S]*?)\]\s*\n?\s*:\s*\[\]/.test(libRaw);
    if (!listings) {
      bad.push(`${LIB}: список карточек магазинов не привязан к STORE_LIVE — ссылка в несуществующий магазин ведёт человека в тупик (долг 83)`);
    }
  }

  // ж) предложение приложения — заход 7.259
  if (live === "false") {
    bad.push(`${LIB}: STORE_LIVE = false, а приложение в Google Play с 07.10.2026 — Chrome на Android предлагает поставить сайт вместо приложения (решение владельца 08.10.2026, заход 7.259)`);
  }
  if (!/prefer_related_applications:\s*STORE_LIVE\b/.test(libRaw)) {
    bad.push(`${LIB}: prefer_related_applications не равен STORE_LIVE — признак и предпочтение приложения разошлись (заход 7.259)`);
  }
  if (!/related_applications:\s*STORE_LISTINGS\b/.test(libRaw)) {
    bad.push(`${LIB}: related_applications манифеста — не STORE_LISTINGS (заход 7.259)`);
  }
  const listing = /STORE_LISTINGS[\s\S]*?=\s*STORE_LIVE\s*\n?\s*\?\s*\[([\s\S]*?)\]\s*\n?\s*:/.exec(libRaw)?.[1] ?? "";
  const entries = [...listing.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
  const playEntries = entries.filter((e) => /platform:\s*"play"/.test(e));
  if (entries.length !== 1 || playEntries.length !== 1) {
    bad.push(`${LIB}: в STORE_LISTINGS карточек ${entries.length}, из них Google Play ${playEntries.length} — нужна ровно одна, Google Play (заход 7.259)`);
  }
  for (const e of playEntries) {
    if (!/\bid:\s*APP_ID\b/.test(e)) bad.push(`${LIB}: у карточки Google Play id — не APP_ID (заход 7.259)`);
    if (!/\burl:\s*PLAY_STORE_URL\b/.test(e)) bad.push(`${LIB}: у карточки Google Play url — не PLAY_STORE_URL (заход 7.259)`);
  }
  if (!/export const PLAY_STORE_URL = `https:\/\/play\.google\.com\/store\/apps\/details\?id=\$\{APP_ID\}`;/.test(libRaw)) {
    bad.push(`${LIB}: PLAY_STORE_URL — не страница пакета APP_ID в Google Play (заход 7.259)`);
  }
  const brandId = /export const APP_ID = "([^"]+)";/.exec(brandRaw)?.[1];
  if (brandId !== PLAY_APP_ID) bad.push(`${BRAND}: APP_ID «${brandId ?? "—"}», а в Google Play опубликован «${PLAY_APP_ID}» (заход 7.259)`);
  const gradleId = /applicationId\s+"([^"]+)"/.exec(gradleRaw)?.[1];
  if (gradleId !== PLAY_APP_ID) bad.push(`${GRADLE}: applicationId «${gradleId ?? "—"}», а манифест сайта называет «${PLAY_APP_ID}» (заход 7.259)`);
  return bad;
}

function livePngs() {
  const out = {};
  for (const src of ["/screenshots/home-narrow.png", "/screenshots/home-wide.png"]) {
    try {
      out[src] = pngSize(readFileSync(`public${src}`));
    } catch {
      // файла нет — правило «г» это и скажет
    }
  }
  return out;
}

function read(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function plant() {
  const lib = read(LIB);
  const route = read(ROUTE);
  const layout = read(LAYOUT);
  const pngs = livePngs();
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(lib, route, layout, pngs).length === 0 }];
  const brand = read(BRAND);
  const add = (name, l, r, la, p, expect, b = brand) => {
    if (l === lib && r === route && la === layout && JSON.stringify(p) === JSON.stringify(pngs) && b === brand) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(l, r, la, p, b).some((x) => x.includes(expect)) });
  };

  add("подсадка: поле scope убрано (состояние до 19.09.2026)", lib.replace(/\n    scope: "\/",/, ""), route, layout, pngs, "поля `scope`");
  add("подсадка: описание снова одно на обе локали", lib.replace(/\bru: "[^"]*"/, `ru: "${/\bes: "([^"]*)"/.exec(lib)?.[1] ?? ""}"`), route, layout, pngs, "описание у локалей одно и то же");
  add("подсадка: локального манифеста нет", lib, "", layout, pngs, "локального манифеста нет вовсе");
  add("подсадка: страница снова ведёт на корневой манифест", lib, route, layout.replace("manifest: `/${lang}/manifest.webmanifest`", 'manifest: "/manifest.webmanifest"'), pngs, "ведёт не на локальный адрес");
  add("подсадка: файл снимка пропал", lib, route, layout, { ...pngs, "/screenshots/home-wide.png": undefined }, "а файла нет");
  add("подсадка: объявленный размер снимка не совпал с файлом", lib, route, layout, { ...pngs, "/screenshots/home-narrow.png": "360x640" }, "а в файле 360x640");
  add("подсадка: широкая форма снимка убрана", lib.replace(/\n  \{\n    src: "\/screenshots\/home-wide\.png",[\s\S]*?\n  \},/, ""), route, layout, pngs, "формы «wide»");
  add("подсадка: STORE_LIVE снова опущен (состояние до 7.259)", lib.replace("export const STORE_LIVE = true;", "export const STORE_LIVE = false;"), route, layout, pngs, "STORE_LIVE = false");
  add("подсадка: prefer_related_applications прибит к false", lib.replace("prefer_related_applications: STORE_LIVE", "prefer_related_applications: false"), route, layout, pngs, "prefer_related_applications не равен STORE_LIVE");
  add("подсадка: id карточки Google Play испорчен", lib.replace(/id: APP_ID \}/, 'id: "com.rusofacil.app" }'), route, layout, pngs, "id — не APP_ID");
  add("подсадка: в карточки добавлен App Store", lib.replace(/\[\{ platform: "play"/, '[{ platform: "itunes", url: "https://apps.apple.com/app/id1" }, { platform: "play"'), route, layout, pngs, "из них Google Play 1");
  add("подсадка: карточка Google Play убрана из списка", lib.replace(/\? \[\{ platform: "play"[^\]]*\]/, "? []"), route, layout, pngs, "из них Google Play 0");
  add("подсадка: APP_ID в brand.ts разошёлся с Google Play", lib, route, layout, pngs, "APP_ID «com.rusofacil.app»", read(BRAND).replace('APP_ID = "com.rusofacilapp.app"', 'APP_ID = "com.rusofacil.app"'));
  add("подсадка: карточка магазина объявлена мимо STORE_LIVE", lib.replace(/= STORE_LIVE[\s\S]*?: \[\];/, '= [{ platform: "play", url: "https://play.google.com/store/apps/details?id=x" }];'), route, layout, pngs, "не привязан к STORE_LIVE");

  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:pwa-manifest --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:pwa-manifest --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(read(LIB), read(ROUTE), read(LAYOUT), livePngs());
  if (bad.length) {
    console.error(`check:pwa-manifest — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `check:pwa-manifest — 7 правил, полей ${REQUIRED_FIELDS.length}, снимков 2, локалей 2, карточка Google Play ${PLAY_APP_ID}, prefer_related_applications true, нарушений 0 (долг 83, заход 7.259)`,
  );
}

// ---------------------------------------------------------------- живая

const MANIFEST_PATHS = ["/manifest.webmanifest", "/es/manifest.webmanifest", "/ru/manifest.webmanifest"];
const PAGE_LINKS = [
  { page: "/es", manifest: "/es/manifest.webmanifest" },
  { page: "/ru", manifest: "/ru/manifest.webmanifest" },
];

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) check-pwa-manifest" } });
  return { status: res.status, text: await res.text() };
}

/** Снимок отдачи: разобранные манифесты и href `<link rel="manifest">` страниц. */
async function liveSnapshot(base) {
  const manifests = {};
  for (const path of MANIFEST_PATHS) {
    try {
      const r = await fetchText(`${base}${path}`);
      manifests[path] = r.status === 200 ? JSON.parse(r.text) : { __status: r.status };
    } catch (e) {
      manifests[path] = { __error: String(e?.message ?? e) };
    }
  }
  const links = {};
  for (const { page } of PAGE_LINKS) {
    try {
      const r = await fetchText(`${base}${page}`);
      const tag = [...r.text.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((t) => /\brel=["']?manifest\b/i.test(t));
      links[page] = tag ? (/\bhref=["']([^"']+)["']/i.exec(tag)?.[1] ?? null) : null;
    } catch {
      links[page] = null;
    }
  }
  return { manifests, links };
}

export function liveViolations(snapshot) {
  const bad = [];
  const read = Object.entries(snapshot.manifests).filter(([, m]) => m && !m.__status && !m.__error);
  if (read.length === 0) return ["отдача: ни одного манифеста не прочитано — сторож ослеп, а не доволен"];
  for (const [path, m] of Object.entries(snapshot.manifests)) {
    if (m?.__status || m?.__error) {
      bad.push(`${path}: ${m.__status ? `ответ ${m.__status}` : `ошибка ${m.__error}`} — манифест не отдаётся`);
      continue;
    }
    bad.push(...storeViolations(m, path));
  }
  for (const { page, manifest } of PAGE_LINKS) {
    const href = snapshot.links[page];
    if (href !== manifest) bad.push(`${page}: <link rel="manifest"> ведёт на «${href ?? "—"}», а не на «${manifest}»`);
  }
  return bad;
}

async function liveGate(base) {
  const snap = await liveSnapshot(base);
  const bad = liveViolations(snap);
  if (bad.length) {
    console.error(`check:pwa-manifest (живая, ${base}) — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `check:pwa-manifest (живая, ${base}) — манифестов ${MANIFEST_PATHS.length}, у каждого одна карточка Google Play ${PLAY_APP_ID} и prefer_related_applications true; ссылок страниц ${PAGE_LINKS.length}; нарушений 0`,
  );
}

async function livePlant(base) {
  const snap = await liveSnapshot(base);
  const clone = () => JSON.parse(JSON.stringify(snap));
  const cases = [{ name: "отрицательный контроль: настоящая отдача чиста", ok: liveViolations(snap).length === 0 }];
  const add = (name, mutate, expect) => {
    const s = clone();
    mutate(s);
    cases.push({ name, ok: liveViolations(s).some((x) => x.includes(expect)) });
  };
  const ru = "/ru/manifest.webmanifest";
  const root = "/manifest.webmanifest";
  add("подсадка: prefer_related_applications опущен (отдача до 7.259)", (s) => { s.manifests[ru].prefer_related_applications = false; }, "а не true");
  add("подсадка: карточка Google Play убрана", (s) => { s.manifests[root].related_applications = []; }, "карточек Google Play в related_applications 0");
  add("подсадка: id карточки испорчен", (s) => { for (const a of s.manifests[ru].related_applications ?? []) a.id = "com.rusofacil.app"; }, "id карточки Google Play «com.rusofacil.app»");
  add("подсадка: добавлен App Store", (s) => { s.manifests[root].related_applications = [...(s.manifests[root].related_applications ?? []), { platform: "itunes", url: "https://apps.apple.com/app/id1" }]; }, "лишние карточки (itunes)");
  add("подсадка: манифест не отдаётся", (s) => { s.manifests[ru] = { __status: 404 }; }, "ответ 404");
  add("подсадка: страница ведёт на корневой манифест", (s) => { s.links["/ru"] = "/manifest.webmanifest"; }, "/ru: <link rel=\"manifest\">");
  add("подсадка: выборка пуста", (s) => { for (const k of Object.keys(s.manifests)) s.manifests[k] = { __status: 500 }; }, "ослеп");
  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:pwa-manifest (живая) --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:pwa-manifest (живая) --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (BASE) await (PLANT ? livePlant(BASE) : liveGate(BASE));
  else if (PLANT) plant();
  else gate();
}
