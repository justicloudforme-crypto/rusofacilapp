/**
 * «Слово из партии своего банка переводится банком, а слово вне партии —
 * как раньше» — проверка ЖИВОГО сайта настоящим браузером, гостем
 * (долг 171, заход 7.312).
 *
 * ЧТО ДЕЛАЕТ. Открывает два бесплатных рассказа («Репка», «Снегурочка») на
 * `/es` и `/ru`, нажимает на слова первой партии, которые в них есть
 * (`src/lib/word-bank-batches/batch-01.json`), и требует от каждого:
 *   · в карточке — перевод партии знак в знак;
 *   · перевод пришёл из банка: либо предзагрузкой `/api/dictionary/bank`
 *     (запроса по тапу нет вовсе), либо ответом `/api/dictionary/translate`
 *     с `source: "lesson"`. Ответ `mymemory` — провал.
 * Плюс одно слово ВНЕ банка на странице (контроль «как раньше»): его
 * нажатие обязано уйти в `/api/dictionary/translate` и показать карточку.
 * Затем `--api=N` слов партии — прямым запросом к адресу перевода.
 *
 * Паузы между страницами и запросами — чтобы защита Vercel не приняла
 * проверку за бота (7.311: 403 на 30 минут после ≈60 страниц подряд).
 *
 *   node scripts/check-word-bank-live.mjs                 # https://rusofacilapp.com
 *   node scripts/check-word-bank-live.mjs --base=http://localhost:3000 --api=10
 *   node scripts/check-word-bank-live.mjs --batch=2     # слова партии 2 (7.314); --batch=all — все
 *   node scripts/check-word-bank-live.mjs --stories=<id>,<id>   # другие рассказы (у платных гостю
 *                                                               # виден начальный кусок текста)
 *
 * Контрольное слово «вне банка» выбирается вне ВСЕХ партий, какая бы ни
 * проверялась.
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ — прогон против прода ДО выката партии обязан быть
 * красным (слова ещё идут в MyMemory); так проверка и была принята (7.312).
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { watchPage, waitInteractive } from "./page-interactive.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = arg("base", "https://rusofacilapp.com").replace(/\/$/, "");
const API_WORDS = Number(arg("api", "10"));
const PAUSE_MS = Number(arg("pause", "6000"));
const BATCH = arg("batch", "1");
const BATCH_FILES = { 1: "batch-01.json", 2: "batch-02.json" };
const STORIES_ARG = arg("stories", "");

export const FREE_STORIES = [
  { id: "cmsxtq13w000cqwnc466c87es", title: "Репка" },
  { id: "cmsxtq2qp000kqwnc93cq9jvx", title: "Снегурочка" },
];

const LOADING = Object.fromEntries(
  ["es", "ru"].map((l) => [l, JSON.parse(readFileSync(`src/dictionaries/${l}.json`, "utf-8")).stories.translationLoading]),
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (w) => w.normalize("NFC").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Ключ → перевод партии `which` («1», «2», «all»). */
export function loadBatch(which = "1") {
  const numbers = which === "all" ? Object.keys(BATCH_FILES) : [which];
  const map = new Map();
  for (const n of numbers) {
    if (!BATCH_FILES[n]) throw new Error(`нет партии ${n}`);
    const batch = JSON.parse(readFileSync(`src/lib/word-bank-batches/${BATCH_FILES[n]}`, "utf-8"));
    for (const e of batch.entries) if (!map.has(e.word)) map.set(e.word, e.translation);
  }
  return map;
}

