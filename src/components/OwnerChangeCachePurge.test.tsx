import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OwnerChangeCachePurge from "./OwnerChangeCachePurge";
import { GUEST_PAGE_OWNER, PAGE_OWNER_KEY, ownerChangePurge } from "@/lib/signed-out";
import { DOWNLOADS_CACHE_NAME, GENERATION_CACHE_NAME } from "@/lib/sw-cache-names";

// Ж.4 (аудит 7.241; заход 7.243): вход чистит копии разделов прошлого
// владельца, как выход; скачанное текущего владельца и очередь ответов
// (IndexedDB `rf-progress-outbox`) — не трогаются.
const ALL = [
  "rf-pages-abc123",
  "rf-pages-rsc-abc123",
  "rf-pages-section-abc123",
  "rf-pages-content-abc123",
  "rf-pages-sheets-abc123",
  "others",
  DOWNLOADS_CACHE_NAME,
  GENERATION_CACHE_NAME,
  "serwist-precache-v2-x",
  "audio-clips",
];

describe("ownerChangePurge", () => {
  it("гость → учётка: копии разделов уходят, скачанное и метка поколения остаются", () => {
    const gone = ownerChangePurge(ALL, GUEST_PAGE_OWNER, "user-b");
    expect(gone).toContain("rf-pages-section-abc123");
    expect(gone).toContain("rf-pages-abc123");
    expect(gone).toContain("others");
    expect(gone).not.toContain(DOWNLOADS_CACHE_NAME);
    expect(gone).not.toContain(GENERATION_CACHE_NAME);
    expect(gone).not.toContain("serwist-precache-v2-x");
    expect(gone).not.toContain("audio-clips");
  });
  it("учётка A → учётка B: как выход — и скачанное A тоже", () => {
    const gone = ownerChangePurge(ALL, "user-a", "user-b");
    expect(gone).toContain(DOWNLOADS_CACHE_NAME);
    expect(gone).toContain("rf-pages-section-abc123");
    expect(gone).not.toContain("audio-clips");
  });
  it("тот же владелец или прошлый неизвестен — ничего (контроль: два пустых случая не равны «всё чисто»)", () => {
    expect(ownerChangePurge(ALL, "user-a", "user-a")).toEqual([]);
    expect(ownerChangePurge(ALL, null, "user-a")).toEqual([]);
    expect(ownerChangePurge(ALL, GUEST_PAGE_OWNER, "user-a").length).toBeGreaterThan(0);
  });
});

describe("OwnerChangeCachePurge", () => {
  let names: string[];
  beforeEach(() => {
    names = [...ALL];
    vi.stubGlobal("caches", {
      keys: async () => [...names],
      delete: async (name: string) => {
        names = names.filter((n) => n !== name);
        return true;
      },
    });
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("гость смотрел разделы, затем вошёл — копии гостя ушли, скачанное осталось", async () => {
    render(<OwnerChangeCachePurge owner={GUEST_PAGE_OWNER} />);
    expect(localStorage.getItem(PAGE_OWNER_KEY)).toBe(GUEST_PAGE_OWNER);
    cleanup();
    render(<OwnerChangeCachePurge owner="user-b" />);
    await waitFor(() => expect(names).not.toContain("rf-pages-section-abc123"));
    expect(names).toContain(DOWNLOADS_CACHE_NAME);
    expect(localStorage.getItem(PAGE_OWNER_KEY)).toBe("user-b");
  });

  it("контроль: тот же владелец на следующей загрузке — ничего не удалено", async () => {
    localStorage.setItem(PAGE_OWNER_KEY, "user-b");
    render(<OwnerChangeCachePurge owner="user-b" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(names).toEqual(ALL);
  });
});
