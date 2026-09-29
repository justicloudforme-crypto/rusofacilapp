import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * УХОД СО СТРАНИЦЫ ОБНУЛЯЕТ ШКАЛУ ШТОРКИ — ЗАХОД 7.248 (Ж.2).
 *
 * Java-половина плагина хранит длительность и позицию в процессе, и
 * `setPositionState({})` оставляет прежние. Замер на эмуляторе: живая
 * «Репка» (полная дорожка) → живой «Колобок» (по фразам) — сессия
 * «Колобка» стартовала с `position=66657`. Здесь заперт порядок: сперва
 * шкала в ноль, потом «none».
 */
const calls: string[] = [];
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capgo/capacitor-media-session", () => ({
  MediaSession: {
    setPositionState: vi.fn(async (o: unknown) => {
      calls.push(`position ${JSON.stringify(o)}`);
    }),
    setPlaybackState: vi.fn(async (o: { playbackState: string }) => {
      calls.push(`state ${o.playbackState}`);
    }),
  },
}));

import { clearNativeMediaSession, setNativePositionState } from "./native-media-session";

beforeEach(() => {
  calls.length = 0;
});

describe("нативная шторка: обнуление шкалы (7.248, Ж.2)", () => {
  it("clearNativeMediaSession: сперва длительность и позиция в ноль, потом «none»", async () => {
    await clearNativeMediaSession();
    expect(calls).toEqual(['position {"duration":0,"position":0,"playbackRate":1}', "state none"]);
  });

  it("setNativePositionState(null) — «шкалы нет», а не «оставить прежнюю»", async () => {
    await setNativePositionState(null);
    expect(calls).toEqual(['position {"duration":0,"position":0,"playbackRate":1}']);
  });

  it("контроль: настоящая шкала передаётся как есть", async () => {
    await setNativePositionState({ duration: 89.2, playbackRate: 1, position: 12.5 });
    expect(calls).toEqual(['position {"duration":89.2,"playbackRate":1,"position":12.5}']);
  });
});
