// НИ ОДИН ПРИЖАТЫЙ К НИЗУ СЛОЙ НЕ НАКРЫВАЕТ ПОСЛЕДНИЙ ИНТЕРАКТИВНЫЙ
// ЭЛЕМЕНТ ПРОКРУЧИВАЕМОЙ ОБЛАСТИ.
//
// Зачем этот сторож есть (долг 161). В продукте пять слоёв, прижатых к
// краю окна поверх содержимого, и до захода 7.185 общего учёта занятой
// высоты не было ни одного: каждый слой знал только себя. Цена названа
// числом и замерена в живом браузере 13.09.2026, ДО правки:
//
//   — 360×780, вошедший читатель, любая страница: под нижней панелью
//     (полоса 716..780) лежали ШЕСТЬ ссылок подвала из шести, последняя
//     («Политика конфиденциальности», 756..776) — целиком. Причина:
//     единственное место, где под панель было отведено место, — `pb-20`
//     У КОНЦА <main>, а подвал идёт ПОСЛЕ </main>;
//   — карточка перевода слова на всех пяти телефонных ширинах
//     (320/360/375/390/393) закрывала 6 кнопок плеера из 6, перекрытие
//     76..90 px.
//
// ЧТО ЗДЕСЬ МЕРЯЕТСЯ — ЖИВОЙ DOM, А НЕ ИСХОДНИКИ. Сторож не читает ни
// одной строки кода: он открывает настоящую страницу в настоящем
// браузере, находит прижатые коробки геометрией (`position` из
// `getComputedStyle`, коробка из `getBoundingClientRect`) и сравнивает
// их с коробками органов управления. Поэтому закомментированная
// настройка, переименованный класс и любая хитрость в исходнике на его
// ответ не влияют никак: он видит ровно то, что видит человек.
//
// Три правила, и все три печатаются числом всегда:
//
//   A. УЧЁТ. Всякая коробка, которая `position: fixed`/`sticky`, занимает
//      не меньше половины ширины окна и КАСАЕТСЯ его низа, обязана стоять
//      на общем учёте — то есть нести атрибут `data-pinned-layer`
//      (ставит его `registerPinnedLayer`, src/lib/pinned-layers.ts).
//      Слой, обошедший учёт, — это ровно тот класс, из-за которого долг
//      161 и завёлся: он найдёт себе новую жертву молча.
//   B1. ДОСТИЖИМОСТЬ. Прокручиваемая область доводится до КОНЦА, и её
//      последний интерактивный элемент обязан лечь ВЫШЕ отведённой под
//      нижнюю раму полосы. Обещание формулируется именно так, а не «под
//      панелью никогда ничего нет»: панель, прижатая к низу окна, на
//      середине прокрутки закрывает содержимое по определению, и это
//      нормальная работа такой панели. Ненормально другое — когда
//      элемент из-под неё НЕЛЬЗЯ вывести, сколько ни прокручивай. Ровно
//      это и было: отступ стоял в конце <main>, а подвал шёл после него.
//
//      Судится по ОТВЕДЁННОЙ полосе, а не по коробке панели на экране, и
//      это не послабление, а единственный способ судить честно: панель
//      прячется при прокрутке вниз (`useHideOnScroll`), и в конце
//      документа её коробка стоит ЗА краем экрана (замерено: 780..844
//      при окне 780). Замер по коробке отвечал бы «перекрытий нет»
//      всегда и на любой поломке.
//   B2. ВРЕМЕННЫЕ СЛОИ. Слой, который места не резервирует (карточка
//      перевода, тост, лист меню), судится ровно наоборот — по своей
//      коробке на экране: он пришёл сюда сам и прокруткой не убирается.
//      Ни один интерактивный элемент, видимый в окне, не имеет права с
//      ним пересекаться. Это вторая жертва долга 161: карточка перевода
//      (`fixed z-50`, точка вычисляется от нажатого слова) накрывала
//      кнопки плеера, который стоит в СЕРЕДИНЕ окна.
//
//      Модальный слой из B2 исключён по величине, а не по имени: всё,
//      что закрывает 90% высоты окна и больше, — это диалог, и закрывать
//      содержимое под собой его работа.
//   B3. ДОВОДКА ДО ВИДИМОСТИ. Элемент, получивший фокус, обязан лечь ВНЕ
//      прижатых полос. Это и есть жертва номер один в том виде, в каком
//      её можно воспроизвести без телефона: доводка клетки кроссворда
//      (`revealBelowKeyboard`, CrosswordBoard.tsx) считала нижнюю границу
//      по одному только `visualViewport` и ставила клетку ровно под
//      нижнюю панель. Замер 13.09.2026 в НИЗКОМ окне (420 px — тот же
//      класс, что оставшиеся 569 при поднятой клавиатуре на телефоне
//      владельца): ДО правки под панелью оказывались 6..7 клеток из 21 в
//      каждой из пяти ширин, перекрытие до 22 px; ПОСЛЕ — 0 из 21 везде.
//
// ЧЕГО ЭТОТ СТОРОЖ НЕ ВИДИТ И НЕ УВИДИТ. Настоящей экранной клавиатуры в
// настольном браузере нет: `visualViewport.height` там всегда равен
// `innerHeight`, и ветка «клавиатура поднята» (BottomNav снимается с
// учёта) здесь не исполняется ни разу. Её решающая функция —
// `isKeyboardOpen` — закрыта юнит-тестом (src/lib/pinned-layers.test.ts),
// а сам сценарий проверяется только на живом телефоне. Низкое окно B3 —
// это тот же КЛАСС (мало видимой высоты, панель поверх), но не тот же
// механизм, и выдавать одно за другое нельзя.
//   C. РЕЗЕРВ. Напечатанный в `--pinned-inset-bottom` резерв не меньше
//      высоты самого высокого слоя, который его требует.
//
//   node scripts/check-bottom-inset.mjs --base=http://localhost:3123
//   node scripts/check-bottom-inset.mjs --base=… --plant   (позитивный контроль)
//   node scripts/check-bottom-inset.mjs --base=… --ci      (только страницы без содержимого)
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "http://localhost:3123").replace(/\/$/, "");
const PLANT = argv.includes("--plant");
const CI_MODE = argv.includes("--ci");

