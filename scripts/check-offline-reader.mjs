// КАРКАС ЧИТАЕТ СОХРАНЁННОЕ САМ, И СТОИТ ОН НЕ ПОД СИСТЕМНЫМИ ПОЛОСАМИ
// (заход 7.229, ОФЛАЙН-2; строка долга 307 и находка владельца 24.09.2026).
//
// ПОЧЕМУ ЭТО СТОРОЖ, А НЕ ТОЛЬКО ПРАВКА. Два утверждения этого захода
// нельзя проверить ни на одной машине проекта:
//
//   * «в приложении сохранённая страница открывается без сети» — живого
//     Android тут нет вовсе (долг 176, 306), а Chromium под Playwright
//     показывает ДРУГУЮ дорогу: у него навигацию обслуживает воркер;
//   * «каркас стоит ниже часов и выше кнопок навигации» — величины полос
//     присылает `MainActivity`, и в браузере они равны нулю всегда.
//
// Значит форму правки обязано держать правило, а числа — живая проба
// (`e2e/offline-shell.spec.ts`, где полосы подставляются руками, ровно
// как их подставляет оболочка).
//
// ЧТО ПРОВЕРЯЕТСЯ — восемнадцать утверждений (тринадцать от 7.229 и пять
// от 7.230: список сохранённого, честная пустая строка, строка-прибор,
// вкладки без сети и порядок показа списка).
//
//  1. Каркас читает `Cache Storage` САМ (`caches.keys`, `cache.match`) —
//     то есть не ждёт воркера, которого в оболочке на навигации нет.
//  2. Читает он ИМЕННО кеши документов: `rf-pages-content-…` и
//     `rf-pages-…` (`pageCacheNames`), а не «какой-нибудь кеш».
//  3. Сохранённое содержание спрашивается ПЕРВЫМ — у него свой потолок и
//     свой срок, и переживает оно дольше.
//  4. Подресурсы подставляются `blob:`-адресами (`createObjectURL`):
//     такой адрес не доходит до сетевого слоя вообще, и вопрос «дойдёт
//     ли запрос до воркера в WebView» перестаёт что-либо решать.
//  5. Ссылок `<link rel="stylesheet">` в показанной копии не остаётся:
//     за ними пошёл бы браузер — мимо нас и в сеть, которой нет.
//  6. Скрипты сайта НЕ исполняются: без сети гидрация Next — петля.
//  7. Сохранённая копия помечена СВОИМ признаком (`data-offline-copy`), а
//     каркасный (`data-offline-shell`) с неё снят: это два разных
//     экрана, и путать их пробам нельзя.
//  8. Сохранённое ищется ДО разговора о сети: человеку, у которого урок
//     лежит на телефоне, нечего читать про то, что страница не открылась.
//  9. Над копией стоит честная подпись «сохранённая копия» — в обеих
//     локалях.
// 10. Каркас берёт безопасные поля из ДВУХ источников тем же `max()`,
//     что и сайт (`src/app/globals.css`): `env(safe-area-inset-*)` про
//     вырез экрана и `--android-inset-*` про системные полосы.
// 11. Шапка каркаса получает верхний отступ, нижняя панель — нижний.
// 12. Вкладки урока переключаются по МЕТКАМ, и метки эти есть в обоих
//     файлах: `data-offline-tab` у кнопки `TabBar`, `data-offline-panel`
//     у каждой панели `LessonView`.
// 13. Панелей размечено столько же, сколько их переключается по `tab ===`
//     — то есть добавить вкладку, забыв про метку, нельзя.
//
// 14. Каркас показывает СПИСОК сохранённого на телефоне — заголовок в
//     обеих локалях и разметку под перечень. Без него человек после
//     холодного старта без сети не имеет НИ ОДНОГО способа попасть в
//     сохранённый урок: адрес урока он наизусть не знает (заход 7.230,
//     видео владельца 25.09.2026).
// 15. Пусто — так и сказано, одной честной строкой в обеих локалях.
// 16. Внизу каркаса стоит строка-прибор с ЧИСЛОМ сохранённого и
//     коротким отпечатком кеша: по видео владельца видно, сохранил
//     телефон что-нибудь или нет.
// 17. Вкладки каркаса без сети смотрят в кеш, а не ведут в пустоту: три
//     раздела названы поимённо.
// 18. Список рисуется ровно тогда, когда каркас ОСТАЁТСЯ на экране, — в
//     обеих ветках (копии нет и копия не отрисовалась).
//
//   node scripts/check-offline-reader.mjs
// 14. Каркас показывает СПИСОК сохранённого на телефоне — заголовок в
//     обеих локалях и разметку под перечень. Без него человек после
//     холодного старта без сети не имеет НИ ОДНОГО способа попасть в
//     сохранённый урок: адрес урока он наизусть не знает (заход 7.230,
//     видео владельца 25.09.2026).
// 15. Пусто — так и сказано, одной честной строкой в обеих локалях.
// 16. Внизу каркаса стоит строка-прибор с ЧИСЛОМ сохранённого и
//     коротким отпечатком кеша: по видео владельца видно, сохранил
//     телефон что-нибудь или нет.
// 17. Вкладки каркаса без сети смотрят в кеш, а не ведут в пустоту: три
//     раздела названы поимённо.
// 18. Список рисуется ровно тогда, когда каркас ОСТАЁТСЯ на экране, — в
//     обеих ветках (копии нет и копия не отрисовалась).
//
//   node scripts/check-offline-reader.mjs --plant
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");

