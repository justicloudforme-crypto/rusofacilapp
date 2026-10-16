// РАЗМЕР PROGRESS.md И ЦЕЛОСТЬ ЕГО АРХИВА (заход 7.270, 15.10.2026).
//
// Зачем. К 15.10.2026 PROGRESS.md вырос до 6 805 643 байт, и заход 7.269
// уже не смог прочитать его целиком — читал шапку и grep. Каждый заход
// начинается с чтения этого файла, и непрочитанное правило владельца —
// это сломанная наработка. В 7.270 история ушла дословно в
// docs/progress-archive/, основной файл держит только действующее.
// Этот сторож не даёт ему снова разрастись и не даёт архиву тихо
// испортиться.
//
// Что проверяется:
//   1. PROGRESS.md не больше MAIN_LIMIT байт и начинается с «# PROGRESS.md».
//   2. Каждый файл docs/progress-archive/*.md не больше ARCHIVE_LIMIT байт
//      (архив тоже должен читаться целиком).
//   3. Замороженные части part-01…part-10: все на месте, у каждой ровно
//      одна метка начала тела, и склейка тел по порядку байт в байт равна
//      прежнему PROGRESS.md (sha256 и длина записаны ниже). Это и есть
//      доказательство «ни одна строка не потеряна», которое повторяется
//      на каждом прогоне, а не один раз в отчёте.
//
// Красный по п.1 чинится переносом истории в архив месяца
// (docs/progress-archive/runs-ГГГГ-ММ.md), а не подъёмом предела.
//
// Контроль: `node scripts/check-progress-size.mjs --plant`.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

export const MAIN = "PROGRESS.md";
export const ARCHIVE_DIR = "docs/progress-archive";
/** Предел основного файла. На 15.10.2026 файл весит ≈268 КБ, из них
 * ≈177 КБ — дословные строки 94 открытых долгов, «правил» и снятых. */
export const MAIN_LIMIT = 300_000;
export const ARCHIVE_LIMIT = 1_000_000;
export const BODY_MARK = "\n<!-- progress-archive:body -->\n";
export const FROZEN_PARTS = [
  "part-01-header-sections-0-6.md",
  "part-02-section-7-runs-7.1-7.91.md",
  "part-03-runs-7.228-7.269.md",
  "part-04-runs-7.203-7.227.md",
  "part-05-runs-7.172-7.202.md",
  "part-06-runs-7.134-7.171.md",
  "part-07-runs-7.93-7.133.md",
  "part-08-runs-7.78-7.92.md",
  "part-09-debts-section-7.12.md",
  "part-10-august-2026.md",
];
/** Прежний PROGRESS.md, коммит cfd7a1b (15.10.2026). */
export const FROZEN_SHA256 = "fbea67ef156b592568e9b9641e5ab35cf8c6ec1a75e0128dc460979cad3715ab";
export const FROZEN_BYTES = 6_805_643;

/** Тело части — всё после первой метки. */
export function bodyOf(text) {
  const at = text.indexOf(BODY_MARK);
  return at < 0 ? null : text.slice(at + BODY_MARK.length);
}

/** Чистая функция: { main: string, archive: Map<имя, string> } → список отказов. */
export function scan({ main, archive }) {
  const failures = [];
  const mainBytes = Buffer.byteLength(main);
  if (mainBytes > MAIN_LIMIT) {
    failures.push(
      `${MAIN} — ${mainBytes} байт при пределе ${MAIN_LIMIT}: история попала в основной файл; ` +
        `перенести подробности в ${ARCHIVE_DIR}/runs-ГГГГ-ММ.md, предел не поднимать`,
    );
  }
  if (!main.startsWith("# PROGRESS.md")) failures.push(`${MAIN} не начинается с «# PROGRESS.md»`);
  for (const [name, text] of archive) {
    const bytes = Buffer.byteLength(text);
    if (bytes > ARCHIVE_LIMIT) failures.push(`${ARCHIVE_DIR}/${name} — ${bytes} байт при пределе ${ARCHIVE_LIMIT}`);
  }
  const bodies = [];
  for (const name of FROZEN_PARTS) {
    const text = archive.get(name);
    if (text === undefined) {
      failures.push(`${ARCHIVE_DIR}/${name} — замороженной части нет`);
      continue;
    }
    const marks = text.split(BODY_MARK).length - 1;
    if (marks !== 1) failures.push(`${ARCHIVE_DIR}/${name} — меток начала тела ${marks}, а должна быть ровно одна`);
    bodies.push(bodyOf(text) ?? "");
  }
  const joined = bodies.join("");
  const sha = createHash("sha256").update(joined).digest("hex");
  const bytes = Buffer.byteLength(joined);
  if (sha !== FROZEN_SHA256 || bytes !== FROZEN_BYTES) {
    failures.push(
      `склейка тел частей 01–10: ${bytes} байт, sha256 ${sha.slice(0, 12)}… — ` +
        `а прежний PROGRESS.md ${FROZEN_BYTES} байт, ${FROZEN_SHA256.slice(0, 12)}…: архив изменён`,
    );
  }
  return { failures, mainBytes, joinedBytes: bytes, sha };
}

