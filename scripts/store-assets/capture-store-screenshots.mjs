#!/usr/bin/env node
/**
 * Снимает кандидатов в скриншоты витрины Google Play с ЖИВОГО прода.
 *
 * Почему 360×640 при deviceScaleFactor 3, а не «вьюпорт 1080×1920»:
 * вьюпорт задаётся в CSS-пикселях, и 1080 CSS-пикселей — это ширина
 * НАСТОЛЬНОГО макета, а не телефона. Настоящий телефонный макет даёт
 * 360 CSS-пикселей, а нужный Play размер файла получается множителем
 * устройства: 360×3 = 1080, 640×3 = 1920. Соотношение 9:16 = 1,78 —
 * ниже потолка Play в 2:1.
 *
 * Прод только ЧИТАЕТСЯ: вход не выполняется, ни одного POST, ни одной
 * записи в базу. Скрипт полностью повторяем — вся правка кадра описана
 * здесь данными (`scrollY`), а не руками в графическом редакторе.
 *
 *   node scripts/store-assets/capture-store-screenshots.mjs [--out=DIR] [--base=URL] [--only=slug]
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  }),
);

const BASE = args.get("base") ?? "https://rusofacilapp.com";
const ONLY = args.get("only") ?? null;
const OUT =
  args.get("out") ?? path.join(process.env.HOME, "Desktop/rusofacil-store-assets/screenshots-candidatos");

// Целевой пиксельный размер файла, требуемый Play для телефона.
const TARGET = { width: 1080, height: 1920 };
const SCALE = 3;
const VIEWPORT = { width: TARGET.width / SCALE, height: TARGET.height / SCALE };

/**
 * Восемь кандидатов. Отбор пяти лучших делается ГЛАЗАМИ по снимкам, а не
 * скриптом: «скриншот, который нельзя описать, не годится».
 *

 */
const CANDIDATES = [
  // `scrollY` — прокрутка в CSS-пикселях ДО съёмки. Число, а не селектор:
  // селектор на живом проде цепляет то ссылку подвала, то скрытую кнопку,
  // и кадр уезжает молча. Число проверяется глазами по самому снимку и
  // воспроизводится дословно. Опорные величины взяты замером вёрстки
  // 13.09.2026 (см. отчёт захода 7.190). `noBottomFix` снимает доводку низа
  // там, где экран выше вьюпорта целиком и двигать уже нечего.
  { slug: "01-home", url: "/es", wait: 2500, scrollY: 45, noBottomFix: true },
  { slug: "02-stories-catalog", url: "/es/stories", wait: 2500, scrollY: 600 },
  // Репка — БЕСПЛАТНЫЙ рассказ (значка замка нет), поэтому на снимке
  // видны и плеер, и настоящий текст, а не превью одного абзаца.
  { slug: "03-story-player", url: "/es/stories/cmsxtq13w000cqwnc466c87es", wait: 3500, scrollY: 400 },
  { slug: "04-vocabulary", url: "/es/vocabulary", wait: 2500, scrollY: 470 },
  { slug: "05-word-search", url: "/es/word-games/WORD_SEARCH/A1/1", wait: 3500, scrollY: 300 },
  { slug: "06-crossword", url: "/es/word-games/CROSSWORD/A1/1", wait: 3500, scrollY: 430 },
  { slug: "07-grammar", url: "/es/gramatica", wait: 2500, scrollY: 411 },
  { slug: "08-alphabet", url: "/es/alfabeto-cirilico", wait: 2500, scrollY: 600 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Подводит прокрутку так, чтобы нижняя кромка кадра не разрезала ни одного
 * содержательного блока: находит всё, что пересекает кромку, и сдвигает
 * страницу ВВЕРХ ровно настолько, чтобы верх самого высокого из пересекающих
 * оказался под кромкой. Возвращает число сдвига — оно попадает в отчёт,
 * чтобы кадр можно было воспроизвести.
 */
async function cleanBottomEdge(page) {
  return page.evaluate(() => {
    const H = window.innerHeight;
    const SEL =
      "p,h1,h2,h3,h4,h5,li,button,img,table,figure,input,label,td,th,article,a";
    let cutTop = null;
    for (const el of document.querySelectorAll(SEL)) {
      const r = el.getBoundingClientRect();
      if (r.height < 12 || r.width < 12) continue;
      if (r.top >= H || r.bottom <= H) continue; // кромку не пересекает
      if (r.height > H * 0.9) continue; // это рама, а не блок
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || st.display === "none") continue;
      if (cutTop === null || r.top < cutTop) cutTop = r.top;
    }
    if (cutTop === null) return 0;
    const shift = Math.ceil(H - cutTop) + 8;
    // Сдвигать больше пятой части экрана нельзя: такой сдвиг съедает уже
    // не «хвост», а целую карточку сверху, и кадр уезжает с того места,
    // ради которого его и выбирали. Тогда честнее оставить рез как есть
    // и решить глазами, годится ли снимок.
    if (shift > H * 0.2) return 0;
    window.scrollBy(0, -shift);
    return -shift;
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    // Испанская локаль: сайт не должен решить, что перед ним русскоязычный.
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    colorScheme: "light",
    reducedMotion: "reduce",
  });

  const report = [];
  for (const c of CANDIDATES) {
    if (ONLY && c.slug !== ONLY) continue;
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    const url = BASE + c.url;
    let status = 0;
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      status = resp?.status() ?? 0;
    } catch {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    await sleep(c.wait);
    // Гасим анимации и мигающую каретку, чтобы снимок не поймал полукадр.
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
    });

    await page.evaluate((y) => window.scrollTo(0, y), c.scrollY ?? 0);
    await sleep(400);
    const adjusted = c.noBottomFix ? 0 : await cleanBottomEdge(page);
    await sleep(400);
    const scrollY = await page.evaluate(() => Math.round(window.scrollY));

    const file = path.join(OUT, `${c.slug}.png`);
    await page.screenshot({ path: file, fullPage: false });

    // Полный текст видимой части — чтобы отчёт мог сказать, что на снимке.
    const text = (
      await page.evaluate(() => {
        const H = window.innerHeight;
        const out = [];
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walk.nextNode())) {
          const t = n.textContent.trim();
          if (!t) continue;
          const r = n.parentElement?.getBoundingClientRect();
          if (!r || r.bottom < 0 || r.top > H) continue;
          out.push(t);
        }
        return out.join(" | ");
      })
    ).slice(0, 1500);

    report.push({
      slug: c.slug,
      url,
      status,
      scrollY,
      bottomEdgeAdjustedBy: adjusted,
      pageErrors: errors,
      visibleText: text,
    });
    await page.close();
    console.log(
      `${c.slug}  http ${status}  scrollY ${scrollY}  доводка низа ${adjusted}px  ошибок ${errors.length}`,
    );
  }

  await browser.close();
  await writeFile(
    path.join(OUT, "capture-report.json"),
    JSON.stringify({ base: BASE, target: TARGET, viewport: VIEWPORT, scale: SCALE, shots: report }, null, 2),
  );
  console.log(`\nГотово: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
