/**
 * ОБЩИЙ УЧЁТ ЗАНЯТЫХ КРАЁВ ОКНА — один на весь продукт.
 *
 * Зачем он есть (долг 161). В проекте пять слоёв, которые ложатся ПОВЕРХ
 * содержимого и прижаты к краю окна, и до этого файла ни один из них не
 * знал о существовании остальных:
 *
 *   BottomNav.tsx       fixed inset-x-0 bottom-0 z-40   низ, постоянный
 *   MobileMenu.tsx      fixed inset-x-0 bottom-0 z-50   низ, временный
 *   ui/Toast.tsx        fixed inset-x-0 bottom-0 z-60   низ, временный
 *   ui/Modal.tsx        fixed inset-x-0 bottom-0        низ, временный
 *   Navbar (header)     sticky top-0 z-50              верх, постоянный
 *   StoryAudioPlayer    sticky top-<шапка> z-30        верх, временный
 *
 * И две жертвы, замеренные числом 13.09.2026:
 *
 *   — определения кроссворда уходят под нижнюю панель: единственное
 *     место, где под неё было отведено место, — `pb-20` У КОНЦА <main>,
 *     то есть В СЕРЕДИНЕ документа. Ссылки подвала, которые идут ПОСЛЕ
 *     </main>, отведённого места не получали вовсе: на 360×780 под
 *     панелью лежали ШЕСТЬ ссылок подвала из шести, последняя
 *     («Политика конфиденциальности», 756..776) — целиком внутри полосы
 *     панели 716..780;
 *   — карточка перевода слова накрывает ряд кнопок плеера: на всех пяти
 *     телефонных ширинах (320/360/375/390/393) первые слова рассказа
 *     давали перекрытие 76..90 px и 6 закрытых кнопок из 6, потому что
 *     карточка ставилась «над словом» по одной величине — высоте
 *     собственной оценки, — и о плеере не знала ничего.
 *
 * ПРАВИЛО, которое вводит этот файл. Слой, прижатый к краю окна,
 * РЕГИСТРИРУЕТСЯ здесь — один вызов хука в самом слое, — и дальше:
 *
 *   1. его живая коробка попадает в список ЗАНЯТЫХ ПОЛОС, и всякий, кто
 *      ставит что-то в произвольную точку окна (карточка перевода,
 *      доводка клетки кроссворда), спрашивает свободное место здесь, а
 *      не считает его сам;
 *   2. если слой постоянный (`reserve: true`), его высота печатается в
 *      `--pinned-inset-bottom` на <html>, и конец ПРОКРУЧИВАЕМОЙ ОБЛАСТИ
 *      (у нас это документ, `<body class="pb-pinned">`) отводит под него
 *      ровно столько места, сколько он занимает на самом деле, — а не
 *      столько, сколько кто-то однажды написал руками.
 *
 * Новый прижатый слой попадает в учёт одним вызовом `usePinnedLayer` в
 * САМОМ СЕБЕ. Чужие компоненты при этом не правятся ни одной строкой:
 * ни `<body>`, ни карточка перевода, ни кроссворд про новый слой не
 * знают и знать не обязаны. Слой, который учёт обошёл, ловит сторож
 * `scripts/check-bottom-inset.mjs` по живому DOM — он ищет прижатые к
 * низу коробки геометрией, а не по этому списку, и требует, чтобы у
 * каждой найденной стоял атрибут `data-pinned-layer`.
 *
 * ПОЧЕМУ РЕЗЕРВ И ЗАНЯТОСТЬ — ДВЕ РАЗНЫЕ ВЕЛИЧИНЫ, а не одна.
 * Резерв — это «сколько места отвести в конце страницы навсегда», и
 * тост, лист меню и модалка его не заслуживают: они приходят и уходят, а
 * дыра в конце страницы осталась бы навсегда. Занятость — это «что
 * закрыто ПРЯМО СЕЙЧАС», и тост в неё входит обязательно. Одной
 * величиной эти два вопроса не отвечаются.
 *
 * ПОЧЕМУ РЕЗЕРВ СЧИТАЕТСЯ ПО `offsetHeight`, А НЕ ПО КОРОБКЕ НА ЭКРАНЕ.
 * Нижняя панель прячется при прокрутке (`useHideOnScroll`) — сдвигом
 * `translate-y-full`. По коробке на экране резерв в этот момент стал бы
 * нулём, отступ в конце документа схлопнулся бы, и страница дёрнулась
 * бы под пальцем на каждую прокрутку вниз и обратно. `offsetHeight`
 * трансформацией не меняется.
 */

