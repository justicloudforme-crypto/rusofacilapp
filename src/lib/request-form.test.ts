import { describe, expect, it } from "vitest";
import { readRequestForm } from "./request-form";

const URL_ = "https://rusofacilapp.com/api/x";

describe("readRequestForm — тело не той формы не роняет обработчик", () => {
  it.each([
    ["application/json", "{}"],
    ["application/json; charset=utf-8", '{"plan":"monthly"}'],
    ["text/plain", "plan=monthly"],
    ["application/x-www-form-urlencodedX", "plan=monthly"],
  ])("«%s» → 415", async (type, body) => {
    const read = await readRequestForm(new Request(URL_, { method: "POST", headers: { "content-type": type }, body }));
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.response.status).toBe(415);
  });

  it("без заголовка и без тела → 415", async () => {
    const read = await readRequestForm(new Request(URL_, { method: "POST" }));
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.response.status).toBe(415);
  });

  it("multipart с битой границей → 400", async () => {
    const read = await readRequestForm(
      new Request(URL_, { method: "POST", headers: { "content-type": "multipart/form-data; boundary=zzz" }, body: "junk" }),
    );
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.response.status).toBe(400);
  });

  it("urlencoded читается как раньше", async () => {
    const read = await readRequestForm(
      new Request(URL_, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "plan=monthly&lang=es",
      }),
    );
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.form.get("plan")).toBe("monthly");
  });

  it("multipart из FormData читается как раньше", async () => {
    const form = new FormData();
    form.set("lang", "ru");
    const read = await readRequestForm(new Request(URL_, { method: "POST", body: form }));
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.form.get("lang")).toBe("ru");
  });
});
