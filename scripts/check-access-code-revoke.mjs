/**
 * ОТЗЫВ КОДА ВСЕГДА ПОДПИСАН — ОСТАТОК ДОЛГА 89 (заход 7.216).
 *
 * ЧТО БЫЛО. Скриптовая половина долга закрыта ещё 08.09.2026 (7.147):
 * у `npm run access-codes:revoke` появился обязательный `--by`. Остаток
 * строки долга дословно: «экрана отзыва в `/admin` по-прежнему нет, и
 * `revokeAccessCode` в библиотеке всё ещё принимает `null` исполнителем —
 * это нужно сценарию [A10]. Чинить экраном в `/admin`, который передаст
 * идентификатор администратора».
 *
 * ПОЧЕМУ ЭТО ВАЖНО. `AccessCode.revokedById` — настоящий внешний ключ на
 * `User`. Пустая подпись означает отозванный код, про который нельзя
 * сказать, кто его отозвал; а подпись, взятая из ФОРМЫ, означает подпись,
 * которую назначает отправитель запроса.
 *
 * ПЯТЬ ПРАВИЛ:
 *   а) у `revokeAccessCode` исполнитель объявлен `string`, а не
 *      `string | null` — `null` исключён типом, а не проверкой внутри;
 *   б) ни один вызов в `src/` и `scripts/` не передаёт исполнителем `null`;
 *   в) экран `/admin/access-codes` существует и его форма ведёт на
 *      маршрут отзыва;
 *   г) маршрут подставляет исполнителем `actor.id` из сессии, и
 *      исполнитель не читается из формы;
 *   д) маршрут отказывает не-владельцу ДО любой записи.
 *
 * ЧЕГО НЕ ОБЕЩАЕТ: сторож не нажимает кнопку. Что отзыв через экран
 * действительно пишет строку, проверяет сценарий `[A10]`
 * (`scripts/scenarios/access-code.scenario.ts`) и юнит-тесты
 * `src/lib/access-code.test.ts`.
 *
 *   node scripts/check-access-code-revoke.mjs          # гейт
 *   node scripts/check-access-code-revoke.mjs --plant  # контроль
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const LIB = "src/lib/access-code.ts";
const SCREEN = "src/app/[lang]/admin/access-codes/page.tsx";
const ROUTE = "src/app/api/admin/access-codes/revoke/route.ts";

export function stripComments(code) {
  return code.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|mjs)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Вызовы `revokeAccessCode(…, null)` по всему дереву, поимённо. */
export function nullActorCallSites(files) {
  const hits = [];
  for (const file of files) {
    const code = stripComments(readFileSync(file, "utf8"));
    if (/revokeAccessCode\([^)]*,\s*null\s*\)/.test(code)) hits.push(relative(process.cwd(), file));
  }
  return hits;
}

