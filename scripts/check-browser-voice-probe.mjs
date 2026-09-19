/**
 * ЖИВАЯ ПРОБА «СИНТЕЗ НЕ ЗАГОВОРИЛ» СУЩЕСТВУЕТ И УМЕЕТ СЧИТАТЬ — ДОЛГ 118.
 *
 * Строка долга дословно: «факт **воспроизведения** превью в живом
 * браузере проверен одноразовым скриптом, а не тестом: `check:silent-listen`
 * читает только разметку и о том, заговорил ли кто-нибудь на самом деле,
 * не знает ничего. Замер 7.161 (прод — 1 вызов синтеза и 0 элементов
 * `<audio>`; локальная боевая сборка — 0 вызовов и играющий `0-0.mp3`)
 * повторить сегодня нечем, кроме рук → e2e, считающий вызовы
 * `speechSynthesis.speak` на закрытой странице анонимом → тогда откат в
 * синтез не сможет вернуться молча».
 *
 * ПОЧЕМУ СТОРОЖ, ЕСЛИ ЕСТЬ САМА ПРОБА. Проба живёт в `npm run test:e2e`,
 * а тот в `npm run verify` не входит (браузерный прогон — отдельное
 * задание CI со своим кэшем). Значит на пути мержа есть половина, где
 * пробу можно снести молча. Этот сторож — вторая половина: он стоит и в
 * `verify`, и в `ci.yml`, и говорит только о ФОРМЕ пробы.
 *
 * ПЯТЬ ПРАВИЛ:
 *   а) файл пробы существует;
 *   б) движок синтеза подменяется ДО первого скрипта страницы
 *      (`addInitScript`) — подмена после загрузки опоздала бы ровно на
 *      те вызовы, которые ищутся;
 *   в) считается именно `speak`, и результат сверяется с нулём;
 *   г) у пробы есть ПОЗИТИВНЫЙ КОНТРОЛЬ прибора: прямой вызов `speak` со
 *      страницы обязан сделать счётчик единицей. Без него молчащий
 *      счётчик и сломанная подмена выглядят одинаково (правило 4.1);
 *   д) проба открывает не одну поверхность: одна страница — это одна
 *      страница, а правило про продукт.
 *
 *   node scripts/check-browser-voice-probe.mjs          # гейт
 *   node scripts/check-browser-voice-probe.mjs --plant  # контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const PROBE = "e2e/no-browser-voice.spec.ts";

export function violations(src) {
  const bad = [];
  if (!src) {
    bad.push(`${PROBE}: живой пробы «синтез не заговорил» нет — долг 118 вернулся дословно`);
    return bad;
  }
  if (!/addInitScript\(/.test(src)) {
    bad.push(`${PROBE}: движок синтеза подменяется не до первого скрипта страницы — подмена опоздает ровно на искомые вызовы (долг 118)`);
  }
  if (!/__speakCalls \+= 1/.test(src) || !/speak:/.test(src)) {
    bad.push(`${PROBE}: вызовы speak не считаются — проба знает о разметке, а не о звуке (долг 118)`);
  }
  if (!/speakCalls\(page\)[\s\S]{0,200}?\)\.toBe\(0\)/.test(src)) {
    bad.push(`${PROBE}: нигде не утверждается, что вызовов синтеза ноль (долг 118)`);
  }
  if (!/new SpeechSynthesisUtterance\(/.test(src) || !/\.toBe\(1\)/.test(src)) {
    bad.push(`${PROBE}: у пробы нет позитивного контроля прибора — «ноль вызовов» и сломанная подмена читаются одинаково (правило 4.1, долг 118)`);
  }
  const surfaces = (src.match(/path: "\/[^"]+"/g) ?? []).length;
  if (surfaces < 2) {
    bad.push(`${PROBE}: поверхностей в пробе ${surfaces} — одна страница это одна страница, а правило про продукт (долг 118)`);
  }
  return bad;
}

function read() {
  try {
    return readFileSync(PROBE, "utf8");
  } catch {
    return "";
  }
}

function plant() {
  const src = read();
  const cases = [{ name: "отрицательный контроль: живая проба сегодня чиста", ok: violations(src).length === 0 }];
  const add = (name, mutated, expect) => {
    if (mutated === src) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(mutated).some((x) => x.includes(expect)) });
  };

  add("подсадка: пробы нет вовсе (состояние до 19.09.2026)", "", "живой пробы");
  add("подсадка: подмена уехала за загрузку страницы", src.replace(/addInitScript\(/g, "evaluate("), "не до первого скрипта");
  add("подсадка: счётчик перестал считать", src.replace(/__speakCalls \+= 1/g, "void 0"), "вызовы speak не считаются");
  add("подсадка: утверждение о нуле снято", src.replace(/\)\.toBe\(0\);/g, ").toBeGreaterThanOrEqual(0);"), "вызовов синтеза ноль");
  add("подсадка: позитивный контроль прибора снят", src.replace(/new SpeechSynthesisUtterance\(/g, "String("), "позитивного контроля прибора");
  add("подсадка: осталась одна поверхность", src.replace(/\{ path: "\/es\/glossary\/caso-nominativo", what: "термин глоссария" \},\n/, ""), "поверхностей в пробе 1");

  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:browser-voice-probe --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:browser-voice-probe --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(read());
  if (bad.length) {
    console.error(`check:browser-voice-probe — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:browser-voice-probe — 5 правил, нарушений 0: живая проба считает вызовы синтеза и умеет досчитать до единицы (долг 118)");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
