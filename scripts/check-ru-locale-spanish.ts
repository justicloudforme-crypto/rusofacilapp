/**
 * НА `/ru` НЕ ДОЛЖНО БЫТЬ ИСПАНСКОГО ТЕКСТА — 7.196, часть 4.
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Владелец снял 14.09.2026 два места в русской локали:
 *
 *   * каталог рассказов: заголовок русский («Подделка в винном погребе»),
 *     а описание испанское («Una joven sumiller descubre que su mentor…»)
 *     и подпись автора тоже («Автор: RusoFácil (relato original)»);
 *   * «Курсы» → «Перед первым уроком»: заголовки русские, а все десять
 *     слайдов презентации по-испански.
 *
 * Причины у них РАЗНЫЕ, и это измерено, а не предположено. Первая — в
 * данных: одна колонка на обе локали, `descriptionRu` пуст у 325 строк из
 * 325, `Story.author` держит испанский маркер у 277 из 325. Вторая — в
 * коде: колода вводной презентации писалась только по-испански.
 *
 * ====================================================================
 * КАК СУДИТСЯ «ЭТО ИСПАНСКИЙ»
 * ====================================================================
 *
 * Не «есть латиница» — по-русски пишут «Windows», «Telegram», «A1» и само
 * имя продукта. Судится по СЛОВАМ: блок считается испанским, если в нём
 * встретилось не меньше двух разных слов из списка ниже. Список короткий
 * и состоит из слов, которых в русском тексте быть не может.
 *
 * Позитивный контроль обязателен и сделан подсадкой НАСТОЯЩЕЙ строки,
 * снятой владельцем: если она не ловится, «0 находок» ничего не значит.
 *
 *   npx tsx scripts/check-ru-locale-spanish.ts --base=http://localhost:3123
 *   npx tsx scripts/check-ru-locale-spanish.ts --plant
 */
import { chromium } from "playwright";
import { isEntryPoint } from "../src/lib/entry-point";

/** Слова, которых в русском тексте не бывает. */
const SPANISH_WORDS = [
  "que",
  "de",
  "del",
  "los",
  "las",
  "una",
  "para",
  "con",
  "por",
  "más",
  "relato",
  "original",
  "cuento",
  "idioma",
  "ruso",
  "aprender",
  "lecciones",
  "gratis",
  "palabras",
  "está",
  "hay",
  "sus",
  "como",
];

/** Сколько разных испанских слов в блоке считается испанским текстом. */
const THRESHOLD = 2;

export function spanishWordsIn(text: string): string[] {
  const words = new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .filter(Boolean),
  );
  return SPANISH_WORDS.filter((w) => words.has(w));
}

/** Настоящие строки, снятые владельцем с экрана, — для позитивного контроля. */
const REAL_SPANISH = [
  "Una joven sumiller descubre que su mentor lleva tiempo falsificando botellas de vino raro",
  "Автор: RusoFácil (relato original)",
  "Un idioma que se habla en medio mundo",
  "El ruso lo hablan cerca de 258 millones de personas",
];

/** И русские строки тех же мест — отрицательный контроль. */
const REAL_RUSSIAN = [
  "Подделка в винном погребе",
  "Автор: RusoFácil (оригинальный рассказ)",
  "Язык, на котором говорит полмира",
  "Android: Настройки › Система › Языки › Экранная клавиатура › Русский",
  "Windows: Windows и пробел · Mac: Control и пробел",
];

function selfTest(): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  for (const text of REAL_SPANISH) {
    const hits = spanishWordsIn(text);
    const caught = hits.length >= THRESHOLD;
    if (!caught) ok = false;
    lines.push(`  ${caught ? "поймано" : "ПРОПУЩЕНО"} — «${text.slice(0, 48)}…» (${hits.join(", ") || "нет слов"})`);
  }
  for (const text of REAL_RUSSIAN) {
    const hits = spanishWordsIn(text);
    const quiet = hits.length < THRESHOLD;
    if (!quiet) ok = false;
    lines.push(`  ${quiet ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — «${text.slice(0, 48)}…» (${hits.join(", ") || "—"})`);
  }
  return { ok, lines };
}

