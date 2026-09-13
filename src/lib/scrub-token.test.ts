import { describe, expect, it } from "vitest";
import { scrubTokenFromUrl, scrubTokensFromEvent } from "./scrub-token";

/** Долг 164, вторая стена. Позитивный контроль здесь — не украшение:
 *  «токена в событии нет» доказывает что-то только рядом с «а вот такой
 *  токен прибор видит». */
describe("вырезание токена из адресов события Sentry (долг 164)", () => {
  it("режет токен и в строке запроса, и во фрагменте", () => {
    expect(scrubTokenFromUrl("https://rusofacilapp.com/es/reset-password?token=abc.def")).toBe(
      "https://rusofacilapp.com/es/reset-password?token=[вырезано]",
    );
    expect(scrubTokenFromUrl("https://rusofacilapp.com/es/reset-password#token=abc.def")).toBe(
      "https://rusofacilapp.com/es/reset-password#token=[вырезано]",
    );
    expect(scrubTokenFromUrl("/ru/reset-password?error=weak_password&token=abc")).toBe(
      "/ru/reset-password?error=weak_password&token=[вырезано]",
    );
  });

  it("не трогает ничего, кроме токена: по событию по-прежнему видно, ГДЕ упало", () => {
    expect(scrubTokenFromUrl("/es/stories/repka?page=2")).toBe("/es/stories/repka?page=2");
    expect(scrubTokenFromUrl("/es/reset-password?token=abc&error=1")).toContain("error=1");
  });

  it("чистит все места события, где может лежать адрес", () => {
    const event = {
      request: { url: "/es/reset-password#token=secret", headers: { Referer: "/es/x?token=secret" } },
      transaction: "/es/reset-password?token=secret",
      breadcrumbs: [
        { data: { url: "/api/auth/reset-password?token=secret" }, message: "navigate to /x?token=secret" },
      ],
    };
    const cleaned = scrubTokensFromEvent(event);
    const asText = JSON.stringify(cleaned);
    expect(asText).not.toContain("secret");
    expect(asText).toContain("[вырезано]");
  });

  it("позитивный контроль прибора: неочищенное событие «secret» содержит", () => {
    const dirty = { request: { url: "/es/reset-password#token=secret" } };
    expect(JSON.stringify(dirty)).toContain("secret");
  });
});
