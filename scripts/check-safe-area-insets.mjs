/**
 * БЕЗОПАСНЫЕ ПОЛЯ ПЕРЕЖИВАЮТ ЛЮБОЙ ПЕРЕХОД, А НЕ ТОЛЬКО ПЕРЕЗАГРУЗКУ
 * (заход 7.198, часть 2).
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО, И ЧТО ОПРОВЕРГНУТО ЧИСЛОМ
 * ====================================================================
 *
 * ЖАЛОБА. Меню → «Русский» → с этого мига шапка приложения нарисована
 * ПОВЕРХ системной строки (часы и батарея легли на название), а нижняя
 * панель ушла ПОД системные кнопки телефона: «Мой профиль» нажать
 * физически нельзя. Это откат работы 7.192, где поля и заводили
 * (верх 0 → 27 px, низ 0 → 24 px).
 *
 * ВЕРСИЯ ВЛАДЕЛЬЦА ОПРОВЕРГНУТА. Она звучала так: «смена языка делает
 * полную навигацию, после которой поля никто не подставляет заново».
 * Замер 15.09.2026 на настоящем браузере, три перехода, счётчик событий
 * `load` на каждом:
 *
 *   | переход                          | событий load | --android-inset-* после |
 *   |----------------------------------|--------------|-------------------------|
 *   | мягкий внутри локали /es → /es/… | 0            | ЖИВЫ (27px / 24px)      |
 *   | мягкий со сменой языка /es → /ru | **0**        | **СТЁРТЫ**              |
 *   | полная перезагрузка              | 1            | стёрты (документ новый) |
 *
 * Полной навигации при смене языка НЕТ ВОВСЕ: документ тот же, маркер в
 * `window` пережил переход. Стирает поля React — он переписывает атрибут
 * `style` элемента `<html>` целиком, когда меняется параметр корневого
 * макета (`src/app/[lang]/layout.tsx`, `<html lang={lang}>`), а другого
 * перехода, меняющего этот параметр, в приложении нет ни одного. Ровно
 * поэтому дефект видели только на смене языка.
 *
 * Одной записи в `style` мало по построению. Поэтому запись теперь вторая
 * и главная — `adoptedStyleSheets`: лист стилей ВНЕ дерева документа, у
 * него нет узла и React до него не дотягивается ни при каком переходе.
 *
 * ====================================================================
 * ЧЕМ ЭТОТ СТОРОЖ ОТЛИЧАЕТСЯ ОТ ПЕРЕСКАЗА
 * ====================================================================
 *
 * Он НЕ ПИШЕТ свою копию подстановки. Он достаёт её ТЕКСТОМ из
 * `MainActivity.java` (поле `INSET_APPLY_JS`) и исполняет в настоящем
 * браузере против настоящих страниц. Сторож с собственной копией проверял
 * бы свою копию — за это правило в 7.197 уже заплачено трижды.
 *
 * ПОДСТАНОВКА ДЕЛАЕТСЯ ОДИН РАЗ, В САМОМ НАЧАЛЕ. Это и есть модель
 * оболочки: `onPageStarted`/`onPageLoaded` приходят только при загрузке
 * ДОКУМЕНТА, и ни один из мягких переходов ниже их не вызывает. Если
 * после перехода поля пропали — оболочка их не вернёт, и человек увидит
 * ровно то, что снял владелец.
 *
 * ====================================================================
 * ЧТО МЕРЯЕТСЯ — ЧИСЛОМ, НА КАЖДОМ ПЕРЕХОДЕ
 * ====================================================================
 *
 *   · верхняя граница содержимого — `padding-top` шапки (`pt-safe`);
 *   · нижняя граница панели — `padding-bottom` нижней навигации
 *     (`pb-safe`);
 *   · разрешённые значения самих переменных `--safe-top` / `--safe-bottom`
 *     (через пробную коробку: пользовательские свойства
 *     `getComputedStyle` отдаёт неразрешённым текстом).
 *
 * Страницы запрашиваются С ПРИЗНАКОМ ОБОЛОЧКИ в User-Agent — иначе у
 * гостя нижней панели не существует вовсе (`BottomNav`, долг 192), и
 * мерить нижнюю границу было бы не на чем.
 *
 *   node scripts/check-safe-area-insets.mjs --base=http://localhost:3123
 *   node scripts/check-safe-area-insets.mjs --base=… --plant
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ACTIVITY = "android/app/src/main/java/com/rusofacilapp/app/MainActivity.java";

const argv = process.argv.slice(2);
const arg = (n, d) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = arg("base", "http://localhost:3123").replace(/\/$/, "");

/** Полосы телефона владельца (POCO X6 Pro, Android 16) — те же числа, что
 *  в замере 7.192: верх 27, низ 24. Берутся отсюда, а не с потолка: правка
 *  заводилась ровно на них. */
const TOP = 27;
const BOTTOM = 24;

const VIEWPORT = { width: 390, height: 780 };
/** Признак нативной оболочки в User-Agent — литерал тот же, что в
 *  `capacitor.config.ts` (`NATIVE_USER_AGENT_TOKEN`). */
