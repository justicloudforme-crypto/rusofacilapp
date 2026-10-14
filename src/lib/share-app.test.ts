import { describe, expect, it } from "vitest";
import { PLAY_SHARE_URL, SITE_SHARE_URL, shareMessage, shareUrlFor } from "./share-app";

describe("ссылка «Compartir» (7.266)", () => {
  it("в приложении — Play с меткой share", () => {
    expect(shareUrlFor({ native: true, userAgent: "Mozilla/5.0 (Linux; Android 15)" })).toBe(PLAY_SHARE_URL);
    expect(PLAY_SHARE_URL).toBe(
      "https://play.google.com/store/apps/details?id=com.rusofacilapp.app&referrer=utm_source%3Dshare",
    );
  });
  it("браузер Android-телефона — та же ссылка Play", () =>
    expect(shareUrlFor({ native: false, userAgent: "Mozilla/5.0 (Linux; Android 14; POCO) Chrome/140" })).toBe(
      PLAY_SHARE_URL,
    ));
  it("компьютер и iPhone — сайт /es с utm_source=share", () => {
    expect(shareUrlFor({ native: false, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)" })).toBe(SITE_SHARE_URL);
    expect(shareUrlFor({ native: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" })).toBe(SITE_SHARE_URL);
    expect(SITE_SHARE_URL).toBe("https://rusofacilapp.com/es?utm_source=share");
  });
  it("сообщение — текст и ссылка в конце", () => expect(shareMessage("Hola.", "https://x")).toBe("Hola. https://x"));
});
