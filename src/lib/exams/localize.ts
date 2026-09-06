import { escapeRegExp } from "@/lib/regex";
import esDictionary from "@/dictionaries/es.json";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { SKILL_AREA_TITLES_RU } from "./skill-area-titles";

/**
 * Названия экзаменов — одно поле на обе локали, и на `/ru` оно
 * показывалось по-испански.
 *
 * Замер на живом проде 06.09.2026 (PROGRESS.md 7.129, часть 4):
 * `/ru/courses/a1` печатает `Examen A1 · Lecciones 1 a 10` внутри
 * страницы, у которой всё остальное — русское; так же названы экзамены в
 * выдаче поиска на `/ru` (запрос «Examen A1 · Lecciones 1 a 10» находит
 * их на месте 1 в обеих локалях, потому что русского названия у записи
 * нет вовсе). Причина — та же, что у долга 34 со `Story.author`: в
 * `ExamContent` ровно одно поле `title` и ровно одно `lessonRangeLabel`,
 * и оба читаются как есть в обеих локалях. Русских вариантов в
 * содержимом **0 из 12**.
 *
 * Правка ПРЕЗЕНТАЦИОННАЯ: ни `content.json`, ни таблица `Exam` не
 * трогаются, в боевую базу не пишется ничего. Это важно и для второй
 * половины дела — админ может переименовать экзамен через `/admin/exams`,
 * и такое имя обязано печататься как есть, а не подменяться выдуманным
 * переводом.
 *
 * Как это устроено, и почему не таблицей из двенадцати строк. Испанские
 * названия — не свободный текст, а два шаблона из словаря
 * (`courses.examNames`). Строка переводится РОВНО тогда, когда она
 * буква в букву совпадает с одним из испанских шаблонов, подставленных
 * значениями; тогда те же значения подставляются в русский шаблон той же
 * формы. Строка, шаблонам не отвечающая, возвращается неизменной — то
 * есть собственное имя админа проходит насквозь. Это тот же приём и та
 * же оговорка, что у `localizeStoryAuthor`.
 */

/** Ключи шаблонов. Один и тот же ключ в обеих локалях описывает одну и
 * ту же форму названия — на этом всё и держится. */
const TEMPLATE_KEYS = ["range", "final", "rangeLabel", "finalLabel"] as const;
type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export type ExamNameTemplates = Dictionary["courses"]["examNames"];

/**
 * Испанские шаблоны берутся здесь, а не у вызывающего, и это не
 * умолчание, а факт: содержимое экзаменов написано по-испански — и в
 * `content.json`, и в тех строках `Exam`, которые его перекрывают. Язык
 * ИСТОЧНИКА один, язык читателя — переменная.
 */
const SOURCE_TEMPLATES: ExamNameTemplates = esDictionary.courses.examNames;

/** Что стоит за каждой щелью. Уровень — короткий код (`A1`), номера
 * уроков — целые числа; шире брать нельзя, иначе шаблон «Examen {level}»
 * начнёт совпадать с любой строкой, начинающейся на это слово. */
const SLOT_PATTERNS: Record<string, string> = {
  level: "[A-Za-z][A-Za-z0-9]{0,3}",
  from: "\\d{1,3}",
  to: "\\d{1,3}",
  // Названия тематических блоков внутри экзамена (см.
  // `localizeSkillAreaTitle` ниже). `list` — перечисление уроков в скобках
  // во всех формах, которые встречаются в содержимом: `7`, `1-2`, `5, 10`,
  // `8, 9, 29`. `base` — сама тема, и она НЕнасытная намеренно: скобочный
  // хвост шаблона обязателен и стоит справа, поэтому кратчайший префикс —
  // это ровно тема и есть.
  list: "\\d{1,3}(?:\\s*[-,]\\s*\\d{1,3})*",
  base: ".+?",
};

const SLOT = /\{(level|from|to|list|base)\}/g;

/** Шаблон → регулярное выражение с именованными группами. Литеральная
 * часть шаблона экранируется: в ней есть и точка, и скобки, и `·`. */
