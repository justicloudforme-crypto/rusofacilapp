// НАЖАТЬ «СЛУШАТЬ» НА ЖИВОМ САЙТЕ И УСЛЫШАТЬ ЗВУК — НЕДЕЛЬНЫЙ ОБХОД, ВТОРАЯ ПОЛОВИНА
// (заход 7.311, долг 124).
//
// ЗАЧЕМ. Первая половина обхода (`check-silent-listen.mjs --audio`, 7.293,
// долг 119) читает РАЗМЕТКУ рассказов `/es` и шлёт HEAD-запросы к звуковым
// файлам: «кнопка нарисована, файл на месте». Она не видит трёх вещей:
//   * уроков и медиа — их кнопки берут адрес звука уже ПОСЛЕ загрузки
//     страницы (`/api/lesson-audio`), в разметке адреса нет вовсе;
//   * `/ru` — обход идёт только по `/es` из карты сайта;
//   * того, что нажатие действительно ЗАПУСКАЕТ звук: файл может лежать
//     в хранилище, а кнопка — молчать (сломанный обработчик, не тот адрес
//     в клиентском коде, кодек, ответ не звуком).
// Долг 124 просил ровно это: перепись `check:listen-buttons` по базе
// запускал только человек. Здесь — без ключа базы и без входа: гостем, по
// выборке БЕСПЛАТНЫХ страниц, настоящим браузером.
//
// ПРАВИЛО ДЛЯ КАЖДОЙ СТРАНИЦЫ ВЫБОРКИ (все условия сразу):
//   1. страница отвечает 200;
//   2. видна хотя бы одна кнопка «слушать» — ярлык из словаря сайта
//      (`stories.playLabel` у рассказа, `lesson.slides.listenLabel` у урока,
//      медиа и алфавита), а не вписан сюда;
//   3. нажатие на первую видимую кнопку за 15 с запускает аудиоэлемент:
//      событие `playing`, `currentTime` ушло дальше 0,25 с, ошибки
//      элемента нет;
//   4. ответ на звуковой файл — 200/206 и `content-type: audio/*`.
// Разовый сбой (холодная функция, сеть) — не авария: страница повторяется
// один раз после паузы `--retry-delay-ms`, отказ — только на второй неудаче.
//
// ПЛАТНЫЙ ЗВУК НЕ ПРОВЕРЯЕТСЯ: решение владельца по долгу 121 — вариант (б),
// пароль тест-учётки в GitHub не кладём (`PROGRESS.md`, раздел 7). Поэтому
// в выборке только то, что звучит у гостя.
//
// ДЕНЬГИ. Звук лежит в Vercel Blob. Каждое нажатие тянет один клип (как у
// ученика), после подтверждения звук ставится на паузу и вкладка
// закрывается. Замер 7.311 (Mac, живой прод): 11 страниц за 29 с; ответы
// хранилища заявили ≈9,9 МБ (верхняя граница: у рассказа это длина всей
// начитки, браузер обрывает закачку после паузы) — в месяц < 45 МБ, цена
// трафика Blob — меньше цента. Между страницами пауза `--play-gap-ms`
// (2 с): плотная череда заходов включает защиту Vercel от ботов (замер
// 7.311 — после ≈60 страниц подряд с одного адреса ответ 403 «Vercel
// Security Checkpoint», `retry-after: 30`).
//
// ЗАЩИТА VERCEL. Если вместо страницы пришёл «Security Checkpoint», прогон
// красный (звук не проверен), но причина названа прямо: это не поломка
// звука, а защита Vercel, принявшая обход за бота.
//
// ДВУСТОРОННИЙ. `--plant` поднимает местный «сайт» и гоняет тот же прибор:
// исправная страница обязана дать зелёный; битый адрес звука (404), HTML
// вместо звука, пустой файл, страница 500, кнопки нет, кнопка молчит —
// красный. `--break-audio` гонит ЖИВОЙ обход, подменяя в браузере каждый
// ответ хранилища звука на 404 («битый адрес звука»), — обязан покраснеть.
//
//   node scripts/check-silent-listen.mjs --play --base=https://rusofacilapp.com
//   node scripts/check-silent-listen.mjs --play --plant
//   node scripts/check-silent-listen.mjs --play --base=https://rusofacilapp.com --break-audio
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

