import { describe, expect, it } from "vitest";
import { signedInLoginTarget } from "./login-signed-in";

describe("куда вход уводит уже вошедшего (7.236, находка 3)", () => {
  it("контроль: путь сайта из redirectTo сохраняется", () => {
    expect(signedInLoginTarget("/es/courses/a1/1?tab=x", "es")).toBe("/es/courses/a1/1?tab=x");
  });
  it("кабинет по умолчанию", () => {
    expect(signedInLoginTarget("/es/profile", "es")).toBe("/es/profile");
  });
  it("чужой сайт и петля на вход/регистрацию — в кабинет", () => {
    expect(signedInLoginTarget("https://evil.example/x", "ru")).toBe("/ru/profile");
    expect(signedInLoginTarget("//evil.example/x", "ru")).toBe("/ru/profile");
    expect(signedInLoginTarget("/es/login", "es")).toBe("/es/profile");
    expect(signedInLoginTarget("/es/register?redirectTo=/es", "es")).toBe("/es/profile");
    expect(signedInLoginTarget("/\\evil.example/x", "es")).toBe("/es/profile");
    expect(signedInLoginTarget("javascript:alert(1)", "es")).toBe("/es/profile");
    expect(signedInLoginTarget("/es/x\nSet-Cookie:a", "es")).toBe("/es/profile");
    expect(signedInLoginTarget("", "es")).toBe("/es/profile");
  });
});
