import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * ССЫЛКА НА PDF — С `rel="nofollow"` (7.274).
 *
 * Обе выдачи PDF живут под `/api/` (`/api/intro/pdf`, вводная колода на
 * `/es|ru/courses`, видит гость; `/api/lessons/…/pdf`, вкладка слайдов,
 * видит подписчик), а `/api/` закрыт в robots. Ссылка без `nofollow`
 * зовёт робота туда, куда ему нельзя. Замер 18.10.2026 на проде: у
 * `<a data-testid="intro-pdf">` на `/es/courses` и `/ru/courses` атрибута
 * `rel` не было.
 *
 * Сторож судит каждый открывающий тег `<a …>` в `src/**` (кроме тестов),
 * у которого в `href` есть `/pdf`. Найдено ноль — красный: правило о
 * пустой выборке молчать не вправе (правило замера 4.1).
 */
type Anchor = { file: string; tag: string };

/** Открывающие теги `<a …>` — с учётом `{…}` внутри (`=>` в обработчике). */
export function openingAnchors(source: string): string[] {
  const tags: string[] = [];
  const re = /<a\b/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    let depth = 0;
    let end = -1;
    for (let i = m.index + 2; i < source.length; i += 1) {
      const c = source[i];
      if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      else if (c === ">" && depth === 0) {
        end = i;
        break;
      }
    }
    if (end > 0) tags.push(source.slice(m.index, end + 1));
  }
  return tags;
}

function pdfAnchors(files: Map<string, string>): Anchor[] {
  const out: Anchor[] = [];
  for (const [file, source] of files) {
    for (const tag of openingAnchors(source)) {
      if (/href=\{?[`"'][^`"']*\/pdf\b/.test(tag)) out.push({ file, tag });
    }
  }
  return out;
}

function problems(files: Map<string, string>): string[] {
  const anchors = pdfAnchors(files);
  if (anchors.length === 0) return ["ссылок на PDF не найдено — сверять не по чему"];
  return anchors
    .filter((a) => !/\brel="[^"]*\bnofollow\b[^"]*"/.test(a.tag))
    .map((a) => `${a.file}: ссылка на PDF без rel="nofollow"`);
}

const SOURCES = new Map(
  execFileSync("git", ["ls-files", "src/**/*.tsx"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !/\.test\.tsx$/.test(f))
    .map((f) => [f, readFileSync(f, "utf8")] as const),
);

describe('ссылка на PDF — rel="nofollow"', () => {
  it("найдены обе выдачи PDF, и у обеих nofollow", () => {
    const files = pdfAnchors(SOURCES).map((a) => a.file).sort();
    expect(files).toEqual(["src/components/intro/IntroPresentation.tsx", "src/components/lesson/SlidesTab.tsx"]);
    expect(problems(SOURCES)).toEqual([]);
  });

  it("подсадка: rel снят у вводной колоды — ловится", () => {
    const planted = new Map(SOURCES);
    const file = "src/components/intro/IntroPresentation.tsx";
    const before = planted.get(file)!;
    planted.set(file, before.replace('rel="nofollow"', ""));
    expect(planted.get(file)).not.toBe(before);
    expect(problems(planted)).toEqual([`${file}: ссылка на PDF без rel="nofollow"`]);
  });

  it("подсадка: обработчик со стрелкой не обрывает тег раньше rel", () => {
    const src = '<a href={`/api/x/pdf`} onClick={() => go()} rel="nofollow">PDF</a>';
    expect(problems(new Map([["x.tsx", src]]))).toEqual([]);
    const bad = '<a href={`/api/x/pdf`} onClick={() => go()}>PDF</a>';
    expect(problems(new Map([["x.tsx", bad]]))).toEqual(['x.tsx: ссылка на PDF без rel="nofollow"']);
  });

  it("пустая выборка — красный, а не «чисто»", () => {
    expect(problems(new Map([["x.tsx", "<a href='/es'>x</a>"]]))).toEqual([
      "ссылок на PDF не найдено — сверять не по чему",
    ]);
  });
});
