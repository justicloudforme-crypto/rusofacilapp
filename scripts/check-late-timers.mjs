#!/usr/bin/env node
// check:late-timers — ТЕСТ НЕ ОСТАВЛЯЕТ ТАЙМЕРОВ ПОСЛЕ СЕБЯ (долг 386, 7.275).
//
// 18.10.2026 шаг CI «Unit tests» покраснел при 2550 зелёных тестах (CI
// #1364, `main`): `src/lib/offline-screen.test.ts` исполнял скрипт
// `public/offline.html` в общем окне jsdom, скрипт ставил повторную пробу
// сети через 700 мс, тест кончался раньше, окружение снималось, и на
// медленном раннере `show()` падал «document is not defined». Локально не
// воспроизводилось: процесс файла гаснет раньше таймера.
//
// Сторож создаёт это условие нарочно — окружение `late-timers-jsdom`
// держит процесс 1,5 с после снятия jsdom — и краснеет на любой ошибке,
// долетевшей в это окно. Замер 7.275: прежняя версия теста — 5 поздних
// ошибок в 20 прогонах из 20, новая — 0 в 100 из 100.
//
//   node scripts/check-late-timers.mjs           файлы FILES ниже
//   node scripts/check-late-timers.mjs --plant   подсадка: обязан покраснеть
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Файлы, исполняющие настоящие скрипты страниц с таймерами. */
export const FILES = ["src/lib/offline-screen.test.ts"];
const PLANT = "scripts/late-timers/plant.test.ts";
const CONFIG = "scripts/late-timers/vitest.config.mts";

export function countLate(output) {
  const counts = [...output.matchAll(/\[late-timers\] поздних ошибок после снятия окружения: (\d+)/g)].map((m) => Number(m[1]));
  return { reports: counts.length, late: counts.reduce((a, b) => a + b, 0) };
}

function run(files) {
  const r = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "-c", CONFIG, ...files], {
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  return { status: r.status, output: `${r.stdout}\n${r.stderr}` };
}

function main(argv) {
  const plant = argv.includes("--plant");
  const files = plant ? [PLANT] : FILES;
  const { status, output } = run(files);
  const { reports, late } = countLate(output);
  for (const line of output.split("\n").filter((l) => l.startsWith("[late-timers]"))) console.log(line);
  if (reports === 0) {
    console.error("check:late-timers: окружение не отчиталось ни разу — замера нет, это не «0 ошибок».");
    console.error(output.split("\n").slice(-30).join("\n"));
    return 1;
  }
  if (plant) {
    if (late > 0) {
      console.log(`check:late-timers:plant — подсадка поймана: поздних ошибок ${late}`);
      return 0;
    }
    console.error("check:late-timers:plant — подсадка НЕ поймана: сторож слеп");
    return 1;
  }
  if (status !== 0) {
    console.error(`check:late-timers: тесты красные (код ${status})`);
    console.error(output.split("\n").slice(-40).join("\n"));
    return 1;
  }
  if (late > 0) {
    console.error(`check:late-timers: ${late} поздних ошибок после снятия окружения — тест оставляет таймеры (долг 386)`);
    return 1;
  }
  console.log(`check:late-timers: ${files.length} файл(ов), поздних ошибок 0 (окружение держало процесс 1,5 с после снятия)`);
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  process.exit(main(process.argv.slice(2)));
}