/** Край окна, к которому слой прижат. */
export type PinnedEdge = "top" | "bottom";

export interface PinnedLayerOptions {
  edge: PinnedEdge;
  /**
   * Постоянная рама: под неё отводится место в конце прокручиваемой
   * области. По умолчанию `false` — временный слой места не резервирует.
   */
  reserve?: boolean;
  /** Имя для отчёта сторожа и отладки. */
  label?: string;
}

/** Горизонтальная полоса окна, занятая слоем. Координаты — в системе
 * layout-вьюпорта, той же, в которой отвечает `getBoundingClientRect`. */
export interface Band {
  top: number;
  bottom: number;
  label: string;
}

export interface ViewportBox {
  top: number;
  bottom: number;
}

/** Атрибут, по которому сторож отличает учтённый слой от обошедшего учёт. */
export const PINNED_ATTR = "data-pinned-layer";
/** Ставится в дополнение к нему на слой, который РЕЗЕРВИРУЕТ место в
 * конце прокручиваемой области. Сторож различает два правила по нему:
 * резервирующая рама судится по отведённому под неё месту, временный
 * слой — по своей коробке на экране. */
export const PINNED_RESERVE_ATTR = "data-pinned-reserve";

/** Имя переменной, в которую печатается резерв нижней рамы. */
export const INSET_BOTTOM_VAR = "--pinned-inset-bottom";
export const INSET_TOP_VAR = "--pinned-inset-top";

/**
 * Насколько визуальный вьюпорт обязан быть ниже layout-вьюпорта, чтобы
 * это считалось поднявшейся клавиатурой.
 *
 * 120 px — не круглое число «на глаз», а порог между двумя настоящими
 * величинами, обе замерены на живом телефоне владельца 13.09.2026:
 * клавиатура съедает около 335 CSS-px (904 → 569), а панель адресной
 * строки, которая тоже ужимает визуальный вьюпорт при прокрутке, — около
 * 60. Порог обязан лежать между ними, и 120 лежит с запасом в обе
 * стороны.
 */
export const KEYBOARD_MIN_SHRINK_PX = 120;

/* ────────────────────────── чистая геометрия ────────────────────────── */

/**
 * Поднялась ли экранная клавиатура.
 *
 * Сравнивается видимая высота СЕЙЧАС с САМОЙ БОЛЬШОЙ, какую эта страница
 * видела в этой ориентации, — а не с `innerHeight`, и это не мелочь, а
 * условие того, чтобы правило вообще работало на телефоне владельца.
 *
 * Две модели клавиатуры, и они различны:
 *
 *   iOS      — layout-вьюпорт не меняется (`innerHeight` остаётся 904),
 *              ужимается только визуальный (569). Разница видна и в
 *              сравнении с `innerHeight`;
 *   Android  — ужимаются ОБА, и `innerHeight`, и `visualViewport.height`,
 *              оба становятся 569. Сравнение с `innerHeight` даёт ноль, и
 *              клавиатура остаётся незамеченной — а жалоба владельца
 *              пришла именно с Android.
 *
 * Самая большая виденная высота отвечает в обоих случаях: 904 − 569 =
 * 335 ≥ порога. Ложного срабатывания на панели адресной строки (около 60)
 * не даёт — порог 120 лежит между.
 */
