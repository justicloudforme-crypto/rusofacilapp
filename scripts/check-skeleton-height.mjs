/**
 * У ЗАГЛУШКИ КАБИНЕТА ЕСТЬ СВОЯ ВЫСОТА — ДОЛГ 212 (заход 7.216).
 *
 * ЧТО БЫЛО ИЗМЕРЕНО. Под медленным 3G (400 кбит/с, задержка 400 мс),
 * 360×720, под признаком оболочки: подвал появляется на 615 мс,
 * содержимое кабинета — на 4564 мс, вторая таблица стилей — на 4260 мс.
 * Все 17 блоков заглушки `profile/loading.tsx` брали высоту ТОЛЬКО из
 * классов Tailwind, поэтому до 4260 мс каждый занимал 0 px, и человек
 * почти четыре секунды видел подвал и нижнюю панель над пустотой.
 *
 * ЧИСЛО ДО/ПОСЛЕ, снятое без таблицы стилей вовсе (19.09.2026):
 * высота середины **0 px → 452 px**, блоков нулевой высоты **17 из 17 →
 * 0 из 17**.
 *
 * ПРАВИЛО. Каждый `<Skeleton>` в `src/app/[lang]/profile/loading.tsx`
 * называет свою высоту ДВАЖДЫ: классом `h-*` (работает после таблицы
 * стилей) и числом `height={…}` (инлайновый стиль, работает с первого
 * байта документа). Оба обязаны говорить одно и то же — инлайн сильнее
 * класса, и разойдясь они дали бы прыжок высоты в тот миг, когда стили
 * приедут.
 *
 * ПОЧЕМУ НЕ УМОЛЧАНИЕ ВНУТРИ `Skeleton`. Инлайновый стиль перебивает
 * класс ВСЕГДА, а не только до загрузки стилей; умолчание из варианта
 * молча срезало бы `h-64`, `h-48`, `h-14` у 14 живых вызовов в карточках
 * и упражнениях. Поэтому высоту называет тот, кто её знает.
 *
 * ЧЕГО ЭТОТ СТОРОЖ НЕ ОБЕЩАЕТ: он про заглушку КАБИНЕТА, названную
 * долгом, а не про все заглушки сайта. Остальные страницы этот класс
 * отказа не показывали, и расширять правило на них без замера значило бы
 * чинить по догадке.
 *
 *   node scripts/check-skeleton-height.mjs          # гейт
 *   node scripts/check-skeleton-height.mjs --plant  # контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const LOADING = "src/app/[lang]/profile/loading.tsx";

/** Высота класса Tailwind в пикселях: `h-N` = N × 0.25rem = N × 4 px. */
export function classHeightPx(cls) {
  const m = /(?:^|\s)h-(\d+(?:\.\d+)?)(?:\s|$)/.exec(cls);
  return m ? Number(m[1]) * 4 : null;
}

export function violations(raw) {
  // Комментарии вон: в этом файле правило объяснено словами, и в словах
  // стоят и `h-4`, и `height`.
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
  const tags = code.match(/<Skeleton\b[^>]*\/>/g) ?? [];
  const bad = [];
  if (tags.length === 0) {
    bad.push(`${LOADING}: ни одного <Skeleton> не найдено — сторож ослеп, а не доволен`);
    return bad;
  }
  for (const tag of tags) {
    const cls = /className="([^"]*)"/.exec(tag)?.[1] ?? "";
    const h = /height=\{(\d+)\}/.exec(tag);
    const flat = tag.replace(/\s+/g, " ");
    if (!h) {
      bad.push(`${LOADING}: у блока нет height={…} — до таблицы стилей он занимает 0 px (долг 212): ${flat}`);
      continue;
    }
    const fromClass = classHeightPx(cls);
    if (fromClass === null) {
      bad.push(`${LOADING}: у блока есть height={${h[1]}}, но класса h-* нет — после стилей высота прыгнет: ${flat}`);
      continue;
    }
    if (fromClass !== Number(h[1])) {
      bad.push(
        `${LOADING}: класс и число расходятся — класс даёт ${fromClass} px, height={${h[1]}}: ${flat}`,
      );
    }
  }
  return bad;
}

function plant() {
  const src = readFileSync(LOADING, "utf8");
  const cases = [{ name: "отрицательный контроль: живой файл сегодня чист", ok: violations(src).length === 0 }];
  const add = (name, mutated, expect) => {
    if (mutated === src) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(mutated).some((f) => f.includes(expect)) });
  };

  add("подсадка: убрать height у одного блока — поймано", src.replace(' height={32}', ""), "нет height=");
  add(
    "подсадка: состояние ДО правки — снять height у ВСЕХ блоков",
    src.replace(/ height=\{\d+\}/g, ""),
    "нет height=",
  );
  add("подсадка: число разошлось с классом — поймано", src.replace("height={44}", "height={40}"), "класс и число расходятся");
  add("подсадка: число есть, класса высоты нет — поймано", src.replace('className="h-5 w-40"', 'className="w-40"'), "класса h-* нет");
  add("подсадка: убрать все заглушки — сторож ослеп, а не доволен", src.replace(/<Skeleton\b[^>]*\/>/g, "<div />"), "сторож ослеп");

  // Отдельный контроль самой единицы измерения: h-11 это 44 px, а не 11.
  cases.push({ name: "единица измерения: h-11 = 44 px", ok: classHeightPx("mt-4 h-11 w-full") === 44 });
  cases.push({ name: "единица измерения: без класса h-* — null", ok: classHeightPx("mt-4 w-full") === null });

  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:skeleton-height --plant — ${cases.length - 1} из ${cases.length - 1} подсадок и контролей, 1 из 1 отрицательный` : "check:skeleton-height --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const raw = readFileSync(LOADING, "utf8");
  const bad = violations(raw);
  if (bad.length) {
    console.error(`check:skeleton-height — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  const n = (raw.match(/<Skeleton\b/g) ?? []).length;
  console.log(`check:skeleton-height — мест с заглушкой ${n} (17 блоков на экране), у всех высота названа и классом, и числом (долг 212)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
