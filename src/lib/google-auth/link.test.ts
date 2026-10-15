import { describe, expect, it } from "vitest";
import { linkGoogleOnSignIn, linkedBefore7268, type GoogleLinkRow, type GoogleLinkStore } from "./link";
import { googleLinkEmail } from "./link-email";

/** Строка в памяти; запись со сбросом — только при `googleLinkedAt IS NULL`, как в базе. */
function memoryStore(row: GoogleLinkRow): GoogleLinkStore & { row: GoogleLinkRow } {
  return {
    row,
    read: async () => ({ ...row }),
    markLinked: async (_id, at) => {
      if (row.googleLinkedAt) return false;
      row.googleLinkedAt = at;
      return true;
    },
    markLinkedAndResetPassword: async (_id, at) => {
      if (row.googleLinkedAt) return { reset: false, sessionVersion: row.sessionVersion };
      Object.assign(row, { googleLinkedAt: at, passwordHash: null, sessionVersion: row.sessionVersion + 1 });
      return { reset: true, sessionVersion: row.sessionVersion };
    },
  };
}

const NOW = new Date("2026-10-16T00:00:00Z");

describe("linkGoogleOnSignIn — долг 381, вариант «а» (7.268)", () => {
  it("первая привязка учётки с паролем: пароль снят, версия +1, письмо нужно", async () => {
    const store = memoryStore({ email: "victima@gmail.com", passwordHash: "hash", googleLinkedAt: null, sessionVersion: 3 });
    expect(await linkGoogleOnSignIn(store, "u", NOW)).toEqual({ kind: "password_disabled", sessionVersion: 4, email: "victima@gmail.com" });
    expect(store.row).toMatchObject({ passwordHash: null, sessionVersion: 4, googleLinkedAt: NOW });
  });

  it("повторный вход: ничего не меняется", async () => {
    const before = new Date("2026-10-01T00:00:00Z");
    const store = memoryStore({ email: "victima@gmail.com", passwordHash: "hash", googleLinkedAt: before, sessionVersion: 3 });
    expect(await linkGoogleOnSignIn(store, "u", NOW)).toEqual({ kind: "repeat", sessionVersion: 3 });
    expect(store.row).toMatchObject({ passwordHash: "hash", sessionVersion: 3, googleLinkedAt: before });
  });

  it("учётка без пароля: только отметка привязки", async () => {
    const store = memoryStore({ email: "solo@gmail.com", passwordHash: null, googleLinkedAt: null, sessionVersion: 2 });
    expect(await linkGoogleOnSignIn(store, "u", NOW)).toEqual({ kind: "linked", sessionVersion: 2 });
    expect(store.row).toMatchObject({ passwordHash: null, sessionVersion: 2, googleLinkedAt: NOW });
  });

  it("учётка владельца, привязанная 15.10 до записи привязки: пароль остаётся", async () => {
    expect(linkedBefore7268(" JustiCloudForMe@gmail.com ")).toBe(true);
    expect(linkedBefore7268("otra@gmail.com")).toBe(false);
    const store = memoryStore({ email: "justicloudforme@gmail.com", passwordHash: "hash", googleLinkedAt: null, sessionVersion: 1 });
    expect(await linkGoogleOnSignIn(store, "u", NOW)).toEqual({ kind: "linked", sessionVersion: 1 });
    expect(store.row.passwordHash).toBe("hash");
  });

  it("параллельный первый вход опередил: это повторный, второго письма нет", async () => {
    const store = memoryStore({ email: "victima@gmail.com", passwordHash: "hash", googleLinkedAt: null, sessionVersion: 0 });
    const reading = store.read;
    store.read = async (id) => {
      const snapshot = await reading(id);
      Object.assign(store.row, { googleLinkedAt: NOW, passwordHash: null, sessionVersion: 1 });
      return snapshot;
    };
    expect(await linkGoogleOnSignIn(store, "u", NOW)).toEqual({ kind: "repeat", sessionVersion: 1 });
  });
});

describe("googleLinkEmail", () => {
  it("испанский на «tú», ссылка на «¿Olvidaste tu contraseña?», адрес экранирован", () => {
    const mail = googleLinkEmail({ email: "a<b>@gmail.com", origin: "https://rusofacilapp.com" });
    expect(mail.html).toContain("https://rusofacilapp.com/es/forgot-password");
    expect(mail.html).toContain("https://rusofacilapp.com/ru/forgot-password");
    expect(mail.html).toContain("¿No fuiste tú?");
    expect(mail.html).toContain("a&lt;b&gt;@gmail.com");
    expect(mail.html).not.toContain("a<b>@");
  });
});