export function isKeyboardOpen(
  tallestSeenHeight: number,
  visualHeight: number,
  threshold = KEYBOARD_MIN_SHRINK_PX,
): boolean {
  if (!Number.isFinite(tallestSeenHeight) || !Number.isFinite(visualHeight)) return false;
  return tallestSeenHeight - visualHeight >= threshold;
}

/** Свободные промежутки окна: всё, что не накрыто ни одной полосой. */
export function freeIntervals(viewport: ViewportBox, bands: Band[]): ViewportBox[] {
  const clipped = bands
    .map((b) => ({ top: Math.max(b.top, viewport.top), bottom: Math.min(b.bottom, viewport.bottom) }))
    .filter((b) => b.bottom > b.top)
    .sort((a, b) => a.top - b.top);

  const free: ViewportBox[] = [];
  let cursor = viewport.top;
  for (const band of clipped) {
    if (band.top > cursor) free.push({ top: cursor, bottom: band.top });
    cursor = Math.max(cursor, band.bottom);
  }
  if (cursor < viewport.bottom) free.push({ top: cursor, bottom: viewport.bottom });
  return free;
}

/** Пересекает ли коробка хоть одну занятую полосу; возвращает первую. */
export function firstOverlappingBand(
  box: { top: number; bottom: number },
  bands: Band[],
): Band | null {
  for (const band of bands) {
    if (box.bottom > band.top && box.top < band.bottom) return band;
  }
  return null;
}

/**
 * Куда поставить временный слой высотой `height`, привязанный к элементу
 * [anchorTop, anchorBottom], чтобы он не накрыл ни одну занятую полосу.
 *
 * Порядок предпочтений тот же, что был у карточки перевода до этого
 * файла, и это намеренно: сначала НАД словом, потом ПОД ним. Новое —
 * только то, что каждый из двух вариантов теперь примеряется к КАЖДОМУ
 * свободному промежутку и берётся тот, который ближе к слову. Если ни
 * один промежуток не вмещает слой (окно ниже самого слоя — бывает при
 * поднятой клавиатуре), возвращается позиция, прижатая к низу окна:
 * обрезанная карточка честнее карточки поверх кнопок.
 */
export function placeInFreeBand({
  anchorTop,
  anchorBottom,
  height,
  margin,
  viewport,
  bands,
}: {
  anchorTop: number;
  anchorBottom: number;
  height: number;
  margin: number;
  viewport: ViewportBox;
  bands: Band[];
}): number {
  const wanted = [anchorTop - margin - height, anchorBottom + margin];
  const intervals = freeIntervals(viewport, bands).filter((i) => i.bottom - i.top >= height);
  if (intervals.length === 0) {
    return Math.max(viewport.top, viewport.bottom - height);
  }
  let best: { y: number; distance: number } | null = null;
  for (const want of wanted) {
    for (const interval of intervals) {
      const y = Math.min(Math.max(want, interval.top), interval.bottom - height);
      const distance = Math.abs(y - want);
      // Строгое «меньше»: при равенстве побеждает вариант, найденный
      // раньше, то есть «над словом» — прежнее поведение.
      if (!best || distance < best.distance) best = { y, distance };
    }
  }
  return best!.y;
}

/* ─────────────────────────── живой реестр ─────────────────────────── */

interface Registration extends PinnedLayerOptions {
  element: HTMLElement;
}

const registry = new Set<Registration>();
const listeners = new Set<() => void>();
let keyboardOpenSnapshot = false;
/** Самая большая видимая высота, какую страница видела в текущей
 * ориентации. Сбрасывается при повороте и при смене ширины — после них
 * прежняя величина говорила бы про другой экран. */
let tallestViewportHeight = 0;
let lastViewportWidth = 0;
let frame: number | null = null;
let wired = false;