export function violations(libRaw, screenRaw, routeRaw, nullSites = []) {
  const lib = stripComments(libRaw);
  const screen = stripComments(screenRaw);
  const route = stripComments(routeRaw);
  const bad = [];

  const sig = /export async function revokeAccessCode\(([\s\S]*?)\)\s*:/.exec(lib)?.[1] ?? "";
  if (!sig) {
    bad.push(`${LIB}: объявления revokeAccessCode не найдено — сторож ослеп, а не доволен`);
  } else if (/actorId\s*:\s*string\s*\|\s*null/.test(sig) || /actorId\s*\?\s*:/.test(sig)) {
    bad.push(`${LIB}: исполнитель отзыва снова может быть пустым — колонка revokedById останется без подписи (долг 89)`);
  } else if (!/actorId\s*:\s*string/.test(sig)) {
    bad.push(`${LIB}: у revokeAccessCode нет исполнителя типа string`);
  }
  for (const site of nullSites) bad.push(`${site}: отзыв зовётся с пустым исполнителем (долг 89)`);

  if (!screen) {
    bad.push(`${SCREEN}: экрана отзыва в /admin нет — остаток долга 89 вернулся`);
  } else if (!/action="\/api\/admin\/access-codes\/revoke"/.test(screen)) {
    bad.push(`${SCREEN}: форма экрана не ведёт на маршрут отзыва`);
  }

  if (!route) {
    bad.push(`${ROUTE}: маршрута отзыва нет вовсе`);
    return bad;
  }
  if (!/revokeAccessCode\(\s*code\s*,\s*actor\.id\s*\)/.test(route)) {
    bad.push(`${ROUTE}: исполнителем уходит не actor.id из сессии — подпись отзыва назначает отправитель запроса (долг 89)`);
  }
  if (/formData\.get\("actorId"\)|formData\.get\("revokedById"\)/.test(route)) {
    bad.push(`${ROUTE}: исполнитель читается из формы — это подпись, назначенная отправителем`);
  }
  // Отказ не-владельцу обязан стоять ДО чтения формы и до записи:
  // сличается текст маршрута до первого обращения к форме.
  const beforeForm = route.split("formData")[0] ?? "";
  if (!/isOwner\(actor\.role\)/.test(beforeForm) || !/status:\s*403/.test(beforeForm)) {
    bad.push(`${ROUTE}: роль владельца проверяется не до чтения формы — отзыв открыт роли admin (долг 89)`);
  }
  return bad;
}

function plant() {
  const lib = readFileSync(LIB, "utf8");
  const screen = readFileSync(SCREEN, "utf8");
  const route = readFileSync(ROUTE, "utf8");
  const live = nullActorCallSites([...walk(join(process.cwd(), "src")), ...walk(join(process.cwd(), "scripts"))]);
  const cases = [
    { name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(lib, screen, route, live).length === 0 },
    { name: "отрицательный контроль: вызовов с пустым исполнителем сегодня 0", ok: live.length === 0 },
  ];
  const add = (name, l, s, r, sites, expect) => {
    if (l === lib && s === screen && r === route && sites.length === 0) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(l, s, r, sites).some((f) => f.includes(expect)) });
  };

  add("подсадка: вернуть `string | null` исполнителю", lib.replace("  actorId: string\n)", "  actorId: string | null\n)"), screen, route, [], "снова может быть пустым");
  add("подсадка: вызов с пустым исполнителем найден в дереве", lib, screen, route, ["scripts/что-нибудь.ts"], "зовётся с пустым исполнителем");
  add("подсадка: экран отзыва снесён (состояние до правки)", lib, "", route, [], "экрана отзыва в /admin нет");
  add("подсадка: форма экрана ведёт не туда", lib, screen.replace('action="/api/admin/access-codes/revoke"', 'action="/api/admin/subscriptions/revoke"'), route, [], "не ведёт на маршрут отзыва");
  add("подсадка: исполнитель берётся из формы", lib, screen, route.replace("revokeAccessCode(code, actor.id)", 'revokeAccessCode(code, String(formData.get("actorId")))'), [], "не actor.id из сессии");
  add("подсадка: проверка роли уехала за чтение формы", lib, screen, route.replace(/const actor = await getCurrentUser\(\);[\s\S]*?\n  \}\n\n/, ""), [], "проверяется не до чтения формы");

  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:access-code-revoke --plant — ${cases.length - 2} из ${cases.length - 2} подсадок, 2 из 2 отрицательных контроля` : "check:access-code-revoke --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const read = (p) => {
    try {
      return readFileSync(p, "utf8");
    } catch {
      return "";
    }
  };
  const sites = nullActorCallSites([...walk(join(process.cwd(), "src")), ...walk(join(process.cwd(), "scripts"))]);
  const bad = violations(read(LIB), read(SCREEN), read(ROUTE), sites);
  if (bad.length) {
    console.error(`check:access-code-revoke — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:access-code-revoke — 5 правил, нарушений 0; вызовов с пустым исполнителем 0 (долг 89)");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
