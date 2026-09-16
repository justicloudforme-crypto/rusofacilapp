import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ЗАХОД 7.205, ЧАСТЬ 2. Три вопроса к адресу доступности, и ни на один из
 * них нельзя ответить чтением кода глазами:
 *
 *   1. живая база → 200 и слово, по которому монитор узнаёт живой ответ;
 *   2. мёртвая база → 503 С ТЕЛОМ, а не 500 без него;
 *   3. ни в одном из двух ответов нет ничего личного и ничего секретного —
 *      ни адреса базы, ни токена, ни текста исключения драйвера.
 *
 * Третий пункт проверяется на ОТКАЗЕ специально: сообщение об ошибке
 * libsql умеет содержать и хост, и имя пользователя, и именно на пути
 * отказа его проще всего случайно переслать наружу.
 */
const queryRaw = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));
vi.mock("server-only", () => ({}));

const { HEALTH_OK_TOKEN, HEALTH_DOWN_TOKEN } = await import("@/lib/health-tokens");
const { GET } = await import("./route");

/** Настоящий текст отказа libsql с боевым адресом и токеном внутри —
 *  ровно то, что нельзя переслать наружу. */
const LEAKY_ERROR = new Error(
  "SERVER_ERROR: libsql://rusofacilapp-prod-vasilii-petrov-01.aws-us-west-2.turso.io " +
    "authToken=eyJhbGciOiJFZERTQSJ9.secret user=vasilii@example.com",
);

const SECRETS = ["turso.io", "libsql://", "authToken", "eyJ", "@example.com", "SERVER_ERROR"];

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.VERCEL_GIT_COMMIT_SHA;
});

describe("GET /api/health", () => {
  it("база отвечает → 200, слово RF-OK и заголовок кеша на 30…60 секунд", async () => {
    queryRaw.mockResolvedValue([{ 1: 1 }]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe(HEALTH_OK_TOKEN);
    expect(body.ok).toBe(true);
    expect(body.db).toBe("up");

    const cache = res.headers.get("cache-control") ?? "";
    const sMaxAge = Number(cache.match(/s-maxage=(\d+)/)?.[1]);
    expect(sMaxAge).toBeGreaterThanOrEqual(30);
    expect(sMaxAge).toBeLessThanOrEqual(60);
    expect(res.headers.get("x-robots-tag")).toMatch(/noindex/);
  });

  it("база молчит → 503 С ТЕЛОМ и с причиной словом, а не 500 без тела", async () => {
    queryRaw.mockRejectedValue(LEAKY_ERROR);

    const res = await GET();
    const text = await res.text();

    expect(res.status).toBe(503);
    expect(text.length).toBeGreaterThan(0);

    const body = JSON.parse(text);
    expect(body.status).toBe(HEALTH_DOWN_TOKEN);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("db_unreachable");
    // Залипший в кеше отказ — это ложная тревога на минуту вперёд.
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("ОТКАЗ НЕ ВЫНОСИТ НАРУЖУ НИ АДРЕСА БАЗЫ, НИ ТОКЕНА, НИ ТЕКСТА ИСКЛЮЧЕНИЯ", async () => {
    queryRaw.mockRejectedValue(LEAKY_ERROR);

    const res = await GET();
    const text = await res.text();

    for (const secret of SECRETS) expect(text).not.toContain(secret);
    // И слова «RF-OK» в ответе об отказе быть не может: монитор ищет его
    // подстрокой, и одно его появление здесь сделало бы тревогу немой.
    expect(text).not.toContain(HEALTH_OK_TOKEN);
  });

  it("удачный ответ тоже не несёт ничего личного", async () => {
    queryRaw.mockResolvedValue([{ 1: 1 }]);
    process.env.VERCEL_GIT_COMMIT_SHA = "326d1f6ab3c4d5e6f708192a3b4c5d6e7f809102";

    const res = await GET();
    const text = await res.text();

    for (const secret of SECRETS) expect(text).not.toContain(secret);
    // Метка деплоя — короткая и та же, что уже стоит на каждой странице
    // прода в `sentry-release`; полного sha в ответе нет.
    expect(JSON.parse(text).commit).toBe("326d1f6");
    expect(text).not.toContain("326d1f6ab3c4");
  });

  it("слово отказа не содержит слова успеха подстрокой (ловушка healthy/unhealthy)", () => {
    expect(HEALTH_DOWN_TOKEN).not.toContain(HEALTH_OK_TOKEN);
    expect(HEALTH_OK_TOKEN).not.toContain(HEALTH_DOWN_TOKEN);
  });
});