function load() {
  const main = readFileSync(MAIN, "utf8");
  const archive = new Map();
  for (const name of readdirSync(ARCHIVE_DIR).sort()) {
    const path = join(ARCHIVE_DIR, name);
    if (!statSync(path).isFile() || !name.endsWith(".md")) continue;
    archive.set(name, readFileSync(path, "utf8"));
  }
  return { main, archive };
}

function report(r, input) {
  console.log(
    `${MAIN}: ${r.mainBytes} байт (предел ${MAIN_LIMIT}); архив: ${input.archive.size} файлов, ` +
      `крупнейший ${Math.max(...[...input.archive.values()].map((t) => Buffer.byteLength(t)))} байт (предел ${ARCHIVE_LIMIT}); ` +
      `склейка частей ${r.joinedBytes} байт, sha256 ${r.sha.slice(0, 12)}…`,
  );
  for (const f of r.failures) console.error(`  ОТКАЗ: ${f}`);
  console.log(r.failures.length ? `check:progress-size — ${r.failures.length} отказ(ов)` : "check:progress-size — чисто");
  return r.failures.length === 0;
}

function plantControls() {
  const real = load();
  const clean = scan(real).failures.length === 0;
  console.log(`  ${clean ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие файлы (отрицательный контроль)`);
  let ok = clean;
  const withArchive = (fn) => {
    const archive = new Map(real.archive);
    fn(archive);
    return { main: real.main, archive };
  };
  const part = FROZEN_PARTS[2];
  const controls = [
    {
      name: `основной файл на 1 байт больше предела`,
      input: { main: real.main + "x".repeat(MAIN_LIMIT - Buffer.byteLength(real.main) + 1), archive: real.archive },
      expect: new RegExp(`${MAIN} — \\d+ байт при пределе ${MAIN_LIMIT}`),
    },
    {
      name: "основной файл без заголовка «# PROGRESS.md»",
      input: { main: real.main.replace("# PROGRESS.md", "# Журнал"), archive: real.archive },
      expect: /не начинается/,
    },
    {
      name: `одна буква тела ${part} заменена`,
      input: withArchive((a) => {
        const t = a.get(part);
        const at = t.indexOf(BODY_MARK) + BODY_MARK.length + 100;
        a.set(part, t.slice(0, at) + (t[at] === "а" ? "о" : "а") + t.slice(at + 1));
      }),
      expect: /архив изменён/,
    },
    {
      name: `часть ${FROZEN_PARTS[9]} удалена`,
      input: withArchive((a) => a.delete(FROZEN_PARTS[9])),
      expect: /замороженной части нет/,
    },
    {
      name: "файл архива раздут сверх 1 МБ",
      input: withArchive((a) => a.set("runs-2099-01.md", "я".repeat(ARCHIVE_LIMIT))),
      expect: /runs-2099-01\.md — \d+ байт при пределе/,
    },
    {
      name: `метка начала тела задвоена в ${part}`,
      input: withArchive((a) => a.set(part, a.get(part) + BODY_MARK)),
      expect: /меток начала тела 2/,
    },
  ];
  for (const c of controls) {
    const caught = scan(c.input).failures.some((f) => c.expect.test(f));
    console.log(`  ${caught ? "поймано" : "ПРОПУЩЕНО"} — ${c.name}`);
    ok &&= caught;
  }
  console.log(
    ok
      ? `check:progress-size --plant — ${controls.length} из ${controls.length} подсадок, 1 из 1 отрицательный контроль`
      : "check:progress-size --plant — FAILED",
  );
  return ok;
}

if (IS_ENTRY_POINT) {
  const ok = process.argv.includes("--plant") ? plantControls() : report(scan(load()), load());
  process.exitCode = ok ? 0 : 1;
}
