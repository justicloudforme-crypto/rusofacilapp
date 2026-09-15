/**
 * ПОСЛЕ ВЫХОДА НЕ ОСТАЁТСЯ НИ СЕССИИ, НИ ЛИЧНОЙ КОПИИ СТРАНИЦЫ
 * (заход 7.198, часть 1).
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Жалоба владельца, снятая посекундно на POCO X6 Pro: «Cerrar sesión» →
 * экран входа → закрыть приложение из «Недавних» → открыть с иконки →
 * приложение открылось ПОД АККАУНТОМ.
 *
 * Владелец назвал две возможные причины и попросил опровергнуть неверную
 * числом. Обе проверены, и ответ у них РАЗНЫЙ:
 *
 *   (а) «выход не удаляет сессионную куку». Про сервер — неверно.
 *       Ответ боевого прода на `POST /api/auth/logout`, снят 15.09.2026:
 *           set-cookie: session=; Path=/; Expires=Thu, 01 Jan 1970 …
 *       Путь `/` тот же, что у выданной куки. Причина оказалась ниже
 *       уровня сайта — в записи хранилища кук webview на диск, и чинится
 *       она в оболочке (`MainActivity.onPause`, сторож
 *       `npm run check:shell-session-locale`).
 *   (б) «страница пришла из закешированной копии». ЭТОТ случай не
 *       объясняет: страницы у воркера `NetworkFirst`, при живой сети
 *       побеждает сеть. Но САМ ДЕФЕКТ настоящий и живёт здесь: выход
 *       менял ответ сервера и не трогал ни одной копии страниц вошедшего
 *       человека, уже сложенных воркером в кеш. Офлайн они всплывают — с
 *       его именем в шапке и его данными в профиле.
 *
 * Поэтому проверок ДВЕ, и ронять их обязаны РАЗНЫЕ подсадки: «кука
 * уцелела» и «страница пришла из кеша» — это разные дефекты, и сторож,
 * который ловит их одним утверждением, ничего не различает.
 *
 * ====================================================================
 * ЧТО МЕРЯЕТСЯ, И ПОЧЕМУ БЕЗ ПОЛОЖИТЕЛЬНОГО КОНТРОЛЯ ЭТО НЕ СЧИТАЕТСЯ
 * ====================================================================
 *
 * «Личных копий после выхода 0» — утверждение, которое легче всего
 * получить, не умея их находить вовсе. Поэтому ДО выхода прогон обязан
 * найти их числом: завести настоящий аккаунт, открыть три страницы,
 * дождаться воркера и предъявить копии с личным признаком внутри. Ноль
 * копий ДО выхода — это не зелёный прогон, а сломанный прибор, и сторож
 * говорит об этом прямо.
 *
 *   node scripts/check-signed-out.mjs --base=http://localhost:3124
 *   node scripts/check-signed-out.mjs --base=… --plant
 */
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const arg = (n, d) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = arg("base", "http://localhost:3124").replace(/\/$/, "");
const LOCALES = ["es", "ru"];

/** Имена семейств кешей документов. Литералы, а не импорт из
 *  `src/lib/signed-out.ts`: сторож обязан судить о продукте, ничего у
 *  него не заимствуя — то же правило, по которому литералами написаны
 *  `appId` и токен оболочки в `capacitor.config.ts`. */
const PAGE_CACHE_PREFIX = "rf-pages";
const LEGACY_PAGE_CACHES = ["pages", "pages-rsc", "pages-rsc-prefetch", "others"];

const isPageCache = (name) => LEGACY_PAGE_CACHES.includes(name) || name.startsWith(PAGE_CACHE_PREFIX);

/** Перепись кешей документов на живом источнике: сколько записей и какие. */
const CENSUS = `(async () => {
  const prefix = ${JSON.stringify(PAGE_CACHE_PREFIX)};
  const legacy = ${JSON.stringify(LEGACY_PAGE_CACHES)};
  const out = [];
  for (const name of await caches.keys()) {
    if (!legacy.includes(name) && !name.startsWith(prefix)) continue;
    const cache = await caches.open(name);
    for (const request of await cache.keys()) out.push({ cache: name, url: request.url });
  }
  return out;
})()`;

/** Есть ли в копии личный признак — почта заведённого аккаунта. */
const PERSONAL_IN_CACHE = (needle) => `(async () => {
  const prefix = ${JSON.stringify(PAGE_CACHE_PREFIX)};
  const legacy = ${JSON.stringify(LEGACY_PAGE_CACHES)};
  let hits = 0;
  for (const name of await caches.keys()) {
    if (!legacy.includes(name) && !name.startsWith(prefix)) continue;
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const res = await cache.match(request);
      if (!res) continue;
      const text = await res.clone().text().catch(() => "");
      if (text.includes(${JSON.stringify(needle)})) hits += 1;
    }
  }
  return hits;
})()`;

async function waitForWorker(page) {
  await page
    .waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, {
      timeout: 25_000,
    })
    .catch(() => {});
}

