/**
 * У КАЖДОГО ВИДА СОДЕРЖИМОГО СВОЙ КЕШ СО СВОИМ ПОТОЛКОМ — ДОЛГИ 75, 76, 77.
 *
 * Три строки таблицы долгов про один воркер; полные их формулировки
 * процитированы в шапке `src/lib/sw-cache-policy.ts`, чтобы не разойтись
 * с кодом. Коротко:
 *
 *   75 — `rf-pages-rsc-prefetch` держал 139 записей против объявленных 32,
 *        и объявление было ЧУЖОЕ: переименованная стратегия заимствовала
 *        плагин у `@serwist/next`, то есть число приходило из
 *        `node_modules` и чинить его было негде;
 *   76 — документы делили тридцать две записи со статикой в всеохватном
 *        `others`, и офлайн из 12 адресов открывались 8;
 *   77 — маршрут клипов не срабатывал ВОВСЕ: `RegExpRoute` не применяет
 *        регулярку к чужому адресу, если совпадение начинается не с
 *        нулевого символа.
 *
 * ШЕСТЬ ПРАВИЛ:
 *   а) таблица бюджетов объявлена в `src/lib/sw-cache-policy.ts` и
 *      называет все пять кешей;
 *   б) воркер берёт сроки годности ИЗ НЕЁ и не заимствует чужие плагины
 *      (`plugins: (route.handler as …).plugins` — это и есть долг 75);
 *   в) у документов свой маршрут, и судит он по `request.mode`, а НЕ по
 *      заголовку `Content-Type` запроса, которого у навигации не бывает;
 *   г) маршрут документов стоит ДО всеохватного `others`;
 *   д) клипы судятся функцией `isAudioClipUrl`, а не регуляркой;
 *   е) ответ чужого источника кешируется и непрозрачным (`statuses: [0, 200]`),
 *      иначе кеш клипов снова окажется пустым при живых ответах 200;
 *   ж) срок годности удаляет записи с `ignoreVary: true` — и это
 *      НАСТОЯЩАЯ причина долга 75, найденная экспериментом 19.09.2026:
 *      без него `cache.delete(url)` не совпадает ни с одной записью
 *      ответа RSC (у того длинный `Vary`), и кеш растёт неограниченно.
 *      Замер на собранном воркере: 689 предзагрузок → **704 записи** без
 *      этого признака и **ровно 64** с ним при объявленных 64.
 *
 *   node scripts/check-sw-cache-policy.mjs          # гейт
 *   node scripts/check-sw-cache-policy.mjs --plant  # контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const POLICY = "src/lib/sw-cache-policy.ts";
const SW = "src/app/sw.ts";
const KEYS = ["html", "rsc", "rscPrefetch", "others", "audio"];

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

export function violations(policyRaw, swRaw) {
  const bad = [];
  const policy = stripComments(policyRaw);
  const sw = stripComments(swRaw);

  if (!policy.trim()) {
    bad.push(`${POLICY}: таблицы бюджетов нет — потолки снова приходят из node_modules (долги 75, 76, 77)`);
    return bad;
  }
  for (const key of KEYS) {
    if (!new RegExp(`key:\\s*"${key}"`).test(policy)) {
      bad.push(`${POLICY}: бюджета для кеша «${key}» нет — этот кеш снова растёт по чужому объявлению`);
    }
  }
  if (!/export function isAudioClipUrl\(/.test(policy)) {
    bad.push(`${POLICY}: правила «это клип озвучки» нет — долг 77 вернулся дословно`);
  }
  if (!/hostname\.endsWith\(/.test(policy)) {
    bad.push(`${POLICY}: чужой источник узнаётся не по КОНЦУ имени хоста — подставной адрес содержит ту же подстроку`);
  }

  if (!sw.trim()) {
    bad.push(`${SW}: воркер не прочитан — сторож ослеп, а не доволен`);
    return bad;
  }
  if (/plugins:\s*\(route\.handler/.test(sw)) {
    bad.push(`${SW}: переименованная стратегия снова заимствует ЧУЖИЕ плагины — потолок приходит из node_modules (долг 75)`);
  }
  if (!/plugins:\s*\[expiration\(/.test(sw)) {
    bad.push(`${SW}: сроки годности берутся не из нашей таблицы (долг 75)`);
  }
  if (!/matchOptions:\s*\{\s*ignoreVary:\s*true\s*\}/.test(sw)) {
    bad.push(`${SW}: удаление по сроку годности снова учитывает Vary — cache.delete(url) не совпадёт ни с одной записью ответа RSC, и кеш будет расти неограниченно (долг 75, замер: 704 записи при объявленных 64)`);
  }
  if (!/CACHE_BUDGET_BY_KEY/.test(sw)) {
    bad.push(`${SW}: таблица бюджетов воркером не читается вовсе (долги 75, 76, 77)`);
  }

  // в, г) свой маршрут документов, и он стоит до всеохватного `others`
  const navRoute = /request\.mode === "navigate"/.test(sw);
  if (!navRoute) {
    bad.push(`${SW}: у документов нет своего маршрута — они снова делят кеш со статикой (долг 76)`);
  } else {
    const navAt = sw.indexOf('request.mode === "navigate"');
    const spreadAt = sw.indexOf("...runtimeCaching");
    if (spreadAt !== -1 && navAt > spreadAt) {
      bad.push(`${SW}: маршрут документов стоит ПОСЛЕ всеохватного others — тот заберёт запрос первым (долг 76)`);
    }
  }
  if (/headers\.get\("Content-Type"\)/.test(sw)) {
    bad.push(`${SW}: документ снова судится по заголовку Content-Type запроса, которого навигация не шлёт (долг 76)`);
  }

  // д, е) клипы
  if (!/matcher:\s*\(\{ url \}: \{ url: URL \}\) => isAudioClipUrl\(url\)/.test(sw)) {
    bad.push(`${SW}: клипы не судятся функцией isAudioClipUrl — регулярка на чужом адресе не применяется (долг 77)`);
  }
  if (!/statuses:\s*\[0,\s*200\]/.test(sw)) {
    bad.push(`${SW}: непрозрачный ответ чужого источника не кешируется — кеш клипов снова будет пуст при живых 200 (долг 77)`);
  }
  if (!/AUDIO_CACHE_NAME/.test(sw)) {
    bad.push(`${SW}: у клипов нет своего кеша (долг 77)`);
  }
  return bad;
}

function read(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function plant() {
  const policy = read(POLICY);
  const sw = read(SW);
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(policy, sw).length === 0 }];
  const add = (name, p, w, expect) => {
    if (p === policy && w === sw) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(p, w).some((x) => x.includes(expect)) });
  };

  add("подсадка: таблицы бюджетов нет вовсе (состояние до 19.09.2026)", "", sw, "таблицы бюджетов нет");
  add("подсадка: бюджет клипов убран из таблицы", policy.replace('key: "audio"', 'key: "audioX"'), sw, "кеша «audio» нет");
  add(
    "подсадка: воркер снова заимствует чужие плагины (ровно долг 75)",
    policy,
    sw.replace(/plugins: \[expiration\(BUDGET_KEY\[current!\]\)\]/, "plugins: (route.handler as { plugins?: unknown[] }).plugins"),
    "заимствует ЧУЖИЕ плагины",
  );
  add(
    "подсадка: у документов снова нет своего маршрута (ровно долг 76)",
    policy,
    sw.replace(/request\.mode === "navigate"/g, 'request.headers.get("Content-Type")?.includes("text/html")'),
    "Content-Type",
  );
  add(
    "подсадка: клипы снова судятся регуляркой (ровно долг 77)",
    policy,
    sw.replace("matcher: ({ url }: { url: URL }) => isAudioClipUrl(url)", "matcher: /\\.(mp3|wav|ogg)$/i"),
    "не судятся функцией isAudioClipUrl",
  );
  add(
    "подсадка: непрозрачный ответ перестал кешироваться",
    policy,
    sw.replaceAll("statuses: [0, 200]", "statuses: [200]"),
    "непрозрачный ответ",
  );
  add(
    "подсадка: удаление по сроку годности снова учитывает Vary (НАСТОЯЩАЯ причина долга 75)",
    policy,
    sw.replaceAll("matchOptions: { ignoreVary: true },", ""),
    "снова учитывает Vary",
  );
  add(
    "подсадка: чужой источник снова узнаётся подстрокой",
    policy.replace("url.hostname.endsWith(AUDIO_HOST_SUFFIX)", "url.hostname.includes(AUDIO_HOST_SUFFIX)"),
    sw,
    "не по КОНЦУ имени хоста",
  );

  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:sw-cache-policy --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:sw-cache-policy --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(read(POLICY), read(SW));
  if (bad.length) {
    console.error(`check:sw-cache-policy — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log(`check:sw-cache-policy — 7 правил, кешей ${KEYS.length}, нарушений 0 (долги 75, 76, 77)`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