/** Бесплатные рассказы (у гостя полная начитка): «Репка» и «Снегурочка», A1. */
export const FREE_STORIES = [
  { id: "cmsxtq13w000cqwnc466c87es", title: "Репка" },
  { id: "cmsxtq2qp000kqwnc93cq9jvx", title: "Снегурочка" },
];

/**
 * Выборка бесплатных страниц: рассказы, уроки, медиа; `/es` и `/ru`.
 * `kind` выбирает ярлык кнопки из словаря.
 */
export function playTargets() {
  const out = [];
  for (const s of FREE_STORIES) {
    for (const lang of ["es", "ru"]) out.push({ name: `рассказ «${s.title}» /${lang}`, path: `/${lang}/stories/${s.id}`, lang, kind: "story" });
  }
  out.push({ name: "урок A1/1 /es", path: "/es/courses/a1/1", lang: "es", kind: "lesson" });
  out.push({ name: "урок A1/1 /ru", path: "/ru/courses/a1/1", lang: "ru", kind: "lesson" });
  out.push({ name: "урок A1/2 /ru", path: "/ru/courses/a1/2", lang: "ru", kind: "lesson" });
  out.push({ name: "урок A2/1 /es", path: "/es/courses/a2/1", lang: "es", kind: "lesson" });
  out.push({ name: "медиа «Катюша» /es", path: "/es/media/song-katyusha", lang: "es", kind: "lesson" });
  out.push({ name: "медиа «Катюша» /ru", path: "/ru/media/song-katyusha", lang: "ru", kind: "lesson" });
  out.push({ name: "алфавит /es", path: "/es/alfabeto-cirilico", lang: "es", kind: "lesson" });
  return out;
}

/** Ярлык кнопки — из словаря сайта; пустой ярлык = прибор ослеп, это отказ. */
export function listenLabel(lang, kind, root = process.cwd()) {
  const dict = JSON.parse(readFileSync(join(root, "src", "dictionaries", `${lang}.json`), "utf8"));
  const label = kind === "story" ? dict?.stories?.playLabel : dict?.lesson?.slides?.listenLabel;
  if (typeof label !== "string" || !label) throw new Error(`в ${lang}.json нет ярлыка кнопки для «${kind}» — прибор ослеп бы молча`);
  return label;
}

/** Хост звука на проде — тот же, что у первой половины обхода. */
const BLOB_HOST_RE = /^https?:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;

/** Подсматривает за аудиоэлементами страницы: вызовы play(), `playing`, ход времени, ошибки. */
function mediaSpy() {
  window.__rfPlay = [];
  const log = (e) => window.__rfPlay.push(e);
  const hook = (el) => {
    if (el.__rfHooked) return;
    el.__rfHooked = true;
    el.addEventListener("playing", () => log({ ev: "playing", src: el.currentSrc, t: el.currentTime }));
    el.addEventListener("timeupdate", () => log({ ev: "time", src: el.currentSrc, t: el.currentTime }));
    el.addEventListener("error", () => log({ ev: "error", src: el.currentSrc || el.src, code: el.error?.code ?? 0 }));
  };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    hook(this);
    log({ ev: "play()", src: this.currentSrc || this.src });
    const p = play.apply(this, args);
    if (p && typeof p.catch === "function") p.catch((err) => log({ ev: "reject", src: this.currentSrc || this.src, msg: String(err && err.name) }));
    return p;
  };
}

