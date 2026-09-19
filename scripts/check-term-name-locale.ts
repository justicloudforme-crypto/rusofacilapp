/**
 * ГЛАВНОЕ НАЗВАНИЕ ТЕРМИНА ЗАВИСИТ ОТ ЛОКАЛИ — ПРАВИЛО 267 (7.215).
 *
 * ЧТО СТОРОЖИТСЯ. Решение владельца от 19.09.2026, вариант Б из трёх,
 * положенных на стол заходом 7.212 (часть 3.1):
 *
 *   в локали `ru` главным названием грамматического термина печатается
 *   РУССКИЙ эквивалент, испанское название идёт второй строкой;
 *   в локали `es` — ровно наоборот.
 *
 * ЗАЧЕМ СТОРОЖ, А НЕ ПРОСТО ПРАВКА. До 7.212 правила не было записано
 * нигде, и сегодняшнее поведение было не решением, а умолчанием, дожившим
 * с первой партии глоссария. Такое умолчание один раз уже вернулось: заход
 * 7.211 снял русскую подпись с шести испанских названий, 7.212 нашёл тот же
 * предмет заново. Правило без сторожа заводится в третий раз.
 *
 * ТРИ ПОЛОВИНЫ, И КАЖДАЯ ОБЯЗАНА КРАСНЕТЬ ПО ОТДЕЛЬНОСТИ.
 *
 * 1. ПОВЕДЕНЧЕСКАЯ, ДВУСТОРОННЯЯ. Таблица терминов прогоняется через
 *    `glossaryTermNames` в ОБЕИХ локалях: на `/ru` главным обязано быть
 *    русское название, на `/es` — испанское. Односторонняя проверка тут
 *    бесполезна: «на /ru всё русское» проходит и у функции, которая
 *    отдаёт русское имя ВЕЗДЕ, а это сломало бы испанскую локаль целиком.
 *
 * 2. СТАТИЧЕСКАЯ ПО ВИТРИНАМ. Каждая витрина из поимённого списка обязана
 *    брать имя у общей функции и не имеет права печатать поле `term`
 *    напрямую. Без этой половины поведенческая проверяла бы модуль,
 *    которым никто не пользуется, — ровно так дыра долга 155 и прожила.
 *
 * 3. ДАННЫЕ. Боевое содержимое обязано давать правилу чем ответить: у
 *    термина с пустым русским эквивалентом главным останется испанское
 *    название, и молчаливой пустоты на экране не будет. Проверяется по
 *    модулю данных `prisma/glossary-terms-data.ts` — тому же, который
 *    читает `check:locale-mixing`, а не по `dev.db`: база на машине
 *    сборки расходится с продом (7.212, часть 3.1, побочная находка).
 *
 *   npx tsx scripts/check-term-name-locale.ts
 *   npx tsx scripts/check-term-name-locale.ts --plant     # позитивный контроль
 */
import { readFileSync } from "node:fs";
import { isEntryPoint } from "@/lib/entry-point";
import { glossaryTermNames, type GlossaryTermNameSource } from "@/lib/glossary-term-name";

type Names = (term: GlossaryTermNameSource, lang: string) => { primary: string; secondary: string | null };

interface Case {
  term: string;
  russianEquivalent: string;
  /** Главное имя на `/ru` и на `/es` соответственно. */
  ru: string;
  es: string;
  /** Вторая строка на `/ru`; `null` — её нет вовсе. */
  ruSecondary: string | null;
  why: string;
}

/** Строки взяты из боевой базы (SELECT 19.09.2026, 119 терминов), а не
 * придуманы: четыре обычных, одна из шести пар глаголов движения, где
 * оба поля совпадают дословно, и один искусственный случай пустого
 * русского эквивалента — на проде таких 0 из 119, но правило обязано на
 * него отвечать. */
