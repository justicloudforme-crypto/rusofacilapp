// Сводка таблицы долгов считается СКРИПТОМ по самой таблице.
// Состояние читается ПО НАЧАЛУ ячейки состояния, а не поиском слова где
// угодно: у №70 и №89 внутри текста есть «ЗАКРЫТА» про половину, а сами
// они открыты — счёт по вхождению слова соврал бы.
//
// СУММА КАТЕГОРИЙ ОБЯЗАНА СХОДИТЬСЯ С ЧИСЛОМ СТРОК, и это теперь не
// печатается справочно, а ПРОВЕРЯЕТСЯ: скрипт выходит с кодом 1, если
// открытых + закрытых + снятых ≠ строк. Повод: 09.09.2026 сводка
// «105 строк, 60 открытых, 44 закрытых» читалась как потерянная строка —
// на деле третья категория печаталась, а не терялась (единственная снятая
// строка — долг 36, «СНЯТ 31.08.2026 как несуществующий», PROGRESS.md:29972).
// Пересчёт подтвердил 60 + 44 + 1 = 105. Чтобы этот вопрос не задавался
// в третий раз, утверждение закреплено проверкой, а не прозой.
//
// ЧЕТВЁРТАЯ КАТЕГОРИЯ — «ПРАВИЛО» (18.09.2026, 7.212, решение владельца C).
// Ревизия 7.211 нашла в таблице пять строк, которые долгами не являются и
// закрыться не могут в принципе: обряд после мержа со сменой схемы (5),
// два запрета расширять фикстуры (21, 25), дефект libSQL на локальном
// файле, которого нет на проде (60), и следствие политики доступа (62).
// Пока они лежали в «открытых», число открытых долгов было на пять больше
// правды и не могло упасть никогда. Теперь у них своё состояние, они
// по-прежнему СТРОКИ таблицы (значит, дыры в нумерации не появляется), но
// в счёт открытых не входят.
//
// ДВА ФАЙЛА С 15.10.2026 (7.270, разгрузка PROGRESS.md). Таблица долгов
// живёт в двух местах: открытые, «снятые» и «правила» — в разделе «Долги»
// основного PROGRESS.md, закрытые — в docs/progress-archive/debts-closed.md
// (закрыл долг — перенёс строку туда дословно). Счёт ведётся по ОБОИМ
// файлам сразу, поэтому дыра в нумерации и дубль номера ловятся через
// границу файлов. Части архива part-*.md хранят строки долгов как снимок
// на 15.10.2026 и сюда НЕ читаются — иначе каждая строка считалась бы
// дважды. Пятая и шестая проверки — раскладка: закрытая строка в основном
// файле (он снова начал бы расти) или незакрытая в архиве (открытый долг
// пропал бы из виду при чтении основного файла) — отказ.
//
// ТРЕТИЙ ФАЙЛ С 11.11.2026 (7.282, решение владельца по отчёту 7.281).
// Открытый долг в основном файле — КОРОТКАЯ строка (номер, состояние, суть
// в одну-две строки), а полная строка дословно живёт в
// docs/progress-archive/debts-open.md. Тот файл в счёт НЕ входит (иначе
// каждый открытый считался бы дважды), но сверяется: номера открытых строк
// основного файла и номера строк debts-open.md совпадают один в один, и
// закрытых там нет. Иначе полный текст долга мог бы пропасть молча — или
// остаться висеть после закрытия.
//
// АРХИВ ЗАКРЫТЫХ — ДВА ФАЙЛА С 25.11.2026 (7.308, предложение 7.307).
// debts-closed.md подошёл к пределу архива (985 131 байт при 1 000 000,
// check:progress-size), а предел не поднимается. Раздел — ПО НОМЕРУ:
// debts-closed.md держит №1–249, debts-closed-2.md — №250 и выше (и все
// новые). Счёт по-прежнему один — по всем файлам сразу. Две новые проверки:
// строка не в файле своего диапазона — отказ (иначе закрытие «на место по
// номеру» перестаёт быть однозначным и первый файл снова растёт), и файл
// `debts-closed*.md`, которого нет в списке CLOSED_FILES, — отказ (иначе
// третий файл, заведённый без правки скрипта, выпал бы из счёта молча, а
// его строки читались бы как дыры — или, хуже, их номера выдали бы снова).
//
// Контроль: `node scripts/count-debts.mjs --plant`.
import { readFileSync, readdirSync } from "node:fs";
const PLANT = process.argv.includes("--plant");
const MAIN = "PROGRESS.md";
const ARCHIVE_DIR = "docs/progress-archive";
/** Архив закрытых по диапазонам номеров (7.308). Новый файл — сюда же. */
const CLOSED_FILES = [
  { path: `${ARCHIVE_DIR}/debts-closed.md`, from: 1, to: 249 },
  { path: `${ARCHIVE_DIR}/debts-closed-2.md`, from: 250, to: Infinity },
];
const CLOSED = CLOSED_FILES.map((f) => f.path).join(" + ");
const readClosed = () => CLOSED_FILES.map((f) => ({ ...f, text: readFileSync(f.path, "utf8") }));
/** Строки, лежащие не в файле своего диапазона: [{ n, file }]. */
function outOfRange(parts) {
  const bad = [];
  for (const f of parts) {
    for (const r of collect(f.text)) if (r.n < f.from || r.n > f.to) bad.push({ n: r.n, file: f.path });
  }
  return bad;
}
/** Файлы debts-closed*.md в папке архива, которых нет в CLOSED_FILES. */
function unlisted(names) {
  const listed = CLOSED_FILES.map((f) => f.path.slice(ARCHIVE_DIR.length + 1));
  return names.filter((n) => /^debts-closed.*\.md$/.test(n) && !listed.includes(n));
}
const OPEN_FULL = "docs/progress-archive/debts-open.md";
// Явный аргумент — старый режим «один файл» (для разовых сверок).
const ONLY = PLANT ? null : (process.argv[2] ?? null);
// Разбор идёт по ТЕКСТУ, а не по имени файла, и это не украшение: тест
// src/lib/entry-point.test.ts запрещает скрипту писать файлы на импорте, а
// подсадке нужен изменённый вариант таблицы. Вариант живёт в памяти —
// временных файлов не создаётся вовсе. Поймано CI, а не локальным
// прогоном: `npm run verify` юнит-тесты не запускает, их гоняет только CI.
function collect(text) {
const rows = [];
for (const line of text.split("\n")) {
  const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]*)\|/);
  if (!m) continue;
  const n = +m[1];
  const state = m[2].replace(/\*\*/g, "").trim().toLowerCase();
  // только строки таблицы долгов: у неё состояние начинается с «открыт»,
  // «закрыт» или «снят»
  // Граница слова обязательна: без неё «закрытие вкладки» из совсем
  // другой таблицы читается как «закрыт» — поймано контролем ДО.
  if (!/^(открыт|открыта|закрыт|закрыта|снят|снята|правило)(?![а-яё])/.test(state)) continue;
  rows.push({ n, state });
}
return rows;
}
function misplaced(mainText, closedText) {
  const inMain = collect(mainText).filter((r) => r.state.startsWith("закрыт")).map((r) => r.n);
  const inClosed = collect(closedText).filter((r) => !r.state.startsWith("закрыт")).map((r) => r.n);
  return { inMain, inClosed };
}
/** Короткие открытые строки основного файла ↔ полные строки debts-open.md. */
function openSync(mainText, openText) {
  const short = collect(mainText).filter((r) => r.state.startsWith("открыт")).map((r) => r.n);
  const full = collect(openText);
  const fullNums = full.map((r) => r.n);
  return {
    short: short.length,
    full: full.length,
    noFull: short.filter((n) => !fullNums.includes(n)),
    noShort: fullNums.filter((n) => !short.includes(n)),
    notOpen: full.filter((r) => !r.state.startsWith("открыт")).map((r) => r.n),
    dupes: fullNums.filter((x, i) => fullNums.indexOf(x) !== i),
  };
}
const syncOk = (o) => !o.noFull.length && !o.noShort.length && !o.notOpen.length && !o.dupes.length && o.short > 0;

