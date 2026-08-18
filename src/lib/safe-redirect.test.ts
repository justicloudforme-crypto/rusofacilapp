import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

const REQUEST_URL = "https://rusofacilapp.com/api/auth/login";

describe("safeRedirectPath", () => {
  it("allows a normal same-origin relative path", () => {
    expect(safeRedirectPath("/es/profile", REQUEST_URL, "/")).toBe("/es/profile");
  });

  it("preserves query string and hash on an allowed path", () => {
    expect(safeRedirectPath("/es/groups/abc?tab=x#y", REQUEST_URL, "/")).toBe("/es/groups/abc?tab=x#y");
  });

  it("rejects a plain absolute URL to another origin", () => {
    expect(safeRedirectPath("https://evil.com/phish", REQUEST_URL, "/")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    expect(safeRedirectPath("//evil.com/phish", REQUEST_URL, "/")).toBe("/");
  });

  it("rejects the backslash trick some URL parsers normalize to //", () => {
    expect(safeRedirectPath("/\\evil.com", REQUEST_URL, "/")).toBe("/");
  });

  it("rejects a different scheme entirely", () => {
    expect(safeRedirectPath("javascript:alert(1)", REQUEST_URL, "/")).toBe("/");
  });

  it("falls back on malformed input instead of throwing", () => {
    expect(safeRedirectPath("http://[::1", REQUEST_URL, "/")).toBe("/");
  });
});