/**
 * Ширины — те же пять, на которых замерены обе жертвы 13.09.2026, и
 * каждая из них настоящий телефон: 320 (iPhone SE 1-го поколения, Galaxy
 * S9+), 360 (самая узкая распространённая на Android), 375 (iPhone SE
 * 2/3), 390 (iPhone 13/14), 393 (Pixel 5/7). Выше `sm` нижней панели нет
 * вовсе (`sm:hidden`), поэтому мерить там нечего.
 */
const WIDTHS = [320, 360, 375, 390, 393];

/**
 * Страницы — по одной на КАЖДЫЙ способ, которым в этом продукте строится
 * прокручиваемая область, а не ради перечисления сайта:
 *
 *   /ru                     обычный документ, длинный подвал;
 *   /ru/courses             список карточек;
 *   /ru/word-games/…/1      страница с полем ввода — тот самый кроссворд
 *                           из жалобы владельца (нужны строки в базе).
 *
 * Рассказ сюда списком не попадает: его адрес — идентификатор строки
 * базы, а не постоянный путь. Он берётся отдельным шагом ниже, по первой
 * ссылке со страницы `/ru/stories`, и на нём меряется то, чего нет
 * больше нигде: вложенный прокручиваемый ящик, прижатый плеер и КАРТОЧКА
 * ПЕРЕВОДА, открытая нажатием на слово (жертва номер два).
 */
const ALL_PAGES = [
  { path: "/ru" },
  { path: "/ru/courses" },
  { path: "/ru/word-games/CROSSWORD/A1/1", contentOnly: true, focusCells: true },
];

