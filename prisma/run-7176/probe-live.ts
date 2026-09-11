/**
 * Заход 7.176: живая проба на БОЕВОМ сайте — анонимом, без входа.
 *
 * Доказывается три вещи:
 *   1. каждое из семи записанных мест отдаёт по адресу `/api/word-audio`
 *      СВОЙ клип, а не клип словоформы и не чужое место;
 *   2. настоящий тап по слову играет ровно его — там, где место вообще
 *      отдано анониму: все семь рассказов платные, и анониму показан
 *      отрывок, поэтому «место не отдано» и «клипа нет» тут разные вещи
 *      и не смешиваются;
 *   3. у места с клипом строки варианта В («ударение зависит от смысла»)
 *      в окошке НЕТ — то есть подпись ушла сама, кода не трогали.
 *
 * Контроль слепоты: три слова `song-katyusha`, отложенные заморозкой до
 * 26.09, обязаны отвечать `audioUrl: null`. Без него «7 из 7» доказывало
 * бы только то, что проба умеет ходить по адресу.
 *
 * Ловушки, все из PROGRESS.md 7.170: `new Audio(url)` в разметке не
 * виден (конструктор оборачивается ДО загрузки страницы); у приглушённой
 * кнопки `click()` Playwright не срабатывает (нажимаем `el.click()` из
 * страницы); кнопка в поповере появляется РАНЬШЕ адреса клипа.
 *
 *   npx tsx prisma/run-7176/probe-live.ts --journal=… [--plant]
 */
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { resolve } from "node:path";
import { splitStoryParagraphs, buildStoryQueue } from "@/lib/stories";
import { isEntryPoint } from "@/lib/entry-point";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const JOURNAL = arg("journal")!;
const BASE = arg("base") ?? "https://rusofacilapp.com";
const PLANT = process.argv.includes("--plant");
/** Вход боевым тестовым аккаунтом уровня `standard`: все семь рассказов
 *  платные, и анониму место за отрывком не отдаётся вовсе. Пароль лежит
 *  вне репозитория (`~/.config/rusofacilapp/test-account.env`, 600) и в
 *  вывод не попадает. */
const LOGIN = process.argv.includes("--login");

/** Слова без клипа: отложены заморозкой до 26.09 (паспорт озвучки, раздел 8). */
const BLIND = ["груша", "расцветать", "яблоня"];
const SNAPSHOT = arg("snapshot") ?? "prisma/snapshots/prod-latest.db";
const WORD_SPLIT = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;

interface J { op: string; n: number; file: string; storyId: string; itemKey: string; text: string; url: string }

