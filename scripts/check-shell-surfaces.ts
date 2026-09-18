/**
 * ИМЕЕТ ЛИ ЭТО СМЫСЛ ВНУТРИ ПРИЛОЖЕНИЯ — долг 154, заход 7.212.
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Запись долга (12.09.2026, 7.184, снято владельцем с живого телефона):
 * «в подвале ВНУТРИ нативной оболочки висит ссылка „Скачать приложение“».
 * И там же сказано, что долг НЕ сводится к одной ссылке: он закрывается
 * ревизией ВСЕХ пунктов шапки, подвала и нижней навигации на вопрос
 * «имеет ли это смысл внутри оболочки», с решением по каждому.
 *
 * Ревизия 7.212 прошла по всем пунктам и нашла два места: саму ссылку
 * (её убрал ещё 7.193, долг 188) и САМУ СТРАНИЦУ `/download`, которая
 * осталась достижимой по адресу и внутри приложения предлагала
 * установить приложение. Остальные пункты внутри оболочки осмысленны, и
 * это решение, а не пропуск, — список `SENSIBLE_IN_SHELL` ниже назван
 * поимённо и с числом.
 *
 * ====================================================================
 * ЧТО СУДИТСЯ
 * ====================================================================
 *
 * 1. ВНУТРИ ОБОЛОЧКИ в шапке, подвале и нижней панели нет ни одной
 *    ссылки из списка «только для веба». В ВЕБЕ каждая из них ЕСТЬ —
 *    иначе «ноль в оболочке» доказывалось бы пустой страницей.
 * 2. Страница `/download` внутри оболочки не предлагает установку:
 *    подписей магазинов на ней нет ни одной, а заголовок — тот, который
 *    честен для этого места. В вебе — ровно наоборот.
 * 3. Пол переписи: ссылок в этих трёх рамах найдено не меньше
 *    `MIN_LINKS` на страницу, иначе прибор смотрел не туда.
 *
 * Подсадка (`--plant`) — в обе стороны: веб-ответ выдаётся за ответ
 * оболочки (тогда ссылки «только для веба» обязаны найтись) и наоборот
 * (тогда обязано пропасть то, что в вебе быть обязано).
 *
 *   npx tsx scripts/check-shell-surfaces.ts --base=http://localhost:3123
 *   npx tsx scripts/check-shell-surfaces.ts --base=… --plant
 */
import { chromium, type Browser } from "playwright";
import { isEntryPoint } from "../src/lib/entry-point";
import { nativeAccessCopy } from "../src/lib/native-access-copy";
import { readFileSync } from "node:fs";

/**
 * Словарь читается ФАЙЛОМ, а не через `getDictionary`: тот модуль тянет
 * за собой серверную половину Next (`server-only`), и сторож обязан
 * судить о проверяемом, ничего лишнего из него не исполняя — тот же
 * довод, по которому `check-native-shell-render.mjs` достаёт токен
 * текстом.
 */
function downloadLabels(lang: string): { iosCta: string; androidCta: string; comingSoonLabel: string } {
  const dict = JSON.parse(readFileSync(`src/dictionaries/${lang}.json`, "utf8")) as {
    download: { iosCta: string; androidCta: string; comingSoonLabel: string };
  };
  return dict.download;
}

const TOKEN = "RFNativeShell";
const COOKIE = "rf_native_shell";
const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/**
 * Маршруты, которым внутри приложения места нет, и причина у каждого своя.
 * Список закрытый: появление третьего — повод для решения, а не для
 * молчания.
 */
const WEB_ONLY = [
  // Долг 179: платных входов внутри оболочки нет ни одного.
  { path: "/pricing", why: "вход в оплату — Google Play запрещает уводить на внешнюю оплату" },
  // Долг 188/154: предлагать установить то, что установлено.
  { path: "/download", why: "предложение установить приложение тому, кто уже в приложении" },
];

