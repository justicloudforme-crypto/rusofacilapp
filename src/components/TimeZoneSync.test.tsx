import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import TimeZoneSync from "./TimeZoneSync";
import { TIMEZONE_COOKIE } from "@/lib/timezone";

/**
 * Заход 7.262: гость слал `POST /api/timezone` на каждой загрузке каждой
 * страницы (его `storedTimeZone` всегда `null`), а сервер отвечал ему
 * `{ stored: false }`. Гостю — только кука.
 */
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe("TimeZoneSync", () => {
  const fetchSpy = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response("{}"));
  beforeEach(() => {
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
    document.cookie = `${TIMEZONE_COOKIE}=; path=/; max-age=0`;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("гость: кука ставится, запроса к /api/timezone нет", () => {
    render(<TimeZoneSync storedTimeZone={null} signedIn={false} />);
    expect(document.cookie).toContain(`${TIMEZONE_COOKIE}=${ZONE}`);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("вошедший без сохранённой зоны: запрос уходит", () => {
    render(<TimeZoneSync storedTimeZone={null} signedIn />);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/timezone");
  });

  it("вошедший с той же зоной: запроса нет", () => {
    render(<TimeZoneSync storedTimeZone={ZONE} signedIn />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
