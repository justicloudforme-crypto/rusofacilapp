/**
 * ВЫБРАННЫЙ ЯЗЫК ПЕРЕЖИВАЕТ ПЕРЕЗАПУСК (заход 7.198, часть 3 «а»).
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Жалоба: владелец переключил интерфейс на русский, закрыл приложение,
 * открыл заново — снова испанский.
 *
 * Причина названа строкой и она не в оболочке. Оболочка грузит корневой
 * адрес `https://rusofacilapp.com/` — БЕЗ локали, — а решение, куда его
 * увести, принимал `src/proxy.ts` одним-единственным способом:
 * `getPreferredLocale(request)`, то есть по `Accept-Language`. Этот
 * заголовок описывает язык УСТРОЙСТВА и про выбор человека не знает
 * вовсе. У владельца телефон испанский — значит корень уводил на `/es`
 * сколько угодно раз подряд, независимо от того, что он выбирал.
 *
 * Тот же класс, что язык уведомлений (7.195) и язык экрана ошибки
 * (часть 3 «б»): язык берётся откуда придётся, потому что единственного
 * места для него нет.
 *
 * ====================================================================
 * ЧТО ЗДЕСЬ ВОСПРОИЗВОДИТСЯ
 * ====================================================================
 *
 * Полный сценарий владельца, без единого пропуска и в обе стороны:
 *
 *   1. устройство с языком X, ничего не запомнено — корень уводит на X
 *      (прежнее поведение обязано сохраниться дословно);
 *   2. человек выбирает язык Y ТЕМ ЖЕ путём, что и на телефоне: меню →
 *      переключатель → пункт языка;
 *   3. ПЕРЕЗАПУСК. Окно закрывается целиком, остаётся только то, что
 *      пережило бы закрытие приложения, — куки. Новый контекст, новое
 *      окно, тот же язык устройства X;
 *   4. корень обязан увести на Y.
 *
 * «Перезапуск» именно так и моделируется: `storageState` старого
 * контекста — это ровно то, что webview поднимает с диска при следующем
 * запуске. Ничего из памяти страницы туда не попадает.
 *
 *   node scripts/check-remembered-locale.mjs --base=http://localhost:3124
 *   node scripts/check-remembered-locale.mjs --base=… --plant
 */
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const arg = (n, d) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = arg("base", "http://localhost:3124").replace(/\/$/, "");

/** Пары «язык устройства → что выбирает человек». Обе стороны, чтобы
 *  зелёный не достался простым совпадением с умолчанием. */
const CASES = [
  { device: "es", choose: "ru" },
  { device: "ru", choose: "es" },
];

const LOCALE_NAME = { es: /Español/, ru: /Русский/ };

function localeOf(url) {
  const path = new URL(url).pathname.split("/").filter(Boolean)[0];
  return path === "es" || path === "ru" ? path : null;
}

async function open(browser, device, storageState) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 780 },
    locale: device === "ru" ? "ru-RU" : "es-MX",
    extraHTTPHeaders: { "accept-language": device === "ru" ? "ru-RU,ru;q=0.9" : "es-MX,es;q=0.9" },
    ...(storageState ? { storageState } : {}),
  });
  return context;
}

/** Смена языка ровно тем путём, которым её делает человек на телефоне. */
async function chooseLocale(page, to) {
  // `:visible` обязателен: переключатель языка настольной шапки тоже
  // несёт `aria-expanded`, но при ширине телефона он скрыт, и первый по
  // порядку элемент — именно он.
  await page.locator("header button[aria-expanded]:visible").first().click();
  await page.waitForTimeout(400);
  await page.locator('button[aria-haspopup="menu"]:visible').first().click();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: LOCALE_NAME[to] }).first().click();
  await page.waitForURL(new RegExp(`/${to}(/|$)`), { timeout: 20000 });
  await page.waitForTimeout(800);
}

/**
 * `plant` ломает ПРОДУКТ между выбором и перезапуском, не трогая прибор:
 *   · "forget"  — запомненного значения не стало (поведение до правки);
 *   · "foreign" — запомнен ЧУЖОЙ язык.
 */
