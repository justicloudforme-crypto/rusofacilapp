import { afterEach, describe, expect, it, vi } from "vitest";
import { postReliably } from "./reliable-post";

const noSleep = () => Promise.resolve();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postReliably", () => {
  it("одна удачная попытка — один запрос, и он keepalive", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    expect(await postReliably("/api/x", { a: 1 }, { sleep: noSleep })).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
    expect(fetchMock.mock.calls[0][1].body).toBe('{"a":1}');
  });

  it("сетевой отказ повторяется и в итоге записывается", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    expect(await postReliably("/api/x", {}, { sleep: noSleep })).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("500 повторяется, 429 тоже", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    expect(await postReliably("/api/x", {}, { sleep: noSleep })).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("404 не повторяется — повтор его не починит", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    expect(await postReliably("/api/x", {}, { sleep: noSleep })).toBe("rejected");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("когда все попытки съедены, уходит маячок", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Load failed"));
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { sendBeacon });
    expect(await postReliably("/api/x", { p: 1 }, { attempts: 2, sleep: noSleep })).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("если и маячка нет — честно «потеряно», а не тихое «ок»", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Load failed")));
    vi.stubGlobal("navigator", {});
    expect(await postReliably("/api/x", {}, { attempts: 2, sleep: noSleep })).toBe("lost");
  });
});
