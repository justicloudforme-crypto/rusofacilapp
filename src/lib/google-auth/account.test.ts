import { describe, expect, it } from "vitest";
import { mailboxKey, resolveGoogleAccount, type GoogleAccountRow, type GoogleAccountStore } from "./account";

/** База как SQLite: `=` и UNIQUE — с учётом регистра, LIKE — без (ASCII). */
function memoryStore(emails: string[]): GoogleAccountStore & { rows: GoogleAccountRow[] } {
  const rows: GoogleAccountRow[] = emails.map((email, i) => ({ id: `u${i}`, email, sessionVersion: 0 }));
  return {
    rows,
    findByEmail: async (email) => rows.find((r) => r.email === email) ?? null,
    findByDomain: async (domain) => rows.filter((r) => r.email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)),
    create: async (email) => {
      if (rows.some((r) => r.email === email)) throw new Error("UNIQUE constraint failed: User.email");
      const row = { id: `u${rows.length}`, email, sessionVersion: 0 };
      rows.push(row);
      return row;
    },
  };
}

const verified = (email: string) => ({ email, emailVerified: true });

describe("resolveGoogleAccount — та же учётка, а не вторая (7.267)", () => {
  it("адрес есть — вход в существующую", async () => {
    const store = memoryStore(["justi@gmail.com"]);
    expect(await resolveGoogleAccount(store, verified("justi@gmail.com"))).toMatchObject({ kind: "existing", user: { id: "u0" } });
    expect(store.rows).toHaveLength(1);
  });

  it("регистр и пробелы не делают второй учётки", async () => {
    const store = memoryStore(["foo@gmail.com"]);
    expect(await resolveGoogleAccount(store, verified(" Foo@Gmail.COM "))).toMatchObject({ kind: "existing", user: { id: "u0" } });
    expect(store.rows).toHaveLength(1);
  });

  it("строка, записанная в обход нормализации, тоже находится", async () => {
    const store = memoryStore(["Foo@Example.com"]);
    expect(await resolveGoogleAccount(store, verified("foo@example.com"))).toMatchObject({ kind: "existing", user: { id: "u0" } });
  });

  it("Gmail: точки и +метка — тот же ящик", async () => {
    const store = memoryStore(["j.doe+ruso@gmail.com"]);
    expect(await resolveGoogleAccount(store, verified("jdoe@gmail.com"))).toMatchObject({ kind: "existing", user: { id: "u0" } });
    const store2 = memoryStore(["jdoe@googlemail.com"]);
    expect(await resolveGoogleAccount(store2, verified("j.doe@gmail.com"))).toMatchObject({ kind: "existing" });
  });

  it("не-Gmail: точка значима — это другой ящик", async () => {
    const store = memoryStore(["j.doe@example.com"]);
    expect(await resolveGoogleAccount(store, verified("jdoe@example.com"))).toMatchObject({ kind: "created" });
  });

  it("точное совпадение важнее похожего ящика", async () => {
    const store = memoryStore(["j.doe@gmail.com", "jdoe@gmail.com"]);
    expect(await resolveGoogleAccount(store, verified("jdoe@gmail.com"))).toMatchObject({ kind: "existing", user: { id: "u1" } });
  });

  it("два похожих ящика и ни одного точного — отказ, не угадываем", async () => {
    const store = memoryStore(["j.doe@gmail.com", "jd.oe@gmail.com"]);
    expect(await resolveGoogleAccount(store, verified("jdoe@gmail.com"))).toEqual({ kind: "refused", reason: "ambiguous" });
    expect(store.rows).toHaveLength(2);
  });

  it("адреса нет — новая учётка в нижнем регистре", async () => {
    const store = memoryStore(["a@gmail.com"]);
    expect(await resolveGoogleAccount(store, verified("New@Example.com"))).toMatchObject({ kind: "created", user: { email: "new@example.com" } });
  });

  it("неподтверждённый адрес — отказ, ничего не создаётся и не открывается", async () => {
    const store = memoryStore(["justi@gmail.com"]);
    expect(await resolveGoogleAccount(store, { email: "justi@gmail.com", emailVerified: false })).toEqual({
      kind: "refused",
      reason: "email_unverified",
    });
    expect(await resolveGoogleAccount(store, { email: "x@y.com", emailVerified: false })).toMatchObject({ kind: "refused" });
    expect(store.rows).toHaveLength(1);
  });

  it("гонка двух входов: уникальность → вход в уже созданную", async () => {
    const store = memoryStore([]);
    const realFind = store.findByEmail;
    let first = true;
    store.findByEmail = async (email) => {
      if (first) {
        first = false;
        return null; // первый поиск «не увидел» строку соседнего запроса
      }
      return realFind(email);
    };
    store.rows.push({ id: "raced", email: "r@gmail.com", sessionVersion: 0 });
    store.findByDomain = async () => [];
    expect(await resolveGoogleAccount(store, verified("r@gmail.com"))).toMatchObject({ kind: "existing", user: { id: "raced" } });
  });

  it("mailboxKey", () => {
    expect(mailboxKey(" J.Doe+x@GoogleMail.com")).toBe("jdoe@gmail.com");
    expect(mailboxKey("J.Doe+x@example.com")).toBe("j.doe+x@example.com");
  });
});