async function runCase(browser, { device, choose }, plant) {
  const problems = [];
  const facts = { device, choose };

  // --- Шаг 1: ничего не запомнено -------------------------------------
  const first = await open(browser, device);
  const page = await first.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  facts.firstLanding = localeOf(page.url());
  if (facts.firstLanding !== device) {
    problems.push(
      `устройство ${device}, ничего не запомнено: корень увёл на /${facts.firstLanding} вместо /${device} — ` +
        `прежнее поведение (Accept-Language) сломано`,
    );
  }

  // --- Шаг 2: человек выбирает другой язык ----------------------------
  await chooseLocale(page, choose);
  facts.afterChoice = localeOf(page.url());

  let state = await first.storageState();
  facts.remembered = state.cookies.find((c) => c.name === "rf-lang")?.value ?? null;
  if (plant === "forget") {
    state = { ...state, cookies: state.cookies.filter((c) => c.name !== "rf-lang") };
  }
  if (plant === "foreign") {
    state = {
      ...state,
      cookies: state.cookies.map((c) => (c.name === "rf-lang" ? { ...c, value: device } : c)),
    };
  }
  await first.close();

  // --- Шаг 3: ПЕРЕЗАПУСК ----------------------------------------------
  const second = await open(browser, device, state);
  const page2 = await second.newPage();
  await page2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page2.waitForTimeout(800);
  facts.afterRestart = localeOf(page2.url());
  if (facts.afterRestart !== choose) {
    problems.push(
      `устройство ${device}, выбран ${choose}: после перезапуска корень увёл на /${facts.afterRestart} — ` +
        `выбор языка не пережил закрытия приложения`,
    );
  }
  // И язык САМОЙ страницы, а не только адреса: адрес мог бы быть верным
  // при испанской разметке (ровно этот класс — 7.196, испанский на /ru).
  facts.htmlLang = await page2.getAttribute("html", "lang");
  if (facts.htmlLang !== choose) {
    problems.push(
      `устройство ${device}, выбран ${choose}: после перезапуска <html lang> равен «${facts.htmlLang}»`,
    );
  }
  await second.close();

  return { problems, facts };
}

async function runAll(browser, plant) {
  const problems = [];
  const lines = [];
  for (const c of CASES) {
    const { problems: p, facts } = await runCase(browser, c, plant);
    problems.push(...p);
    lines.push(
      `  ${p.length === 0 ? "ок  " : "ПЛОХО"} устройство ${facts.device}: корень → /${facts.firstLanding}, ` +
        `выбран ${facts.choose} → /${facts.afterChoice}, запомнено «${facts.remembered}», ` +
        `после перезапуска → /${facts.afterRestart} (lang=${facts.htmlLang})`,
    );
  }
  return { problems, lines };
}

export async function main() {
  const plant = argv.includes("--plant");
  const browser = await chromium.launch();
  try {
    if (!plant) {
      const { problems, lines } = await runAll(browser, null);
      for (const l of lines) console.log(l);
      if (problems.length) {
        console.error("ЗАПОМНЕННЫЙ ЯЗЫК:");
        for (const p of problems) console.error(`  ${p}`);
        return 1;
      }
      console.log(
        `check:remembered-locale — ${CASES.length} из ${CASES.length} направлений: выбранный язык пережил ` +
          `перезапуск, а при пустой памяти корень по-прежнему слушает Accept-Language. Подсадки — --plant.`,
      );
      return 0;
    }

    let ok = true;
    const negative = await runAll(browser, null);
    if (negative.problems.length) ok = false;
    console.log(`  ${negative.problems.length === 0 ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровый продукт (отрицательный контроль)`);
    for (const l of negative.lines) console.log(`      ${l.trim()}`);

    const plants = [
      ["память о языке пропала — поведение ДО правки, ровно жалоба владельца", "forget"],
      ["запомнен ЧУЖОЙ язык — подсадка чужого языка обязана ронять прогон", "foreign"],
    ];
    let caught = 0;
    for (const [name, mode] of plants) {
      const r = await runAll(browser, mode);
      const hit = r.problems.length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}${hit ? ` (${r.problems[0]})` : ""}`);
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:remembered-locale --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
        : `check:remembered-locale --plant — FAILED (${caught} из ${plants.length})`,
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
