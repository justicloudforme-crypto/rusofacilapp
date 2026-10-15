import { describe, expect, it } from "vitest";
import { googleButtonMode, googleSignInConfig, NATIVE_GOOGLE_MIN_SHELL_VERSION } from "./config";

describe("флаг входа через Google (7.267)", () => {
  it("без переменных — выключен", () => {
    expect(googleSignInConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(googleSignInConfig({ GOOGLE_CLIENT_ID: "id" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(googleSignInConfig({ GOOGLE_CLIENT_SECRET: "s" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(googleSignInConfig({ GOOGLE_CLIENT_ID: " ", GOOGLE_CLIENT_SECRET: " " } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("обе переменные — включён", () => {
    expect(googleSignInConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" } as unknown as NodeJS.ProcessEnv)).toEqual({
      clientId: "id",
      clientSecret: "s",
    });
  });

  it("какая кнопка где", () => {
    expect(googleButtonMode({ enabled: false, inApp: false, shellVersion: null })).toBe("none");
    expect(googleButtonMode({ enabled: false, inApp: true, shellVersion: 99 })).toBe("none");
    expect(googleButtonMode({ enabled: true, inApp: false, shellVersion: null })).toBe("web");
    // в приложении веб-ссылки нет никогда
    expect(googleButtonMode({ enabled: true, inApp: true, shellVersion: null })).toBe("none");
    expect(googleButtonMode({ enabled: true, inApp: true, shellVersion: NATIVE_GOOGLE_MIN_SHELL_VERSION - 1 })).toBe("none");
    expect(googleButtonMode({ enabled: true, inApp: true, shellVersion: NATIVE_GOOGLE_MIN_SHELL_VERSION })).toBe("native");
  });
});
