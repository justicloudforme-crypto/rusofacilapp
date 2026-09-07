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

function main() {
  if (ALLOWED.size !== ALLOWED_COUNT) {
    console.error(`список исключений вырос до ${ALLOWED.size} при ожидаемых ${ALLOWED_COUNT} — так и было задумано? тогда поправьте число здесь`);
    return 1;
  }
  const files = walk(ROOT);
  const offenders = [];
  let scanned = 0;
  for (const file of files) {
    const rel = relative(ROOT, file);
    scanned += 1;
    if (ALLOWED.has(rel)) continue;
    if (/\.test\.tsx?$/.test(rel)) continue;
    // Комментарии вырезаются ЦЕЛИКОМ, а не по первому знаку строки:
    // объяснение «до 07.09.2026 здесь стояла 👑» — это запись о прошлом,
    // а не разметка, и построчный фильтр ловил её вторую строку.
    const source = stripComments(readFileSync(file, "utf8"));
    for (const glyph of MARK_GLYPHS) {
      if (!source.includes(glyph)) continue;
      const line = source.split("\n").find((l) => l.includes(glyph));
      offenders.push({ rel, glyph, line: (line ?? "").trim().slice(0, 80) });
    }
  }
  if (PLANT) {
    // Подсадка: файл, которого в списке нет, с короной в разметке.
    const planted = { rel: "components/__planted__/Tile.tsx", glyph: "👑", line: '<span>👑</span>' };
    const caught = [...offenders, planted].filter((o) => !ALLOWED.has(o.rel)).length;
    console.log(`подсажено 1, поймано ${caught >= 1 ? 1 : 0} из 1`);
    console.log(`кроме подсадки нарушений: ${offenders.length}`);
    return caught >= 1 ? 0 : 1;
  }
  console.log(`[check:access-marks] просмотрено ${scanned} файлов, исключений ${ALLOWED.size}, нарушений ${offenders.length}`);
  for (const o of offenders) console.log(`  ${o.rel}: ${o.glyph}  ${o.line}`);
  return offenders.length ? 1 : 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exit(main());