/** Приговор по журналу аудиоэлементов и ответам на звук. Пустой массив — страница звучит. */
export function judgePlay({ status, buttons, clicked, events, audioResponses, minSeconds = 0.25 }) {
  const why = [];
  if (status !== 200) why.push(`страница ответила ${status}`);
  if (status === 200 && buttons === 0) why.push("кнопки «слушать» на странице нет");
  if (buttons > 0 && !clicked) why.push("кнопку не удалось нажать");
  if (clicked) {
    const played = events.some((e) => e.ev === "play()");
    const errors = events.filter((e) => e.ev === "error" || e.ev === "reject");
    const maxT = Math.max(0, ...events.filter((e) => e.ev === "time" || e.ev === "playing").map((e) => e.t));
    const started = events.some((e) => e.ev === "playing") && maxT >= minSeconds;
    if (!played) why.push("нажатие не запустило ни одного аудиоэлемента");
    for (const e of errors) why.push(`ошибка звука (${e.ev}${e.code ? ` код ${e.code}` : ""}${e.msg ? ` ${e.msg}` : ""}) ${e.src || ""}`.trim());
    if (played && !started) why.push(`звук не пошёл: время ${maxT.toFixed(2)} с < ${minSeconds} с`);
    const bad = audioResponses.filter((r) => !(r.status === 200 || r.status === 206) || !/^audio\//i.test(r.type));
    for (const r of bad) why.push(`файл звука ответил ${r.status} ${r.type || "без типа"}: ${r.url}`);
    if (played && audioResponses.length === 0 && !started) why.push("ответа на файл звука не было");
  }
  return why;
}

async function probePage(browser, base, target, { breakAudio, audioHostRe, timeoutMs }) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 RFListenSweep",
  });
  try {
    const page = await ctx.newPage();
    await page.addInitScript(mediaSpy);
    if (breakAudio) await page.route((url) => audioHostRe.test(url.href), (route) => route.fulfill({ status: 404, contentType: "text/plain", body: "rf-break-audio" }));
    const audioResponses = [];
    let audioBytes = 0;
    page.on("response", async (r) => {
      const url = r.url();
      const type = r.headers()["content-type"] ?? "";
      const isAudioReq = r.request().resourceType() === "media" || audioHostRe.test(url) || /^audio\//i.test(type);
      if (!isAudioReq) return;
      audioResponses.push({ url: url.slice(0, 140), status: r.status(), type });
      audioBytes += Number(r.headers()["content-length"] ?? 0) || 0;
    });
    const res = await page.goto(base + target.path, { waitUntil: "load", timeout: timeoutMs });
    const status = res ? res.status() : 0;
    if (status === 403 && /Vercel Security Checkpoint/i.test(await page.title().catch(() => ""))) {
      return { why: ["страница ответила 403 «Vercel Security Checkpoint» — защита Vercel приняла обход за бота; звук НЕ проверен, это не поломка звука"], buttons: 0, maxT: 0, src: "", audioBytes: 0 };
    }
    // Кнопки рисует клиент после гидратации — даём странице ожить.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const button = page.locator(`button[aria-label="${target.label}"]:visible`);
    const buttons = status === 200 ? await button.count() : 0;
    let clicked = false;
    if (buttons > 0) {
      clicked = await button.first().click({ timeout: 10_000 }).then(() => true, () => false);
      if (clicked) {
        await page
          .waitForFunction((min) => (window.__rfPlay ?? []).some((e) => (e.ev === "time" || e.ev === "playing") && e.t >= min) || (window.__rfPlay ?? []).some((e) => e.ev === "error" || e.ev === "reject"), 0.25, { timeout: 15_000 })
          .catch(() => {});
      }
    }
    const events = await page.evaluate(() => window.__rfPlay ?? []).catch(() => []);
    // Звук подтверждён — ставим на паузу, чтобы не тянуть файл дальше (трафик Blob).
    await page.evaluate(() => document.querySelectorAll("audio,video").forEach((m) => m.pause())).catch(() => {});
    const why = judgePlay({ status, buttons, clicked, events, audioResponses });
    const maxT = Math.max(0, ...events.filter((e) => e.ev === "time" || e.ev === "playing").map((e) => e.t));
    const src = events.find((e) => e.ev === "play()")?.src ?? "";
    return { why, buttons, maxT, src, audioBytes };
  } catch (err) {
    return { why: [`прибор упал: ${String(err && err.message ? err.message : err).split("\n")[0]}`], buttons: 0, maxT: 0, src: "", audioBytes: 0 };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** Обход выборки. Возвращает число страниц с отказом после повтора. */
export async function runPlay({ base, targets = playTargets(), breakAudio = false, retryDelayMs = 30_000, gapMs = 0, audioHostRe = BLOB_HOST_RE, timeoutMs = 45_000, quiet = false } = {}) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ args: ["--autoplay-policy=user-gesture-required"] });
  const say = quiet ? () => {} : (s) => console.log(s);
  let failed = 0;
  let audioBytes = 0;
  const started = Date.now();
  try {
    for (const [i, t] of targets.entries()) {
      if (i > 0 && gapMs > 0) await new Promise((ok) => setTimeout(ok, gapMs));
      const target = { ...t, label: t.label ?? listenLabel(t.lang, t.kind) };
      let r = await probePage(browser, base, target, { breakAudio, audioHostRe, timeoutMs });
      let retried = false;
      if (r.why.length) {
        retried = true;
        say(`  … ${target.name}: ${r.why[0]} — повтор через ${Math.round(retryDelayMs / 1000)} с`);
        await new Promise((ok) => setTimeout(ok, retryDelayMs));
        r = await probePage(browser, base, target, { breakAudio, audioHostRe, timeoutMs });
      }
      audioBytes += r.audioBytes;
      if (r.why.length) {
        failed++;
        say(`  ✗ ${target.name} ${target.path}`);
        for (const w of r.why) say(`      ${w}`);
      } else {
        say(`  ✓ ${target.name}: кнопок ${r.buttons}, звук пошёл (${r.maxT.toFixed(2)} с)${retried ? ", со второй попытки" : ""} — ${r.src.split("/").slice(-2).join("/")}`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  say(`  страниц ${targets.length}, звучат ${targets.length - failed}, отказов ${failed}; ответы звука заявили ≈${(audioBytes / 1048576).toFixed(2)} МБ (верхняя граница); ${Math.round((Date.now() - started) / 1000)} с`);
  return failed;
}

/** Полторы секунды тишины, WAV 8 кГц моно — настоящий звук, который браузер проигрывает. */
function silentWav(seconds = 1.5, rate = 8000) {
  const samples = Math.round(seconds * rate);
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples * 2, 40);
  return buf;
}

/** Позитивный контроль: местный «сайт», исправная страница — зелёный, каждая поломка — красный. */
export async function runPlayPlant() {
  const LABEL = "Escuchar";
  const wav = silentWav();
  const page = (body) => `<!doctype html><html><body><h1>t</h1>${body}</body></html>`;
  const button = (src) => `<button aria-label="${LABEL}" onclick="new Audio('${src}').play()">🔊</button>`;
  const server = createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const html = (code, body) => { res.writeHead(code, { "content-type": "text/html" }); res.end(page(body)); };
    switch (u.pathname) {
      case "/ok": return html(200, button("/a.wav"));
      case "/blob-ok": return html(200, button(`http://${req.headers.host}/blob/a.wav`));
      case "/missing": return html(200, button("/nope.wav"));
      case "/html-audio": return html(200, button("/html.wav"));
      case "/empty-audio": return html(200, button("/empty.wav"));
      case "/no-button": return html(200, "<p>без кнопки</p>");
      case "/status-500": return html(500, button("/a.wav"));
      case "/dead-button": return html(200, `<button aria-label="${LABEL}">🔊</button>`);
      case "/a.wav":
      case "/blob/a.wav": res.writeHead(200, { "content-type": "audio/wav", "content-length": wav.length }); return res.end(wav);
      case "/html.wav": return html(200, "не звук");
      case "/empty.wav": res.writeHead(200, { "content-type": "audio/wav", "content-length": 0 }); return res.end();
      default: res.writeHead(404, { "content-type": "text/plain" }); return res.end("404");
    }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const T = (path) => [{ name: path, path, lang: "es", kind: "lesson", label: LABEL }];
  const cases = [
    { title: "ИСПРАВНАЯ страница, звук играет (отрицательный контроль)", path: "/ok", red: false },
    { title: "битый адрес звука (404)", path: "/missing", red: true },
    { title: "HTML вместо звука", path: "/html-audio", red: true },
    { title: "пустой файл звука", path: "/empty-audio", red: true },
    { title: "кнопки «слушать» нет", path: "/no-button", red: true },
    { title: "страница 500", path: "/status-500", red: true },
    { title: "кнопка есть, но молчит", path: "/dead-button", red: true },
    { title: "--break-audio: хранилище звука подменено на 404", path: "/blob-ok", red: true, breakAudio: true, audioHostRe: /\/blob\// },
    { title: "без --break-audio тот же адрес хранилища звучит (отрицательный контроль)", path: "/blob-ok", red: false, audioHostRe: /\/blob\// },
  ];
  let ok = 0;
  try {
    for (const c of cases) {
      const failed = await runPlay({ base, targets: T(c.path), retryDelayMs: 0, quiet: true, breakAudio: !!c.breakAudio, audioHostRe: c.audioHostRe, timeoutMs: 15_000 });
      const red = failed > 0;
      const good = red === c.red;
      if (good) ok++;
      console.log(`  ${good ? "✓" : "✗"} ${c.title}: ${red ? "красный" : "зелёный"} (ожидался ${c.red ? "красный" : "зелёный"})`);
    }
  } finally {
    server.close();
  }
  console.log(`  контролей ${cases.length}, сошлось ${ok} из ${cases.length}`);
  return ok === cases.length ? 0 : 1;
}