/**
 * Высота окна для правила B3.
 *
 * 420 px — не «поменьше на всякий случай»: столько же видимой высоты
 * остаётся телефону владельца при поднятой клавиатуре относительно
 * прижатой панели. Замерено 13.09.2026 с устройства: 904 → 569 при
 * панели в 51 px, то есть панель съедает 9% видимого. В окне 420 при той
 * же панели — 12%. Полное окно 780 этот класс не воспроизводит вовсе:
 * доска целиком выше сгиба, доводке нечего доводить, и ДО правки замер
 * давал ровно 0 перекрытий из 21 клетки на всех пяти ширинах.
 */
const SHORT_VIEWPORT_HEIGHT = 420;
const PAGES = ALL_PAGES.filter((p) => !(CI_MODE && p.contentOnly));

/** Высота полосы подсадки. 96 px — заметно больше настоящей панели
 * (51..64), чтобы подсадка не могла «спрятаться» внутри её полосы и
 * пройти незамеченной. */
const PLANT_HEIGHT = 96;

/**
 * Вход в учётную запись. Без него мерить нечего и это ОТКАЗ, а не
 * пропуск: `BottomNav` вовсе не отрисовывается вышедшему (см. его
 * комментарий), и анонимный прогон отвечал бы «прижатых слоёв 0, находок
 * 0» на любой поломке.
 */
async function signIn(context) {
  const email = `bottom-inset-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  // Ровно ОДИН раз на прогон, и это не экономия, а условие работы:
  // /api/auth/register держит 10 регистраций в минуту с одного адреса —
  // настоящая защита от злоупотребления, ослаблять которую ради
  // измерителя нельзя. Прогон и его позитивный контроль, идущие подряд,
  // укладываются в две регистрации из десяти.
  const response = await context.request.post(`${BASE}/api/auth/register`, {
    form: { email, password: "TestPass123!", lang: "ru", redirectTo: "/ru" },
  });
  // Отказ регистрации приходит перенаправлением на /register?error=…,
  // которое request-контекст проходит сам и показывает как обычные 200 —
  // правду говорит только адрес, на котором он остановился.
  const error = new URL(response.url()).searchParams.get("error");
  if (!response.ok() || error) {
    throw new Error(`не удалось завести учётную запись: HTTP ${response.status()}, error=${error ?? "нет"}`);
  }
  const cookies = await context.cookies();
  if (!cookies.some((c) => c.name === "session")) {
    throw new Error("регистрация прошла, а cookie `session` в контексте нет — мерить было бы нечего");
  }
}

/** Подсадка: полоса, прижатая к низу окна МИМО общего учёта. */
function plantUnaccountedBar(height) {
  const bar = document.createElement("div");
  bar.id = "planted-bottom-bar";
  bar.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${height}px;z-index:70;background:#111;`;
  bar.textContent = "подсадка";
  document.body.appendChild(bar);
}

/**
 * Единственный замер, целиком внутри страницы.
 *
 * Возвращает: найденные прижатые к низу полосы, кто из них вне учёта,
 * перекрытые органы управления и напечатанный резерв.
 */
