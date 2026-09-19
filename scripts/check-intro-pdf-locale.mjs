/**
 * PDF ВВОДНОЙ ПРЕЗЕНТАЦИИ ГОВОРИТ НА ЯЗЫКЕ ЛОКАЛИ — ДОЛГ 209 (7.216).
 *
 * ЗАЧЕМ. Колода НА ЭКРАНЕ научилась обеим локалям ещё в 7.196
 * (`buildIntroSlides(stats, lang)`), а PDF остался испанским целиком:
 * обложка, подпись «Diapositiva N de M», название документа, строка
 * подвала и префикс ссылок `/es`. Долг 209 назвал и запрет: «переводить
 * половину (слайды по-русски внутри испанской рамки) хуже, чем не
 * переводить вовсе». Ровно эту половинчатость сторож и стережёт — он
 * требует, чтобы ни одна строка рамки не осталась жёстко испанской.
 *
 * ПРАВИЛА, ШЕСТЬ ШТУК:
 *
 *   а) `IntroDocument` принимает `lang` и передаёт его в
 *      `buildIntroSlides` — иначе слайды снова разойдутся с рамкой;
 *   б) рамка берётся из таблицы `PDF_FRAME`, и в ней есть ОБЕ локали;
 *   в) у обеих локалей все пять полей рамки непусты И ОТЛИЧАЮТСЯ друг от
 *      друга — скопированная испанская строка в русской ветке это и есть
 *      «перевели половину», и сторож обязан её видеть;
 *   г) в `pdf.tsx` не осталось жёсткого префикса ссылок `/es`;
 *   д) маршрут читает локаль из запроса и проверяет её `isLocale`;
 *   е) живая кнопка на странице передаёт локаль в адрес.
 *
 * ЧЕГО НЕ ОБЕЩАЕТ: сторож не читает САМ PDF и не судит качество
 * перевода. Он судит, что испанских строк рамки в коде не осталось и что
 * язык доезжает от кнопки до документа.
 *
 *   node scripts/check-intro-pdf-locale.mjs          # гейт
 *   node scripts/check-intro-pdf-locale.mjs --plant  # контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const PDF = "src/lib/intro/pdf.tsx";
const ROUTE = "src/app/api/intro/pdf/route.tsx";
const PAGE = "src/components/intro/IntroPresentation.tsx";

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

const FIELDS = ["documentTitle", "coverEyebrow", "coverTitle", "coverSubtitle", "footer"];

/** Значение строкового поля внутри ветки локали таблицы PDF_FRAME. */
function frameField(branch, field) {
  const m = new RegExp(`${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(branch);
  return m ? m[1] : null;
}

function frameBranch(code, lang) {
  const m = new RegExp(`\\n  ${lang}:\\s*\\{([\\s\\S]*?)\\n  \\},`).exec(code);
  return m ? m[1] : null;
}

export function violations(pdfRaw, routeRaw, pageRaw) {
  const pdf = stripComments(pdfRaw);
  const route = stripComments(routeRaw);
  const page = stripComments(pageRaw);
  const bad = [];

  if (!/IntroDocument\(\{\s*stats,\s*lang[^}]*\}/.test(pdf)) {
    bad.push(`${PDF}: IntroDocument не принимает lang — рамка PDF остаётся одноязычной (долг 209)`);
  }
  if (!/buildIntroSlides\(stats,\s*lang\)/.test(pdf)) {
    bad.push(`${PDF}: слайды строятся без lang — колода на экране и в PDF заговорят на разных языках`);
  }
  if (!/const PDF_FRAME/.test(pdf)) {
    bad.push(`${PDF}: таблицы PDF_FRAME нет — сторож ослеп, а не доволен`);
    return bad;
  }
  const es = frameBranch(pdf, "es");
  const ru = frameBranch(pdf, "ru");
  if (!es || !ru) {
    bad.push(`${PDF}: в PDF_FRAME нет обеих локалей (es: ${Boolean(es)}, ru: ${Boolean(ru)})`);
  } else {
    for (const field of FIELDS) {
      const a = frameField(es, field);
      const b = frameField(ru, field);
      if (!a || !b) {
        bad.push(`${PDF}: поле рамки ${field} не задано у обеих локалей`);
        continue;
      }
      if (a === b) {
        bad.push(`${PDF}: поле рамки ${field} у обеих локалей одинаково («${a}») — это «перевели половину», запрещённое долгом 209`);
      }
    }
    if (!/slideLabel:\s*\(page,\s*total\)/.test(es) || !/slideLabel:\s*\(page,\s*total\)/.test(ru)) {
      bad.push(`${PDF}: подпись слайда задана не у обеих локалей`);
    }
    if (/Diapositiva/.test(ru)) {
      bad.push(`${PDF}: в русской ветке рамки стоит испанская подпись слайда`);
    }
  }
  if (/\$\{SITE_URL\}\/es/.test(pdf)) {
    bad.push(`${PDF}: префикс ссылок жёстко /es — русская колода ведёт на испанские страницы (долг 209)`);
  }

  if (!/searchParams\.get\("lang"\)/.test(route) || !/isLocale\(/.test(route)) {
    bad.push(`${ROUTE}: локаль не читается из запроса и не проверяется isLocale — адрес снова один на обе локали`);
  }
  if (!/lang=\{lang\}/.test(route)) {
    bad.push(`${ROUTE}: локаль не передаётся в IntroDocument`);
  }
  if (!/\/api\/intro\/pdf\?lang=\$\{lang\}/.test(page)) {
    bad.push(`${PAGE}: кнопка скачивания не передаёт локаль — русская страница скачает испанский файл`);
  }
  return bad;
}

function plant() {
  const pdf = readFileSync(PDF, "utf8");
  const route = readFileSync(ROUTE, "utf8");
  const page = readFileSync(PAGE, "utf8");
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(pdf, route, page).length === 0 }];
  const add = (name, p, r, g, expect) => {
    if (p === pdf && r === route && g === page) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(p, r, g).some((f) => f.includes(expect)) });
  };

  add("подсадка: IntroDocument снова без lang", pdf.replace('IntroDocument({ stats, lang = "es" }', "IntroDocument({ stats }"), route, page, "не принимает lang");
  add("подсадка: слайды строятся без локали", pdf.replace("const introSlides = buildIntroSlides(stats, lang);", "const introSlides = buildIntroSlides(stats);"), route, page, "строятся без lang");
  add(
    "подсадка: русская рамка — копия испанской («перевели половину»)",
    pdf.replace('coverTitle: "Добро пожаловать в RusoFácilapp"', 'coverTitle: "Bienvenido a RusoFácilapp"'),
    route,
    page,
    "у обеих локалей одинаково",
  );
  add(
    "подсадка: испанская подпись слайда в русской ветке",
    pdf.replace("`Слайд ${page} из ${total}`", "`Diapositiva ${page} de ${total}`"),
    route,
    page,
    "испанская подпись слайда",
  );
  add("подсадка: вернуть жёсткий префикс /es у ссылок", pdf.replace("${SITE_URL}/${lang}${link.href}", "${SITE_URL}/es${link.href}"), route, page, "жёстко /es");
  add("подсадка: маршрут перестал читать локаль", pdf, route.replace('request.nextUrl.searchParams.get("lang") ?? ""', '""'), page, "не читается из запроса");
  add("подсадка: кнопка перестала передавать локаль", pdf, route, page.replace("/api/intro/pdf?lang=${lang}", "/api/intro/pdf"), "не передаёт локаль");

  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:intro-pdf-locale --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:intro-pdf-locale --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(readFileSync(PDF, "utf8"), readFileSync(ROUTE, "utf8"), readFileSync(PAGE, "utf8"));
  if (bad.length) {
    console.error(`check:intro-pdf-locale — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:intro-pdf-locale — 6 правил, нарушений 0 (долг 209)");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
