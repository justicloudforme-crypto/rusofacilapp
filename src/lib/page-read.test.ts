import { describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import { readForPage } from "./page-read";

// Заход 7.305: игровые лендинги переживают сбой базы через readForPage.
describe("readForPage", () => {
  it("passes a value through, including null (the page still 404s on a missing row)", async () => {
    expect(await readForPage("x", async () => 5)).toEqual({ ok: true, value: 5 });
    expect(await readForPage("x", async () => null)).toEqual({ ok: true, value: null });
  });

  it("turns a database failure into { ok: false } instead of throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await readForPage("x", async () => {
      throw Object.assign(new Error("SQLITE_CANTOPEN: unable to open database file"), { code: "SQLITE_CANTOPEN" });
    });
    expect(out).toEqual({ ok: false });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("does not swallow Next's own signals (notFound, redirect)", async () => {
    await expect(readForPage("x", async () => notFound())).rejects.toThrow();
    await expect(readForPage("x", async () => redirect("/es"))).rejects.toThrow();
  });
});
