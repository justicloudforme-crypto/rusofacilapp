// ДОКАЗАТЬ, ЧТО ОБОЛОЧКА ПОКАЗАЛА СТРАНИЦУ, А НЕ ПУСТОТУ — настоящим
// браузером, под настоящим User-Agent оболочки.
//
// ЗАЧЕМ ОТДЕЛЬНО ОТ check:rendered. `check:rendered` ходит под User-Agent
// Pixel 5 и видит ВЕБ-ответ. Оболочка с 12.09.2026 (долг 79) получает от
// сервера ДРУГОЙ ответ: сервер узнаёт её по токену в User-Agent и отдаёт
// страницу цен нативной витриной вместо веб-кассы. Значит существует
// поверхность, которую не меряет никто: HTML, который видят только
// установившие приложение. Класс отказа на ней тот же, что у инцидента
// №1 — код 200, правильный HTML, пустой экран, — только заметить его
// некому: у приложения нет ни адресной строки, ни «посмотреть исходный
// код», а жалоб ученик не пишет.
//
// ДВА УТВЕРЖДЕНИЯ, и они про разное.
//
// 1. ЭКРАН ОШИБКИ (`capacitor-shell/error.html`) открывается и показывает
//    РОВНО три видимые строки, все на языке устройства, и ни одной
//    английской. Открывается по `file://` — именно так его грузит webview
//    (локальный адрес, без сети, без Next.js, без словаря приложения).
//    Набор видимого текста сличается ЦЕЛИКОМ, а не «содержит»: добавленная
//    мимо словаря четвёртая строка — и есть тот способ, которым на этот
//    экран попадёт английский.
//    Отдельно проверяется кнопка: нажатие обязано вести на боевой адрес.
//    Это не придирка — до 13.09.2026 там стоял `location.reload()`, и
//    кнопка перезагружала сам экран ошибки, то есть не повторяла ничего.
//
// 2. ЖИВАЯ СТРАНИЦА под User-Agent оболочки отрисована: код 200, h1 на
//    месте, ссылок не ноль, текста отказа нет. И проверяется, что токен
//    действительно уехал в запросе, — иначе мерился бы веб.
//
// Контроли встроены и обязательны (ПРАВИЛА ЗАМЕРА 4.1): три подсадки, и
// каждая изображает свой способ соврать — пустой экран, английская строка
// на экране ошибки, кнопка без адреса.
//
//   node scripts/check-native-shell-render.mjs --base=http://localhost:3123
//   node scripts/check-native-shell-render.mjs --base=… --ci
import { chromium, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "https://rusofacilapp.com").replace(/\/$/, "");
const CI_MODE = argv.includes("--ci");

const ERROR_PAGE = path.resolve("capacitor-shell/error.html");
const ERROR_PAGE_URL = pathToFileURL(ERROR_PAGE).href;

/** Токен читается из `src/lib/shell-tag.ts` ТЕКСТОМ, а не импортом: тот
 *  модуль — TypeScript, этот файл — .mjs, и сторож обязан судить о
 *  проверяемом, ничего из него не исполняя. Что три литерала токена в
 *  репозитории совпадают между собой — отдельное правило
 *  (`npm run check:native-shell`). */
function shellToken() {
  const m = readFileSync("src/lib/shell-tag.ts", "utf8").match(/NATIVE_SHELL_UA_TOKEN = "([^"]+)"/);
  if (!m) throw new Error("в src/lib/shell-tag.ts не найден литерал токена оболочки");
  return m[1];
}

const TOKEN = shellToken();
const PIXEL = devices["Pixel 5"];
const SHELL_UA = `${PIXEL.userAgent} ${TOKEN}`;

/** Видимый текст экрана ошибки, по локалям. Ожидается РОВНО это — ни
 *  больше, ни меньше. Строки написаны здесь заново, а не прочитаны из
 *  проверяемого файла: сторож, читающий ожидание из того же файла, который
 *  проверяет, согласен с любой правкой и не стережёт ничего. */
const EXPECTED_ERROR_TEXT = {
  es: [
    "No pudimos abrir la aplicación",
    "El servidor no respondió o tu teléfono no tiene conexión a internet. Revisa tu conexión y vuelve a intentarlo.",
    "Reintentar",
  ],
  ru: [
    "Не удалось открыть приложение",
    "Сервер не ответил или на телефоне нет соединения с интернетом. Проверьте соединение и попробуйте снова.",
    "Повторить",
  ],
};

