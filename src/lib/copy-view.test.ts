import { beforeEach, describe, expect, it } from "vitest";
import { COPY_VIEW_KEY, COPY_VIEW_MAX_AGE_MS, parseCopyView, takeCopyView } from "./copy-view";

// Заход 7.239: записка каркаса о вкладке и прокрутке копии.
const PATH = "/es/courses/a1/1";
const NOW = 1_790_000_000_000;
const note = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ path: PATH, tab: "exercises", y: 840, at: NOW - 2_000, ...over });

describe("parseCopyView", () => {
  it("отдаёт вкладку и прокрутку своей записки", () => {
    expect(parseCopyView(note(), PATH, NOW)).toEqual({ tab: "exercises", y: 840 });
  });

  it("чужой адрес — не наша записка", () => {
    expect(parseCopyView(note({ path: "/es/courses/a1/2" }), PATH, NOW)).toBeNull();
  });

  it("старше срока — забытая, не про этот возврат сети", () => {
    expect(parseCopyView(note({ at: NOW - COPY_VIEW_MAX_AGE_MS - 1 }), PATH, NOW)).toBeNull();
  });

  it("мусор и пустота — ничего", () => {
    expect(parseCopyView(null, PATH, NOW)).toBeNull();
    expect(parseCopyView("{", PATH, NOW)).toBeNull();
    expect(parseCopyView(note({ at: "вчера" }), PATH, NOW)).toBeNull();
  });

  it("без вкладки и с кривой прокруткой — только то, что годно", () => {
    expect(parseCopyView(note({ tab: null, y: -5 }), PATH, NOW)).toEqual({ tab: null, y: 0 });
  });
});

describe("takeCopyView", () => {
  beforeEach(() => sessionStorage.clear());

  it("читается один раз и стирается", () => {
    sessionStorage.setItem(COPY_VIEW_KEY, note());
    expect(takeCopyView(PATH, NOW)).toEqual({ tab: "exercises", y: 840 });
    expect(sessionStorage.getItem(COPY_VIEW_KEY)).toBeNull();
    expect(takeCopyView(PATH, NOW)).toBeNull();
  });

  it("позитивный контроль: без записки урок открывается как раньше", () => {
    expect(takeCopyView(PATH, NOW)).toBeNull();
  });
});