function measure() {
  const de = document.documentElement;
  const vv = window.visualViewport;
  const viewport = vv
    ? { top: vv.offsetTop, bottom: vv.offsetTop + vv.height }
    : { top: 0, bottom: window.innerHeight };
  const vw = de.clientWidth;
  const viewportHeight = viewport.bottom - viewport.top;

  const pinned = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const box = el.getBoundingClientRect();
    if (box.height === 0 || box.width === 0) continue;
    // Диалог и его подложка исключаются везде и по величине, а не по
    // имени: всё, что закрывает 90% высоты окна и больше, — это диалог,
    // и закрывать содержимое под собой его работа.
    if (box.height >= viewportHeight * 0.9) continue;
    pinned.push({ el, box, cs });
  }

  const describe = (p) =>
    `<${p.el.tagName.toLowerCase()}${p.el.id ? `#${p.el.id}` : ""} class="${String(p.el.className || "").slice(0, 46)}"> ` +
    `${p.cs.position} z=${p.cs.zIndex} [${Math.round(p.box.top)},${Math.round(p.box.bottom)}]`;
  const name = (el) =>
    `<${el.tagName.toLowerCase()}> "${(el.textContent || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 34)}"`;

  /* ── A. УЧЁТ ────────────────────────────────────────────────────── */
  const bottomBars = pinned.filter(
    (p) => p.box.width >= vw * 0.5 && p.box.bottom >= viewport.bottom - 1 && p.box.top < viewport.bottom,
  );
  const unaccounted = bottomBars.filter((p) => !p.el.hasAttribute("data-pinned-layer")).map(describe);

  /* ── B1. ДОСТИЖИМОСТЬ ───────────────────────────────────────────── */
  let reserveNeeded = 0;
  for (const p of pinned) {
    if (!p.el.hasAttribute("data-pinned-reserve")) continue;
    if (p.el.getAttribute("data-pinned-layer") !== "bottom") continue;
    reserveNeeded = Math.max(reserveNeeded, p.el.offsetHeight);
  }
  const reservedBand = { top: viewport.bottom - reserveNeeded, bottom: viewport.bottom };

  const SELECTOR = 'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])';
  const visible = (el) => {
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  };
  const insidePinned = (el) => pinned.some((p) => p.el === el || p.el.contains(el));

  const all = [...document.querySelectorAll(SELECTOR)].filter(visible);
  // Содержимое документа: всё, что не принадлежит ни одному прижатому слою.
  const content = all.filter((el) => !insidePinned(el));
  const inViewport = content.filter((el) => {
    const b = el.getBoundingClientRect();
    return b.top < viewport.bottom && b.bottom > viewport.top;
  });
  const lastEl = inViewport[inViewport.length - 1] ?? null;
  const lastBox = lastEl ? lastEl.getBoundingClientRect() : null;
  const lastInteractive = lastEl
    ? `${name(lastEl)} [${Math.round(lastBox.top)},${Math.round(lastBox.bottom)}]`
    : null;
  const unreachable =
    lastBox && reserveNeeded > 0 && lastBox.bottom > reservedBand.top + 1
      ? `${lastInteractive} заходит в отведённую полосу [${Math.round(reservedBand.top)},${Math.round(reservedBand.bottom)}] ` +
        `на ${Math.round(lastBox.bottom - reservedBand.top)}px`
      : null;

  /* ── B2. ВРЕМЕННЫЕ СЛОИ ПРОТИВ ОРГАНОВ ПРИЖАТОЙ РАМЫ ───────────── */
  // Судятся не «все элементы под карточкой» — карточка перевода стоит на
  // тексте из тапаемых слов, и накрыть соседнее слово ей положено, — а
  // ровно ОРГАНЫ ПРИЖАТОЙ РАМЫ: плеер, нижняя панель, шапка. Их прижали
  // затем, чтобы они оставались под рукой; накрыть их значит отнять у
  // человека управление, а не кусок текста, который он сам и открыл.
  const transient = pinned.filter(
    (p) => p.cs.position === "fixed" && !p.el.hasAttribute("data-pinned-reserve"),
  );
  const chromeControls = all.filter((el) => {
    const owner = el.closest("[data-pinned-layer]");
    return owner !== null && !transient.some((t) => t.el === owner || t.el.contains(el));
  });
  const covered = [];
  for (const el of chromeControls) {
    const b = el.getBoundingClientRect();
    if (b.top >= viewport.bottom || b.bottom <= viewport.top) continue;
    for (const overlay of transient) {
      if (overlay.el.contains(el)) continue;
      // Тот же порог в пиксель, что и у доводки ниже, и по той же
      // причине: доли пикселя — это округление, а не перекрытие.
      const vertical = Math.min(b.bottom, overlay.box.bottom) - Math.max(b.top, overlay.box.top);
      const horizontal = Math.min(b.right, overlay.box.right) - Math.max(b.left, overlay.box.left);
      if (vertical > 1 && horizontal > 1) {
        covered.push(
          `орган прижатой рамы ${name(el)} [${Math.round(b.top)},${Math.round(b.bottom)}] под ${describe(overlay)}`,
        );
        break;
      }
    }
  }

  const reserveVar = getComputedStyle(de).getPropertyValue("--pinned-inset-bottom").trim();

  return {
    viewport,
    bars: bottomBars.map(describe),
    unaccounted,
    covered,
    unreachable,
    lastInteractive,
    interactiveCount: content.length,
    chromeControls: chromeControls.length,
    reserveVar,
    reserveNeeded,
  };
}

