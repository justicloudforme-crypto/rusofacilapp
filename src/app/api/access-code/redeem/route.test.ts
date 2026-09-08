import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Маршрут погашения кода (PROGRESS.md 7.146).
 *
 * Проверяется то, за что отвечает МАРШРУТ, и ничего сверх: кто пущен, что
 * счётчик частоты стоит РАНЬШЕ разбора кода, и что каждый исход доезжает до
 * `/profile` своим словом в адресе. Само правило погашения живёт в
 * `src/lib/access-code.ts` и проверено там; здесь оно подменено намеренно —
 * иначе этот файл проверял бы его во второй раз и по-другому.
 */

const getCurrentUser = vi.fn();
const redeemAccessCode = vi.fn();
const limiterCheck = vi.fn(async () => false);

vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/access-code", () => ({
  redeemAccessCode: (...args: unknown[]) => redeemAccessCode(...args),
}));
vi.mock("@/lib/rate-limit", () => ({ getRateLimiter: () => ({ check: limiterCheck }) }));

const { POST } = await import("./route");

function redeemRequest(code: string, lang = "es"): NextRequest {
  const form = new FormData();
  form.set("code", code);
  form.set("lang", lang);
  return {
    url: "https://rusofacilapp.com/api/access-code/redeem",
    headers: new Headers(),
    formData: async () => form,
  } as unknown as NextRequest;
}

function location(response: { headers: Headers }): string {
  return response.headers.get("location") ?? "";
}

beforeEach(() => {
  getCurrentUser.mockReset();
  redeemAccessCode.mockReset();
  limiterCheck.mockReset();
  limiterCheck.mockResolvedValue(false);
  getCurrentUser.mockResolvedValue({ id: "u1", role: "student" });
  redeemAccessCode.mockResolvedValue({ ok: true, days: 90, tier: "standard" });
});

describe("POST /api/access-code/redeem", () => {
  it("гость уводится на вход, код не разбирается вовсе", async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await POST(redeemRequest("AMIGO-K7M2-QW9F"));

    expect(response.status).toBe(303);
    expect(location(response)).toContain("/es/login?redirectTo=/es/profile");
    expect(redeemAccessCode).not.toHaveBeenCalled();
  });

  it("успех возвращает на вкладку подписки со словом redeemed", async () => {
    const response = await POST(redeemRequest("amigo-k7m2-qw9f"));

    expect(response.status).toBe(303);
    expect(location(response)).toContain("/es/profile?tab=subscription&accessCode=redeemed");
    // Код передан СЫРЫМ: нормализация одна на всех и живёт в библиотеке,
    // а не переписана здесь второй раз.
    expect(redeemAccessCode).toHaveBeenCalledWith({ id: "u1", role: "student" }, "amigo-k7m2-qw9f");
  });

  it.each([
    ["unknown"],
    ["already_redeemed"],
    ["expired"],
    ["revoked"],
    ["already_has_access"],
  ])("отказ %s доезжает до страницы своим словом", async (reason) => {
    redeemAccessCode.mockResolvedValue({ ok: false, reason });

    const response = await POST(redeemRequest("AMIGO-K7M2-QW9F"));

    expect(response.status).toBe(303);
    expect(location(response)).toContain(`accessCode=${reason}`);
  });

  it("русская локаль ведёт на русский профиль", async () => {
    const response = await POST(redeemRequest("AMIGO-K7M2-QW9F", "ru"));
    expect(location(response)).toContain("/ru/profile?tab=subscription");
  });

  it("незнакомая локаль сводится к языку по умолчанию, а не в 404", async () => {
    const response = await POST(redeemRequest("AMIGO-K7M2-QW9F", "fr"));
    expect(location(response)).toContain("/es/profile");
  });

  it("счётчик частоты стоит РАНЬШЕ разбора кода — иначе перебор считался бы попыткой погашения", async () => {
    limiterCheck.mockResolvedValue(true);

    const response = await POST(redeemRequest("AMIGO-K7M2-QW9F"));

    expect(location(response)).toContain("accessCode=rate_limited");
    // Главное утверждение: библиотека не позвана вовсе, то есть перебор не
    // доходит до базы и не может ни погасить, ни израсходовать строку.
    expect(redeemAccessCode).not.toHaveBeenCalled();
  });

  it("счётчик ведётся по аккаунту, а не по коду: иначе перебор шёл бы с новым кодом каждый раз", async () => {
    await POST(redeemRequest("AMIGO-K7M2-QW9F"));
    expect(limiterCheck).toHaveBeenCalledWith("u1");
  });

  it("отсутствующее поле кода — обычный отказ, а не падение маршрута", async () => {
    redeemAccessCode.mockResolvedValue({ ok: false, reason: "unknown" });
    const form = new FormData();
    form.set("lang", "es");
    const request = {
      url: "https://rusofacilapp.com/api/access-code/redeem",
      headers: new Headers(),
      formData: async () => form,
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(redeemAccessCode).toHaveBeenCalledWith(expect.anything(), "");
  });
});
