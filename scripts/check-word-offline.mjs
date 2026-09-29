/**
 * «Перевод слова без сети говорит про интернет» — сторож долга 360
 * (заход 7.247).
 *
 * ЧТО БЫЛО. Владелец на POCO (1.0.12): скачанный рассказ без интернета,
 * нажатие на слово — «No se pudo traducir esta palabra.». Любой отказ,
 * в том числе запрос, не дошедший до сервера, давал одну фразу
 * `translationError`, и причина («нужен интернет») не называлась никак.
 * Прогон e2e на `main` e1224af показал это на обоих языках.
 *
 * ПОВЕДЕНИЕ заперто рядом: `StoryText.word-offline.test.tsx` (три исхода
 * одного нажатия, отказ сервера — позитивный контроль) и
 * `e2e/story-word-offline.spec.ts` (настоящий service worker, без сети и
 * с сетью). ЗДЕСЬ заперта СТРУКТУРА — места, порознь каждое из которых
 * возвращает болезнь или ломает соседний исход:
 *
 *   1) отказ запроса (`catch` вокруг `fetch('/api/dictionary/translate')`)
 *      ставит `offline`, а не `error`;
 *   2) ответ-отказ сервера (`!res.ok`) по-прежнему ставит `error` — иначе
 *      «нет сети» врало бы там, где сломан сервер;
 *   3) слово из кеша возвращается ДО запроса (`if (cached) return;`);
 *   4) карточка рисует `dict.translationOffline` для `offline`;
 *   5) страница рассказа передаёт `translationOffline` из словаря;
 *   6) тексты в `es.json`/`ru.json` — именно эти, es на «tú», ru на «вы»,
 *      и не совпадают с прежней фразой.
 *
 *   node scripts/check-word-offline.mjs          # гейт
 *   node scripts/check-word-offline.mjs --plant  # позитивный и отрицательный контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const FILES = {
  story: "src/components/stories/StoryText.tsx",
  page: "src/app/[lang]/stories/[id]/page.tsx",
  es: "src/dictionaries/es.json",
  ru: "src/dictionaries/ru.json",
};
export const OFFLINE_ES = "Sin conexión: para traducir palabras necesitas internet.";
export const OFFLINE_RU = "Нет подключения: для перевода слов нужен интернет.";

function read() {
  return Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, readFileSync(p, "utf8")]));
}

/** Кусок исходника от запроса перевода до конца его `catch { … }`. */
function translateTry(code) {
  const at = code.indexOf("fetch(`/api/dictionary/translate");
  if (at === -1) return null;
  const katch = code.indexOf("} catch {", at);
  if (katch === -1) return null;
  const end = code.indexOf("\n    }", katch);
  return { body: code.slice(at, katch), katch: code.slice(katch, end === -1 ? undefined : end), before: code.slice(0, at) };
}

export function violationsIn(src) {
  const bad = [];
  const t = translateTry(src.story);
  if (t === null) {
    bad.push("в StoryText нет запроса `/api/dictionary/translate` с `catch` — сторож ослеп, а не доволен");
  } else {
    if (!/setTranslation\(\{\s*status:\s*"offline"\s*\}\)/.test(t.katch)) {
      bad.push("отказ запроса перевода (нет сети) не ставит status \"offline\" — вернётся «No se pudo traducir» без сети (долг 360)");
    }
    if (/status:\s*"error"/.test(t.katch)) {
      bad.push("в catch запроса перевода снова стоит status \"error\" — без сети человек не узнает, что нужен интернет (долг 360)");
    }
    if (!/!res\.ok[\s\S]*?setTranslation\(\{\s*status:\s*"error"\s*\}\)/.test(t.body)) {
      bad.push("отказ СЕРВЕРА (`!res.ok`) больше не ставит status \"error\" — «нет сети» соврёт там, где сломан сервер");
    }
    const tail = t.before.slice(-4000);
    if (!/readCachedTranslation\(word\)/.test(tail) || !/if\s*\(\s*cached\s*\)\s*return;/.test(tail)) {
      bad.push("слово из кеша больше не возвращается ДО запроса — без сети переведённое раньше слово покажет ошибку");
    }
  }
  if (!/translation\?\.status\s*===\s*"offline"\s*&&\s*dict\.translationOffline/.test(src.story)) {
    bad.push("карточка перевода не рисует dict.translationOffline для status \"offline\"");
  }
  if (!/translationOffline:\s*dict\.stories\.translationOffline/.test(src.page)) {
    bad.push("страница рассказа не передаёт translationOffline из словаря в StoryText");
  }
  for (const [lang, want] of [
    ["es", OFFLINE_ES],
    ["ru", OFFLINE_RU],
  ]) {
    let stories;
    try {
      stories = JSON.parse(src[lang]).stories ?? {};
    } catch {
      bad.push(`${lang}.json не разбирается как JSON`);
      continue;
    }
    if (stories.translationOffline !== want) {
      bad.push(`${lang}.json: stories.translationOffline ≠ «${want}» (сейчас «${stories.translationOffline ?? "нет"}»)`);
    }
    if (stories.translationOffline && stories.translationOffline === stories.translationError) {
      bad.push(`${lang}.json: текст «нет сети» совпал с прежней фразой ошибки — различия нет`);
    }
  }
  return bad;
}

function plant() {
  const raw = read();
  const cases = [];
  const planted = (file, from, to, name, expect) => {
    const mutated = { ...raw, [file]: raw[file].replace(from, to) };
    if (mutated[file] === raw[file]) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    const found = violationsIn(mutated);
    cases.push({ name, ok: found.some((f) => f.includes(expect)) });
  };

  cases.push({ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violationsIn(raw).length === 0 });
  planted(
    "story",
    'setTranslation({ status: "offline" });\n    }',
    'setTranslation({ status: "error" });\n    }',
    "подсадка: вернуть «error» в catch (как на main e1224af) — поймано",
    "снова стоит status",
  );
  planted(
    "story",
    'setTranslation({ status: "error" });\n        return;',
    'setTranslation({ status: "offline" });\n        return;',
    "подсадка: отказ сервера говорит «нет сети» — поймано",
    "отказ СЕРВЕРА",
  );
  planted("story", "    if (cached) return;\n", "", "подсадка: слово из кеша идёт в сеть — поймано", "из кеша");
  planted(
    "story",
    '{translation?.status === "offline" && dict.translationOffline}',
    "",
    "подсадка: карточка не рисует текст «нет сети» — поймано",
    "не рисует",
  );
  planted(
    "page",
    "translationOffline: dict.stories.translationOffline,",
    "",
    "подсадка: страница не передаёт текст — поймано",
    "не передаёт",
  );
  planted("es", OFFLINE_ES, "No se pudo traducir esta palabra.", "подсадка: es-текст равен прежней фразе — поймано", "es.json");
  planted("ru", OFFLINE_RU, "Нет подключения: для перевода слов нужен интернет", "подсадка: ru-текст изменён — поймано", "ru.json");

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:word-offline --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violationsIn(read());
  if (bad.length) {
    console.error("ПЕРЕВОД СЛОВА БЕЗ СЕТИ СНОВА НЕ НАЗЫВАЕТ ПРИЧИНУ (долг 360):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(
    "[check:word-offline] без сети — «Sin conexión…»/«Нет подключения…», отказ сервера — прежняя фраза, кеш — до запроса (контроль — --plant).",
  );
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