async function checkStory(browser, lang, story, batch, report, everyBatch = batch) {
  const context = await browser.newContext({
    // Ширина компьютера, а не телефона — намеренно: на телефонной ширине
    // Chromium прилипший плеер рассказа сам себя сжимает и разжимает,
    // страница подпрыгивает на ±4 px, и прокрутка закрывает карточку
    // (долг 427, замер 7.312). Эта проверка — про источник перевода.
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 RFWordBankLive",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const watch = watchPage(page);
  const prefetched = new Map(); // ключ → перевод из /api/dictionary/bank
  const tapAnswers = []; // ответы /api/dictionary/translate
  page.on("response", async (res) => {
    const url = new URL(res.url());
    if (url.pathname === "/api/dictionary/bank") {
      try {
        const body = await res.json();
        for (const [k, v] of Object.entries(body.translations ?? {})) prefetched.set(k, v);
      } catch {}
    } else if (url.pathname === "/api/dictionary/translate") {
      let body = null;
      try {
        body = await res.json();
      } catch {}
      tapAnswers.push({ word: norm(url.searchParams.get("word") ?? ""), status: res.status(), body });
    }
  });

  const where = `/${lang}/stories/${story.id} («${story.title}»)`;
  await page.goto(`${BASE}/${lang}/stories/${story.id}`, { waitUntil: "load", timeout: 45000 });
  const dead = await waitInteractive(page, 30000, watch);
  if (dead) {
    report.push({ ok: false, where, word: "—", why: dead.split("\n")[0] });
    await context.close();
    return;
  }
  // Предзагрузка видимого абзаца и делегированные обработчики тапа —
  // до тишины в сети (без этого первое нажатие только выделяет фразу).
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(1000);

  const words = await page.$$eval("button[data-word]", (els) => [...new Set(els.map((e) => e.getAttribute("data-word")))]);
  const inBatch = words.filter((w) => batch.has(norm(w)));
  const seen = new Set();
  const targets = [];
  for (const w of inBatch) if (!seen.has(norm(w))) (seen.add(norm(w)), targets.push({ word: w, kind: "batch" }));
  const control = words.find((w) => !everyBatch.has(norm(w)) && !prefetched.has(norm(w)) && norm(w).length > 4);
  if (control) targets.push({ word: control, kind: "control" });

  for (const t of targets) {
    const key = norm(t.word);
    const before = tapAnswers.length;
    const btn = page.locator(`button[data-word="${t.word}"]`).first();
    // Прокрутка закрывает открытую карточку, и событие прокрутки приходит
    // позже нажатия: сначала прокрутить к середине экрана и выждать.
    // Текст рассказа — своя прокручиваемая коробка с плавной прокруткой:
    // ждём, пока положение слова перестанет меняться.
    await btn.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    let lastTop = null;
    for (let i = 0; i < 20; i++) {
      await sleep(200);
      const top = await btn.evaluate((el) => Math.round(el.getBoundingClientRect().top));
      if (top === lastTop) break;
      lastTop = top;
    }
    await sleep(400);
    // Нажатие — click() самого элемента: Playwright перед своим кликом
    // докручивает страницу, а прокрутка закрывает только что открытую
    // карточку (замер 7.312: карточка открылась на 63 мс, закрылась на 90).
    await btn.evaluate((el) => el.click());
    const popover = page.getByTestId("translation-popover");
    await popover.waitFor({ timeout: 10000 });
    // Карточку читаем без ожиданий Playwright: если она закрылась сама
    // (прокрутка закрывает карточку), это провал с диагнозом, а не зависание.
    let text = "";
    for (let i = 0; i < 40; i++) {
      const got = await page.evaluate(
        () => document.querySelector('[data-testid="translation-popover"] p')?.textContent?.trim() ?? null,
      );
      if (got === null) {
        text = "(карточка закрылась)";
        break;
      }
      text = got;
      if (text && text !== LOADING[lang]) break;
      await sleep(250);
    }
    console.error(`  ${lang} «${story.title}» ${t.kind} «${t.word}» → «${text}»`);
    await sleep(700); // обработчик ответа сети разбирает тело асинхронно
    const asked = tapAnswers.slice(before).find((a) => a.word === key);
    let ok;
    let why;
    if (t.kind === "batch") {
      const expected = batch.get(key);
      // Контекст браузера новый на каждый рассказ — кеша вкладки нет, и
      // перевод без запроса по тапу может прийти только предзагрузкой.
      const via = asked ? `по тапу, source=${asked.body?.source ?? asked.status}` : prefetched.has(key) ? "предзагрузкой банка" : "без запроса и без предзагрузки";
      const fromBank = asked ? asked.body?.source === "lesson" : prefetched.get(key) === expected;
      ok = text === expected && fromBank;
      why = `карточка «${text}», партия «${expected}», ${via}`;
    } else {
      ok = Boolean(asked) && text.length > 0;
      why = asked
        ? `слово вне банка ушло в /api/dictionary/translate (source=${asked.body?.source ?? asked.status}), карточка «${text}»`
        : `запроса /api/dictionary/translate по тапу не было, карточка «${text}»`;
    }
    report.push({ ok, where, word: t.word, kind: t.kind, why });
    if ((await popover.count()) > 0) await page.getByTestId("translation-popover-close").click();
    await sleep(800);
  }
  await context.close();
}

async function checkApi(batch, report) {
  const words = [...batch.keys()].slice(0, API_WORDS);
  for (const w of words) {
    const res = await fetch(`${BASE}/api/dictionary/translate?word=${encodeURIComponent(w)}`, {
      headers: { "User-Agent": "RFWordBankLive" },
    });
    let body = null;
    try {
      body = await res.json();
    } catch {}
    const ok = res.status === 200 && body?.source === "lesson" && body?.translation === batch.get(w);
    report.push({ ok, where: "/api/dictionary/translate", word: w, kind: "api", why: `${res.status} source=${body?.source} «${body?.translation ?? ""}»` });
    await sleep(Math.min(PAUSE_MS, 3000));
  }
}

async function main() {
  const batch = loadBatch(BATCH);
  const everyBatch = loadBatch("all");
  console.error(`партия ${BATCH}: ${batch.size} слов; база ${BASE}`);
  const report = [];
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    for (const lang of ["es", "ru"]) {
      const stories = STORIES_ARG ? STORIES_ARG.split(",").map((id) => ({ id, title: id.slice(-6) })) : FREE_STORIES;
      for (const story of stories) {
        await checkStory(browser, lang, story, batch, report, everyBatch);
        await sleep(PAUSE_MS);
      }
    }
  } finally {
    await browser.close();
  }
  if (API_WORDS > 0) await checkApi(batch, report);

  for (const r of report) console.log(`${r.ok ? "ок " : "КРАСНОЕ"} [${r.kind ?? "-"}] ${r.where} «${r.word}»: ${r.why}`);
  const bad = report.filter((r) => !r.ok);
  const batchTaps = report.filter((r) => r.kind === "batch");
  console.log(`\nнажатий по словам партии: ${batchTaps.length}, контрольных: ${report.filter((r) => r.kind === "control").length}, запросов к адресу: ${report.filter((r) => r.kind === "api").length}; красных: ${bad.length}`);
  if (bad.length || batchTaps.length === 0) process.exit(1);
}

// Ничего при импорте — см. src/lib/entry-point.test.ts.
const isEntryPointHere =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPointHere) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
