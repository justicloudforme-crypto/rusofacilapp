// ПЛАВАЮЩАЯ КНОПКА НЕ ЛОЖИТСЯ НА ОРГАНЫ УПРАВЛЕНИЯ — долг 82, заход 7.212.
//
// ОТКУДА ПРАВИЛО. Запись долга (08.09.2026, 7.143) называла числа с
// живого экрана: плавающая кнопка Telegram перекрывала карточку рассказа
// на 52×60 px и ссылку подвала на русских страницах на 37,1×12 px, и
// «узнать об этом можно было только от человека» — перекрытие не мерил
// никто. Этот сторож и есть тот, кто его мерит.
//
// КАК СУДИТСЯ. Геометрией, а не селектором: берётся коробка плавающей
// кнопки и коробка КАЖДОГО органа управления на странице (`a`, `button`,
// `input`, `textarea`, `select`, `[role=button]`), считается площадь
// пересечения. Любое пересечение — отказ: палец попадает в кнопку, а
// человек целился в ссылку.
//
// ПОЧЕМУ ДВА ПОЛОЖЕНИЯ ПРОКРУТКИ. Кнопка прижата к низу окна, а подвал
// приезжает под неё только в конце страницы: замер лишь «сверху» не видел
// бы ровно того перекрытия, которое записано в долге (37,1×12 на
// `/ru/privacy`). Меряется верх и низ каждой страницы.
//
// ПОЗИТИВНЫЙ КОНТРОЛЬ ОБЯЗАТЕЛЕН И ВСТРОЕН (`--plant`): в страницу
// подсаживается правило `display:flex !important` для этой кнопки на всех
// ширинах — то есть ровно поведение ДО правки 7.212 (`sm:flex`). Если
// после подсадки перекрытий по-прежнему ноль, значит прибор слеп, и
// прогон красный.
//
//   node scripts/check-float-overlap.mjs --base=http://localhost:3123
//   node scripts/check-float-overlap.mjs --base=… --plant
import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://localhost:3123").replace(/\/$/, "");
const PLANT = argv.includes("--plant");
const CI = argv.includes("--ci");

/** Ширины. Ниже 640 кнопки нет с самого начала, выше 1280 — свободное поле. */
const WIDTHS = [640, 768, 834, 1024, 1280, 1440];
/** Адреса: те, где перекрытие было замерено, плюс два без него. */
const PATHS = ["/ru", "/ru/stories", "/ru/vocabulary", "/es/stories", "/ru/courses", "/es"];

/** Селектор самой кнопки — по адресу приглашения, а не по классу. */
const FAB = 'a[href*="t.me/"]';

/** Подсадка: вернуть кнопку на все ширины, как было до 7.212. */
const PLANT_CSS = `${FAB} { display: flex !important; }`;

async function measure(page, plant) {
  if (plant) await page.addStyleTag({ content: PLANT_CSS });
  return page.evaluate((sel) => {
    const fab = document.querySelector(sel);
    if (!fab) return { visible: false, hits: [] };
    const r = fab.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { visible: false, hits: [] };
    const hits = [];
    for (const el of Array.from(document.querySelectorAll("a, button, input, textarea, select, [role=button]"))) {
      if (el === fab || fab.contains(el) || el.contains(fab)) continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const ox = Math.min(r.right, b.right) - Math.max(r.left, b.left);
      const oy = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
      if (ox > 0 && oy > 0) {
        const what = (el.getAttribute("href") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
        hits.push(`${el.tagName.toLowerCase()}[${what}] ${ox.toFixed(1)}×${oy.toFixed(1)}`);
      }
    }
    return { visible: true, hits };
  }, FAB);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const problems = [];
  let measured = 0;
  let visibleAt = 0;
  let plantedHits = 0;

  try {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of PATHS) {
        const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        if (!res || !res.ok()) {
          problems.push(`${path} @${width}: страница ответила ${res ? res.status() : "нечем"} — мерить нечего`);
          continue;
        }
        await page.waitForTimeout(500);
        for (const where of ["верх", "низ"]) {
          if (where === "низ") {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(350);
          }
          const { visible, hits } = await measure(page, PLANT);
          measured += 1;
          if (visible) visibleAt += 1;
          if (PLANT) plantedHits += hits.length;
          else for (const hit of hits) problems.push(`${path} @${width} (${where}): кнопка легла на ${hit}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  // Пол: «перекрытий 0» не должно доказываться ненайденной страницей.
  const floor = CI ? 24 : WIDTHS.length * PATHS.length * 2;
  if (measured < floor) {
    console.error(`замеров ${measured} при поле ${floor} — прибор смотрел не туда`);
    return 1;
  }

  if (PLANT) {
    // Под подсадкой кнопка обязана быть видна ВЕЗДЕ и перекрытия обязаны
    // найтись: иначе прибор не умеет их находить вовсе.
    const ok = plantedHits > 0 && visibleAt === measured;
    console.log(
      ok
        ? `check:float-overlap --plant — подсадка «кнопка на всех ширинах» даёт ${plantedHits} перекрытий на ${measured} замерах: прибор их видит`
        : `check:float-overlap --plant — FAILED: перекрытий под подсадкой ${plantedHits}, кнопка видна на ${visibleAt} из ${measured}`,
    );
    return ok ? 0 : 1;
  }

  if (problems.length) {
    console.error("ПЛАВАЮЩАЯ КНОПКА ПЕРЕКРЫВАЕТ ИНТЕРАКТИВ (долг 82):");
    for (const p of problems.slice(0, 30)) console.error(`  ${p}`);
    if (problems.length > 30) console.error(`  … и ещё ${problems.length - 30}`);
    return 1;
  }
  console.log(
    `check:float-overlap — замеров ${measured} (${WIDTHS.length} ширин × ${PATHS.length} адресов × 2 положения прокрутки), ` +
      `кнопка видна на ${visibleAt} из них: перекрытий 0.`,
  );
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
