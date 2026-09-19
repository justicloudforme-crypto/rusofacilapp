/**
 * КОГДА ВИДНА ПЛАВАЮЩАЯ КНОПКА TELEGRAM — ПРАВИЛО, А НЕ НАБЛЮДЕНИЕ (7.216).
 *
 * ПОВОД. 19.09.2026 владелец на ноутбуке видел разное: в обычном окне под
 * вошедшим аккаунтом (с панелью администратора) кнопки НЕТ, в окне
 * инкогнито под гостем она ЕСТЬ и ничего не накрывает. Из этого легко
 * вывести «кнопка зависит от роли» — и это было бы неправдой.
 *
 * ЧТО ИЗМЕРЕНО 19.09.2026 на живом проде, 24 замера (6 ширин × 4
 * состояния темы), `/ru`:
 *
 *   тема «reading» — кнопки НЕТ В РАЗМЕТКЕ вовсе, при любой ширине
 *                    (390, 768, 1024, 1279, 1280, 1440);
 *   без куки / light / dark — кнопка в разметке ВСЕГДА, а ВИДНА только
 *                    начиная с 1280: 1279 — не видна, 1280 — видна.
 *
 * Роль, вход и страница в условии не участвуют вовсе. Значит объяснение
 * наблюдения владельца — одно из двух: в обычном окне включена тема
 * «чтение», либо окно было уже 1280 px. Оба — настройка ОКНА, а не
 * свойство аккаунта.
 *
 * ПОЧЕМУ ГРАНИЦА 1280, А НЕ «побольше»: самая широкая колонка сайта —
 * `max-w-5xl` (1024 px). Пока окно уже 1176 px, свободного поля справа
 * на кнопку (60 px) и её отступ (16 px) не хватает, и она ложится ПОВЕРХ
 * содержимого — 19 перекрытий из 72 замеров ниже 1280 и 0 из 24 начиная
 * с 1280 (замер 7.212, долг 82). Это правило держит `check:float-overlap`;
 * здесь заперто, от чего показ зависит и от чего он не зависит.
 *
 * ПРАВИЛА:
 *   а) у кнопки есть `hidden` и `xl:flex` — то есть граница ровно `xl`;
 *   б) кнопка монтируется под условием темы `theme !== "reading"`;
 *   в) в этом условии нет ни роли, ни пользователя, ни признака входа;
 *   г) сам компонент о роли и сессии не знает ничего.
 *
 *   node scripts/check-telegram-button.mjs          # гейт
 *   node scripts/check-telegram-button.mjs --plant  # контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const BUTTON = "src/components/TelegramFloatButton.tsx";
const LAYOUT = "src/app/[lang]/layout.tsx";

export function stripComments(code) {
  return code.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

export function violations(buttonRaw, layoutRaw) {
  const button = stripComments(buttonRaw);
  const layout = stripComments(layoutRaw);
  const bad = [];

  const cls = /className="([^"]*)"/.exec(button)?.[1] ?? "";
  if (!/\bhidden\b/.test(cls)) bad.push(`${BUTTON}: у кнопки нет класса hidden — на телефоне она вернётся поверх содержимого (долг 82)`);
  if (!/\bxl:flex\b/.test(cls)) bad.push(`${BUTTON}: у кнопки нет xl:flex — граница показа уехала с 1280 px (долг 82)`);
  if (/\bsm:flex\b|\bmd:flex\b|\blg:flex\b/.test(cls)) {
    bad.push(`${BUTTON}: кнопка показывается раньше xl — ниже 1280 она ложится поверх органов управления`);
  }
  if (/role|isOwner|isAdmin|session|user\b/i.test(button)) {
    bad.push(`${BUTTON}: компонент знает про роль или сессию — показ кнопки про ТЕМУ и ШИРИНУ, и ни про что больше`);
  }

  const mount = /\{[^{}]*<TelegramFloatButton[^}]*\}/.exec(layout)?.[0] ?? "";
  if (!mount) {
    bad.push(`${LAYOUT}: разметки <TelegramFloatButton> нет вовсе — сторож ослеп, а не доволен`);
    return bad;
  }
  if (!/theme\s*!==\s*"reading"\s*&&/.test(mount)) {
    bad.push(`${LAYOUT}: кнопка монтируется не по условию темы «чтение» — правило показа изменилось молча`);
  }
  const condition = mount.slice(0, mount.indexOf("<TelegramFloatButton"));
  if (/\buser\b|\brole\b|isOwner|isAdmin|isLoggedIn|session/i.test(condition)) {
    bad.push(`${LAYOUT}: в условие показа кнопки вошли роль или вход — измерено 19.09.2026, что их там нет и быть не должно`);
  }
  return bad;
}

function plant() {
  const button = readFileSync(BUTTON, "utf8");
  const layout = readFileSync(LAYOUT, "utf8");
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(button, layout).length === 0 }];
  const add = (name, b, l, expect) => {
    if (b === button && l === layout) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(b, l).some((f) => f.includes(expect)) });
  };

  add("подсадка: вернуть границу sm (состояние до 7.212)", button.replace("xl:flex", "sm:flex"), layout, "нет xl:flex");
  add("подсадка: снять hidden", button.replace("hidden h-[60px]", "h-[60px]"), layout, "нет класса hidden");
  add("подсадка: кнопка узнала про роль", button.replace("export default function TelegramFloatButton({ label }", "export default function TelegramFloatButton({ label, role }"), layout, "знает про роль");
  add(
    "подсадка: показ привязан ко входу — ровно та версия наблюдения, что опровергнута замером",
    button,
    layout.replace('{theme !== "reading" && <TelegramFloatButton', '{theme !== "reading" && !user && <TelegramFloatButton'),
    "вошли роль или вход",
  );
  add(
    "подсадка: условие темы убрано вовсе",
    button,
    layout.replace('{theme !== "reading" && <TelegramFloatButton', "{<TelegramFloatButton"),
    "не по условию темы",
  );
  add(
    "подсадка: кнопку сняли с раскладки вовсе",
    button,
    layout.replace('{theme !== "reading" && <TelegramFloatButton label={dict.profile.telegramCta} />}', ""),
    "нет вовсе",
  );

  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:telegram-button --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:telegram-button --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(readFileSync(BUTTON, "utf8"), readFileSync(LAYOUT, "utf8"));
  if (bad.length) {
    console.error(`check:telegram-button — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:telegram-button — показ зависит от темы и ширины и ни от чего больше, нарушений 0");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