/** Страницы живого сервера, которые обязаны отрисоваться под оболочкой.
 *  Две, а не тридцать: вопрос здесь не «все ли страницы целы» (на него
 *  отвечает check:rendered), а «доходит ли до оболочки вообще хоть что-то
 *  и то же ли это, что видит веб». */
const SHELL_PAGES = [
  { path: "/es", minLinks: 3 },
  { path: "/ru", minLinks: 3 },
];

/** Слова, по которым узнаётся текст отказа — те же, что у check:rendered. */
const BOUNDARY = /Something went wrong|Algo salió mal|Что-то пошло не так/i;

async function readErrorScreen(browser, locale, breakIt) {
  const ctx = await browser.newContext({ ...PIXEL, locale });
  const page = await ctx.newPage();
  const navigations = [];
  // Кнопка уводит на боевой адрес; сети у этого прогона для него нет и не
  // нужно — попытка перехватывается и отменяется, важен сам адрес.
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("http")) {
      navigations.push(url);
      return route.abort();
    }
    return route.continue();
  });
  if (breakIt) await breakIt(page);
  await page.goto(ERROR_PAGE_URL, { waitUntil: "load" });

  const visible = await page.evaluate(() => {
    const out = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const t = child.textContent.trim();
          if (t) out.push(t);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;
          if (child.getAttribute("aria-hidden") === "true") continue;
          walk(child);
        }
      }
    };
    walk(document.body);
    return out;
  });

  const htmlLang = await page.getAttribute("html", "lang");
  await page.locator("#retry").click().catch(() => {});
  await page.waitForTimeout(300);
  await page.close();
  await ctx.close();
  return { visible, htmlLang, navigations };
}

function judgeErrorScreen(locale, { visible, htmlLang, navigations }, expectedRetry) {
  const problems = [];
  const expected = EXPECTED_ERROR_TEXT[locale];
  if (JSON.stringify(visible) !== JSON.stringify(expected)) {
    problems.push(
      `видимый текст экрана ошибки под локалью ${locale} не тот, что задуман.\n` +
        `          ожидалось ${expected.length}: ${JSON.stringify(expected)}\n` +
        `          получено  ${visible.length}: ${JSON.stringify(visible)}`,
    );
  }
  if (htmlLang !== locale) {
    problems.push(`<html lang> под локалью ${locale} равен «${htmlLang}» — экран говорит не на языке устройства`);
  }
  // Сравнение по нормализованному адресу: браузер дописывает к
  // «https://rusofacilapp.com» завершающий слэш, и дословное сличение
  // объявляло бы рабочую кнопку сломанной.
  const sameTarget = (a, b) => a.replace(/\/$/, "") === b.replace(/\/$/, "");
  if (!navigations.some((u) => sameTarget(u, expectedRetry))) {
    problems.push(
      `нажатие «Повторить» не повело на ${expectedRetry} (попыток перехода: ` +
        `${navigations.length ? navigations.join(", ") : "ни одной"}). ` +
        `Кнопка, которая ничего не повторяет, хуже отсутствующей.`,
    );
  }
  return problems;
}

async function inspectShellPage(browser, page_, breakIt) {
  const ctx = await browser.newContext({ ...PIXEL, userAgent: SHELL_UA });
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(`uncaught: ${String(e).slice(0, 120)}`));
  if (breakIt) await breakIt(page);

  const res = await page
    .goto(BASE + page_.path, { waitUntil: "networkidle", timeout: 60_000 })
    .catch((e) => {
      problems.push(`navigation: ${e.message.slice(0, 100)}`);
      return null;
    });
  await page.waitForTimeout(1200);

  const status = res?.status() ?? 0;
  if (status !== 200) problems.push(`http ${status}`);

  // Токен обязан быть В ЗАПРОСЕ, иначе мерился бы веб, а не оболочка.
  const ua = await page.evaluate(() => navigator.userAgent).catch(() => "");
  if (!ua.includes(TOKEN)) problems.push(`запрос ушёл БЕЗ токена оболочки «${TOKEN}» — измерен веб, а не приложение`);

  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (BOUNDARY.test(bodyText)) problems.push("на экране текст отказа");
  if (bodyText.trim().length < 80) problems.push(`видимого текста ${bodyText.trim().length} знаков — это пустота, а не страница`);

  const h1 = (await page.locator("h1").first().textContent().catch(() => null))?.trim() ?? "";
  if (!h1) problems.push("h1 отсутствует");

  const links = await page.locator(`a[href^="${page_.path}/"]`).count().catch(() => 0);
  if (links < page_.minLinks) problems.push(`${links} из ≥${page_.minLinks} ссылок`);

  await page.close();
  await ctx.close();
  return { problems, chars: bodyText.trim().length, h1, links };
}

