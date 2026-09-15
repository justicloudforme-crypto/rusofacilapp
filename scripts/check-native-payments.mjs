// ВНУТРИ ПРИЛОЖЕНИЯ ПЛАТНЫХ ПОВЕРХНОСТЕЙ НЕТ ВОВСЕ — ДОЛГИ 79, 179 И 184.
//
// Что сторожится. Google Play Payments и App Store 3.1.1 запрещают уводить
// на внешнюю оплату цифрового содержимого, и это отклонение на ревью, а не
// замечание. Решение владельца от 13.09.2026 для первой подачи: внутри
// оболочки платных кнопок нет НИ ОДНОЙ — ни веб-кассы, ни витрины
// магазина, ни цен, ни способов оплаты, ни призыва «смотреть тарифы».
// Платный материал остаётся закрытым, и человеку честно сказано, что он
// закрыт.
//
// ========================================================================
// ПОЧЕМУ СТОРОЖ ПЕРЕПИСАН ВТОРОЙ РАЗ ЗА ДВА ДНЯ.
// ========================================================================
//
// 12.09 (7.183) он спрашивал сервер ОДНИМ способом — запросом с токеном в
// User-Agent, — и не знал, что переходы в приложении делает service worker,
// чей запрос токена не несёт. 13.09 (7.192) обличий стало ТРИ, и это
// закрыло ту дыру целиком.
//
// И всё-таки владелец снял на живом телефоне, аккаунтом БЕЗ подписки, три
// поверхности с кнопкой «Смотреть тарифы»: список курсов в кабинете и три
// закрытые вкладки урока. Ветка на оболочку опять была ни при чём. Не
// хватало сторожу ТРЁХ вещей сразу, и каждая мерится числом:
//
//   1. РОЛЬ. Живая половина делала 4 адреса × 3 обличья = 12 запросов, и
//      НИ ОДИН не нёс сессии: все двенадцать шли анонимом. Из трёх ролей
//      меряли одну, из двух ролей с учётной записью — НОЛЬ. Кабинет без
//      сессии вообще не показывает ни списка курсов, ни кнопок: аноним
//      видел 0 там, где аккаунт без подписки видит 4.
//
//   2. АДРЕС. Из трёх поверхностей, которые снял владелец, в списке из
//      четырёх адресов не было НИ ОДНОЙ. Закрытый урок при этом показывал
//      свои три кнопки даже АНОНИМУ — то есть две поверхности из трёх
//      поймались бы и старой ролью, будь адрес в списке.
//
//   3. СЧЁТ ССЫЛОК. Ссылки считались буквальным `href="/ru/pricing"` — с
//      закрывающей кавычкой. Все ссылки с «куда вернуться» выглядят как
//      `href="/ru/pricing?next=…"`, и их этот счётчик видел как НОЛЬ: на
//      закрытом уроке настоящих ссылок на цены 3, измеритель показывал 0.
//
//   И четвёртая, в статической половине: правило было «файл упоминает
//   isNativeShellRequest». `profile/page.tsx` упоминал (ветка стояла у
//   кнопки подписки), а вторая кнопка в том же файле, семьюстами строк
//   ниже, ветки не имела вовсе — правило по файлу такого не видит по
//   построению.
//
// ========================================================================
// ДВЕ ПОЛОВИНЫ, И ОБЕ ОБЯЗАТЕЛЬНЫ.
// ========================================================================
//
//   1. ЖИВАЯ (`--base=…`) — берёт ОТДАЧУ страниц в ТРЁХ РОЛЯХ (гость,
//      бесплатный аккаунт, подписчик) × ТРЁХ ОБЛИЧЬЯХ запроса (веб,
//      оболочка по токену, оболочка по куке). Позитивных контролей два, и
//      оба не отключаются:
//        • веб-отдача обязана СОДЕРЖАТЬ то, чего в двух других быть не
//          может, — иначе измеритель слеп (ПРАВИЛА ЗАМЕРА 4.1);
//        • `--plant` подсаживает кнопку покупки в нативную отдачу КАЖДОЙ
//          роли: не упавший на этом сторож не умеет судить эту роль вовсе.
//      Роли настоящие: аккаунты заводятся через `/api/auth/register`,
//      подписка выдаётся через `/api/test/grant-subscription`. Поэтому
//      живой половине нужен сервер, поднятый с `E2E_TEST_SEED=1` (его
//      поднимает `scripts/verify-rendered.mjs` отдельно от общего): без
//      этого флага сессионная кука уходит с `Secure` и по http не
//      возвращается вовсе — то есть «вошли» не получилось бы ни у кого.
//      Отказ завести роль — это ОТКАЗ сторожа, а не тихий пропуск роли:
//      именно тихий пропуск и стоил долга 184.
//
//   2. СТАТИЧЕСКАЯ (без `--base`) — по исходникам, дешёвая, стоит в
//      `verify` и в `ci.yml` на каждом коммите. Она отвечает на вопрос, на
//      который живая ответить не может: жив ли САМ механизм — оба признака
//      оболочки, кука в middleware, запрет кеша у воркера, замок вместо
//      пейвола, ветка у каждой из поверхностей поимённо. Разбор идёт ПОСЛЕ
//      вычёркивания комментариев: на «ветку закомментировали» стоит
//      отдельная подсадка (класс 7.182).
//
//   node scripts/check-native-payments.mjs                     # статическая
//   node scripts/check-native-payments.mjs --plant             # её контроль
//   node scripts/check-native-payments.mjs --base=http://…     # живая
//   node scripts/check-native-payments.mjs --base=http://… --plant
import { readFileSync, readdirSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { stripCommentsAndStrings } from "./check-no-runtime-tts.mjs";
import { collectAddresses } from "./route-census.mjs";
import {
  purchaseCtaKeys,
  paymentTargetsInHtml,
  visibleDocument as sharedVisibleDocument,
  judgeControl,
  labelBeyondTopic,
  normalizeLabel,
} from "./purchase-surface-rules.mjs";

const PAGE_FILE = "src/app/[lang]/pricing/page.tsx";
const NOTICE_FILE = "src/components/native/NativeAccessNotice.tsx";
const COPY_FILE = "src/lib/native-access-copy.ts";
const SHELL_FILE = "src/lib/native-shell.ts";
const TOKEN_FILE = "src/lib/native-shell-token.ts";
const PROXY_FILE = "src/proxy.ts";
const SW_FILE = "src/app/sw.ts";
const PAYWALL_FILE = "src/contexts/PaywallContext.tsx";
const CHECKOUT_FILE = "src/app/api/checkout/route.ts";
const HOME_FILE = "src/app/[lang]/page.tsx";
const NAVBAR_FILE = "src/components/Navbar.tsx";
const PROFILE_FILE = "src/app/[lang]/profile/page.tsx";
const CAPACITOR_FILE = "capacitor.config.ts";
// Поверхности, добавленные долгом 184 (все — с кнопкой покупки, которую
// заход 7.192 не увидел) и долгами 186–188.
const LESSON_VIEW_FILE = "src/components/lesson/LessonView.tsx";
const LESSON_PAGE_FILE = "src/app/[lang]/courses/[level]/[lesson]/page.tsx";
const LEVEL_FILE = "src/app/[lang]/courses/[level]/page.tsx";
const STORY_FILE = "src/app/[lang]/stories/[id]/page.tsx";
const MEDIA_FILE = "src/app/[lang]/media/[id]/page.tsx";
const VOCAB_FILE = "src/app/[lang]/vocabulary/page.tsx";
const VOCAB_CAT_FILE = "src/app/[lang]/vocabulary/[categoria]/page.tsx";
const EXAM_FILE = "src/app/[lang]/courses/[level]/exam/[examSlug]/page.tsx";
const WORD_GAME_FILE = "src/app/[lang]/word-games/[type]/[level]/[sequence]/page.tsx";
const SEARCH_API_FILE = "src/app/api/search/route.ts";
const SEARCH_UI_FILE = "src/components/GlobalSearch.tsx";
const FOOTER_FILE = "src/components/Footer.tsx";
/** Единственная точка, через которую словарь и идиомы говорят про закрытое. */
const CHOKEPOINT_FILE = "src/components/flashcards/FreeTrialLimitBanner.tsx";
/** Признак «этот файл спрашивает про оболочку» — своей веткой или через
 *  единственную точку. */
const BRANCH_OR_CHOKEPOINT =
  /isNativeShellRequest|nativeShell|useIsNativeShell|nativeAccessCopy|NativeLockedLink|NativeLockedNotice|FreeTrialLimitBanner|LockedOrEmpty|lockedTarget|closedNote/;

const SOURCES = [
  PAGE_FILE, NOTICE_FILE, COPY_FILE, SHELL_FILE, TOKEN_FILE, PROXY_FILE, SW_FILE,
  PAYWALL_FILE, CHECKOUT_FILE, HOME_FILE, NAVBAR_FILE, PROFILE_FILE, CAPACITOR_FILE,
  LESSON_VIEW_FILE, LESSON_PAGE_FILE, LEVEL_FILE, STORY_FILE, MEDIA_FILE,
  VOCAB_FILE, VOCAB_CAT_FILE, EXAM_FILE, WORD_GAME_FILE, SEARCH_API_FILE,
  SEARCH_UI_FILE, FOOTER_FILE,
];

// Строки, которых в нативной отдаче быть не должно.
//   `action="/api/checkout"` — наша собственная веб-касса;
//   `stripe.com`             — домен внешнего платёжного сервиса;
//   `MXN`                    — цена; внутри приложения цен нет вовсе;
//   `OXXO`                   — сторонний способ оплаты, названный по имени;
//   `/pricing`               — вход на страницу цен, в любом виде.
const FORM_MARK = 'action="/api/checkout"';
const STRIPE_MARK = "stripe.com";
const PRICE_MARK = "MXN";
const CASH_MARK = "OXXO";
const PRICING_PATH_MARK = "/pricing";

const FORBIDDEN_TEXT = [FORM_MARK, STRIPE_MARK, PRICE_MARK, CASH_MARK, PRICING_PATH_MARK];

const TOKEN = "RFNativeShell";
const COOKIE = "rf_native_shell";

function read(path) {
  return readFileSync(path, "utf8");
}

/**
 * Спрашивает про оболочку — сам или через того, кому передал строку
 * дальше.
 *
 * Вторая половина обязательна, и вот почему. `VocabularyApp.tsx` строку
 * не отрисовывает вовсе: он раскладывает словарь по четырём режимам и
 * передаёт подпись пропом. Требовать ветку от него значило бы требовать
 * её в месте, где решать нечего, — и, что хуже, приучить ставить туда
 * ветку-пустышку. Поэтому файл считается защищённым, если защищены ВСЕ
 * файлы, которым он эту же строку передаёт: решение живёт там, где текст
 * попадает в документ.
 *
 * `visited` — от циклического импорта: он в React-дереве обычное дело.
 */
function isGuarded(file, files, mentions, visited) {
  if (visited.has(file.path)) return true;
  visited.add(file.path);
  if (BRANCH_OR_CHOKEPOINT.test(file.body)) return true;
  const imported = files.filter(
    (other) => other.path !== file.path && mentions(other) && importsEachOther(file, other),
  );
  if (imported.length === 0) return false;
  return imported.every((other) => isGuarded(other, files, mentions, visited));
}

/** Импортирует ли `file` модуль `other` — по имени файла в строке импорта. */
function importsEachOther(file, other) {
  const name = other.path.split("/").pop().replace(/\.tsx?$/, "");
  return new RegExp(`from "[^"]*\\b${name}"`).test(file.body);
}

/** Все .ts/.tsx под src/, с уже вычеркнутыми комментариями: закомментированная
 *  ветка веткой не является (класс 7.182). */
function sourceFilesUnderSrc(dir = "src") {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) {
      out.push(...sourceFilesUnderSrc(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push({ path: full, body: stripCommentsOnly(readFileSync(full, "utf8")) });
    }
  }
  return out;
}

/**
 * ПОДПИСИ ПЛАТНЫХ ОРГАНОВ УПРАВЛЕНИЯ — ИЗ САМИХ СЛОВАРЕЙ, А НЕ СПИСКОМ
 * ЗДЕСЬ.
 *
 * Списка, переписанного руками, хватило бы ровно до первой правки текста:
 * «Смотреть тарифы» → «Открыть тарифы», и сторож молчит на той же самой
 * кнопке. Читая строку по её КЛЮЧУ, он ловит кнопку, как бы её ни
 * переименовали, и падает сам, если ключ исчез, — то есть отказывается
 * судить вслепую.
 */
const DICTIONARIES = () => ({
  ru: JSON.parse(read("src/dictionaries/ru.json")),
  es: JSON.parse(read("src/dictionaries/es.json")),
});

/**
 * ПОДПИСИ ПЛАТНЫХ ОРГАНОВ — ПЕРЕПИСЬ СЛОВАРЕЙ, А НЕ СПИСОК КЛЮЧЕЙ.
 *
 * Здесь стоял список из 15 ключей, переписанный рукой, и он промахнулся
 * ровно так, как рукописный список только и может: `vocabulary.freeTrialLimitCta`
 * и `vocabulary.idioms.freeTrialLimitCta` — те самые две кнопки, которые
 * владелец нашёл на телефоне, — в него не входили. 0 подписей из 2.
 *
 * Теперь словари обходятся целиком, и платной считается КАЖДАЯ строка,
 * которая по смыслу зовёт оформить подписку (`STRONG_PURCHASE` в
 * `purchase-surface-rules.mjs`). Число печатается: на 14.09.2026 таких
 * строк 27 против 15 в прежнем списке.
 */
function purchaseLabels(locale) {
  const all = purchaseCtaKeys(DICTIONARIES());
  return all.filter((entry) => entry.locale === locale).map((entry) => entry.value);
}

/** Только комментарии, строки на месте: часть правил спрашивает именно про
 *  строковые литералы (токен, адрес кассы, имя куки). */
function stripCommentsOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/** Статическая половина. Судит по ЖИВОМУ коду. */
function judgeSources(sources) {
  const problems = [];
  const live = Object.fromEntries(SOURCES.map((f) => [f, stripCommentsAndStrings(sources[f])]));
  const text = Object.fromEntries(SOURCES.map((f) => [f, stripCommentsOnly(sources[f])]));

  // --- 1. страница цен уходит на объяснение ПЕРВОЙ строкой ---------------
  //
  // Отсчёт идёт от тела САМОЙ страницы, а не от начала файла: с 13.09.2026
  // ветка на оболочку есть ещё и в `generateMetadata` (описание страницы
  // тоже называло OXXO). Считай сторож от начала файла — подсадка «ветка
  // переехала вниз» проходила бы насквозь, потому что первое вхождение
  // стоит выше любых карточек всегда. Поймано прогоном verify.
  const bodyAt = live[PAGE_FILE].indexOf("export default async function PricingPage");
  const body = bodyAt === -1 ? live[PAGE_FILE] : live[PAGE_FILE].slice(bodyAt);
  if (bodyAt === -1) {
    problems.push(`${PAGE_FILE}: не найдено тело страницы (export default async function PricingPage)`);
  }
  const branchAt = body.indexOf("isNativeShellRequest(");
  if (branchAt === -1) {
    problems.push(`${PAGE_FILE}: ветки на нативную оболочку нет в живом коде (isNativeShellRequest не вызывается)`);
  }
  if (body.indexOf("<NativeAccessNotice") === -1) {
    problems.push(`${PAGE_FILE}: честное объяснение NativeAccessNotice не отрисовывается`);
  }
  const webAt = body.indexOf("<SubscriptionCard");
  if (branchAt !== -1 && webAt !== -1 && branchAt > webAt) {
    problems.push(`${PAGE_FILE}: ветка на оболочку стоит ПОСЛЕ веб-карточек — формы успеют отрисоваться`);
  }
  // Витрина магазина возвращаться не должна: пока продуктов в консолях нет,
  // её кнопка не делает ничего (замер 7.192), а нерабочая кнопка — дефект.
  if (text[PAGE_FILE].includes("NativePricingPanel")) {
    problems.push(`${PAGE_FILE}: вернулась витрина магазина NativePricingPanel — её кнопка покупки не работает без продуктов`);
  }

  // --- 2. в объяснении нет ничего платного --------------------------------
  for (const file of [NOTICE_FILE, COPY_FILE]) {
    for (const mark of ["/api/checkout", "stripe", CASH_MARK, PRICE_MARK]) {
      if (text[file].includes(mark)) {
        problems.push(`${file}: упоминает «${mark}» — внутри приложения это платёжная поверхность`);
      }
    }
    // Цифра цены: `$150`, «150 песо», «150 pesos». Не голый «$» — он стоит
    // в каждой подстановке шаблонной строки (`${lang}`) и поймал бы ссылку
    // на курс. Поймано первым же прогоном.
    const priceLike = text[file].match(/\$\s?\d|\d+\s*(?:MXN|песо|pesos)/i);
    if (priceLike) {
      problems.push(`${file}: содержит цену «${priceLike[0]}» — внутри приложения цен нет вовсе`);
    }
    if (/<button/.test(live[file])) {
      problems.push(`${file}: содержит кнопку — внутри приложения платных органов управления нет ни одного`);
    }
  }
  // Строка, которая стоит на месте кнопок покупки на самих страницах
  // (долг 184). Без неё карточка закрытого материала осталась бы без
  // единого слова о том, почему она закрыта.
  if (!text[COPY_FILE].includes("closedNote")) {
    problems.push(`${COPY_FILE}: нет строки closedNote — заменить кнопку покупки на объяснение нечем`);
  }

  // --- 3. признаков оболочки ДВА, и второй — кука -------------------------
  if (!live[SHELL_FILE].includes("userAgentIsNativeShell")) {
    problems.push(`${SHELL_FILE}: признак по User-Agent не спрашивается`);
  }
  if (!live[SHELL_FILE].includes("NATIVE_SHELL_COOKIE")) {
    problems.push(
      `${SHELL_FILE}: признака по КУКЕ нет. Переходы в приложении делает service worker, и его ` +
        `запрос токена в User-Agent не несёт — ровно так веб-касса и вернулась внутрь приложения (долг 179)`,
    );
  }
  if (!text[TOKEN_FILE].includes(`"${TOKEN}"`)) {
    problems.push(`${TOKEN_FILE}: токена нативной оболочки «${TOKEN}» нет в живом коде`);
  }
  if (!text[TOKEN_FILE].includes(`"${COOKIE}"`)) {
    problems.push(`${TOKEN_FILE}: имени куки «${COOKIE}» нет в живом коде`);
  }
  if (!text[CAPACITOR_FILE].includes(`"${TOKEN}"`)) {
    problems.push(`${CAPACITOR_FILE}: токена «${TOKEN}» нет — оболочка перестанет отличаться от браузера`);
  }
  if (!text[CAPACITOR_FILE].includes("appendUserAgent")) {
    problems.push(`${CAPACITOR_FILE}: appendUserAgent не задан — сервер не увидит оболочку вовсе`);
  }

  // --- 4. куку ставит middleware, и на ЛЮБОМ ответе ------------------------
  if (!live[PROXY_FILE].includes("userAgentIsNativeShell")) {
    problems.push(`${PROXY_FILE}: middleware не узнаёт оболочку — куку ставить некому`);
  }
  if (!/response\.cookies\.set\(\s*NATIVE_SHELL_COOKIE/.test(live[PROXY_FILE])) {
    problems.push(`${PROXY_FILE}: кука нативной оболочки не ставится`);
  }

  // --- 5. воркер не кеширует платёжные страницы ---------------------------
  if (!live[SW_FILE].includes("PAYMENT_PATH")) {
    problems.push(
      `${SW_FILE}: платёжные страницы снова кешируются. Копия веб-кассы, однажды положенная в кеш, ` +
        `переживёт любую серверную ветку и покажется внутри приложения (долг 179)`,
    );
  }
  if (!live[SW_FILE].includes("dropCachedPaymentPages")) {
    problems.push(`${SW_FILE}: уже лежащие в кеше копии страницы цен не убираются при выкате`);
  }

  // --- 6. вместо пейвола — замок, и ни одной платной кнопки ---------------
  if (!live[PAYWALL_FILE].includes("NativeLockedModal")) {
    problems.push(`${PAYWALL_FILE}: внутри оболочки не открывается замок — по тапу на закрытое не будет ничего`);
  }
  for (const mark of ["useRevenueCat", "presentNativePaywall", "Capacitor"]) {
    if (live[PAYWALL_FILE].includes(mark)) {
      problems.push(
        `${PAYWALL_FILE}: снова зовёт «${mark}». Витрина магазина без заведённых продуктов молча ` +
          `отвечает отказом, и наружу это выглядит как кнопка, не делающая ничего (часть 2 захода 7.192)`,
      );
    }
  }

  // --- 7. касса отказывает оболочке и на уровне маршрута ------------------
  if (!live[CHECKOUT_FILE].includes("userAgentIsNativeShell")) {
    problems.push(`${CHECKOUT_FILE}: маршрут кассы не отказывает оболочке — скрытый орган не закрытая дверь`);
  }

  // --- 8. КАЖДАЯ платная поверхность ветвится, И КАЖДЫЙ ВХОД В НЕЙ --------
  //
  // Правило «файл упоминает isNativeShellRequest» тут было и оказалось
  // недостаточным по построению: в `profile/page.tsx` ветка стояла у одной
  // кнопки, а вторая, семьюстами строк ниже, осталась без неё, и файл
  // считался чистым (долг 184). Поэтому спрашивается не файл, а КАЖДОЕ
  // место, где в исходнике появляется вход на страницу цен: у него обязана
  // быть ветка на оболочку в пределах видимости — своя или общая.
  const PRICING_ENTRY = /\/\$\{lang\}\/pricing|\/es\/pricing|\/ru\/pricing/;
  // `nativeAccessCopy` и `NativeLockedLink` — тоже признаки ветки: обе
  // существуют ТОЛЬКО внутри оболочки и нигде больше не зовутся.
  const BRANCH_TOKEN = /isNativeShellRequest|nativeShell|nativeAccessCopy|NativeLockedLink|lockedTarget/;
  for (const [file, what] of [
    [HOME_FILE, "главная (плитка OXXO и полоса цен)"],
    [NAVBAR_FILE, "шапка и мобильное меню (ссылка «Цены»)"],
    [PROFILE_FILE, "личный кабинет (кнопка подписки, список курсов, апсейлы)"],
    [LESSON_PAGE_FILE, "страница урока (закрытые вкладки)"],
    [LEVEL_FILE, "список уроков уровня (закрытая плитка)"],
    [STORY_FILE, "страница рассказа (замок)"],
    [MEDIA_FILE, "страница видео (замок)"],
    [VOCAB_FILE, "словарь (подпись про C1)"],
    [VOCAB_CAT_FILE, "категория словаря (подпись про C1)"],
    [EXAM_FILE, "экзамен (увод закрытого)"],
    [WORD_GAME_FILE, "филворд (увод закрытого)"],
    [SEARCH_API_FILE, "выдача поиска (запись «Цены»)"],
    [FOOTER_FILE, "подвал (ссылка «Скачать приложение»)"],
  ]) {
    /**
     * ИМЯ СВОЙСТВА — НЕ ВОПРОС ПРО ОБОЛОЧКУ (7.196).
     *
     * Найдено подсадкой, а не рассуждением. 7.196 завёл общее правило
     * знака `accessSignFor(requirement, tier, { nativeShell: … })`, и с
     * этого дня страница рассказа содержала строку `nativeShell:` даже
     * после того, как подсадка вычеркнула из неё ВСЕ настоящие вызовы
     * `isNativeShellRequest`. Правило ниже засчитывало это как ветку, и
     * подсадка «замок рассказа снова зовёт покупать» перестала ловиться:
     * 34 из 35 вместо 35 из 35.
     *
     * Ключ объекта вычёркивается ДО проверки. Настоящий вопрос про
     * оболочку — это вызов или чтение значения, а не слово в позиции
     * имени поля.
     */
    const source = live[file].replace(/\bnativeShell\s*:/g, "");
    if (!source.includes("isNativeShellRequest") && !source.includes("nativeShell")) {
      problems.push(`${file}: ${what} не спрашивает про оболочку — платный вход остался на месте`);
      continue;
    }
    // Каждая строка исходника со входом на страницу цен: сколько их всего
    // и сколько из них стоит рядом с веткой. «Рядом» — в пределах того же
    // выражения: двадцать строк вверх от входа. Больше не берём намеренно,
    // иначе ветка у соседней кнопки снова закрывала бы чужую.
    //
    // Читается `text`, а не `live`: адрес страницы цен — это СТРОКОВЫЙ
    // литерал, и `stripCommentsAndStrings` вычёркивает его вместе со всеми
    // остальными строками. На `live` правило не находило ни одного входа
    // вовсе и молчало на подсадке «список курсов снова ведёт на цены» —
    // поймано первым же прогоном --plant. Комментарии при этом вычеркнуты,
    // так что «ветку закомментировали» это правило по-прежнему видит.
    // КАЖДЫЙ вход на страницу цен обязан стоять внутри выражения,
    // которое спрашивает про оболочку. Проверяется НАСТОЯЩЕЙ вложенностью,
    // а не расстоянием в строках и не отступом: и то и другое пробовали, и
    // оба врут. Окно в двадцать строк ругалось на здоровую полосу цен
    // главной (там между веткой и ссылкой лежат 42 строки карточек), а
    // отступ — на `{!nativeShell && (` и `<section …>`, написанные на
    // одном уровне.
    //
    // Разбор идёт НАЗАД по символам и считает незакрытые скобки: каждая
    // скобка, из которой мы вышли, — это объемлющее выражение, и у него
    // спрашивается голова (что написано перед скобкой) и начало тела (что
    // сразу после неё). Ветка может стоять и там и там: `{!nativeShell && (`
    // — перед, `{nativeShell ? null : (` — после.
    const body = text[file];
    const WINDOW = 140;
    const STATEMENT_WINDOW = 320;
    let at = -1;
    while ((at = body.indexOf("/pricing", at + 1)) !== -1) {
      const lineStart = body.lastIndexOf("\n", at) + 1;
      const lineEnd = body.indexOf("\n", at);
      const lineText = body.slice(lineStart, lineEnd === -1 ? body.length : lineEnd);
      if (!PRICING_ENTRY.test(lineText)) continue;
      let depth = 0;
      // Ветка может стоять и в ТОМ ЖЕ выражении, без объемлющей скобки —
      // `const lockedTarget = (await isNativeShellRequest()) ? … : …` или
      // длинная цепочка тернарников в кабинете. Скобочный разбор такую не
      // видит (скобки в ней сбалансированы), поэтому сначала спрашивается
      // окрестность самого входа.
      let guarded = BRANCH_TOKEN.test(body.slice(Math.max(0, at - STATEMENT_WINDOW), at + STATEMENT_WINDOW));
      for (let k = at; k >= 0 && !guarded; k -= 1) {
        const ch = body[k];
        if (ch === ")" || ch === "}") depth += 1;
        else if (ch === "(" || ch === "{") {
          if (depth > 0) {
            depth -= 1;
            continue;
          }
          const around = body.slice(Math.max(0, k - WINDOW), k) + body.slice(k, k + WINDOW);
          if (BRANCH_TOKEN.test(around)) guarded = true;
        }
      }
      if (!guarded) {
        const lineNo = body.slice(0, at).split("\n").length;
        problems.push(
          `${file}:${lineNo}: вход на страницу цен вне выражения, спрашивающего про оболочку — ` +
            `ровно этот класс дефекта и был долгом 184`,
        );
      }
    }
  }
  // Быстрый список поиска и выдача по строке — РАЗНЫЕ места, и в 7.192
  // закрыли только первое (долг 187).
  if (!live[SEARCH_UI_FILE].includes("nativeShell")) {
    problems.push(`${SEARCH_UI_FILE}: быстрый список поиска не спрашивает про оболочку`);
  }
  if (!live[SEARCH_API_FILE].includes('"pricing"')  && !stripCommentsOnly(sources[SEARCH_API_FILE]).includes('"pricing"')) {
    problems.push(`${SEARCH_API_FILE}: запись «Цены» не вырезается из выдачи внутри оболочки (долг 187)`);
  }
  // Замок урока ведёт себя как замок рассказа (долг 185).
  if (!live[LEVEL_FILE].includes("NativeLockedLink")) {
    problems.push(
      `${LEVEL_FILE}: закрытая плитка урока не открывает окно «Этот материал закрыт» — ` +
        `закрытый урок снова ведёт себя не так, как закрытый рассказ (долг 185)`,
    );
  }
  // Реферальный блок — тоже призыв к покупке (долг 186).
  if (!/nativeShell \? null : \(\s*\n?\s*<Card>/.test(sources[PROFILE_FILE])) {
    problems.push(`${PROFILE_FILE}: реферальный блок «Приглашай и получай» не скрыт внутри оболочки (долг 186)`);
  }
  problems.push(...chokepointProblems(sources));
  return problems;
}

/**
 * КАЖДАЯ ПОДПИСЬ ПОКУПКИ ИЗ СЛОВАРЕЙ ОТРИСОВЫВАЕТСЯ ЧЕРЕЗ ВЕТКУ НА
 * ОБОЛОЧКУ — ДОЛГ 191, ПРАВИЛО, КОТОРОГО ЗДЕСЬ НЕ БЫЛО ВОВСЕ.
 *
 * Прежние правила спрашивали ИМЕНОВАННЫЕ файлы: «а есть ли ветка в
 * `profile/page.tsx`». Список файлов писался рукой и отставал от продукта
 * ровно так же, как список адресов: кнопку «Оформить подписку» рисовал
 * `FreeTrialLimitBanner.tsx`, которого в списке не было, — и он был чист
 * по всем 13 правилам сразу.
 *
 * Здесь спрашивается не файл, а СТРОКА. Перепись словарей даёт все
 * подписи покупки (27 на 14.09.2026); для каждой ищется КАЖДОЕ место в
 * `src/`, где её ключ упоминается, и каждое такое место обязано либо само
 * спрашивать про оболочку, либо быть единственной точкой, которая это
 * делает за него (`FreeTrialLimitBanner` — она же и проверяется отдельно
 * ниже: если из неё пропадёт `useIsNativeShell`, точка перестанет быть
 * точкой, и правило покраснеет).
 *
 * Файлы `/admin/` исключены не списком, а признаком: в оболочке этих
 * маршрутов нет ни у одной из трёх ролей (сотрудничьи страницы требуют
 * роли staff), и подписи там про выдачу доступа рукой, а не про покупку.
 */
function chokepointProblems(overrides = {}) {
  const problems = [];
  // Подмена (`--plant`) действует и здесь: правило, которое читает диск
  // мимо подсадки, контролю не поддаётся вовсе.
  const dictionaries = {
    ru: JSON.parse(overrides["src/dictionaries/ru.json"] ?? read("src/dictionaries/ru.json")),
    es: JSON.parse(overrides["src/dictionaries/es.json"] ?? read("src/dictionaries/es.json")),
  };
  const keys = purchaseCtaKeys(dictionaries);
  // Одна и та же строка живёт в двух словарях; ключ у неё один.
  const uniqueKeys = [...new Set(keys.map((entry) => entry.key))];
  const files = sourceFilesUnderSrc().map((file) =>
    overrides[file.path] ? { path: file.path, body: stripCommentsOnly(overrides[file.path]) } : file,
  );

  // Единственная точка обязана оставаться точкой.
  const banner = overrides[CHOKEPOINT_FILE] ?? read(CHOKEPOINT_FILE);
  for (const mark of ["useIsNativeShell", "NativeLockedNotice"]) {
    if (!banner.includes(mark)) {
      problems.push(
        `${CHOKEPOINT_FILE}: нет «${mark}» — единственная точка, через которую словарь и идиомы ` +
          `говорят про закрытое, перестала спрашивать про оболочку (долг 191)`,
      );
    }
  }

  for (const key of uniqueKeys) {
    // Место отрисовки ищется по ДВУМ последним частям ключа, а не по
    // одной. Заплачено первым же прогоном: у `lesson.locked.cta` последняя
    // часть — `cta`, и по ней в «отрисовывает платную подпись» попали
    // `FreeTierCard.tsx` и `FirstStepCards.tsx`, где своё собственное
    // слово `cta` и никакого отношения к подписке. Требование «и
    // родитель, и лист» это снимает, оставаясь независимым от того, как
    // именно вызывающий разобрал объект (`dict.locked.cta`,
    // `{ cta } = dict.locked`, `lockedDict.cta` — все три проходят).
    const parts = key.split(".");
    const leaf = parts[parts.length - 1];
    const parent = parts.length > 1 ? parts[parts.length - 2] : null;
    // Границы слова заданы явно, а не через `\b`: в JS `\b` считает
    // словесными только ASCII-символы, и ключ с кириллицей (а такие
    // заводятся легко) не находился бы вовсе — поймано подсадкой.
    const word = (name) => new RegExp(`(?<![\\p{L}\\p{N}_])${name}(?![\\p{L}\\p{N}_])`, "u");
    const mentions = (file) =>
      word(leaf).test(file.body) && (parent === null || word(parent).test(file.body));
    const users = files.filter((file) => !file.path.includes("/admin/") && mentions(file));
    if (users.length === 0) continue; // строка в словаре есть, в коде не зовётся — не наше дело
    for (const file of users) {
      // Для делегирования спрашивается только ЛИСТ: получатель пропа не
      // обязан знать, из какой ветки словаря строка пришла — у
      // `FlashcardsApp` нет и не должно быть слова «vocabulary».
      const mentionsLeaf = (other) => word(leaf).test(other.body);
      const guarded = isGuarded(file, files, mentionsLeaf, new Set());
      if (!guarded) {
        problems.push(
          `${file.path}: отрисовывает платную подпись «${key}» и не спрашивает про оболочку ` +
            `ни сам, ни через единственную точку — ровно этим и был долг 191`,
        );
      }
    }
  }
  return problems;
}

function countOf(haystack, needle) {
  return haystack.split(needle).length - 1;
}

// `visibleDocument` и перепись платёжных целей переехали в
// `scripts/purchase-surface-rules.mjs`: их читают обе половины сторожа.
const visibleDocument = sharedVisibleDocument;

const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

/** Три обличья запроса. `web` — обычный браузер; `token` — оболочка, как её
 *  видит прямой переход webview; `cookie` — оболочка, как её видит запрос
 *  service worker'а: токена нет, кука есть. */
async function fetchPage(base, path, disguise, session) {
  const headers = { "user-agent": disguise === "token" ? `${SAFARI} ${TOKEN}` : SAFARI };
  const jar = [session, disguise === "cookie" ? `${COOKIE}=1` : ""].filter(Boolean).join("; ");
  if (jar) headers.cookie = jar;
  const res = await fetch(`${base}${path}`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${path} (${disguise}) ответил ${res.status}`);
  return res.text();
}

/**
 * Настоящий аккаунт. Не изображённый заголовком и не «как если бы»: ровно
 * та же регистрация, что у человека, и ровно та же выдача подписки, что у
 * прогона Playwright.
 */
async function makeSession(base, withSubscription) {
  const email = `guard-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const registered = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": SAFARI },
    body: new URLSearchParams({ email, password: "TestPass123!", lang: "ru", redirectTo: "/ru" }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const jar = registered.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
  if (!jar) {
    throw new Error(
      `не удалось завести роль: POST /api/auth/register ответил ${registered.status} и не отдал сессионной куки. ` +
        `Сервер поднят без E2E_TEST_SEED=1? Тогда кука уходит с Secure и по http не возвращается. ` +
        `Тихо пропустить роль нельзя: ровно так и появился долг 184.`,
    );
  }
  if (withSubscription) {
    const granted = await fetch(`${base}/api/test/grant-subscription`, {
      method: "POST",
      headers: { cookie: jar, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(30_000),
    });
    if (!granted.ok) {
      throw new Error(
        `не удалось выдать подписку роли «подписчик»: /api/test/grant-subscription ответил ${granted.status}. ` +
          `Этот маршрут живёт только при E2E_TEST_SEED=1.`,
      );
    }
  }
  return jar;
}

/**
 * ДВА ПРАВОВЫХ ДОКУМЕНТА — ЕДИНСТВЕННОЕ ИСКЛЮЧЕНИЕ, И ОНО ЗАКРЕПЛЕНО
 * ИМЕНЕМ.
 *
 * Перестроенный прибор нашёл на `/es/terms` и `/ru/terms` слова «MXN» и
 * «OXXO» — по 3 вхождения на страницу, во всех трёх ролях. Разобрано:
 * это не платёжная поверхность. Ни одного органа управления, ни одной
 * ссылки на оплату там нет; это условия использования, которые ОПИСЫВАЮТ,
 * как устроена оплата на сайте («базовая цена установлена в мексиканских
 * песо», «кроме карты принимаем наличные по ваучеру OXXO»).
 *
 * Почему текст не правится. Документ обязан быть правдой — за этим
 * следит `check:legal-truth`, — а на сайте оплата устроена именно так.
 * Написать в условиях, что оплаты нет, значило бы соврать вебу ради
 * приложения.
 *
 * Почему исключение именно такое узкое: правило про цены остаётся в силе
 * на ВСЕХ 130 остальных адресах, а два эти названы поимённо, чтобы
 * появление третьего роняло сторож, а не пополняло молчаливую привычку.
 *
 * ЭТО РАЗВИЛКА ВЛАДЕЛЬЦА, и она вынесена в отчёт: Google запрещает
 * УВОДИТЬ на внешнюю оплату; описание порядка оплаты в условиях
 * использования — серая зона, и решать, убирать ли абзац из приложения
 * (ценой расхождения документа с сайтом), владельцу, а не прибору.
 */
const LEGAL_DOCUMENT_PATHS = new Set(["/es/terms", "/ru/terms"]);

/** Судит ОДИН ответ по нативным правилам. Возвращает список проблем. */
function judgeNative(html, where, labels, { legalDocument = false } = {}) {
  const problems = [];
  const visible = visibleDocument(html);
  for (const mark of FORBIDDEN_TEXT) {
    if (legalDocument && (mark === PRICE_MARK || mark === CASH_MARK)) continue;
    const n = countOf(visible, mark);
    if (n > 0) problems.push(`${where}: в видимом документе ${n} вхождений «${mark}»`);
  }
  const links = paymentTargetsInHtml(html);
  if (links.length > 0) {
    problems.push(`${where}: ${links.length} входов на платёжную поверхность — ${[...new Set(links)].join(", ")}`);
  }
  for (const label of labels) {
    const n = countOf(visible, label);
    if (n > 0) problems.push(`${where}: ${n} вхождений подписи платной кнопки «${label.slice(0, 60)}»`);
  }
  return problems;
}

/** Подсадка: кнопка покупки, вставленная в нативную отдачу. Сторож обязан
 *  упасть на ней в КАЖДОЙ роли — иначе он эту роль не судит вовсе. */
function plantPurchaseButton(html, lang) {
  return html.replace(
    "</body>",
    `<a href="/${lang}/pricing?next=/${lang}/courses/a1/2">подсадка</a></body>`,
  );
}

/** Очередь с ограничением одновременности: 132 адреса × 3 роли × 2
 *  обличья — это 792 запроса, и последовательно они идут минутами. */
async function pool(items, limit, worker) {
  const results = [];
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * ЖИВАЯ ПОЛОВИНА ПО HTTP. Множество адресов СОБИРАЕТСЯ (см.
 * `scripts/route-census.mjs`), рукописного списка здесь больше нет.
 *
 * Позитивный контроль тоже перестал быть рукописным. Раньше у КАЖДОГО
 * адреса руками было записано, у каких ролей веб-отдача обязана нести
 * платный вход, — и список этот старел ровно так же, как список адресов.
 * Теперь контроль выводится из замера: по всему множеству в КАЖДОЙ роли
 * веб-отдача обязана показать хотя бы один платный вход, иначе измеритель
 * слеп и его ноль в оболочке не доказывает ничего. Плюс обязательная
 * подсадка (`--plant`), которая роняет сторож в каждой из трёх ролей.
 */
async function live(base, plant) {
  const problems = [];
  const caughtByRole = { guest: 0, free: 0, sub: 0 };
  const labels = { ru: purchaseLabels("ru"), es: purchaseLabels("es") };

  const census = await collectAddresses(base);
  console.log(
    `  адреса собраны: ${census.patterns.length} шаблонов app router + ${census.sitemapCount} адресов карты сайта → ` +
      `${census.addresses.length} проверяемых адресов (представители заменяют ${census.represented} адресов карты сайта)`,
  );
  if (census.unreachable.length) {
    console.log(
      `  шаблонов без живого представителя: ${census.unreachable.length} — ${census.unreachable.join(", ")} ` +
        `(в карте сайта их нет; молча выброшены не были)`,
    );
  }

  const sessions = {
    guest: "",
    free: await makeSession(base, false),
    sub: await makeSession(base, true),
  };
  console.log(`  роли: гость (без сессии), бесплатный аккаунт, подписчик — 3 из 3, все настоящие`);

  const jobs = [];
  for (const path of census.addresses) {
    for (const role of Object.keys(sessions)) jobs.push({ path, role });
  }

  const webPaidByRole = { guest: 0, free: 0, sub: 0 };
  let skipped = 0;
  const outcomes = await pool(jobs, 8, async ({ path, role }) => {
    const lang = path.slice(1, 3);
    const jar = sessions[role];
    const out = { problems: [], planted: 0, webPaid: 0, skipped: false };
    let web;
    try {
      web = await fetchPage(base, path, "web", jar);
    } catch {
      // Не 200 — страница этой роли не открывается вовсе (админка, чужая
      // группа). Считается и печатается, а не глотается.
      out.skipped = true;
      return out;
    }
    const legalDocument = LEGAL_DOCUMENT_PATHS.has(path);
    out.webPaid = judgeNative(web, "контроль", labels[lang], { legalDocument }).length;
    for (const disguise of ["token", "cookie"]) {
      let raw;
      try {
        raw = await fetchPage(base, path, disguise, jar);
      } catch {
        continue;
      }
      const judged = plant ? plantPurchaseButton(raw, lang) : raw;
      const found = judgeNative(judged, `${path} (${role}/${disguise})`, labels[lang], { legalDocument });
      if (plant) out.planted += found.length;
      else out.problems.push(...found);
    }
    return out;
  });

  for (let i = 0; i < jobs.length; i += 1) {
    const { role } = jobs[i];
    const out = outcomes[i];
    if (out.skipped) {
      skipped += 1;
      continue;
    }
    webPaidByRole[role] += out.webPaid;
    caughtByRole[role] += out.planted;
    problems.push(...out.problems);
  }

  console.log(
    `  запросов: ${census.addresses.length} адресов × 3 роли × 2 обличья = ${census.addresses.length * 6}; ` +
      `не открылось этой роли: ${skipped} сочетаний адрес×роль`,
  );

  if (plant) {
    for (const [role, n] of Object.entries(caughtByRole)) {
      console.log(`  роль ${role.padEnd(5)} — подсадка поймана ${n} раз${n === 0 ? " (ПРОПУЩЕНО)" : ""}`);
      if (n === 0) {
        console.error(`  роль ${role}: подсаженная кнопка покупки НЕ уронила сторож — эта роль не судится вовсе`);
        return [];
      }
    }
    return problems.length ? problems : ["подсадка сработала во всех трёх ролях"];
  }

  // Встроенный позитивный контроль измерителя: в вебе платные входы
  // обязаны находиться в каждой роли.
  for (const [role, n] of Object.entries(webPaidByRole)) {
    console.log(`  роль ${role.padEnd(5)} — платных входов в ВЕБ-отдаче по всему множеству: ${n}`);
    if (n === 0) {
      problems.push(
        `роль ${role}: по ВСЕМУ множеству адресов веб-отдача не показала НИ ОДНОГО платного входа — ` +
          `измеритель слеп, и его ноль в оболочке не доказывает ничего`,
      );
    }
  }
  return problems;
}

/** Подсадка «ветку закомментировали»: живой код исчезает, текст остаётся. */
function commentOutBranch(source) {
  return source
    .split("\n")
    .map((line) =>
      line.includes("isNativeShellRequest") || line.includes("NativeAccessNotice") ? `// ${line}` : line,
    )
    .join("\n");
}

/** Подсадка «ветка переехала вниз»: блок вырезается и вставляется в конец
 *  функции — текстуально он на месте, а карточки собираются раньше него. */
function moveBranchToTheEnd(source) {
  const startMark = "  if (await isNativeShellRequest()) {";
  const from = source.indexOf("export default async function PricingPage");
  const start = source.indexOf(startMark, from === -1 ? 0 : from);
  if (start === -1) throw new Error("подсадка не нашла ветку — сторож и подсадка разошлись");
  const endMark = "\n  }\n";
  const end = source.indexOf(endMark, start);
  if (end === -1) throw new Error("подсадка не нашла конец ветки");
  const block = source.slice(start, end + endMark.length);
  const without = source.slice(0, start) + source.slice(end + endMark.length);
  return without.replace(/\n\}\n$/, `\n${block}}\n`);
}

async function main() {
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  const plant = process.argv.includes("--plant");

  if (baseArg) {
    const base = baseArg.slice("--base=".length);
    const problems = await live(base, plant);
    if (plant) {
      const caught = problems.length > 0;
      console.log(
        caught
          ? `check:native-payments (живая) --plant — поймано: подсаженная кнопка покупки роняет сторож ` +
              `(${problems.length} срабатываний, все три роли)`
          : "check:native-payments (живая) --plant — ПРОПУЩЕНО",
      );
      return caught ? 0 : 1;
    }
    if (problems.length) {
      console.error("\nПЛАТЁЖНАЯ ПОВЕРХНОСТЬ ВЕРНУЛАСЬ ВНУТРЬ ПРИЛОЖЕНИЯ:");
      for (const p of problems) console.error(`  ${p}`);
      return 1;
    }
    console.log(
      "check:native-payments (живая) — по всему собранному множеству адресов, три роли × два обличья оболочки: " +
        "0 форм, 0 цен, 0 входов на платёжные поверхности, 0 подписей платных кнопок.",
    );
    return 0;
  }

/**
 * ПРАВИЛО «НАЗВАНИЕ ТЕМЫ ПРОТИВ КАССЫ» — ПОДСАДКИ НА САМО ПРАВИЛО.
 *
 * Правило, освобождающее что-нибудь от проверки, обязано доказывать две
 * вещи сразу, иначе оно просто дыра: (1) освобождённое — действительно
 * учебная тема, и (2) освобождение НЕ распространяется на кассу, стоящую
 * рядом. Здесь проверяются обе, и отдельно — что молчание даёт именно
 * перепись названий, а не общая слепота прибора.
 */
function topicVsCheckoutPlants() {
  const tile = "🛍️ Compras y precios · 248 palabras";
  const tileWaiting = "🛍️ Compras y precios";
  const cases = [
    // отрицательный контроль: плитка темы молчит в обоих состояниях
    ["молчит", "плитка темы словаря с числом", () => judgeControl({ text: tile, target: "" }).length === 0],
    ["молчит", "плитка темы словаря БЕЗ числа (состояние ожидания, 7.196)", () =>
      judgeControl({ text: tileWaiting, target: "" }).length === 0],
    // подсадки: настоящая касса на той же странице
    ["поймано", "настоящая кнопка покупки на той же странице", () =>
      judgeControl({ text: "Оформить подписку", target: "" }).length > 0],
    ["поймано", "кнопка «Precios» без адреса", () => judgeControl({ text: "Precios", target: "" }).length > 0],
    ["поймано", "касса, ПРИСТАВЛЕННАЯ к названию темы", () =>
      judgeControl({ text: "Compras y precios — Premium", target: "" }).length > 0],
    ["поймано", "название темы, ведущее на страницу цен", () =>
      judgeControl({ text: tile, target: "/es/pricing" }).length > 0],
    // и главное: молчание даёт ПЕРЕПИСЬ, а не слепота
    ["поймано", "перепись названий тем опустела — плитка снова краснеет", () =>
      labelBeyondTopic(tileWaiting, new Set()) === null &&
      normalizeLabel(tileWaiting) === "compras y precios"],
  ];
  let ok = true;
  for (const [want, name, run] of cases) {
    const passed = run();
    if (!passed) ok = false;
    console.log(`  ${passed ? want : "ПРОПУЩЕНО"} — правило «тема против кассы»: ${name}`);
  }
  return ok;
}

  const sources = Object.fromEntries(SOURCES.map((f) => [f, read(f)]));

  if (plant) {
    let ok = judgeSources(sources).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые исходники (отрицательный контроль)`);

    ok &&= topicVsCheckoutPlants();

    const plants = [
      ["ветка на оболочку ЗАКОММЕНТИРОВАНА целиком (слепота к комментариям)",
        { [PAGE_FILE]: commentOutBranch(sources[PAGE_FILE]) }],
      ["ветка цела, но переехала ПОСЛЕ веб-карточек",
        { [PAGE_FILE]: moveBranchToTheEnd(sources[PAGE_FILE]) }],
      ["вызов ветки заменён на чужое имя, импорт оставлен на месте",
        { [PAGE_FILE]: sources[PAGE_FILE].replaceAll("await isNativeShellRequest()", "await нетТакойВетки()") }],
      ["на странице цен снова витрина магазина с кнопкой покупки",
        { [PAGE_FILE]: sources[PAGE_FILE].replace("<NativeAccessNotice", "<NativePricingPanel") }],
      ["в честное объяснение вернулась цена",
        { [COPY_FILE]: sources[COPY_FILE].replace("profileNote:", 'price: "150 MXN",\n      profileNote:') }],
      ["в честное объяснение вернулось упоминание OXXO",
        { [NOTICE_FILE]: sources[NOTICE_FILE].replace("const copyHeading", "const oxxo").replace("{copy.backCta}", "OXXO {copy.backCta}") }],
      ["исчезла строка, которая стоит на месте кнопок покупки",
        { [COPY_FILE]: sources[COPY_FILE].replaceAll("closedNote", "ничегоНеГоворим") }],
      ["признак по КУКЕ убран — остался только User-Agent, которого нет у service worker",
        { [SHELL_FILE]: sources[SHELL_FILE].replace(/NATIVE_SHELL_COOKIE/g, "НЕТ_ТАКОЙ_КУКИ") }],
      ["middleware перестал ставить куку",
        { [PROXY_FILE]: sources[PROXY_FILE].replace("response.cookies.set(NATIVE_SHELL_COOKIE", "response.headers.get(NATIVE_SHELL_COOKIE") }],
      ["воркер снова кеширует страницу цен",
        { [SW_FILE]: sources[SW_FILE].replace(/PAYMENT_PATH/g, "ЛЮБОЙ_ПУТЬ") }],
      ["уже лежащие в кеше копии больше не убираются",
        { [SW_FILE]: sources[SW_FILE].replace(/dropCachedPaymentPages/g, "ничегоНеУбираем") }],
      ["вместо замка снова витрина RevenueCat",
        { [PAYWALL_FILE]: sources[PAYWALL_FILE].replace("NativeLockedModal", "useRevenueCat") }],
      ["маршрут кассы перестал отказывать оболочке",
        { [CHECKOUT_FILE]: sources[CHECKOUT_FILE].replace(/userAgentIsNativeShell/g, "ктоУгодно") }],
      ["полоса цен на главной вернулась в приложение",
        { [HOME_FILE]: sources[HOME_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем").replace(/nativeShell/g, "неСпрашиваем2") }],
      ["ссылка «Цены» вернулась в шапку приложения",
        { [NAVBAR_FILE]: sources[NAVBAR_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем").replace(/nativeShell/g, "неСпрашиваем2") }],
      ["кнопка подписки вернулась в кабинет приложения",
        { [PROFILE_FILE]: sources[PROFILE_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем").replace(/nativeShell/g, "неСпрашиваем2") }],
      ["токен в capacitor.config.ts разошёлся с токеном сервера",
        { [CAPACITOR_FILE]: sources[CAPACITOR_FILE].replace(TOKEN, "RFNativeShim") }],
      ["appendUserAgent убран из конфигурации оболочки",
        { [CAPACITOR_FILE]: sources[CAPACITOR_FILE].replace(/appendUserAgent/g, "неДописываем") }],
      // Долг 184 и соседи: по одной подсадке на КАЖДУЮ поверхность, которую
      // заход 7.192 не увидел.
      ["кнопка «Смотреть тарифы» вернулась на закрытые вкладки урока",
        { [LESSON_PAGE_FILE]: sources[LESSON_PAGE_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем") }],
      ["список курсов в кабинете снова ведёт на страницу цен (тот самый дефект)",
        { [PROFILE_FILE]: sources[PROFILE_FILE].replace(
            "entitled || nativeShell\n                      ? `/${lang}/courses/${level}`\n                      : `/${lang}/pricing`",
            "entitled ? `/${lang}/courses/${level}` : `/${lang}/pricing`") }],
      ["замок рассказа снова зовёт покупать",
        // `nativeShell` тоже вычёркивается: с 7.196 на этой странице есть
        // локальная переменная того же имени (аргумент общего правила
        // знака), и без этой замены подсадка убирала бы не весь вопрос.
        { [STORY_FILE]: sources[STORY_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем").replace(/nativeShell/g, "неСпрашиваем2") }],
      ["замок видео снова зовёт покупать",
        { [MEDIA_FILE]: sources[MEDIA_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем") }],
      ["подпись про C1 в словаре снова ведёт на цены",
        { [VOCAB_FILE]: sources[VOCAB_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем") }],
      ["подпись про C1 в категории словаря снова ведёт на цены",
        { [VOCAB_CAT_FILE]: sources[VOCAB_CAT_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем") }],
      ["закрытый экзамен снова уводит на страницу цен",
        { [EXAM_FILE]: sources[EXAM_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем") }],
      ["закрытый филворд снова уводит на страницу цен",
        { [WORD_GAME_FILE]: sources[WORD_GAME_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем").replace(/lockedTarget/g, "цели") }],
      ["страница цен вернулась в выдачу поиска",
        { [SEARCH_API_FILE]: sources[SEARCH_API_FILE].replace(/isNativeShellRequest/g, "неСпрашиваем").replace(/nativeShell/g, "неСпрашиваем2") }],
      ["быстрый список поиска снова предлагает «Цены»",
        { [SEARCH_UI_FILE]: sources[SEARCH_UI_FILE].replace(/nativeShell/g, "неСпрашиваем") }],
      ["подвал снова предлагает скачать приложение тому, кто уже в нём",
        { [FOOTER_FILE]: sources[FOOTER_FILE].replace(/nativeShell/g, "неСпрашиваем") }],
      ["закрытая плитка урока снова ведёт на страницу вместо окна (долг 185)",
        { [LEVEL_FILE]: sources[LEVEL_FILE].replace(/NativeLockedLink/g, "Link") }],
      ["реферальный блок вернулся в приложение (долг 186)",
        { [PROFILE_FILE]: sources[PROFILE_FILE].replace("{nativeShell ? null : (\n          <Card>", "{(\n          <Card>") }],
      // ДОЛГ 191. Три подсадки на новое правило единственной точки. Первая
      // — ровно то состояние, в котором код был до 14.09.2026.
      ["единственная точка перестала спрашивать про оболочку (кнопка «Оформить подписку» вернулась в словарь)",
        { [CHOKEPOINT_FILE]: read(CHOKEPOINT_FILE).replace(/useIsNativeShell/g, "неСпрашиваем") }],
      ["в единственной точке не осталось честного объяснения — только кнопка",
        { [CHOKEPOINT_FILE]: read(CHOKEPOINT_FILE).replace(/NativeLockedNotice/g, "НетОбъяснения") }],
      // ПОДСАДКА УБИРАЕТ ОБА ПРИЗНАКА, А НЕ ОДИН — правило 7.196, уплачено
      // второй раз 15.09.2026. С 7.197 у `FlashcardsApp` есть СВОЙ вопрос
      // про оболочку (`useIsNativeShell`: внутри оболочки знаменатель
      // полосы освоенного считает то, ЧТО ЕСТЬ, а не то, что досталось), и
      // подсадка, вычеркнувшая только единственную точку, оставляла файл
      // «спрашивающим про оболочку» — то есть законным. Молчание правила
      // было верным ответом на неверный вопрос.
      ["режим словаря перестал ходить через единственную точку и зовёт пейвол сам",
        { "src/components/flashcards/FlashcardsApp.tsx":
            read("src/components/flashcards/FlashcardsApp.tsx")
              .replace(/FreeTrialLimitBanner/g, "СвояКнопка")
              .replace(/LockedOrEmpty/g, "СвойПустойЭкран")
              .replace(/useIsNativeShell/g, "неСпрашиваем")
              .replace(/nativeShell/g, "неСпрашиваем2") }],
      // Главная подсадка захода: НОВАЯ подпись покупки, заведённая в
      // словаре и отрисованная из файла, которого нет ни в одном списке.
      // Рукописный список ключей её не увидел бы никогда — перепись видит.
      ["в словарь добавлена НОВАЯ кнопка покупки и отрисована из незащищённого файла",
        {
          "src/dictionaries/ru.json": JSON.stringify({
            ...JSON.parse(read("src/dictionaries/ru.json")),
            подсадка: { купить: "Оформить подписку" },
          }),
          "src/components/ui/Tabs.tsx": `const подсадка = 1; const купить = 2;\n${read("src/components/ui/Tabs.tsx")}`,
        }],
    ];

    let caught = 0;
    for (const [name, patch] of plants) {
      const found = judgeSources({ ...sources, ...patch });
      const hit = found.length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}${hit ? ` (${found[0]})` : ""}`);
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:native-payments --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
        : `check:native-payments --plant — FAILED (${caught} из ${plants.length})`,
    );
    return ok ? 0 : 1;
  }

  const problems = judgeSources(sources);
  if (problems.length) {
    console.error("ПЛАТЁЖНАЯ ПОВЕРХНОСТЬ ВНУТРИ ПРИЛОЖЕНИЯ — ИСХОДНИКИ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    "check:native-payments — оболочку узнают по ДВУМ признакам, ветка стоит у КАЖДОГО входа на страницу цен " +
      `(${SOURCES.length} файлов), вместо пейвола замок, воркер платёжных страниц не кеширует; контроль — --plant.`,
  );
  console.log("  Живая половина (три роли × три обличья запроса) гоняется из scripts/verify-rendered.mjs с --base=.");
  return 0;
}

// Только когда этот файл — точка входа процесса.
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
