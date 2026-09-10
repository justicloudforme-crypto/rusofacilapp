// «Кнопка «слушать» есть, а записи для неё не отдано» — сторож долга 116.
//
// 09.09.2026, заход 7.161. Долг 114 (`docs/audio-voice-audit-2026-09-09.md`)
// прожил незамеченным ровно потому, что такого сторожа не было ни одного:
// страница рассказа рисовала непокупателю рабочую кнопку «Escuchar el
// texto», не отдав ему НИ ОДНОЙ настоящей записи, и кнопка уходила в
// аварийный `SpeechSynthesisUtterance` — системный голос ОС (на macOS/iOS
// это женская Milena, 219,2 Гц). Замер 7.160 сделан руками; здесь он
// превращён в правило.
//
// ПРАВИЛО (асимметричное, как у `check:mark-truth`):
//
//   если в разметке страницы отрисован орган управления «слушать»,
//   та же разметка ОБЯЗАНА нести настоящую запись.
//
//   Обратное правилом НЕ является: запись без кнопки — не нарушение
//   (так выглядит, например, страница без очереди предложений).
//
// Оба признака берутся из САМОЙ разметки, а не из пропсов, и ловушка 7.140
// обойдена по построению: в теле страницы атрибут написан обычными
// кавычками (`aria-label="…"`), а во flight-payload React — экранированными
// (`\"playLabel\":\"…\"`), поэтому словарный payload за кнопку не считается.
//
//   * кнопка       — `aria-label="<playLabel>"` / `"<pauseLabel>"`;
//   * запись       — элемент `<audio …>`, который `StoryText.tsx` рисует
//                    ровно при `hasRealAudio` (`:1130`), то есть только
//                    когда настоящие клипы или склейка реально отданы.
//
// Слепота сторожа — тоже отказ. Ярлык кнопки читается из словаря, а не
// вшит сюда (иначе правка текста молча ослепила бы правило), и прогон, в
// котором кнопка не найдена НИ НА ОДНОЙ странице, признаётся отказом, а не
// чистым результатом — как и прогон по пустому списку страниц.
//
// Поверхности: сегодня только рассказы. Другие поверхности со звуком
// (карточки, идиомы, уроки, глоссарий) — долг 117, отдельный заход.
//
//   node scripts/check-silent-listen.mjs                        # база http://localhost:3000
//   node scripts/check-silent-listen.mjs --base=https://rusofacilapp.com
//   node scripts/check-silent-listen.mjs --limit=25             # первые N страниц
//   node scripts/check-silent-listen.mjs --plant                # контроли, без сети
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ARGS = process.argv.slice(2);
const PLANT = ARGS.includes("--plant");
const BASE = (ARGS.find((a) => a.startsWith("--base="))?.slice(7) ?? "http://localhost:3000").replace(/\/+$/, "");
const LIMIT = Number(ARGS.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0) || 0;
const CONCURRENCY = 8;

/** Локаль замера. Ярлыки берутся из её словаря. */
const LANG = ARGS.find((a) => a.startsWith("--lang="))?.slice(7) ?? "es";

function dictLabels(lang) {
  const path = join(process.cwd(), "src", "dictionaries", `${lang}.json`);
  const dict = JSON.parse(readFileSync(path, "utf8"));
  const play = dict?.stories?.playLabel;
  const pause = dict?.stories?.pauseLabel;
  if (typeof play !== "string" || typeof pause !== "string" || !play || !pause) {
    throw new Error(`в ${lang}.json не найдены stories.playLabel / stories.pauseLabel — сторож ослеп бы молча`);
  }
  return { play, pause };
}

/** Кнопка «слушать» в ТЕЛЕ страницы (не в payload — см. шапку). */
export function hasListenButton(html, labels) {
  return html.includes(`aria-label="${labels.play}"`) || html.includes(`aria-label="${labels.pause}"`);
}

/** Настоящая запись отдана: `StoryText` рисует `<audio>` только при `hasRealAudio`. */
export function hasRealRecording(html) {
  return /<audio[\s>]/.test(html);
}

/** Числа рядом с приговором, чтобы отказ читался, а не угадывался. */
export function inspect(html, labels) {
  const button = hasListenButton(html, labels);
  const audio = hasRealRecording(html);
  const blobLinks = (html.match(/public\.blob\.vercel-storage\.com/g) ?? []).length;
  const emptySegments = /audioSegments\\?":\s*\[\]/.test(html);
  const nullFullAudio = /fullAudioUrl\\?":\s*null/.test(html);
  return { button, audio, blobLinks, emptySegments, nullFullAudio, silent: button && !audio };
}

async function storyUrls(base) {
  const res = await fetch(`${base}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap ${base}/sitemap.xml отдал ${res.status}`);
  const xml = await res.text();
  // Ловушка замера: sitemap ВСЕГДА печатает боевой хост, даже когда его
  // отдал сервер на localhost (`SITE_URL` — константа сборки). Первый
  // прогон этого сторожа по локальной базе из-за этого честно ходил на
  // прод и печатал «323» вместо локального числа. Берём путь, хост —
  // только тот, что назван в --base.
  const all = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = all
    .map((u) => {
      try {
        return `${base}${new URL(u).pathname}`;
      } catch {
        return null;
      }
    })
    .filter((u) => u !== null)
    .filter((u) => u.includes(`/${LANG}/stories/`));
  return LIMIT ? urls.slice(0, LIMIT) : urls;
}

