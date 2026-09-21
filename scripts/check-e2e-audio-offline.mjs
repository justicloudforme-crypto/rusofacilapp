#!/usr/bin/env node
/**
 * Ни одна проба не качает звук из интернета — строка долга 297.
 *
 *   node scripts/check-e2e-audio-offline.mjs
 *   node scripts/check-e2e-audio-offline.mjs --plant
 *
 * ПОВОД, ЧИСЛОМ. Заход 7.218 положил в строку фикстуры «День стирки»
 * НАСТОЯЩИЙ боевой `fullAudioUrl` — файл 1 303 724 байта на
 * `*.public.blob.vercel-storage.com`. После этого `e2e/sw-audio-replay.spec.ts`
 * качал живой файл в каждом прогоне: из четырёх прогонов 20–21.09.2026
 * КРАСНЫХ ДВА (PR #382 первый прогон и main CI #1030), причём второй остался
 * красным даже после второй повторной попытки, а падало ПЕРВОЕ
 * воспроизведение с `error.code 2` (`MEDIA_ERR_NETWORK`) — то есть мерилась
 * связь, а не воркер. В ветке #382 не было ни строки кода.
 *
 * ПРАВИЛО. Если проба трогает воспроизведение звука — щёлкает кнопку
 * «слушать» или спрашивает у страницы элемент `<audio>` — она ОБЯЗАНА
 * поставить свой источник клипов (`serveClipLocally` из
 * `e2e/helpers/audio-clip-origin.ts`). Источник отдаёт байты, собранные
 * здесь же, и в сеть не ходит ни при каких условиях — это второе правило,
 * и оно проверяется отдельно: в помощнике не должно быть ни `route.fetch(`,
 * ни `route.continue(`, потому что оба означают «сходить наружу».
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const E2E_DIR = "e2e";
const HELPER = "e2e/helpers/audio-clip-origin.ts";
const INSTALLER = "serveClipLocally";

/** Признаки того, что проба трогает воспроизведение звука. */
const PLAYS_AUDIO = [
  /querySelector\(\s*["'`]audio["'`]\s*\)/,
  /querySelectorAll\(\s*["'`]audio["'`]\s*\)/,
  /createElement\(\s*["'`]audio["'`]\s*\)/,
  /new Audio\(/,
  /name:\s*\/\s*слушать\|escuchar/i,
];

/** Выходы наружу, которых в источнике клипов быть не должно. */
const GOES_OUTSIDE = [/route\.fetch\(/, /route\.continue\(/, /request\.fetch\(/];

export function auditSpec({ path, source }) {
  const plays = PLAYS_AUDIO.some((re) => re.test(source));
  if (!plays) return null;
  if (source.includes(`${INSTALLER}(`)) return null;
  return `${path}: проба трогает воспроизведение звука, но не ставит свой источник клипов (${INSTALLER}) — значит в CI она качает файл из интернета`;
}

export function auditHelper({ path, source }) {
  const leak = GOES_OUTSIDE.find((re) => re.test(source));
  if (!leak) return null;
  return `${path}: источник клипов уходит в сеть (${leak.source}) — тогда он не источник, а посредник, и проба снова зависит от связи`;
}

export function audit(files) {
  const problems = [];
  for (const file of files) {
    if (file.path === HELPER) {
      const bad = auditHelper(file);
      if (bad) problems.push(bad);
      continue;
    }
    const bad = auditSpec(file);
    if (bad) problems.push(bad);
  }
  return problems;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith(".ts")) out.push({ path, source: readFileSync(path, "utf8") });
  }
  return out;
}

function live() {
  return walk(E2E_DIR);
}

function plant() {
  const real = live();
  const spec = real.find((f) => f.path === "e2e/sw-audio-replay.spec.ts");
  const helper = real.find((f) => f.path === HELPER);
  if (!spec || !helper) {
    console.error(`✗ подсадке не на чем работать: не найдены ${spec ? "" : "e2e/sw-audio-replay.spec.ts "}${helper ? "" : HELPER}`);
    process.exit(1);
  }

  // Каждая подсадка ПОДМЕНЯЕТ НАСТОЯЩИЙ ТЕКСТ живых файлов — не выдуманную
  // строку. Съедет имя помощника или форма вызова — подсадка перестанет
  // попадать, и это будет видно сразу.
  const cases = [
    {
      label: "у живой пробы убрана установка своего источника клипов",
      files: real.map((f) => (f.path === spec.path ? { ...f, source: f.source.replaceAll(`${INSTALLER}(`, "noopOrigin(") } : f)),
    },
    {
      label: "появилась новая проба, которая щёлкает «слушать» и источник не ставит",
      files: [
        ...real,
        { path: "e2e/подсадка-новая-проба.spec.ts", source: 'page.getByRole("button", { name: /слушать|escuchar/i })' },
      ],
    },
    {
      label: "появилась новая проба, которая спрашивает у страницы <audio>",
      files: [...real, { path: "e2e/подсадка-вторая.spec.ts", source: 'document.querySelector("audio")' }],
    },
    {
      label: "источник клипов начал ходить в сеть (route.fetch)",
      files: real.map((f) => (f.path === HELPER ? { ...f, source: f.source + "\nawait route.fetch();\n" } : f)),
    },
  ];

  console.log("check:e2e-audio-offline --plant");
  console.log("");
  let missed = 0;
  for (const { label, files } of cases) {
    const problems = audit(files);
    const caught = problems.length > 0;
    if (!caught) missed++;
    console.log(`  ${caught ? "✓" : "✗"} ${label}${caught ? "" : "  ← НЕ ПОЙМАНО"}`);
  }
  const clean = audit(real);
  const quiet = clean.length === 0;
  if (!quiet) missed++;
  console.log(`  ${quiet ? "✓" : "✗"} на живых файлах молчит${quiet ? "" : `  ← ${clean[0]}`}`);
  console.log("");
  if (missed > 0) {
    console.error(`✗ подсажено ${cases.length + 1}, не поймано ${missed}.`);
    process.exit(1);
  }
  console.log(`Контроль пройден: подсажено ${cases.length}, поймано ${cases.length}; плюс отрицательный контроль на живых файлах.`);
  process.exit(0);
}

function main() {
  if (process.argv.includes("--plant")) return plant();
  const files = live();
  const problems = audit(files);
  const playing = files.filter((f) => f.path !== HELPER && PLAYS_AUDIO.some((re) => re.test(f.source)));
  console.log(
    `check:e2e-audio-offline — файлов в e2e/ ${files.length}, из них трогают воспроизведение ${playing.length}` +
      ` (${playing.map((f) => f.path.replace("e2e/", "")).join(", ") || "нет"}), нарушений ${problems.length} (долг 297)`,
  );
  if (problems.length > 0) {
    console.error("");
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
  process.exit(0);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) main();
