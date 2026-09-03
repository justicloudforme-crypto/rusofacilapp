import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CrosswordBoard from "./CrosswordBoard";
import type { PublicCrosswordPuzzle } from "@/lib/word-games/data";

// A two-cell across word in a 1x2 grid: the smallest thing that is still a
// crossword. Everything here is about the input path, not about puzzles.
const puzzle: PublicCrosswordPuzzle = {
  id: "test-puzzle",
  type: "CROSSWORD",
  level: "A1",
  sequence: 1,
  rows: 1,
  cols: 2,
  blocked: [[false, false]],
  words: [{ number: 1, row: 0, col: 0, direction: "E", length: 2, clue: "prueba" }],
};

const dict = {
  hintButton: "Pista",
  crosswordGridLabel: "crucigrama",
  cluesTitle: "Pistas",
  acrossLabel: "Horizontales",
  downLabel: "Verticales",
  wrongCellHint: "Esa letra no es correcta",
  breakdownButton: "Ver el detalle",
  hideBreakdownButton: "Ocultar el detalle",
  breakdownLabel: "H {across}/{acrossTotal} V {down}/{downTotal}",
  progressCountLabel: "P {solved}/{words} C {filled}/{cells}",
};

function renderBoard() {
  return render(
    <CrosswordBoard puzzle={puzzle} dict={dict} onHintUsed={() => {}} onSolved={() => {}} />,
  );
}

/** The browser's own write to an input's value — the native setter, the way
 * a real edit reaches the DOM, bypassing React's tracked property. */
function browserTypes(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  nativeSetter.call(input, value);
}

/** Grading responses, released one at a time so a re-render can be made to
 * land exactly where the defect needed it. */
let pending: (() => void)[] = [];

