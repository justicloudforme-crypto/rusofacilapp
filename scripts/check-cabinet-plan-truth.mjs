/**
 * КАБИНЕТ ГОВОРИТ О ПЛАНЕ ОДНО И ТО ЖЕ НА ВСЕХ СВОИХ ВКЛАДКАХ
 * (заход 7.202, части 2, 3 и 5).
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО — ТРИ НАХОДКИ С ЖИВОГО ТЕЛЕФОНА, 16.09.2026
 * ====================================================================
 *
 * ЧАСТЬ 2. У сотрудника (роль `admin`/`owner`, строк `Subscription` ноль)
 * на вкладке «Обзор» внизу стояло «Подписка — Бесплатный план», а на
 * вкладке «Подписка» — «Полный доступ». Одна страница, один человек, две
 * взаимоисключающие надписи.
 *
 * Причина не в опечатке. Долг 221 (7.200) завёл признак `staffAccess` и
 * применил его РОВНО В ОДНОМ месте — в бейдже вкладки «Подписка».
 * Обзорный бейдж остался на прежнем правиле, у которого выбор был из
 * трёх (пожизненный / активная подписка / иначе «бесплатный»), и роли в
 * этом выборе не было вовсе. Тот же признак не спрашивала и кнопка
 * «Открыть всё» под этим бейджем.
 *
 * ЧАСТЬ 3. Блок «Код доступа» предлагался сотруднику с полным доступом.
 * Предложение неисполнимо по построению: `redeemAccessCode`
 * (`src/lib/access-code.ts`) отказывает при `tier !== "free"`.
 *
 * ЧАСТЬ 5. Прогресс значков серии печатался числом ЛУЧШЕЙ серии под
 * подписью, говорящей про дни подряд, — и расходился с приветствием,
 * которое печатает ТЕКУЩУЮ. Замерено: у двух аккаунтов числители 5 и 10
 * совпали с `longestStreak` знак в знак и не совпали с `currentStreak`
 * (3 и 5). Правкой выбрана подпись, а не число: выдаёт значок тот же
 * `longestStreak` (`src/lib/badges/index.ts`), и показывать в прогрессе
 * другую величину значило бы обещать не тот значок.
 *
 * ====================================================================
 * ЧТО ИМЕННО СТЕРЕЖЁТСЯ
 * ====================================================================
 *
 *   1. `staffAccess` объявлен ровно один раз и ровно тем правилом
 *      («роль сотрудника И своей активной подписки нет»).
 *   2. КАЖДЫЙ бейдж кабинета, способный сказать «плана нет» — обзорный
 *      (`subscriptionCompactFree`) и вкладочный (`statusLabels[displayStatus]`)
 *      — спрашивает `staffAccess` в своём же выражении. Строки истории
 *      платежей под это правило не попадают и не должны: они описывают
 *      ПРОШЛУЮ покупку, а не сегодняшний доступ, и судятся по своей
 *      строке (`getDisplayStatus(row)`).
 *   3. Надпись «Полный доступ» берётся из словаря (`statusStaffAccess`),
 *      а не пишется по месту, и стоит не меньше чем в двух бейджах.
 *   4. Призыв «Открыть всё» не показывается тому, у кого доступ уже по
 *      роли.
 *   5. Блок «Код доступа» стоит под общим с маршрутом погашения условием
 *      `canRedeemAccessCode(tier)` — то есть виден только аккаунту без
 *      действующего доступа (долг 228, решение владельца 16.09.2026).
 *   6. Подсказка-плейсхолдер поля кода не повторяет приставку выпуска
 *      (`scripts/generate-access-codes.ts`, DEFAULT_PREFIX) — ни в одной
 *      локали.
 *   7. Прогресс значков серии считается `longestStreak`, а подпись в
 *      ОБЕИХ локалях этот выбор называет словами.
 *
 * ====================================================================
 * ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ — НА НАСТОЯЩЕМ СТАРОМ КОДЕ
 * ====================================================================
 *
 * Первым контролем идёт не подсадка, а ЖИВОЙ файл из репозитория — тот
 * самый, на котором владелец снял все три находки (`main` на 16.09.2026,
 * коммит {@link BEFORE_FIX}). Копии лежат рядом
 * (`scripts/fixtures/before-7202/`), git — только вторым источником:
 * `actions/checkout` забирает один коммит, и истории в CI нет вовсе.
 * Расширение `.txt`, а не `.tsx`/`.json`, по той же причине, что и у
 * фикстур 7.198: копия не должна попадать под сборку и под чужих сторожей.
 *
 * Запуск:
 *   node scripts/check-cabinet-plan-truth.mjs
 *   node scripts/check-cabinet-plan-truth.mjs --plant
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const PAGE = "src/app/[lang]/profile/page.tsx";
const RU = "src/dictionaries/ru.json";
const ES = "src/dictionaries/es.json";
const GENERATOR = "scripts/generate-access-codes.ts";

const read = (path) => readFileSync(path, "utf8");

/**
 * Код без комментариев.
 *
 * Не украшение. Комментарий этого захода объясняет порядок источников и
 * называет в тексте ровно те имена, которые правило ищет; сторож,
 * читающий объяснение вместо решения, зелен на сломанном коде и красен на
 * починенном. На этом уже попадались дважды — 7.196 («имя свойства
 * засчитано за вопрос про оболочку») и 7.202, часть 1.
 */
