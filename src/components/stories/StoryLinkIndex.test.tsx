import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import StoryLinkIndex from "./StoryLinkIndex";
import MediaLinkIndex from "@/components/media/MediaLinkIndex";
import { STORY_CONTROL_SIZE, STORY_PILOT_SIZE } from "@/lib/story-pilot";

/**
 * Один контракт на оба списка: КАЖДЫЙ элемент семейства получает ровно
 * одну ссылку, и то, сколько их и в каком порядке, не зависит ни от
 * тарифа посетителя, ни от того, в каком порядке пришли данные.
 *
 * Почему это тест, а не чтение кода. Дефект, который список чинит,
 * выглядел ровно так же безобидно: `StoriesCatalog` печатает `slice(0,
 * 24)` — и 301 рассказ остался без единого ребра. «Ссылка на каждый»
 * проверяется числом или не проверяется вовсе.
 */

const DICT = { indexTitle: "Título", indexIntro: "Intro" };

function rows(n: number, level = "A1") {
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    title: `Título ${String(i).padStart(3, "0")}`,
    level,
  }));
}

const hrefs = (container: HTMLElement) =>
  [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");

describe("StoryLinkIndex", () => {
  it("печатает ссылку на каждый рассказ, а не на первые 24", () => {
    const stories = rows(325);
    const { container } = render(<StoryLinkIndex lang="es" stories={stories} dict={DICT} />);
    const links = hrefs(container);
    expect(links).toHaveLength(325);
    expect(new Set(links).size).toBe(325);
    for (const story of stories) expect(links).toContain(`/es/stories/${story.id}`);
  });

  it("анкор — заголовок рассказа, а не «читать»", () => {
    const { container } = render(
      <StoryLinkIndex lang="ru" stories={[{ id: "x", title: "Теремок", level: "A1" }]} dict={DICT} />,
    );
    expect(container.querySelector("a")?.textContent).toBe("Теремок");
  });

  it("порядок не зависит от порядка входа (значит, и от тарифа посетителя)", () => {
    const stories = rows(40, "A2");
    const a = render(<StoryLinkIndex lang="es" stories={stories} dict={DICT} />);
    const b = render(<StoryLinkIndex lang="es" stories={[...stories].reverse()} dict={DICT} />);
    expect(hrefs(a.container)).toEqual(hrefs(b.container));
  });

  it("группы идут в порядке уровней, а незнакомый уровень не теряется", () => {
    const { container } = render(
      <StoryLinkIndex
        lang="es"
        stories={[
          { id: "b1", title: "b", level: "B1" },
          { id: "a1", title: "a", level: "A1" },
          { id: "zz", title: "z", level: "C2" },
        ]}
        dict={DICT}
      />,
    );
    expect([...container.querySelectorAll("h3")].map((h) => h.textContent)).toEqual(["A1", "B1", "C2"]);
    expect(hrefs(container)).toHaveLength(3);
  });

  it("пустой список не печатает пустую секцию", () => {
    const { container } = render(<StoryLinkIndex lang="es" stories={[]} dict={DICT} />);
    expect(container.querySelector("section")).toBeNull();
  });
});

describe("MediaLinkIndex", () => {
  it("печатает ссылку на каждый элемент медиатеки", () => {
    const items = rows(275, "B2");
    const { container } = render(<MediaLinkIndex lang="ru" items={items} dict={DICT} />);
    expect(hrefs(container)).toHaveLength(275);
    expect(hrefs(container)[0]).toMatch(/^\/ru\/media\//);
  });
});

/**
 * Заморозка. 330 URL базовой линии — это 65 рассказов и 100 медиа, обе
 * локали; ссылками их задевают оба списка сразу. Требование к этому
 * заходу — не «не задеть», а «задеть ОДИНАКОВО»: 50 пилотных и 15
 * контрольных рассказов должны получить поровну, иначе список сам станет
 * вмешательством в измеряемую величину.
 */
describe("заморозка: обращение одинаковое", () => {
  const baseline = JSON.parse(
    readFileSync(join(process.cwd(), "docs", "frozen-baseline-2026-08-30.json"), "utf8"),
  ) as Record<string, { url: string }>;
  const frozenPaths = Object.values(baseline).map((entry) => new URL(entry.url).pathname);

  it("каждый замороженный рассказ получает ровно одну ссылку, как и любой другой", () => {
    // Половина замороженная, половина нет — если бы список их различал,
    // числа разошлись бы.
    const stories = [
      ...rows(10).map((r, i) => ({ ...r, id: `plain-${i}` })),
      ...frozenPaths
        .filter((p) => p.startsWith("/es/stories/"))
        .map((p, i) => ({ id: p.split("/").pop()!, title: `Frozen ${i}`, level: "A1" })),
    ];
    const { container } = render(<StoryLinkIndex lang="es" stories={stories} dict={DICT} />);
    const counts = new Map<string, number>();
    for (const href of hrefs(container)) counts.set(href, (counts.get(href) ?? 0) + 1);
    expect([...new Set(counts.values())]).toEqual([1]);
    expect(counts.size).toBe(stories.length);
    // И это действительно вся замороженная группа, а не её кусок: число
    // спрашивается у кода эксперимента (50 пилот + 15 контроль), а не
    // вписано литералом.
    expect(stories.length - 10).toBe(STORY_PILOT_SIZE + STORY_CONTROL_SIZE);
  });

  it("каждый замороженный медиа-элемент получает ровно одну ссылку, включая заблокированный", () => {
    const mediaIds = frozenPaths.filter((p) => p.startsWith("/es/media/")).map((p) => p.split("/").pop()!);
    expect(mediaIds).toContain("song-ty-uydyosh"); // тот самый blocked на проде
    const items = mediaIds.map((id, i) => ({ id, title: `M ${i}`, level: "A1" }));
    const { container } = render(<MediaLinkIndex lang="es" items={items} dict={DICT} />);
    const links = hrefs(container);
    expect(links).toHaveLength(100);
    expect(new Set(links).size).toBe(100);
    expect(links).toContain("/es/media/song-ty-uydyosh");
  });
});
