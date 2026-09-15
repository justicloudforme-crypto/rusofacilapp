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

/**
 * СРОК ОДНОГО ЭКРАНА — 7.196, часть 5, вторая находка.
 *
 * ЗАЧЕМ. Прибор не медленный — он ВИСНЕТ. Замерено по трём прогонам CI:
 * шаг доходил до «120 из 132 экранов» (а на PR #316 — до 390 из 396) и
 * стоял до предохранителя, не напечатав больше ни строки; в уборке
 * задания оставались живыми `next-server` и `chrome-headless-shell`.
 * Поднимать предохранитель бесполезно: он лечит симптом, а прогон всё
 * равно тратит всё, что ему дали, и красный означает «неизвестно что».
 *
 * У Playwright есть срок почти у всего, кроме `page.evaluate`: тот ждёт
 * ответа страницы столько, сколько понадобится, — а страница, чей главный
 * поток занят навсегда (бесконечный цикл в обработчике, зацикленный
 * `setTimeout`, окно, переоткрывающее само себя), не ответит никогда.
 * Поэтому срок ставится СНАРУЖИ, на весь экран целиком.
 *
 * Экран, не уложившийся в срок, становится НАЗВАННОЙ находкой в отчёте, а
 * не молчаливым пропуском и не смертью всего шага: прогон идёт дальше, и
 * в конце видно, какой именно адрес и под какой ролью не отвечает.
 *
 * ЧИСЛО ПОДОБРАНО ЗАМЕРОМ, И ПЕРВОЕ БЫЛО МАЛО. Срок в 90 с назвал
 * `/es/account` под гостем — и это оказался не висящий экран, а честно
 * долгий: у гостя этот адрес переадресуется, почти каждое из четырнадцати
 * нажатий уводит со страницы, и на каждое приходится возврат. Худший
 * случай считается прямо: 14 × (2,5 с на нажатие + 0,35 с на паузу + срок
 * возврата). Поэтому возврат получил СВОЙ срок в 8 секунд вместо
 * умолчания в 30, и худший случай стал ≈152 с, а общий срок экрана —
 * 240 с, то есть в полтора раза больше худшего и в сорок раз больше
 * среднего (замер CI: 101 с на 132 экрана при восьми одновременных
 * страницах ≈ 6 с на экран).
 */
const SCREEN_DEADLINE_MS = 240_000;

/** Срок возврата назад. Умолчание Playwright — 30 с, и четырнадцать таких
 *  возвратов подряд и есть тот «висящий» экран. */
const GO_BACK_TIMEOUT_MS = 8_000;

/**
 * ЭКРАНЫ, КОТОРЫЕ НЕ ОТВЕЧАЮТ, — ОТДЕЛЬНАЯ НАХОДКА И ОТДЕЛЬНЫЙ СЧЁТ.
 *
 * Этот прибор ищет ОДНО: платные органы управления внутри оболочки. Экран,
 * который не ответил за свой срок, — находка ДРУГОГО рода, и сваливать её
 * в ту же кучу значит путать два разных сообщения: «здесь кнопка покупки»
 * и «здесь страница не отвечает».
 *
 * Поэтому такие экраны печатаются отдельным списком ВСЕГДА, а роняют
 * прогон только те, которых нет в списке ниже. Список — с причиной и
 * закреплён числом, ровно как исключения `check:brand` и
 * `check:access-marks`: новый молчащий адрес уронит прогон и будет назван,
 * а известный не будет каждый раз выдавать красное за старое.
 *
 * ЗАМЕР, ИЗ-ЗА КОТОРОГО СПИСОК ПОЯВИЛСЯ (15.09.2026, три прогона CI на
 * трёх разных ветках): `/es/account` под гостем не отвечает ни за 90 с, ни
 * за 240 с, при среднем экране ≈6 с. Локально на базе той же формы тот же
 * адрес проходит за секунды. Адрес — переадресация на `/profile`, у гостя
 * дальше на вход; что именно там встаёт на бегунке CI, ещё не измерено —
 * это долг 210, и он назван, а не спрятан.
 */