/** Довести документ до конца — дальше прокручивать некуда, и именно там
 * задаётся вопрос «можно ли вывести последний орган из-под рамы». */
async function scrollToEnd(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
}

/**
 * Вложенные прокручиваемые ящики — их тоже надо довести до конца, иначе
 * их последний элемент никогда не окажется у низа окна. Замер 13.09.2026:
 * такой ящик в продукте один — текст рассказа
 * (`max-h-[70dvh] overflow-y-auto`).
 */
async function scrollInnerRegionsToEnd(page) {
  return page.evaluate(() => {
    let count = 0;
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.overflowY !== "auto" && cs.overflowY !== "scroll") continue;
      if (el.scrollHeight - el.clientHeight < 8) continue;
      el.scrollTop = el.scrollHeight;
      count += 1;
    }
    return count;
  });
}

/**
 * ЖЕРТВА НОМЕР ОДИН, живьём: доводка до видимости не прячет элемент под
 * прижатую полосу.
 *
 * Каждая клетка кроссворда получает фокус по очереди, и после доводки её
 * коробка сравнивается с коробками прижатых полос. Окно низкое
 * (SHORT_VIEWPORT_HEIGHT) — иначе доска целиком выше сгиба и доводка не
 * зовётся.
 */
async function checkFocusReveal(page, width, path, problems) {
  await page.setViewportSize({ width, height: SHORT_VIEWPORT_HEIGHT });
  try {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    if ((response?.status() ?? 0) !== 200) return { cells: 0, covered: 0 };
    await page
      .waitForFunction(() => !document.documentElement.hasAttribute("data-hydrating"), { timeout: 15_000 })
      .catch(() => {});
    await page.waitForTimeout(400);
    const cells = page.locator('input[aria-label^="row"]');
    const total = await cells.count();
    let covered = 0;
    for (let i = 0; i < total; i += 1) {
      await cells.nth(i).focus();
      await page.waitForTimeout(60);
      const hit = await page.evaluate(focusedElementUnderPinnedLayer);
      if (!hit) continue;
      covered += 1;
      problems.push(`${path} @${width}×${SHORT_VIEWPORT_HEIGHT}: доводка увела клетку ${i + 1} под прижатую полосу — ${hit}`);
    }
    console.log(
      `  ${path} @${width}×${SHORT_VIEWPORT_HEIGHT} [доводка фокуса]: клеток ${total}, под полосой ${covered}`,
    );
    return { cells: total, covered };
  } finally {
    await page.setViewportSize({ width, height: 780 });
  }
}

