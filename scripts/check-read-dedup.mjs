#!/usr/bin/env node
/**
 * ОДНО ЧТЕНИЕ НА ЗАПРОС — СТОРОЖ, А НЕ ДОГОВОРЁННОСТЬ.
 *
 * Заход 7.222 закрыл строки долгов 284, 285, 292 и половину 295 тем, что
 * повторные чтения одной строки за один запрос убраны. Каждая из этих
 * правок снимается ОДНОЙ строкой кода, и снятие выглядит безобидно:
 * страница продолжит работать, тесты останутся зелёными, а цена вернётся
 * туда, где была, — на холодном экземпляре после выката, где её с
 * ноутбука не видно. Поэтому здесь не «проверка стиля», а четыре
 * названных правила с ценой каждого.
 *
 * ПОЧЕМУ ПО ИСХОДНИКУ. Замер числа походов требует поднятого сервера,
 * базы и полутора минут; такой сторож не ставят в `verify`, и он не
 * стоял бы. Правила ниже проверяются на тексте за миллисекунды, и каждое
 * названо так, чтобы его нельзя было выполнить формально.
 *
 *   node scripts/check-read-dedup.mjs
 *   node scripts/check-read-dedup.mjs --plant   # позитивный контроль
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC = path.join(process.cwd(), "src");

/** Комментарии вычёркиваются: эти файлы объясняют себя длинно и цитируют
 *  в прозе ровно тот код, который правило запрещает. */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/**
 * Правила. `check` получает уже очищенный от комментариев текст файла и
 * возвращает `null`, если всё хорошо, или строку с тем, что не так.
 */
