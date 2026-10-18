// Окружение сторожа `check:late-timers` (долг 386, заход 7.275).
//
// Обычный jsdom Vitest, после снятия которого процесс тестов живёт ещё
// 1,5 с — ровно условие медленного раннера CI, при котором 18.10.2026
// (CI #1364) таймер заглушки «нет сети» позвал `show()` в снятое окно и
// уронил шаг «Unit tests» при всех зелёных тестах. Каждая ошибка, долетевшая
// в это окно, печатается строкой `[late-timers]`; судит их
// `scripts/check-late-timers.mjs` (бросок из `teardown` Vitest 4 итог не
// меняет — проверено).
import { builtinEnvironments } from "vitest/environments";
import type { Environment } from "vitest/environments";

const base = builtinEnvironments.jsdom;
const LINGER_MS = 1500;

export default <Environment>{
  ...base,
  name: "late-timers-jsdom",
  async setup(global, options) {
    const env = await base.setup(global, options);
    return {
      async teardown(g) {
        await env.teardown(g);
        const late: string[] = [];
        const t0 = Date.now();
        const record = (e: unknown) => late.push(`+${Date.now() - t0} мс: ${String(e).split("\n")[0]}`);
        process.on("uncaughtException", record);
        process.on("unhandledRejection", record);
        await new Promise((r) => setTimeout(r, LINGER_MS));
        process.off("uncaughtException", record);
        process.off("unhandledRejection", record);
        process.stdout.write(`[late-timers] поздних ошибок после снятия окружения: ${late.length}\n`);
        for (const line of late) process.stdout.write(`[late-timers]   ${line}\n`);
      },
    };
  },
};
