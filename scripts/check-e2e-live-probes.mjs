// Проба обязана уметь покраснеть.
//
// 08.09.2026, заход 7.149, долги 94 и 95. Класс найден случайно в 7.147:
// проверка выдачи заходила на `/es/media` и ждала увода на `/pricing`,
// которого страница не делает уже давно, — условие было истинно ВСЕГДА, и
// тест был зелёным независимо от продукта. Этот сторож ловит механическую
// часть класса, и цена его отсутствия названа числами: заход 7.149 нашёл
// подсадкой девять таких проб, из них
//
//   * `word-games.spec.ts` считала выделенные клетки селектором
//     `button[data-row].bg-foreground/15`, а выделенная клетка носит
//     `bg-primary/20` — селектор не совпадал ни с чем, счёт был нулём
//     всегда. С подсаженным настоящим дефектом (наведение мышью снова
//     строит выделение) выделилось 8 клеток, проба нашла 0 и прошла;
//   * `glossary.spec.ts` обещала «a matching h1», а утверждала лишь его
//     видимость — `<h1>` есть у каждой страницы сайта, включая экран
//     отказа при HTTP 200 (инцидент №1);
//   * `page-width.spec.ts` пропускала по `continue` страницу, ответившую
//     404, и не считала, сколько их было: с шестью путями из семи в 404
//     все 20 исполнений остались зелёными.
//
// ПРАВИЛА. Каждое — механическое, по исходнику, без запуска браузера.
//
//   1. МЁРТВЫЙ СЕЛЕКТОР. Класс, соединённый в селекторе с атрибутом
//      `data-*`, обязан встречаться в том же файле `src/`, где стоит этот
//      атрибут. Ровно это правило называет дефект word-games числом.
//   2. СЕЛЕКТОР ТОЛЬКО В ОТРИЦАНИИ. Строка-селектор, все употребления
//      которой во всём `e2e/` — отрицательные утверждения («ничего не
//      нашлось»), и ни одного положительного. Такой селектор никем не
//      доказан живым: опечатка в нём неотличима от успеха.
//   3. ТЕСТ БЕЗ ЕДИНОГО `expect`.
//   4. `expect(x.every(...))` — `[].every(...)` истинно, поэтому рядом
//      обязано стоять утверждение о непустоте `x`.
//   5. ДОЛГ 95: сумма ЯВНЫХ ожиданий внутри теста больше его бюджета.
//      Тогда отказ приходит по потолку ТЕСТА и указывает на невиновный
//      вызов — ровно так `voice-recording-local.spec.ts:194` падал в CI
//      08.09.2026 на мгновенном `audio.load()` (PROGRESS.md 7.148).
//
// Список исключений закреплён ЧИСЛОМ: молча добавить строку нельзя.
//
//   node scripts/check-e2e-live-probes.mjs
//   node scripts/check-e2e-live-probes.mjs --plant
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const PLANT = process.argv.includes("--plant");
/** Отчёт по правилу 5: бюджет каждого теста против суммы его ожиданий.
 * Ничего не гейтит — это таблица для человека. */
const BUDGETS = process.argv.includes("--budgets");
const ROOT = process.cwd();
const E2E = join(ROOT, "e2e");
const SRC = join(ROOT, "src");

/** Потолок теста по умолчанию у Playwright; `playwright.config.ts` его не
 * переопределяет, и это проверяется отдельно ниже. */
const DEFAULT_TEST_BUDGET_MS = 30_000;

/**
 * Исключения. Каждое — с причиной, и длина списка закреплена числом:
 * добавление строки без правки числа роняет сторожа.
 */
const EXCEPTIONS = [
  {
    rule: "every-on-possibly-empty",
    file: "activity-calendar.spec.ts",
    id: "hotFlames",
    why:
      "непустота доказана строкой выше — `expect(await studied.count()).toBeGreaterThan(0)`, " +
      "а `hotFlames` собран из того же `studied`; связь через другой идентификатор сторож не видит",
  },
  {
    rule: "every-on-possibly-empty",
    file: "paywall-modal.spec.ts",
    id: "inMexico",
    why: "непустота доказана следующей строкой — `expect(inMexico).toContain(\"$150 MXN\")`",
  },
  {
    rule: "every-on-possibly-empty",
    file: "paywall-modal.spec.ts",
    id: "inArgentina",
    why: "непустота доказана строкой `expect(inMexico).not.toEqual(inArgentina)` вместе с предыдущей",
  },
  {
    rule: "every-on-possibly-empty",
    file: "pricing-offer-markup.spec.ts",
    id: "inArgentina",
    why: "непустота доказана `expect(inMexico.map(...)).not.toEqual(inArgentina.map(...))` ниже",
  },
];
const EXCEPTIONS_COUNT = 4;

