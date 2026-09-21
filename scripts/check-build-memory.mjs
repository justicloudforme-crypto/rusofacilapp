#!/usr/bin/env node
/**
 * Сторож памяти сборки — строка долга 293.
 *
 *   node scripts/check-build-memory.mjs           # проверка
 *   node scripts/check-build-memory.mjs --plant   # позитивный контроль
 *
 * ЧТО ОН СТЕРЕЖЁТ И ПОЧЕМУ ИМЕННО ЭТО.
 *
 * Машина сборки Vercel — 4 ядра и 8192 МБ на весь контейнер (журнал выката
 * 20.09.2026: Cleveland, cle1). Убивает там не «самый толстый процесс», а
 * СУММА по дереву: у cgroup лимит один на всех. Значит верхнюю границу надо
 * задать арифметикой, а не надеждой:
 *
 *     (1 головной процесс + experimental.cpus воркеров) × потолок кучи ≤ 8192
 *
 * Все три числа лежат в разных файлах и разъезжаются молча — потолок кучи в
 * `package.json` и в `vercel.json` (это ДВА разных места, и на Vercel
 * исполняется второе, а локально первое), число воркеров в `next.config.ts`.
 * Сторож не даёт им разъехаться и не даёт произведению перевалить за 8192.
 *
 * Чего он НЕ делает: он не меряет настоящую память. Настоящий пик меряет
 * `scripts/measure-build-memory.mjs`, и он же стоит в CI вокруг шага сборки с
 * порогом BUDGET_MB. Здесь — только договор между файлами, он дешёвый и
 * выполняется за миллисекунды, поэтому годится для `verify`.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Память контейнера сборки Vercel, МБ. Сменится машина — сменится число. */
export const VERCEL_BUILDER_MB = 8192;

/**
 * Порог измеренного пика для CI, МБ.
 *
 * 8192 − 2560 = 5632, округлено вниз до 5600: если измеренный пик перевалит за
 * него, до смерти контейнера останется меньше одного потолка кучи — то есть
 * запас исчерпан, даже если конкретная сборка ещё прошла. Замер 21.09.2026 на
 * этой машине: пик 1,0–1,7 ГБ, то есть запас к порогу троекратный.
 */
export const BUDGET_MB = 5600;

export function parseHeapCeiling(command) {
  const m = String(command).match(/--max-old-space-size=(\d+)/);
  return m ? Number(m[1]) : null;
}

export function parseCpus(configSource) {
  // Считаем только строку вида `cpus: N,` — комментарии в этом файле
  // многословны и слово cpus встречается в них тоже.
  const m = String(configSource).match(/^\s*cpus:\s*(\d+)\s*,/m);
  return m ? Number(m[1]) : null;
}

export function audit({ packageBuild, vercelBuild, configSource }) {
  const problems = [];
  const npmCeiling = parseHeapCeiling(packageBuild);
  const vercelCeiling = parseHeapCeiling(vercelBuild);
  const cpus = parseCpus(configSource);

  if (npmCeiling === null)
    problems.push("в `scripts.build` (package.json) нет `--max-old-space-size` — локальная сборка и CI ничем не ограничены");
  if (vercelCeiling === null)
    problems.push("в `buildCommand` (vercel.json) нет `--max-old-space-size` — на Vercel V8 будет расти до смерти контейнера");
  if (npmCeiling !== null && vercelCeiling !== null && npmCeiling !== vercelCeiling)
    problems.push(`потолок кучи разъехался: package.json ${npmCeiling} МБ, vercel.json ${vercelCeiling} МБ — значит CI меряет не то, что собирает Vercel`);
  if (cpus === null)
    problems.push("в `next.config.ts` нет `experimental.cpus` — число воркеров генерации станет зависеть от числа ядер машины, и верхняя граница памяти перестанет быть вычислимой");

  const ceiling = vercelCeiling ?? npmCeiling;
  let worstCaseMb = null;
  if (ceiling !== null && cpus !== null) {
    worstCaseMb = (1 + cpus) * ceiling;
    if (worstCaseMb > VERCEL_BUILDER_MB)
      problems.push(
        `худший случай (1 + ${cpus}) × ${ceiling} = ${worstCaseMb} МБ больше ${VERCEL_BUILDER_MB} МБ контейнера Vercel — при таком раскладе SIGKILL возможен снова`,
      );
  }
  return { npmCeiling, vercelCeiling, cpus, worstCaseMb, problems };
}

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function live() {
  return {
    packageBuild: JSON.parse(read("package.json")).scripts.build,
    vercelBuild: JSON.parse(read("vercel.json")).buildCommand,
    configSource: read("next.config.ts"),
  };
}

