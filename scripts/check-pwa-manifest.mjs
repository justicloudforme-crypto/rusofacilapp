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
 *
 *   node scripts/check-pwa-manifest.mjs          # гейт
 *   node scripts/check-pwa-manifest.mjs --plant  # контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const LIB = "src/lib/pwa-manifest.ts";
const ROUTE = "src/app/[lang]/manifest.webmanifest/route.ts";
const LAYOUT = "src/app/[lang]/layout.tsx";

const REQUIRED_FIELDS = ["id", "lang", "dir", "scope", "categories", "screenshots", "orientation", "related_applications"];
const CYRILLIC = /[а-яёА-ЯЁ]/;

/** Ширина и высота PNG — из заголовка IHDR, без единой зависимости. */
export function pngSize(buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(12) !== 0x49484452) return null;
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
}

export function violations(libRaw, routeRaw, layoutRaw, pngs) {
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
  const add = (name, l, r, la, p, expect) => {
    if (l === lib && r === route && la === layout && JSON.stringify(p) === JSON.stringify(pngs)) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(l, r, la, p).some((x) => x.includes(expect)) });
  };

  add("подсадка: поле scope убрано (состояние до 19.09.2026)", lib.replace(/\n    scope: "\/",/, ""), route, layout, pngs, "поля `scope`");
  add("подсадка: описание снова одно на обе локали", lib.replace(/\bru: "[^"]*"/, `ru: "${/\bes: "([^"]*)"/.exec(lib)?.[1] ?? ""}"`), route, layout, pngs, "описание у локалей одно и то же");
  add("подсадка: локального манифеста нет", lib, "", layout, pngs, "локального манифеста нет вовсе");
  add("подсадка: страница снова ведёт на корневой манифест", lib, route, layout.replace("manifest: `/${lang}/manifest.webmanifest`", 'manifest: "/manifest.webmanifest"'), pngs, "ведёт не на локальный адрес");
  add("подсадка: файл снимка пропал", lib, route, layout, { ...pngs, "/screenshots/home-wide.png": undefined }, "а файла нет");
  add("подсадка: объявленный размер снимка не совпал с файлом", lib, route, layout, { ...pngs, "/screenshots/home-narrow.png": "360x640" }, "а в файле 360x640");
  add("подсадка: широкая форма снимка убрана", lib.replace(/\n  \{\n    src: "\/screenshots\/home-wide\.png",[\s\S]*?\n  \},/, ""), route, layout, pngs, "формы «wide»");
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
  console.log(`check:pwa-manifest — 6 правил, полей ${REQUIRED_FIELDS.length}, снимков 2, локалей 2, нарушений 0 (долг 83)`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
