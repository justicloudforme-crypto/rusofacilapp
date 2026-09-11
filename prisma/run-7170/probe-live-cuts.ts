/**
 * Заход 7.170: живая проба на БОЕВОМ сайте — анонимом, без входа.
 *
 * Что доказывается: тап по слову-омографу в рассказе проигрывает ИМЕННО
 * ту вырезку, которая записана этому месту, а не клип словоформы и не
 * чужое место. Проба берёт шесть новых вырезок из ШЕСТИ РАЗНЫХ рассказов.
 *
 * Как измеряется. Элемента `<audio>` у клипа слова нет в разметке вовсе —
 * он создаётся `new Audio(url)`. Поэтому конструктор оборачивается ДО
 * загрузки страницы, и каждый созданный адрес пишется в память страницы.
 *
 * ДВЕ ЛОВУШКИ, обе из PROGRESS.md:
 *   * у приглушённой кнопки Playwright-овский `click()` не срабатывает
 *     вовсе (он ждёт «actionable»), поэтому нажатие делается `el.click()`
 *     из страницы;
 *   * контроль слепоты обязателен: с `--plant` проба не нажимает кнопку
 *     вовсе и обязана получить 0 сыгравших.
 *
 *   npx tsx prisma/run-7170/probe-live-cuts.ts --journal=<written.jsonl> [--plant]
 */
import { readFileSync } from "node:fs";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const JOURNAL = arg("journal")!;
const BASE = arg("base") ?? "https://rusofacilapp.com";
const PLANT = process.argv.includes("--plant");
const WANT = Number(arg("want") ?? 6);

interface J { op: string; file?: string; storyId?: string; itemKey?: string; text?: string; url?: string }

