import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import SocialLinks from "./SocialLinks";
import { SOCIAL_PROFILE_URLS } from "@/lib/social-links";
import { organizationJsonLd } from "@/lib/site";
import { PLAY_STORE_URL } from "@/lib/pwa-manifest";

afterEach(cleanup);

/** Заход 7.320: значки Instagram и Facebook в подвале и `sameAs` организации. */
describe("SocialLinks", () => {
  it.each(["es", "ru"] as const)("/%s: две ссылки, новая вкладка, подпись для чтецов, без TikTok/YouTube", (lang) => {
    const { container } = render(<SocialLinks lang={lang} />);
    const links = [...container.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://www.instagram.com/rusofacilapp/",
      "https://www.facebook.com/share/1BMZLxUe62/",
    ]);
    for (const a of links) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
      expect(a.getAttribute("aria-label")).toMatch(lang === "ru" ? /откроется в новой вкладке/ : /se abre en una pestaña nueva/);
      expect(a.className).toMatch(/min-h-11/);
      expect(a.className).toMatch(/min-w-11/);
    }
    expect(container.innerHTML).not.toMatch(/tiktok|youtube/i);
  });
});

describe("organizationJsonLd.sameAs", () => {
  it("браузеру — Google Play и оба профиля", () => {
    expect(organizationJsonLd("es", false).sameAs).toEqual([PLAY_STORE_URL, ...SOCIAL_PROFILE_URLS]);
  });
  it("приложению — только профили, адреса магазина нет", () => {
    const same = organizationJsonLd("ru", true).sameAs;
    expect(same).toEqual([...SOCIAL_PROFILE_URLS]);
    expect(JSON.stringify(same)).not.toContain("play.google.com");
  });
});