export const RULES = [
  {
    file: "lib/auth.ts",
    what: "getCurrentUser читается один раз на запрос",
    cost:
      "3–4 похода `SELECT User` за одно открытие страницы вошедшим человеком " +
      "(замер 7.222: главная 3, рассказ 3, термин 3, word-games 4 — это Sentry JAVASCRIPT-NEXTJS-16)",
    check: (source) =>
      /export\s+const\s+getCurrentUser\s*=\s*cache\(/.test(source)
        ? null
        : "getCurrentUser больше не обёрнут в cache() из React",
  },
  {
    file: "app/[lang]/stories/[id]/page.tsx",
    what: "рассказ читается один раз на запрос, а не отдельно для метаданных",
    cost: "второй `SELECT Story` на каждом из 650 адресов рассказов",
    check: (source) => {
      if (!/const\s+getStoryById\s*=\s*cache\(/.test(source)) {
        return "getStoryById больше не обёрнут в cache() из React";
      }
      // Ровно ОДНО прямое чтение — то, что стоит внутри самой памятки.
      // Ноль значил бы, что читать стало нечем; два и больше — что кто-то
      // снова ходит в базу мимо неё.
      const direct = source.match(/db\.story\.findUnique\(/g) ?? [];
      if (direct.length === 0) return "чтение рассказа пропало — правило проверять стало нечем";
      return direct.length === 1
        ? null
        : `страница читает db.story.findUnique ${direct.length} раза — мимо общей памятки`;
    },
  },
  {
    file: "app/[lang]/glossary/[slug]/page.tsx",
    what: "термин читается один раз на запрос",
    cost: "второй `SELECT GlossaryTerm` и второй `SELECT AudioAsset` на каждом из 236 адресов глоссария",
    check: (source) =>
      /const\s+getTermBySlug\s*=\s*cache\(/.test(source)
        ? null
        : "getTermBySlug больше не обёрнут в cache() из React",
  },
  {
    file: "lib/flashcards/cache.ts",
    what: "озвучка банка карточек спрашивается без списка идентификаторов",
    cost:
      "один вызов findMany со списком на 5771 значение Prisma режет на ШЕСТЬ походов " +
      "(замер 7.222 на холодном экземпляре; это Sentry JAVASCRIPT-NEXTJS-V)",
    check: (source) => {
      const call = /db\.audioAsset\.findMany\(\{[\s\S]{0,400}?\}\)/.exec(source);
      if (!call) return "чтение озвучки банка пропало — правило проверять стало нечем";
      return /contentId:\s*\{\s*in:/.test(call[0])
        ? "озвучка банка снова спрашивается списком contentId — это не один поход, а шесть"
        : null;
    },
  },
  {
    file: "lib/home-stats.ts",
    what: "три среза главной берутся одним походом",
    cost:
      "три `SELECT FlashcardCard` и два `SELECT AudioAsset` за одно открытие самого посещаемого " +
      "адреса сайта (Sentry JAVASCRIPT-NEXTJS-17)",
    check: (source) => {
      if (!/const\s+homePreviewPool\s*=\s*cache\(/.test(source)) {
        return "homePreviewPool больше не обёрнут в cache() из React";
      }
      const calls = source.match(/db\.flashcardCard\.findMany\(/g) ?? [];
      return calls.length <= 1
        ? null
        : `на главной снова ${calls.length} отдельных запроса к банку вместо одного`;
    },
  },
  {
    file: "app/[lang]/stories/[id]/page.tsx",
    what: "отказ чтения клипов озвучки стоит проигрывателя, а не рассказа",
    cost: "500 на всех 650 адресах рассказов при следующей аварии квоты Turso (строка долга 295)",
    check: (source) => {
      const at = source.indexOf("db.audioAsset.findMany(");
      if (at === -1) return "чтение клипов озвучки пропало — правило проверять стало нечем";
      // Внутри ли оно какого-нибудь try — по счёту скобок, а не регуляркой.
      const header = /\btry\s*\{/g;
      let match;
      while ((match = header.exec(source))) {
        let depth = 1;
        let i = header.lastIndex;
        while (i < source.length && depth > 0) {
          if (source[i] === "{") depth++;
          else if (source[i] === "}") depth--;
          i++;
        }
        if (at > match.index && at < i) return null;
      }
      return "чтение клипов озвучки снова стоит голым — его отказ убивает всю страницу";
    },
  },
  {
    file: "app/api/flashcards/summary/route.ts",
    what: "обработчик маршрута читает вошедшего один раз",
    cost:
      "второй `SELECT User` на каждый ответ сводки; памятка cache из React до обработчика " +
      "маршрута НЕ достаёт, и это измерено, а не предположено",
    check: (source) =>
      /getEntitlementTier\s*\(\s*\)/.test(source)
        ? "маршрут снова зовёт getEntitlementTier() — это второе чтение той же строки"
        : null,
  },
];

function run() {
  let bad = 0;
  console.log("check:read-dedup — одно чтение на запрос\n");
  for (const rule of RULES) {
    const source = stripComments(readFileSync(path.join(SRC, rule.file), "utf8"));
    const problem = rule.check(source);
    if (problem) {
      bad++;
      console.log(`  ✗ ${rule.what}`);
      console.log(`      ${rule.file}: ${problem}`);
      console.log(`      цена: ${rule.cost}`);
    } else {
      console.log(`  ✓ ${rule.what}`);
    }
  }
  console.log("");
  if (bad > 0) {
    console.error(`✗ нарушено правил: ${bad} из ${RULES.length}`);
    process.exit(1);
  }
  console.log(`Все ${RULES.length} правил выполнены.`);
  process.exit(0);
}

/**
 * ПОДСАДКА. Каждому правилу подставляется НАСТОЯЩИЙ текст его файла,
 * возвращённый к состоянию до 7.222, и правило обязано покраснеть.
 * Правило, для которого подсадки нет, — это правило без доказательства,
 * поэтому список подсадок сверяется с числом правил.
 */
const PLANTS = [
  { file: "lib/auth.ts", apply: (s) => s.replace("export const getCurrentUser = cache(async () => {", "export async function getCurrentUser() {") },
  {
    file: "app/[lang]/stories/[id]/page.tsx",
    apply: (s) => s.replace("getStoryById(id),", "db.story.findUnique({ where: { id } }),"),
  },
  {
    file: "app/[lang]/glossary/[slug]/page.tsx",
    apply: (s) => s.replace("const getTermBySlug = cache(async (slug: string) => {", "async function getTermBySlug(slug: string) {"),
  },
  {
    file: "lib/flashcards/cache.ts",
    apply: (s) =>
      s.replace(
        'where: { contentType: "flashcard" },',
        'where: { contentType: "flashcard", contentId: { in: cards.map((card) => card.id) } },',
      ),
  },
  {
    file: "lib/home-stats.ts",
    apply: (s) =>
      s.replace(
        "const { cards, audioRows } = await homePreviewPool();\n    return attachNarration(sliceFromPool(cards, \"greetings\", count), audioRows);",
        'const cards = await db.flashcardCard.findMany({ where: { category: "greetings", level: "A1" }, take: count });\n    return attachNarration(cards, []);',
      ),
  },
  {
    file: "app/[lang]/stories/[id]/page.tsx",
    label: "клипы озвучки снова голые",
    apply: (s) =>
      s
        .replace("  try {\n    audioAssetRows = await db.audioAsset.findMany({", "  {\n    audioAssetRows = await db.audioAsset.findMany({")
        .replace(
          `  } catch (error) {
    console.error(
      "[stories/[id]] не удалось прочитать клипы озвучки — рассказ отдаётся без проигрывателя",
      error
    );
  }`,
          "  }",
        ),
  },
  {
    file: "app/api/flashcards/summary/route.ts",
    apply: (s) => s.replace("await getEntitlementTierFor(user)", "await getEntitlementTier()"),
  },
];

function plant() {
  let caught = 0;
  let vacuous = 0;
  console.log("check:read-dedup --plant — позитивный контроль\n");
  if (PLANTS.length !== RULES.length) {
    console.error(`✗ подсадок ${PLANTS.length}, а правил ${RULES.length}: у правила без подсадки доказательства нет`);
    process.exit(1);
  }
  for (const [index, planted] of PLANTS.entries()) {
    const original = stripComments(readFileSync(path.join(SRC, planted.file), "utf8"));
    const broken = stripComments(planted.apply(readFileSync(path.join(SRC, planted.file), "utf8")));
    const label = planted.label ?? RULES[index].what;
    if (broken === original) {
      vacuous++;
      console.log(`  ✗ ПУСТАЯ ПОДСАДКА: «${label}» не изменила ни байта`);
      continue;
    }
    // Правило берётся ТО, что сторожит этот файл и этот предмет, — по
    // номеру, потому что два правила сторожат один и тот же файл.
    const problem = RULES[index].check(broken);
    if (problem) {
      caught++;
      console.log(`  ✓ поймано: ${label}`);
    } else {
      console.log(`  ✗ НЕ ПОЙМАНО: ${label}`);
    }
  }
  console.log("");
  if (vacuous > 0) {
    console.error(`✗ пустых подсадок: ${vacuous} — сравнение «до/после» на неизменённом тексте ничего не значит`);
    process.exit(1);
  }
  if (caught !== PLANTS.length) {
    console.error(`✗ поймано ${caught} из ${PLANTS.length}`);
    process.exit(1);
  }
  // Отрицательный контроль: на живых файлах сторож обязан МОЛЧАТЬ.
  for (const rule of RULES) {
    const source = stripComments(readFileSync(path.join(SRC, rule.file), "utf8"));
    if (rule.check(source)) {
      console.error(`✗ отрицательный контроль: правило «${rule.what}» краснеет на живом файле`);
      process.exit(1);
    }
  }
  console.log(`Control passed: подсажено ${PLANTS.length}, поймано ${caught}; на живых файлах — молчит.`);
  process.exit(0);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  if (process.argv.includes("--plant")) plant();
  else run();
}
