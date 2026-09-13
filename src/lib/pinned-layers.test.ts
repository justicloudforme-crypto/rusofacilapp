import { describe, expect, it } from "vitest";
import {
  KEYBOARD_MIN_SHRINK_PX,
  firstOverlappingBand,
  freeIntervals,
  isKeyboardOpen,
  placeInFreeBand,
} from "./pinned-layers";

/**
 * Чистая геометрия общего учёта прижатых слоёв (долг 161). Всё, что
 * здесь проверяется, живёт без DOM — и потому проверяется здесь, а не в
 * браузере: сторож `scripts/check-bottom-inset.mjs` отвечает на вопрос
 * «сходится ли это с настоящей страницей», а этот файл — на вопрос
 * «правильна ли сама арифметика».
 *
 * Отдельно про `isKeyboardOpen`: НАСТОЯЩЕЙ экранной клавиатуры нет ни у
 * сторожа, ни здесь — в настольном браузере `visualViewport.height`
 * всегда равен `innerHeight`. Числа ниже взяты с живого телефона
 * владельца 13.09.2026 (904 без клавиатуры, 569 с ней), и это
 * единственное место, где решающая функция закрыта проверкой.
 */
describe("isKeyboardOpen", () => {
  it("числами с телефона владельца: самая большая виденная 904 → сейчас 569 это клавиатура", () => {
    expect(isKeyboardOpen(904, 569)).toBe(true);
  });

  it("Android, где ужимается и layout-вьюпорт, ловится тем же сравнением", () => {
    // Это и есть причина, по которой сравнивается САМАЯ БОЛЬШАЯ виденная
    // высота, а не `innerHeight`: на Android второе даёт 569 − 569 = 0, и
    // клавиатура остаётся незамеченной. Жалоба владельца пришла с Android.
    const tallestSeen = 904;
    expect(isKeyboardOpen(tallestSeen, 569)).toBe(true);
    expect(isKeyboardOpen(569, 569)).toBe(false); // память ещё не набрана
  });

  it("панель адресной строки (около 60 px) клавиатурой не считается", () => {
    expect(isKeyboardOpen(904, 844)).toBe(false);
  });

  it("порог лежит строго между двумя настоящими величинами", () => {
    expect(KEYBOARD_MIN_SHRINK_PX).toBeGreaterThan(60);
    expect(KEYBOARD_MIN_SHRINK_PX).toBeLessThan(335);
    expect(isKeyboardOpen(1000, 1000 - KEYBOARD_MIN_SHRINK_PX)).toBe(true);
    expect(isKeyboardOpen(1000, 1000 - KEYBOARD_MIN_SHRINK_PX + 1)).toBe(false);
  });

  it("нечисло — не клавиатура, а отсутствие ответа", () => {
    expect(isKeyboardOpen(Number.NaN, 500)).toBe(false);
  });
});

describe("freeIntervals", () => {
  const viewport = { top: 0, bottom: 780 };

  it("без полос свободно всё окно", () => {
    expect(freeIntervals(viewport, [])).toEqual([{ top: 0, bottom: 780 }]);
  });

  it("шапка сверху и панель снизу оставляют середину", () => {
    const bands = [
      { top: 0, bottom: 65, label: "Navbar" },
      { top: 729, bottom: 780, label: "BottomNav" },
    ];
    expect(freeIntervals(viewport, bands)).toEqual([{ top: 65, bottom: 729 }]);
  });

  it("полоса посередине (плеер рассказа) режет окно надвое", () => {
    const bands = [{ top: 453, bottom: 561, label: "StoryAudioPlayer" }];
    expect(freeIntervals(viewport, bands)).toEqual([
      { top: 0, bottom: 453 },
      { top: 561, bottom: 780 },
    ]);
  });

  it("наложившиеся полосы склеиваются в одну, а не считаются дважды", () => {
    const bands = [
      { top: 600, bottom: 700, label: "a" },
      { top: 650, bottom: 780, label: "b" },
    ];
    expect(freeIntervals(viewport, bands)).toEqual([{ top: 0, bottom: 600 }]);
  });

  it("полоса, вылезшая за окно, обрезается по окну", () => {
    const bands = [{ top: -50, bottom: 40, label: "a" }];
    expect(freeIntervals(viewport, bands)).toEqual([{ top: 40, bottom: 780 }]);
  });

  it("полоса целиком вне окна свободного места не отнимает", () => {
    const bands = [{ top: 800, bottom: 900, label: "спрятанная прокруткой" }];
    expect(freeIntervals(viewport, bands)).toEqual([{ top: 0, bottom: 780 }]);
  });
});

