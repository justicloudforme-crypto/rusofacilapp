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
 * 3. ОТМЕТКА БЫЛА ПРО УСТРОЙСТВО, А НЕ ПРО АККАУНТ (долг 234, 7.206).
 *    Кука живёт в одном браузере: переустановка приложения, очистка
 *    данных и второй телефон здоровались заново в тот же местный день.
 *    Правду держит колонка `User.welcomeShownDateKey`, и сторожится:
 *
 *   д) компонент принимает `greetedOnAccount` и выходит по нему ДО того,
 *      как посмотрит на куку, — иначе рубежи поменялись бы местами и
 *      смена аккаунтов A→B→A дала бы второе приветствие A;
 *   е) он сообщает серверу о показе (`WELCOME_SHOWN_ENDPOINT`);
 *   ж) кабинет считает этот признак `greetedOnAccountToday` от колонки и
 *      от того же `todayKey`;
 *   з) маршрут записи считает день САМ, тем же `dateKeyIn` в зоне
 *      аккаунта, и не берёт его из тела запроса — иначе определений суток
 *      снова стало бы два.
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
const ROUTE = "src/app/api/welcome-shown/route.ts";

/** Комментарии из рассмотрения вычёркиваются: в этом файле правило
 *  объяснено словами, и слова эти содержат и `new Date()`, и
 *  `localStorage` — сторож, читающий их, судил бы объяснение, а не код. */
export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

export function violations(overlayRaw, cabinetRaw, routeRaw = "") {
  const overlay = stripComments(overlayRaw);
  const cabinet = stripComments(cabinetRaw);
  const route = stripComments(routeRaw);
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

  // ——— ДОЛГ 234: замок про АККАУНТ ———

  if (!/greetedOnAccount\s*:\s*boolean/.test(overlay)) {
    bad.push(`${OVERLAY}: не принимает \`greetedOnAccount\` — замок снова только про устройство (долг 234)`);
  }
  // Ранний выход обязан стоять ДО чтения куки: порядок рубежей и есть
  // всё правило. Сличается тело эффекта до первого упоминания куки.
  const effect = /useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[/.exec(overlay)?.[1] ?? "";
  const beforeCookie = effect.split("document.cookie")[0] ?? "";
  if (!/if\s*\(\s*greetedOnAccount\s*\)\s*return/.test(beforeCookie)) {
    bad.push(`${OVERLAY}: \`greetedOnAccount\` не останавливает показ ДО куки — A→B→A поздоровается с A дважды`);
  }
  if (!/WELCOME_SHOWN_ENDPOINT/.test(overlay) || !/fetch\(/.test(overlay)) {
    bad.push(`${OVERLAY}: показ не сообщается серверу — записывать отметку на аккаунт будет нечем`);
  }
  if (!overlayTag) {
    // уже сказано выше
  } else if (!/greetedOnAccount=\{greetedOnAccountToday\(user\.welcomeShownDateKey,\s*todayKey\)\}/.test(overlayTag)) {
    bad.push(`${CABINET}: признак \`greetedOnAccount\` собран не из колонки и не из того же дня (долг 234)`);
  }
  if (!route) {
    bad.push(`${ROUTE}: маршрута записи отметки нет — сторож ослеп, а не доволен`);
  } else {
    if (!/dateKeyIn\(new Date\(\),\s*timeZone\)/.test(route)) {
      bad.push(`${ROUTE}: день считается не через dateKeyIn в зоне аккаунта — второе определение суток`);
    }
    if (/request\.json\(\)|await\s+request\.text\(\)/.test(route)) {
      bad.push(`${ROUTE}: день приезжает из тела запроса — браузер снова решает, какой сегодня день`);
    }
    if (!/welcomeShownDateKey:\s*todayKey/.test(route)) {
      bad.push(`${ROUTE}: отметка пишется не тем днём, который посчитан здесь же`);
    }
    if (!/catch/.test(route)) {
      bad.push(`${ROUTE}: запись не обёрнута отказом — без колонки маршрут уронил бы кабинет`);
    }
  }
  return bad;
}

function plant() {
  const overlay = readFileSync(OVERLAY, "utf8");
  const cabinet = readFileSync(CABINET, "utf8");
  const route = readFileSync(ROUTE, "utf8");
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(overlay, cabinet, route).length === 0 }];
  const planted = (name, o, c, expect) => {
    if (o === overlay && c === cabinet) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(o, c, route).some((f) => f.includes(expect)) });
  };
  const plantedRoute = (name, r, expect) => {
    if (r === route) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(overlay, cabinet, r).some((f) => f.includes(expect)) });
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

  // ——— ДОЛГ 234 ———
  planted(
    "подсадка: убрать ранний выход по отметке аккаунта — поймана",
    overlay.replace("    if (greetedOnAccount) return;\n", ""),
    cabinet,
    "не останавливает показ ДО куки",
  );
  planted(
    "подсадка: переставить рубежи — отметка аккаунта ПОСЛЕ куки — поймана",
    overlay
      .replace("    if (greetedOnAccount) return;\n", "")
      .replace("      // eslint-disable-next-line react-hooks/set-state-in-effect", "      if (greetedOnAccount) return;\n      // eslint-disable-next-line react-hooks/set-state-in-effect"),
    cabinet,
    "не останавливает показ ДО куки",
  );
  planted(
    "подсадка: перестать сообщать серверу о показе — поймана",
    overlay.replace(/\s*void fetch\(WELCOME_SHOWN_ENDPOINT[\s\S]*?\);/, ""),
    cabinet,
    "не сообщается серверу",
  );
  planted(
    "подсадка: кабинет собирает признак мимо колонки — поймана",
    overlay,
    cabinet.replace("greetedOnAccount={greetedOnAccountToday(user.welcomeShownDateKey, todayKey)}", "greetedOnAccount={false}"),
    "собран не из колонки",
  );
  plantedRoute(
    "подсадка: маршрут берёт день из тела запроса — поймана",
    route.replace("const todayKey = dateKeyIn(new Date(), timeZone);", "const todayKey = ((await request.json()) ?? {}).dateKey;"),
    "из тела запроса",
  );
  plantedRoute(
    "подсадка: маршрут пишет не тот день — поймана",
    route.replace("welcomeShownDateKey: todayKey", "welcomeShownDateKey: \"2026-01-01\""),
    "не тем днём",
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
  const bad = violations(readFileSync(OVERLAY, "utf8"), readFileSync(CABINET, "utf8"), readFileSync(ROUTE, "utf8"));
  if (bad.length) {
    console.error("ПРИВЕТСТВИЕ ДНЯ СНОВА МОЖЕТ ПРИЙТИ ДВАЖДЫ (долг 223):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("[check:welcome-once] сутки считает сервер в зоне аккаунта; главный замок — колонка аккаунта, кука — второй рубеж (контроль — --plant).");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
