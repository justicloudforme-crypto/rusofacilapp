// «Кнопка «слушать» есть, а записи для неё не отдано» — сторож долга 116.
//
// 09.09.2026, заход 7.161. Долг 114 (`docs/audio-voice-audit-2026-09-09.md`)
// прожил незамеченным ровно потому, что такого сторожа не было ни одного:
// страница рассказа рисовала непокупателю рабочую кнопку «Escuchar el
// texto», не отдав ему НИ ОДНОЙ настоящей записи, и кнопка уходила в
// аварийный `SpeechSynthesisUtterance` — системный голос ОС (на macOS/iOS
// это женская Milena, 219,2 Гц). Замер 7.160 сделан руками; здесь он
// превращён в правило.
//
// ПРАВИЛО (асимметричное, как у `check:mark-truth`):
//
//   если в разметке страницы отрисован орган управления «слушать»,
//   та же разметка ОБЯЗАНА нести настоящую запись.
//
//   Обратное правилом НЕ является: запись без кнопки — не нарушение
//   (так выглядит, например, страница без очереди предложений).
//
// Оба признака берутся из САМОЙ разметки, а не из пропсов, и ловушка 7.140
// обойдена по построению: в теле страницы атрибут написан обычными
// кавычками (`aria-label="…"`), а во flight-payload React — экранированными
// (`\"playLabel\":\"…\"`), поэтому словарный payload за кнопку не считается.
//
//   * кнопка       — `aria-label="<playLabel>"` / `"<pauseLabel>"`;
//   * запись       — элемент `<audio …>`, который `StoryText.tsx` рисует
//                    ровно при `hasRealAudio` (`:1130`), то есть только
//                    когда настоящие клипы или склейка реально отданы.
//
// Слепота сторожа — тоже отказ. Ярлык кнопки читается из словаря, а не
// вшит сюда (иначе правка текста молча ослепила бы правило), и прогон, в
// котором кнопка не найдена НИ НА ОДНОЙ странице, признаётся отказом, а не
// чистым результатом — как и прогон по пустому списку страниц.
//
// Поверхности: сегодня только рассказы. Другие поверхности со звуком
// (карточки, идиомы, уроки, глоссарий) — долг 117, отдельный заход.
//
//   node scripts/check-silent-listen.mjs                        # база http://localhost:3000
//   node scripts/check-silent-listen.mjs --base=https://rusofacilapp.com
//   node scripts/check-silent-listen.mjs --limit=25             # первые N страниц
//   node scripts/check-silent-listen.mjs --plant                # контроли, без сети
//   node scripts/check-silent-listen.mjs --base=https://rusofacilapp.com --audio --concurrency=2 --delay-ms=400 --agents=web,android-app,ios-app
//                                                               # обход по расписанию (долги 119, 121)
//
// ОБХОД ПО РАСПИСАНИЮ (7.293, долг 119). Раз в неделю workflow
// `listen-sweep.yml` гоняет этот обход по живому сайту. С `--audio` он
// вдобавок проверяет, что КАЖДЫЙ звуковой файл, на который ссылаются
// страницы рассказов, существует и отдаётся как звук, — НЕ СКАЧИВАЯ его:
// звук лежит в Vercel Blob, трафик платный. Запрос — HEAD (только
// заголовки: код 200, `content-type: audio/*`, длина ≥ 1000 байт); если
// хранилище HEAD не принимает (405/501) — GET первых двух байт
// (`Range: bytes=0-1`, ответ 206). Скорость ограничена (`--concurrency`,
// `--delay-ms`), разовый сбой сети/5xx повторяется один раз после паузы
// (`--retry-delay-ms`), отказ — только на второй неудаче. В конце
// печатается счёт: сколько запросов и сколько байт ушло на страницы и на
// звук — из него в отчёте захода считается цена в месяц.
//
// ТРИ АГЕНТА (7.296, долг 121). `--agents=web,android-app,ios-app` гоняет
// тот же обход трижды: браузером телефона, приложением Android (WebView
// с токеном `RFNativeShell/<версия>` и кукой оболочки) и приложением
// iPhone (WKWebView с тем же токеном). Страница рассказа ВЕТВИТСЯ по
// оболочке (`isNativeShellRequest` в `stories/[id]/page.tsx`: замок,
// кнопка покупки, нет подвала), поэтому обход одним браузером не видит
// путь, которым приходят ученики приложения. Версия в токене берётся из
// `capacitor.config.ts`, а не вписана сюда. Сторож не слеп и здесь: у
// каждого агента каждая страница обязана нести признак своего режима
// (`"nativeShell":true` у приложения, `false` у браузера) — иначе сайт
// молча отдал приложению браузерную страницу, и «0 нарушений» значил бы
// повторную проверку браузера. Звуковые файлы проверяются один раз —
// объединение ссылок всех агентов. По умолчанию (без `--agents`) — один
// агент `web`, как раньше.
//
// Контроль `--plant` — двусторонний и СКВОЗНОЙ: кроме разбора разметки
// он поднимает местный «сайт» (карта сайта, страницы рассказов, звуковые
// файлы) и гоняет по нему тот же обход: исправный сайт обязан дать
// зелёный, сайт с подменённым адресом звука (404), звуком, вместо которого
// отдаётся HTML, пустым файлом и страницей с ошибкой 500 — красный.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ARGS = process.argv.slice(2);
const PLANT = ARGS.includes("--plant");
// Побеждает ПОСЛЕДНИЙ флаг: `npm run check:silent-listen:prod -- --base=…`
// перекрывает адрес из package.json (так контроль workflow идёт на мёртвый адрес).
const argValue = (name) => ARGS.findLast((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const BASE = (argValue("base") ?? "http://localhost:3000").replace(/\/+$/, "");
const LIMIT = Number(argValue("limit") ?? 0) || 0;
const CONCURRENCY = Number(argValue("concurrency") ?? 8) || 8;
const DELAY_MS = Number(argValue("delay-ms") ?? 0) || 0;
const RETRY_DELAY_MS = Number(argValue("retry-delay-ms") ?? 30_000);
const AUDIO = ARGS.includes("--audio");
const AGENTS_ARG = argValue("agents") ?? "web";

/** Хост звука на проде — Vercel Blob. Ссылки на звук берутся только с него. */
export const BLOB_AUDIO_HOST = "[a-z0-9]+\\.public\\.blob\\.vercel-storage\\.com";

/** Чем обход представляется серверу (написание не брендовое — см. `prod-smoke.mjs`). */
const SWEEP_USER_AGENT = "RFListenSweep";

/** Версия оболочки — из `capacitor.config.ts` (та же, что уходит в токен приложения). */
export function shellVersion(root = process.cwd()) {
  const text = readFileSync(join(root, "capacitor.config.ts"), "utf8");
  const m = /const NATIVE_SHELL_VERSION = (\d+);/.exec(text);
  if (!m) throw new Error("в capacitor.config.ts не найдено NATIVE_SHELL_VERSION — агенты приложения ослепли бы молча");
  return Number(m[1]);
}

/**
 * Агенты обхода (7.296, долг 121). Строки User-Agent — настоящие формы
 * браузера телефона, Android WebView (`; wv`, `Version/4.0`) и iPhone
 * WKWebView (без `Safari/`), к ним дописан токен обхода; у приложения —
 * ещё токен оболочки и её куки, ровно как шлёт оболочка
 * (`appendUserAgent` в `capacitor.config.ts`).
 */
export function sweepAgents(names, version = shellVersion()) {
  const shell = `RFNativeShell/${version}`;
  const appCookie = `rf_native_shell=1; rf_shell_version=${version}`;
  const all = {
    web: {
      name: "web",
      title: "браузер телефона",
      app: false,
      headers: { "user-agent": `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 ${SWEEP_USER_AGENT}` },
    },
    "android-app": {
      name: "android-app",
      title: "приложение Android (WebView)",
      app: true,
      headers: {
        "user-agent": `Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 ${SWEEP_USER_AGENT} ${shell}`,
        cookie: appCookie,
      },
    },
    "ios-app": {
      name: "ios-app",
      title: "приложение iPhone (WKWebView)",
      app: true,
      headers: {
        "user-agent": `Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ${SWEEP_USER_AGENT} ${shell}`,
        cookie: appCookie,
      },
    },
  };
  const list = names.split(",").map((n) => n.trim()).filter(Boolean);
  const unknown = list.filter((n) => !all[n]);
  if (unknown.length || list.length === 0) throw new Error(`--agents: неизвестные агенты «${unknown.join(",")}» (есть: ${Object.keys(all).join(", ")})`);
  return list.map((n) => all[n]);
}

/** Режим, в котором сервер отрисовал страницу: признак из payload страницы рассказа. */
export function renderedMode(html) {
  const app = /nativeShell\\?":true/.test(html);
  const web = /nativeShell\\?":false/.test(html);
  if (app && !web) return "app";
  if (web && !app) return "web";
  return app && web ? "both" : "none";
}

/** Меньше этого — не звук, а пустышка (настоящий клип банка ≥ 5 КБ). */
const MIN_AUDIO_BYTES = 1000;

/** Локаль замера. Ярлыки берутся из её словаря. */
const LANG = ARGS.find((a) => a.startsWith("--lang="))?.slice(7) ?? "es";

function dictLabels(lang) {
  const path = join(process.cwd(), "src", "dictionaries", `${lang}.json`);
  const dict = JSON.parse(readFileSync(path, "utf8"));
  const play = dict?.stories?.playLabel;
  const pause = dict?.stories?.pauseLabel;
  if (typeof play !== "string" || typeof pause !== "string" || !play || !pause) {
    throw new Error(`в ${lang}.json не найдены stories.playLabel / stories.pauseLabel — сторож ослеп бы молча`);
  }
  return { play, pause };
}

/** Кнопка «слушать» в ТЕЛЕ страницы (не в payload — см. шапку). */
export function hasListenButton(html, labels) {
  return html.includes(`aria-label="${labels.play}"`) || html.includes(`aria-label="${labels.pause}"`);
}

/** Настоящая запись отдана: `StoryText` рисует `<audio>` только при `hasRealAudio`. */
export function hasRealRecording(html) {
  return /<audio[\s>]/.test(html);
}

/** Числа рядом с приговором, чтобы отказ читался, а не угадывался. */
export function inspect(html, labels) {
  const button = hasListenButton(html, labels);
  const audio = hasRealRecording(html);
  const blobLinks = (html.match(/public\.blob\.vercel-storage\.com/g) ?? []).length;
  const emptySegments = /audioSegments\\?":\s*\[\]/.test(html);
  const nullFullAudio = /fullAudioUrl\\?":\s*null/.test(html);
  return { button, audio, blobLinks, emptySegments, nullFullAudio, silent: button && !audio };
}

/** Все ссылки на звуковые файлы в разметке страницы (тело и payload React). */
export function audioUrls(html, hostPattern = BLOB_AUDIO_HOST) {
  const re = new RegExp(`https?://${hostPattern}/[^"'\\\\\\s<>)]+?\\.(?:mp3|m4a|ogg|wav|webm)`, "gi");
  return [...new Set(html.match(re) ?? [])];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Счёт трафика обхода — из него считается цена в месяц. */
function newMeter() {
  return { pageRequests: 0, pageBytes: 0, audioRequests: 0, audioBytes: 0, audioRangeRequests: 0 };
}

/** Сколько байт ушло на ответ, когда тело не читается: заголовки + объявленная длина тела. */
function headerBytes(res) {
  let n = 0;
  for (const [k, v] of res.headers) n += k.length + v.length + 4;
  return n + 20;
}

/** Один звуковой файл: существует и отдаётся как звук. Тело НЕ качается. */
export async function probeAudio(url, meter) {
  let res;
  try {
    res = await fetch(url, { method: "HEAD", headers: { "user-agent": SWEEP_USER_AGENT } });
  } catch (err) {
    return { url, ok: false, transient: true, why: `не ответил: ${String(err.cause?.code ?? err).slice(0, 80)}` };
  }
  meter.audioRequests += 1;
  meter.audioBytes += headerBytes(res);
  let length = Number(res.headers.get("content-length") ?? "");
  if (res.status === 405 || res.status === 501) {
    // Хранилище не принимает HEAD — первые два байта, не больше.
    try {
      res = await fetch(url, { headers: { "user-agent": SWEEP_USER_AGENT, range: "bytes=0-1" } });
    } catch (err) {
      return { url, ok: false, transient: true, why: `не ответил: ${String(err.cause?.code ?? err).slice(0, 80)}` };
    }
    const body = new Uint8Array(await res.arrayBuffer());
    meter.audioRequests += 1;
    meter.audioRangeRequests += 1;
    meter.audioBytes += headerBytes(res) + body.length;
    const total = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "")?.[1];
    length = Number(total ?? res.headers.get("content-length") ?? "");
    if (res.status !== 206 && res.status !== 200) {
      return { url, ok: false, transient: res.status >= 500, why: `ответ ${res.status} на запрос первых байт` };
    }
  } else if (res.status !== 200) {
    return { url, ok: false, transient: res.status >= 500 || res.status === 429, why: `ответ ${res.status}` };
  }
  const type = res.headers.get("content-type") ?? "";
  if (!/^audio\//i.test(type)) return { url, ok: false, transient: false, why: `не звук: content-type «${type || "нет"}»` };
  if (!(length >= MIN_AUDIO_BYTES)) return { url, ok: false, transient: false, why: `длина ${Number.isFinite(length) ? length : "неизвестна"} байт — пустышка` };
  return { url, ok: true, bytes: length };
}

/** Все звуки — с ограничением скорости и одним повтором разового сбоя. */
async function sweepAudio(urls, meter, { concurrency, delayMs, retryDelayMs }) {
  const rows = [];
  let cursor = 0;
  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= urls.length) return;
      if (delayMs) await sleep(delayMs);
      rows.push(await probeAudio(urls[index], meter));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  const transient = rows.filter((r) => !r.ok && r.transient);
  if (transient.length) {
    console.log(`  звук: разовый сбой у ${transient.length}, повтор через ${retryDelayMs} мс`);
    await sleep(retryDelayMs);
    for (const r of transient) {
      if (delayMs) await sleep(delayMs);
      Object.assign(r, await probeAudio(r.url, meter));
    }
  }
  return rows;
}

async function storyUrls(base, meter) {
  const res = await fetch(`${base}/sitemap.xml`, { headers: { "user-agent": SWEEP_USER_AGENT } });
  if (!res.ok) throw new Error(`sitemap ${base}/sitemap.xml отдал ${res.status}`);
  const xml = await res.text();
  meter.pageRequests += 1;
  meter.pageBytes += Buffer.byteLength(xml) + headerBytes(res);
  // Ловушка замера: sitemap ВСЕГДА печатает боевой хост, даже когда его
  // отдал сервер на localhost (`SITE_URL` — константа сборки). Первый
  // прогон этого сторожа по локальной базе из-за этого честно ходил на
  // прод и печатал «323» вместо локального числа. Берём путь, хост —
  // только тот, что назван в --base.
  const all = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = all
    .map((u) => {
      try {
        return `${base}${new URL(u).pathname}`;
      } catch {
        return null;
      }
    })
    .filter((u) => u !== null)
    .filter((u) => u.includes(`/${LANG}/stories/`));
  return LIMIT ? urls.slice(0, LIMIT) : urls;
}

async function fetchPage(url, labels, meter, audioHost, agent) {
  let html = "";
  let status = 0;
  try {
    const res = await fetch(url, { redirect: "follow", headers: agent?.headers ?? { "user-agent": SWEEP_USER_AGENT } });
    status = res.status;
    html = await res.text();
    meter.pageRequests += 1;
    meter.pageBytes += Buffer.byteLength(html) + headerBytes(res);
  } catch (err) {
    return { url, status: 0, error: String(err), silent: false, unreachable: true, audio: [] };
  }
  return { url, status, ...inspect(html, labels), mode: renderedMode(html), unreachable: status !== 200, audioLinks: audioUrls(html, audioHost) };
}

async function sweep(urls, labels, meter, { concurrency = CONCURRENCY, delayMs = DELAY_MS, retryDelayMs = RETRY_DELAY_MS, audioHost = BLOB_AUDIO_HOST, agent } = {}) {
  const rows = [];
  let cursor = 0;
  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= urls.length) return;
      if (delayMs) await sleep(delayMs);
      rows.push(await fetchPage(urls[index], labels, meter, audioHost, agent));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  // Разовый сбой (нет ответа, 5xx, 429) — один повтор после паузы, как у
  // `prod-smoke`: холодная функция — не авария.
  const again = rows.filter((r) => r.unreachable && (r.status === 0 || r.status >= 500 || r.status === 429));
  if (again.length) {
    console.log(`  страницы: разовый сбой у ${again.length}, повтор через ${retryDelayMs} мс`);
    await sleep(retryDelayMs);
    for (const r of again) {
      if (delayMs) await sleep(delayMs);
      Object.assign(r, await fetchPage(r.url, labels, meter, audioHost, agent));
    }
  }
  rows.sort((a, b) => a.url.localeCompare(b.url));
  return rows;
}

/**
 * Контроли без сети. Формы взяты с живого прода 09.09.2026: закрытый
 * рассказ `cmsxtr64d0086qwnc6bbqn8us` (кнопка есть, `<audio>` нет, ссылок
 * на blob 0) и бесплатный `cmsxtq13w000cqwnc466c87es` (есть всё).
 */
function fixtures(labels) {
  const button = `<div class="flex items-center gap-3 sm:contents"><button type="button" aria-label="${labels.play}" title="${labels.play}" class="..."><span aria-hidden="true">▶</span></button></div>`;
  const audio = `<audio preload="metadata" class="hidden"></audio>`;
  const payload = `<script>self.__next_f.push([1,"{\\"closeLabel\\":\\"Cerrar\\",\\"playLabel\\":\\"${labels.play}\\",\\"pauseLabel\\":\\"${labels.pause}\\"}"])</script>`;
  return [
    {
      name: "подсадка: кнопка есть, записи не отдано (форма долга 114)",
      html: `<main>${button}<p>Первый абзац.</p>${payload}</main>`,
      mustCatch: true,
    },
    {
      name: "контроль: кнопка и запись вместе (бесплатный рассказ)",
      html: `<main>${audio}${button}<p>Первый абзац.</p>${payload}</main>`,
      mustCatch: false,
    },
    {
      name: "контроль: ни кнопки, ни записи (превью без клипов после правки)",
      html: `<main><p>Первый абзац.</p>${payload}</main>`,
      mustCatch: false,
    },
    {
      name: "контроль: запись без кнопки — правило асимметрично",
      html: `<main>${audio}<p>Первый абзац.</p>${payload}</main>`,
      mustCatch: false,
    },
    {
      name: "контроль: только словарный payload — за кнопку не считается (ловушка 7.140)",
      html: `<main><p>Первый абзац.</p>${payload}</main>`,
      mustCatch: false,
    },
  ];
}

function runPlant() {
  const labels = dictLabels(LANG);
  const cases = fixtures(labels);
  let caught = 0;
  let planted = 0;
  let cleanControls = 0;
  let controls = 0;
  console.log(`check:silent-listen --plant  (ярлык кнопки: «${labels.play}»)`);
  for (const c of cases) {
    const verdict = inspect(c.html, labels);
    if (c.mustCatch) {
      planted += 1;
      if (verdict.silent) caught += 1;
      console.log(`  ${verdict.silent ? "поймано" : "ПРОПУЩЕНО"} — ${c.name}`);
    } else {
      controls += 1;
      if (!verdict.silent) cleanControls += 1;
      console.log(`  ${verdict.silent ? "ЛОЖНОЕ СРАБАТЫВАНИЕ" : "чисто"} — ${c.name}`);
    }
  }
  console.log(`  подсажено ${planted}, поймано ${caught} из ${planted}`);
  console.log(`  отрицательных контролей ${cleanControls} из ${controls} чисты`);
  return caught === planted && cleanControls === controls ? 0 : 1;
}

export async function runSweep({ base = BASE, limit = LIMIT, audio = AUDIO, concurrency = CONCURRENCY, delayMs = DELAY_MS, retryDelayMs = RETRY_DELAY_MS, audioHost = BLOB_AUDIO_HOST, agents = AGENTS_ARG } = {}) {
  const labels = dictLabels(LANG);
  const meter = newMeter();
  const startedAt = Date.now();
  const agentList = sweepAgents(agents);
  const allUrls = await storyUrls(base, meter);
  const urls = limit ? allUrls.slice(0, limit) : allUrls;
  if (urls.length === 0) {
    console.error(`[check:silent-listen] в sitemap ${base} нет ни одной страницы рассказа — мерить нечего, это отказ, а не чистый прогон`);
    return 1;
  }
  let verdict = 0;
  const allRows = [];
  const summary = [];
  for (const agent of agentList) {
    console.log(`  ── агент: ${agent.title} (${agent.name})`);
    const rows = await sweep(urls, labels, meter, { concurrency, delayMs, retryDelayMs, audioHost, agent });
    const pages = judgePages(rows, labels, base, agent);
    const mode = agentList.length > 1 || agent.name !== "web" ? judgeMode(rows, agent) : 0;
    verdict ||= pages || mode;
    allRows.push(...rows);
    const ok = rows.filter((r) => !r.unreachable);
    summary.push(`${agent.name}: страниц ${rows.length}, кнопка ${ok.filter((r) => r.button).length}, <audio> ${ok.filter((r) => r.audio).length}, кнопка без записи ${ok.filter((r) => r.silent).length}, режим ${agent.app ? "app" : "web"} ${ok.filter((r) => r.mode === (agent.app ? "app" : "web")).length}/${ok.length}${pages || mode ? " — ОТКАЗ" : ""}`);
  }
  if (agentList.length > 1) {
    console.log("  итог по агентам:");
    for (const line of summary) console.log(`    ${line}`);
  }
  let audioBad = 0;
  if (audio) audioBad = await judgeAudio(allRows, meter, { concurrency, delayMs, retryDelayMs });
  printMeter(meter, Date.now() - startedAt);
  return verdict || audioBad ? 1 : 0;
}

/**
 * Сервер обязан был отрисовать страницу в режиме агента. Страница без
 * признака режима или с чужим — отказ: иначе проверка приложения молча
 * повторяет проверку браузера (сайт перестал узнавать оболочку) или
 * наоборот.
 */
function judgeMode(rows, agent) {
  const want = agent.app ? "app" : "web";
  const reachable = rows.filter((r) => !r.unreachable);
  const wrong = reachable.filter((r) => r.mode !== want);
  if (!wrong.length) return 0;
  console.error(`  режим отрисовки: у ${wrong.length} из ${reachable.length} страниц не «${want}» — сайт не узнал агента «${agent.name}» (проверка этого агента слепа), это отказ`);
  for (const r of wrong.slice(0, 10)) console.error(`    ${r.url} — режим «${r.mode}»`);
  return 1;
}

function printMeter(meter, ms) {
  const mb = (n) => (n / 1_000_000).toFixed(2);
  console.log(
    `  счёт трафика: страницы — ${meter.pageRequests} запросов, ${mb(meter.pageBytes)} МБ; ` +
      `звук — ${meter.audioRequests} запросов (из них первых байт: ${meter.audioRangeRequests}), ${mb(meter.audioBytes)} МБ; время ${(ms / 1000).toFixed(0)} с`,
  );
}

async function judgeAudio(rows, meter, opts) {
  const links = [...new Set(rows.flatMap((r) => r.audioLinks ?? []))];
  const withRecording = rows.filter((r) => r.audio && !r.unreachable);
  const blind = withRecording.filter((r) => !(r.audioLinks ?? []).length);
  console.log(`  звук: уникальных файлов в разметке ${links.length}; страниц с записью ${withRecording.length}, из них без единой ссылки на файл ${blind.length}`);
  if (links.length === 0) {
    console.error("  ссылок на звук не найдено НИ НА ОДНОЙ странице — проверка звука слепа (сменился хост хранилища?), это отказ");
    return 1;
  }
  const checked = await sweepAudio(links, meter, opts);
  const bad = checked.filter((r) => !r.ok);
  console.log(`  звук: проверено ${checked.length}, отдаются как звук ${checked.length - bad.length}, отказ ${bad.length}`);
  for (const r of bad.slice(0, 20)) console.error(`    ${r.url} — ${r.why}`);
  if (bad.length > 20) console.error(`    …и ещё ${bad.length - 20}`);
  return bad.length ? 1 : 0;
}

function judgePages(rows, labels, base, agent) {
  const reachable = rows.filter((r) => !r.unreachable);
  const withButton = reachable.filter((r) => r.button);
  const silent = reachable.filter((r) => r.silent);

  console.log(`[check:silent-listen] база ${base}, локаль ${LANG}${agent ? `, агент ${agent.name}` : ""}, страниц ${rows.length}, отвечают 200: ${reachable.length}`);
  console.log(`  с кнопкой «слушать»: ${withButton.length}`);
  console.log(`  из них без единой настоящей записи: ${silent.length}`);

  if (withButton.length === 0) {
    console.error(`  кнопка не найдена НИ НА ОДНОЙ странице — сторож слеп (ярлык «${labels.play}» разошёлся с разметкой), это отказ`);
    return 1;
  }
  const unreachable = rows.filter((r) => r.unreachable);
  if (unreachable.length) {
    console.error(`  не прочитано страниц: ${unreachable.length}`);
    for (const r of unreachable.slice(0, 10)) console.error(`    ${r.url} — ${r.status || r.error}`);
    return 1;
  }
  for (const r of silent.slice(0, 20)) {
    console.error(`    ${r.url}  blob:${r.blobLinks}  audioSegments пуст:${r.emptySegments}  fullAudioUrl null:${r.nullFullAudio}`);
  }
  if (silent.length > 20) console.error(`    …и ещё ${silent.length - 20}`);
  return silent.length ? 1 : 0;
}

/**
 * СКВОЗНОЙ КОНТРОЛЬ (7.293, долг 119). Местный «сайт» — карта сайта, две
 * страницы рассказов и звуковые файлы — и тот же обход, что ходит по проду.
 * Поломка задаётся одной правкой исправного сайта; исправный обязан дать 0,
 * каждый сломанный — 1. Наружу ни одного запроса.
 */
async function runSweepPlant() {
  const labels = dictLabels(LANG);
  const button = `<button type="button" aria-label="${labels.play}">▶</button>`;
  const fakeMp3 = Buffer.alloc(4096, 0xff);
  let server;
  let site;
  server = createServer((req, res) => {
    const path = req.url.split("?")[0];
    const host = `http://${req.headers.host}`;
    if (path === "/sitemap.xml") {
      res.writeHead(200, { "content-type": "application/xml" });
      res.end(`<urlset><url><loc>https://rusofacilapp.com/${LANG}/stories/a</loc></url><url><loc>https://rusofacilapp.com/${LANG}/stories/b</loc></url></urlset>`);
      return;
    }
    // Как настоящий сайт: оболочку узнаёт по токену в User-Agent или по куке.
    const isApp = (site.recognizes ?? ["RFNativeShell"]).some((token) => (req.headers["user-agent"] ?? "").includes(token));
    const entry = site.pages[path];
    const page = typeof entry === "function" ? entry(isApp) : entry;
    if (page) {
      res.writeHead(page.status ?? 200, { "content-type": "text/html; charset=utf-8" });
      res.end(page.html.replaceAll("HOST", host));
      return;
    }
    const file = site.files[path];
    if (file) {
      const body = file.body ?? fakeMp3;
      res.writeHead(200, { "content-type": file.type ?? "audio/mpeg", "content-length": String(body.length) });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }
    res.writeHead(404, { "content-type": "text/html" });
    res.end("<h1>404</h1>");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const audioHost = `127\\.0\\.0\\.1:${server.address().port}`;

  // Страница рассказа ветвится по оболочке, как `stories/[id]/page.tsx`:
  // признак режима в payload (`"nativeShell":true|false`).
  const storyPage = (clips, { silentInApp = false } = {}) => (isApp) => {
    const audioEl = isApp && silentInApp ? "" : `<audio preload="metadata"></audio>`;
    const segs = isApp && silentInApp ? [] : clips;
    return { html: `<main>${audioEl}${button}<script>self.__next_f.push([1,"{\\"nativeShell\\":${isApp},\\"audioSegments\\":[${segs.map((c) => `{\\"url\\":\\"HOST${c}\\"}`).join(",")}]}"])</script></main>` };
  };
  const healthy = () => ({
    pages: { [`/${LANG}/stories/a`]: storyPage(["/audio/a/0-0.mp3", "/audio/a/0-1.mp3"]), [`/${LANG}/stories/b`]: storyPage(["/audio/b/0-0.mp3"]) },
    files: { "/audio/a/0-0.mp3": {}, "/audio/a/0-1.mp3": {}, "/audio/b/0-0.mp3": {} },
  });
  const ALL = "web,android-app,ios-app";
  const cases = [
    { name: "исправный сайт (отрицательный контроль)", expect: 0, edit: () => {} },
    { name: "подменённый адрес звука — файла нет (404)", expect: 1, edit: (s) => { s.pages[`/${LANG}/stories/b`] = storyPage(["/audio/b/NO-SUCH.mp3"]); } },
    { name: "вместо звука отдаётся HTML", expect: 1, edit: (s) => { s.files["/audio/a/0-1.mp3"] = { type: "text/html; charset=utf-8", body: Buffer.from("<h1>error</h1>".repeat(100)) }; } },
    { name: "звуковой файл пустой", expect: 1, edit: (s) => { s.files["/audio/a/0-0.mp3"] = { body: Buffer.alloc(0) }; } },
    { name: "страница рассказа отвечает 500 (и на повторе)", expect: 1, edit: (s) => { s.pages[`/${LANG}/stories/a`] = { status: 500, html: "<h1>Algo salió mal</h1>" }; } },
    { name: "кнопка «слушать» без записи", expect: 1, edit: (s) => { s.pages[`/${LANG}/stories/b`] = { html: `<main>${button}</main>` }; } },
    // Долг 121 (7.296): поломки, видные только агентам приложения.
    { name: "три агента: исправный сайт (отрицательный контроль)", agents: ALL, expect: 0, edit: () => {} },
    { name: "ДО 7.296 (один браузер): кнопка без записи только в приложении — обход её не видит", agents: "web", expect: 0, edit: (s) => { s.pages[`/${LANG}/stories/b`] = storyPage(["/audio/b/0-0.mp3"], { silentInApp: true }); } },
    { name: "три агента: кнопка без записи только в приложении", agents: ALL, expect: 1, edit: (s) => { s.pages[`/${LANG}/stories/b`] = storyPage(["/audio/b/0-0.mp3"], { silentInApp: true }); } },
    { name: "три агента: сайт перестал узнавать оболочку (приложению — браузерная страница)", agents: ALL, expect: 1, edit: (s) => { s.recognizes = ["NO-SUCH-TOKEN"]; } },
    { name: "агент iPhone: сайт узнаёт только Android (`; wv`)", agents: ALL, expect: 1, edit: (s) => { s.recognizes = ["; wv)"]; } },
  ];
  let ok = 0;
  try {
    for (const c of cases) {
      site = healthy();
      c.edit(site);
      console.log(`  ── сквозной: ${c.name}`);
      const code = await runSweep({ base, limit: 0, audio: true, concurrency: 2, delayMs: 0, retryDelayMs: 50, audioHost, agents: c.agents ?? "web" });
      const good = code === c.expect;
      if (good) ok += 1;
      console.log(`  ${good ? (c.expect ? "поймано" : "чисто") : c.expect ? "ПРОПУЩЕНО" : "ЛОЖНОЕ СРАБАТЫВАНИЕ"} — ${c.name} (код ${code})`);
    }
  } finally {
    server.close();
  }
  console.log(`  сквозных случаев ${cases.length}, сошлось ${ok} из ${cases.length}`);
  return ok === cases.length ? 0 : 1;
}

async function main() {
  if (PLANT) {
    const markup = runPlant();
    const endToEnd = await runSweepPlant();
    return markup || endToEnd ? 1 : 0;
  }
  return await runSweep();
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exit(await main());