/**
 * Пункты рам, осмысленные ВНУТРИ оболочки, — решение по каждому, а не
 * пропуск. Число рядом: список закрытый, и новый пункт рамы обязан быть
 * сюда вписан вместе с ответом на вопрос «а внутри приложения он зачем».
 */
const SENSIBLE_IN_SHELL = [
  "/", "/courses", "/stories", "/vocabulary", "/glossary", "/word-games",
  "/media", "/groups", "/profile", "/login", "/sobre-nosotros", "/terms", "/privacy", "/admin",
];
const SENSIBLE_COUNT = 14;

const PATHS = ["/", "/courses", "/vocabulary", "/stories"];
const LANGS = ["ru", "es"] as const;
const MIN_LINKS = 8;

/** Ссылки трёх рам: шапка, подвал, нижняя панель. Тело страницы — не рама. */
async function frameLinks(browser: Browser, base: string, lang: string, path: string, shell: boolean): Promise<string[]> {
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    userAgent: shell ? `${SAFARI} ${TOKEN}` : SAFARI,
  });
  if (shell) await context.addCookies([{ name: COOKIE, value: "1", url: base }]);
  const page = await context.newPage();
  try {
    await page.goto(`${base}/${lang}${path === "/" ? "" : path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(400);
    return await page.$$eval("header a[href], footer a[href], nav a[href]", (els) =>
      els.map((el) => el.getAttribute("href") ?? ""),
    );
  } finally {
    await context.close();
  }
}

async function downloadPage(browser: Browser, base: string, lang: string, shell: boolean): Promise<string> {
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    userAgent: shell ? `${SAFARI} ${TOKEN}` : SAFARI,
  });
  if (shell) await context.addCookies([{ name: COOKIE, value: "1", url: base }]);
  const page = await context.newPage();
  try {
    await page.goto(`${base}/${lang}/download`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(300);
    return await page.locator("body").innerText();
  } finally {
    await context.close();
  }
}

export interface Snapshot {
  lang: string;
  path: string;
  webLinks: string[];
  shellLinks: string[];
}

export interface PageSnapshot {
  lang: string;
  webText: string;
  shellText: string;
  storeLabels: string[];
  shellHeading: string;
}

export function problemsOf(frames: Snapshot[], pages: PageSnapshot[]): string[] {
  const problems: string[] = [];
  if (frames.length === 0 || pages.length === 0) {
    problems.push("переписи не пришло ни одной страницы — «нарушений 0» доказано пустой выборкой");
    return problems;
  }
  if (SENSIBLE_IN_SHELL.length !== SENSIBLE_COUNT) {
    problems.push(`список осмысленных внутри оболочки пунктов вырос до ${SENSIBLE_IN_SHELL.length} при ожидаемых ${SENSIBLE_COUNT}`);
  }
  for (const f of frames) {
    if (f.webLinks.length < MIN_LINKS || f.shellLinks.length < MIN_LINKS) {
      problems.push(`${f.lang}${f.path}: ссылок в рамах ${f.webLinks.length} в вебе и ${f.shellLinks.length} в оболочке при поле ${MIN_LINKS} — прибор ослеп`);
      continue;
    }
    for (const { path, why } of WEB_ONLY) {
      const inShell = f.shellLinks.filter((h) => h.endsWith(path)).length;
      const inWeb = f.webLinks.filter((h) => h.endsWith(path)).length;
      if (inShell > 0) problems.push(`${f.lang}${f.path}: в рамах ОБОЛОЧКИ ${inShell} ссыл. на ${path} — ${why}`);
      if (inWeb === 0) problems.push(`${f.lang}${f.path}: в рамах ВЕБА ссылок на ${path} ноль — значит «ноль в оболочке» ничего не доказывает`);
    }
    for (const href of f.shellLinks) {
      const route = href.replace(/^\/(ru|es)/, "").replace(/[?#].*$/, "") || "/";
      if (!SENSIBLE_IN_SHELL.includes(route) && !WEB_ONLY.some((w) => w.path === route)) {
        problems.push(`${f.lang}${f.path}: в раме оболочки пункт «${route}», которого нет ни в одном из двух списков — решения по нему нет`);
      }
    }
  }
  for (const p of pages) {
    for (const label of p.storeLabels) {
      if (p.shellText.includes(label)) problems.push(`${p.lang}/download: внутри оболочки предложена установка — «${label}»`);
      if (!p.webText.includes(label)) problems.push(`${p.lang}/download: в ВЕБЕ подписи «${label}» нет — значит её отсутствие в оболочке ничего не доказывает`);
    }
    if (!p.shellText.includes(p.shellHeading)) problems.push(`${p.lang}/download: внутри оболочки нет честного заголовка «${p.shellHeading}»`);
    if (p.webText.includes(p.shellHeading)) problems.push(`${p.lang}/download: заголовок оболочки доехал до веба`);
  }
  return problems;
}

export async function main(): Promise<number> {
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  if (!baseArg) {
    console.error("нужен --base=http://… — этой проверке нечего открывать без сервера");
    return 1;
  }
  const base = baseArg.slice("--base=".length);
  const plant = process.argv.includes("--plant");

  const browser = await chromium.launch();
  const frames: Snapshot[] = [];
  const pages: PageSnapshot[] = [];
  try {
    for (const lang of LANGS) {
      for (const path of PATHS) {
        frames.push({
          lang,
          path,
          webLinks: await frameLinks(browser, base, lang, path, false),
          shellLinks: await frameLinks(browser, base, lang, path, true),
        });
      }
      const labels = downloadLabels(lang);
      pages.push({
        lang,
        webText: await downloadPage(browser, base, lang, false),
        shellText: await downloadPage(browser, base, lang, true),
        storeLabels: [labels.iosCta, labels.androidCta, labels.comingSoonLabel],
        shellHeading: nativeAccessCopy(lang).download.heading,
      });
    }
  } finally {
    await browser.close();
  }

  if (plant) {
    const results: Array<readonly [string, boolean]> = [
      [
        "ответ веба выдан за ответ оболочки — ссылки «только для веба» вернулись",
        problemsOf(frames.map((f) => ({ ...f, shellLinks: f.webLinks })), pages).length > 0,
      ],
      [
        "ответ оболочки выдан за ответ веба — доказывать стало нечем",
        problemsOf(frames.map((f) => ({ ...f, webLinks: f.shellLinks })), pages).length > 0,
      ],
      [
        "страница установки вернулась внутрь приложения",
        problemsOf(frames, pages.map((p) => ({ ...p, shellText: p.webText }))).length > 0,
      ],
      [
        "честный заголовок уехал в веб",
        problemsOf(frames, pages.map((p) => ({ ...p, webText: `${p.webText} ${p.shellHeading}` }))).length > 0,
      ],
      ["выборка пуста", problemsOf([], []).length > 0],
      ["отрицательный контроль: живая отдача чиста", problemsOf(frames, pages).length === 0],
    ];
    for (const [name, ok] of results) console.log(`  ${ok ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    const ok = results.every(([, r]) => r);
    console.log(ok ? `check:shell-surfaces --plant — подсадок ${results.length - 1} из ${results.length - 1}, отрицательный контроль 1 из 1` : "check:shell-surfaces --plant — FAILED");
    return ok ? 0 : 1;
  }

  const problems = problemsOf(frames, pages);
  if (problems.length) {
    console.error("ВНУТРИ ПРИЛОЖЕНИЯ ЕСТЬ ТО, ЧЕГО ТАМ БЫТЬ НЕ ДОЛЖНО (долг 154):");
    for (const p of problems.slice(0, 30)) console.error(`  ${p}`);
    return 1;
  }
  const links = frames.reduce((s, f) => s + f.webLinks.length + f.shellLinks.length, 0);
  console.log(
    `check:shell-surfaces — страниц ${frames.length} × 2 места, пунктов рам ${links}, ` +
      `маршрутов «только для веба» ${WEB_ONLY.length}, осмысленных внутри оболочки ${SENSIBLE_COUNT}: нарушений 0.`,
  );
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