beforeEach(() => {
  pending = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          pending.push(() =>
            resolve({
              ok: true,
              json: async () => ({ results: [], solved: false }),
            } as Response),
          );
        }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function releaseOneGradingResponse() {
  const next = pending.shift();
  if (!next) return;
  await act(async () => {
    next();
    await Promise.resolve();
  });
}

describe("CrosswordBoard input path", () => {
  it("keeps a letter typed while a grading response is re-rendering the board", async () => {
    // THE REGRESSION. Ordering, and it is the whole point of the test:
    //   1. the browser writes the character into the field;
    //   2. a grading response for an EARLIER keystroke arrives and re-renders;
    //   3. only then does the `input` event dispatch.
    //
    // With `value={guesses[key]}` on the cell, step 2 wrote "" back over the
    // character, and because React's value tracker then saw no change
    // between what it had written and what the event reported, step 3 never
    // reached `onChange` at all. The letter vanished with nothing reporting
    // a failure — one keystroke in about twenty under a fast driver.
    // See PROGRESS.md 7.54.
    renderBoard();
    const [first, second] = screen.getAllByRole("textbox") as HTMLInputElement[];

    // A first, ordinary keystroke — this is what leaves a grading response
    // in flight for step 2.
    await userEvent.type(first, "к");
    expect(first.value).toBe("К");

    // Step 1: the browser edits the second cell.
    browserTypes(second, "о");

    // Step 2: the in-flight grading response lands and re-renders the board.
    await releaseOneGradingResponse();

    // Step 3: only now does the input event arrive.
    await act(async () => {
      second.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(second.value, "the letter must survive a re-render that lands mid-keystroke").toBe("О");
  });

  it("Delete clears a cell, exactly like Backspace", async () => {
    // Delete used to be a dead key: it is not handled in keydown, and its
    // default action produces an input event with an empty value, which
    // handleChange discarded. Two keys that both mean "erase this" must not
    // disagree about whether erasing works.
    renderBoard();
    const [first] = screen.getAllByRole("textbox") as HTMLInputElement[];

    await userEvent.type(first, "к");
    expect(first.value).toBe("К");

    first.focus();
    await userEvent.keyboard("{Delete}");
    expect(first.value, "Delete must clear the cell").toBe("");

    await userEvent.type(first, "к");
    expect(first.value).toBe("К");
    first.focus();
    await userEvent.keyboard("{Backspace}");
    expect(first.value, "Backspace must clear the cell").toBe("");
  });

  it("clears the cell when an edit empties it another way (cut, select-all + Delete)", async () => {
    renderBoard();
    const [first] = screen.getAllByRole("textbox") as HTMLInputElement[];

    await userEvent.type(first, "к");
    expect(first.value).toBe("К");

    browserTypes(first, "");
    await act(async () => {
      first.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(first.value).toBe("");
  });

  // Positive control for the three above: they have to be able to fail.
  // A board whose cells never accept anything must break every one of them,
  // which is what proves they are watching the input path and not just the
  // fact that a grid renders.
  it("control: the assertions above fail when nothing can be typed at all", async () => {
    renderBoard();
    const [first] = screen.getAllByRole("textbox") as HTMLInputElement[];
    first.setAttribute("readonly", "readonly");
    await userEvent.type(first, "к");
    expect(first.value).toBe("");
  });
});

/**
 * СЧЁТЧИК И КНОПКА РАЗБОРА.
 *
 * Два утверждения, каждое — про число, которое видит человек:
 *   1. наверх выходят СЛОВА, закрытые целиком, а не нажатия клавиш;
 *   2. кнопка раскрывает разбор по направлениям и убирает его обратно,
 *      то есть каждое нажатие что-то меняет.
 *
 * Доска здесь другая: 2×2, одно слово поперёк и одно вниз с общей клеткой
 * (0,0) — наименьшая сетка, у которой есть обе величины разбора. Ответы
 * приходят не из `guesses`, а из подменённого /check, потому что именно так
 * они приходят в продукте: закрытое слово — утверждение сервера.
 */
const crossPuzzle: PublicCrosswordPuzzle = {
  id: "cross-puzzle",
  type: "CROSSWORD",
  level: "A1",
  sequence: 1,
  rows: 2,
  cols: 2,
  blocked: [
    [false, false],
    [false, true],
  ],
  words: [
    { number: 1, row: 0, col: 0, direction: "E", length: 2, clue: "poperek" },
    { number: 1, row: 0, col: 0, direction: "S", length: 2, clue: "vniz" },
  ],
};

/** Ключи клеток, которые сервер объявит верными. Меняется тестом до
 * рендера — подмена /check ниже читает его на каждом ответе. */
let correctKeys = new Set<string>();

function renderCross() {
  return render(
    <CrosswordBoard puzzle={crossPuzzle} dict={dict} onHintUsed={() => {}} onSolved={() => {}} />,
  );
}

describe("CrosswordBoard: счётчик прогресса и разбор по направлениям", () => {
  beforeEach(() => {
    correctKeys = new Set();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          guesses?: { row: number; col: number }[];
        };
        const results = (body.guesses ?? []).map((g) => ({
          row: g.row,
          col: g.col,
          correct: correctKeys.has(`${g.row},${g.col}`),
        }));
        return { ok: true, json: async () => ({ results, solved: false }) } as Response;
      }),
    );
  });

  async function typeInto(index: number, letter: string) {
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    await act(async () => {
      await userEvent.type(inputs[index], letter);
    });
  }

  const progress = () => document.querySelector("[data-crossword-progress]")?.textContent ?? "";
  const breakdown = () => document.querySelector("[data-crossword-breakdown]")?.textContent ?? null;

  it("считает СЛОВА, а не нажатия: три неверных буквы не дают ни одного слова", async () => {
    // ЭТО И ЕСТЬ ЗАМЕНЁННЫЙ ДЕФЕКТ. Прежний счётчик печатал «3/3» —
    // единица измерения не отличала угаданную букву от неугаданной.
    renderCross();
    await typeInto(0, "а");
    await typeInto(1, "б");
    await typeInto(2, "в");
    expect(progress(), "три неверные буквы: слов ноль, клетки заполнены").toBe("P 0/2 C 3/3");
  });

  it("слово, закрытое целиком, попадает в счётчик и в разбор по направлениям", async () => {
    correctKeys = new Set(["0,0", "0,1"]);
    renderCross();
    await typeInto(0, "а");
    await typeInto(1, "б");
    expect(progress()).toBe("P 1/2 C 2/3");

    expect(breakdown(), "до нажатия разбора нет").toBeNull();
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Ver el detalle" }));
    });
    expect(breakdown(), "поперечное слово закрыто, слово вниз — нет").toBe("H 1/1 V 0/1");
  });

  it("кнопка разбора работает в обе стороны: второе нажатие убирает строку", async () => {
    renderCross();
    const button = () => screen.getByRole("button", { name: /el detalle/ });
    await act(async () => {
      await userEvent.click(button());
    });
    expect(breakdown()).toBe("H 0/1 V 0/1");
    expect(button()).toHaveAttribute("aria-expanded", "true");
    await act(async () => {
      await userEvent.click(button());
    });
    expect(breakdown(), "второе нажатие обязано что-то менять").toBeNull();
    expect(button()).toHaveAttribute("aria-expanded", "false");
  });

  // КОНТРОЛЬ НА СЛЕПОТУ для трёх выше. Если счётчик снова начнёт печатать
  // клетки, а кнопка — молчать, эти же утверждения обязаны покраснеть.
  // Подсадка делает ровно это: подменяет строку счётчика на клеточную и
  // выкидывает разбор из документа.
  it("контроль: утверждения выше краснеют на счётчике по клеткам и немой кнопке", async () => {
    correctKeys = new Set(["0,0", "0,1"]);
    renderCross();
    await typeInto(0, "а");
    await typeInto(1, "б");

    const node = document.querySelector("[data-crossword-progress]")!;
    node.textContent = `P 2/2 C 2/3`; // «прогресс» = число заполненных клеток
    expect(progress()).not.toBe("P 1/2 C 2/3");

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Ver el detalle" }));
    });
    document.querySelector("[data-crossword-breakdown]")!.remove();
    expect(breakdown()).toBeNull();
  });
});