/** Исполняется В СТРАНИЦЕ: накрыта ли коробка элемента в фокусе. */
function focusedElementUnderPinnedLayer() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const box = el.getBoundingClientRect();
  const vh = window.innerHeight;
  let worst = null;
  for (const other of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(other);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    const b = other.getBoundingClientRect();
    if (b.height === 0 || b.width < document.documentElement.clientWidth * 0.5) continue;
    if (b.height >= vh * 0.9) continue;
    const overlap = Math.min(box.bottom, b.bottom) - Math.max(box.top, b.top);
    // Порог в пиксель, а не «строго больше нуля»: высота панели
    // округляется (`offsetHeight` 51 при настоящих 50,8), строки сетки на
    // целые пиксели не ложатся, и доводка попадает в границу с точностью
    // до долей. Замерено 13.09.2026: при 390×420 и 393×420 клетка встаёт
    // на 369,2 при полосе, начинающейся с 369,0 — это 0,2 px и не дефект.
    // Настоящее перекрытие, ради которого сторож написан, измерялось
    // ДЕСЯТКАМИ пикселей: 11, 22, 24, 39, 76, 90.
    if (overlap <= 1) continue;
    if (!worst || overlap > worst.overlap) {
      worst = {
        overlap,
        text: `коробка [${Math.round(box.top)},${Math.round(box.bottom)}] под <${other.tagName.toLowerCase()} class="${String(other.className || "").slice(0, 40)}"> [${Math.round(b.top)},${Math.round(b.bottom)}] на ${Math.round(overlap * 10) / 10}px`,
      };
    }
  }
  return worst ? worst.text : null;
}

/**
 * ЖЕРТВА НОМЕР ДВА, живьём: карточка перевода не накрывает плеер.
 *
 * Замер 13.09.2026 ДО правки, все пять ширин: нажатие на первое слово
 * рассказа давало карточку поверх ряда кнопок плеера — 6 закрытых из 6,
 * перекрытие 76..90 px. Здесь это проверяется тем же правилом B, что и
 * ссылки подвала, и на настоящем нажатии, а не на разметке: карточки в
 * серверном HTML нет вовсе, она появляется только от пальца.
 *
 * Адрес рассказа берётся первой ссылкой с `/ru/stories` — идентификатор
 * строки базы в списке страниц не записать. Нет списка (пустая база CI) —
 * шаг честно пропускается и печатает это числом.
 */