const STALLED_ALLOWED = new Map([
  [
    "/es/account (guest)",
    "долг 210: переадресация /account → /profile → вход; на бегунке CI экран не отвечает ни за 90, ни за 240 с при среднем ≈6 с, локально проходит за секунды",
  ],
]);
const STALLED_ALLOWED_COUNT = 1;
/** Признак, по которому экран, не уложившийся в срок, отличается от
 *  находки про платный орган. */
const STALLED_MARK = "экран не ответил за";

/**
 * ДОЛЯ РАБОТЫ, КОТОРУЮ БЕРЁТ ЭТОТ ПРОГОН — 7.196, часть 5.
 *
 * ЗАЧЕМ. После роста прибора в 7.194 (132 адреса × 3 роли = 396 экранов,
 * ~2200 нажатий) шаг CI стал ходить впритык: PR #316 дошёл до 390 экранов
 * из 396 и был срезан предохранителем на 30 минуте, а полный прогон занял
 * 44 минуты. Красный при этом давал не дефект, а таймер, и отличить одно
 * от другого можно было только вручную.
 *
 * Долю берут ПО ОСТАТКУ ОТ ДЕЛЕНИЯ индекса адреса, а не отрезком: адреса
 * в переписи идут группами (все уроки подряд, все рассказы подряд), и
 * отрезок дал бы одной доле только дешёвые экраны, а другой — только
 * дорогие. Остаток перемешивает их равномерно по построению.
 *
 * Делится множество АДРЕСОВ, а не пар «адрес × роль»: каждая доля обязана
 * судить все три роли, иначе роль, которой не досталось ни одного экрана,
 * молча перестанет проверяться — ровно то, чем был долг 184.
 */
function parseShard(argv) {
  const arg = argv.find((a) => a.startsWith("--shard="));
  if (!arg) return { index: 0, total: 1 };
  const [index, total] = arg.slice("--shard=".length).split("/").map(Number);
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 1 || index > total) {
    throw new Error(`--shard=<k>/<n> ожидает целые 1 ≤ k ≤ n, получено «${arg}»`);
  }
  return { index: index - 1, total };
}

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

/**
 * ПЕРЕПИСЬ ОРГАНОВ НА СТРАНИЦЕ, КОТОРАЯ МОЖЕТ УХОДИТЬ ИЗ-ПОД РУК.
 *
 * ЗАЧЕМ ОТДЕЛЬНАЯ ФУНКЦИЯ (15.09.2026). Нажатие делается с
 * `noWaitAfter: true` — прибор нарочно не ждёт перехода, иначе бюджет в
 * четырнадцать нажатий стоил бы четырнадцать переходов. Но переход при
 * этом всё равно происходит, и `page.evaluate` попадает ровно в него.
 * Исходов два, и оба видены: локально — отказ «Execution context was
 * destroyed, most likely because of a navigation», на бегунке CI — ОЖИДАНИЕ
 * БЕЗ СРОКА, потому что `evaluate` ждёт нового контекста столько, сколько
 * понадобится. Ровно это и выглядело как «прибор повис на 390 экранах из
 * 396»: `/es/account` у гостя переадресуется дважды, и почти каждое
 * нажатие на нём — переход.
 *
 * Здесь страница сначала доводится до `domcontentloaded` со СВОИМ сроком, и
 * только потом судится. Отказ означает «экран сменился под руками» —
 * судить в этот момент нечего, и следующий шаг цикла посудит уже новую
 * страницу. Такие пропуски СЧИТАЮТСЯ и печатаются: молчаливый `catch`
 * здесь был бы дырой, а не починкой.
 */
const SETTLE_TIMEOUT_MS = 8_000;

async function censusOf(page, skipped) {
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: SETTLE_TIMEOUT_MS });
    return await page.evaluate(CONTROL_CENSUS);
  } catch {
    skipped.count += 1;
    return [];
  }
}

