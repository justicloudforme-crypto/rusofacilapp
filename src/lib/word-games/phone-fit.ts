/**
 * ИГРАБЕЛЬНОСТЬ КРОССВОРДА НА ТЕЛЕФОНЕ 320px — геометрия доски, целиком
 * выведенная из вёрстки, и одна метрика поверх неё.
 *
 * Зачем отдельная метрика, если у филвордов уже есть «вся доска на
 * экране». У филворда каждая клетка несёт `touch-none` (свайп там — способ
 * выделить слово), поэтому столбец за краем нельзя тронуть вообще, и
 * правило «доска обязана помещаться» родилось из недоступности
 * (PROGRESS.md 7.77). У кроссворда буква вводится тапом и клавиатурой,
 * `touch-action` у сетки — `auto`, доска возится пальцем, и `revealCell`
 * сам подвозит клетку с фокусом. Достижимость здесь не страдает; страдает
 * ОБЗОР — сколько доски видно за раз.
 *
 * СЛАГАЕМЫЕ. Все до одного взяты из живой вёрстки и перемерены в браузере
 * (WebKit и Chromium, iPhone 13, 320×780, прод-сборка, 03.09.2026 —
 * PROGRESS.md 7.94), а не выведены из формулы на глаз:
 *
 *   вьюпорт                                        320px
 *   − padding страницы, `px-6` у .max-w-3xl        −24 −24  → 272px
 *     (src/app/[lang]/word-games/[type]/[level]/[sequence]/page.tsx)
 *   − рамка карточки-скроллера, `border`           −1 −1    → 270px = clientWidth
 *   − padding карточки, `p-3`                      −12 −12  → 246px = ширина под сетку
 *
 * Колонка — `minmax(22px, 2.5rem)`, зазор — `gap-0.5` = 2px
 * (CrosswordBoard.tsx). Отсюда клетка 39,33px у шести столбцов, 22,8px у
 * десяти и ровно 22,0px у одиннадцати и более — все три числа сняты
 * замером и совпали в обоих движках до сотых.
 *
 * ПРОТЯГИВАНИЕ. Одно движение пальца внутри карточки шириной 272px даёт не
 * больше ~260px хода: замер `Input.synthesizeScrollGesture`
 * (`gestureSourceType: touch`, `preventFling: true`) показал ход 1:1 —
 * 120px пальца → 121px доски, 200 → 201, 260 → 263. Инерционный бросок
 * увозит дальше (260px → 582px), но на него опираться нельзя: это уже не
 * прицельное движение, и остановить его на нужном столбце нельзя.
 *
 * МЕТРИКА — «протягиваний до дальнего края»: сколько прицельных движений
 * пальцем нужно, чтобы увидеть правый край доски.
 *
 *     panSteps(cols) = ceil((scrollWidth(cols) − 270) / 260)
 *
 * ПОРОГ — 1, то есть дальний край доски достижим ОДНИМ движением. Порог
 * взят не на вкус: 270px видно сразу и 260px даёт одно протягивание, что
 * в столбцах при клетке 22px и зазоре 2px даёт ровно 21 (22 столбца
 * требуют 280px хода и уже двух движений). Ни клетка, ни кегль, ни
 * попадание тапа за этой границей не меняются — они упираются в пол 22px
 * и дальше постоянны, — меняется только обзор, и он единственный, что
 * стоит мерить.
 */

/** Слагаемые ширины. Каждое — значение из вёрстки, а не подгонка. */
export const PHONE_320 = {
  /** Самый узкий вьюпорт, который проект обязан держать. */
  viewport: 320,
  /** `px-6` на контейнере страницы пазла. */
  pagePaddingX: 24,
  /** `border` у `[data-crossword-scroller]`. */
  cardBorderX: 1,
  /** `p-3` у него же (до `sm:` — на 320px действует именно p-3). */
  cardPaddingX: 12,
  /** Пол колонки: `minmax(22px, 2.5rem)`. */
  cellFloor: 22,
  /** Потолок той же колонки: 2.5rem. */
  cellCap: 40,
  /** `gap-0.5`. */
  gap: 2,
  /** Измеренный ход одного прицельного протягивания внутри карточки. */
  dragPx: 260,
} as const;

/** clientWidth скроллера: вьюпорт минус поля страницы минус две рамки. */
export function scrollportWidth(): number {
  const p = PHONE_320;
  return p.viewport - 2 * p.pagePaddingX - 2 * p.cardBorderX;
}

/** Ширина, доступная самой сетке: clientWidth минус padding карточки. */
export function gridAvailableWidth(): number {
  return scrollportWidth() - 2 * PHONE_320.cardPaddingX;
}

/** Фактическая сторона клетки при данном числе столбцов. */
export function cellSize(cols: number): number {
  const p = PHONE_320;
  const free = (gridAvailableWidth() - (cols - 1) * p.gap) / cols;
  return Math.max(p.cellFloor, Math.min(p.cellCap, free));
}

/** Ширина самой доски (сетки). */
export function boardWidth(cols: number): number {
  return cellSize(cols) * cols + (cols - 1) * PHONE_320.gap;
}

/** scrollWidth скроллера: доска плюс его собственный padding. */
export function scrollWidth(cols: number): number {
  return boardWidth(cols) + 2 * PHONE_320.cardPaddingX;
}

/** Сколько пикселей доски остаётся за правым краем при scrollLeft = 0. */
export function hiddenWidth(cols: number): number {
  return Math.max(0, scrollWidth(cols) - scrollportWidth());
}

/** Метрика: прицельных протягиваний до дальнего края. 0 — доска целиком. */
export function panSteps(cols: number): number {
  return Math.ceil(hiddenWidth(cols) / PHONE_320.dragPx);
}

/** Порог: дальний край достижим одним движением пальца. */
export const PAN_STEP_LIMIT = 1;

/** Наибольшее число столбцов, укладывающееся в порог. Считается, не зашито. */
export const MAX_COLS_WITHIN_LIMIT = (() => {
  let cols = 1;
  while (panSteps(cols + 1) <= PAN_STEP_LIMIT) cols += 1;
  return cols;
})();

/** Наибольшее число столбцов, при котором доска видна целиком (panSteps = 0). */
export const MAX_COLS_FULLY_VISIBLE = (() => {
  let cols = 1;
  while (panSteps(cols + 1) === 0) cols += 1;
  return cols;
})();

export function withinPhoneLimit(cols: number): boolean {
  return panSteps(cols) <= PAN_STEP_LIMIT;
}
