// Решение «есть ли у этого человека доступ» принимается в ОДНОМ месте.
//
// 08.09.2026, цель A, первый долг критического пути. Окно C намерило
// (docs/audit-2026-09-08-C.md, §3.3): «единая точка выдачи доступа есть,
// но она не одна». Рядом с `getEntitlementTier()` жил двоичный
// `userHasActiveSubscription` в четырёх маршрутах, каждый со своим
// повторением обхода для персонала, плюс `tierOfSubscriptions`,
// `getEntitlementTierForUser` и `getEntitlementTiersForUsers`, вызываемые
// из страниц напрямую. Семь разных выражений отвечали на один вопрос, и
// разойтись им мешало только то, что никто их не правил.
//
// ПРАВИЛО, которое держит этот сторож:
//
//   внутренности правила доступа — `tierOfSubscriptions`,
//   `tierOfStoredSubscription`, `isSubscriptionActive`,
//   `getEntitlementTierForUser`, `getEntitlementTiersForUsers`,
//   `userHasActiveSubscription` — живут в `src/lib/subscription.ts` и
//   читаются только из `src/lib/entitlement.ts`. Всё остальное
//   спрашивает `getEntitlementTier()` / `getEntitlementTierFor(user)` и
//   читает ответ чистыми функциями (`hasAnyAccess`, `canAccessLevel`,
//   `getStoryAccess`, `isPremiumTier`, …).
//
// Исключения закреплены ЧИСЛОМ, как у `check:brand` и `check:access-marks`:
// новый файл, залезший во внутренности, обязан либо перестать это делать,
// либо быть внесён сюда руками с причиной. Молча он не пройдёт.
//
//   node scripts/check-entitlement-single-point.mjs
//   node scripts/check-entitlement-single-point.mjs --map    # все места поимённо
//   node scripts/check-entitlement-single-point.mjs --plant  # позитивный контроль
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const MAP = process.argv.includes("--map");
const ROOT = join(process.cwd(), "src");

/** Внутренности правила доступа. Вызов любой из них — самостоятельное
 * принятие решения о доступе, а не чтение чужого ответа. */
const INTERNALS = [
  "userHasActiveSubscription",
  "getEntitlementTierForUser",
  "getEntitlementTiersForUsers",
  "tierOfSubscriptions",
  "tierOfStoredSubscription",
  "isSubscriptionActive",
];

/** Дом правила: здесь внутренностям и место. */
const HOME = new Set(["lib/subscription.ts", "lib/entitlement.ts"]);

/**
 * Где внутренность зовут не ради доступа, а ради управления строками.
 * Каждая строка — с причиной. Длина списка закреплена числом ниже.
 */
const ALLOWED = new Map([
  [
    "app/api/subscription/cancel/route.ts",
    "`isSubscriptionActive` перечисляет, ЧТО можно отменить, — это управление строками, а не выдача доступа",
  ],
  [
    "app/api/admin/subscriptions/revoke/route.ts",
    "то же: администратор видит список живых строк, чтобы выбрать отзываемую",
  ],
]);
const ALLOWED_COUNT = 2;

/** Убирает `/* … *\/` и `//…`, сохраняя нумерацию строк. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Места, где файл сам принимает решение о доступе: файл, строка, символ. */
function findDecisionPoints(files) {
  const points = [];
  for (const file of files) {
    const rel = relative(ROOT, file).split("\\").join("/");
    if (HOME.has(rel)) continue;
    if (/\.test\.tsx?$/.test(rel)) continue;
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    lines.forEach((text, index) => {
      // Строка `import { … } from` — это не место принятия решения, а его
      // предвестник; считаем сами вызовы, иначе один импорт и три вызова
      // в файле дали бы четыре «места» вместо трёх.
      if (/^\s*import\b/.test(text)) return;
      for (const symbol of INTERNALS) {
        if (new RegExp(`\\b${symbol}\\s*\\(`).test(text)) {
          points.push({ rel, line: index + 1, symbol, text: text.trim().slice(0, 100) });
        }
      }
    });
  }
  return points;
}

function main() {
  if (ALLOWED.size !== ALLOWED_COUNT) {
    console.error(
      `список исключений вырос до ${ALLOWED.size} при ожидаемых ${ALLOWED_COUNT} — так и было задумано? тогда поправьте число здесь`
    );
    return 1;
  }

  const files = walk(ROOT);
  const all = findDecisionPoints(files);
  const offenders = all.filter((p) => !ALLOWED.has(p.rel));

  if (MAP) {
    console.log(`| файл | строка | символ |`);
    console.log(`|---|---:|---|`);
    for (const p of all) {
      console.log(`| \`${p.rel}\` | ${p.line} | \`${p.symbol}\` |${ALLOWED.has(p.rel) ? " исключение" : ""}`);
    }
  }

  if (PLANT) {
    // Подсадка: файл вне дома и вне исключений, спрашивающий внутренность
    // напрямую. Ровно та форма, в которой долг и жил — четыре маршрута с
    // `userHasActiveSubscription`.
    const plantedRel = "app/api/__planted__/route.ts";
    const plantedLine = "  if (!isStaff(user.role) && !(await userHasActiveSubscription(user.id))) return null;";
    const plantedHits = [];
    for (const symbol of INTERNALS) {
      if (new RegExp(`\\b${symbol}\\s*\\(`).test(plantedLine)) {
        plantedHits.push({ rel: plantedRel, line: 1, symbol, text: plantedLine.trim() });
      }
    }
    const caught = plantedHits.filter((p) => !ALLOWED.has(p.rel)).length;
    console.log(`check:entitlement-point --plant`);
    console.log(`  подсажено 1, поймано ${caught >= 1 ? 1 : 0} из 1 (${plantedHits.map((p) => p.symbol).join(", ") || "—"})`);
    // Отрицательная половина: без подсадки прогон обязан быть чистым.
    console.log(
      `  ${offenders.length === 0 ? "отрицательный контроль: без подсадки чисто" : `ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН — ${offenders.length} настоящих нарушений`}`
    );
    return caught >= 1 && offenders.length === 0 ? 0 : 1;
  }

  console.log(
    `[check:entitlement-point] просмотрено ${files.length} файлов; мест, принимающих решение о доступе самостоятельно: ${offenders.length} (исключений ${ALLOWED.size})`
  );
  for (const p of offenders) console.log(`  ${p.rel}:${p.line}  ${p.symbol}  ${p.text}`);
  return offenders.length ? 1 : 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exit(main());