function summarise(rows) {
  const open = rows.filter((r) => r.state.startsWith("открыт"));
  const closed = rows.filter((r) => r.state.startsWith("закрыт"));
  const dropped = rows.filter((r) => r.state.startsWith("снят"));
  const rules = rows.filter((r) => r.state.startsWith("правило"));
  const nums = rows.map((r) => r.n);
  const dupes = nums.filter((x, i) => nums.indexOf(x) !== i);
  const max = nums.length ? Math.max(...nums) : 0;
  const holes = [];
  for (let i = 1; i <= max; i++) if (!nums.includes(i)) holes.push(i);
  const sum = open.length + closed.length + dropped.length + rules.length;
  return { rows, open, closed, dropped, rules, dupes, holes, sum, balanced: sum === rows.length };
}

function print(s) {
  console.log(
    `строк ${s.rows.length}, открытых ${s.open.length}, закрытых ${s.closed.length}, ` +
      `снятых ${s.dropped.length}, правил ${s.rules.length}, сумма ${s.sum}, ` +
      `дублей ${s.dupes.length}${s.dupes.length ? " (" + s.dupes.join(",") + ")" : ""}, ` +
      `дыр ${s.holes.length}${s.holes.length ? " (" + s.holes.join(",") + ")" : ""}`,
  );
  console.log(
    `  из них открытых частично: ${s.open.filter((r) => r.state.includes("частично")).map((r) => r.n).join(", ")}`,
  );
  console.log(`  снятых поимённо: ${s.dropped.map((r) => r.n).join(", ") || "нет"}`);
  console.log(`  правил поимённо: ${s.rules.map((r) => r.n).join(", ") || "нет"}`);
  console.log(
    s.balanced
      ? `  сумма категорий сходится с числом строк: ${s.open.length} + ${s.closed.length} + ${s.dropped.length} + ${s.rules.length} = ${s.rows.length}`
      : `  СУММА НЕ СХОДИТСЯ: ${s.open.length} + ${s.closed.length} + ${s.dropped.length} + ${s.rules.length} = ${s.sum}, а строк ${s.rows.length} — ${Math.abs(s.rows.length - s.sum)} строк(и) не названы ни одной категорией`,
  );
}

