/**
 * ПРИВЕТСТВИЕ ДНЯ — ОДИН РАЗ В СУТКИ УЧЕНИКА (долг 223, заход 7.204).
 *
 * ====================================================================
 * ДВЕ ПОЛОМКИ, КОТОРЫЕ ЗДЕСЬ ЗАПЕРТЫ
 * ====================================================================
 *
 * 1. СУТКИ ПО ГРИНВИЧУ. Ключ замка собирался в браузере как
 *    `new Date().toISOString().slice(0, 10)`. У владельца (GMT+10)
 *    «новый день» наступал в 10:00 по местному, и приветствие могло
 *    прийти дважды за один местный день или не прийти вовсе. Это тот же
 *    класс, что 7.68 («два ответа на вопрос, какой сегодня день»), и
 *    лечится так же: день считает `dateKeyIn` в зоне аккаунта, на
 *    СЕРВЕРЕ, и приезжает в компонент готовым (`todayKey`).
 *
 * 2. ОТМЕТКА СТИРАЛАСЬ ВЫХОДОМ. Она лежала в localStorage, а уборка
 *    7.199 удаляет всё с приставкой `rf-welcome-shown:`. Владелец снял
 *    17.09.2026 два показа за один местный день (00:40 и ~03:25 по
 *    GMT+10), между которыми были выход/вход и переустановка. Отметка
 *    переехала в куку — она выход переживает.
 *
 * ====================================================================
 * ЧТО ПРОВЕРЯЕТСЯ
 * ====================================================================
 *
 *   а) компонент не имеет своего мнения о дате: ни `new Date`, ни
 *      `toISOString` в `WelcomeOverlay.tsx`;
 *   б) он принимает `todayKey` и читает его в замке;
 *   в) замок — кука `WELCOME_SHOWN_COOKIE`, а не localStorage;
 *   г) кабинет передаёт `todayKey`, и это `dateKeyIn(new Date(), timeZone)`
 *      — тот же день, что у отметки занятия.
 *
 * Поведение (второй показ после выхода/входа не приходит, переход через
 * местную полночь — приходит) заперто рядом, в
 * `src/components/profile/WelcomeOverlay.test.tsx`: сторож читает форму,
 * тест читает поведение, одно без другого чинится молча.
 *
 *   node scripts/check-welcome-once.mjs          # гейт
 *   node scripts/check-welcome-once.mjs --plant  # положительный контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const OVERLAY = "src/components/profile/WelcomeOverlay.tsx";
const CABINET = "src/app/[lang]/profile/page.tsx";

/** Комментарии из рассмотрения вычёркиваются: в этом файле правило
 *  объяснено словами, и слова эти содержат и `new Date()`, и
 *  `localStorage` — сторож, читающий их, судил бы объяснение, а не код. */
export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

export function violations(overlayRaw, cabinetRaw) {
  const overlay = stripComments(overlayRaw);
  const cabinet = stripComments(cabinetRaw);
  const bad = [];

  if (/new Date\s*\(/.test(overlay) || /toISOString\s*\(/.test(overlay)) {
    bad.push(`${OVERLAY}: считает дату сам — это Гринвич, а сутки ученика считает сервер (долг 223)`);
  }
  if (!/todayKey\s*:\s*string/.test(overlay)) {
    bad.push(`${OVERLAY}: не принимает готовый \`todayKey\` — день приходит с сервера, в зоне аккаунта`);
  }
  if (!/welcomeShownValue\s*\(\s*userId\s*,\s*todayKey\s*\)/.test(overlay)) {
    bad.push(`${OVERLAY}: замок собран не из (userId, todayKey) — либо день чужой, либо чужой человек`);
  }
  if (/localStorage/.test(overlay)) {
    bad.push(`${OVERLAY}: замок снова в localStorage — выход его чистит, и приветствие придёт второй раз за день`);
  }
  if (!/WELCOME_SHOWN_COOKIE/.test(overlay) || !/document\.cookie/.test(overlay)) {
    bad.push(`${OVERLAY}: замок не в куке — переживать выход и вход ему больше нечем`);
  }
  // Разметка ИМЕННО приветствия: `todayKey` кабинет передаёт и календарю
  // занятий, и совпадение с его строкой означало бы, что сторож доволен
  // чужим местом.
  const overlayTag = /<WelcomeOverlay[\s\S]*?\/>/.exec(cabinet)?.[0] ?? "";
  if (!overlayTag) {
    bad.push(`${CABINET}: разметки <WelcomeOverlay> нет вовсе — сторож ослеп, а не доволен`);
  } else if (!/todayKey=\{todayKey\}/.test(overlayTag)) {
    bad.push(`${CABINET}: не передаёт \`todayKey\` в приветствие`);
  }
  if (!/const todayKey = dateKeyIn\(new Date\(\), timeZone\)/.test(cabinet)) {
    bad.push(`${CABINET}: \`todayKey\` считается не через dateKeyIn в зоне аккаунта — второе определение суток`);
  }
  return bad;
}

function plant() {
  const overlay = readFileSync(OVERLAY, "utf8");
  const cabinet = readFileSync(CABINET, "utf8");
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(overlay, cabinet).length === 0 }];
  const planted = (name, o, c, expect) => {
    if (o === overlay && c === cabinet) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(o, c).some((f) => f.includes(expect)) });
  };

  planted(
    "подсадка: вернуть счёт суток по Гринвичу — поймана",
    overlay.replace("const mark = welcomeShownValue(userId, todayKey);", "const mark = welcomeShownValue(userId, new Date().toISOString().slice(0, 10));"),
    cabinet,
    "считает дату сам",
  );
  planted(
    "подсадка: вернуть замок в localStorage — поймана",
    overlay.replace("document.cookie", "window.localStorage.getItem"),
    cabinet,
    "localStorage",
  );
  planted(
    "подсадка: отнять у приветствия день, посчитанный сервером — поймана",
    overlay,
    cabinet.replace(/(<WelcomeOverlay[\s\S]*?)todayKey=\{todayKey\}/, "$1"),
    "не передаёт",
  );
  planted(
    "подсадка: кабинет считает день мимо dateKeyIn — поймана",
    overlay,
    cabinet.replace("const todayKey = dateKeyIn(new Date(), timeZone)", "const todayKey = new Date().toISOString().slice(0, 10)"),
    "второе определение суток",
  );

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:welcome-once --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violations(readFileSync(OVERLAY, "utf8"), readFileSync(CABINET, "utf8"));
  if (bad.length) {
    console.error("ПРИВЕТСТВИЕ ДНЯ СНОВА МОЖЕТ ПРИЙТИ ДВАЖДЫ (долг 223):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("[check:welcome-once] сутки считает сервер в зоне аккаунта, замок — кука и переживает выход (контроль — --plant).");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
