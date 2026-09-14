/**
 * ПЛАТНЫХ ОРГАНОВ УПРАВЛЕНИЯ НЕТ НА ОТРИСОВАННОМ ЭКРАНЕ — ВТОРАЯ
 * ПОЛОВИНА ДОЛГА 191.
 *
 * ====================================================================
 * ПОЧЕМУ ОДНОГО СЕРВЕРНОГО ОТВЕТА НЕ ХВАТАЕТ. ЧИСЛОМ.
 * ====================================================================
 *
 * `check-native-payments.mjs --base=…` спрашивает СЕРВЕР и судит по
 * ВИДИМОМУ документу его ответа. Кнопка «Оформить подписку», которую
 * владелец нашёл в словаре и в идиомах, в этом ответе не существует
 * вовсе:
 *
 *   * в сыром HTML `/ru/vocabulary` строка «Оформить подписку»
 *     встречается 4 раза — вся flight-разметка, куда словарь уезжает
 *     целиком, и на экране этого нет;
 *   * в видимом документе того же ответа — 0 раз;
 *   * в отрисованном документе на открытии страницы — тоже 0 органов;
 *   * и только ПОСЛЕ ОДНОГО НАЖАТИЯ на плитку темы, когда
 *     `/api/flashcards` отвечает `limited: true`, — 1 кнопка.
 *
 * Ни `href`, ни формы у неё нет: это `<button onClick={openPaywall}>`.
 * Счётчик ссылок на страницу цен видел ноль и видел правильно.
 *
 * Отсюда эта проверка: настоящий браузер, настоящая роль, настоящая
 * гидрация — и нажатия, потому что без них половина экранов приложения
 * просто не собирается.
 *
 * ====================================================================
 * ЧТО ИМЕННО МЕРЯЕТСЯ
 * ====================================================================
 *
 * Множество адресов СОБИРАЕТСЯ (`scripts/route-census.mjs`): маршруты
 * app router плюс карта сайта, обе локали. Рукописного списка здесь нет
 * ни одного.
 *
 * Каждый адрес открывается ТРЕМЯ ролями — гость без сессии, аккаунт без
 * подписки, аккаунт с подпиской, — и все три настоящие: заводятся через
 * `/api/auth/register`, подписка выдаётся `/api/test/grant-subscription`.
 * Обличье одно и то же — оболочка: токен в User-Agent И кука, оба
 * признака сразу, как их видит телефон.
 *
 * На каждом экране перебираются ВСЕ органы управления (`a`, `button`,
 * `[role=button]`, `form`), и признак нарушения ищется по смыслу —
 * общими правилами из `purchase-surface-rules.mjs`: цель, сильная
 * подпись, слабое слово в роли органа.
 *
 * НАЖАТИЯ. После первого суждения нажимаются органы, которые никуда не
 * ведут (кнопки без `href`), до `CLICK_BUDGET` штук на экран, и экран
 * судится заново после каждого. Уходы со страницы отменяются: если адрес
 * сменился, браузер возвращается назад. Это и есть та самая «одна
 * плитка темы», без которой дефекта не видно.
 *
 * ГРАНИЦА, НАЗВАННАЯ ЧЕСТНО: бюджет нажатий конечен, и экран, который
 * собирается на девятом нажатии, эта проверка не увидит. Полноту по
 * подписям даёт не она, а статическое правило единственной точки в
 * `check-native-payments.mjs`: оно обходит СЛОВАРИ целиком и требует,
 * чтобы каждая платная подпись отрисовывалась только через ветку на
 * оболочку. Две половины закрывают разные дыры, и складывать их нули в
 * один общий ноль нельзя.
 *
 *   node scripts/check-rendered-purchase-surfaces.mjs --base=http://…
 *   node scripts/check-rendered-purchase-surfaces.mjs --base=http://… --plant
 */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { collectAddresses } from "./route-census.mjs";
import { judgeControl } from "./purchase-surface-rules.mjs";

