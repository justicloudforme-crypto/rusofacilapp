// Значок платности пишется в ОДНОМ месте, а не пересказывается.
//
// 07.09.2026. Человек показал скриншот: на карточке рассказа стоит
// «⭐ Premium» у рассказа, который входит в обычную подписку. Значок не
// врал случайно — он печатался по колонке `Story.isPremium`, а та значит
// «не бесплатный», а не «нужен план Premium». Числом по боевой базе:
// `isPremium` истинно у 323 строк из 325, а Premium действительно нужен
// 98 из них. Рядом та же болезнь наоборот: на плитках филвордов корона
// стояла у 505 платных пазлов из 984, а у 479 `curved` её вытесняла
// звезда «режим эксперта».
//
// Лечение — то же, что в 7.110 с бесплатностью игровых рунгов: платно
// ИМЕНЕМ ПРИЗНАКА (`src/lib/access-marks.ts`), а не правилом,
// пересказанным в четырёх местах. Этот сторож держит лечение: глиф
// платности не должен появляться в разметке мимо признака.
//
// Исключения закреплены ЧИСЛОМ, как у `check:brand`: список файлов, где
// глиф значит другое (план подписки в личном кабинете, карточка цены,
// модалка пейволла, аватар, styleguide), и его длина проверяется. Новый
// файл с короной в разметке обязан либо звать признак, либо быть
// добавлен сюда руками — молча он не пройдёт.
//
// ВТОРОЕ И ТРЕТЬЕ НАПРАВЛЕНИЯ — 7.195, часть 4.
//
// Владелец 14.09.2026 потребовал развести два знака: 👑 — метка СОРТА
// материала («это премиум»), 🔒 — состояние доступа («сейчас не открыть»).
// По дороге нашлись две вещи, которые правило первого направления не
// ловило вовсе, потому что глиф в них приходил от признака честно:
//
//   2. РЕГИСТР. Плашка словаря внутри оболочки и раздел подписки в
//      кабинете несли `uppercase` и печатали «ПО ПОДПИСКЕ», а `AccessMark`
//      на соседних экранах — «По подписке». Один и тот же текст в двух
//      написаниях; владелец прочитал это как две разные метки.
//   3. МЕТКА ПРОТИВ ОРГАНА. Знак почти всегда стоит ВНУТРИ ссылки или
//      кнопки, и прибор отрисованных поверхностей читал его текст как
//      подпись органа управления («Premium» на короткой подписи кнопки без
//      адреса — нарушение). Отличить метку от органа можно только по
//      признаку в разметке, и признак этот — `data-access-mark`.
//
// Отсюда два правила: у любого места, где печатается глиф из
// `ACCESS_MARK_ICON`, разметка обязана нести `data-access-mark`; и ни один
// такой узел не имеет права нести `uppercase`.
//
//   node scripts/check-access-marks.mjs
//   node scripts/check-access-marks.mjs --plant
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const ROOT = join(process.cwd(), "src");

/** Глифы, которыми на этом сайте обозначается платность. */
const MARK_GLYPHS = ["👑", "⭐", "🔒"];

/**
 * Где глиф значит НЕ «это содержимое платное», а что-то своё.
 *
 * Каждая строка — с причиной. Длина списка закреплена ниже числом.
 */
const ALLOWED = new Map([
  ["lib/access-marks.ts", "сам признак: единственное определение глифов"],
  ["components/ui/AccessMark.tsx", "единственная разметка значка"],
  ["app/[lang]/profile/page.tsx", "корона у ПЛАНА подписки в кабинете, а не у содержимого"],
  ["components/subscription/PaywallModal.tsx", "корона у названия плана в модалке"],
  ["components/pricing/PremiumCard.tsx", "корона у названия плана на карточке цены"],
  ["components/avatars/MatryoshkaAvatar.tsx", "корона — часть рисунка матрёшки"],
  ["components/styleguide/StyleguideClient.tsx", "витрина компонентов"],
  ["lib/badges/catalog.ts", "комментарии о том, какие глифы НЕ брать под достижения"],
  ["components/ui/PremiumBadge.tsx", "старый компонент, оставлен админке"],
]);
const ALLOWED_COUNT = 9;

/** Убирает `/* … *\/`, `//…` и `{/* … *\/}` — строки остаются на местах. */
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

/**
 * Разметка узлов со знаком платности: `data-access-mark` есть, `uppercase` нет.
 *
 * Работает по ТЕКСТУ файла, а не по дереву: разбирать JSX здесь было бы
 * вторым парсером в проекте ради одной проверки. Граница названа числом —
 * берётся окно от `<` перед `ACCESS_MARK_ICON`/`data-access-mark` до
 * ближайшего `>` того же тега.
 */
