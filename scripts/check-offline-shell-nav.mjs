/**
 * ПЕРЕХОД НА КАРКАС В ПРОБАХ — СТОРОЖ ЗАХОДА 7.233, ЗАДАЧА 2.
 *
 * ====================================================================
 * ЗАЧЕМ ОТДЕЛЬНОЕ ПРАВИЛО, ЕСЛИ ЭТО «ВСЕГО ЛИШЬ ПРОБА»
 * ====================================================================
 *
 * Потому что цена этой небрежности уже заплачена дважды за один вечер:
 * CI на #413 (запуск #1125) уронил `offline-saved-rows.spec.ts:106` три
 * раза из трёх, а на main тот же тест в тот же вечер прошёл только со
 * второй попытки. Оба раза — на ПОЗИТИВНОМ контроле, то есть проба
 * говорила «продукт сломан» там, где сломана была она сама.
 *
 * ПРИЧИНА, ДОКАЗАННАЯ ПРОГОНОМ (`.run7233b/probe.mjs`, 28.09.2026, три
 * прогона из трёх, и те же три на коде ДО #412):
 *
 *     page.goto: Navigation to ".../es" is interrupted by another
 *                navigation to ".../es/vocabulary"
 *
 * `context.setOffline(true)` заставляет ЖИВУЮ страницу перейти на саму
 * себя, и переход пробы, сделанный сразу после, отменяется. Проба
 * оказывается на ЧУЖОМ адресе, каркас честно показывает копию той
 * страницы, а списка на экране копии нет — и ждать его бессмысленно.
 * Разделено замером: снятие воркера БЕЗ выключения сети переход не
 * отменяет ни разу, выключение сети БЕЗ снятия воркера — отменяет.
 *
 * ====================================================================
 * ПРАВИЛО, КОТОРОЕ ЗДЕСЬ ДЕРЖИТСЯ
 * ====================================================================
 *
 * Если проба ждёт разметку КАРКАСА (`[data-saved…`, `[data-downloads…`),
 * то переход, который её туда привёл, обязан идти через `reachShell`
 * (`e2e/helpers/offline-shell.ts`) — помощника, который повторяет переход,
 * пока на экране не окажется каркас ИМЕННО того адреса, о котором
 * просили. Голый `page.goto` и «сходи разок и надейся» здесь запрещены.
 *
 * Второе направление: у помощника обязан остаться ОТВЕТ, а не утверждение
 * внутри. Проба решает сама, дошла она или нет, — иначе отказ указывал бы
 * на помощника вместо продукта.
 *
 *   node scripts/check-offline-shell-nav.mjs          # гейт
 *   node scripts/check-offline-shell-nav.mjs --plant  # контроль подсадками
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const HELPER = "e2e/helpers/offline-shell.ts";
const E2E = "e2e";

/** Разметка, которая бывает ТОЛЬКО на каркасе. Копия её не несёт: каркас
 *  вырезает свои же блоки, когда показывает сохранённую страницу. */
const SHELL_MARKUP = /waitForSelector\("\[data-(saved|downloads)/;

/** Сколько строк выше ожидания считается «тем самым переходом». */
const LOOK_BACK = 8;

function specFiles() {
  return readdirSync(E2E)
    .filter((name) => name.endsWith(".spec.ts"))
    .map((name) => join(E2E, name))
    .sort();
}

export function violations(sources) {
  const bad = [];

  const helper = sources[HELPER] ?? "";
  if (!helper.trim()) {
    bad.push(`${HELPER}: помощника перехода на каркас нет вовсе — правилу не на что опереться`);
    return bad;
  }
  // Помощник обязан ПОВТОРЯТЬ переход и сверять, что это каркас нужного
  // адреса. Одного `goto` мало: именно он и терялся.
  if (!/for \(let attempt = 1; attempt <= attempts/.test(helper)) {
    bad.push(`${HELPER}: переход не повторяется — один отменённый переход снова уронит пробу`);
  }
  if (!/dataset\.offlineShell !== "1"/.test(helper)) {
    bad.push(`${HELPER}: помощник не сверяет, что на экране КАРКАС, — сойдёт и показанная копия чужого адреса`);
  }
  if (!/location\.pathname === want/.test(helper)) {
    bad.push(`${HELPER}: помощник не сверяет АДРЕС — каркас чужой страницы сошёл бы за нужный`);
  }
  // Утверждений внутри помощника быть не должно: отказ обязан указывать
  // на продукт, а не на помощника.
  if (/\bexpect\(/.test(helper)) {
    bad.push(`${HELPER}: в помощнике появилось утверждение — отказ пробы будет указывать на него, а не на продукт`);
  }

  for (const [file, source] of Object.entries(sources)) {
    if (!file.endsWith(".spec.ts")) continue;
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (!SHELL_MARKUP.test(lines[i])) continue;
      const back = lines.slice(Math.max(0, i - LOOK_BACK), i).join("\n");
      if (/reachShell\(/.test(back)) continue;
      bad.push(
        `${file}:${i + 1}: разметки каркаса ждут после перехода, сделанного НЕ через reachShell — ровно та гонка, что уронила CI #1125 три раза из трёх`,
      );
    }
  }
  return bad;
}

function load() {
  const out = { [HELPER]: readFileSync(HELPER, "utf8") };
  for (const file of specFiles()) out[file] = readFileSync(file, "utf8");
  return out;
}

function plant() {
  const live = load();
  const cases = [];
  cases.push({ name: "отрицательный контроль: на живых файлах молчит", ok: violations(live).length === 0 });

  const add = (name, file, mutate, expect) => {
    const mutated = { ...live, [file]: mutate(live[file]) };
    if (mutated[file] === live[file]) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(mutated).some((x) => x.includes(expect)) });
  };

  const victim = "e2e/offline-saved-rows.spec.ts";
  add(
    "подсадка: проба вернулась к голому goto перед ожиданием каркаса",
    victim,
    (s) => s.replace(/const first = await reachShell\(page, "\/es"\);/, 'await page.goto("/es");'),
    "НЕ через reachShell",
  );
  add(
    "подсадка: помощник перестал повторять переход",
    HELPER,
    (s) => s.replace("for (let attempt = 1; attempt <= attempts", "for (let attempt = 1; attempt <= 1"),
    "переход не повторяется",
  );
  add(
    "подсадка: помощник перестал сверять, что это каркас",
    HELPER,
    (s) => s.replace('if (body.dataset.offlineShell !== "1") return false;', ""),
    "не сверяет, что на экране КАРКАС",
  );
  add(
    "подсадка: помощник перестал сверять адрес",
    HELPER,
    (s) => s.replace("return location.pathname === want;", "return true;"),
    "не сверяет АДРЕС",
  );
  add(
    "подсадка: в помощника уехало утверждение",
    HELPER,
    (s) => s.replace("if (here) return", "if (here) expect(here).toBe(true), return"),
    "появилось утверждение",
  );

  for (const c of cases) {
    console.log(`  ${c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО"} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(
    ok
      ? `check:offline-shell-nav --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль`
      : "check:offline-shell-nav --plant — FAILED",
  );
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(load());
  if (bad.length) {
    console.error(`check:offline-shell-nav — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  const specs = specFiles().length;
  console.log(
    `check:offline-shell-nav — 5 правил, проб просмотрено ${specs}, нарушений 0 (заход 7.233: переход на каркас не теряется)`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