function walk(dir, re) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".next" || entry === "generated") continue;
    if (statSync(full).isDirectory()) out.push(...walk(full, re));
    else if (re.test(entry)) out.push(full);
  }
  return out;
}

const e2eFiles = () => walk(E2E, /\.ts$/).sort();

/** Исходники продукта, файл за файлом: правило 1 спрашивает не «есть ли
 * класс где-нибудь», а «есть ли он ТАМ, где стоит этот атрибут». */
function srcFiles() {
  return walk(SRC, /\.(ts|tsx|css)$/).map((f) => ({ file: relative(ROOT, f), text: readFileSync(f, "utf-8") }));
}

/** Есть ли в файле строка, которая УТВЕРЖДАЕТ непустоту `id`.
 *
 * Разбор построчный намеренно: `expect(inMexico.map((o) => o.price)).toEqual([...])`
 * не разбирается регуляркой «до первой закрывающей скобки», а как строка
 * читается однозначно. Пустые формы (`toHaveLength(0)`, `toEqual([])`)
 * исключены явно — они как раз и есть та самая проба, которая ничего не
 * доказывает. */
function provesNonEmpty(source, id) {
  const mentions = new RegExp(`\\b${id}\\b`);
  const PROVING = /\.(toHaveLength\((?!\s*0\s*\))|toContain\(|toContainEqual\(|toEqual\((?!\s*\[\s*\]\s*\))|toStrictEqual\((?!\s*\[\s*\]\s*\))|toBeGreaterThan\(|toBeGreaterThanOrEqual\((?!\s*0\s*\)))/;
  return source
    .split("\n")
    .some((line) => line.includes("expect(") && mentions.test(line) && PROVING.test(line) && !/\bnot\./.test(line));
}

const isExpectCall = (n) => {
  let cur = n;
  while (cur && (ts.isPropertyAccessExpression(cur) || ts.isCallExpression(cur))) {
    if (ts.isCallExpression(cur)) {
      const e = cur.expression;
      if (ts.isIdentifier(e) && e.text === "expect") return true;
      if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "expect") return true;
    }
    cur = cur.expression;
  }
  return false;
};

/** Утверждения, которые доказывают, что нечто ЕСТЬ: с ними селектор или
 * список считается живым, даже если рядом стоит отрицание. */
const POSITIVE = [
  /toHaveLength\((?!\s*0\s*\))/,
  /toHaveCount\((?!\s*0\s*\))/,
  /toContainText?\(/,
  /toContainEqual\(/,
  /toHaveClass\(/,
  /toHaveText\(/,
  /toHaveAttribute\(/,
  /toHaveValue\(/,
  /toBeVisible\(/,
  /toBeGreaterThan\(/,
  /toBeGreaterThanOrEqual\((?!\s*0\s*\))/,
];

/** Функции файла по имени: и объявления, и стрелки в `const`. */
function collectFunctions(sf) {
  const fns = new Map();
  const walkNode = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) fns.set(node.name.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)))
      fns.set(node.name.text, node.initializer);
    ts.forEachChild(node, walkNode);
  };
  walkNode(sf);
  return fns;
}

/** Делает ли этот узел (или функция того же файла, которую он зовёт) хоть
 * одно утверждение. */
function assertsSomething(node, fns, sf, seen = new Set()) {
  let yes = false;
  const walkNode = (n) => {
    if (yes) return;
    if (ts.isCallExpression(n)) {
      if (isExpectCall(n)) {
        yes = true;
        return;
      }
      const callee = n.expression;
      const name = ts.isPropertyAccessExpression(callee) ? callee.name.text
        : ts.isIdentifier(callee) ? callee.text : null;
      if (name && fns.has(name) && !seen.has(name)) {
        seen.add(name);
        if (assertsSomething(fns.get(name), fns, sf, seen)) {
          yes = true;
          return;
        }
      }
    }
    ts.forEachChild(n, walkNode);
  };
  walkNode(node);
  return yes;
}

const NEGATIVE = [
  /toHaveCount\(\s*0\s*\)/,
  /toHaveLength\(\s*0\s*\)/,
  /\.toBe\(\s*0\s*\)/,
  /\.toEqual\(\s*\[\s*\]\s*\)/,
  /not\.toBeVisible/,
  /not\.toBeAttached/,
  /toBeHidden/,
  /not\.toContain/,
];

/** Разбор одного файла e2e. Возвращает находки и словарь употреблений
 * селекторов (он общий на весь каталог — правило 2 смотрит шире файла). */
function auditFile(file, source, selectorUses) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const rel = relative(E2E, file).split("\\").join("/");
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const found = [];
  const add = (rule, node, message) => found.push({ rule, file: rel, line: lineOf(node), message });
  const localFns = collectFunctions(sf);

  const excepted = (rule, id) =>
    EXCEPTIONS.some((e) => e.rule === rule && e.file === rel && e.id === id);

  const enclosingStatement = (n) => {
    let p = n;
    while (p.parent && !ts.isStatement(p)) p = p.parent;
    return p;
  };

  const visit = (node) => {
    // ── правила 1 и 2: строковые селекторы ────────────────────────────
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "locator" &&
      node.arguments.length &&
      (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
    ) {
      const selector = node.arguments[0].text;
      const statement = enclosingStatement(node);
      let text = statement.getText(sf);
      if (ts.isVariableStatement(statement) && statement.parent && ts.isBlock(statement.parent)) {
        const name = statement.declarationList.declarations[0]?.name;
        if (name && ts.isIdentifier(name)) {
          for (const sib of statement.parent.statements) {
            if (sib !== statement && sib.getText(sf).includes(name.text)) text += "\n" + sib.getText(sf);
          }
        }
      }
      // Отрицательным считается только то употребление, рядом с которым НЕТ
      // ни одного положительного утверждения о том же: `toHaveLength(4)` в
      // паре с `not.toContain(...)` — это доказанный живым селектор.
      const negative =
        NEGATIVE.some((re) => re.test(text)) && !POSITIVE.some((re) => re.test(text.replace(/not\.[a-zA-Z]+\(/g, "")));
      if (!selectorUses.has(selector)) selectorUses.set(selector, []);
      selectorUses.get(selector).push({ file: rel, line: lineOf(node), negative });
    }

    // ── правило 3: тест без единого expect ────────────────────────────
    //
    // С заходом в функции ТОГО ЖЕ файла: утверждение, вынесенное в общий
    // помощник (`expectLeadsToObject` в search-deep-link.spec.ts), — это
    // утверждение теста, а не его отсутствие.
    if (
      ts.isCallExpression(node) &&
      /^(test|it)(\.(only|skip|fixme))?$/.test(node.expression.getText(sf)) &&
      node.arguments.length >= 2
    ) {
      const body = node.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
      if (body && !assertsSomething(body, localFns, sf)) {
        add("test-without-expect", node, "тест не делает ни одного утверждения — ни своего, ни через помощника этого файла");
      }
    }

    // ── правило 4: expect(x.every(...)) ───────────────────────────────
    if (
      ts.isCallExpression(node) &&
      isExpectCall(node) === false &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "every"
    ) {
      const parentCall = node.parent && ts.isCallExpression(node.parent) ? node.parent : null;
      const insideExpect =
        parentCall && ts.isIdentifier(parentCall.expression) && parentCall.expression.text === "expect";
      if (insideExpect) {
        const target = node.expression.expression;
        const id = ts.isIdentifier(target) ? target.text : null;
        const proven = id !== null && provesNonEmpty(source, id);
        if (!proven && !(id !== null && excepted("every-on-possibly-empty", id))) {
          add(
            "every-on-possibly-empty",
            node,
            `expect(${id ?? "…"}.every(…)) — на пустом списке это истинно; рядом обязано стоять утверждение о непустоте`,
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);

  found.push(...auditBudgets(sf, rel, lineOf));
  return found;
}

// ── правило 5 (долг 95): бюджет теста против суммы его ожиданий ───────

const budgetReport = [];

function auditBudgets(sf, rel, lineOf) {
  const found = [];
  const fns = new Map();
  // `SETTLE_MAX_MS` приходит из e2e/helpers/geometry.ts — единственная
  // импортированная константа ожидания в этом каталоге, и её значение
  // закреплено здесь числом, чтобы бюджеты, построенные на ней, судились,
  // а не пропускались как «выражение».
  const consts = new Map([["SETTLE_MAX_MS", 6000]]);
  const arrayLengths = new Map();
  const numericDecls = [];
  const collect = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) fns.set(node.name.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
        fns.set(node.name.text, node.initializer);
      else {
        let init = node.initializer;
        while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression;
        if (ts.isArrayLiteralExpression(init)) arrayLengths.set(node.name.text, init.elements.length);
        else numericDecls.push([node.name.text, node.initializer]);
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(sf);

  /** Число из выражения: литерал, известная константа, либо арифметика над
   * ними. Всё остальное — `null`, и такой бюджет сторож не судит. */
  const numberOf = (expr) => {
    if (!expr) return null;
    if (ts.isNumericLiteral(expr)) return Number(expr.text);
    if (ts.isIdentifier(expr)) return consts.has(expr.text) ? consts.get(expr.text) : null;
    if (ts.isParenthesizedExpression(expr)) return numberOf(expr.expression);
    if (ts.isPropertyAccessExpression(expr) && expr.name.text === "length")
      return ts.isIdentifier(expr.expression) && arrayLengths.has(expr.expression.text)
        ? arrayLengths.get(expr.expression.text)
        : null;
    if (ts.isBinaryExpression(expr)) {
      const l = numberOf(expr.left);
      const r = numberOf(expr.right);
      if (l === null || r === null) return null;
      switch (expr.operatorToken.kind) {
        case ts.SyntaxKind.PlusToken: return l + r;
        case ts.SyntaxKind.MinusToken: return l - r;
        case ts.SyntaxKind.AsteriskToken: return l * r;
        case ts.SyntaxKind.SlashToken: return l / r;
        default: return null;
      }
    }
    return null;
  };

  // Константы, заданные выражением (`2 * SETTLE_MAX_MS + 5_000`),
  // досчитываются в несколько проходов: одна может ссылаться на другую.
  for (let pass = 0; pass < 3; pass += 1) {
    for (const [name, expr] of numericDecls) {
      if (consts.has(name)) continue;
      const v = numberOf(expr);
      if (v !== null) consts.set(name, v);
    }
  }

  const waitsIn = (node, seen = new Set()) => {
    let total = 0;
    const items = [];
    const walkNode = (n) => {
      if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === "timeout") {
        const v = numberOf(n.initializer);
        if (v !== null) {
          total += v;
          items.push(`timeout: ${v} (:${lineOf(n)})`);
        }
      }
      if (ts.isCallExpression(n)) {
        const callee = n.expression;
        const name = ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : ts.isIdentifier(callee)
            ? callee.text
            : null;
        if (name === "waitForTimeout") {
          const v = numberOf(n.arguments[0]);
          if (v !== null) {
            total += v;
            items.push(`waitForTimeout(${v}) (:${lineOf(n)})`);
          }
        }
        if (name && fns.has(name) && !seen.has(name)) {
          seen.add(name);
          const inner = waitsIn(fns.get(name), seen);
          total += inner.total;
          items.push(...inner.items.map((i) => `${name} → ${i}`));
        }
      }
      ts.forEachChild(n, walkNode);
    };
    walkNode(node);
    return { total, items };
  };

  const setTimeoutIn = (node) => {
    let ms = null;
    const look = (n) => {
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.text === "setTimeout"
      ) {
        const v = numberOf(n.arguments[0]);
        ms = v === null ? "неизвестно" : v;
      }
      ts.forEachChild(n, look);
    };
    look(node);
    return ms;
  };

  const describeBudgets = new Map();
  const budgetFromDescribe = (node) => {
    let p = node.parent;
    while (p) {
      if (ts.isCallExpression(p) && /test\.describe/.test(p.expression.getText(sf))) {
        if (!describeBudgets.has(p)) {
          let ms = null;
          const look = (n) => {
            if (ts.isCallExpression(n) && /(^|\.)beforeEach$/.test(n.expression.getText(sf))) {
              const got = setTimeoutIn(n);
              if (got !== null) ms = got;
            }
            ts.forEachChild(n, look);
          };
          look(p);
          describeBudgets.set(p, ms);
        }
        return describeBudgets.get(p);
      }
      p = p.parent;
    }
    return null;
  };

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      /^(test|it)(\.(only|skip|fixme))?$/.test(node.expression.getText(sf)) &&
      node.arguments.length >= 2
    ) {
      const body = node.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
      if (body) {
        const own = setTimeoutIn(body);
        const budget = own ?? budgetFromDescribe(node) ?? DEFAULT_TEST_BUDGET_MS;
        const { total, items } = waitsIn(body);
        if (BUDGETS) {
          budgetReport.push({ file: rel, line: lineOf(node), budget, total });
        }
        if (typeof budget === "number" && total > budget) {
          found.push({
            rule: "budget-smaller-than-its-own-waits",
            file: rel,
            line: lineOf(node),
            message:
              `сумма явных ожиданий ${total} мс больше бюджета теста ${budget} мс — ` +
              `отказ придёт по потолку теста и укажет на невиновный вызов; слагаемые: ${items.join(", ")}`,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

// ── правило 1: класс из селектора обязан жить там же, где атрибут ─────

function auditDeadSelectors(selectorUses, sources) {
  const found = [];
  for (const [selector, uses] of selectorUses) {
    // `тег[data-x].класс` — разбираем на атрибут и классы
    const attrs = [...selector.matchAll(/\[(data-[a-z0-9-]+)/g)].map((m) => m[1]);
    if (attrs.length === 0) continue;
    const classes = [...selector.matchAll(/\.([A-Za-z][\w-]*(?:\\\\?[/:][\w./-]+)*)/g)].map((m) =>
      m[1].replace(/\\/g, ""),
    );
    for (const cls of classes) {
      const together = sources.some((s) => attrs.every((a) => s.text.includes(a)) && s.text.includes(cls));
      if (!together) {
        for (const use of uses) {
          found.push({
            rule: "dead-selector",
            file: use.file,
            line: use.line,
            message:
              `класс «${cls}» не встречается ни в одном файле src/, где стоит ${attrs.join(" и ")} — ` +
              `селектор «${selector}» не совпадает ни с чем, и любое утверждение о нём истинно всегда`,
          });
        }
      }
    }
  }
  return found;
}

// ── правило 2: селектор только в отрицании ────────────────────────────

function auditNegativeOnly(selectorUses) {
  const found = [];
  for (const [selector, uses] of selectorUses) {
    if (!uses.some((u) => u.negative)) continue;
    if (uses.some((u) => !u.negative)) continue;
    for (const use of uses) {
      found.push({
        rule: "selector-proved-by-nobody",
        file: use.file,
        line: use.line,
        message:
          `селектор «${selector}» встречается только в отрицательных утверждениях — ` +
          `никто не доказал, что он вообще что-то находит, и опечатка в нём даст тот же зелёный`,
      });
    }
  }
  return found;
}

function run(readFile = (f) => readFileSync(f, "utf-8"), files = e2eFiles(), sources = srcFiles()) {
  const selectorUses = new Map();
  const found = [];
  for (const file of files) found.push(...auditFile(file, readFile(file), selectorUses));
  found.push(...auditDeadSelectors(selectorUses, sources));
  found.push(...auditNegativeOnly(selectorUses));
  return { found, selectors: selectorUses.size, files: files.length };
}

function main() {
  if (EXCEPTIONS.length !== EXCEPTIONS_COUNT) {
    console.error(
      `Список исключений вырос до ${EXCEPTIONS.length} при закреплённом ${EXCEPTIONS_COUNT}. ` +
        `Число здесь — не формальность: молча добавить исключение нельзя.`,
    );
    process.exit(1);
  }

  if (PLANT) return plant();

  if (BUDGETS) {
    run();
    const rows = budgetReport.sort((a, b) => {
      const ra = typeof a.budget === "number" ? a.total / a.budget : -1;
      const rb = typeof b.budget === "number" ? b.total / b.budget : -1;
      return rb - ra;
    });
    for (const r of rows) {
      const ratio = typeof r.budget === "number" ? (r.total / r.budget).toFixed(2) : "—";
      console.log(
        `${typeof r.budget === "number" && r.total > r.budget ? "!!" : "  "} e2e/${r.file}:${r.line}  ` +
          `сумма ${r.total}  бюджет ${r.budget}  доля ${ratio}`,
      );
    }
    const over = rows.filter((r) => typeof r.budget === "number" && r.total > r.budget).length;
    console.log(`\nтестов ${rows.length}, превышений ${over}`);
    process.exit(0);
  }

  const { found, selectors, files } = run();
  if (found.length === 0) {
    console.log(
      `check:e2e-live-probes — ${files} файлов в e2e/, ${selectors} разных селекторов, ` +
        `исключений ${EXCEPTIONS.length}, нарушений 0. Каждая проба умеет покраснеть.`,
    );
    process.exit(0);
  }
  for (const hit of found) {
    console.error(`ПРОБА НЕ УМЕЕТ КРАСНЕТЬ [${hit.rule}]: e2e/${hit.file}:${hit.line} — ${hit.message}`);
  }
  console.error(`\nВсего ${found.length}. См. PROGRESS.md 7.149, долги 94 и 95.`);
  process.exit(1);
}

/**
 * Позитивный контроль.
 *
 * Пять подсадок — по одной на правило, — и отрицательная половина: без
 * подсадки прогон обязан молчать. «0 нарушений» без этого не значит ничего
 * (PROGRESS.md 4.1).
 */
function plant() {
  console.log("check:e2e-live-probes --plant");
  const files = e2eFiles();
  const sources = srcFiles();
  const base = (f) => readFileSync(f, "utf-8");
  const target = files[0];

  const plants = [
    [
      "dead-selector",
      "спека ищет клетку по классу, которого нет там, где стоит её атрибут",
      (f) =>
        f === target
          ? `${base(f)}\ntest("подсадка", async ({ page }) => { expect(await page.locator("button[data-row].bg-nonexistent-plant-class").count()).toBe(0); });\n`
          : base(f),
    ],
    [
      "selector-proved-by-nobody",
      "селектор встречается только в отрицательном утверждении",
      (f) =>
        f === target
          ? `${base(f)}\ntest("подсадка", async ({ page }) => { await expect(page.locator("section.mt-12 .plant-only-negative")).toHaveCount(0); });\n`
          : base(f),
    ],
    [
      "test-without-expect",
      "тест не делает ни одного утверждения",
      (f) => (f === target ? `${base(f)}\ntest("подсадка", async ({ page }) => { await page.goto("/es"); });\n` : base(f)),
    ],
    [
      "every-on-possibly-empty",
      "expect(x.every(…)) без доказанной непустоты x",
      (f) =>
        f === target
          ? `${base(f)}\ntest("подсадка", async () => { const plantedRows: string[] = []; expect(plantedRows.every((r) => r.length > 0)).toBe(true); });\n`
          : base(f),
    ],
    [
      "budget-smaller-than-its-own-waits",
      "сумма ожиданий теста больше его бюджета",
      (f) =>
        f === target
          ? `${base(f)}\ntest("подсадка", async ({ page }) => { await expect(page.locator("h1")).toBeVisible({ timeout: 20_000 }); await expect(page.locator("h2")).toBeVisible({ timeout: 20_000 }); expect(1).toBe(1); });\n`
          : base(f),
    ],
  ];

  let caught = 0;
  for (const [rule, name, read] of plants) {
    const { found } = run(read, files, sources);
    const hit = found.some((f) => f.rule === rule);
    console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: [${rule}] ${name}`);
    if (hit) caught += 1;
  }

  const clean = run(base, files, sources).found.length === 0;
  console.log(
    `  ${clean ? "отрицательный контроль: без подсадки чисто" : "ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН — сначала почини настоящее нарушение"}`,
  );
  console.log(`  поймано ${caught} из ${plants.length}`);
  process.exit(caught === plants.length && clean ? 0 : 1);
}

// Ничего при импорте — см. src/lib/entry-point.test.ts.
const isEntryPointHere =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPointHere) main();