const CASES: Case[] = [
  { term: "caso vocativo", russianEquivalent: "звательный падеж", ru: "звательный падеж", es: "caso vocativo", ruSecondary: "caso vocativo", why: "ЖАЛОБА ВЛАДЕЛЬЦА 18.09.2026: чип урока в /ru читался «caso vocativo»" },
  { term: "artículo", russianEquivalent: "артикль", ru: "артикль", es: "artículo", ruSecondary: "artículo", why: "тот же экран, второй чип" },
  { term: "género gramatical", russianEquivalent: "грамматический род", ru: "грамматический род", es: "género gramatical", ruSecondary: "género gramatical", why: "тот же экран, третий чип" },
  { term: "sustantivo", russianEquivalent: "существительное", ru: "существительное", es: "sustantivo", ruSecondary: "sustantivo", why: "тот же экран, четвёртый чип" },
  { term: "бежать / бегать", russianEquivalent: "бежать / бегать", ru: "бежать / бегать", es: "бежать / бегать", ruSecondary: null, why: "одна из ШЕСТИ пар глаголов движения: поля совпадают дословно, второй строки быть не должно" },
  { term: "artículo", russianEquivalent: "", ru: "artículo", es: "artículo", ruSecondary: null, why: "пустой русский эквивалент (0 из 119 на проде): главным остаётся испанское, дыры на экране нет" },
];

function behaviour(names: Names): string[] {
  const bad: string[] = [];
  for (const c of CASES) {
    const src = { term: c.term, russianEquivalent: c.russianEquivalent };
    const ru = names(src, "ru");
    const es = names(src, "es");
    if (ru.primary !== c.ru) bad.push(`/ru «${c.term}» → главным «${ru.primary}», ожидалось «${c.ru}» (${c.why})`);
    if (es.primary !== c.es) bad.push(`/es «${c.term}» → главным «${es.primary}», ожидалось «${c.es}» (${c.why})`);
    if (ru.secondary !== c.ruSecondary) {
      bad.push(`/ru «${c.term}» → второй строкой ${ru.secondary === null ? "<нет>" : `«${ru.secondary}»`}, ожидалось ${c.ruSecondary === null ? "<нет>" : `«${c.ruSecondary}»`} (${c.why})`);
    }
    if (es.secondary !== null) bad.push(`/es «${c.term}» → появилась вторая строка «${es.secondary}»: испанская локаль не менялась и меняться не должна`);
  }
  return bad;
}

/**
 * ВИТРИНЫ, печатающие НАЗВАНИЕ термина. Перепись 7.212 (часть 3.1) дала
 * 13 строк; здесь их одиннадцать — те, которые правку получили. Две
 * оставшиеся названы в отчёте 7.215 поимённо и с причиной:
 * `GlossaryText.tsx` печатает не имя термина, а найденное слово ПРОЗЫ, а
 * перелинковка рассказов и медиа (`getContentInsights`,
 * `getMediaGrammarLinks`) рисует свои подписи на 165 страницах `/ru`,
 * замороженных до 26.09.2026.
 */
interface Surface {
  file: string;
  what: string;
  /** Строки, которые в этом файле печатать имя больше не имеют права. */
  forbidden: RegExp[];
}

const SURFACES: Surface[] = [
  { file: "src/app/[lang]/courses/[level]/[lesson]/page.tsx", what: "чипы терминов урока (сервер)", forbidden: [/\{term\.term\}/] },
  { file: "src/components/glossary/LessonGlossaryTerms.tsx", what: "чипы терминов урока (клиент)", forbidden: [/\{term\.term\}/] },
  { file: "src/components/glossary/GlossaryTermCardBody.tsx", what: "карточка термина во всплывашке", forbidden: [/\{term\.term\}/] },
  { file: "src/components/glossary/GlossaryApp.tsx", what: "список глоссария", forbidden: [/\{term\.term\}/] },
  { file: "src/components/glossary/TermQuiz.tsx", what: "викторина по терминам", forbidden: [/\{question\.term\.term\}/, /"\{term\}",\s*question\.term\.term/] },
  { file: "src/app/[lang]/glossary/[slug]/page.tsx", what: "страница термина: h1, <title>, JSON-LD, родственные термины", forbidden: [/\{term\.term\}/, /name: term\.term/, /\$\{term\.term\}/, /\{related\.term\}/] },
  { file: "src/lib/search/records.ts", what: "выдача поиска по сайту", forbidden: [/title: term\.term,/] },
];