const TOKEN = "RFNativeShell";
const COOKIE = "rf_native_shell";
const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

/**
 * Что нажимается: кнопки СОДЕРЖИМОГО, то есть внутри `<main>`.
 *
 * Шапка и нижняя панель из перебора исключены не списком, а строением
 * документа, и по замеренной причине: первым же органом в порядке
 * документа идёт гамбургер, он открывает выдвижное меню поверх страницы,
 * и все следующие тринадцать нажатий упираются в перекрытие и молча
 * пропускаются. Прибор делал одно нажатие на экран вместо четырнадцати.
 * Сама шапка при этом судится — переписью органов на открытии, где она
 * и видна.
 */
const CLICK_SELECTOR = "main button:not([disabled]):not([href])";

/** Сколько органов управления нажимается на одном экране. */
const CLICK_BUDGET = 14;
/** Сколько экранов собирается одновременно. */
const CONCURRENCY = 8;

/** Настоящий аккаунт — тот же способ, что у `check-native-payments`. */
async function makeSession(base, withSubscription) {
  const email = `rendered-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const registered = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": SAFARI },
    body: new URLSearchParams({ email, password: "TestPass123!", lang: "ru", redirectTo: "/ru" }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const cookies = registered.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="));
  if (cookies.length === 0) {
    throw new Error(
      `не удалось завести роль: POST /api/auth/register ответил ${registered.status} и не отдал сессионной куки. ` +
        `Сервер поднят без E2E_TEST_SEED=1? Тихо пропустить роль нельзя: ровно так и появился долг 184.`,
    );
  }
  if (withSubscription) {
    const granted = await fetch(`${base}/api/test/grant-subscription`, {
      method: "POST",
      headers: { cookie: cookies.join("; "), "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(30_000),
    });
    if (!granted.ok) {
      throw new Error(`не удалось выдать подписку: /api/test/grant-subscription ответил ${granted.status}`);
    }
  }
  return cookies.map((c) => {
    const [name, ...rest] = c.split("=");
    return { name, value: rest.join("="), url: base };
  });
}

/**
 * Перепись органов управления ОТРИСОВАННОГО документа.
 *
 * МЕТКА — НЕ ОРГАН УПРАВЛЕНИЯ (7.195, часть 4).
 *
 * Значок платности (`src/components/ui/AccessMark.tsx` и остальные четыре
 * места, где он печатается) — это `<span>` с подписью «Solo Premium» /
 * «Только Premium». Он ничего не предлагает купить, никуда не ведёт и
 * нажатием не является, но стоит ВНУТРИ ссылки или кнопки: на карточке
 * рассказа, на плитке филворда, на строке поиска, на кнопке уровня C1.
 * Его текст попадал в подпись органа, и слабое правило («Premium» на
 * короткой подписи кнопки без адреса) считало метку призывом к покупке.
 *
 * Поэтому подпись органа собирается БЕЗ текста меток: узел копируется,
 * из копии удаляются все `[data-access-mark]`, и судится остаток. Правится
 * прибор, а не экран: метка остаётся человеку полностью видимой.
 *
 * Настоящая кнопка покупки метки не носит и потому не прячется: подсадка
 * ниже (`Оформить подписку`) ловится после этой правки ровно так же, как
 * до неё, и это проверяется тем же прогоном `--plant`.
 */
export const CONTROL_CENSUS = () => {
  const nodes = [...document.querySelectorAll("a, button, [role=button], form, input[type=submit]")];
  const labelOf = (node) => {
    if (!node.querySelector("[data-access-mark]")) {
      return node.innerText || node.textContent || node.getAttribute("value") || "";
    }
    const copy = node.cloneNode(true);
    for (const mark of copy.querySelectorAll("[data-access-mark]")) mark.remove();
    return copy.textContent || node.getAttribute("value") || "";
  };
  return nodes.map((node) => ({
    tag: node.tagName.toLowerCase(),
    text: labelOf(node).slice(0, 200),
    target:
      node.getAttribute("href") ||
      node.getAttribute("action") ||
      node.getAttribute("formaction") ||
      "",
  }));
};

function judgeCensus(controls, where) {
  const problems = [];
  for (const control of controls) {
    for (const reason of judgeControl({ text: control.text, target: control.target })) {
      problems.push(`${where}: <${control.tag}> ${reason}`);
    }
  }
  return problems;
}

async function screen(context, base, path, role, plant) {
  const page = await context.newPage();
  const problems = [];
  let clicks = 0;
  try {
    const response = await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) return { problems, clicks, opened: false };
    await page.waitForTimeout(450);
    if (plant) {
      // ПОДСАДКА: кнопка покупки, вставленная в уже отрисованный документ.
      // Именно кнопка без адреса — та самая форма, которой был написан
      // долг 191, а не ссылка, которую поймал бы и старый счётчик.
      await page.evaluate(() => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Оформить подписку";
        document.body.appendChild(button);
      });
    }
    problems.push(...judgeCensus(await page.evaluate(CONTROL_CENSUS), `${path} (${role}, открытие)`));

    // Счёт берётся ТЕМ ЖЕ локатором, каким идёт нажатие. Первая редакция
    // считала кнопки отдельным выражением, которое отбрасывало всё внутри
    // `<form>`, — и на словаре, где 39 кнопок, бюджет выходил 1. Прибор
    // делал по одному нажатию на экран и до плитки темы не доходил.
    const buttons = await page.locator(CLICK_SELECTOR).count();
    const budget = Math.min(buttons, CLICK_BUDGET);
    for (let i = 0; i < budget; i += 1) {
      const before = new URL(page.url()).pathname;
      // Орган берётся ЗАНОВО на каждом шаге, а не один раз списком: после
      // нажатия дерево пересобирается, и сохранённая ссылка указывает в
      // никуда. Первый прогон прибора сделал из-за этого по одному нажатию
      // на экран вместо восьми и не дошёл до плитки темы — той самой, что
      // и открывает кнопку покупки.
      const button = page.locator(CLICK_SELECTOR).nth(i);
      try {
        await button.click({ timeout: 2500, noWaitAfter: true });
      } catch {
        continue; // невидимый, перекрытый, исчезнувший — не наше дело
      }
      clicks += 1;
      await page.waitForTimeout(350);
      // Окно, открытое нажатием, закрывается: иначе оно перекроет все
      // следующие органы, и остаток бюджета уйдёт в пустоту.
      await page.keyboard.press("Escape").catch(() => {});
      if (new URL(page.url()).pathname !== before) {
        // Орган увёл НА ДРУГОЙ АДРЕС: экран кончился, возвращаемся и идём
        // дальше, а не судим чужую страницу под этим адресом.
        //
        // Сравнивается именно путь, а не весь адрес целиком. Заплачено
        // замером: первая же кнопка словаря — переключатель режима, и он
        // пишет своё состояние в запрос (`?mode=vocabulary`). Прежнее
        // сравнение считало это уходом, звало `goBack()`, и страница после
        // возврата отдавала 0 кнопок в `<main>` — остаток бюджета уходил в
        // пустоту, и до плитки темы прибор не доходил никогда.
        await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
        await page.waitForTimeout(400);
        continue;
      }
      problems.push(...judgeCensus(await page.evaluate(CONTROL_CENSUS), `${path} (${role}, нажатий ${i + 1})`));
    }
    return { problems, clicks, opened: true };
  } finally {
    await page.close().catch(() => {});
  }
}

async function pool(items, limit, worker) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

export async function main() {
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  if (!baseArg) {
    console.error("нужен --base=http://… — этой проверке нечего открывать без сервера");
    return 1;
  }
  const base = baseArg.slice("--base=".length);
  const plant = process.argv.includes("--plant");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : Infinity;
  // `--paths=` — для замера «до/после» по названным поверхностям, а не
  // для прогона в verify: там множество всегда собранное и полное.
  const pathsArg = process.argv.find((a) => a.startsWith("--paths="));

  const census = await collectAddresses(base);
  const addresses = pathsArg
    ? pathsArg.slice("--paths=".length).split(",").filter(Boolean)
    : census.addresses.slice(0, limit);
  console.log(
    `  адреса собраны: ${census.patterns.length} шаблонов app router + ${census.sitemapCount} адресов карты сайта → ` +
      `${census.addresses.length} проверяемых адресов` +
      (addresses.length === census.addresses.length ? "" : ` (взято ${addresses.length})`),
  );

  const sessions = {
    guest: [],
    free: await makeSession(base, false),
    sub: await makeSession(base, true),
  };
  console.log("  роли: гость (без сессии), бесплатный аккаунт, подписчик — 3 из 3, все настоящие");

  const browser = await chromium.launch();
  const problemsByRole = { guest: [], free: [], sub: [] };
  let opened = 0;
  let clicks = 0;
  try {
    const contexts = {};
    for (const [role, cookies] of Object.entries(sessions)) {
      contexts[role] = await browser.newContext({
        // ОБА признака оболочки сразу, как их видит телефон: токен в
        // User-Agent (прямой переход webview) и кука (запрос service
        // worker'а, которому Capacitor User-Agent не ставит вовсе).
        userAgent: `${SAFARI} ${TOKEN}`,
        viewport: { width: 360, height: 720 },
      });
      await contexts[role].addCookies([{ name: COOKIE, value: "1", url: base }, ...cookies]);
    }

    const jobs = [];
    for (const path of addresses) for (const role of Object.keys(sessions)) jobs.push({ path, role });

    let done = 0;
    const results = await pool(jobs, CONCURRENCY, async ({ path, role }) => {
      done += 1;
      if (done % 30 === 0) console.log(`  … ${done} из ${jobs.length} экранов`);
      try {
        return { role, ...(await screen(contexts[role], base, path, role, plant)) };
      } catch (error) {
        return { role, problems: [`${path} (${role}): экран не собрался — ${error.message.slice(0, 120)}`], clicks: 0, opened: false };
      }
    });
    for (const result of results) {
      problemsByRole[result.role].push(...result.problems);
      clicks += result.clicks;
      if (result.opened) opened += 1;
    }
  } finally {
    await browser.close();
  }

  console.log(`  собрано экранов: ${opened} из ${addresses.length * 3}; нажатий сделано: ${clicks}`);

  if (plant) {
    let ok = true;
    for (const [role, list] of Object.entries(problemsByRole)) {
      const n = list.length;
      console.log(`  роль ${role.padEnd(5)} — подсадка поймана ${n} раз${n === 0 ? " (ПРОПУЩЕНО)" : ""}`);
      if (n === 0) ok = false;
    }
    console.log(
      ok
        ? "check:rendered-purchases --plant — подсаженная кнопка покупки роняет прибор во ВСЕХ ТРЁХ ролях"
        : "check:rendered-purchases --plant — FAILED: роль, на которой подсадка не срабатывает, прибором не судится вовсе",
    );
    return ok ? 0 : 1;
  }

  const problems = Object.values(problemsByRole).flat();
  if (problems.length) {
    console.error("ПЛАТНЫЕ ОРГАНЫ НА ОТРИСОВАННОМ ЭКРАНЕ ВНУТРИ ПРИЛОЖЕНИЯ:");
    for (const p of [...new Set(problems)].slice(0, 60)) console.error(`  ${p}`);
    if (problems.length > 60) console.error(`  … и ещё ${problems.length - 60}`);
    return 1;
  }
  console.log(
    `check:rendered-purchases — ${addresses.length} адресов × 3 роли в обличье оболочки, ` +
      `${clicks} нажатий: платных органов управления 0.`,
  );
  return 0;
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