function templateToRegExp(template: string): RegExp | null {
  let out = "";
  let last = 0;
  let slots = 0;
  const seen = new Set<string>();
  for (const match of template.matchAll(SLOT)) {
    const name = match[1];
    // Одна и та же щель дважды в одном шаблоне сделала бы группу
    // неоднозначной. Такого шаблона сегодня нет, и если он появится —
    // строка просто не будет переводиться, а не переведётся неверно.
    if (seen.has(name)) return null;
    seen.add(name);
    out += escapeRegExp(template.slice(last, match.index!)) + `(?<${name}>${SLOT_PATTERNS[name]})`;
    last = match.index! + match[0].length;
    slots += 1;
  }
  if (slots === 0) return null;
  out += escapeRegExp(template.slice(last));
  return new RegExp(`^${out}$`);
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(SLOT, (whole, name: string) => values[name] ?? whole);
}

/**
 * Как строка должна читаться посетителю локали `lang`.
 *
 * `es` получает колонку нетронутой — она на этом языке и написана.
 * Всё, что не совпало ни с одним шаблоном, тоже возвращается как есть.
 */
export function localizeExamText(value: string, lang: Locale, target: ExamNameTemplates): string {
  if (lang === "es") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  for (const key of TEMPLATE_KEYS as readonly TemplateKey[]) {
    const source = SOURCE_TEMPLATES[key];
    const replacement = target[key];
    if (!source || !replacement) continue;
    const re = templateToRegExp(source);
    if (!re) continue;
    const match = re.exec(trimmed);
    if (!match?.groups) continue;
    return fill(replacement, match.groups as Record<string, string>);
  }
  return value;
}

/* ------------------------------------------------------------------ *
 * Названия тематических блоков внутри экзамена (долг 53)
 * ------------------------------------------------------------------ */

/** Ключи шаблонов названия блока. Порядок не важен: скобочные хвосты
 * различаются литеральной частью и пересечься не могут. */
const SKILL_AREA_TEMPLATE_KEYS = ["lesson", "lessons", "lessonWholeLevel", "lessonsWholeLevel"] as const;

export type SkillAreaNameTemplates = Dictionary["courses"]["skillAreaNames"];

const SKILL_AREA_SOURCE_TEMPLATES: SkillAreaNameTemplates = esDictionary.courses.skillAreaNames;

/**
 * Как название тематического блока экзамена должно читаться посетителю
 * локали `lang`.
 *
 * Приём тот же, что у `localizeExamText`, но задача другая, и разница
 * важна. У экзамена всё название целиком — шаблон («Examen A1 · Lecciones
 * 1 a 10»), поэтому там достаточно подстановки. У блока шаблонная только
 * скобка со ссылкой на уроки, а тема внутри — свободный текст, и её
 * переводит таблица точных совпадений
 * (`SKILL_AREA_TITLES_RU`, 138 записей на 139 блоков).
 *
 * Правило целиком, включая то, чего оно НЕ делает:
 *
 *   * `es` возвращает значение нетронутым — язык источника;
 *   * тема, которой нет в таблице, останавливает перевод ЦЕЛИКОМ:
 *     возвращается исходная строка, а не наполовину русская. Половинчатая
 *     строка («Aspecto verbal (урок 3)») хуже испанской: она выглядит
 *     как опечатка, а не как непереведённое содержимое;
 *   * скобочный хвост переводится только в паре с темой, по той же
 *     причине;
 *   * ни одно поле данных не меняется — правка живёт в отдаче.
 */
export function localizeSkillAreaTitle(
  value: string,
  lang: Locale,
  target: SkillAreaNameTemplates,
  table: Record<string, string> = SKILL_AREA_TITLES_RU,
): string {
  if (lang === "es") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  // Название без скобочного хвоста — ищется целиком.
  const whole = table[trimmed];
  if (whole) return whole;

  for (const key of SKILL_AREA_TEMPLATE_KEYS) {
    const source = SKILL_AREA_SOURCE_TEMPLATES[key];
    const replacement = target[key];
    if (!source || !replacement) continue;
    const re = templateToRegExp(source);
    if (!re) continue;
    const match = re.exec(trimmed);
    if (!match?.groups) continue;
    const base = table[match.groups.base];
    // Тема не опознана — не переводим ничего. См. правило выше.
    if (!base) return value;
    return fill(replacement, { ...(match.groups as Record<string, string>), base });
  }
  return value;
}
