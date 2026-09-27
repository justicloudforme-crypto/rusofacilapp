import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ПОДСТАНОВКА БЕЗОПАСНЫХ ПОЛЕЙ ОБОЛОЧКИ ДО ПОЯВЛЕНИЯ ДОКУМЕНТА — заход 7.238
 * (находка 1 захода 7.234).
 *
 * `MainActivity.pushSafeAreaInsets()` исполняет строку `INSET_APPLY_JS` и из
 * `onPageStarted`, когда `document.documentElement` ещё `null`. До правки
 * строка падала `TypeError: Cannot read properties of null (reading
 * 'style')` при каждом холодном старте с сетью (logcat эмулятора, столбцы
 * 181 и 502 совпали знак в знак), и исключение уносило лист полей.
 *
 * Строка берётся ТЕКСТОМ из Java — та же, что исполняет оболочка, а не
 * пересказ (правило `check:safe-area-insets`).
 */
function insetJs(): string {
  const src = readFileSync("android/app/src/main/java/com/rusofacilapp/app/MainActivity.java", "utf8");
  const at = src.indexOf("INSET_APPLY_JS =");
  expect(at, "в MainActivity.java нет INSET_APPLY_JS").toBeGreaterThan(-1);
  const parts: string[] = [];
  let i = src.indexOf("=", at) + 1;
  while (i < src.length && src[i] !== ";") {
    if (src[i] === '"') {
      let j = i + 1;
      let literal = "";
      while (src[j] !== '"') {
        if (src[j] === "\\") {
          literal += src[j + 1];
          j += 2;
          continue;
        }
        literal += src[j];
        j += 1;
      }
      parts.push(literal);
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return parts.join("").replace("%TOP%", "27").replace("%BOTTOM%", "24").replace("%LEFT%", "0").replace("%RIGHT%", "0");
}

class FakeSheet {
  text = "";
  replaceSync(t: string) {
    this.text = t;
  }
}

function runIn(documentLike: unknown) {
  const win: Record<string, unknown> = {};
  return { run: () => new Function("document", "window", "CSSStyleSheet", insetJs())(documentLike, win, FakeSheet), win };
}

describe("INSET_APPLY_JS при document.documentElement === null (7.238)", () => {
  it("документа ещё нет: не бросает, а лист полей всё равно ставится", () => {
    const doc = { documentElement: null, adoptedStyleSheets: [] as unknown[] };
    const { run, win } = runIn(doc);
    expect(run).not.toThrow();
    expect(doc.adoptedStyleSheets).toHaveLength(1);
    expect((win.__rfInsetSheet as FakeSheet).text).toContain("--android-inset-top:27px");
  });

  it("позитивный контроль: документ есть — обе записи, и в style корня, и в листе", () => {
    const style = new Map<string, string>();
    const doc = {
      documentElement: { style: { setProperty: (k: string, v: string) => style.set(k, v) } },
      adoptedStyleSheets: [] as unknown[],
    };
    const { run, win } = runIn(doc);
    run();
    expect(style.get("--android-inset-top")).toBe("27px");
    expect(style.get("--android-inset-bottom")).toBe("24px");
    expect((win.__rfInsetSheet as FakeSheet).text).toContain("--android-inset-bottom:24px");
  });
});