async function main(): Promise<number> {
  const journal = readFileSync(JOURNAL, "utf-8").trim().split("\n").map((l) => JSON.parse(l) as J)
    .filter((j) => j.op === "insert");
  // По одной вырезке на рассказ, чтобы шесть проб пришлись на шесть разных рассказов.
  const perStory = new Map<string, J>();
  for (const j of journal) if (!perStory.has(j.storyId!)) perStory.set(j.storyId!, j);
  // Два отбора, и оба — про пробу, а не про продукт.
  //   1. Анониму рассказ показывается отрывком, поэтому места из первых
  //      абзацев пробуются первыми: тратить пробу на текст за пейволом
  //      бессмысленно.
  //   2. Нажать можно только то место, которое проба умеет отличить от
  //      соседей: `button[data-word][data-token]` НЕ уникален сам по себе,
  //      потому что `data-token` нумеруется внутри предложения, и то же
  //      слово на том же номере токена в другом предложении дало бы второй
  //      элемент. Такие места отсеиваются ЗДЕСЬ, по тексту рассказа, а не
  //      загрузкой страницы: иначе проба тратит по десять секунд на каждый
  //      заведомый пропуск.
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const { splitStoryParagraphs, buildStoryQueue } = await import("@/lib/stories");
  const db = new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });
  const WORD_SPLIT = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
  const CYRILLIC = /^[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*$/u;
  const texts = new Map((await db.story.findMany({ select: { id: true, text: true } })).map((x) => [x.id, x.text]));
  await db.$disconnect();
  const unique = (j: J) => {
    const text = texts.get(j.storyId!);
    if (!text) return false;
    const token = Number(j.itemKey!.split("-")[2]);
    let seen = 0;
    for (const item of buildStoryQueue(splitStoryParagraphs(text))) {
      const toks = item.text.split(WORD_SPLIT).filter((t) => t.length > 0);
      if (toks[token] && CYRILLIC.test(toks[token]) && toks[token] === j.text) seen++;
    }
    return seen === 1;
  };
  const candidates = [...perStory.values()].filter(unique).sort(
    (a, b) => Number(a.itemKey!.split("-")[0]) - Number(b.itemKey!.split("-")[0]),
  );
  console.log(`рассказов с новой вырезкой: ${perStory.size}; из них место опознаётся пробой однозначно: ${candidates.length}`);

  const { chromium, devices } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext(devices["Pixel 5"]);
  let played = 0;
  let tried = 0;
  const lines: string[] = [];

  for (const c of candidates) {
    // С подсадкой успехов не бывает по построению, поэтому счётчик проб —
    // единственный, который может остановить обход: без него контроль
    // слепоты прошёл бы все 217 мест ради заведомого нуля.
    if (played >= WANT || tried >= (PLANT ? WANT : 40)) break;
    const token = Number(c.itemKey!.split("-")[2]);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const w = window as unknown as { __played: string[]; Audio: typeof Audio };
      w.__played = [];
      const Orig = w.Audio;
      w.Audio = function (src?: string) {
        const a = new Orig(src);
        if (src) w.__played.push(src);
        return a;
      } as unknown as typeof Audio;
    });
    try {
      await page.goto(`${BASE}/es/stories/${c.storyId}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForSelector("button[data-word]", { timeout: 15000 });
      // Тап по слову обрабатывает КЛИЕНТСКИЙ обработчик предложения, поэтому
      // до конца гидрации нажатие не делает ничего вовсе — и молчание тогда
      // означало бы не «клипа нет», а «страница ещё не ожила».
      await page.waitForTimeout(5000);
      const hits = page.locator(`button[data-word="${c.text}"][data-token="${token}"]`);
      const n = await hits.count();
      if (n !== 1) { lines.push(`пропуск ${c.storyId} ${c.itemKey} ${c.text}: элементов ${n}`); await page.close(); continue; }
      tried++;
      await hits.first().evaluate((el: HTMLElement) => el.click());
      const speak = page.locator('button[aria-label="Escuchar palabra"]').first();
      await speak.waitFor({ timeout: 8000 });
      // Кнопка в поповере появляется СРАЗУ, а адрес клипа приезжает позже:
      // `/api/word-audio` спрашивается уже после открытия окошка. Нажать её
      // раньше ответа — значит получить ровно то же, что у места без клипа:
      // ноль созданных `Audio`. Эта пауза стоила одного ложного «молчит» на
      // пяти местах из шести в первом прогоне.
      await page.waitForTimeout(3000);
      if (!PLANT) {
        await speak.evaluate((el: HTMLElement) => el.click());
      }
      await page.waitForTimeout(2500);
      const urls = (await page.evaluate(() => (window as unknown as { __played: string[] }).__played)) ?? [];
      const apiHit = urls.find((u) => u.includes("/api/word-audio"));
      let ok = false;
      if (apiHit) {
        const res = await ctx.request.get(apiHit.startsWith("http") ? apiHit : `${BASE}${apiHit}`);
        const body = (await res.json()) as { audioUrl?: string | null };
        ok = body.audioUrl === c.url;
        lines.push(`${c.storyId} ${c.itemKey} «${c.text}»: сыграно ${apiHit.split("?")[1]} → ${ok ? "СВОЙ клип" : `ЧУЖОЙ (${body.audioUrl})`}`);
      } else {
        const direct = urls.find((u) => u.includes("/audio/story-words/"));
        ok = direct === c.url;
        lines.push(`${c.storyId} ${c.itemKey} «${c.text}»: адресов создано ${urls.length}${direct ? ` → ${ok ? "СВОЙ клип" : "ЧУЖОЙ"}` : " → ни одного"}`);
      }
      if (ok) played++;
    } catch (e) {
      lines.push(`пропуск ${c.storyId} ${c.itemKey}: ${(e as Error).message.split("\n")[0]}`);
    }
    await page.close();
  }
  await browser.close();

  for (const l of lines) console.log(`  ${l}`);
  console.log(`${PLANT ? "[контроль слепоты] " : ""}проб сделано ${tried}, сыграли свой клип ${played} из ${WANT}`);
  if (PLANT) return played === 0 ? 0 : 1;
  return played >= WANT ? 0 : 1;
}

main().then((c) => process.exit(c));
