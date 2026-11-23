import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import es from "../dictionaries/es.json";
import ru from "../dictionaries/ru.json";
import { bottomNavDict, searchDict } from "./chrome-dict";

/**
 * ДОЛГ 183 (заход 7.302): клиентскому компоненту — не весь словарь.
 *
 * Всё, что получает клиентский компонент, едет в разметку страницы. Типы
 * это не стерегут (лишние поля TypeScript пропускает), поэтому здесь
 * читаются МЕСТА ВЫЗОВА: в `src/` не должно быть JSX-атрибута с голым
 * `dict` / `dictionary` в СЕРВЕРНОМ файле у компонента, чей файл начинается
 * с "use client" (граница сервер → браузер).
 * Раздел (`dict.lesson`) или выбор из `chrome-dict.ts` — можно.
 */

const SRC = resolve(__dirname, "..");

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsxFiles(p));
    else if (p.endsWith(".tsx") && !p.endsWith(".test.tsx")) out.push(p);
  }
  return out;
}

const isClientSource = (text: string) => /^\s*(?:\/\/[^\n]*\n\s*)*["']use client["']/.test(text);

/** Путь импорта → файл компонента (или null, если это пакет). */
function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Находки в одном исходнике: `<Tag … attr={dict}` у клиентского Tag. */
function wholeDictToClient(
  fileText: string,
  fromFile: string,
  readComponent: (path: string) => string | null,
): string[] {
  const imports = new Map<string, string>();
  for (const m of fileText.matchAll(/import\s+(\w+)(?:\s*,\s*\{[^}]*\})?\s+from\s+["']([^"']+)["']/g)) imports.set(m[1], m[2]);
  for (const m of fileText.matchAll(/import\s*\{([^}]*)\}\s*from\s+["']([^"']+)["']/g)) {
    for (const part of m[1].split(",")) {
      const local = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (local) imports.set(local, m[2]);
    }
  }
  // Граница — только серверный файл: внутри клиентского кода `dict` уже
  // раздел, пришедший с сервера, и второй раз в разметку он не едет.
  if (isClientSource(fileText)) return [];
  const hits: string[] = [];
  // Стрелка `=>` в атрибуте иначе закрыла бы тег своим «>».
  const text = fileText.replace(/=>/g, "⇒");
  for (const m of text.matchAll(/<([A-Z]\w*)\b([^<>]*?)\/?>/g)) {
    const [, tag, attrs] = m;
    const attr = attrs.match(/\b(\w+)=\{\s*(dict|dictionary)\s*\}/);
    if (!attr) continue;
    const spec = imports.get(tag);
    if (!spec) continue;
    const target = resolveImport(fromFile, spec);
    const text = target ? readComponent(target) : null;
    if (text && isClientSource(text)) hits.push(`<${tag} ${attr[1]}={${attr[2]}}>`);
  }
  return hits;
}

const readOrNull = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : null);

describe("долг 183: клиентским компонентам — только разделы словаря", () => {
  it("в src/ нет ни одного голого dict у клиентского компонента", () => {
    const files = tsxFiles(SRC);
    expect(files.length).toBeGreaterThan(100);
    const found: string[] = [];
    for (const f of files) {
      for (const hit of wholeDictToClient(readFileSync(f, "utf8"), f, readOrNull)) found.push(`${f.slice(SRC.length + 1)}: ${hit}`);
    }
    expect(found).toEqual([]);
  });

  it("позитивный контроль: подсаженный dict={dict} у клиентского компонента пойман, у серверного — нет", () => {
    const fake = join(SRC, "app", "[lang]", "layout.tsx");
    const planted = [
      'import BottomNav from "@/components/BottomNav";',
      'import Footer from "@/components/Footer";',
      'import { searchDict } from "@/i18n/chrome-dict";',
      "export default function X({ dict }) {",
      "  return (<>",
      "    <BottomNav lang={lang} dict={dict} isLoggedIn={false} nativeShell={false} />",
      "    <Footer dict={dict} lang={lang} nativeShell={false} />",
      "  </>);",
      "}",
    ].join("\n");
    expect(wholeDictToClient(planted, fake, readOrNull)).toEqual(["<BottomNav dict={dict}>"]);
    // Многострочный вызов и стрелка в атрибуте не прячут находку.
    const multiline = 'import GlobalSearch from "@/components/GlobalSearch";\nconst a = <GlobalSearch\n  onPick={() => go()}\n  dict={dict}\n/>;';
    expect(wholeDictToClient(multiline, fake, readOrNull)).toEqual(["<GlobalSearch dict={dict}>"]);
  });

  for (const [lang, dict] of [["es", es], ["ru", ru]] as const) {
    it(`${lang}: поиску и нижнему меню уходит ≤ 3 % словаря`, () => {
      const whole = JSON.stringify(dict).length;
      const search = JSON.stringify(searchDict(dict as never)).length;
      const bottom = JSON.stringify(bottomNavDict(dict as never)).length;
      expect(Object.keys(searchDict(dict as never)).sort()).toEqual(["access", "nav", "search"]);
      expect(Object.keys(bottomNavDict(dict as never))).toEqual(["nav"]);
      expect(search / whole).toBeLessThan(0.03);
      expect(bottom / whole).toBeLessThan(0.03);
      // Те же объекты разделов, не копии: React шлёт общую ссылку один раз.
      expect(searchDict(dict as never).nav).toBe(bottomNavDict(dict as never).nav);
    });
  }
});
