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
  duration = 5;
  ended = false;
  paused = true;
  onplay: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(src: string) {
    this.src = src;
  }
  play() {
    this.paused = false;
    this.onplay?.();
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.onpause?.();
  }
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

  it("toggles pause/resume in place instead of always restarting from 0", async () => {
    const user = userEvent.setup();
    let created: FakeAudio | null = null;
    vi.stubGlobal(
      "Audio",
      vi.fn(function (src: string) {
        created = new FakeAudio(src);
        return created;
      })
    );

    render(<SpeakButton text="хлеб" label="Escuchar" audioUrl="/audio/flashcards/food-bread-word.mp3" />);
    const button = screen.getByRole("button", { name: "Escuchar" });

    // First tap starts playback from the top.
    await user.click(button);
    expect(created!.paused).toBe(false);
    expect(created!.currentTime).toBe(0);

    // Simulate 2s of playback, then pause mid-clip.
    created!.currentTime = 2;
    await user.click(button);
    expect(created!.paused).toBe(true);
    // The regression this guards against: pausing must not reset position.
    expect(created!.currentTime).toBe(2);

    // Resuming must continue from 2s, not restart from 0.
    await user.click(button);
    expect(created!.paused).toBe(false);
    expect(created!.currentTime).toBe(2);
  });
});
