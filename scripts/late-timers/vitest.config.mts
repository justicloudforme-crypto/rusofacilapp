import { defineConfig } from "vitest/config";

// Конфиг сторожа `check:late-timers` (долг 386): окружение — jsdom с
// «хвостом» процесса после снятия (соседний `slow-teardown-env.ts`), тот же
// `vitest.setup.ts`, что у `npm run test`. Свой, а не слияние с корневым:
// проверяемым файлам алиасы корневого конфига не нужны.
export default defineConfig({
  test: {
    environment: "./scripts/late-timers/slow-teardown-env.ts",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/late-timers/*.test.ts"],
  },
});