async function main(): Promise<number> {
  const journal = readFileSync(JOURNAL, "utf-8").trim().split("\n").map((l) => JSON.parse(l) as J)
    .filter((j) => j.op === "insert");

  // --- слой 1: тот же запрос, который делает тап, но без страницы -----
  let api = 0;
  for (const j of journal) {
    const q = `${BASE}/api/word-audio?word=${encodeURIComponent(j.text)}&story=${encodeURIComponent(j.storyId)}&at=${j.itemKey}`;
    const body = (await (await fetch(q)).json()) as { audioUrl?: string | null };
    const ok = body.audioUrl === j.url;
    if (ok) api++;
    console.log(`  [слой 1] №${j.n} ${j.storyId} ${j.itemKey} «${j.text}»: ${ok ? "свой адрес" : `ЧУЖОЙ (${body.audioUrl})`}`);
  }
  let blindNull = 0;
  for (const w of BLIND) {
    const body = (await (await fetch(`${BASE}/api/word-audio?word=${encodeURIComponent(w)}`)).json()) as { audioUrl?: string | null };
    if (!body.audioUrl) blindNull++;
    console.log(`  [слой 1] контроль слепоты «${w}»: audioUrl = ${body.audioUrl ?? "null"}`);
  }

  // --- слой 2: настоящий тап анонимом ---------------------------------
  const { chromium, devices } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext(devices["Pixel 5"]);
  if (LOGIN) {
    const email = process.env.RUSOFACIL_TEST_EMAIL, password = process.env.RUSOFACIL_TEST_PASSWORD;
    if (!email || !password) throw new Error("нужны RUSOFACIL_TEST_EMAIL и RUSOFACIL_TEST_PASSWORD");
    const page = await ctx.newPage();
    await page.goto(`${BASE}/es/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 45000 }), page.click('button[type="submit"]')]);
    console.log(`  вход выполнен, страница после входа: ${new URL(page.url()).pathname}`);
    await page.close();
  }

  // У кнопки слова в разметке есть номер токена ВНУТРИ предложения, но
  // нет номера предложения, поэтому пара «слово + номер токена» может
  // встретиться на странице не один раз. Порядковый номер нужного
  // вхождения считается по тексту рассказа со снимка — так проба жмёт
  // именно СВОЁ место, а не первое похожее.
  const db = new Database(resolve(SNAPSHOT), { readonly: true });
  const texts = new Map((db.prepare("select id, text from Story").all() as { id: string; text: string }[]).map((s2) => [s2.id, s2.text]));
  db.close();
  function ordinalOf(j: J): number {
    const [pI, sI, tI] = j.itemKey.split("-").map(Number);
    let k = -1, seen = 0;
    for (const item of buildStoryQueue(splitStoryParagraphs(texts.get(j.storyId) ?? ""))) {
      const toks = item.text.split(WORD_SPLIT).filter((t) => t.length > 0);
      if (toks[tI] === j.text) {
        if (item.paragraphIndex === pI && item.sentenceIndex === sI) k = seen;
        seen += 1;
      }
    }
    return k;
  }

  async function probe(j: J) {
    const token = Number(j.itemKey.split("-")[2]);
    const ordinal = ordinalOf(j);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const w = window as unknown as { __played: string[]; Audio: typeof Audio };
      w.__played = [];
      const Orig = w.Audio;
      w.Audio = function (src?: string) { const a = new Orig(src); if (src) w.__played.push(src); return a; } as unknown as typeof Audio;
    });
    try {
      await page.goto(`${BASE}/es/stories/${j.storyId}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForSelector("button[data-word]", { timeout: 20000 });
      await page.waitForTimeout(5000);
      const hits = page.locator(`button[data-word="${j.text}"][data-token="${token}"]`);
      const n = await hits.count();
      if (n === 0 || ordinal < 0 || ordinal >= n) { await page.close(); return { url: null, elements: n, note: `элементов ${n}, нужное вхождение ${ordinal}`, noteV: false }; }
      await hits.nth(ordinal).evaluate((el: HTMLElement) => el.click());
      const speak = page.locator('button[aria-label="Escuchar palabra"]').first();
      await speak.waitFor({ timeout: 10000 });
      await page.waitForTimeout(3500);
      // строка варианта В у места С клипом печататься не имеет права
      const noteV = await page.locator("text=/acentuaci|ударение зависит/i").count() > 0;
      if (!PLANT) await speak.evaluate((el: HTMLElement) => el.click());
      await page.waitForTimeout(2500);
      const played = (await page.evaluate(() => (window as unknown as { __played: string[] }).__played)) ?? [];
      await page.close();
      return { url: played.find((u) => u.includes("/audio/story-words")) ?? null, elements: n, note: `элементов ${n}, нажато вхождение ${ordinal}, создано адресов ${played.length}`, noteV };
    } catch (e) {
      await page.close();
      return { url: null, elements: -1, note: (e as Error).message.split("\n")[0], noteV: false };
    }
  }

  let own = 0, reachable = 0, withNote = 0;
  for (const j of journal) {
    const r = await probe(j);
    if (r.elements > 0) { reachable++; if (r.noteV) withNote++; }
    const ok = r.url === j.url;
    if (ok) own++;
    console.log(`  [слой 2] №${j.n} ${j.storyId} ${j.itemKey} «${j.text}»: ${ok ? "СВОЙ клип" : r.elements === 0 ? "место этому входу не отдано (отрывок платного рассказа)" : `не свой (${r.url ?? "ничего"})`} — ${r.note}${r.elements > 0 ? `; строка варианта В: ${r.noteV ? "ЕСТЬ" : "нет"}` : ""}`);
  }
  await browser.close();

  console.log(`${PLANT ? "[контроль слепоты: кнопка не нажимается] " : ""}слой 1: свой адрес ${api} из ${journal.length}; слов без клипа ответили null ${blindNull} из ${BLIND.length}; слой 2: тап сыграл свой клип ${own} из ${reachable} достижимых анониму (из ${journal.length}); мест со строкой варианта В ${withNote} из ${reachable}`);
  if (PLANT) return own === 0 ? 0 : 1;
  return api === journal.length && blindNull === BLIND.length && own === reachable && reachable > 0 && withNote === 0 ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) main().then((c) => process.exit(c));