if (PLANT) {
  // Подсадка: строка таблицы в состоянии, которого счётчик не знает.
  // Именно так и выглядела бы «потерянная строка», о которой шёл спор.
  const mainText = readFileSync(MAIN, "utf8");
  const closedParts = readClosed();
  const closedText = closedParts.map((f) => f.text).join("\n");
  const body = mainText + "\n" + closedText;
  const healthyRange = outOfRange(closedParts);
  const healthyUnlisted = unlisted(readdirSync(ARCHIVE_DIR));
  if (healthyRange.length || healthyUnlisted.length) {
    console.log(`  ЛОЖНО КРАСНЫЙ — архив закрытых: не в своём файле ${JSON.stringify(healthyRange)}, вне списка ${healthyUnlisted.join(", ")}`);
  }
  const healthy = summarise(collect(body));
  const place = misplaced(mainText, closedText);
  if (place.inMain.length || place.inClosed.length) {
    console.log(`  ЛОЖНО КРАСНЫЙ — раскладка здоровых файлов: закрытых в основном ${place.inMain.length}, незакрытых в архиве ${place.inClosed.length}`);
  }
  let ok = healthy.balanced;
  console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровая таблица (отрицательный контроль)`);

  // 1. состояние вне трёх категорий: строка исчезает из счёта совсем
  const s1 = summarise(collect(body.replace("| 36 | **СНЯТ", "| 36 | **отложен")));
  const caught1 = !s1.balanced || s1.rows.length !== healthy.rows.length;
  console.log(
    `  ${caught1 ? "поймано" : "ПРОПУЩЕНО"} — единственная снятая строка переименована в состояние вне трёх категорий ` +
      `(строк ${s1.rows.length} против ${healthy.rows.length})`,
  );

  // 2. прямой разлад суммы: подделываем счёт через дубль номера
  const s2 = summarise([...collect(body), { n: 999, state: "неведомо" }]);
  const caught2 = !s2.balanced;
  console.log(`  ${caught2 ? "поймано" : "ПРОПУЩЕНО"} — строка с неизвестным состоянием в наборе: сумма ${s2.sum} против строк ${s2.rows.length}`);

  // 3. Правило, названное открытым долгом: число открытых обязано вырасти.
  //    Ровно так таблица и выглядела до 18.09.2026, и ровно так «открытых
  //    109» было на пять больше правды.
  const s3 = summarise(collect(body.replace("| 5 | правило", "| 5 | открыт,")));
  const caught3 = s3.open.length === healthy.open.length + 1 && s3.rules.length === healthy.rules.length - 1;
  console.log(
    `  ${caught3 ? "поймано" : "ПРОПУЩЕНО"} — правило, названное открытым долгом ` +
      `(открытых ${s3.open.length} против ${healthy.open.length}, правил ${s3.rules.length} против ${healthy.rules.length})`,
  );

  // 4. Правил не должно быть ноль: если их счёт молчит, четвёртая
  //    категория не проверяется вовсе.
  const caught4 = healthy.rules.length > 0;
  console.log(`  ${caught4 ? "поймано" : "ПРОПУЩЕНО"} — категория «правило» в таблице ЕСТЬ (правил ${healthy.rules.length}), иначе её счёт ничего не значит`);

  // 5 и 6. ДОЛГ 165: дыра в нумерации и задвоенный номер обязаны РОНЯТЬ
  //    прогон, а не только печататься. Подсаживаются в тот же текст:
  //    у здоровой таблицы дыр 0 и дублей 0, значит любая находка здесь —
  //    заслуга подсадки, а не фона.
  const lowest = Math.min(...healthy.rows.map((r) => r.n));
  const s5 = summarise(healthy.rows.filter((r) => r.n !== lowest + 1));
  const caught5 = s5.holes.length === 1 && s5.holes[0] === lowest + 1;
  console.log(
    `  ${caught5 ? "поймано" : "ПРОПУЩЕНО"} — строка долга ${lowest + 1} убрана из таблицы: дыр ${s5.holes.length} ` +
      `против ${healthy.holes.length} у здоровой (гейт кодом выхода, долг 165)`,
  );

  const s6 = summarise([...healthy.rows, { n: lowest, state: "открыт" }]);
  const caught6 = s6.dupes.length === 1 && s6.dupes[0] === lowest;
  console.log(
    `  ${caught6 ? "поймано" : "ПРОПУЩЕНО"} — номер ${lowest} выдан дважды: дублей ${s6.dupes.length} ` +
      `против ${healthy.dupes.length} у здоровой (гейт кодом выхода, долг 165)`,
  );

  // 7 и 8. Раскладка по двум файлам (7.270): закрытая строка, оставленная
  //    в основном файле, и открытая, уехавшая в архив закрытых.
  const firstClosed = collect(closedText)[0];
  const firstOpen = collect(mainText).find((r) => r.state.startsWith("открыт"));
  const closedLine = closedText.split("\n").find((l) => new RegExp(`^\\|\\s*${firstClosed.n}\\s*\\|`).test(l));
  const openLine = mainText.split("\n").find((l) => new RegExp(`^\\|\\s*${firstOpen.n}\\s*\\|`).test(l));
  const p7 = misplaced(mainText + "\n" + closedLine, closedText.replace(closedLine, ""));
  const caught7 = p7.inMain.length === 1 && p7.inMain[0] === firstClosed.n;
  console.log(`  ${caught7 ? "поймано" : "ПРОПУЩЕНО"} — закрытая строка ${firstClosed.n} оставлена в основном файле`);
  const p8 = misplaced(mainText.replace(openLine, ""), closedText + "\n" + openLine);
  const caught8 = p8.inClosed.length === 1 && p8.inClosed[0] === firstOpen.n;
  console.log(`  ${caught8 ? "поймано" : "ПРОПУЩЕНО"} — открытая строка ${firstOpen.n} уехала в архив закрытых`);

  // 9–11. Полный текст открытых (7.282): пропала полная строка, осталась
  //    полная строка закрытого долга, закрытая строка в debts-open.md.
  const openText = readFileSync(OPEN_FULL, "utf8");
  const healthySync = openSync(mainText, openText);
  if (!syncOk(healthySync)) console.log(`  ЛОЖНО КРАСНЫЙ — сверка debts-open.md на здоровых файлах: ${JSON.stringify(healthySync)}`);
  const fullLine = openText.split("\n").find((l) => new RegExp(`^\\|\\s*${firstOpen.n}\\s*\\|`).test(l));
  const o9 = openSync(mainText, openText.replace(fullLine, ""));
  const caught9 = o9.noFull.length === 1 && o9.noFull[0] === firstOpen.n;
  console.log(`  ${caught9 ? "поймано" : "ПРОПУЩЕНО"} — полная строка открытого долга ${firstOpen.n} пропала из ${OPEN_FULL}`);
  const o10 = openSync(mainText.replace(openLine, ""), openText);
  const caught10 = o10.noShort.length === 1 && o10.noShort[0] === firstOpen.n;
  console.log(`  ${caught10 ? "поймано" : "ПРОПУЩЕНО"} — долг ${firstOpen.n} убран из основного файла, а полная строка осталась`);
  const o11 = openSync(mainText, openText + "\n" + closedLine);
  const caught11 = o11.notOpen.includes(firstClosed.n);
  console.log(`  ${caught11 ? "поймано" : "ПРОПУЩЕНО"} — закрытая строка ${firstClosed.n} попала в ${OPEN_FULL}`);

  // 12 и 13. Архив закрытых в двух файлах (7.308): строка второго файла
  //    переложена в первый; лишний файл debts-closed-3.md вне списка.
  const [p1, p2] = closedParts;
  const moved = collect(p2.text)[0];
  const movedLine = p2.text.split("\n").find((l) => new RegExp(`^\\|\\s*${moved.n}\\s*\\|`).test(l));
  const r12 = outOfRange([{ ...p1, text: p1.text + "\n" + movedLine }, { ...p2, text: p2.text.replace(movedLine, "") }]);
  const caught12 = r12.length === 1 && r12[0].n === moved.n && r12[0].file === p1.path;
  console.log(`  ${caught12 ? "поймано" : "ПРОПУЩЕНО"} — закрытая строка ${moved.n} переложена в ${p1.path} (её диапазон — ${p2.from}+)`);
  const u13 = unlisted([...readdirSync(ARCHIVE_DIR), "debts-closed-3.md"]);
  const caught13 = u13.length === 1 && u13[0] === "debts-closed-3.md";
  console.log(`  ${caught13 ? "поймано" : "ПРОПУЩЕНО"} — файл debts-closed-3.md заведён, а в CLOSED_FILES не вписан`);

  ok &&= !place.inMain.length && !place.inClosed.length && syncOk(healthySync) && !healthyRange.length && !healthyUnlisted.length;
  ok &&= caught1 && caught2 && caught3 && caught4 && caught5 && caught6 && caught7 && caught8 && caught9 && caught10 && caught11 && caught12 && caught13;
  console.log(ok ? "count:debts --plant — 13 из 13 подсадок, 1 из 1 отрицательный контроль" : "count:debts --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
} else {
  const mainText = ONLY ? readFileSync(ONLY, "utf8") : readFileSync(MAIN, "utf8");
  const closedParts = ONLY ? [] : readClosed();
  const closedText = closedParts.map((f) => f.text).join("\n");
  const s = summarise(collect(mainText + "\n" + closedText));
  print(s);
  if (!ONLY) {
    const place = misplaced(mainText, closedText);
    console.log(
      `  файлы: ${MAIN} — ${collect(mainText).length} строк, ` +
        closedParts.map((f) => `${f.path} (№${f.from}–${f.to === Infinity ? "…" : f.to}) — ${collect(f.text).length} строк`).join(", "),
    );
    const range = outOfRange(closedParts);
    if (range.length) {
      console.error(
        `count:debts — ОТКАЗ: строки архива закрытых не в файле своего диапазона: ` +
          range.map((r) => `${r.n} в ${r.file}`).join(", ") +
          `.\n  Раздел по номеру (7.308): ${CLOSED_FILES.map((f) => `${f.path} — №${f.from}–${f.to === Infinity ? "…" : f.to}`).join("; ")}.`,
      );
      process.exitCode = 1;
    }
    const extra = unlisted(readdirSync(ARCHIVE_DIR));
    if (extra.length) {
      console.error(
        `count:debts — ОТКАЗ: файлы архива закрытых вне счёта: ${extra.join(", ")}.\n` +
          `  Новый файл архива — вписать в CLOSED_FILES в scripts/count-debts.mjs с диапазоном номеров.`,
      );
      process.exitCode = 1;
    }
    if (place.inMain.length) {
      console.error(
        `count:debts — ОТКАЗ: закрытые строки в ${MAIN}: ${place.inMain.join(", ")}.\n` +
          `  Закрыл долг — перенеси строку дословно в ${CLOSED} на место по номеру.`,
      );
      process.exitCode = 1;
    }
    const sync = openSync(mainText, readFileSync(OPEN_FULL, "utf8"));
    console.log(`  полный текст открытых: ${OPEN_FULL} — ${sync.full} строк, коротких открытых в ${MAIN} — ${sync.short}`);
    if (!syncOk(sync)) {
      console.error(
        `count:debts — ОТКАЗ: ${MAIN} и ${OPEN_FULL} разошлись: без полной строки ${sync.noFull.join(", ") || "—"}; ` +
          `полная без короткой ${sync.noShort.join(", ") || "—"}; не открытые в ${OPEN_FULL} ${sync.notOpen.join(", ") || "—"}; ` +
          `дубли ${sync.dupes.join(", ") || "—"}.\n` +
          `  Новый долг — две строки (короткая здесь, полная там); закрыл — полную строку дословно в ${CLOSED}, короткую удалить.`,
      );
      process.exitCode = 1;
    }
    if (place.inClosed.length) {
      console.error(
        `count:debts — ОТКАЗ: незакрытые строки в ${CLOSED}: ${place.inClosed.join(", ")}.\n` +
          `  Открытые, «снятые» и «правила» живут в разделе «Долги» ${MAIN}.`,
      );
      process.exitCode = 1;
    }
  }
  if (!s.balanced) {
    console.error(
      "count:debts — ОТКАЗ: сумма категорий не сходится с числом строк таблицы долгов.\n" +
        "  Строка состояния каждого долга обязана начинаться с «открыт», «закрыт», «снят» или «правило».",
    );
    process.exitCode = 1;
  }
  /**
   * ДОЛГ 165. Дыра в нумерации и дубль номера РОНЯЮТ прогон, а не просто
   * печатаются.
   *
   * Строка долга: «`npm run count:debts` печатает дыры в нумерации, но
   * кодом выхода их не гейтит (проверено: код выхода 0 при дыре) […]
   * Сам сторож остаётся не-гейтом: сторож, который печатает проблему и
   * не падает, ловит её только если её кто-то прочитал».
   *
   * Цена бездействия измерена самим долгом: строка 153 полтора захода не
   * попадала в счёт вовсе, и все числа долгов с 7.184 занижали открытые
   * на единицу. Печать об этом была — читателя у печати не было.
   *
   * Почему это отдельная проверка, а не часть `balanced`: сумма
   * категорий может сходиться идеально и при пропущенном номере (строку
   * просто не завели), и при задвоенном (две строки про одно и то же).
   * Это разные поломки, и обе молчали.
   */
  if (s.holes.length) {
    console.error(
      `count:debts — ОТКАЗ: в нумерации долгов дыр ${s.holes.length}: ${s.holes.join(", ")}.\n` +
        "  Номер без строки означает потерянный долг: либо строка выпала, либо номер выдан и не использован.",
    );
    process.exitCode = 1;
  }
  if (s.dupes.length) {
    console.error(
      `count:debts — ОТКАЗ: номера задвоены ${s.dupes.length} раз: ${s.dupes.join(", ")}.\n` +
        "  Два долга под одним номером считаются как один, и закрытие одного закрывает оба на бумаге.",
    );
    process.exitCode = 1;
  }
}