const SHELL_UA =
  "Mozilla/5.0 (Linux; Android 16; 23113RKC6G) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Mobile Safari/537.36 RFNativeShell";

/**
 * Достаёт подстановку из Java ТЕКСТОМ: все строковые литералы правой
 * части объявления `INSET_APPLY_JS`, склеенные в том же порядке.
 */
export function extractInsetJs(activitySource) {
  const at = activitySource.indexOf("INSET_APPLY_JS =");
  if (at === -1) return null;
  // Конец объявления — точка с запятой ВНЕ литерала. Искать первую
  // попавшуюся нельзя: их полно внутри самого JS (`s.setProperty(k,v[k]);`),
  // и первый прогон этого сторожа на этом и упал.
  const parts = [];
  let i = activitySource.indexOf("=", at) + 1;
  while (i < activitySource.length) {
    const c = activitySource[i];
    if (c === '"') {
      let j = i + 1;
      let literal = "";
      while (j < activitySource.length && activitySource[j] !== '"') {
        if (activitySource[j] === "\\") {
          const next = activitySource[j + 1];
          literal += next === "n" ? "\n" : next;
          j += 2;
          continue;
        }
        literal += activitySource[j];
        j += 1;
      }
      parts.push(literal);
      i = j + 1;
      continue;
    }
    if (c === ";") break;
    i += 1;
  }
  if (parts.length === 0) return null;
  return parts.join("");
}

/** Готовая к исполнению строка: те же подстановки, что делает Java. */
export function insetJsWith(template, top, bottom, left = 0, right = 0) {
  return template
    .replace("%TOP%", String(top))
    .replace("%BOTTOM%", String(bottom))
    .replace("%LEFT%", String(left))
    .replace("%RIGHT%", String(right));
}

/** Три числа, снятые с живого документа. */
const MEASURE = `(() => {
  const px = (v) => Math.round(parseFloat(v) || 0);
  const header = document.querySelector("header");
  const nav = document.querySelector('nav[data-pinned-layer], nav.pb-safe, [data-bottom-nav]')
    || Array.from(document.querySelectorAll("nav")).find((n) => {
      const s = getComputedStyle(n);
      return s.position === "fixed" && px(s.bottom) === 0;
    });
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:-9999px;top:0;height:var(--safe-top);width:var(--safe-bottom);";
  document.body.appendChild(probe);
  const box = probe.getBoundingClientRect();
  probe.remove();
  return {
    headerPaddingTop: header ? px(getComputedStyle(header).paddingTop) : null,
    headerContentTop: header ? Math.round(header.getBoundingClientRect().top) + (header ? px(getComputedStyle(header).paddingTop) : 0) : null,
    navPaddingBottom: nav ? px(getComputedStyle(nav).paddingBottom) : null,
    safeTop: Math.round(box.height),
    safeBottom: Math.round(box.width),
  };
})()`;

function verdict(label, m, expectTop, expectBottom) {
  const problems = [];
  if (m.headerPaddingTop === null) {
    problems.push(`${label}: шапки на странице нет — мерить верхнюю границу не на чем`);
  } else if (m.headerPaddingTop !== expectTop) {
    problems.push(
      `${label}: верхняя граница содержимого ${m.headerPaddingTop} px при полосе устройства ${expectTop} px` +
        (m.headerPaddingTop === 0 ? " — шапка легла ПОД часы" : ""),
    );
  }
  if (m.navPaddingBottom === null) {
    problems.push(`${label}: нижней панели на странице нет — мерить нижнюю границу не на чем`);
  } else if (m.navPaddingBottom !== expectBottom) {
    problems.push(
      `${label}: нижняя граница панели ${m.navPaddingBottom} px при полосе устройства ${expectBottom} px` +
        (m.navPaddingBottom === 0 ? " — панель ушла ПОД системные кнопки" : ""),
    );
  }
  if (m.safeTop !== expectTop) problems.push(`${label}: --safe-top ${m.safeTop} px вместо ${expectTop}`);
  if (m.safeBottom !== expectBottom) problems.push(`${label}: --safe-bottom ${m.safeBottom} px вместо ${expectBottom}`);
  return problems;
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
}

/** Мягкая смена локали — ровно тем путём, которым её делает человек:
 *  гамбургер → переключатель → пункт нужного языка. */
async function switchLocale(page, to) {
  const burger = page.locator("header button[aria-expanded]").filter({ has: page.locator("span[aria-hidden]") });
  const trigger = (await burger.count()) > 0 ? burger.first() : page.locator("header button[aria-expanded]").first();
  await trigger.click();
  await page.waitForTimeout(400);
  await page.locator('button[aria-haspopup="menu"]:visible').first().click();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: to === "ru" ? /Русский/ : /Español/ }).first().click();
  await page.waitForURL(new RegExp(`/${to}(/|$)`), { timeout: 20000 });
  await settle(page);
}

/**
 * Один полный прогон по всем местам. `applyJs` — то, что оболочка кладёт
 * в документ; подсадки правят именно его.
 */
