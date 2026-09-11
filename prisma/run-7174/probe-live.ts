/**
 * Заход 7.174: живая проба на БОЕВОМ сайте — анонимом, без входа.
 *
 * Доказывается три вещи, и третья — главная:
 *   1. восемь мест (четыре долга 134 + два метода Б + два метода А)
 *      проигрывают ИМЕННО свою вырезку, а не клип словоформы и не чужое
 *      место;
 *   2. у пар «потом» и «дома», стоящих В ОДНОМ ПРЕДЛОЖЕНИИ, адреса
 *      РАЗНЫЕ — ровно то, чего не было до 7.171 (долг 134: оба места
 *      играли звук ПЕРВОГО вхождения, байт в байт один файл);
 *   3. контроль слепоты: место «стороны», которому вырезки не досталось,
 *      не играет ничего. Без него «8 из 8» доказывало бы только то, что
 *      проба умеет нажимать кнопку.
 *
 * Ловушки, все три из PROGRESS.md 7.170:
 *   * `new Audio(url)` в разметке не виден — конструктор оборачивается ДО
 *     загрузки страницы;
 *   * у приглушённой кнопки `click()` Playwright не срабатывает вовсе —
 *     нажатие делается `el.click()` из страницы;
 *   * кнопка в поповере появляется РАНЬШЕ адреса клипа: `/api/word-audio`
 *     спрашивается уже после открытия окошка, и нажатие до ответа даёт
 *     ровно то же, что место без клипа.
 *
 *   npx tsx prisma/run-7174/probe-live.ts --journal=… --plan=… --snapshot=… [--plant]
 */
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import path from "node:path";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const JOURNAL = arg("journal")!;
const PLAN = arg("plan")!;
const SNAPSHOT = arg("snapshot") ?? "prisma/snapshots/prod-latest.db";
const BASE = arg("base") ?? "https://rusofacilapp.com";
const PLANT = process.argv.includes("--plant");

/** Место без вырезки — контроль слепоты (7.174, вариант В). */
const BLIND = { storyId: "cmsxtqp42004uqwncmhhhk44i", itemKey: "8-0-6", text: "стороны" };

interface J { op: string; n: number; file: string; storyId: string; itemKey: string; text: string; url?: string; to?: string }
interface P { n: number; folder: string; storyId: string; itemKey: string; word: string; paragraphIndex: number }

