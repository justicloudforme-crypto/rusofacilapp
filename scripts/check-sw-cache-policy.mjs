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
 *   е) НЕПРОЗРАЧНЫЙ ответ в кеш клипов НЕ кладётся (`statuses: [200]`, без
 *      нуля) — правило ПЕРЕВЁРНУТО 20.09.2026 (заход 7.218) замером, а не
 *      вкусом. Прежнее `[0, 200]` клало в кеш ответ `status 0`,
 *      `type "opaque"` с НЕЧИТАЕМЫМ телом (снятая длина 0 байт при файле в
 *      1 303 724), и на втором прослушивании `RangeRequestsPlugin` резал из
 *      него кусок и отдавал 416 с пустым телом: элемент `<audio>` получал
 *      `MEDIA_ERR_SRC_NOT_SUPPORTED` (код 4) и молчал. То есть кеш клипов
 *      не просто не помогал, а ЛОМАЛ повторное прослушивание всего, что
 *      человек уже слушал;
 *   з) клип берётся ЦЕЛИКОМ и с CORS (`requestWillFetch` → `mode: "cors"`),
 *      иначе непрозрачного ответа не избежать: элемент `<audio>` ходит
 *      `no-cors` и с заголовком `Range`, и кешировать там нечего;
 *   и) личные страницы (кабинет, админка) не кешируются ВОВСЕ и стоят
 *      ДО маршрута документов. Замер 20.09.2026: страница `/ru/profile`
 *      лежала в кеше документов на 167 965 байт вместе с адресом почты, и
 *      после выхода из аккаунта отдавалась офлайн следующему человеку на
 *      том же устройстве;
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
const KEYS = ["html", "rsc", "rscPrefetch", "others", "content", "audio"];

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
  if (/statuses:\s*\[\s*0\s*,/.test(sw)) {
    bad.push(`${SW}: в кеш клипов снова кладётся НЕПРОЗРАЧНЫЙ ответ (statuses: [0, …]) — тело такой записи нечитаемо, RangeRequestsPlugin отдаёт из неё 416, и всё уже прослушанное перестаёт играть со второго раза (замер 20.09.2026: error.code 4)`);
  }
  if (!/requestWillFetch/.test(sw) || !/mode:\s*"cors"/.test(sw)) {
    bad.push(`${SW}: клип берётся не целиком и не с CORS — элемент <audio> ходит no-cors и с Range, и в кеш снова ляжет непрозрачный ответ с пустым телом`);
  }
  if (!/catch\s*\{\s*return fetch\(options\.request\);/.test(sw)) {
    bad.push(`${SW}: у маршрута клипов нет запасного выхода в сеть — теперь озвучка зависит от правил ЧУЖОГО источника (замер 20.09.2026: OPTIONS туда отвечает 405, разрешённый заголовок один), и отказ CORS означал бы немую озвучку на всём сайте`);
  }
  if (!/const PRIVATE_PATH\s*=/.test(sw)) {
    bad.push(`${SW}: личные страницы (кабинет, админка) снова кешируются — замер 20.09.2026: /ru/profile лежал в кеше на 167 965 байт с адресом почты и отдавался после выхода из аккаунта`);
  } else {
    const privateAt = sw.indexOf("PRIVATE_PATH.test");
    const navAt = sw.indexOf('request.mode === "navigate"');
    if (privateAt === -1 || !/PRIVATE_PATH\.test\(url\.pathname\),\s*handler: new NetworkOnly\(\)/.test(sw.replace(/\s+/g, " ").replace(/ ,/g, ","))) {
      bad.push(`${SW}: личные страницы обслуживает не NetworkOnly — любой другой маршрут кладёт их копию на устройство`);
    } else if (navAt !== -1 && privateAt > navAt) {
      bad.push(`${SW}: маршрут личных страниц стоит ПОСЛЕ маршрута документов — тот заберёт навигацию себе первым`);
    }
  }
  if (!/AUDIO_CACHE_NAME/.test(sw)) {
    bad.push(`${SW}: у клипов нет своего кеша (долг 77)`);
  }

  /**
   * и) СОХРАНЁННОЕ СОДЕРЖАНИЕ — СВОЙ КЕШ, И ЗАКРЫТОЕ В НЁМ НЕ ЛЕЖИТ
   *    (заход 7.229, офлайн-2).
   *
   *    Первая половина — про обещание: замер прогоном 23.09.2026 показал,
   *    что обход 46 разных адресов оставляет в общем кеше документов
   *    ровно 40 записей и открытого ПЕРВЫМ урока среди них уже нет.
   *    Вторая — про платное: сохранять урок, который человеку не отдан,
   *    нельзя, а сохранённый обязан исчезать, когда сервер при первом же
   *    заходе с сетью сказал «доступа нет».
   */
  if (!/export function isOfflineContentPath\(/.test(policy)) {
    bad.push(`${POLICY}: перечня страниц, которые читают без сети, нет — офлайн-2 снова кладёт содержание в общий кеш документов, где его вытесняет обход каталогов`);
  }
  if (!/export function looksClosedForThisVisitor\(/.test(policy)) {
    bad.push(`${POLICY}: признака «этому посетителю закрыто» нет — платный урок ляжет на телефон любому, кто до него дотапал`);
  }
  if (!/isAccessibleForFree/.test(policy)) {
    bad.push(`${POLICY}: закрытость судится не по подписи страницы для поисковика, а чем-то своим — два определения доступа разойдутся в первый же месяц`);
  }
  if (!/isOfflineContentPath\(url\.pathname\)/.test(sw)) {
    bad.push(`${SW}: у сохранённого содержания нет своего маршрута — урок снова делит потолок со всеми документами подряд (замер 23.09.2026: 46 адресов → 40 записей, первого урока нет)`);
  } else {
    const contentAt = sw.indexOf("isOfflineContentPath(url.pathname)");
    const navAt = sw.indexOf('request.mode === "navigate" && !url.pathname.startsWith("/api/")');
    if (navAt !== -1 && contentAt > navAt) {
      bad.push(`${SW}: маршрут содержания стоит ПОСЛЕ общего маршрута документов — тот заберёт навигацию себе первым, и свой кеш не наполнится никогда`);
    }
  }
  if (!/cacheWillUpdate/.test(sw) || !/looksClosedForThisVisitor/.test(sw)) {
    bad.push(`${SW}: закрытая страница кладётся в кеш содержания наравне с открытой — доступ за один оплаченный месяц станет вечным`);
  }
  if (!/response\.redirected/.test(sw)) {
    bad.push(`${SW}: перенаправление сторожа маршрутов за содержание не считается — страница без подписки легла бы под адресом платной`);
  }
  if (!/cache\.delete\(request, \{ ignoreVary: true \}\)/.test(sw)) {
    bad.push(`${SW}: прежняя сохранённая копия не СТИРАЕТСЯ, когда сервер сказал «доступа нет» — это и есть «подписка кончилась, а урок открывается»`);
  }

  /**
   * к) ПРОБА ЖИЗНИ СЕРВЕРА НЕ ОТВЕЧАЕТ ИЗ КЕША, И ОТКАЗ ОДНОГО ЗАПРОСА НЕ
   *    ОБЪЯВЛЯЕТСЯ ОТСУТСТВИЕМ СЕТИ — заход 7.227, строка долга 278.
   *
   *    Владелец 20.09.2026 при ЖИВОМ интернете видел, как страница
   *    рассказа подменилась экраном «Estás sin conexión». Причина отказа
   *    не установлена до сих пор (шесть способов воспроизведения дали
   *    ноль), но следствие лечится без неё: прежде чем показать каркас,
   *    воркер спрашивает свой `/api/health` и повторяет запрос один раз.
   *    Без строки `NetworkOnly` для здоровья проба отвечала бы из кеша
   *    `apis` — то есть подтверждала бы жизнь сервера из памяти телефона.
   */
  if (!/const HEALTH_PATH\s*=\s*"\/api\/health"/.test(sw)) {
    bad.push(`${SW}: пробы жизни сервера нет — «нет сети» снова утверждается по ОДНОМУ упавшему запросу (долг 278)`);
  } else {
    const flat = sw.replace(/\s+/g, " ");
    if (!/url\.pathname === HEALTH_PATH, handler: new NetworkOnly\(\)/.test(flat)) {
      bad.push(
        `${SW}: проба жизни сервера обслуживается не NetworkOnly — ответ на неё ляжет в кеш apis и будет подтверждать жизнь сервера из памяти телефона (долг 278)`,
      );
    }
    const healthAt = sw.indexOf("url.pathname === HEALTH_PATH");
    const spreadAt = sw.indexOf("...runtimeCaching");
    if (healthAt !== -1 && spreadAt !== -1 && healthAt > spreadAt) {
      bad.push(`${SW}: строка пробы здоровья стоит ПОСЛЕ маршрутов defaultCache — NetworkFirst заберёт её себе первым (долг 278)`);
    }
  }
  if (!/handlerDidError/.test(sw) || !/serverAnswers\(/.test(sw)) {
    bad.push(
      `${SW}: у маршрута документов нет своего запасного ответа с пробой сети — каркас снова показывается по первому же отказу (долг 278)`,
    );
  }
  if (!/matchPrecache\(OFFLINE_SHELL_URL\)/.test(sw)) {
    bad.push(`${SW}: каркас без сети берётся не из precache — без сети взять его больше неоткуда`);
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
    "подсадка: непрозрачный ответ снова кешируется (ровно дефект «не играет со второго раза»)",
    policy,
    sw.replaceAll("statuses: [200]", "statuses: [0, 200]"),
    "НЕПРОЗРАЧНЫЙ ответ",
  );
  add(
    "подсадка: проба здоровья снова отвечает из кеша (ровно долг 278)",
    policy,
    sw.replace("sameOrigin && url.pathname === HEALTH_PATH,\n      handler: new NetworkOnly(),", "sameOrigin && url.pathname === HEALTH_PATH,\n      handler: new NetworkFirst({ cacheName: CACHES.others }),"),
    "обслуживается не NetworkOnly",
  );
  add(
    "подсадка: пробы жизни сервера нет вовсе (состояние до 23.09.2026)",
    policy,
    sw.replace('const HEALTH_PATH = "/api/health"', 'const HEALTH_PATH_GONE = "/api/health"'),
    "пробы жизни сервера нет",
  );
  add(
    "подсадка: запасной ответ документов снова чужой, без пробы сети",
    policy,
    sw.replace(/handlerDidError/g, "cacheDidUpdate"),
    "нет своего запасного ответа с пробой сети",
  );
  add(
    "подсадка: каркас берётся не из precache",
    policy,
    sw.replace("serwist.matchPrecache(OFFLINE_SHELL_URL)", "caches.match(OFFLINE_SHELL_URL)"),
    "берётся не из precache",
  );
  add(
    "подсадка: клип снова берётся куском и без CORS",
    policy,
    sw.replace(/requestWillFetch: async \(\{ request \}\) => new Request\(request\.url, \{ mode: "cors", credentials: "omit" \}\)/, "cacheKeyWillBeUsed: async ({ request }) => request.url"),
    "не целиком и не с CORS",
  );
  add(
    "подсадка: у клипов отобран запасной выход в сеть",
    policy,
    sw.replace("catch {\n          return fetch(options.request);\n        }", "catch (error) {\n          throw error;\n        }"),
    "нет запасного выхода в сеть",
  );
  add(
    "подсадка: личных страниц снова нет в правилах (кабинет ложится в кеш документов)",
    policy,
    sw.replace(/const PRIVATE_PATH\s*=/, "const PRIVATE_PATH_UNUSED ="),
    "личные страницы (кабинет, админка) снова кешируются",
  );
  add(
    "подсадка: личные страницы обслуживает NetworkFirst, а не NetworkOnly",
    policy,
    sw.replace(/sameOrigin && PRIVATE_PATH\.test\(url\.pathname\),\n      handler: new NetworkOnly\(\)/, 'sameOrigin && PRIVATE_PATH.test(url.pathname),\n      handler: new NetworkFirst({ cacheName: CACHES.html, plugins: [expiration("html")] })'),
    "обслуживает не NetworkOnly",
  );
  add(
    "подсадка: удаление по сроку годности снова учитывает Vary (НАСТОЯЩАЯ причина долга 75)",
    policy,
    sw.replaceAll("matchOptions: { ignoreVary: true },", ""),
    "снова учитывает Vary",
  );
  add(
    "подсадка: у сохранённого содержания отобран свой маршрут (состояние ДО офлайн-2)",
    policy,
    sw.replace("isOfflineContentPath(url.pathname)", "false && url.pathname"),
    "нет своего маршрута",
  );
  add(
    "подсадка: маршрут содержания встал ПОСЛЕ общего маршрута документов",
    policy,
    (() => {
      const block = /\n    \{\n      matcher: \(\{ request, url, sameOrigin \}[^]*?isOfflineContentPath\(url\.pathname\),[^]*?\n    \},\n/.exec(sw);
      if (!block) return sw;
      return sw.replace(block[0], "\n").replace("    ...runtimeCaching,", block[0] + "    ...runtimeCaching,");
    })(),
    "стоит ПОСЛЕ общего маршрута документов",
  );
  add(
    "подсадка: закрытая страница снова кладётся в кеш содержания",
    policy,
    sw.replace(/looksClosedForThisVisitor/g, "Boolean"),
    "кладётся в кеш содержания наравне с открытой",
  );
  add(
    "подсадка: прежняя копия больше не стирается, когда сервер сказал «доступа нет»",
    policy,
    sw.replace("cache.delete(request, { ignoreVary: true })", "cache.keys()"),
    "не СТИРАЕТСЯ",
  );
  add(
    "подсадка: перенаправление сторожа маршрутов перестало считаться закрытостью",
    policy,
    sw.replace("response.redirected ||", "false ||"),
    "не считается",
  );
  add(
    "подсадка: перечня страниц офлайна нет вовсе",
    policy.replace("export function isOfflineContentPath(", "function isOfflineContentPathUnused("),
    sw,
    "перечня страниц, которые читают без сети, нет",
  );
  add(
    "подсадка: закрытость судится не подписью страницы для поисковика",
    policy.replace('const CLOSED_MARKER = \'"isAccessibleForFree":false\';', 'const CLOSED_MARKER = "data-closed";'),
    sw,
    "судится не по подписи страницы",
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
  console.log(`check:sw-cache-policy — 15 правил, кешей ${KEYS.length}, нарушений 0 (долги 75, 76, 77, 278)`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
