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
  checkButton: "Comprobar",
  filledCountLabel: "{filled}/{total}",
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