describe("placeInFreeBand", () => {
  const viewport = { top: 0, bottom: 780 };

  it("без полос ставит НАД словом — прежнее поведение сохранено", () => {
    const top = placeInFreeBand({
      anchorTop: 400,
      anchorBottom: 432,
      height: 120,
      margin: 8,
      viewport,
      bands: [],
    });
    expect(top).toBe(400 - 8 - 120);
  });

  it("жертва 159 числами: плеер 453..561, слово 581..613 — карточка уходит ВНИЗ", () => {
    // До правки здесь получалось 581 − 8 − 120 = 453, то есть ровно на
    // верхний край плеера: замер в браузере давал 6 закрытых кнопок из 6.
    const bands = [
      { top: 0, bottom: 65, label: "Navbar" },
      { top: 453, bottom: 561, label: "StoryAudioPlayer" },
      { top: 729, bottom: 780, label: "BottomNav" },
    ];
    const top = placeInFreeBand({
      anchorTop: 581,
      anchorBottom: 613,
      height: 90,
      margin: 8,
      viewport,
      bands,
    });
    expect(top).toBe(621);
    expect(firstOverlappingBand({ top, bottom: top + 90 }, bands)).toBeNull();
  });

  it("слово у нижней панели: карточка уходит НАД ним, а не под панель", () => {
    const bands = [
      { top: 0, bottom: 65, label: "Navbar" },
      { top: 729, bottom: 780, label: "BottomNav" },
    ];
    const top = placeInFreeBand({
      anchorTop: 700,
      anchorBottom: 720,
      height: 128,
      margin: 8,
      viewport,
      bands,
    });
    expect(top).toBe(700 - 8 - 128);
    expect(firstOverlappingBand({ top, bottom: top + 128 }, bands)).toBeNull();
  });

  it("места над словом не хватает — карточка прижимается к краю свободного промежутка", () => {
    // Свободно только 65..729, а карточке 128: сверху её не поставить
    // (слово стоит на 100), снизу она упёрлась бы в панель.
    const bands = [
      { top: 0, bottom: 65, label: "Navbar" },
      { top: 729, bottom: 780, label: "BottomNav" },
    ];
    const top = placeInFreeBand({
      anchorTop: 100,
      anchorBottom: 132,
      height: 128,
      margin: 8,
      viewport,
      bands,
    });
    expect(top).toBe(140);
    expect(firstOverlappingBand({ top, bottom: top + 128 }, bands)).toBeNull();
  });

  it("под шапку не лезет: слово у самого верха окна", () => {
    const bands = [{ top: 0, bottom: 65, label: "Navbar" }];
    const top = placeInFreeBand({
      anchorTop: 70,
      anchorBottom: 100,
      height: 120,
      margin: 8,
      viewport,
      bands,
    });
    expect(top).toBeGreaterThanOrEqual(65);
  });

  it("когда не влезает никуда — прижимается к низу окна, а не к полосе", () => {
    const bands = [{ top: 100, bottom: 200, label: "полоса" }];
    const top = placeInFreeBand({
      anchorTop: 150,
      anchorBottom: 160,
      height: 5000,
      margin: 8,
      viewport,
      bands,
    });
    expect(top).toBe(viewport.top);
  });
});

describe("firstOverlappingBand", () => {
  it("касание краями пересечением не считается", () => {
    expect(firstOverlappingBand({ top: 100, bottom: 200 }, [{ top: 200, bottom: 300, label: "a" }])).toBeNull();
  });

  it("называет первую пересечённую полосу поимённо", () => {
    expect(
      firstOverlappingBand({ top: 100, bottom: 250 }, [
        { top: 400, bottom: 500, label: "далёкая" },
        { top: 200, bottom: 300, label: "BottomNav" },
      ])?.label,
    ).toBe("BottomNav");
  });
});