const PLACES: Array<{ name: string; path: string; selector: string; min: number; next?: string; steps?: number }> = [
  { name: "каталог рассказов", path: "/ru/stories", selector: "[data-testid=story-card]", min: 5 },
  // Слайд на экране один, остальные девять — за кнопкой «Далее». Без
  // перелистывания сторож судил бы один слайд из десяти и отчитался бы
  // «0 испанских строк» про колоду, которую не видел.
  { name: "«Перед первым уроком»", path: "/ru/courses", selector: "[data-testid=intro-slide-card]", min: 1, next: "[data-testid=intro-next]", steps: 9 },
];

export async function main(): Promise<number> {
  const plant = process.argv.includes("--plant");
  /**
   * `--ci` — ФОРМА ПУСТОЙ БАЗЫ, а не ослабление правила.
   *
   * Пол по числу блоков («каталог обязан отдать хотя бы пять карточек»)
   * стоит здесь затем, чтобы «0 испанских строк» нельзя было доказать
   * пустым экраном. Но база CI держит фикстуру из трёх рассказов, и пол в
   * пять сделал бы проверку красной по ДАННЫМ, а не по находке. Под `--ci`
   * пол опускается до ОДНОГО блока: ноль по-прежнему отказ, а само
   * правило — «на /ru нет испанского» — не слабеет ни на знак, потому что
   * оно судит КАЖДЫЙ найденный блок.
   */
  const ci = process.argv.includes("--ci");
  if (plant) {
    const { ok, lines } = selfTest();
    for (const line of lines) console.log(line);
    console.log(
      ok
        ? `check:ru-spanish --plant — все ${REAL_SPANISH.length} настоящих испанских строк пойманы, все ${REAL_RUSSIAN.length} русских прошли молча`
        : "check:ru-spanish --plant — FAILED: проверка не умеет отличать одно от другого",
    );
    return ok ? 0 : 1;
  }

  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  if (!baseArg) {
    console.error("нужен --base=http://… — живую половину без сервера не прогнать");
    return 1;
  }
  const base = baseArg.slice("--base=".length);

  const browser = await chromium.launch();
  const problems: string[] = [];
  let blocks = 0;
  try {
    const page = await browser.newPage();
    for (const place of PLACES) {
      await page.goto(`${base}${place.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForSelector(place.selector, { timeout: 30_000 });
      const texts: string[] = [];
      const grab = async () =>
        texts.push(
          ...(await page.$$eval(place.selector, (els) => els.map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()))),
        );
      await grab();
      for (let step = 0; step < (place.steps ?? 0); step += 1) {
        await page.click(place.next!);
        await page.waitForTimeout(150);
        await grab();
      }
      const min = ci ? 1 : place.min;
      if (texts.length < min) {
        problems.push(`${place.name}: блоков ${texts.length} при минимуме ${min} — экран не собрался`);
        continue;
      }
      for (const text of texts) {
        blocks += 1;
        const hits = spanishWordsIn(text);
        if (hits.length >= THRESHOLD) {
          problems.push(`${place.name}: испанский текст («${hits.join(", ")}») — «${text.slice(0, 90)}…»`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (problems.length) {
    console.error("ИСПАНСКИЙ ТЕКСТ В РУССКОЙ ЛОКАЛИ:");
    for (const p of problems.slice(0, 20)) console.error(`  ${p}`);
    if (problems.length > 20) console.error(`  … и ещё ${problems.length - 20}`);
    return 1;
  }
  console.log(`check:ru-spanish — просмотрено блоков ${blocks} в ${PLACES.length} местах: испанских строк 0.`);
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
