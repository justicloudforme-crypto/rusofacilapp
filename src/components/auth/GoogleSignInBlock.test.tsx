import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Позитивный контроль к e2e/google-signin-flag-off.spec.ts (7.267): тот же
 * селектор `[data-google-signin]` и тот же текст ДЕЙСТВИТЕЛЬНО появляются,
 * когда флаг включён, — иначе «кнопки нет» в e2e ничего бы не доказывало.
 */
const shell = vi.hoisted(() => ({ inApp: false, version: null as number | null }));
vi.mock("@/lib/native-shell", () => ({
  isNativeShellRequest: async () => shell.inApp,
  nativeShellVersionOfRequest: async () => shell.version,
}));

import GoogleSignInBlock from "./GoogleSignInBlock";

const labels = {
  button: "Continuar con Google",
  divider: "o con tu correo",
  pending: "Abriendo Google…",
  failed: "x",
  unverified: "y",
  ambiguous: "z",
};

async function html() {
  const element = await GoogleSignInBlock({ lang: "es", redirectTo: "/es/profile", labels });
  return element ? renderToStaticMarkup(element) : "";
}

afterEach(() => {
  vi.unstubAllEnvs();
  shell.inApp = false;
  shell.version = null;
});

describe("GoogleSignInBlock", () => {
  it("флаг выключен — пусто и в браузере, и в приложении", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(await html()).toBe("");
    shell.inApp = true;
    shell.version = 17;
    expect(await html()).toBe("");
  });

  it("флаг включён, браузер — ссылка на веб-вход с тем же селектором и текстом", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    const out = await html();
    expect(out).toContain('data-google-signin="web"');
    expect(out).toContain("Continuar con Google");
    expect(out).toContain('href="/api/auth/google/start?lang=es&amp;redirectTo=%2Fes%2Fprofile"');
    expect(out).not.toContain("secret");
  });

  it("флаг включён, приложение — веб-ссылки нет никогда", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    shell.inApp = true;
    shell.version = 16; // 1.0.15 — без плагина
    expect(await html()).toBe("");
    shell.version = 17;
    const out = await html();
    expect(out).toContain('data-google-signin="native"');
    expect(out).not.toContain("/api/auth/google/start");
  });
});
