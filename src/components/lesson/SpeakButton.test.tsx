import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SpeakButton from "./SpeakButton";

// jsdom doesn't implement real audio playback — spy on the global Audio
// constructor so we can see which URL was used to build each element and
// how many were created, without needing a real <audio> to actually play.
class FakeAudio {
  src: string;
  currentTime = 0;
  onplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(src: string) {
    this.src = src;
  }
  play() {
    this.onplay?.();
    return Promise.resolve();
  }
  pause() {}
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SpeakButton", () => {
  it("builds a fresh Audio element for a new audioUrl instead of replaying a stale cached one", async () => {
    const user = userEvent.setup();
    const audioCtor = vi.fn(function (src: string) {
      return new FakeAudio(src);
    });
    vi.stubGlobal("Audio", audioCtor);

    // Regression test for a real bug: this component instance is reused
    // across cards in a swipeable deck (no `key` prop per card), so
    // `audioUrl` changes via a prop update, not a remount. The old code
    // cached the Audio object in a ref on first click and never rebuilt
    // it, so every card after the first replayed the first card's audio.
    const { rerender } = render(<SpeakButton text="хлеб" label="Escuchar" audioUrl="/audio/flashcards/food-bread-word.mp3" />);

    await user.click(screen.getByRole("button", { name: "Escuchar" }));
    expect(audioCtor).toHaveBeenCalledTimes(1);
    expect(audioCtor).toHaveBeenLastCalledWith("/audio/flashcards/food-bread-word.mp3");

    // Simulate the deck advancing to the next card: same component
    // instance, new audioUrl prop.
    rerender(<SpeakButton text="суп" label="Escuchar" audioUrl="/audio/flashcards/food-soup-word.mp3" />);

    await user.click(screen.getByRole("button", { name: "Escuchar" }));
    expect(audioCtor).toHaveBeenCalledTimes(2);
    expect(audioCtor).toHaveBeenLastCalledWith("/audio/flashcards/food-soup-word.mp3");
  });
});