async function sweep(urls, labels) {
  const rows = [];
  let cursor = 0;
  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= urls.length) return;
      const url = urls[index];
      let html = "";
      let status = 0;
      try {
        const res = await fetch(url, { redirect: "follow" });
        status = res.status;
        html = await res.text();
      } catch (err) {
        rows.push({ url, status: 0, error: String(err), silent: false, unreachable: true });
        continue;
      }
      rows.push({ url, status, ...inspect(html, labels), unreachable: status !== 200 });
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  rows.sort((a, b) => a.url.localeCompare(b.url));
  return rows;
}

/**
 * Контроли без сети. Формы взяты с живого прода 09.09.2026: закрытый
 * рассказ `cmsxtr64d0086qwnc6bbqn8us` (кнопка есть, `<audio>` нет, ссылок
 * на blob 0) и бесплатный `cmsxtq13w000cqwnc466c87es` (есть всё).
 */
function fixtures(labels) {
  const button = `<div class="flex items-center gap-3 sm:contents"><button type="button" aria-label="${labels.play}" title="${labels.play}" class="..."><span aria-hidden="true">▶</span></button></div>`;
  const audio = `<audio preload="metadata" class="hidden"></audio>`;
  const payload = `<script>self.__next_f.push([1,"{\\"closeLabel\\":\\"Cerrar\\",\\"playLabel\\":\\"${labels.play}\\",\\"pauseLabel\\":\\"${labels.pause}\\"}"])</script>`;
  return [
    {
      name: "подсадка: кнопка есть, записи не отдано (форма долга 114)",
      html: `<main>${button}<p>Первый абзац.</p>${payload}</main>`,
      mustCatch: true,
    },
    {
      name: "контроль: кнопка и запись вместе (бесплатный рассказ)",
      html: `<main>${audio}${button}<p>Первый абзац.</p>${payload}</main>`,
      mustCatch: false,
    },
    {
      name: "контроль: ни кнопки, ни записи (превью без клипов после правки)",
      html: `<main><p>Первый абзац.</p>${payload}</main>`,
      mustCatch: false,
    },
    {
      name: "контроль: запись без кнопки — правило асимметрично",
      html: `<main>${audio}<p>Первый абзац.</p>${payload}</main>`,
      mustCatch: false,
    },
    {
      name: "контроль: только словарный payload — за кнопку не считается (ловушка 7.140)",
      html: `<main><p>Первый абзац.</p>${payload}</main>`,
      mustCatch: false,
    },
  ];
}

function runPlant() {
  const labels = dictLabels(LANG);
  const cases = fixtures(labels);
  let caught = 0;
  let planted = 0;
  let cleanControls = 0;
  let controls = 0;
  console.log(`check:silent-listen --plant  (ярлык кнопки: «${labels.play}»)`);
  for (const c of cases) {
    const verdict = inspect(c.html, labels);
    if (c.mustCatch) {
      planted += 1;
      if (verdict.silent) caught += 1;
      console.log(`  ${verdict.silent ? "поймано" : "ПРОПУЩЕНО"} — ${c.name}`);
    } else {
      controls += 1;
      if (!verdict.silent) cleanControls += 1;
      console.log(`  ${verdict.silent ? "ЛОЖНОЕ СРАБАТЫВАНИЕ" : "чисто"} — ${c.name}`);
    }
  }
  console.log(`  подсажено ${planted}, поймано ${caught} из ${planted}`);
  console.log(`  отрицательных контролей ${cleanControls} из ${controls} чисты`);
  return caught === planted && cleanControls === controls ? 0 : 1;
}

async function runSweep() {
  const labels = dictLabels(LANG);
  const urls = await storyUrls(BASE);
  if (urls.length === 0) {
    console.error(`[check:silent-listen] в sitemap ${BASE} нет ни одной страницы рассказа — мерить нечего, это отказ, а не чистый прогон`);
    return 1;
  }
  const rows = await sweep(urls, labels);
  const reachable = rows.filter((r) => !r.unreachable);
  const withButton = reachable.filter((r) => r.button);
  const silent = reachable.filter((r) => r.silent);

  console.log(`[check:silent-listen] база ${BASE}, локаль ${LANG}, страниц ${rows.length}, отвечают 200: ${reachable.length}`);
  console.log(`  с кнопкой «слушать»: ${withButton.length}`);
  console.log(`  из них без единой настоящей записи: ${silent.length}`);

  if (withButton.length === 0) {
    console.error(`  кнопка не найдена НИ НА ОДНОЙ странице — сторож слеп (ярлык «${labels.play}» разошёлся с разметкой), это отказ`);
    return 1;
  }
  const unreachable = rows.filter((r) => r.unreachable);
  if (unreachable.length) {
    console.error(`  не прочитано страниц: ${unreachable.length}`);
    for (const r of unreachable.slice(0, 10)) console.error(`    ${r.url} — ${r.status || r.error}`);
    return 1;
  }
  for (const r of silent.slice(0, 20)) {
    console.error(`    ${r.url}  blob:${r.blobLinks}  audioSegments пуст:${r.emptySegments}  fullAudioUrl null:${r.nullFullAudio}`);
  }
  if (silent.length > 20) console.error(`    …и ещё ${silent.length - 20}`);
  return silent.length ? 1 : 0;
}

async function main() {
  return PLANT ? runPlant() : await runSweep();
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exit(await main());
