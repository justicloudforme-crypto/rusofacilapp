import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROJECT_ROOT, isInsideProject, readTursoEnv } from "../../scripts/turso-env.mjs";

/**
 * КЛЮЧ TURSO ТОЛЬКО ВНЕ ПАПКИ ПРОЕКТА — 7.272, задача 1 (раздел 3.19 п. 4).
 *
 * До захода два скрипта по умолчанию читали `.env.turso` из корня проекта
 * (`backfill-subscription-payments.mjs:66`, сообщение `make-prod-snapshot.mjs:36`),
 * ещё два — в `prisma/run-7173/`. Теперь ключ берётся из окружения или из
 * файла, названного флагом `--env=` и лежащего вне проекта.
 */
const URL = "libsql://example-db.turso.io";
const TOKEN = "test-token";

describe("readTursoEnv", () => {
  it("берёт ключ из окружения", () => {
    const got = readTursoEnv({ argv: [], env: { TURSO_DATABASE_URL: URL, TURSO_AUTH_TOKEN: TOKEN } });
    expect(got).toEqual({ url: URL, authToken: TOKEN, source: "окружение" });
  });

  it("без ключа падает внятно и не ищет файл сам", () => {
    let read = 0;
    expect(() => readTursoEnv({ argv: [], env: {}, read: () => (read++, "") })).toThrow(/TURSO_DATABASE_URL=libsql/);
    expect(read).toBe(0);
  });

  it("не libsql-адрес — отказ", () => {
    expect(() => readTursoEnv({ argv: [], env: { TURSO_DATABASE_URL: "file:dev.db", TURSO_AUTH_TOKEN: TOKEN } })).toThrow();
  });

  it("файл в папке проекта — отказ ДО чтения, в том числе прежний .env.turso", () => {
    for (const file of [".env.turso", "./.env", path.join(PROJECT_ROOT, "prisma", "x.env"), PROJECT_ROOT]) {
      let read = 0;
      expect(() => readTursoEnv({ argv: [`--env=${file}`], env: {}, read: () => (read++, "") }), file).toThrow(/папке проекта/);
      expect(read, file).toBe(0);
    }
  });

  it("файл вне проекта читается, ~ раскрывается", () => {
    let asked = "";
    const got = readTursoEnv({
      argv: ["--env=~/.config/rusofacilapp/turso.env"],
      env: {},
      read: (f: string) => ((asked = f), `export TURSO_DATABASE_URL="${URL}"\nTURSO_AUTH_TOKEN=${TOKEN}\n`),
    });
    expect(asked).toBe(path.join(os.homedir(), ".config/rusofacilapp/turso.env"));
    expect(got.url).toBe(URL);
    expect(got.authToken).toBe(TOKEN);
  });

  it("соседняя папка с похожим именем — не «внутри»", () => {
    expect(isInsideProject(`${PROJECT_ROOT}-old/turso.env`)).toBe(false);
    expect(isInsideProject(path.join(PROJECT_ROOT, "a/b.env"))).toBe(true);
  });
});

/** Код, который читает ключ из файла в корне проекта по имени. */
const READS_ENV_TURSO = /["'`]\.env\.turso["'`]/;

function trackedCode(): string[] {
  return execFileSync("git", ["ls-files", "*.mjs", "*.js", "*.ts", "*.tsx", "*.cjs"], { cwd: PROJECT_ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !f.endsWith("turso-env.test.ts"));
}

describe("в коде нет чтения .env.turso", () => {
  it("подсадка ловится (позитивный контроль)", () => {
    expect(READS_ENV_TURSO.test('readFileSync(".env.turso", "utf8")')).toBe(true);
    expect(READS_ENV_TURSO.test("?? '.env.turso'")).toBe(true);
    expect(READS_ENV_TURSO.test("// ключ вне .env.turso-подобных файлов")).toBe(false);
  });

  it("по всем файлам кода под git — ноль", () => {
    const files = trackedCode();
    expect(files.length).toBeGreaterThan(500);
    const hits = files.filter((f) => READS_ENV_TURSO.test(readFileSync(path.join(PROJECT_ROOT, f), "utf8")));
    expect(hits).toEqual([]);
  });
});