async function checkStoryPopover(page, width, problems) {
  const index = await page.goto(`${BASE}/ru/stories`, { waitUntil: "domcontentloaded" });
  if ((index?.status() ?? 0) !== 200) return { visited: 0, reason: `/ru/stories отдал ${index?.status()}` };
  const href = await page
    .locator('a[href*="/ru/stories/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (!href) return { visited: 0, reason: "на /ru/stories нет ни одной ссылки на рассказ" };

  const story = await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
  if ((story?.status() ?? 0) !== 200) return { visited: 0, reason: `${href} отдал ${story?.status()}` };
  await page
    .waitForFunction(() => !document.documentElement.hasAttribute("data-hydrating"), { timeout: 15_000 })
    .catch(() => {});
  const word = page.locator("button[data-word]").first();
  if ((await word.count()) === 0) return { visited: 0, reason: `${href}: тапаемых слов нет` };
  await word.click();
  const popover = page.locator('[data-testid="translation-popover"]');
  await popover.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if ((await popover.count()) === 0) return { visited: 0, reason: `${href}: карточка перевода не открылась` };
  // Перевод догружается запросом, и карточка от него РАСТЁТ (90 → 128 px
  // по замеру) — мерить до этого значило бы мерить не ту карточку.
  await page.waitForTimeout(1200);

  const m = await page.evaluate(measure);
  const where = `${href} @${width} [карточка перевода]`;
  for (const bar of m.unaccounted) problems.push(`${where}: слой ВНЕ ОБЩЕГО УЧЁТА: ${bar}`);
  for (const hit of m.covered) problems.push(`${where}: ${hit}`);
  console.log(
    `  ${where}: полос ${m.bars.length}, органов ${m.interactiveCount}` +
      (m.covered.length ? `; ПЕРЕКРЫТО ${m.covered.length}` : "; перекрытий нет"),
  );
  return { visited: 1, reason: null };
}

async function run() {
  const browser = await chromium.launch();
  const problems = [];
  let measured = 0;
  let skipped = 0;
  let barsSeen = 0;
  let storiesMeasured = 0;
  let focusCellsChecked = 0;
  const storiesSkipped = [];

  const context = await browser.newContext({ viewport: { width: WIDTHS[0], height: 780 } });
  try {
    await signIn(context);
    const page = await context.newPage();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 780 });
      {
        for (const spec of PAGES) {
          const url = `${BASE}${spec.path}`;
          const response = await page.goto(url, { waitUntil: "domcontentloaded" });
          const status = response?.status() ?? 0;
          if (status === 404 && spec.contentOnly) {
            skipped += 1;
            continue;
          }
          if (status !== 200) {
            problems.push(`${spec.path} @${width}: HTTP ${status}, а не 200 — мерить нечего`);
            continue;
          }
          // Ждём того, что приложение сообщает о себе само: атрибут
          // снимается ровно тогда, когда React догидратировал дерево.
          // Прижатые слои встают на учёт в эффектах, то есть после этого.
          await page
            .waitForFunction(() => !document.documentElement.hasAttribute("data-hydrating"), { timeout: 15_000 })
            .catch(() => {});
          await page.waitForTimeout(400);
          if (PLANT) await page.evaluate(plantUnaccountedBar, PLANT_HEIGHT);
          const where = `${spec.path} @${width}`;

          // ПЕРВЫЙ ЗАМЕР — у ВЕРХА страницы, где панель видна. Правила A
          // (учёт) и B2 (временные слои) задаются здесь: доехав до конца
          // документа, панель прячется сама (`useHideOnScroll`, замерено:
          // полоса 780..844 при окне 780), и спрашивать там «стоит ли она
          // на учёте» значило бы спрашивать про то, чего на экране нет.
          const top = await page.evaluate(measure);
          measured += 1;
          barsSeen += top.bars.length;
          if (top.bars.length === 0) {
            problems.push(`${where}: прижатых к низу полос не найдено НИ ОДНОЙ — замер вакуумен`);
          }
          for (const bar of top.unaccounted) {
            problems.push(`${where}: слой ВНЕ ОБЩЕГО УЧЁТА (нет data-pinned-layer): ${bar}`);
          }
          for (const hit of top.covered) {
            problems.push(`${where}: ${hit}`);
          }
          const reserve = Number.parseFloat(top.reserveVar);
          if (top.reserveNeeded > 0 && (!Number.isFinite(reserve) || reserve + 1 < top.reserveNeeded)) {
            problems.push(
              `${where}: резерв --pinned-inset-bottom = "${top.reserveVar}", а нижняя рама занимает ${top.reserveNeeded}px`,
            );
          }

          // ВТОРОЙ ЗАМЕР — у КОНЦА прокручиваемой области. Правило B1.
          const inner = await scrollInnerRegionsToEnd(page);
          await scrollToEnd(page);
          const bottom = await page.evaluate(measure);
          if (bottom.unreachable) {
            problems.push(`${where}: последний орган НЕ ВЫВОДИТСЯ из-под нижней рамы — ${bottom.unreachable}`);
          }
          if (bottom.reserveNeeded === 0 && top.reserveNeeded > 0) {
            // Панель спрятана прокруткой, поэтому её собственная высота
            // здесь не читается — берём ту, что измерена у верха.
            const band = bottom.viewport.bottom - top.reserveNeeded;
            problems.push(
              ...(bottom.lastInteractive && Number(bottom.lastInteractive.match(/,(\d+)\]$/)?.[1]) > band + 1
                ? [`${where}: последний орган НЕ ВЫВОДИТСЯ из-под нижней рамы — ${bottom.lastInteractive}, отведённая полоса начинается на ${Math.round(band)}`]
                : []),
            );
          }
          console.log(
            `  ${where}: полос ${top.bars.length}, вложенных ящиков ${inner}, органов ${bottom.interactiveCount}, ` +
              `органов рамы ${top.chromeControls}, резерв ${top.reserveVar || "(не напечатан)"}; ` +
              `последний интерактивный у конца ${bottom.lastInteractive ?? "— не найден"}` +
              (top.covered.length ? `; ПЕРЕКРЫТО ${top.covered.length}` : "") +
              (top.unaccounted.length ? `; ВНЕ УЧЁТА ${top.unaccounted.length}` : ""),
          );
        }
        for (const spec of PAGES) {
          if (!spec.focusCells) continue;
          const reveal = await checkFocusReveal(page, width, spec.path, problems);
          focusCellsChecked += reveal.cells;
        }
        if (!CI_MODE && !PLANT) {
          const story = await checkStoryPopover(page, width, problems);
          if (story.visited) storiesMeasured += 1;
          else storiesSkipped.push(`@${width}: ${story.reason}`);
        }
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const expected = WIDTHS.length * PAGES.length;
  console.log(
    `\nстраниц измерено ${measured} из ${expected} (пропущено по 404 при --ci: ${skipped}), ` +
      `прижатых полос встречено ${barsSeen}, находок ${problems.length}`,
  );
  console.log(`доводка фокуса проверена на ${focusCellsChecked} клетках`);
  if (!CI_MODE && !PLANT) {
    console.log(
      `карточка перевода проверена на ${storiesMeasured} рассказах из ${WIDTHS.length}` +
        (storiesSkipped.length ? `; пропущено: ${storiesSkipped.join("; ")}` : ""),
    );
    // Пропуск обязан быть ИМЕНОВАННЫМ, но не молчаливым отказом: на базе
    // без рассказов (форма CI) мерить тут нечего, и это свойство базы, а
    // не дефект. Вне CI база рассказы имеет всегда — и тогда ноль
    // проверенных рассказов означает, что шаг перестал работать.
    if (storiesMeasured === 0) {
      console.log("ОТКАЗ: карточка перевода не проверена ни разу — шаг вакуумен");
      return 1;
    }
  }
  for (const problem of problems) console.log(`  ✗ ${problem}`);

  if (PLANT) {
    // Подсадка обязана быть поймана ОБОИМИ правилами, а не одним: полоса
    // вне учёта — правило A, закрытые ею органы — правило B. Сторож,
    // который ловит подсадку только одним из двух, половину своего
    // обещания не держит.
    const caughtAccounting = problems.filter((p) => p.includes("ВНЕ ОБЩЕГО УЧЁТА")).length;
    const caughtOverlap = problems.filter((p) => p.includes("под <div#planted-bottom-bar")).length;
    console.log(
      `ПОЗИТИВНЫЙ КОНТРОЛЬ: подсажено ${measured} полос (по одной на страницу×ширину), ` +
        `поймано правилом «вне учёта» ${caughtAccounting}, правилом «перекрытие» ${caughtOverlap}`,
    );
    if (measured === 0) {
      console.log("ОТКАЗ: не измерено ни одной страницы — подсаживать было некуда");
      return 1;
    }
    if (caughtAccounting < measured) {
      console.log("ОТКАЗ: правило учёта поймало не каждую подсадку");
      return 1;
    }
    if (caughtOverlap === 0) {
      console.log("ОТКАЗ: правило перекрытия не поймало подсадку ни разу");
      return 1;
    }
    console.log("позитивный контроль пройден: сторож умеет находить дефект");
    return 0;
  }

  if (measured === 0) {
    console.log("ОТКАЗ: не измерено ни одной страницы");
    return 1;
  }
  if (barsSeen === 0) {
    console.log("ОТКАЗ: ни одной прижатой к низу полосы не встречено — проверка вакуумна");
    return 1;
  }
  return problems.length === 0 ? 0 : 1;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  run()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
