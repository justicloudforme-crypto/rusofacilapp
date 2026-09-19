/**
 * НИ ОДИН ГЕЙТ НЕ СУДИТ ПО ОДНОЙ ПОДПИСИ ТОКЕНА — ДОЛГ 227 (заход 7.217).
 *
 * Строка долга дословно: «**у токена с устаревшим `sessionVersion`
 * мета-обновление в кабинете остаётся.** Условие → гейт кабинета в
 * `src/proxy.ts` судит только подпись токена (`verifySessionToken`) и базу
 * не читает; подпись у такого токена верна, и запрос доходит до страницы,
 * где `getCurrentUser()` вернёт `null` уже ПОСЛЕ первого байта → триггер:
 * человек сменил пароль или нажал «выйти на других устройствах», а на
 * этом устройстве открыл кабинет → следствие: те же 200 с `<meta refresh>`
 * и секунда ожидания, что были у гостя до 7.201».
 *
 * ПОЧЕМУ ЭТО ВООБЩЕ ВАЖНО. `sessionVersion` — единственное, чем отзыв
 * сессии отличается от её отсутствия. Подпись у отозванного токена верна
 * навсегда; жив он или нет, знает колонка в базе. Гейт, который её не
 * спрашивает, пускает на страницу того, кто ровно что «вышел на всех
 * устройствах».
 *
 * ЧЕТЫРЕ ПРАВИЛА:
 *   а) сверка живости объявлена ОДНОЙ функцией `liveSessionUser`, а не
 *      пересказана в каждом гейте — два пересказа расходятся молча;
 *   б) эта функция и правда сличает `sessionVersion` со строкой базы;
 *   в) оба гейта — `protectAdminRoute` и `protectCabinetRoute` — через
 *      неё проходят;
 *   г) гость по-прежнему разворачивается БЕЗ обращения к базе: в гейте
 *      кабинета проверка токена стоит раньше чтения.
 *
 *   node scripts/check-session-version-gate.mjs          # гейт
 *   node scripts/check-session-version-gate.mjs --plant  # контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const PROXY = "src/proxy.ts";

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

function body(src, name) {
  const re = new RegExp(`(?:async )?function ${name}\\(([\\s\\S]*?)\\n\\}`);
  return re.exec(src)?.[0] ?? "";
}

export function violations(proxyRaw) {
  const src = stripComments(proxyRaw);
  const bad = [];
  if (!src.trim()) {
    bad.push(`${PROXY}: файл не прочитан — сторож ослеп, а не доволен`);
    return bad;
  }

  const helper = body(src, "liveSessionUser");
  if (!helper) {
    bad.push(`${PROXY}: функции liveSessionUser нет — правило «жив ли токен» снова пересказывается в каждом гейте (долг 227)`);
  } else if (!/sessionVersion\s*!==\s*parsed\.sessionVersion/.test(helper)) {
    bad.push(`${PROXY}: liveSessionUser не сличает sessionVersion со строкой базы — отозванный токен снова живой (долг 227)`);
  } else if (!/db\.user\.findUnique/.test(helper)) {
    bad.push(`${PROXY}: liveSessionUser не читает User — сличать нечего (долг 227)`);
  }

  for (const gate of ["protectAdminRoute", "protectCabinetRoute"]) {
    const fn = body(src, gate);
    if (!fn) {
      bad.push(`${PROXY}: гейта ${gate} нет вовсе — сторож ослеп`);
      continue;
    }
    if (!/liveSessionUser\(/.test(fn)) {
      bad.push(`${PROXY}: ${gate} не спрашивает liveSessionUser — судит по одной подписи токена (долг 227)`);
    }
    if (/db\.user\.findUnique/.test(fn)) {
      bad.push(`${PROXY}: ${gate} читает User сам, мимо общей функции — второй пересказ правила (долг 227)`);
    }
  }

  // Гость не должен стоить чтения базы: проверка токена раньше чтения.
  const cabinet = body(src, "protectCabinetRoute");
  if (cabinet) {
    const tokenAt = cabinet.indexOf("verifySessionToken");
    const readAt = cabinet.indexOf("liveSessionUser");
    if (tokenAt === -1 || readAt === -1 || tokenAt > readAt) {
      bad.push(`${PROXY}: в гейте кабинета чтение базы стоит раньше проверки подписи — гость стал стоить чтения (долг 227)`);
    }
  }
  return bad;
}

function plant() {
  const proxy = readFileSync(PROXY, "utf8");
  const cases = [{ name: "отрицательный контроль: живой файл сегодня чист", ok: violations(proxy).length === 0 }];
  const add = (name, mutated, expect) => {
    if (mutated === proxy) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(mutated).some((x) => x.includes(expect)) });
  };

  add(
    "подсадка: гейт кабинета снова судит по одной подписи (состояние до 19.09.2026)",
    proxy.replace("if (parsed && (await liveSessionUser(parsed))) return null;", "if (parsed) return null;"),
    "protectCabinetRoute не спрашивает liveSessionUser",
  );
  add(
    "подсадка: общая функция снесена, правило пересказано в гейте админки",
    proxy.replace("async function liveSessionUser(", "async function liveSessionUserX("),
    "функции liveSessionUser нет",
  );
  add(
    "подсадка: сверка версии убрана из общей функции",
    proxy.replace("if (!user || user.sessionVersion !== parsed.sessionVersion) return null;", "if (!user) return null;"),
    "не сличает sessionVersion",
  );
  add(
    "подсадка: гейт админки читает User сам, мимо общей функции",
    proxy.replace(
      "  const user = await liveSessionUser(parsed);",
      "  const user = await db.user.findUnique({ where: { id: parsed.userId }, select: { role: true, sessionVersion: true } });",
    ),
    "читает User сам",
  );
  add(
    "подсадка: чтение базы уехало вперёд проверки подписи — гость стал стоить чтения",
    proxy.replace(
      "  const parsed = token ? verifySessionToken(token) : null;\n  if (parsed && (await liveSessionUser(parsed))) return null;",
      "  const eager = await liveSessionUser({ userId: \"x\", sessionVersion: 0 });\n  const parsed = token && eager ? verifySessionToken(token) : null;\n  if (parsed) return null;",
    ),
    "чтение базы стоит раньше проверки подписи",
  );

  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:session-version-gate --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:session-version-gate --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  let src = "";
  try {
    src = readFileSync(PROXY, "utf8");
  } catch {
    src = "";
  }
  const bad = violations(src);
  if (bad.length) {
    console.error(`check:session-version-gate — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:session-version-gate — 4 правила, гейтов 2, нарушений 0: отозванный токен не доходит до страницы (долг 227)");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