/** Настоящий аккаунт: та же регистрация, что у человека. Куки ложатся в
 *  жар контекста, потому что запрос идёт ЕГО же транспортом. */
async function register(context, lang) {
  const email = `signedout-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const res = await context.request.post(`${BASE}/api/auth/register`, {
    form: { email, password: "TestPass123!", lang, redirectTo: `/${lang}` },
    maxRedirects: 0,
  });
  if (res.status() !== 303 && res.status() !== 302) {
    throw new Error(
      `POST /api/auth/register ответил ${res.status()} — сервер поднят без E2E_TEST_SEED=1? ` +
        `Тогда кука уходит с Secure и по http не возвращается, и мерить было бы нечего.`,
    );
  }
  return email;
}

async function sessionCookie(context) {
  const all = await context.cookies();
  return all.find((c) => c.name === "session" && c.value) ?? null;
}

/**
 * Один полный прогон по одной локали.
 *
 * `plant` — способ сломать ПРОДУКТ после выхода, не трогая прибор:
 *   · "cookie" — вернуть сессионную куку (жалоба «а»);
 *   · "cache"  — вернуть личную копию страницы в кеш (жалоба «б»).
 */
async function runLocale(browser, lang, plant) {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await context.newPage();
  const problems = [];
  const facts = {};

  await page.goto(`${BASE}/${lang}`, { waitUntil: "domcontentloaded" });
  await waitForWorker(page);

  const email = await register(context, lang);
  facts.email = email;

  // Три страницы вошедшего человека, чтобы воркеру было что запомнить.
  for (const path of [`/${lang}`, `/${lang}/profile`, `/${lang}/vocabulary`]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(1200);

  // --- ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ ДО ВЫХОДА ------------------------------
  const before = await page.evaluate(CENSUS);
  const personalBefore = await page.evaluate(PERSONAL_IN_CACHE(email));
  facts.cachedBefore = before.length;
  facts.personalBefore = personalBefore;
  if (before.length === 0) {
    problems.push(
      `${lang}: до выхода в кешах документов 0 записей — воркер ничего не сложил, ` +
        `и «после выхода 0» означало бы сломанный прибор, а не чистый кеш`,
    );
  }
  if (personalBefore === 0) {
    problems.push(
      `${lang}: ни в одной копии нет личного признака (почты аккаунта) — прибор не умеет находить то, ` +
        `отсутствие чего он потом объявит результатом`,
    );
  }
  const sessionBefore = await sessionCookie(context);
  if (!sessionBefore) {
    problems.push(`${lang}: до выхода сессионной куки нет — мерить выход не на чем`);
  }

  // --- ВЫХОД ----------------------------------------------------------
  const logout = context.request;
  const res = await logout.post(`${BASE}/api/auth/logout`, { form: { lang }, maxRedirects: 0 });
  facts.logoutStatus = res.status();
  facts.logoutLocation = res.headers()["location"] ?? "";
  if (res.status() !== 303) {
    problems.push(`${lang}: POST /api/auth/logout ответил ${res.status()} вместо 303`);
  }
  // Ровно тот переход, который делает браузер после формы: по адресу из
  // `Location`. Признак уборки живёт в нём, и открыть «просто /${lang}»
  // значило бы мерить не тот переход.
  const target = facts.logoutLocation.startsWith("http")
    ? facts.logoutLocation
    : `${BASE}${facts.logoutLocation}`;
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // --- ПОДСАДКИ: ломается ПРОДУКТ, а не прибор -------------------------
  if (plant === "cookie") {
    await context.addCookies([
      {
        name: sessionBefore.name,
        value: sessionBefore.value,
        domain: sessionBefore.domain,
        path: sessionBefore.path,
      },
    ]);
  }
  if (plant === "cache") {
    await page.evaluate(
      async ([cacheName, url, body]) => {
        const cache = await caches.open(cacheName);
        await cache.put(
          new Request(url),
          new Response(body, { status: 200, headers: { "content-type": "text/html" } }),
        );
      },
      [`${PAGE_CACHE_PREFIX}-others-planted`, `${BASE}/${lang}/profile`, `<html><body>${email}</body></html>`],
    );
  }

  // --- УТВЕРЖДЕНИЕ 1: СЕССИИ НЕТ ---------------------------------------
  const sessionAfter = await sessionCookie(context);
  facts.sessionAfter = sessionAfter ? sessionAfter.value.slice(0, 12) + "…" : null;
  if (sessionAfter) {
    problems.push(
      `${lang}: после выхода сессионная кука уцелела (${facts.sessionAfter}) — ` +
        `следующий запуск поднимет сессию без ввода пароля`,
    );
  }
  // И ответ сервера на личную страницу — тоже без аккаунта.
  const profile = await context.request.get(`${BASE}/${lang}/profile`, { maxRedirects: 0 });
  facts.profileStatus = profile.status();
  const profileBody = profile.status() === 200 ? await profile.text() : "";
  if (profileBody.includes(email)) {
    problems.push(`${lang}: сервер отдал личные данные на ${BASE}/${lang}/profile после выхода`);
  }

  // --- УТВЕРЖДЕНИЕ 2: ЛИЧНЫХ КОПИЙ НЕТ ---------------------------------
  const after = await page.evaluate(CENSUS);
  const personalAfter = await page.evaluate(PERSONAL_IN_CACHE(email));
  facts.cachedAfter = after.length;
  facts.personalAfter = personalAfter;
  if (personalAfter > 0) {
    problems.push(
      `${lang}: после выхода в кеше осталось ${personalAfter} копи${personalAfter === 1 ? "я" : "й"} ` +
        `с личными данными прежнего пользователя — офлайн он увидит их снова`,
    );
  }
  // ПОЧЕМУ УТВЕРЖДЕНИЕ НЕ «КЕШИ ПУСТЫ». Первая редакция требовала ровно
  // этого и была красной на здоровом продукте: замер 15.09.2026 на
  // собранной сборке — 43 записи до выхода, 5 после. Эти пять появляются
  // ПОСЛЕ уборки и принадлежат уже гостевой странице, на которую увёл сам
  // выход (её RSC-предвыборка). Требовать от них исчезновения значит
  // требовать, чтобы сайт после выхода перестал работать.
  //
  // Правило поэтому про СОДЕРЖИМОЕ, а не про счётчик: личных копий ноль.
  // Счётчик остаётся фактом в отчёте — он показывает, что уборка была.
  facts.leftovers = after.filter((e) => isPageCache(e.cache)).length;
  if (facts.cachedBefore > 0 && facts.cachedAfter >= facts.cachedBefore) {
    problems.push(
      `${lang}: записей в кешах документов после выхода не убавилось ` +
        `(${facts.cachedBefore} → ${facts.cachedAfter}) — уборка не выполнялась вовсе`,
    );
  }

  // --- УТВЕРЖДЕНИЕ 3: ОФЛАЙН ЛИЧНОГО НЕ ПОКАЗЫВАЕТ ----------------------
  await context.setOffline(true);
  await page.goto(`${BASE}/${lang}/profile`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(600);
  const offlineText = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
  facts.offlineChars = offlineText.length;
  if (offlineText.includes(email)) {
    problems.push(`${lang}: офлайн после выхода на экране всё ещё личные данные прежнего пользователя`);
  }
  await context.setOffline(false);

  await context.close();
  return { problems, facts };
}

async function runAll(browser, plant) {
  const problems = [];
  const lines = [];
  for (const lang of LOCALES) {
    const { problems: p, facts } = await runLocale(browser, lang, plant);
    problems.push(...p);
    lines.push(
      `  ${p.length === 0 ? "ок  " : "ПЛОХО"} ${lang}: копий до выхода ${facts.cachedBefore} ` +
        `(с личным признаком ${facts.personalBefore}), после ${facts.cachedAfter} ` +
        `(с личным признаком ${facts.personalAfter}); кука после выхода ${facts.sessionAfter ?? "нет"}; ` +
        `офлайн-экран ${facts.offlineChars} знаков`,
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
        console.error("ВЫХОД ИЗ АККАУНТА:");
        for (const p of problems) console.error(`  ${p}`);
        return 1;
      }
      console.log(
        `check:signed-out — ${LOCALES.length} из ${LOCALES.length} локалей: после выхода сессионной куки нет, ` +
          `сервер личного не отдаёт, личных копий в кешах документов 0, офлайн-экран личного не показывает. ` +
          `Всё это — после положительного контроля «копии были». Подсадки — --plant.`,
      );
      return 0;
    }

    let ok = true;
    const negative = await runAll(browser, null);
    if (negative.problems.length) ok = false;
    console.log(`  ${negative.problems.length === 0 ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровый продукт (отрицательный контроль)`);
    for (const l of negative.lines) console.log(`      ${l.trim()}`);

    const plants = [
      ["кука уцелела — жалоба «а»", "cookie", /сессионная кука уцелела/],
      ["страница пришла из кеша — жалоба «б»", "cache", /в кеше осталось/],
    ];
    let caught = 0;
    for (const [name, mode, shape] of plants) {
      const r = await runAll(browser, mode);
      const hit = r.problems.some((p) => shape.test(p));
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}${hit ? ` (${r.problems.find((p) => shape.test(p))})` : ""}`);
      // Подсадки обязаны ронять РАЗНЫЕ утверждения: одна проверка на оба
      // случая не годится, и это проверяется здесь же.
      const other = plants.find(([, m]) => m !== mode)[2];
      if (r.problems.some((p) => other.test(p))) {
        console.log("      · но она уронила и ЧУЖОЕ утверждение — значит они не разделены");
        ok = false;
      }
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:signed-out --plant — ${caught} из ${plants.length} подсадок, каждая роняет СВОЁ утверждение, ` +
            `1 из 1 отрицательный контроль`
        : `check:signed-out --plant — FAILED (${caught} из ${plants.length})`,
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