function plant() {
  const real = live();
  // Каждая подсадка ПОДМЕНЯЕТ НАСТОЯЩЕЕ содержимое живых файлов, а не
  // придуманную строку: если завтра потолок уедет из `package.json` в другое
  // место, подсадка перестанет попадать и это будет видно.
  const cases = [
    {
      label: "потолок кучи убран из package.json",
      input: { ...real, packageBuild: real.packageBuild.replace(/--max-old-space-size=\d+/, "") },
    },
    {
      label: "потолок кучи убран из vercel.json",
      input: { ...real, vercelBuild: real.vercelBuild.replace(/--max-old-space-size=\d+/, "") },
    },
    {
      label: "потолки разъехались между package.json и vercel.json",
      input: { ...real, vercelBuild: real.vercelBuild.replace(/--max-old-space-size=\d+/, "--max-old-space-size=4096") },
    },
    {
      label: "experimental.cpus убран из next.config.ts",
      input: { ...real, configSource: real.configSource.replace(/^\s*cpus:\s*\d+\s*,/m, "") },
    },
    {
      label: "потолок поднят так, что худший случай не влезает в 8192 МБ",
      input: {
        ...real,
        packageBuild: real.packageBuild.replace(/--max-old-space-size=\d+/, "--max-old-space-size=4096"),
        vercelBuild: real.vercelBuild.replace(/--max-old-space-size=\d+/, "--max-old-space-size=4096"),
      },
    },
    {
      label: "воркеров стало столько, что худший случай не влезает",
      input: { ...real, configSource: real.configSource.replace(/^(\s*)cpus:\s*\d+\s*,/m, "$1cpus: 8,") },
    },
  ];

  console.log("check:build-memory --plant");
  console.log("");
  let missed = 0;
  for (const { label, input } of cases) {
    const { problems } = audit(input);
    const caught = problems.length > 0;
    if (!caught) missed++;
    console.log(`  ${caught ? "✓" : "✗"} ${label}${caught ? ` → ${problems[0]}` : "  ← НЕ ПОЙМАНО"}`);
  }
  // Отрицательный контроль: на живых файлах сторож обязан МОЛЧАТЬ, иначе
  // «поймал всё» означало бы просто «кричит всегда».
  const clean = audit(real).problems;
  const quietOnTruth = clean.length === 0;
  if (!quietOnTruth) missed++;
  console.log(`  ${quietOnTruth ? "✓" : "✗"} на живых файлах молчит${quietOnTruth ? "" : `  ← ${clean[0]}`}`);
  console.log("");
  if (missed > 0) {
    console.error(`✗ подсажено ${cases.length + 1}, не поймано ${missed}. Сторож слеп — чинить его, а не сборку.`);
    process.exit(1);
  }
  console.log(`Контроль пройден: подсажено ${cases.length}, поймано ${cases.length}; плюс отрицательный контроль на живых файлах.`);
  process.exit(0);
}

function main() {
  if (process.argv.includes("--plant")) return plant();
  const { npmCeiling, vercelCeiling, cpus, worstCaseMb, problems } = audit(live());
  console.log("check:build-memory");
  console.log(`  потолок кучи: package.json ${npmCeiling} МБ, vercel.json ${vercelCeiling} МБ`);
  console.log(`  воркеров генерации (experimental.cpus): ${cpus}`);
  console.log(`  худший случай: (1 + ${cpus}) × ${vercelCeiling} = ${worstCaseMb} МБ при ${VERCEL_BUILDER_MB} МБ контейнера Vercel`);
  console.log(`  порог измеренного пика в CI: ${BUDGET_MB} МБ`);
  if (problems.length > 0) {
    console.error("");
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
  console.log("✓ договор о памяти сборки цел.");
  process.exit(0);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) main();
