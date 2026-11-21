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
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { collectAddresses } from "./route-census.mjs";
import { judgeControl } from "./purchase-surface-rules.mjs";

const TOKEN = "RFNativeShell";
const COOKIE = "rf_native_shell";
const VERSION_COOKIE = "rf_shell_version";

/**
 * ВЕРСИЯ ОБОЛОЧКИ, КОТОРУЮ СУДИТ ПРИБОР — ДОЛГ 301 (заход 7.298).
 *
 * ЧТО БЫЛО. С 7.224 до 7.298 каждый контекст получал ровно одну куку
 * `rf_native_shell=1` и голый токен `RFNativeShell` без числа. По правилу
 * `nativeShellVersion` (`src/lib/native-shell-token.ts`) это ВЕРСИЯ 2 — та,
 * где экрана покупки нет по построению. Ноль прибора про экран покупки был
 * нулём там, где иначе и быть не могло.
 *
 * ЧТО У ЛЮДЕЙ. Каждый телефон из Google Play (первая публикация — vc14,
 * сейчас vc18) шлёт `RFNativeShell/<versionCode>` и куку
 * `rf_shell_version=<versionCode>`; версии 2 и 3 жили только на устройствах
 * тестировщиков до 22.09.2026. Поэтому три роли судятся как НЫНЕШНЯЯ
 * оболочка — число берётся из `capacitor.config.ts` текстом (тем же
 * литералом, что уходит в User-Agent телефона), не переписывается руками.
 * Старая версия 2 остаётся одной ролью (`free2`, аккаунт без подписки — на
 * нём больше всего замков): правило «экрана покупки там нет» продолжает
 * судиться и отрисованным экраном, а не только ответом сервера.
 */
function currentShellVersion() {
  const text = readFileSync(new URL("../capacitor.config.ts", import.meta.url), "utf8");
  const m = /const NATIVE_SHELL_VERSION = (\d+);/.exec(text);
  if (!m) throw new Error("capacitor.config.ts: не нашлось `const NATIVE_SHELL_VERSION = N;` — прибору нечем назвать версию оболочки");
  return Number(m[1]);
}

/** Граница «оболочка умеет покупать» — `NATIVE_PURCHASE_MIN_SHELL_VERSION`. */
function purchaseMinShellVersion() {
  const text = readFileSync(new URL("../src/lib/revenuecat-config.ts", import.meta.url), "utf8");
  const m = /export const NATIVE_PURCHASE_MIN_SHELL_VERSION = (\d+);/.exec(text);
  if (!m) throw new Error("revenuecat-config.ts: не нашлось NATIVE_PURCHASE_MIN_SHELL_VERSION");
  return Number(m[1]);
}

/** Адрес, где экран нативной покупки есть всегда (`/[lang]/pricing` в оболочке). */
const PRICING_PROBE = "/ru/pricing";

/** Признак единственного экрана нативной покупки (`NativePurchasePanel.tsx`). */
const NATIVE_PURCHASE_SELECTOR = '[data-testid="native-purchase"]';
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
 * ПОЧЕМУ СПИСОК ПУСТ С 15.09.2026 (долг 210 закрыт). В нём стоял один
 * адрес — `/es/account` под гостем, — и причина его молчания найдена и
 * убрана, а не записана в список. Она была не в странице: у гостя этот
 * адрес ПЕРЕАДРЕСУЕТСЯ (`/account` → `/profile` → вход), и прибор тратил
 * весь бюджет в четырнадцать нажатий на чужой странице, возвращаясь
 * после каждого нажатия через ту же двойную переадресацию. Теперь
 * переадресованный адрес судится один раз на открытии, а нажатия на
 * странице-цели делает та же перепись под ЕЁ собственным адресом —
 * см. `screen()` ниже. Список остаётся механизмом: новый молчащий адрес
 * уронит прогон и будет назван вместе с шагом, на котором встал.
 */
const STALLED_ALLOWED = new Map([]);
const STALLED_ALLOWED_COUNT = 0;
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
    // Орган внутри экрана нативной покупки (долг 301). Там законны кнопки
    // тарифов со строкой цены магазина — но не адрес веб-кассы.
    inNativePurchase: Boolean(node.closest('[data-testid="native-purchase"]')),
    target:
      node.getAttribute("href") ||
      node.getAttribute("action") ||
      node.getAttribute("formaction") ||
      "",
  }));
};