async function main() {
  const browser = await chromium.launch();
  let failures = 0;
  try {
    console.log("\n=== экран ошибки оболочки, настоящий браузер, file:// ===");
    const retryTarget = (() => {
      const m = readFileSync("capacitor-shell/error.html", "utf8").match(/var SITE_URL = "([^"]+)"/);
      return m ? m[1] : null;
    })();
    if (!retryTarget) {
      console.log("  FAIL  в error.html нет адреса кнопки «Повторить»");
      failures += 1;
    }
    for (const locale of ["es", "ru"]) {
      const read = await readErrorScreen(browser, locale);
      const problems = judgeErrorScreen(locale, read, retryTarget);
      failures += problems.length ? 1 : 0;
      console.log(`  ${problems.length ? "FAIL" : "ok  "}  локаль ${locale}: ${read.visible.length} видимых строк, lang=${read.htmlLang}`);
      problems.forEach((p) => console.log(`          → ${p}`));
    }

    console.log(`\n=== ${BASE} под User-Agent оболочки («…${TOKEN}») ===`);
    for (const p of SHELL_PAGES) {
      const { problems, chars, h1, links } = await inspectShellPage(browser, p);
      failures += problems.length ? 1 : 0;
      console.log(
        `  ${problems.length ? "FAIL" : "ok  "}  ${p.path.padEnd(6)} ${chars} знаков, h1 «${h1.slice(0, 30)}», ссылок ${links}`,
      );
      problems.forEach((c) => console.log(`          → ${c}`));
    }

    console.log("\n=== позитивный контроль: сторож обязан покраснеть ===");
    let caught = 0;
    const controls = [];

    controls.push([
      "страница оболочки опустела после гидратации",
      async () => {
        const { problems } = await inspectShellPage(browser, SHELL_PAGES[0], async (page) => {
          await page.addInitScript(() => {
            addEventListener("load", () => setTimeout(() => document.body.replaceChildren(), 300));
          });
        });
        return problems.length > 0 ? problems[0] : null;
      },
    ]);

    controls.push([
      "на экране ошибки появилась английская строка",
      async () => {
        const read = await readErrorScreen(browser, "es", async (page) => {
          await page.addInitScript(() => {
            addEventListener("load", () => {
              const p = document.createElement("p");
              p.textContent = "Something went wrong. Please try again later.";
              document.body.append(p);
            });
          });
        });
        const problems = judgeErrorScreen("es", read, retryTarget);
        return problems.length > 0 ? problems[0].split("\n")[0] : null;
      },
    ]);

    controls.push([
      "у кнопки «Повторить» отобрали обработчик — она больше ничего не повторяет",
      async () => {
        const read = await readErrorScreen(browser, "es", async (page) => {
          await page.addInitScript(() => {
            addEventListener("load", () => {
              const button = document.getElementById("retry");
              if (button) button.replaceWith(button.cloneNode(true));
            });
          });
        });
        const problems = judgeErrorScreen("es", read, retryTarget);
        return problems.length > 0 ? problems[0].split("\n")[0] : null;
      },
    ]);

    controls.push([
      "запрос ушёл БЕЗ токена оболочки — это веб, и сторож обязан это заметить",
      async () => {
        const ctx = await browser.newContext({ ...PIXEL });
        const page = await ctx.newPage();
        let ua = "";
        try {
          await page.goto(BASE + SHELL_PAGES[0].path, { waitUntil: "domcontentloaded", timeout: 60_000 });
          ua = await page.evaluate(() => navigator.userAgent);
        } catch {
          // Сервер не ответил: тогда судить о токене не по чему, и контроль
          // обязан считаться ПРОПУЩЕННЫМ, а не пройденным.
          await ctx.close();
          return null;
        }
        await ctx.close();
        return ua.includes(TOKEN) ? null : "User-Agent без токена опознан как веб";
      },
    ]);

    for (const [label, run] of controls) {
      const found = await run();
      caught += found ? 1 : 0;
      console.log(`  ${found ? "поймано" : "ПРОПУЩЕНО"}  ${label}${found ? ` → ${found}` : ""}`);
    }
    console.log(`  подсажено ${controls.length}, поймано ${caught}`);
    if (caught !== controls.length) failures += 1;

    console.log(`\nутверждений с проблемами: ${failures}${CI_MODE ? " (режим --ci)" : ""}`);
    process.exitCode = failures ? 1 : 0;
  } finally {
    await browser.close();
  }
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