async function run(browser, applyJs, expect) {
  const context = await browser.newContext({ viewport: VIEWPORT, userAgent: SHELL_UA });
  const page = await context.newPage();
  let loads = 0;
  page.on("load", () => loads++);
  const problems = [];
  const lines = [];

  const step = async (label, act, { reapply = false } = {}) => {
    const before = loads;
    await act();
    if (reapply) await page.evaluate(applyJs);
    const m = await page.evaluate(MEASURE);
    const found = verdict(label, m, expect.top, expect.bottom);
    problems.push(...found);
    lines.push(
      `  ${found.length === 0 ? "ок  " : "ПЛОХО"} ${label}: событий load ${loads - before}, ` +
        `верх ${m.headerPaddingTop}, низ ${m.navPaddingBottom}, --safe-top ${m.safeTop}, --safe-bottom ${m.safeBottom}`,
    );
  };

  await page.goto(`${BASE}/es`, { waitUntil: "domcontentloaded" });
  await settle(page);
  // ЕДИНСТВЕННАЯ подстановка на все мягкие переходы ниже.
  await page.evaluate(applyJs);
  await step("1. первая загрузка", async () => {});
  await step("2. мягкий переход внутри локали", async () => {
    await page.locator('a[href^="/es/"]:visible').first().click();
    await page.waitForURL(/\/es\/.+/, { timeout: 20000 });
    await settle(page);
  });
  await step("3. мягкая смена языка es → ru", () => switchLocale(page, "ru"));
  await step("4. мягкая смена языка ru → es", () => switchLocale(page, "es"));
  await step("5. назад по истории", async () => {
    await page.goBack();
    await settle(page);
  });
  await step("6. вперёд по истории", async () => {
    await page.goForward();
    await settle(page);
  });
  // Полные навигации: документ новый, и там поля возвращает сама оболочка
  // событиями `onPageStarted`/`onPageLoaded`. Здесь это и воспроизводится —
  // ровно одна подстановка после загрузки.
  await step(
    "7. полная перезагрузка + одна подстановка оболочки",
    async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await settle(page);
    },
    { reapply: true },
  );
  await step(
    "8. полный переход по адресу + одна подстановка оболочки",
    async () => {
      await page.goto(`${BASE}/ru/vocabulary`, { waitUntil: "domcontentloaded" });
      await settle(page);
    },
    { reapply: true },
  );

  await context.close();
  return { problems, lines, places: 8 };
}

export async function main() {
  const plant = argv.includes("--plant");
  const template = extractInsetJs(readFileSync(ACTIVITY, "utf8"));
  if (!template) {
    console.error(`${ACTIVITY}: подстановка безопасных полей (INSET_APPLY_JS) не найдена`);
    return 1;
  }
  const healthy = insetJsWith(template, TOP, BOTTOM);
  const browser = await chromium.launch();
  try {
    if (!plant) {
      const { problems, lines, places } = await run(browser, healthy, { top: TOP, bottom: BOTTOM });
      for (const l of lines) console.log(l);
      if (problems.length) {
        console.error("БЕЗОПАСНЫЕ ПОЛЯ:");
        for (const p of problems) console.error(`  ${p}`);
        return 1;
      }
      console.log(
        `check:safe-area-insets — ${places} из ${places} мест: поля ${TOP}/${BOTTOM} px пережили переход. ` +
          `Подстановка взята текстом из ${ACTIVITY}. Контроль — --plant.`,
      );
      return 0;
    }

    let ok = true;
    const negative = await run(browser, healthy, { top: TOP, bottom: BOTTOM });
    if (negative.problems.length) ok = false;
    console.log(
      `  ${negative.problems.length === 0 ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровая подстановка ` +
        `(отрицательный контроль, ${negative.places} мест)`,
    );

    const plants = [
      [
        "поля обнулились (оболочка прислала 0/0)",
        insetJsWith(template, 0, 0),
      ],
      [
        "убрана вторая запись — ровно механизм 7.192, который стирал React на смене языка",
        insetJsWith(template.replace(/try\{[\s\S]*\}catch\(e\)\{\}/, ""), TOP, BOTTOM),
      ],
      [
        "подстановки нет вовсе",
        "void 0",
      ],
      [
        "перепутаны верх и низ",
        insetJsWith(template, BOTTOM, TOP),
      ],
    ];

    let caught = 0;
    for (const [name, js] of plants) {
      const r = await run(browser, js, { top: TOP, bottom: BOTTOM });
      const hit = r.problems.length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}${hit ? ` (${r.problems[0]})` : ""}`);
      if (hit && /вторая запись/.test(name)) {
        const places = new Set(r.problems.map((p) => p.split(":")[0]));
        console.log(`      · упало ровно на местах: ${[...places].join("; ")}`);
      }
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:safe-area-insets --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
        : `check:safe-area-insets --plant — FAILED (${caught} из ${plants.length})`,
    );
    return ok ? 0 : 1;
  } finally {
    await browser.close();
  }
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