/**
 * Суждение переписи с учётом версии оболочки (долг 301).
 *
 * Орган ВНЕ экрана нативной покупки — по общим правилам, как и прежде.
 * Орган ВНУТРИ него в оболочке, которая умеет покупать, — только по адресу:
 * кнопка тарифа со строкой цены магазина там и есть законная покупка
 * (`PROGRESS.md` 3.7), а вход на `/pricing`, `/api/checkout` или
 * `stripe.com` — по-прежнему находка. В оболочке, которая покупать НЕ
 * умеет, сам экран нативной покупки — находка.
 */
function judgeCensus(controls, where, shell) {
  const problems = [];
  const panelControls = controls.filter((control) => control.inNativePurchase);
  if (panelControls.length > 0 && shell.version < shell.purchaseMin) {
    problems.push(`${where}: экран нативной покупки в оболочке версии ${shell.version}, где покупки нет`);
  }
  for (const control of controls) {
    const nativeAllowed = control.inNativePurchase && shell.version >= shell.purchaseMin;
    for (const reason of judgeControl({ text: control.text, target: control.target, isControl: !nativeAllowed })) {
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

/**
 * СРОК САМОЙ ПЕРЕПИСИ — 7.201.
 *
 * ЗАЧЕМ ОТДЕЛЬНОЕ ЧИСЛО, когда у экрана уже есть срок в 240 с. Ждать
 * страницу без срока умеет ровно один вызов Playwright — `page.evaluate`:
 * если исполняемый контекст страницы срывается (навигация) или её главный
 * поток занят навсегда, он ждёт нового контекста сколько угодно. Внешний
 * срок экрана это ловит, но платит за это ЧЕТЫРЕ МИНУТЫ и называет шаг
 * «открытие», под которым лежат и переход, и ожидание, и перепись.
 *
 * ЗАМЕР, КОТОРЫЙ ЭТО НАЗВАЛ (доля 3/3, 15–16.09.2026): три красных прогона
 * из четырёх на `/ru/account (guest)`, каждый — ровно 240 с и ровно на
 * шаге «открытие», при среднем экране ≈6 с. Причина была в странице
 * (`/[lang]/profile` отвечал гостю 200 с `<meta refresh>` на 1000-й
 * миллисекунде), и она убрана; этот срок — вторая половина: теперь
 * молчащая перепись называется за 30 с и называет СВОЙ шаг.
 *
 * ЧИСЛО. 30 с — впятеро больше целого среднего экрана и в восемь раз
 * меньше срока экрана. Перепись органов на уже загруженном документе
 * стоит миллисекунды; 30 с здесь означает не «медленно», а «не отвечает».
 * Экран, не уложившийся в него, попадает в ТОТ ЖЕ список молчащих и так
 * же роняет прогон — строгость не изменилась, изменилась цена и точность
 * названия.
 */
const CENSUS_ANSWER_MS = 30_000;

/** Молчание, за которое отвечает `CENSUS_ANSWER_MS`: отличается от прочих
 *  отказов тем, что НЕ гасится в `censusOf`, а идёт наверх находкой. */
class ScreenStalled extends Error {}

/**
 * ПОДСАЖЕННОЕ ЗАВИСАНИЕ — ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ СРОКА ПЕРЕПИСИ (7.201).
 *
 * Занимает главный поток страницы настоящим бесконечным циклом — ровно тем
 * классом отказа, ради которого срок и заведён (7.196: «страница, чей
 * главный поток занят навсегда, не ответит никогда»). Цикл
 * САМООГРАНИЧЕН 45 секундами: срок переписи истекает на 30-й, находка уже
 * записана, а браузер после этого закрывается без висящего рендерера.
 */
const STALL_PLANT_MS = 45_000;

async function censusOf(page, skipped, where) {
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: SETTLE_TIMEOUT_MS });
  } catch {
    skipped.count += 1;
    return [];
  }
  let timer;
  const answer = page.evaluate(CONTROL_CENSUS);
  // Проигравший гонку `evaluate` когда-нибудь откажет (браузер закроется),
  // и отказ без обработчика уронил бы процесс уже ПОСЛЕ отчёта.
  answer.catch(() => {});
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new ScreenStalled(`${STALLED_MARK} ${Math.round(CENSUS_ANSWER_MS / 1000)} с (встал на шаге «${where}»)`)),
      CENSUS_ANSWER_MS,
    );
  });
  try {
    return await Promise.race([answer, deadline]);
  } catch (error) {
    if (error instanceof ScreenStalled) throw error;
    skipped.count += 1;
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ПЕРЕАДРЕСОВАННЫЙ АДРЕС СУДИТСЯ ОДИН РАЗ, А НЕ ЧЕТЫРНАДЦАТЬ — ДОЛГ 210.
 *
 * ЗАМЕР, КОТОРЫЙ ЭТО НАЗВАЛ. `/es/account` под гостем не отвечал ни за
 * 90 с, ни за 240 с на трёх прогонах CI подряд, при среднем экране ≈6 с.
 * Диагноз «висит» был неверен: адрес переадресуется дважды (`/account` →
 * `/profile` → вход), то есть под этим адресом открыта СТРАНИЦА ВХОДА, и
 * каждое из четырнадцати нажатий на ней — переход, после которого прибор
 * возвращался через ту же двойную переадресацию. Четырнадцать таких
 * кругов и есть те минуты.
 *
 * И работа эта была лишней ЦЕЛИКОМ: страница-цель — самостоятельный
 * адрес переписи (`/[lang]/login`, `/[lang]/profile` — оба среди 66
 * шаблонов app router), её нажатия делает тот же прибор под её
 * собственным именем. Судить её второй раз под чужим адресом значит
 * платить вдвое за одно и то же и приписывать находку не тому месту.
 *
 * Поэтому: переадресация — судим ОТКРЫТЫЙ документ (кнопка покупки на
 * нём была бы находкой) и уходим. Цель переадресации возвращается
 * наверх и там сверяется с переписью: цель, которой в переписи НЕТ,
 * означает, что экран выпал из замера, и это находка, а не пропуск.
 */
async function screen(context, base, path, role, plant, skipped, step, stallPlant = false, shell) {
  const page = await context.newPage();
  const problems = [];
  let clicks = 0;
  /** Видел ли этот экран нативную покупку — для контроля слепоты роли (долг 301). */
  let nativeSeen = false;
  const judge = (controls, where) => {
    if (controls.some((control) => control.inNativePurchase)) nativeSeen = true;
    return judgeCensus(controls, where, shell);
  };
  const at = (name) => {
    if (step) step.name = name;
  };
  try {
    at("открытие");
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
    if (stallPlant) {
      // ПОДСАДКА ЗАВИСАНИЯ: главный поток страницы занят настоящим циклом.
      // Ставится ПОСЛЕ открытия и ДО переписи — то есть ровно туда, где
      // живой отказ и случался.
      await page.evaluate((ms) => {
        setTimeout(() => {
          const until = Date.now() + ms;
          while (Date.now() < until) {
            /* занят навсегда — с точки зрения срока переписи */
          }
        }, 0);
      }, STALL_PLANT_MS);
    }
    if (plant) {
      // ВТОРАЯ ПОДСАДКА (долг 301): вход в веб-кассу ВНУТРИ экрана нативной
      // покупки. Подписи там не судятся (кнопки тарифов законны), адрес —
      // судится; эта подсадка доказывает, что послабление не ослепило
      // правило адреса. Ставится только там, где экран действительно есть.
      await page.evaluate((selector) => {
        const panel = document.querySelector(selector);
        if (!panel) return;
        const link = document.createElement("a");
        link.href = "/ru/pricing";
        link.textContent = "подсадка-301";
        link.setAttribute("data-plant-301", "1");
        panel.appendChild(link);
      }, NATIVE_PURCHASE_SELECTOR);
      if (shell.version < shell.purchaseMin) {
        // ТРЕТЬЯ ПОДСАДКА (долг 301): экран нативной покупки в оболочке,
        // которая покупать не умеет. Обязан стать находкой.
        await page.evaluate(() => {
          const fake = document.createElement("div");
          fake.setAttribute("data-testid", "native-purchase");
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = "подсадка-301-старая";
          fake.appendChild(button);
          document.body.appendChild(fake);
        });
      }
    }
    problems.push(...judge(await censusOf(page, skipped, "перепись на открытии"), `${path} (${role}, открытие)`));

    const landed = new URL(page.url()).pathname;
    if (landed !== path) {
      return { problems, clicks, opened: true, redirectedTo: landed, nativeSeen };
    }

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
      at(`нажатие ${i + 1} из ${budget}`);
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
        at(`возврат после нажатия ${i + 1} из ${budget}`);
        await page.goBack({ waitUntil: "domcontentloaded", timeout: GO_BACK_TIMEOUT_MS }).catch(() => {});
        await page.waitForTimeout(400);
        continue;
      }
      at(`перепись после нажатия ${i + 1} из ${budget}`);
      problems.push(
        ...judge(
          await censusOf(page, skipped, `перепись после нажатия ${i + 1} из ${budget}`),
          `${path} (${role}, нажатий ${i + 1})`,
        ),
      );
    }
    return { problems, clicks, opened: true, nativeSeen };
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
  /**
   * `--stall=<адрес>` — ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ СРОКА ПЕРЕПИСИ (7.201).
   *
   * На названном адресе главный поток страницы занимается бесконечным
   * циклом, и прогон обязан назвать этот экран молчащим В КАЖДОЙ ИЗ ТРЁХ
   * РОЛЕЙ. Исход обратный обычному: поймано — 0, пропущено — 1. Без этого
   * флага тот же адрес обязан молчать в отчёте (отрицательный контроль), и
   * обе половины гоняются рядом — см. scripts/verify-rendered.mjs.
   */
  const stallArg = process.argv.find((a) => a.startsWith("--stall="));
  const stallPath = stallArg ? stallArg.slice("--stall=".length) : null;

  const shard = parseShard(process.argv);
  const census = await collectAddresses(base);
  const allAddresses = pathsArg
    ? pathsArg.slice("--paths=".length).split(",").filter(Boolean)
    : census.addresses.slice(0, limit);
  const sharded =
    shard.total === 1 ? allAddresses : allAddresses.filter((_, i) => i % shard.total === shard.index);
  // Подсадка 301 ставится внутрь экрана нативной покупки, а он есть на
  // странице цен: в прогоне `--plant` этот адрес берётся всегда (долг 301).
  const addresses = plant && !sharded.includes(PRICING_PROBE) ? [...sharded, PRICING_PROBE] : sharded;
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

  const freeSession = await makeSession(base, false);
  const sessions = {
    guest: [],
    free: freeSession,
    sub: await makeSession(base, true),
    // Старая оболочка версии 2 — тем же аккаунтом без подписки (долг 301).
    free2: freeSession,
  };
  const current = currentShellVersion();
  const purchaseMin = purchaseMinShellVersion();
  /** Версия оболочки каждой роли: три — нынешняя (как у телефонов из Play), одна — старая 2. */
  const shellOf = { guest: current, free: current, sub: current, free2: 2 };
  if (current < purchaseMin) {
    console.error(`нынешняя оболочка ${current} младше границы покупки ${purchaseMin} — прибор судил бы не то, что у людей`);
    return 1;
  }
  console.log(
    `  роли: гость (без сессии), бесплатный аккаунт, подписчик — в оболочке ${current} (как телефоны из Play); ` +
      `бесплатный аккаунт ещё раз — в старой оболочке 2; 4 из 4, все настоящие`,
  );

  const browser = await chromium.launch();
  const problemsByRole = Object.fromEntries(Object.keys(sessions).map((role) => [role, []]));
  /** Роли, на чьих экранах нативная покупка была увидена хоть раз (контроль слепоты, долг 301). */
  const nativeSeenBy = new Set();
  const stalled = [];
  /** Переадресованные экраны: откуда, куда, под какой ролью. */
  const redirects = [];
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
        // Версия 2 — голый токен и одна кука, как у оболочек до 7.223;
        // нынешняя — число в токене и в куке `rf_shell_version`, как у
        // телефона (`appendUserAgent` в capacitor.config.ts).
        userAgent: shellOf[role] === 2 ? `${SAFARI} ${TOKEN}` : `${SAFARI} ${TOKEN}/${shellOf[role]}`,
        viewport: { width: 360, height: 720 },
      });
      const shellCookies = [{ name: COOKIE, value: "1", url: base }];
      if (shellOf[role] !== 2) shellCookies.push({ name: VERSION_COOKIE, value: String(shellOf[role]), url: base });
      await contexts[role].addCookies([...shellCookies, ...cookies]);
    }

    const jobs = [];
    for (const path of addresses) for (const role of Object.keys(sessions)) jobs.push({ path, role });

    let done = 0;
    const results = await pool(jobs, CONCURRENCY, async ({ path, role }) => {
      done += 1;
      if (done % 30 === 0) console.log(`  … ${done} из ${jobs.length} экранов`);
      // Шаг, на котором экран находится прямо сейчас. Нужен ровно для
      // одного: срок, истёкший молча, называет «что-то повисло», а срок,
      // истёкший с именем шага, называет ЧТО ИМЕННО. Долг 210 разбирали
      // тремя прогонами CI именно потому, что этого имени не было.
      const step = { name: "не начат" };
      try {
        // Гонка со сроком: что бы ни повисло внутри, ответ будет.
        let timer;
        const deadline = new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  `экран не ответил за ${Math.round(SCREEN_DEADLINE_MS / 1000)} с (встал на шаге «${step.name}»)`,
                ),
              ),
            SCREEN_DEADLINE_MS,
          );
        });
        // `.catch` на самом экране обязателен: после проигранной гонки он
        // всё равно когда-нибудь завершится, и его отказ без обработчика
        // стал бы необработанным отклонением — то есть падением процесса
        // уже ПОСЛЕ того, как отчёт напечатан.
        const running = screen(contexts[role], base, path, role, plant, skipped, step, path === stallPath, {
          version: shellOf[role],
          purchaseMin,
        });
        running.catch(() => {});
        try {
          return { role, path, ...(await Promise.race([running, deadline])) };
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        const line = `${path} (${role}): ${error.message.slice(0, 120)}`;
        if (error.message.includes(STALLED_MARK)) return { role, path, stalled: [line], problems: [], clicks: 0, opened: false };
        return { role, path, problems: [`${path} (${role}): экран не собрался — ${error.message.slice(0, 120)}`], clicks: 0, opened: false };
      }
    });
    for (const result of results) {
      problemsByRole[result.role].push(...result.problems);
      if (result.stalled) stalled.push(...result.stalled);
      if (result.redirectedTo) redirects.push({ from: result.path, to: result.redirectedTo, role: result.role });
      clicks += result.clicks;
      if (result.opened) opened += 1;
      if (result.nativeSeen) nativeSeenBy.add(result.role);
    }
  } finally {
    await browser.close();
  }

  console.log(
    `  собрано экранов: ${opened} из ${addresses.length * Object.keys(sessions).length}; нажатий сделано: ${clicks}; ` +
      `снимков пропущено из-за перехода: ${skipped.count}`,
  );

  // ПЕРЕАДРЕСАЦИИ — СВОИМ ЧИСЛОМ, И КАЖДАЯ ЦЕЛЬ ОБЯЗАНА БЫТЬ В ПЕРЕПИСИ.
  //
  // Экран, ушедший на другой адрес, дальше не судится (см. `screen`), и
  // это законно ровно при одном условии: цель судится сама, под своим
  // именем. Условие проверяется, а не предполагается — иначе «не судим
  // переадресованное» стало бы тихой дырой размером в целую страницу.
  const known = new Set(allAddresses);
  const escaped = [];
  for (const { from, to, role } of redirects) {
    if (!known.has(to)) escaped.push(`${from} (${role}) переадресован на ${to}, а этого адреса в переписи НЕТ`);
  }
  if (redirects.length) {
    const pairs = [...new Set(redirects.map((r) => `${r.from} → ${r.to}`))];
    const inCensus = pairs.filter((pair) => known.has(pair.slice(pair.indexOf(" → ") + 3))).length;
    console.log(
      `  переадресаций: ${redirects.length} (${pairs.length} различных)` +
        // При `--paths=` перепись не полная по построению, и доля «целей в
        // переписи» считала бы полноту среза: печатать её значит печатать
        // заведомую бессмыслицу (замер: «-1 из 2»).
        (pathsArg ? "" : `, цели в переписи: ${inCensus} из ${pairs.length}`),
    );
    for (const pair of pairs.slice(0, 10)) console.log(`    ${pair}`);
  }
  // При `--paths=` перепись НЕ полная по построению (это замер по
  // названным поверхностям), и требование «цель переадресации обязана быть
  // в переписи» к ней неприменимо: оно судило бы полноту среза, а не сайт.
  // В прогоне доли `--paths=` не передаётся никогда.
  if (!plant && !pathsArg && escaped.length) {
    console.error("ЭКРАНЫ, УШЕДШИЕ ИЗ ЗАМЕРА ЧЕРЕЗ ПЕРЕАДРЕСАЦИЮ НА АДРЕС ВНЕ ПЕРЕПИСИ:");
    for (const line of [...new Set(escaped)]) console.error(`  ${line}`);
    return 1;
  }

  if (stallPath) {
    const roles = Object.keys(sessions);
    const caught = roles.filter((role) => stalled.some((line) => line.startsWith(`${stallPath} (${role})`)));
    for (const role of roles) {
      const ok = caught.includes(role);
      console.log(`  роль ${role.padEnd(5)} — подсаженное зависание ${ok ? "поймано" : "ПРОПУЩЕНО"}`);
    }
    for (const line of stalled) console.log(`  молчит: ${line}`);
    if (caught.length !== roles.length) {
      console.error(
        `подсаженное зависание на ${stallPath} названо ${caught.length} ролями из ${roles.length} — ` +
          `срок переписи не ловит занятый навсегда главный поток`,
      );
      return 1;
    }
    console.log(`  подсадка зависания поймана всеми ${roles.length} ролями — срок переписи работает`);
    return 0;
  }

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

  // КОНТРОЛЬ СЛЕПОТЫ (долг 301): аккаунт без подписки в нынешней оболочке
  // обязан УВИДЕТЬ экран нативной покупки на странице цен. Не увидел —
  // послабление для экрана покупки ничего не судит, а ноль прибора про
  // него снова получен там, где экрана нет.
  const pricingJudged = addresses.includes(PRICING_PROBE);
  if (pricingJudged) {
    const seen = nativeSeenBy.has("free");
    console.log(
      `  экран нативной покупки: ${seen ? "увиден" : "НЕ УВИДЕН"} аккаунтом без подписки в оболочке ${current} ` +
        `(роли, где увиден: ${[...nativeSeenBy].join(", ") || "ни одной"})`,
    );
    if (!seen) {
      console.error(`прибор не увидел экрана нативной покупки на ${PRICING_PROBE} в оболочке ${current} — роль ослепла`);
      return 1;
    }
  }

  if (plant) {
    let ok = true;
    const PANEL_PLANT = `<a> ведёт на платёжную поверхность: ${PRICING_PROBE}`;
    for (const [role, list] of Object.entries(problemsByRole)) {
      const button = list.filter((p) => p.includes("Оформить подписку")).length;
      const panel = list.filter((p) => p.startsWith(`${PRICING_PROBE} (${role}`) && p.includes(PANEL_PLANT)).length;
      const canBuy = shellOf[role] >= purchaseMin;
      console.log(
        `  роль ${role.padEnd(5)} — кнопка-подсадка поймана ${button} раз${button === 0 ? " (ПРОПУЩЕНО)" : ""}` +
          (canBuy && role !== "sub" && role !== "guest"
            ? `; вход в веб-кассу внутри экрана покупки — ${panel} раз${panel === 0 ? " (ПРОПУЩЕНО)" : ""}`
            : ""),
      );
      if (button === 0) ok = false;
      if (role === "free" && panel === 0) ok = false;
      if (!canBuy) {
        const old = list.filter((p) => p.includes(`экран нативной покупки в оболочке версии ${shellOf[role]}`)).length;
        console.log(`  роль ${role.padEnd(5)} — экран покупки в оболочке ${shellOf[role]} пойман ${old} раз${old === 0 ? " (ПРОПУЩЕНО)" : ""}`);
        if (old === 0) ok = false;
      }
    }
    console.log(
      ok
        ? `check:rendered-purchases --plant — подсадки роняют прибор во ВСЕХ ${Object.keys(problemsByRole).length} ролях, ` +
            "включая вход в веб-кассу внутри экрана нативной покупки"
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
    `check:rendered-purchases — ${addresses.length} адресов × ${Object.keys(problemsByRole).length} роли ` +
      `(три в оболочке ${current}, одна в оболочке 2), ` +
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