const SHELL = "public/offline.html";
const TABBAR = "src/components/ui/TabBar.tsx";
const LESSON = "src/components/lesson/LessonView.tsx";
const COPY_VIEW = "src/lib/copy-view.ts";

const read = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
};

/** Текст файла без HTML-комментариев: в шапке каркаса разобрано, ЧЕГО
 *  он не делает, и эти слова не должны проходить за код (тот же класс,
 *  что ловушка 7.228 про комментарий). */
export function withoutHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, " ");
}

/** То же для JSX: закомментированная строка уже трижды проходила за
 *  живой код (7.178, 7.181, 7.223). */
export function withoutJsComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function violations(sources) {
  const bad = [];
  const shell = withoutHtmlComments(sources[SHELL] ?? "");
  const tabbar = withoutJsComments(sources[TABBAR] ?? "");
  const lesson = withoutJsComments(sources[LESSON] ?? "");
  const copyView = withoutJsComments(sources[COPY_VIEW] ?? "");

  if (!shell.trim()) {
    bad.push(`${SHELL}: файла нет — читать сохранённое некому`);
    return bad;
  }

  // 1
  if (!/caches\s*\.\s*keys\s*\(/.test(shell) || !/\.match\(/.test(shell)) {
    bad.push(
      `${SHELL}: каркас не читает Cache Storage сам — значит без сети он снова показывает только меню, а сохранённый урок лежит рядом и не открывается (строка 307)`,
    );
  }
  // 2
  for (const prefix of ["rf-pages-content-", "rf-pages-"]) {
    if (!shell.includes(prefix)) {
      bad.push(`${SHELL}: кеш «${prefix}…» каркасом не спрашивается — половина сохранённого ему не видна`);
    }
  }
  // 3
  const contentAt = shell.indexOf("rf-pages-content-");
  const pagesAt = shell.search(/rf-pages-\[a-z0-9\]|rf-pages-\(\?/);
  if (contentAt !== -1 && pagesAt !== -1 && contentAt > pagesAt) {
    bad.push(`${SHELL}: общий кеш документов спрашивается раньше кеша содержания — сохранённое содержание перестанет побеждать`);
  }
  // 4
  if (!/createObjectURL/.test(shell)) {
    bad.push(
      `${SHELL}: подресурсы не подставляются blob-адресами — за стилями и картинками пойдёт браузер, а обслуживает ли его запросы воркер в WebView, не проверено ничем (долг 306)`,
    );
  }
  // 5 и 6 — ОДНА строка исходника: перечень того, что из сохранённой
  // копии вырезается. Берётся она целиком, а не подстрокой: слово
  // «script» содержится и в «noscript», и подсадка, заменившая сам
  // селектор скриптов, прошла бы незамеченной (проверено подсадкой).
  const strip = /var strip = doc\.querySelectorAll\(([^;]*)\);/.exec(shell)?.[1] ?? "";
  if (!/(^|["'\s,(])script\s*[,"']/.test(strip)) {
    bad.push(`${SHELL}: скрипты сохранённой страницы не вырезаются — без сети гидрация Next это навигационная петля, а не страница`);
  }
  if (!/link\[rel=['"]stylesheet['"]\]/.test(strip)) {
    bad.push(`${SHELL}: ссылки на стили из сохранённой копии не убираются — браузер пойдёт за ними в сеть, которой нет`);
  }
  // 7
  if (!/data-offline-copy/.test(shell)) {
    bad.push(`${SHELL}: у сохранённой копии нет своего признака — проба не отличит её от каркаса`);
  }
  if (!/removeAttribute\(["']data-offline-shell["']\)/.test(shell)) {
    bad.push(`${SHELL}: признак каркаса не снимается с сохранённой копии — «каркас показан» и «страница показана» станут одним и тем же`);
  }
  // 8
  const savedCall = shell.indexOf("savedCopy()");
  const decide = shell.indexOf("decideMessage()");
  if (savedCall === -1 || decide === -1 || savedCall > decide) {
    bad.push(`${SHELL}: сохранённое ищется не раньше разговора о сети — человек с уроком на телефоне прочтёт «страница не открылась»`);
  }
  // 9
  if (!/Сохранённая копия/.test(shell) || !/Copia guardada/.test(shell)) {
    bad.push(`${SHELL}: честной подписи «сохранённая копия» нет в обеих локалях — человек решит, что смотрит живую страницу`);
  }
  // 10
  for (const [name, env] of [
    ["--android-inset-top", "safe-area-inset-top"],
    ["--android-inset-bottom", "safe-area-inset-bottom"],
  ]) {
    // Строка ИМЕННО объявления `--safe-*`, а не любая с этим именем:
    // такое же `max()` стоит и у полосы «сохранённая копия», и поиск
    // «любой строки» пропускал подсадку (проверено подсадкой).
    const variable = name.replace("--android-inset-", "--safe-");
    const line = shell.split("\n").find((row) => row.trim().startsWith(`${variable}:`));
    if (!line || !line.includes(`max(`) || !line.includes(name) || !line.includes(env)) {
      bad.push(
        `${SHELL}: ${name} не берётся через max() вместе с env(${env}) — ровно то, что владелец снял 24.09.2026: имя приложения поверх часов, подписи вкладок под кнопками навигации`,
      );
    }
  }
  // 11
  const header = /header\s*\{[^}]*\}/.exec(shell)?.[0] ?? "";
  if (!/padding[^;]*var\(--safe-top\)/.test(header)) {
    bad.push(`${SHELL}: у шапки каркаса нет верхнего отступа под строку состояния — она снова ляжет под часы`);
  }
  const tabs = /nav\.tabs\s*\{[^}]*\}/.exec(shell)?.[0] ?? "";
  if (!/padding-bottom:\s*var\(--safe-bottom\)/.test(tabs)) {
    bad.push(`${SHELL}: у нижней панели каркаса нет отступа под кнопки навигации — подписи вкладок снова окажутся под ними`);
  }
  // 12
  if (!/data-offline-tab/.test(shell) || !/data-offline-panel/.test(shell)) {
    bad.push(`${SHELL}: читалка не знает меток вкладок — сохранённый урок покажет одну вкладку из пяти`);
  }
  if (!/data-offline-tab=\{item\.id\}/.test(tabbar)) {
    bad.push(`${TABBAR}: кнопка вкладки не несёт data-offline-tab — без сети её нечем опознать`);
  }
  // 14
  if (!/data-saved-list/.test(shell) || !/Guardado en este teléfono/.test(shell) || !/Сохранено на этом телефоне/.test(shell)) {
    bad.push(
      `${SHELL}: списка «сохранено на этом телефоне» нет — после холодного старта без сети человек не имеет ни одного способа попасть в сохранённый урок (ровно видео владельца 25.09.2026)`,
    );
  }
  // 15
  if (!/data-saved-empty/.test(shell) || !/Aún no hay nada guardado/.test(shell) || !/ничего не сохранено/.test(shell)) {
    bad.push(`${SHELL}: пустой список молчит вместо одной честной строки — пустое место читается как поломка`);
  }
  // 16
  if (!/data-saved-gauge/.test(shell) || !/fingerprintOf/.test(shell)) {
    bad.push(`${SHELL}: строки-прибора «сохранено: N · отпечаток» нет — по видео с телефона нечем отличить «не сохранилось» от «не нашлось»`);
  }
  // 17
  const tabFilter = /var TAB_FILTER = \{([^}]*)\}/.exec(shell)?.[1] ?? "";
  for (const section of ["/courses", "/stories", "/vocabulary"]) {
    if (!tabFilter.includes(`"${section}"`)) {
      bad.push(`${SHELL}: вкладка «${section}» без сети не смотрит в кеш — нажатие снова даст пустой каркас`);
    }
  }
  if (!/\n\s*armTabsOffline\(\);/.test(shell)) {
    bad.push(`${SHELL}: обработчик вкладок без сети не подключён — правило написано и не включено`);
  }
  // 18
  //
  // СЧИТАЕТСЯ ИМЕННО ПАРА «список + решение о сообщении», А НЕ ВСЕ ВЫЗОВЫ
  // `showSavedList` ПОДРЯД, и это правка 26.09.2026 (7.231). Прежнее
  // правило требовало «хотя бы три упоминания», и хватало его ровно до
  // того дня, когда у списка появились ДРУГИЕ законные поводы
  // перерисоваться: блок скачанного зовёт его после удаления одного
  // материала и после «удалить всё». С ними упоминаний стало пять, и
  // подсадка «одну ветку холодного старта убрали» перестала кусаться —
  // четыре всё ещё больше трёх. Проверять надо то, о чём правило: у
  // холодного старта ДВЕ ветки (сеть ответила и сеть отказала), и список
  // обязан рисоваться в обеих.
  const coldStartBranches = (shell.match(/showSavedList\(null\);\s*\n\s*decideMessage\(\);/g) ?? []).length;
  if (coldStartBranches < 2) {
    bad.push(
      `${SHELL}: список сохранённого рисуется не во всех ветках холодного старта (найдено ${coldStartBranches} из двух — ветка «сеть ответила» и ветка «сеть отказала») — в одной из них человек снова увидит пустой каркас`,
    );
  }
  // 19. Подчёркнута открытая вкладка (долг 320, заход 7.238): каркас
  // переставляет классы вместе с `aria-selected`, иначе подчёркивание
  // остаётся там, где его застал снимок.
  const arm = /function armTabs\(root\) \{[\s\S]*?\n        \}/.exec(shell)?.[0] ?? "";
  if (!/buttons\[j\]\.className = chosen \? onClass : offClass;/.test(arm) || !/onClass = buttons\[c\]\.className;/.test(arm)) {
    bad.push(`${SHELL}: вкладки копии меняют только aria-selected — подчёркнута не та вкладка (долг 320)`);
  }
  // 20. Вкладка и прокрутка копии переживают возврат сети (заход 7.239):
  // каждая перезагрузка каркаса ради сети идёт через `reloadForNetwork`,
  // который оставляет записку, ключ записки один у каркаса и у сайта, а
  // живой урок её читает. Голый `location.reload()` остался только у
  // кнопки экрана ошибки (`[data-retry]`) — там копии на экране нет.
  const shellKey = /var COPY_VIEW_KEY = "([^"]+)";/.exec(shell)?.[1] ?? null;
  const siteKey = /export const COPY_VIEW_KEY = "([^"]+)";/.exec(copyView)?.[1] ?? null;
  if (!shellKey || !siteKey || shellKey !== siteKey) {
    bad.push(`${SHELL}: ключ записки о вкладке копии («${shellKey}») не совпадает с ${COPY_VIEW} («${siteKey}») — после возврата сети урок откроется на «Gramática»`);
  }
  if (!/function reloadForNetwork\(\) \{\s*rememberCopyView\(\);\s*location\.reload\(\);/.test(shell)) {
    bad.push(`${SHELL}: reloadForNetwork не запоминает вкладку копии перед перезагрузкой`);
  }
  const bareReloads = (shell.match(/location\.reload\(\)/g) ?? []).length;
  if (bareReloads !== 2) {
    bad.push(`${SHELL}: голых location.reload() ${bareReloads}, а ждали 2 (reloadForNetwork и кнопка экрана ошибки) — какая-то перезагрузка ради сети забывает вкладку копии`);
  }
  if (!/takeCopyView\(window\.location\.pathname\)/.test(lesson)) {
    bad.push(`${LESSON}: живой урок не читает записку каркаса — после возврата сети вкладка теряется`);
  }
  // 21. Запуск приложения без сети (заход 7.240, задача 4): на стартовом
  // адресе — приглашение к сохранённому, «эта страница не сохранилась» —
  // только на конкретном адресе. Видео владельца 28.09.2026: при первом
  // открытии прежняя фраза читалась как ошибка.
  if (
    !/data-variant="start"[^>]*>Aquí tienes lo que guardaste en este teléfono\.</.test(shell) ||
    !/data-variant="start"[^>]*>Вот что сохранено на этом телефоне\.</.test(shell) ||
    !/data-variant="page"[^>]*>Esta página no se guardó/.test(shell) ||
    !/var VARIANT = \/\^\\\/\(\?:es\|ru\)\?\\\/\?\$\/\.test\(location\.pathname\) \? "start" : "page";/.test(shell) ||
    !/variant !== null && variant !== VARIANT/.test(shell)
  ) {
    bad.push(`${SHELL}: при запуске приложения без сети снова «Esta página no se guardó…» — читается как ошибка (7.240, задача 4)`);
  }
  // 22. Проигрыватель рассказа в копии (заход 7.240, долг 311): «▶» копии
  // оживает по признакам `data-rf-player`, играет фразы по порядку, а
  // шторка — через тот же плагин с play/pause; устаревшая карточка живой
  // страницы гасится при открытии копии, своя — при уходе.
  const player = /function armStoryPlayer\(root\) \{[\s\S]*?\n        \}\n\n        function armClips/.exec(shell)?.[0] ?? "";
  if (!player) {
    bad.push(`${SHELL}: проигрывателя рассказа в копии нет — «▶» копии мёртв, шкала пуста (долг 311)`);
  } else {
    if (!/\[data-rf-player="play"\]/.test(player) || !/data-rf-pause-label/.test(player)) bad.push(`${SHELL}: проигрыватель копии не находит кнопку «▶» и её подписи`);
    if (!/audio\.onpause = function/.test(player)) bad.push(`${SHELL}: кнопка копии не слушает сам звук — чужая пауза оставит «⏸»`);
    if ((player.match(/playbackState: "none"/g) ?? []).length < 2) bad.push(`${SHELL}: шторка копии не гасится (при открытии копии и при уходе)`);
    if (!/window\.addEventListener\("pagehide", stopAll\)/.test(player)) bad.push(`${SHELL}: уход из копии не гасит звук и шторку`);
    if (!/setActionHandler\(\{ action: action \}/.test(player) || !/pause: function/.test(player)) bad.push(`${SHELL}: у шторки копии нет play/pause`);
    if (!/var ARTWORK = "data:image\/png;base64,/.test(shell)) bad.push(`${SHELL}: обложка шторки копии не картинкой — серый динамик`);
    if (!/var story = armStoryPlayer\(root\);/.test(shell)) bad.push(`${SHELL}: проигрыватель копии написан и не включён`);
    if (!/if \(ms && state\.started\) quiet\(ms\.setPlaybackState/.test(player)) bad.push(`${SHELL}: копия сообщает шторке «paused» до первого «▶» — карточка проигрывателя появляется, хотя ничего не играло`);
  }
  // 13
  const panels = (lesson.match(/data-offline-panel="/g) ?? []).length;
  const switched = (lesson.match(/tab === "[a-z]+" \? undefined : "hidden"/g) ?? []).length;
  if (switched === 0) {
    bad.push(`${LESSON}: панелей, переключаемых вкладкой, не нашлось вовсе — сторож ослеп, а не доволен`);
  } else if (panels !== switched) {
    bad.push(
      `${LESSON}: панелей с меткой ${panels}, а переключаемых вкладкой ${switched} — добавленная вкладка без метки без сети покажет пустоту`,
    );
  }
  return bad;
}

function load() {
  return { [SHELL]: read(SHELL), [TABBAR]: read(TABBAR), [LESSON]: read(LESSON), [COPY_VIEW]: read(COPY_VIEW) };
}

function plant() {
  const live = load();
  const cases = [
    { name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(live).length === 0 },
  ];
  const add = (name, file, mutate, expect) => {
    const mutated = { ...live, [file]: mutate(live[file]) };
    if (mutated[file] === live[file]) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(mutated).some((x) => x.includes(expect)) });
  };

  add(
    "подсадка: возврат сети перезагружает копию голым reload — вкладка теряется (состояние 1.0.10)",
    SHELL,
    (s) => s.replace('if (!shellOpenedDirectly()) reloadForNetwork();\n        });', 'if (!shellOpenedDirectly()) location.reload();\n        });'),
    "голых location.reload()",
  );
  add(
    "подсадка: reloadForNetwork перестал оставлять записку",
    SHELL,
    (s) => s.replace("function reloadForNetwork() {\n          rememberCopyView();", "function reloadForNetwork() {"),
    "не запоминает вкладку копии",
  );
  add(
    "подсадка: ключ записки разошёлся у сайта и каркаса",
    COPY_VIEW,
    (s) => s.replace('export const COPY_VIEW_KEY = "rf-copy-view";', 'export const COPY_VIEW_KEY = "rf-copy-tab";'),
    "не совпадает",
  );
  add(
    "подсадка: живой урок не читает записку",
    LESSON,
    (s) => s.replace("takeCopyView(window.location.pathname)", "null"),
    "не читает записку",
  );
  add(
    "подсадка: каркас перестал читать кеши — состояние ДО захода 7.229",
    SHELL,
    (s) => s.replace(/caches\s*\.\s*keys\(/g, "Object.keys("),
    "не читает Cache Storage сам",
  );
  add(
    "подсадка: кеша содержания каркас не знает",
    SHELL,
    (s) => s.replaceAll("rf-pages-content-", "rf-pages-nothing-"),
    "rf-pages-content-",
  );
  add(
    "подсадка: общий кеш документов спрашивается раньше кеша содержания",
    SHELL,
    (s) =>
      s.replace(
        '            if (/^rf-pages-downloads$/.test(names[i])) downloads.push(names[i]);\n            else if (/^rf-pages-content-[a-z0-9]+$/.test(names[i])) content.push(names[i]);\n            else if (/^rf-pages-section-[a-z0-9]+$/.test(names[i])) section.push(names[i]);\n            else if (/^rf-pages-[a-z0-9]+$/.test(names[i])) pages.push(names[i]);',
        '            if (/^rf-pages-[a-z0-9]+$/.test(names[i])) pages.push(names[i]);\n            else if (/^rf-pages-downloads$/.test(names[i])) downloads.push(names[i]);\n            else if (/^rf-pages-content-[a-z0-9]+$/.test(names[i])) content.push(names[i]);\n            else if (/^rf-pages-section-[a-z0-9]+$/.test(names[i])) section.push(names[i]);',
      ),
    "спрашивается раньше кеша содержания",
  );
  add(
    "подсадка: подресурсы снова запрашиваются адресом, а не blob",
    SHELL,
    (s) => s.replace(/createObjectURL/g, "toStringTag"),
    "blob-адресами",
  );
  add(
    "подсадка: ссылки на стили остались в копии",
    SHELL,
    (s) => s.replace(/link\[rel='stylesheet'\]/g, "link[rel='nothing']"),
    "ссылки на стили",
  );
  add(
    "подсадка: скрипты сохранённой страницы больше не вырезаются",
    SHELL,
    (s) => s.replace(/querySelectorAll\("script, noscript/, 'querySelectorAll("meta[data-none], noscript'),
    "скрипты сохранённой страницы не вырезаются",
  );
  add(
    "подсадка: копия перестала помечаться своим признаком",
    SHELL,
    (s) => s.replaceAll("data-offline-copy", "data-offline-nothing"),
    "нет своего признака",
  );
  add(
    "подсадка: признак каркаса остался и на копии",
    SHELL,
    (s) => s.replace(/removeAttribute\("data-offline-shell"\)/, 'setAttribute("data-offline-shell", "1")'),
    "признак каркаса не снимается",
  );
  add(
    "подсадка: честная подпись «сохранённая копия» убрана",
    SHELL,
    (s) => s.replace(/Сохранённая копия на телефоне/, "Страница"),
    "честной подписи",
  );
  add(
    "подсадка: верхнее поле снова только про вырез экрана (ровно находка 24.09.2026)",
    SHELL,
    (s) =>
      s.replace(
        "--safe-top: max(env(safe-area-inset-top, 0px), var(--android-inset-top, 0px));",
        "--safe-top: env(safe-area-inset-top, 0px);",
      ),
    "--android-inset-top не берётся через max()",
  );
  add(
    "подсадка: нижнее поле снова только про вырез экрана",
    SHELL,
    (s) =>
      s.replace(
        "--safe-bottom: max(env(safe-area-inset-bottom, 0px), var(--android-inset-bottom, 0px));",
        "--safe-bottom: env(safe-area-inset-bottom, 0px);",
      ),
    "--android-inset-bottom не берётся через max()",
  );
  add(
    "подсадка: шапка потеряла верхний отступ",
    SHELL,
    (s) => s.replace("padding: var(--safe-top) 1rem 0;", "padding: 0.75rem 1rem;"),
    "нет верхнего отступа",
  );
  add(
    "подсадка: нижняя панель потеряла отступ под кнопки навигации",
    SHELL,
    (s) => s.replace("padding-bottom: var(--safe-bottom);", "padding-bottom: 0;"),
    "нет отступа под кнопки",
  );
  add(
    "подсадка: сохранённое ищется ПОСЛЕ разговора о сети",
    SHELL,
    (s) => s.replace("savedCopy()", "later.savedCopyMoved()"),
    "не раньше разговора о сети",
  );
  add(
    "подсадка: списка сохранённого на каркасе больше нет",
    SHELL,
    (s) => s.replaceAll("data-saved-list", "data-nothing-list"),
    "списка «сохранено на этом телефоне» нет",
  );
  add(
    "подсадка: пустой список молчит вместо честной строки",
    SHELL,
    (s) => s.replaceAll("data-saved-empty", "data-nothing-empty"),
    "пустой список молчит",
  );
  add(
    "подсадка: строка-прибор убрана",
    SHELL,
    (s) => s.replaceAll("data-saved-gauge", "data-nothing-gauge"),
    "строки-прибора",
  );
  add(
    "подсадка: вкладка «Cuentos» без сети снова ведёт в пустоту",
    SHELL,
    (s) => s.replace('"/stories": "story", ', ""),
    "вкладка «/stories» без сети не смотрит в кеш",
  );
  add(
    "подсадка: обработчик вкладок написан и не включён",
    SHELL,
    (s) => s.replace("        armTabsOffline();\n", ""),
    "не подключён",
  );
  add(
    "подсадка: список рисуется не во всех ветках каркаса",
    SHELL,
    (s) => s.replace("            showSavedList(null);\n            decideMessage();\n          })\n          .catch(function () {", "            decideMessage();\n          })\n          .catch(function () {"),
    "не во всех ветках",
  );
  add(
    "подсадка: вкладки копии снова меняют только aria-selected (долг 320)",
    SHELL,
    (s) => s.replace("              if (onClass !== null && offClass !== null) buttons[j].className = chosen ? onClass : offClass;\n", ""),
    "подчёркнута не та вкладка",
  );
  add(
    "подсадка 7.240: стартовый адрес снова говорит «no se guardó»",
    SHELL,
    (s) => s.replace('? "start" : "page";', '? "page" : "page";'),
    "при запуске приложения без сети",
  );
  add(
    "подсадка 7.240: проигрыватель копии выключен (как до 7.240)",
    SHELL,
    (s) => s.replace("var story = armStoryPlayer(root);", "var story = null;"),
    "написан и не включён",
  );
  add(
    "подсадка 7.240: копия не гасит устаревшую шторку при открытии",
    SHELL,
    (s) =>
      s.replace(
        '            // Карточка от умершей живой страницы — долой сразу, вместе с\n            // её длительностью и позицией (Ж.2, см. `forgetPosition`).\n            forgetPosition();\n            quiet(ms.setPlaybackState({ playbackState: "none" }));\n',
        "",
      ),
    "шторка копии не гасится",
  );
  add(
    "подсадка 7.240: шторке «paused» до первого «▶» (ошибка, пойманная эмулятором)",
    SHELL,
    (s) => s.replace("if (ms && state.started) quiet(ms.setPlaybackState", "if (ms) quiet(ms.setPlaybackState"),
    "до первого",
  );
  add(
    "подсадка 7.240: кнопка копии не слушает звук",
    SHELL,
    (s) => s.replace("audio.onpause = function", "audio.onpauseX = function"),
    "чужая пауза",
  );
  add(
    "подсадка: кнопка вкладки потеряла метку",
    TABBAR,
    (s) => s.replace("data-offline-tab={item.id}", "data-tab={item.id}"),
    "не несёт data-offline-tab",
  );
  add(
    "подсадка: у одной панели урока метку забыли (добавили вкладку и не разметили)",
    LESSON,
    (s) => s.replace('<div data-offline-panel="grammar" ', "<div "),
    "панелей с меткой",
  );

  for (const c of cases) {
    console.log(`  ${c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО"} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(
    ok
      ? `check:offline-reader --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль`
      : "check:offline-reader --plant — FAILED",
  );
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(load());
  if (bad.length) {
    console.error(`check:offline-reader — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:offline-reader — 22 правила, нарушений 0 (заходы 7.229, 7.230, 7.239, 7.240)");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