/** Файлы, которые обязаны СПРАШИВАТЬ общую функцию. Отдельным списком от
 * запретов: запрет ловит старый способ, а это — то, что пришло на замену.
 * Без него файл, из которого имя вырезали вовсе, прошёл бы обе проверки. */
const MUST_IMPORT = SURFACES.map((s) => s.file);

const NAME_MODULE = /from\s+"@\/lib\/glossary-term-name"/;

export function statics(read: (file: string) => string): string[] {
  const bad: string[] = [];
  for (const s of SURFACES) {
    const text = read(s.file);
    for (const re of s.forbidden) {
      if (re.test(text)) bad.push(`${s.file} — ${s.what}: печатает имя мимо правила (${re.source})`);
    }
  }
  for (const file of MUST_IMPORT) {
    if (!NAME_MODULE.test(read(file))) {
      bad.push(`${file} не берёт имя из @/lib/glossary-term-name — правило снова живёт в витрине, а не в одном месте`);
    }
  }
  return bad;
}

/** Половина третья: содержимое обязано давать правилу чем ответить. */
const DATA_MODULE = "prisma/glossary-terms-data.ts";

export function data(text: string): { bad: string[]; terms: number; empty: number; same: number } {
  const bad: string[] = [];
  // Пары «term» и «russianEquivalent» читаются из самого модуля данных.
  const terms = [...text.matchAll(/\bterm:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  const equivalents = [...text.matchAll(/\brussianEquivalent:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  if (terms.length === 0) bad.push(`${DATA_MODULE}: не прочитано ни одного термина — разбор сломан, а не данные пусты`);
  if (terms.length !== equivalents.length) {
    bad.push(`${DATA_MODULE}: терминов ${terms.length}, русских эквивалентов ${equivalents.length} — у кого-то поля нет вовсе`);
  }
  let empty = 0;
  let same = 0;
  for (let i = 0; i < Math.min(terms.length, equivalents.length); i += 1) {
    const names = glossaryTermNames({ term: terms[i], russianEquivalent: equivalents[i] }, "ru");
    if (equivalents[i].trim() === "") {
      empty += 1;
      if (names.primary !== terms[i].trim()) bad.push(`«${terms[i]}»: русский эквивалент пуст, а главным встало не испанское название — на экране будет дыра`);
    }
    if (equivalents[i].trim() === terms[i].trim()) {
      same += 1;
      if (names.secondary !== null) bad.push(`«${terms[i]}»: поля совпадают дословно, а вторая строка всё равно печатается — одно и то же дважды`);
    }
    if (names.primary.trim() === "") bad.push(`«${terms[i]}»: главное имя пусто`);
  }
  return { bad, terms: terms.length, empty, same };
}

/** Правило ДО решения владельца, слово в слово: имя не зависело от
 *  локали вовсе. Ради контроля — оно обязано ронять прогон. */
function spanishEverywhere(term: GlossaryTermNameSource): { primary: string; secondary: string | null } {
  return { primary: term.term.trim(), secondary: null };
}

/** И перевёрнутое правило: русское имя главным в ОБЕИХ локалях. Ровно та
 *  ошибка, которую односторонняя проверка не увидела бы. */
function russianEverywhere(term: GlossaryTermNameSource): { primary: string; secondary: string | null } {
  const ru = (term.russianEquivalent ?? "").trim();
  return { primary: ru === "" ? term.term.trim() : ru, secondary: null };
}

function plant(): void {
  let ok = true;
  const say = (name: string, caught: number, expectCaught: boolean) => {
    const verdict = expectCaught ? (caught > 0 ? "ПОЙМАНО" : "ПРОПУЩЕНО") : caught === 0 ? "ЧИСТО" : "ЛОЖНАЯ ТРЕВОГА";
    console.log(`  подсадка «${name}» → находок ${caught}: ${verdict}`);
    if (expectCaught ? caught === 0 : caught !== 0) ok = false;
  };

  say("настоящее правило", behaviour(glossaryTermNames).length, false);
  say("ПРАВИЛО ДО РЕШЕНИЯ: испанское имя главным в обеих локалях", behaviour(spanishEverywhere).length, true);
  say("ЛОКАЛИ ПЕРЕВЁРНУТЫ: русское имя главным в обеих локалях", behaviour(russianEverywhere).length, true);
  say(
    "ЛОКАЛИ ПЕРЕВЁРНУТЫ МЕСТАМИ: /ru отдаёт испанское, /es русское",
    behaviour((t, lang) => glossaryTermNames(t, lang === "ru" ? "es" : "ru")).length,
    true,
  );
  say(
    "вторая строка печатается всегда, даже когда поля совпадают",
    behaviour((t, lang) => {
      const n = glossaryTermNames(t, lang);
      return { primary: n.primary, secondary: lang === "ru" ? t.term.trim() : null };
    }).length,
    true,
  );

  const real = (file: string) => readFileSync(file, "utf8");
  say("настоящие витрины", statics(real).length, false);
  say(
    "страница термина снова печатает {term.term} в h1 (код ДО правки 7.215)",
    statics((file) =>
      file === "src/app/[lang]/glossary/[slug]/page.tsx"
        ? real(file).replace("{names.primary}</h1>", "{term.term}</h1>")
        : real(file),
    ).length,
    true,
  );
  say(
    "выдача поиска снова печатает испанское имя на /ru",
    statics((file) =>
      file === "src/lib/search/records.ts" ? real(file).replace("title: es.primary,", "title: term.term,") : real(file),
    ).length,
    true,
  );
  say(
    "витрина перестала спрашивать общую функцию — правило уехало обратно в файл",
    statics((file) =>
      file === "src/components/glossary/GlossaryApp.tsx"
        ? real(file).replace(/import \{ glossaryTermNames \} from "@\/lib\/glossary-term-name";\n/, "")
        : real(file),
    ).length,
    true,
  );

  const dataText = real(DATA_MODULE);
  say("настоящие данные", data(dataText).bad.length, false);
  say(
    "у термина вырезан русский эквивалент",
    data(dataText.replace(/russianEquivalent: "[^"]+"/, 'russianEquivalent: ""')).bad.length === 0
      ? // Пустое поле правилом разрешено — ловится не оно, а несовпадение
        // числа полей: термин, у которого поля нет ВОВСЕ.
        data(dataText.replace(/\n\s*russianEquivalent: "[^"]+",/, "")).bad.length
      : data(dataText.replace(/russianEquivalent: "[^"]+"/, 'russianEquivalent: ""')).bad.length,
    true,
  );

  console.log(ok ? "[check:term-name] контроль пройден: проверка умеет краснеть на каждом входе" : "[check:term-name] КОНТРОЛЬ ПРОВАЛЕН");
  if (!ok) process.exitCode = 1;
}

function main(argv: string[]): void {
  if (argv.includes("--plant")) return plant();

  const real = (file: string) => readFileSync(file, "utf8");
  const d = data(real(DATA_MODULE));
  const bad = [...behaviour(glossaryTermNames), ...statics(real), ...d.bad];
  console.log(
    `[check:term-name] случаев ${CASES.length} × 2 локали, витрин ${SURFACES.length}, ` +
      `терминов в данных ${d.terms} (пустой русский эквивалент ${d.empty}, поля совпадают ${d.same}); расхождений ${bad.length}`,
  );
  for (const line of bad) console.log(`  ${line}`);
  if (bad.length) process.exitCode = 1;
  else console.log("  в /ru главным печатается русское название, в /es — испанское (контроль — --plant)");
}

if (isEntryPoint(import.meta.url)) main(process.argv.slice(2));
