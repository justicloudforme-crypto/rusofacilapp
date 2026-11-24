import http from "node:http";
import type { AddressInfo } from "node:net";
import { request as playwrightRequest } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { TEST_SERVER_KEEP_ALIVE_MS, keepAliveProblems } from "./helpers/test-server";

/**
 * СТОРОЖ ДОЛГА 412 (с влитыми 415, 422, 423), ЗАХОД 7.306: сервер тестов не
 * закрывает простаивающее соединение раньше, чем кончится задание CI.
 *
 * Почему это важно и что было — `e2e/helpers/test-server.ts`. Коротко:
 * клиент запросов Playwright держит соединения без срока, сервер Node
 * закрывал их через 6 с, и запрос теста в миг закрытия получал
 * «read ECONNRESET» (5 случаев за 19–24.11.2026, три файла тестов).
 *
 * Сторож двусторонний и судит ЖИВОЙ сервер, а не текст настроек:
 *  1) настоящий сервер тестов (`next start` из `playwright.config.ts`)
 *     объявляет в `Keep-Alive` срок не меньше `TEST_SERVER_KEEP_ALIVE_MS`;
 *  2) позитивный контроль в том же прогоне — сервер Node с умолчаниями
 *     (так был запущен сервер тестов до 7.306) судья обязан признать
 *     виновным; и подсадки формы заголовка: без срока, `Connection: close`,
 *     срок больше предела таймера Node.
 * Пустая выборка невозможна: без заголовка `Keep-Alive` судья краснеет.
 */

const MIN_SECONDS = Math.floor(TEST_SERVER_KEEP_ALIVE_MS / 1000);

test("сервер тестов держит простаивающее соединение дольше задания CI (долг 412)", async ({ request }) => {
  const res = await request.get("/api/health");
  const problems = keepAliveProblems(res.headers(), MIN_SECONDS);
  expect(problems, `сервер тестов: ${problems.join("; ")}`).toEqual([]);
});

test("позитивный контроль: сервер Node с умолчаниями (как до 7.306) судья ловит", async () => {
  const server = http.createServer((_req, res) => res.end("ok"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const ctx = await playwrightRequest.newContext();
  try {
    const { port } = server.address() as AddressInfo;
    const res = await ctx.get(`http://127.0.0.1:${port}/`);
    const problems = keepAliveProblems(res.headers(), MIN_SECONDS);
    expect(problems.join("; "), "ПОДСАДКА НЕ ПОЙМАНА: сервер с умолчанием Node (5 с) признан годным").toContain("закрывает простаивающее соединение через 5 с");
  } finally {
    await ctx.dispose();
    await new Promise((resolve) => server.close(resolve));
  }

  // Подсадки формы заголовка — каждая обязана дать нарушение.
  expect(keepAliveProblems({ connection: "keep-alive" }, MIN_SECONDS), "без заголовка Keep-Alive").not.toEqual([]);
  expect(keepAliveProblems({ connection: "close", "keep-alive": `timeout=${MIN_SECONDS}` }, MIN_SECONDS), "Connection: close").not.toEqual([]);
  expect(keepAliveProblems({ "keep-alive": "max=100" }, MIN_SECONDS), "Keep-Alive без срока").not.toEqual([]);
  expect(keepAliveProblems({ "keep-alive": "timeout=2147484" }, MIN_SECONDS), "срок больше предела таймера Node").not.toEqual([]);
  // И годный ответ годным признаётся — судья не красный всегда.
  expect(keepAliveProblems({ connection: "keep-alive", "keep-alive": `timeout=${MIN_SECONDS}` }, MIN_SECONDS)).toEqual([]);
});