function isRendered(el: HTMLElement): boolean {
  // `offsetParent === null` у display:none и у элемента вне документа.
  // `position: fixed` даёт null и будучи видимым, поэтому проверяется
  // ещё и коробка.
  if (!el.isConnected) return false;
  const box = el.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

/**
 * Коробка слоя В ПОКОЕ — то есть без сдвига, которым он от себя
 * отказывается на время.
 *
 * Касается только постоянной нижней рамы: она прячется при прокрутке вниз
 * (`useHideOnScroll`) сдвигом `translate-y-full`, и её живая коробка в
 * этот момент стоит ЗА краем окна. Считать по ней значило бы решать, куда
 * поставить клетку или карточку, исходя из того, что панели сейчас нет, —
 * а она вернётся от первого же движения пальцем вверх и накроет их.
 * Замерено 13.09.2026: доводка клетки двигает страницу, страница
 * прокручивается вниз, панель прячется — и та же клетка, поставленная «в
 * освободившееся место», снова оказывается под панелью, как только та
 * возвращается.
 *
 * Временные слои (тост, лист, модалка, карточка) сдвигом от себя не
 * отказываются — им отдаётся живая коробка как есть.
 */
function restingBox(entry: Registration): { top: number; bottom: number } {
  const box = entry.element.getBoundingClientRect();
  if (!entry.reserve || entry.edge !== "bottom" || typeof window === "undefined") {
    return { top: box.top, bottom: box.bottom };
  }
  const height = entry.element.offsetHeight;
  return { top: window.innerHeight - height, bottom: window.innerHeight };
}

function currentViewport(): ViewportBox {
  const vv = typeof window === "undefined" ? null : window.visualViewport;
  if (vv) return { top: vv.offsetTop, bottom: vv.offsetTop + vv.height };
  return { top: 0, bottom: typeof window === "undefined" ? 0 : window.innerHeight };
}

/**
 * Живые полосы и резерв — один проход по реестру.
 *
 * Считается на ТРЕБОВАНИЕ, а не хранится: единственный способ, которым
 * величина может разойтись с экраном, — это устареть.
 */
export function measurePinnedLayers(): {
  viewport: ViewportBox;
  bands: Band[];
  reserveBottom: number;
  reserveTop: number;
  keyboardOpen: boolean;
} {
  const viewport = currentViewport();
  const bands: Band[] = [];
  let reserveBottom = 0;
  let reserveTop = 0;

  for (const entry of registry) {
    if (!isRendered(entry.element)) continue;
    const box = restingBox(entry);
    if (box.bottom <= viewport.top || box.top >= viewport.bottom) continue;
    bands.push({
      top: box.top,
      bottom: box.bottom,
      label: entry.label ?? entry.element.tagName.toLowerCase(),
    });
    if (!entry.reserve) continue;
    // Резерв — по собственной высоте слоя, а не по его месту на экране:
    // спрятанная прокруткой панель вернётся, и отступ обязан её дождаться.
    const reserved = entry.element.offsetHeight;
    if (entry.edge === "bottom") reserveBottom = Math.max(reserveBottom, reserved);
    else reserveTop = Math.max(reserveTop, reserved);
  }

  const keyboardOpen = trackViewportAndDetectKeyboard();
  return { viewport, bands, reserveBottom, reserveTop, keyboardOpen };
}

/**
 * Свободные границы окна для того, кто доводит элемент до видимости
 * (клетка кроссворда) — визуальный вьюпорт минус то, что прижато к его
 * краям ПРЯМО СЕЙЧАС.
 *
 * Учитываются только полосы, КАСАЮЩИЕСЯ края: плеер рассказа, стоящий в
 * середине окна, границы окна не сужает — он сужает место для карточки,
 * и об этом спрашивают `placeInFreeBand`, а не эту функцию.
 */
export function getFreeViewportBounds(): ViewportBox {
  const { viewport, bands } = measurePinnedLayers();
  let top = viewport.top;
  let bottom = viewport.bottom;
  for (const band of bands) {
    if (band.top <= top + 1) top = Math.max(top, band.bottom);
    if (band.bottom >= bottom - 1) bottom = Math.min(bottom, band.top);
  }
  return { top, bottom: Math.max(top, bottom) };
}

/**
 * Запоминает самую большую видимую высоту и отвечает, поднята ли
 * клавиатура. Высота РАСТЁТ только при неизменной ширине: поворот и смена
 * ширины обнуляют память, иначе после поворота «самая большая» относилась
 * бы к другой ориентации и клавиатура «поднималась» бы сама собой.
 */
function trackViewportAndDetectKeyboard(): boolean {
  if (typeof window === "undefined") return false;
  const vv = window.visualViewport;
  const height = vv ? vv.height : window.innerHeight;
  const width = vv ? vv.width : window.innerWidth;
  if (width !== lastViewportWidth) {
    lastViewportWidth = width;
    tallestViewportHeight = height;
  } else if (height > tallestViewportHeight) {
    tallestViewportHeight = height;
  }
  if (!vv) return false;
  return isKeyboardOpen(tallestViewportHeight, height);
}

function writeInsetVars(): void {
  if (typeof document === "undefined") return;
  const { reserveBottom, reserveTop, keyboardOpen } = measurePinnedLayers();
  const root = document.documentElement;
  root.style.setProperty(INSET_BOTTOM_VAR, `${Math.round(reserveBottom)}px`);
  root.style.setProperty(INSET_TOP_VAR, `${Math.round(reserveTop)}px`);
  if (keyboardOpen !== keyboardOpenSnapshot) {
    keyboardOpenSnapshot = keyboardOpen;
    for (const listener of listeners) listener();
  }
}

/** Пересчёт склеивается до одного кадра: подписок много, ответ один. */
function scheduleRecompute(): void {
  if (typeof window === "undefined" || frame !== null) return;
  frame = window.requestAnimationFrame(() => {
    frame = null;
    writeInsetVars();
  });
}

function wireGlobalListeners(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("resize", scheduleRecompute);
  window.addEventListener("orientationchange", scheduleRecompute);
  // Клавиатура шевелит ВИЗУАЛЬНЫЙ вьюпорт и только его: `resize` окна при
  // этом на iOS не приходит вовсе (см. разбор в CrosswordBoard.tsx).
  window.visualViewport?.addEventListener("resize", scheduleRecompute);
  window.visualViewport?.addEventListener("scroll", scheduleRecompute);
}

/**
 * Поставить слой на учёт. Возвращает снятие с учёта — отдавать из
 * `useEffect` как есть.
 */
export function registerPinnedLayer(element: HTMLElement, options: PinnedLayerOptions): () => void {
  const entry: Registration = { element, ...options };
  registry.add(entry);
  element.setAttribute(PINNED_ATTR, options.edge);
  if (options.reserve) element.setAttribute(PINNED_RESERVE_ATTR, "");
  wireGlobalListeners();

  // Слой меняет высоту сам по себе: у нижней панели это safe-area, у
  // листа меню — его содержимое. Резерв обязан ехать за ним.
  const observer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleRecompute);
  observer?.observe(element);
  scheduleRecompute();

  return () => {
    registry.delete(entry);
    observer?.disconnect();
    // Атрибут снимается ровно тогда, когда слой перестал быть на учёте:
    // сторож читает его как «этот слой в общем учёте», и оставленный
    // после размонтирования он говорил бы неправду.
    if (element.isConnected) {
      element.removeAttribute(PINNED_ATTR);
      element.removeAttribute(PINNED_RESERVE_ATTR);
    }
    scheduleRecompute();
  };
}

/* ──────── подписка на «поднялась ли клавиатура» (useSyncExternalStore) ──────── */

export function subscribeToPinnedLayers(listener: () => void): () => void {
  listeners.add(listener);
  wireGlobalListeners();
  scheduleRecompute();
  return () => listeners.delete(listener);
}

export function getKeyboardOpenSnapshot(): boolean {
  return keyboardOpenSnapshot;
}

/** На сервере клавиатуры нет — и разметка обязана совпасть с первым
 * клиентским рендером до гидратации. */
export function getKeyboardOpenServerSnapshot(): boolean {
  return false;
}