function withoutComments(source) {
  // Только два правила, и оба нежадные. Третьего — «убрать JSX-скобки
  // вокруг комментария», `{\s*/*…*/\s*}` — здесь НЕТ, и это не забывчивость:
  // первая редакция его имела, и он съел 25 895 знаков файла разом. Открылся
  // он на `{` от обычного блока `if`, у которого следующей строкой стоит
  // документирующий комментарий, а закрылся на первом же `*/`, за которым
  // где-то дальше нашлась `}`. Пустые фигурные скобки, оставшиеся от
  // JSX-комментариев, ни одному правилу ниже не мешают.
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/**
 * Выражение одного бейджа: от `className={…STATUS_BADGE_CLASSES…}` до
 * закрывающего `</span>`.
 *
 * Границы считаются по тексту, а не по отступу: отступ в этом файле врал
 * уже дважды. Каждому вхождению `STATUS_BADGE_CLASSES` соответствует ровно
 * один бейдж, и ближайший `</span>` после него — его собственный (внутри
 * бейджей вложенных `<span>` нет; появись они — правило 2 покраснеет, и
 * это верное поведение, а не ложная тревога).
 */
function badgeRegions(code) {
  const out = [];
  let from = 0;
  for (;;) {
    const at = code.indexOf("STATUS_BADGE_CLASSES", from);
    if (at === -1) break;
    const end = code.indexOf("</span>", at);
    out.push(code.slice(at, end === -1 ? code.length : end));
    from = end === -1 ? at + 1 : end;
  }
  return out;
}

function dictValue(json, key) {
  const m = new RegExp(`"${key}":\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(json);
  return m ? m[1] : null;
}

function dictPlural(json, key) {
  const at = json.indexOf(`"${key}": {`);
  if (at === -1) return null;
  const end = json.indexOf("}", at);
  if (end === -1) return null;
  return json.slice(at, end);
}

export function judge(sources) {
  const problems = [];
  const raw = sources[PAGE];
  const code = withoutComments(raw);
  const ru = sources[RU];
  const es = sources[ES];

  // --- 1. Признак роли объявлен один раз и тем же правилом ------------
  const declarations = [...code.matchAll(/const staffAccess = ([^;]+);/g)].map((m) => m[1].trim());
  if (declarations.length === 0) {
    problems.push(`${PAGE}: признака «доступ по роли» нет вовсе — сотруднику некому сказать «Полный доступ»`);
  } else if (declarations.length > 1) {
    problems.push(
      `${PAGE}: признак «доступ по роли» объявлен ${declarations.length} раза — ` +
        `две копии правила расходятся молча, ровно так и разошлись две вкладки`,
    );
  } else if (declarations[0] !== "isStaff(user.role) && !isActive") {
    problems.push(
      `${PAGE}: правило «доступ по роли» стало «${declarations[0]}» — ` +
        `оно обязано быть «isStaff(user.role) && !isActive»: сотрудник, купивший подписку сам, ` +
        `обязан видеть свою подписку, а не роль`,
    );
  }

  // --- 2. Каждый бейдж «плана нет» спрашивает роль --------------------
  const regions = badgeRegions(code);
  if (regions.length < 2) {
    problems.push(`${PAGE}: бейджей плана найдено ${regions.length}, а их в кабинете не меньше двух`);
  }
  let guarded = 0;
  for (const region of regions) {
    const saysNoPlan =
      region.includes("dict.profile.subscriptionCompactFree") || region.includes("statusLabels[displayStatus]");
    if (!saysNoPlan) continue;
    if (!region.includes("staffAccess")) {
      const which = region.includes("dict.profile.subscriptionCompactFree") ? "обзорный" : "вкладки «Подписка»";
      problems.push(
        `${PAGE}: ${which} бейдж плана решает без роли — человеку с полным доступом по роли ` +
          `он скажет, что плана нет, и поспорит со вторым бейджем той же страницы`,
      );
      continue;
    }
    guarded++;
  }
  if (problems.length === 0 && guarded < 2) {
    problems.push(`${PAGE}: бейджей, способных сказать «плана нет», найдено ${guarded}, а их два`);
  }

  // --- 3. Надпись из словаря, и не в одном месте ----------------------
  const staffLabelUses = (code.match(/dict\.profile\.statusStaffAccess/g) ?? []).length;
  if (staffLabelUses < 2) {
    problems.push(
      `${PAGE}: надпись «Полный доступ» стоит в ${staffLabelUses} мест${staffLabelUses === 1 ? "е" : "ах"}, ` +
        `а бейджей, которым она нужна, два`,
    );
  }
  for (const [name, json] of [[RU, ru], [ES, es]]) {
    if (!dictValue(json, "statusStaffAccess")) {
      problems.push(`${name}: нет надписи statusStaffAccess — бейджу нечего печатать`);
    }
  }

  // --- 4. Призыв «Открыть всё» не показывается доступу по роли --------
  const upsell = /\{nativeShell([^}]*?)\?\s*null\s*:\s*!isActive\s*\?/.exec(code);
  if (!upsell) {
    problems.push(`${PAGE}: призыв «Открыть всё» больше не читается — правило про него проверить нечем`);
  } else if (!upsell[1].includes("staffAccess")) {
    problems.push(
      `${PAGE}: призыв «Открыть всё» показывается и тому, у кого доступ уже по роли — ` +
        `это вторая половина того же спора двух надписей`,
    );
  }

  // --- 5. Блок «Код доступа» закрыт ДЕЙСТВУЮЩИМ доступом --------------
  //
  // С 16.09.2026 (долг 228) условие не «верхний разряд», а общая с
  // маршрутом погашения функция. Подробности и вторая половина правила —
  // в `check:access-code-offer`; здесь остаётся ровно то, что кабинет
  // спрашивает именно её, а не своё выражение.
  if (!code.includes("{canRedeemAccessCode(tier) && (")) {
    problems.push(
      `${PAGE}: блок «Код доступа» показывается не по общему правилу — он обязан стоять под ` +
        `canRedeemAccessCode(tier), тем же условием, которым маршрут погашения отказывает при живом доступе`,
    );
  }

  // --- 6. Подсказка поля не повторяет приставку выпуска ---------------
  const prefix = /const DEFAULT_PREFIX = "([A-Z0-9]+)"/.exec(sources[GENERATOR] ?? "");
  if (!prefix) {
    problems.push(`${GENERATOR}: приставка выпуска кодов не читается`);
  } else {
    for (const [name, json] of [[RU, ru], [ES, es]]) {
      const placeholder = dictValue(json, "accessCodePlaceholder");
      if (placeholder === null) {
        problems.push(`${name}: подсказка поля кода доступа не читается`);
      } else if (placeholder.toUpperCase().includes(prefix[1])) {
        problems.push(
          `${name}: подсказка поля кода доступа «${placeholder}» повторяет настоящую приставку ` +
            `выпуска «${prefix[1]}» — образец кода в поле для кода это и есть раскрытие его формы`,
        );
      }
    }
  }

  // --- 7. Значки серии: число и подпись об одном ----------------------
  const streakBranch = /def\.id\.startsWith\("streak-"\)\)\s*\{([\s\S]*?)\n  \}/.exec(code);
  if (!streakBranch) {
    problems.push(`${PAGE}: прогресс значков серии не читается`);
  } else {
    if (!streakBranch[1].includes("ctx.longestStreak")) {
      problems.push(
        `${PAGE}: прогресс значков серии считается не лучшей серией — ` +
          `а выдаёт значок именно она (src/lib/badges/index.ts), и показанное перестанет обещать выданное`,
      );
    }
  }
  for (const [name, json, needle, human] of [
    [RU, ru, "лучшая серия", "лучшая серия"],
    [ES, es, "mejor racha", "mejor racha"],
  ]) {
    const forms = dictPlural(json, "badgeProgressStreak");
    if (forms === null) {
      problems.push(`${name}: подпись прогресса значков серии не читается`);
    } else if (!forms.includes(needle)) {
      problems.push(
        `${name}: подпись прогресса значков серии не называет, ЧТО это за число — ` +
          `оно про лучшую серию, а подпись читается как про текущую («${human}» в ней нет)`,
      );
    }
  }

  return problems;
}

/** `main` на 16.09.2026 — слияние PR #337, последнее до этого захода.
 *  Ровно тот код, на котором владелец снял все три находки. */
const BEFORE_FIX = "4884a6e18c7775f889b9dcd88ee8a6bf846c34cc";

/**
 * Копии старых файлов и ОТПЕЧАТОК каждой.
 *
 * ДВА ИСТОЧНИКА, И ГЛАВНЫЙ — КОПИЯ, А НЕ ИСТОРИЯ. Заплачено первым же
 * прогоном CI 16.09.2026: первая редакция считала историю обязательной и
 * роняла прогон словами «состояние недоступно» на бегунке, у которого
 * `actions/checkout` забирает ОДИН коммит. Хуже того, она печатала при
 * этом «РАСХОЖДЕНИЕ» — то есть называла причиной не то, чем причина была.
 *
 * Поэтому теперь порядок такой:
 *
 *   1. Копия читается всегда и всегда же сличается со своим SHA-256,
 *      записанным здесь. Это и держит копию честной: молча подправить её
 *      под сторож нельзя — отпечаток лежит в коде сторожа, а не рядом с
 *      файлом.
 *   2. История спрашивается ТОЛЬКО если объект коммита действительно есть
 *      (`git cat-file -e <sha>^{commit}`). Нет истории — это законное
 *      состояние CI, и прогон из-за него не краснеет.
 *   3. Есть история и содержимое разошлось — вот это отказ, и он про
 *      копию, а не про бегунок.
 *
 * Имя коммита написано полными сорока знаками: короткое имя в мелком
 * клоне разрешается иначе, и ровно на этом первая редакция и запуталась.
 */
const FIXTURES = {
  [PAGE]: {
    file: "scripts/fixtures/before-7202/profile-page.before-7202.txt",
    sha256: "111cfeb3d45e1c997b46333f2a45e715b2a9238c188e0e834cec3f1755aaf7c8",
  },
  [RU]: {
    file: "scripts/fixtures/before-7202/ru.before-7202.txt",
    sha256: "aba1124cf6ebd0c6e4094cf6ff3a70afddc3fa975cfcdcd1cabc13c002dbd797",
  },
  [ES]: {
    file: "scripts/fixtures/before-7202/es.before-7202.txt",
    sha256: "f049eccd6d650d396362c493f23e6d261db54a8b8b853007c6f996605afa11fa",
  },
};

/** Есть ли в этом клоне сам коммит. В CI — нет, и это нормально. */
function historyHasBeforeFix() {
  try {
    execFileSync("git", ["cat-file", "-e", `${BEFORE_FIX}^{commit}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function fileBeforeFix(path, useHistory) {
  const { file, sha256 } = FIXTURES[path];
  let fixture;
  try {
    fixture = readFileSync(file, "utf8");
  } catch {
    console.log(`  ОТКАЗ — копии ${file} нет`);
    return null;
  }
  const actual = createHash("sha256").update(fixture, "utf8").digest("hex");
  if (actual !== sha256) {
    console.log(`  ОТКАЗ — ${file}: SHA-256 ${actual.slice(0, 12)}… вместо ${sha256.slice(0, 12)}…`);
    return null;
  }
  if (useHistory) {
    let fromGit;
    try {
      fromGit = execFileSync("git", ["cat-file", "blob", `${BEFORE_FIX}:${path}`], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      fromGit = null;
    }
    if (fromGit !== null && fromGit !== fixture) {
      console.log(`  ОТКАЗ — ${file} не совпадает с ${BEFORE_FIX.slice(0, 7)}:${path}`);
      return null;
    }
  }
  return fixture;
}

export async function main() {
  const plant = process.argv.includes("--plant");
  const sources = Object.fromEntries([PAGE, RU, ES, GENERATOR].map((f) => [f, read(f)]));

  if (plant) {
    let ok = judge(sources).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые исходники (отрицательный контроль)`);

    const useHistory = historyHasBeforeFix();
    console.log(
      `  копии сличены с SHA-256 из кода сторожа; история коммита ${BEFORE_FIX.slice(0, 7)} ` +
        `${useHistory ? "есть — сличена и она" : "в этом клоне отсутствует (обычное состояние CI), копия и есть источник"}`,
    );
    const old = Object.fromEntries([PAGE, RU, ES].map((f) => [f, fileBeforeFix(f, useHistory)]));
    if (Object.values(old).some((v) => v === null)) {
      console.log(`  ПРОПУЩЕНО — положительный контроль на старом коде не снят`);
      ok = false;
    } else {
      const found = judge({ ...sources, ...old });
      const hit = found.length > 0;
      if (!hit) ok = false;
      console.log(
        `  ${hit ? "поймано" : "ПРОПУЩЕНО"} — НАСТОЯЩИЙ код ${BEFORE_FIX.slice(0, 7)} (замер владельца снят на нём): ` +
          `${found.length} нарушени${found.length === 1 ? "е" : "й"}`,
      );
      for (const p of found) console.log(`      · ${p}`);
    }

    // Контроль самой копии: подправленная копия обязана перестать сходиться
    // с отпечатком. Без этого «копия — главный источник» держалось бы на
    // честном слове, а не на проверке.
    const tampered = createHash("sha256")
      .update(readFileSync(FIXTURES[PAGE].file, "utf8").replace("staffAccess", "чтоУгодноДругое"), "utf8")
      .digest("hex");
    const tamperCaught = tampered !== FIXTURES[PAGE].sha256;
    if (!tamperCaught) ok = false;
    console.log(
      `  ${tamperCaught ? "поймано" : "ПРОПУЩЕНО"} — подправленная копия старого кода не сходится с отпечатком`,
    );

    const plants = [
      ["обзорный бейдж снова решает без роли (состояние 7.200)",
        { [PAGE]: sources[PAGE].replace(
          "                {staffAccess ? (\n                  dict.profile.statusStaffAccess\n                ) : subscription && isActive && subscription.plan === \"lifetime\" ? (",
          "                {subscription && isActive && subscription.plan === \"lifetime\" ? (") }],
      ["признак роли объявлен второй раз — две копии правила",
        { [PAGE]: sources[PAGE].replace(
          "  const tier = await getEntitlementTierFor(user);",
          "  const staffAccess = isStaff(user.role);\n  const tier = await getEntitlementTierFor(user);") }],
      ["правило роли ослаблено до одной только роли",
        { [PAGE]: sources[PAGE].replace(
          "const staffAccess = isStaff(user.role) && !isActive;",
          "const staffAccess = isStaff(user.role);") }],
      ["надпись «Полный доступ» осталась в одном месте",
        { [PAGE]: sources[PAGE].replace(
          "                {staffAccess ? (\n                  dict.profile.statusStaffAccess\n                ) : subscription",
          "                {staffAccess ? (\n                  dict.profile.subscriptionCompactFree\n                ) : subscription") }],
      ["призыв «Открыть всё» вернулся к доступу по роли",
        { [PAGE]: sources[PAGE].replace(
          "{nativeShell || staffAccess ? null : !isActive ? (", "{nativeShell ? null : !isActive ? (") }],
      ["блок «Код доступа» снова показывается всем",
        { [PAGE]: sources[PAGE].replace("        {canRedeemAccessCode(tier) && (\n        <>\n", "        <>\n") }],
      ["блок «Код доступа» вернулся к верхнему разряду (состояние 7.202) — standard снова видит поле",
        { [PAGE]: sources[PAGE].replace("      {canRedeemAccessCode(tier) && (", "      {!isPremiumUser && (") }],
      ["подсказка поля снова печатает настоящую приставку выпуска (ru)",
        { [RU]: sources[RU].replace(
          '"accessCodePlaceholder": "Введите код из приглашения"', '"accessCodePlaceholder": "AMIGO-0000-0000"') }],
      ["подсказка поля снова печатает настоящую приставку выпуска (es)",
        { [ES]: sources[ES].replace(
          '"accessCodePlaceholder": "Escribe el código de tu invitación"',
          '"accessCodePlaceholder": "amigo-0000-0000"') }],
      ["прогресс значков серии посчитан текущей серией, а выдаёт значок лучшая",
        { [PAGE]: sources[PAGE].replace(
          "    const current = Math.min(ctx.longestStreak, threshold);\n    return {\n      ratio: ctx.longestStreak / threshold,",
          "    const current = Math.min(ctx.currentStreak, threshold);\n    return {\n      ratio: ctx.currentStreak / threshold,") }],
      ["подпись прогресса серии снова молчит о том, что это лучшая серия (ru)",
        { [RU]: sources[RU].replace(/"лучшая серия: \{current\}/g, '"{current}') }],
      ["подпись прогресса серии снова молчит о том, что это лучшая серия (es)",
        { [ES]: sources[ES].replace(/"mejor racha: \{current\}/g, '"{current}') }],
    ];

    let caught = 0;
    for (const [name, patch] of plants) {
      // Подсадка обязана ИЗМЕНИТЬ исходник: `replace`, не нашедший своей
      // строки, вернул бы его как есть, и «поймано» было бы поймано на
      // здоровом коде. Ровно так сторож и становится слепым молча.
      const changed = Object.entries(patch).every(([file, text]) => text !== sources[file]);
      const found = judge({ ...sources, ...patch });
      const hit = changed && found.length > 0;
      if (hit) caught++;
      console.log(
        `  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}` +
          (hit ? ` (${found[0]})` : changed ? "" : " [подсадка НЕ ИЗМЕНИЛА файл]"),
      );
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:cabinet-plan-truth --plant — ${caught} из ${plants.length} подсадок, ` +
            `1 из 1 отрицательный контроль, 1 из 1 положительный на настоящем коде ${BEFORE_FIX.slice(0, 7)}`
        : `check:cabinet-plan-truth --plant — FAILED (${caught} из ${plants.length})`,
    );
    return ok ? 0 : 1;
  }

  const problems = judge(sources);
  if (problems.length) {
    console.error("КАБИНЕТ: ПЛАН, КОД ДОСТУПА И ЗНАЧКИ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    "check:cabinet-plan-truth — признак «доступ по роли» один на весь кабинет и спрашивается обоими " +
      "бейджами плана; надпись «Полный доступ» берётся из словаря; призыв «Открыть всё» не показывается " +
      "тому, у кого доступ по роли; блок «Код доступа» стоит под общим с маршрутом условием, а его подсказка " +
      "не повторяет приставку выпуска; прогресс значков серии считается лучшей серией, и подпись в обеих " +
      "локалях это называет. Контроль — --plant.",
  );
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
