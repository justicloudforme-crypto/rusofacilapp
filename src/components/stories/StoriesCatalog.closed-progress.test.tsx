import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { StoryProgress } from "@/lib/reading-progress";

/**
 * ДОЛГ 206 (заход 7.292; решение владельца 15.11.2026 — вариант «б»):
 * карточка ЗАКРЫТОГО рассказа с прогрессом чтения обязана сказать, что
 * рассказ сейчас закрыт; карточка ОТКРЫТОГО — не обязана и не должна.
 *
 * Снимок владельца: «Прогресс: 94 %» и «Прогресс: 10 %» под аккаунтом без
 * подписки — прогресс честный (записан за день до того, как материал
 * закрылся), но карточка молчала, что его больше не открыть.
 */

const PROGRESS: Record<string, StoryProgress> = {
  closed: { currentPage: 15, queueIndex: null, totalPages: 16, percent: 94, isCompleted: false, updatedAt: 1 },
  closedDone: { currentPage: 4, queueIndex: null, totalPages: 4, percent: 100, isCompleted: true, updatedAt: 1 },
  premium: { currentPage: 1, queueIndex: null, totalPages: 10, percent: 10, isCompleted: false, updatedAt: 1 },
  open: { currentPage: 3, queueIndex: null, totalPages: 6, percent: 50, isCompleted: false, updatedAt: 1 },
};

vi.mock("@/lib/reading-progress", () => ({
  getAllStoryProgress: () => PROGRESS,
  syncStoryProgress: () => Promise.resolve(PROGRESS),
}));
vi.mock("@/contexts/PaywallContext", () => ({ usePaywall: () => ({ openPaywall: () => {} }) }));
vi.mock("@/lib/native-shell-client", () => ({ useIsNativeShell: () => false }));

import StoriesCatalog, { type StorySummary } from "./StoriesCatalog";
import es from "@/dictionaries/es.json";
import ru from "@/dictionaries/ru.json";

function story(id: string, lockReason: StorySummary["lockReason"], requires: StorySummary["requires"]): StorySummary {
  return {
    id,
    titles: { primary: `T-${id}`, secondary: null } as unknown as StorySummary["titles"],
    author: "A",
    byline: "A",
    level: "A2",
    isPremium: lockReason === "premium",
    lockReason,
    requires,
    description: null,
    hasAudio: false,
    readingMinutes: null,
    topic: "daily_life",
    isClassic: false,
  };
}

const STORIES = [
  story("open", null, "free"),
  story("closed", "free", "subscription"),
  story("closedDone", "free", "subscription"),
  story("premium", "premium", "premium-tier"),
];

async function renderCatalog(lang: "es" | "ru") {
  const dict = lang === "es" ? es : ru;
  await act(async () => {
    render(<StoriesCatalog lang={lang} stories={STORIES} tier="free" dict={{ ...dict.stories, ...dict.access }} />);
  });
  const cards = screen.getAllByTestId("story-card");
  const byId = (id: string) => cards.find((c) => c.getAttribute("href")?.endsWith(`/stories/${id}`))!;
  return { dict, byId };
}

afterEach(cleanup);

describe("долг 206 — прогресс у закрытого рассказа подписан «закрыт»", () => {
  for (const lang of ["es", "ru"] as const) {
    it(`${lang}: закрытый по подписке — прогресс виден И сказано, что закрыт`, async () => {
      const { dict, byId } = await renderCatalog(lang);
      const card = within(byId("closed"));
      expect(card.getByText(dict.stories.progressLabel.replace("{percent}", "94"))).toBeTruthy();
      expect(card.queryByText(dict.stories.closedProgressNote), "карточка с прогрессом молчит, что рассказ закрыт").toBeTruthy();
    });

    it(`${lang}: прочитанный, но закрытый — тоже подписан`, async () => {
      const { dict, byId } = await renderCatalog(lang);
      expect(within(byId("closedDone")).queryByText(dict.stories.closedProgressNote)).toBeTruthy();
    });

    it(`${lang}: закрытый Premium — подпись про Premium`, async () => {
      const { dict, byId } = await renderCatalog(lang);
      expect(within(byId("premium")).queryByText(dict.stories.closedProgressNotePremium)).toBeTruthy();
    });

    it(`${lang}: открытый — подписи «закрыт» нет (обратная сторона)`, async () => {
      const { dict, byId } = await renderCatalog(lang);
      const card = within(byId("open"));
      expect(card.getByText(dict.stories.progressLabel.replace("{percent}", "50"))).toBeTruthy();
      expect(card.queryByText(dict.stories.closedProgressNote)).toBeNull();
      expect(card.queryByText(dict.stories.closedProgressNotePremium)).toBeNull();
    });
  }
});
