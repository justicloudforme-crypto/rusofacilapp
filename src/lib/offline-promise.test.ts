import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ОРАНЖЕВАЯ ПЛАШКА БЕЗ СЕТИ ОБЕЩАЕТ РОВНО ТО, ЧТО УМЕЕТ — заход 7.228.
 *
 * ЧТО БЫЛО. Плашка (`OfflineBanner`, смонтирована в шапке НА КАЖДОЙ
 * странице) говорила «Algunos cambios se guardarán y se enviarán cuando
 * vuelva la conexión» / «Некоторые изменения сохранятся и отправятся».
 * Замер по коду: очередь для отправки в проекте ОДНА —
 * `queuePendingProgress` из `src/lib/progress-client.ts`, — и зовут её из
 * ОДНОГО файла, `src/components/lesson/ExercisesTab.tsx`, на проверке
 * упражнений урока. Карточки, игры, рассказы и серия дней без сети не
 * сохраняются никак. То есть плашка обещала «некоторые изменения» на
 * любой странице, а умела одно и в одном месте.
 *
 * ЧТО ДЕРЖИТ ЭТОТ ПРИМЕР. Две стороны сразу: расширится текст обратно до
 * общего обещания — пример падает; появится ВТОРОЕ место, которое ставит
 * что-то в очередь, — пример тоже падает, и текст придётся дописать
 * честно. Прибор смотрит на исходники, потому что предмет проверки —
 * соответствие СЛОВ и КОДА, а не поведение одного компонента.
 */

const ROOT = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const files = walk(ROOT);

function banner(locale: "es" | "ru"): string {
  const dict = JSON.parse(readFileSync(join(ROOT, "dictionaries", `${locale}.json`), "utf8")) as {
    offline: { bannerMessage: string };
  };
  return dict.offline.bannerMessage;
}

describe("плашка без сети не обещает больше, чем умеет", () => {
  it("в очередь на отправку ставит РОВНО одно место, и это упражнения урока", () => {
    const callers = files
      .filter((f) => /queuePendingProgress\(/.test(readFileSync(f, "utf8")))
      .filter((f) => !f.endsWith(join("lib", "progress-client.ts")))
      .map((f) => f.slice(ROOT.length + 1));
    expect(callers).toEqual(["components/lesson/ExercisesTab.tsx"]);
  });

  it("обе локали называют упражнения, а не «некоторые изменения»", () => {
    expect(banner("es")).toMatch(/ejercicios/);
    expect(banner("ru")).toMatch(/упражнени/);
    expect(banner("es")).not.toMatch(/[Aa]lgunos cambios/);
    expect(banner("ru")).not.toMatch(/екоторые изменения/);
  });

  it("обе локали по-прежнему говорят, что отправка случится при возврате связи", () => {
    expect(banner("es")).toMatch(/vuelva la conexión/);
    expect(banner("ru")).toMatch(/связь вернётся/);
  });

  it("отправка действительно привязана к возврату связи, а не к таймеру", () => {
    const tab = readFileSync(join(ROOT, "components", "lesson", "ExercisesTab.tsx"), "utf8");
    expect(tab).toMatch(/addEventListener\("online", flushPendingProgress\)/);
  });
});