const WORD_SPLIT = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
const CYRILLIC = /^[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*$/u;

async function main(): Promise<number> {
  const journal = readFileSync(JOURNAL, "utf-8").trim().split("\n").map((l) => JSON.parse(l) as J);
  const plan = JSON.parse(readFileSync(PLAN, "utf-8")) as P[];
  const byN = new Map(plan.map((p) => [p.n, p]));
  const url = (j: J) => (j.op === "insert" ? j.url! : j.to!);

  const { splitStoryParagraphs, buildStoryQueue } = await import("@/lib/stories");
  const db = new Database(path.resolve(SNAPSHOT), { readonly: true });
  const texts = new Map((db.prepare("select id, text from Story").all() as { id: string; text: string }[]).map((s) => [s.id, s.text]));
  db.close();

  /** Место опознаётся пробой, только если `button[data-word][data-token]`
   *  на странице ровно один: `data-token` нумеруется ВНУТРИ предложения. */
  const unique = (storyId: string, itemKey: string, word: string) => {
    const text = texts.get(storyId);
    if (!text) return false;
    const token = Number(itemKey.split("-")[2]);
    let seen = 0;
    for (const item of buildStoryQueue(splitStoryParagraphs(text))) {
      const toks = item.text.split(WORD_SPLIT).filter((t) => t.length > 0);
      if (toks[token] && CYRILLIC.test(toks[token]) && toks[token] === word) seen++;
    }
    return seen === 1;
  };

  // --- кого пробуем: 4 долга 134 + 2 из Б + 2 из А ------------------
  const withPlan = journal.filter((j) => j.op === "insert" || j.op === "replace").map((j) => ({ j, p: byN.get(j.n)! }));
  const pick = (folder: string, n: number) =>
    withPlan.filter((x) => x.p.folder === folder && unique(x.j.storyId, x.j.itemKey, x.j.text))
      .sort((a, b) => a.p.paragraphIndex - b.p.paragraphIndex).slice(0, n);
  const targets = [...withPlan.filter((x) => x.p.folder === "134"), ...pick("Б", 2), ...pick("А", 2)];
  console.log(`целей: ${targets.length} (134 — ${targets.filter((t) => t.p.folder === "134").length}, Б — 2, А — 2)`);

  const { chromium, devices } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext(devices["Pixel 5"]);

  async function probe(storyId: string, itemKey: string, word: string): Promise<{ url: string | null; elements: number; note: string }> {
    const token = Number(itemKey.split("-")[2]);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const w = window as unknown as { __played: string[]; Audio: typeof Audio };
      w.__played = [];
      const Orig = w.Audio;
      w.Audio = function (src?: string) { const a = new Orig(src); if (src) w.__played.push(src); return a; } as unknown as typeof Audio;
    });
    try {
      await page.goto(`${BASE}/es/stories/${storyId}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForSelector("button[data-word]", { timeout: 20000 });
      await page.waitForTimeout(5000);                        // гидрация
      const hits = page.locator(`button[data-word="${word}"][data-token="${token}"]`);
      const n = await hits.count();
      if (n !== 1) { await page.close(); return { url: null, elements: n, note: `элементов ${n}` }; }
      await hits.first().evaluate((el: HTMLElement) => el.click());
      const speak = page.locator('button[aria-label="Escuchar palabra"]').first();
      await speak.waitFor({ timeout: 10000 });
      await page.waitForTimeout(3500);                        // адрес клипа приезжает ПОЗЖЕ кнопки
      if (!PLANT) await speak.evaluate((el: HTMLElement) => el.click());
      await page.waitForTimeout(2500);
      const played = (await page.evaluate(() => (window as unknown as { __played: string[] }).__played)) ?? [];
      await page.close();
      return { url: played.find((u) => u.includes("/audio/story-words/")) ?? null, elements: 1, note: `создано адресов ${played.length}` };
    } catch (e) {
      await page.close();
      return { url: null, elements: -1, note: (e as Error).message.split("\n")[0] };
    }
  }

  // --- слой 1: тот же запрос, который делает тап, но без страницы -----
  //
  // Нужен потому, что четыре места долга 134 стоят в абзацах 9 и 4
  // ПЛАТНЫХ рассказов, а анониму рассказ показывается отрывком: нажать
  // там нечего, и «молчит» означало бы «абзац не отдан», а не «клипа
  // нет». `/api/word-audio` публичен и спрашивается тапом ровно этим
  // адресом, поэтому слой 1 доказывает, ЧТО отдаётся месту, а слой 2 —
  // что тап это и проигрывает. Ни один из двух не заменяет другого, и
  // здесь они не смешиваются.
  let api = 0;
  const apiUrl: Record<string, string | null> = {};
  for (const t of [...targets, { j: { ...BLIND, op: "blind", n: 0, file: "" } as unknown as J, p: { folder: "—" } as P }]) {
    const [pI, sI, tI] = t.j.itemKey.split("-");
    const word = t.p.folder === "—" ? BLIND.text : t.p.word;
    const q = `${BASE}/api/word-audio?word=${encodeURIComponent(word)}&story=${encodeURIComponent(t.j.storyId)}&at=${pI}-${sI}-${tI}`;
    const body = (await (await fetch(q)).json()) as { audioUrl?: string | null };
    apiUrl[`${t.j.storyId}|${t.j.itemKey}`] = body.audioUrl ?? null;
    if (t.p.folder === "—") { console.log(`  [слой 1] контроль слепоты «${word}» ${t.j.itemKey}: audioUrl = ${body.audioUrl ?? "null"}`); continue; }
    const ok = body.audioUrl === url(t.j);
    if (ok) api++;
    console.log(`  [слой 1] №${t.j.n} ${t.p.folder} ${t.j.storyId} ${t.j.itemKey} «${word}»: ${ok ? "свой адрес" : `ЧУЖОЙ (${body.audioUrl})`}`);
  }
  console.log(`  [слой 1] свой адрес отдан ${api} из ${targets.length}; месту без вырезки отдано ${apiUrl[`${BLIND.storyId}|${BLIND.itemKey}`] ?? "null"}`);

  // --- слой 2: настоящий тап анонимом ---------------------------------
  let own = 0, reachable = 0;
  const seen: Record<string, string | null> = {};
  for (const t of targets) {
    const r = await probe(t.j.storyId, t.j.itemKey, t.p.word);
    if (r.elements === 1) reachable++;
    const ok = r.url === url(t.j);
    if (ok) own++;
    seen[`${t.j.storyId}|${t.j.itemKey}`] = r.url;
    console.log(`  [слой 2] №${t.j.n} ${t.p.folder} ${t.j.storyId} ${t.j.itemKey} «${t.p.word}»: ${ok ? "СВОЙ клип" : r.elements === 0 ? "место анониму не отдано (отрывок)" : `не свой (${r.url ?? "ничего"})`} — ${r.note}`);
  }

  // --- пары в одном предложении: адреса обязаны РАЗЛИЧАТЬСЯ ----------
  const pairs = [
    ["cmsxtpzwq0000qwnc4a2sstlo|9-0-20", "cmsxtpzwq0000qwnc4a2sstlo|9-0-28", "потом"],
    ["cmsxtq7fh001fqwnc4gq7cxsa|4-0-2", "cmsxtq7fh001fqwnc4gq7cxsa|4-0-28", "дома"],
  ] as const;
  let differ = 0;
  for (const [a, b, w] of pairs) {
    const ua = apiUrl[a], ub = apiUrl[b];
    const ok = Boolean(ua && ub && ua !== ub);
    if (ok) differ++;
    console.log(`  пара «${w}» в одном предложении: ${ok ? "адреса РАЗНЫЕ" : `адреса НЕ различились (${ua} / ${ub})`}`);
  }

  await browser.close();
  const blindApi = apiUrl[`${BLIND.storyId}|${BLIND.itemKey}`];
  console.log(`${PLANT ? "[контроль слепоты: кнопка не нажимается] " : ""}слой 1: свой адрес ${api} из ${targets.length}; слой 2: тап сыграл свой клип ${own} из ${reachable} достижимых анониму (из ${targets.length}); пар с разными адресами ${differ} из ${pairs.length}; месту без вырезки отдано ${blindApi ?? "null"}`);
  if (PLANT) return own === 0 ? 0 : 1;
  return api === targets.length && own === reachable && reachable > 0 && differ === pairs.length && !blindApi ? 0 : 1;
}

main().then((c) => process.exit(c));
