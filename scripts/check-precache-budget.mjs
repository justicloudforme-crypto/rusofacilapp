/**
 * СКОЛЬКО ВЕСИТ ОБЩИЙ КАРКАС И ЧТО В НЕГО ПОПАЛО — ЗАХОД 7.227 (ОФЛАЙН-1).
 *
 * Precache — единственный кеш, который воркер наполняет САМ, не спрашивая
 * человека, и держит до следующей сборки. Поэтому у него два свойства,
 * которые нельзя оставлять на честном слове.
 *
 * ПЕРВОЕ — РАЗМЕР. Замер 23.09.2026 на собранном `public/sw.js`: записей
 * **379**, байт **2 675 178** (2,55 МБ). Это трафик, который приложение
 * скачивает при первом же заходе, и место, которое занимает на телефоне.
 * Потолок объявлен здесь числом — 5 МБ, — а не «примерно»: строка бюджета
 * растёт молча (одна тяжёлая картинка в `public/`, один новый шрифт), и
 * заметить это по коду нельзя.
 *
 * ВТОРОЕ — СОДЕРЖИМОЕ. В precache имеет право лежать РОВНО ДВА вида
 * записей: неизменяемая статика сборки (`/_next/static/…`, имя файла
 * содержит хеш) и общий каркас `/offline.html`. Ни одного адреса
 * СТРАНИЦЫ там быть не может, и особенно — личной или платной: запись
 * precache переживает и выход из аккаунта, и смену человека на
 * устройстве (кнопка выхода чистит `rf-pages-*`, а precache не трогает и
 * трогать не должна — там лежит код, общий для всех). Ровно этот класс
 * беды измерен в заходе 7.218 на другом кеше: `/ru/profile` лежал в кеше
 * документов на 167 965 байт вместе с адресом почты и отдавался
 * офлайн следующему человеку.
 *
 * ПЯТЬ ПРАВИЛ:
 *   1. сборка есть (`public/sw.js`) и манифест из неё читается — иначе
 *      ОТКАЗ, а не молчаливый пропуск;
 *   2. суммарный вес ≤ 5 МБ (5 242 880 байт);
 *   3. каждая запись — `/_next/static/…` или `/offline.html`;
 *   4. ни один адрес не похож на личный, платный или служебный
 *      (`profile`, `admin`, `pricing`, `checkout`, `/api/`);
 *   5. у каркаса ревизия — отпечаток СОДЕРЖИМОГО (16 шестнадцатеричных
 *      знаков, `next.config.ts`), а не строка, поднимаемая руками:
 *      забытая правка оставила бы у всех старый каркас без сети.
 *
 *   node scripts/check-precache-budget.mjs          # гейт
 *   node scripts/check-precache-budget.mjs --plant  # контроль
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const SW = "public/sw.js";
export const MAX_BYTES = 5 * 1024 * 1024;

/** Адреса, которых в precache быть не может ни при каком составе сборки. */
const FORBIDDEN = /(\/(es|ru)\/)|(\bprofile\b)|(\badmin\b)|(\bpricing\b)|(\bcheckout\b)|(^\/api\/)/;

/**
 * Манифест из СОБРАННОГО воркера. Читается разбором, а не импортом:
 * `sw.js` — минифицированный воркер, исполнять его здесь нечем.
 */