/**
 * ОБГОН ОТВЕТОВ. `updateGuess` шлёт POST /check на каждое нажатие и не
 * ждёт предыдущего ответа. Ответы приходят не в том порядке, в каком
 * уехали, и `setCellStatus` заменял подсветку целиком тем, что пришло
 * последним ПО ВРЕМЕНИ.
 *
 * Дефект пойман не рассуждением, а прогоном: WebKit, набор всех 21 клетки
 * A1/1 подряд, доска заполнена целиком, а счётчик слов стоял на «3 из 6» и
 * не двигался (e2e-прогон 03.09.2026). До счётчика слов это было почти
 * невидимо — подсветка отставала на клетку и догоняла со следующим
 * нажатием, а «решено» приходит из тела ответа, а не из подсветки.
 */
describe("CrosswordBoard: ответ, обогнанный более свежим запросом", () => {
  /** Отложенные ответы: каждый элемент — что вернуть и чем это отпустить. */
  let queue: Array<{ release: () => void }>;

  beforeEach(() => {
    queue = [];
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        call += 1;
        // Первый ответ объявляет клетку (0,0) НЕверной, второй — верной.
        // Первый уезжает раньше, приезжает позже.
        const correct = call > 1;
        return new Promise((resolve) => {
          queue.push({
            release: () =>
              resolve({
                ok: true,
                json: async () => ({ results: [{ row: 0, col: 0, correct }], solved: false }),
              } as Response),
          });
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function releaseAt(index: number) {
    const item = queue[index];
    await act(async () => {
      item.release();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("старый ответ не перекрашивает доску поверх свежего", async () => {
    render(
      <CrosswordBoard puzzle={crossPuzzle} dict={dict} onHintUsed={() => {}} onSolved={() => {}} />,
    );
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    await act(async () => {
      await userEvent.type(inputs[0], "а");
    });
    await act(async () => {
      await userEvent.type(inputs[1], "б");
    });
    expect(queue.length, "два нажатия — два запроса в полёте").toBe(2);

    // Свежий ответ приезжает первым: клетка верна.
    await releaseAt(1);
    expect(inputs[0].className, "свежий ответ покрасил клетку зелёным").toContain("border-emerald-500");

    // Отставший ответ приезжает вторым. Он относится к состоянию доски,
    // которого уже нет, и не должен трогать ничего.
    await releaseAt(0);
    expect(inputs[0].className, "отставший ответ не перекрашивает доску").toContain("border-emerald-500");
    expect(inputs[0].className).not.toContain("border-red-400");
  });

  // КОНТРОЛЬ НА СЛЕПОТУ: утверждение выше обязано покраснеть, если ответы
  // приедут в том порядке, в каком уехали, — тогда обгона нет и тест
  // проверяет не то, ради чего написан.
  it("контроль: без обгона последним словом остаётся свежий ответ и без защиты", async () => {
    render(
      <CrosswordBoard puzzle={crossPuzzle} dict={dict} onHintUsed={() => {}} onSolved={() => {}} />,
    );
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    await act(async () => {
      await userEvent.type(inputs[0], "а");
    });
    await releaseAt(0);
    expect(inputs[0].className, "первый ответ один в полёте — он и красит").toContain("border-red-400");
  });
});