export function markupProblems(rel, source) {
  const problems = [];
  const openTag = (at) => {
    const from = source.lastIndexOf("<", at);
    if (from < 0) return null;
    const to = source.indexOf(">", from);
    if (to < 0) return null;
    return source.slice(from, to + 1);
  };

  // Правило 2: `uppercase` на узле со знаком — запрещено.
  for (const needle of ["data-access-mark", "ACCESS_MARK_ICON"]) {
    let at = source.indexOf(needle);
    while (at >= 0) {
      const tag = openTag(at);
      if (tag && /\buppercase\b/.test(tag)) {
        problems.push({ rel, rule: "регистр", line: tag.replace(/\s+/g, " ").trim().slice(0, 90) });
      }
      at = source.indexOf(needle, at + 1);
    }
  }

  // Правило 3: файл печатает глиф — значит, помечает узел.
  if (/ACCESS_MARK_ICON\s*[[.]/.test(source) && !source.includes("data-access-mark")) {
    problems.push({ rel, rule: "метка без признака", line: "печатает ACCESS_MARK_ICON и не несёт data-access-mark" });
  }
  return problems;
}

/** Файлы, где `ACCESS_MARK_ICON` только объявляется или упоминается. */
const MARKUP_EXEMPT = new Set(["lib/access-marks.ts", "lib/search/types.ts"]);

function main() {
  if (ALLOWED.size !== ALLOWED_COUNT) {
    console.error(`список исключений вырос до ${ALLOWED.size} при ожидаемых ${ALLOWED_COUNT} — так и было задумано? тогда поправьте число здесь`);
    return 1;
  }
  const files = walk(ROOT);
  const offenders = [];
  const markup = [];
  let scanned = 0;
  for (const file of files) {
    const rel = relative(ROOT, file);
    scanned += 1;
    if (ALLOWED.has(rel)) {
      // Разметку исключённых файлов ВТОРОЕ и ТРЕТЬЕ правила всё равно
      // судят: исключение выдано глифу, а не регистру.
      if (!MARKUP_EXEMPT.has(rel)) markup.push(...markupProblems(rel, stripComments(readFileSync(file, "utf8"))));
      continue;
    }
    if (/\.test\.tsx?$/.test(rel)) continue;
    // Комментарии вырезаются ЦЕЛИКОМ, а не по первому знаку строки:
    // объяснение «до 07.09.2026 здесь стояла 👑» — это запись о прошлом,
    // а не разметка, и построчный фильтр ловил её вторую строку.
    const source = stripComments(readFileSync(file, "utf8"));
    if (!MARKUP_EXEMPT.has(rel)) markup.push(...markupProblems(rel, source));
    for (const glyph of MARK_GLYPHS) {
      if (!source.includes(glyph)) continue;
      const line = source.split("\n").find((l) => l.includes(glyph));
      offenders.push({ rel, glyph, line: (line ?? "").trim().slice(0, 80) });
    }
  }
  if (PLANT) {
    const results = [];
    // 1. Файл, которого в списке нет, с короной в разметке.
    const planted = { rel: "components/__planted__/Tile.tsx", glyph: "👑", line: "<span>👑</span>" };
    results.push(["чужой файл с короной в разметке", [...offenders, planted].filter((o) => !ALLOWED.has(o.rel)).length >= 1]);
    // 2. Регистр: ровно тот дефект, что стоял на экране до 7.195.
    results.push([
      "uppercase на узле со знаком — «ПО ПОДПИСКЕ» вместо «По подписке»",
      markupProblems("components/__planted__/Plate.tsx",
        '<span data-access-mark="subscription" className="text-xs uppercase tracking-wide">{ACCESS_MARK_ICON.subscription}</span>',
      ).some((p) => p.rule === "регистр"),
    ]);
    // 3. Метка без признака: прибор снова спутает её с органом управления.
    results.push([
      "глиф печатается, а data-access-mark нет",
      markupProblems("components/__planted__/Tile2.tsx", "<span>{ACCESS_MARK_ICON[mark]}</span>").some(
        (p) => p.rule === "метка без признака",
      ),
    ]);
    // ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: правильная разметка обязана пройти.
    results.push([
      "отрицательный контроль: правильная разметка чиста",
      markupProblems("components/__planted__/Ok.tsx",
        '<span data-access-mark={mark} className="text-xs font-medium">{ACCESS_MARK_ICON[mark]}</span>',
      ).length === 0,
    ]);
    for (const [name, caught] of results) console.log(`  ${caught ? "поймано" : "ПРОПУЩЕНО"}: ${name}`);
    const caught = results.filter(([, ok]) => ok).length;
    console.log(`подсажено ${results.length}, поймано ${caught} из ${results.length}`);
    console.log(`кроме подсадки нарушений: ${offenders.length + markup.length}`);
    return caught === results.length ? 0 : 1;
  }
  console.log(
    `[check:access-marks] просмотрено ${scanned} файлов, исключений ${ALLOWED.size}, нарушений по глифу ${offenders.length}, по разметке ${markup.length}`,
  );
  for (const o of offenders) console.log(`  ${o.rel}: ${o.glyph}  ${o.line}`);
  for (const m of markup) console.log(`  ${m.rel}: ${m.rule} — ${m.line}`);
  return offenders.length + markup.length ? 1 : 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exit(main());