export function readManifest(code) {
  const start = code.indexOf("=[{'revision':");
  if (start === -1) return null;
  const end = code.indexOf("]??[]", start);
  if (end === -1) return null;
  const slice = code.slice(start, end + 1);
  const entries = [...slice.matchAll(/\{'revision':(null|'[^']*'),'url':'([^']*)'\}/g)].map((m) => ({
    revision: m[1] === "null" ? null : m[1].slice(1, -1),
    url: decodeURIComponent(m[2]),
  }));
  return entries.length > 0 ? entries : null;
}

/** Где лежит файл, на который ссылается запись манифеста. */
export function fileFor(url) {
  const path = url.split("?")[0];
  return path.startsWith("/_next/") ? `.next/${path.slice("/_next/".length)}` : `public${path}`;
}

export function violations(entries) {
  const bad = [];
  if (!entries) {
    bad.push(
      `${SW}: манифест precache не прочитан — либо сборки нет (нужен npm run build), либо форма манифеста изменилась. Молча пропускать этот сторож нельзя: он единственный, кто видит вес каркаса`,
    );
    return bad;
  }

  let bytes = 0;
  let unmeasured = 0;
  for (const entry of entries) {
    const file = fileFor(entry.url);
    if (existsSync(file)) bytes += statSync(file).size;
    else unmeasured += 1;

    if (!(entry.url.startsWith("/_next/static/") || entry.url === "/offline.html")) {
      bad.push(
        `${SW}: в precache запись «${entry.url}» — это не статика сборки и не каркас. Precache переживает выход из аккаунта и смену человека на устройстве`,
      );
    }
    // Правило адресов применяется к тому, что не является статикой
    // сборки. Имя ЧАНКА КОДА (`/_next/static/chunks/app/[lang]/admin/…`)
    // содержит слово `admin` и личным от этого не становится: это код,
    // который сервер отдаёт кому угодно и в котором нет ни одной строки
    // данных человека. Личное живёт в ОТВЕТАХ страниц и API, а им в
    // precache места нет вовсе — это правило выше.
    if (!entry.url.startsWith("/_next/static/") && FORBIDDEN.test(entry.url)) {
      bad.push(
        `${SW}: в precache личный, платный или служебный адрес «${entry.url}» — доступ одного человека показался бы другому из кеша, который не чистит даже выход`,
      );
    }
  }
  if (unmeasured > 0) {
    bad.push(`${SW}: ${unmeasured} записей манифеста не нашлось на диске — вес каркаса посчитан не весь, а значит не посчитан`);
  }
  if (bytes > MAX_BYTES) {
    bad.push(
      `${SW}: precache весит ${bytes} байт при потолке ${MAX_BYTES} — приложение качает это при первом же заходе и держит на телефоне`,
    );
  }

  const shell = entries.find((e) => e.url === "/offline.html");
  if (!shell) {
    bad.push(`${SW}: каркаса /offline.html в precache нет — без сети воркеру нечем ответить на навигацию вовсе`);
  } else if (!/^[0-9a-f]{16}$/.test(shell.revision ?? "")) {
    bad.push(
      `${SW}: у каркаса ревизия «${shell.revision}» — не отпечаток содержимого. Забытая правка строки оставила бы старый каркас у всех, кто уже открывал приложение`,
    );
  }
  return bad;
}

function read(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function measure(entries) {
  let bytes = 0;
  for (const entry of entries ?? []) {
    const file = fileFor(entry.url);
    if (existsSync(file)) bytes += statSync(file).size;
  }
  return bytes;
}

function plant() {
  const entries = readManifest(read(SW));
  const cases = [{ name: "отрицательный контроль: живая сборка сегодня чиста", ok: violations(entries).length === 0 }];
  const add = (name, mutated, expect) => {
    cases.push({ name, ok: violations(mutated).some((x) => x.includes(expect)) });
  };

  add("подсадка: манифеста нет вовсе (сборка не сделана)", null, "манифест precache не прочитан");
  add(
    "подсадка: в precache попала страница кабинета",
    [...(entries ?? []), { revision: "abc", url: "/ru/profile" }],
    "личный, платный или служебный адрес",
  );
  add(
    "подсадка: в precache попала страница цен",
    [...(entries ?? []), { revision: "abc", url: "/es/pricing" }],
    "личный, платный или служебный адрес",
  );
  add(
    "подсадка: в precache попал маршрут API",
    [...(entries ?? []), { revision: "abc", url: "/api/flashcards/summary" }],
    "это не статика сборки и не каркас",
  );
  add(
    "подсадка: каркас выпал из precache",
    (entries ?? []).filter((e) => e.url !== "/offline.html"),
    "каркаса /offline.html в precache нет",
  );
  add(
    "подсадка: ревизия каркаса снова строка «1», поднимаемая руками",
    (entries ?? []).map((e) => (e.url === "/offline.html" ? { ...e, revision: "1" } : e)),
    "не отпечаток содержимого",
  );
  // ПОДСАДКА БЮДЖЕТА — НАСТОЯЩИМИ БАЙТАМИ, А НЕ ВЫДУМАННЫМИ. Самый
  // тяжёлый файл манифеста повторяется столько раз, сколько нужно, чтобы
  // перешагнуть потолок: все записи существуют на диске, то есть сторож
  // считает те же байты, что и на живой сборке.
  const heaviest = (entries ?? [])
    .map((e) => ({ entry: e, size: existsSync(fileFor(e.url)) ? statSync(fileFor(e.url)).size : 0 }))
    .sort((a, b) => b.size - a.size)[0];
  const copies = heaviest && heaviest.size > 0 ? Math.ceil((MAX_BYTES - measure(entries)) / heaviest.size) + 1 : 0;
  add(
    `подсадка: бюджет превышен настоящими байтами (${copies} копий самого тяжёлого файла)`,
    [...(entries ?? []), ...Array.from({ length: copies }, () => heaviest.entry)],
    "при потолке",
  );

  for (const c of cases) {
    console.log(`  ${c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО"} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(
    ok
      ? `check:precache-budget --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль`
      : "check:precache-budget --plant — FAILED",
  );
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const entries = readManifest(read(SW));
  const bad = violations(entries);
  if (bad.length) {
    console.error(`check:precache-budget — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  const bytes = measure(entries);
  console.log(
    `check:precache-budget — записей ${entries.length}, байт ${bytes} (${(bytes / 1048576).toFixed(2)} МБ) при потолке ${MAX_BYTES} (${(MAX_BYTES / 1048576).toFixed(0)} МБ), личных и платных адресов 0`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