async function screen(context, base, path, role, plant, skipped) {
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
    problems.push(...judgeCensus(await censusOf(page, skipped), `${path} (${role}, открытие)`));

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
        await page.goBack({ waitUntil: "domcontentloaded", timeout: GO_BACK_TIMEOUT_MS }).catch(() => {});
        await page.waitForTimeout(400);
        continue;
      }
      problems.push(...judgeCensus(await censusOf(page, skipped), `${path} (${role}, нажатий ${i + 1})`));
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

  const shard = parseShard(process.argv);
  const census = await collectAddresses(base);
  const allAddresses = pathsArg
    ? pathsArg.slice("--paths=".length).split(",").filter(Boolean)
    : census.addresses.slice(0, limit);
  const addresses =
    shard.total === 1 ? allAddresses : allAddresses.filter((_, i) => i % shard.total === shard.index);
  if (shard.total > 1) {
    if (addresses.length === 0) {
      console.error(
        `доля ${shard.index + 1}/${shard.total} пуста: адресов всего ${allAddresses.length}. ` +
          `Пустая доля отчиталась бы «0 нарушений», не открыв ни одного экрана.`,
      );
      return 1;
    }
    console.log(`  доля ${shard.index + 1} из ${shard.total}: ${addresses.length} адресов из ${allAddresses.length}`);
  }
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
  const stalled = [];
  /** Сколько раз судить было нечего, потому что страница уходила. */
  const skipped = { count: 0 };
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
        // Гонка со сроком: что бы ни повисло внутри, ответ будет.
        let timer;
        const deadline = new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`экран не ответил за ${Math.round(SCREEN_DEADLINE_MS / 1000)} с`)),
            SCREEN_DEADLINE_MS,
          );
        });
        // `.catch` на самом экране обязателен: после проигранной гонки он
        // всё равно когда-нибудь завершится, и его отказ без обработчика
        // стал бы необработанным отклонением — то есть падением процесса
        // уже ПОСЛЕ того, как отчёт напечатан.
        const running = screen(contexts[role], base, path, role, plant, skipped);
        running.catch(() => {});
        try {
          return { role, ...(await Promise.race([running, deadline])) };
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        const line = `${path} (${role}): ${error.message.slice(0, 120)}`;
        if (error.message.includes(STALLED_MARK)) return { role, stalled: [line], problems: [], clicks: 0, opened: false };
        return { role, problems: [`${path} (${role}): экран не собрался — ${error.message.slice(0, 120)}`], clicks: 0, opened: false };
      }
    });
    for (const result of results) {
      problemsByRole[result.role].push(...result.problems);
      if (result.stalled) stalled.push(...result.stalled);
      clicks += result.clicks;
      if (result.opened) opened += 1;
    }
  } finally {
    await browser.close();
  }

  console.log(
    `  собрано экранов: ${opened} из ${addresses.length * 3}; нажатий сделано: ${clicks}; ` +
      `снимков пропущено из-за перехода: ${skipped.count}`,
  );

  // МОЛЧАЩИЕ ЭКРАНЫ — своим списком и своим счётом.
  if (STALLED_ALLOWED.size !== STALLED_ALLOWED_COUNT) {
    console.error(
      `список известных молчащих экранов вырос до ${STALLED_ALLOWED.size} при ожидаемых ${STALLED_ALLOWED_COUNT} — ` +
        `так и было задумано? тогда поправьте число рядом со списком`,
    );
    return 1;
  }
  const unknownStalled = [];
  for (const line of stalled) {
    const key = line.slice(0, line.indexOf(":"));
    const reason = STALLED_ALLOWED.get(key);
    console.log(`  молчит: ${line}${reason ? ` — известен (${reason})` : " — НОВЫЙ"}`);
    if (!reason) unknownStalled.push(line);
  }
  if (!plant && unknownStalled.length) {
    console.error("ЭКРАНЫ, КОТОРЫЕ НЕ ОТВЕТИЛИ В СВОЙ СРОК И НЕ ЗАПИСАНЫ В СПИСОК ИЗВЕСТНЫХ:");
    for (const line of unknownStalled) console.error(`  ${line}`);
    return 1;
  }

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
      // ВЫХОД ЯВНЫЙ, а не по опустевшему циклу событий. Экран, проигравший
      // гонку со сроком, оставляет за собой живую страницу и её таймеры;
      // ждать, пока они сами кончатся, — это ровно тот висящий шаг, из-за
      // которого 29.08.2026 задание стояло 56 минут.
      process.exit(code);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
