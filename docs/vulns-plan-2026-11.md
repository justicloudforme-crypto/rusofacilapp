# Уязвимости зависимостей — разбор и план (7.297, 21.11.2026; critical назван в 7.298; безопасные обновления — 7.300)

## 7.300: безопасные обновления сделаны (22.11.2026, PR «пакеты»)

**Сделано** (одним PR, мажорные версии прямых пакетов не поднимались): `npm audit fix` без `--force` + выравнивание и
iOS-строка.

* Прямые пакеты: `prisma`, `@prisma/client`, `@prisma/adapter-better-sqlite3`, `@prisma/adapter-libsql` 7.9.1 → **7.10.1**
  (CLI и клиент одной версии — иначе `prisma generate` ругается на расхождение; в `allowScripts` — новые версии `prisma` и
  `@prisma/engines`, без этого npm 11 не запускает их установочные скрипты); `@vercel/blob` 2.8.0 → 2.9.0 (внутри `undici`
  6.28 → 6.29.1); `@serwist/next` 9.5.12 → 9.5.15 (воркер); `music-metadata` 11.15 → 11.16.1; `vitest` 4.1.10 → 4.1.12;
  `typescript-eslint` 8.66 → 8.73; вложенные — `vite` 8.3.8, `browserslist` 4.29.6, `source-map-js` 1.2.4, `fast-uri`
  3.1.9, `mysql2` 3.24.4, `js-yaml` 4.3.2, `@xmldom/xmldom` 0.9.12, `brace-expansion`, `deepmerge-ts` 8.0.2 (его выбирает
  сама Prisma 7.10), `zod` 4.6.7 (верхний; в `@vercel/blob` остаётся старый).
* **Capacitor для iPhone:** `ios/App/CapApp-SPM/Package.swift` `exact: "8.5.0"` → `"8.5.1"`, `Package.resolved` — версия
  8.5.1 и ревизия `6afa742…` (тег 8.5.1). Проверено `swift package resolve` — пакет разрешается в ту же ревизию; сборки iOS не
  было. Пакет npm `@capacitor/ios` уже стоял 8.5.1. Есть и 8.5.2/8.5.3 — не брались (решение владельца — 8.5.1; при первой
  сборке iOS оболочка встанет на версию `@capacitor/ios`).
* **Оболочка Android и AAB не тронуты:** плагины `@capacitor/*` и `@capgo/*`, `@revenuecat/*`, `@capacitor/android` — те же.
  **`@capacitor/cli` оставлен 8.5.1** (`npm audit fix` поднимал его до 8.6.2): CLI генерирует файлы проекта `android/` при
  `cap sync` и должен совпадать с `@capacitor/android` в день сборки; уязвимость (`xcode` → `uuid`, moderate) — только
  инструмент на Mac, в AAB и на сайт не попадает.

**Проверки.** `npm run verify` целиком зелёный (в свежей папке — после `npm run build`), линтер — те же 17 предупреждений,
что на `main`; CI PR #562 — 8 из 8 зелёные (e2e 715, один тест со второй попытки — `story-preplay-skip:144`, старый симптом,
не от пакетов: локально 60 из 60; долг 418). Откатывать ничего не пришлось.

**До / после.**

| счёт | critical | high | moderate (medium) | low | всего |
|---|---|---|---|---|---|
| `npm audit`, пакетов — до (`main` `7bcbcad`) | 0 | 20 | 18 | 0 | 38 |
| `npm audit`, пакетов — после (ветка PR) | 0 | 7 | 8 | 0 | 15 |
| Dependabot, тревог — до (22.11, список API) | 1 | 33 | 26 | 7 | 67 |
| Dependabot, тревог — после (расчёт по новому `package-lock.json` и `Package.resolved`; GitHub пересчитает после мержа) | 0 | 2 | 3 | 0 | 5 |

`npm audit` считает пакеты (вместе с теми, кто «зависит от уязвимого»), Dependabot — пары «уязвимость × пакет», поэтому
числа разные. План 7.297 обещал 38 → 12: три пакета (`@capacitor/cli`, `xcode`, `uuid`) оставлены сознательно, см. выше.

**Что осталось (Dependabot, 5 тревог) и почему.**

| тревога | пакет | откуда | где работает | чем закрыть |
|---|---|---|---|---|
| №85 high GHSA-7589-6fvf-x4pw | `effect` | Prisma CLI (`@prisma/config`) | только генерация клиента при сборке | исправления в линии Prisma 7 нет; ждать новую 7.x |
| №60 high GHSA-mrhx-c7xc-m3w5 | `zod` (старый) | `@vercel/blob` → `@vercel/oidc` → `@vercel/cli-config` | сервер, разбор собственного конфига; ввод посетителя не попадает | npm предлагает **понижение** `@vercel/blob` до 2.4.0 — не брать; ждать новую 2.x/3.x |
| №79 medium GHSA-3g3m-2fjr-6pw4, №80 medium GHSA-g3hv-75wg-m249 | `glob`, `minimatch` | плагин Sentry (загрузка source maps) | только сборка | мажор `@sentry/nextjs` 10 → 11 |
| №1 medium GHSA-w5hq-g745-h8pq | `uuid` | `@capacitor/cli` → `xcode` | инструмент на Mac | `@capacitor/cli` 8.6.x — вместе со следующей AAB |

**В следующую AAB** (пакеты, которые меняют оболочку или её сборку; в этом заходе не трогались): `@capacitor/cli` 8.5.1 →
8.6.x (закрывает `xcode`/`uuid`), `@capacitor/android`, `@capacitor/core` и плагины `@capacitor/*`, `@capgo/capacitor-media-session`,
`@revenuecat/purchases-capacitor*` — до последней 8.x или до Capacitor 9 по решению 7.293; Gradle-зависимости `android/`.
Плагин напоминаний обновлять только вместе с заплаткой (`check:local-notifications-patch`; там же долг 417).

**Мажорные — на будущее, по одному:** (1) `@sentry/nextjs` 10 → 11 — закрывает `glob`/`minimatch` (только сборка), отдельный
заход с проверкой загрузки source maps; (2) `@vercel/blob` — npm предлагает 2.4.0 (понижение) — ждать новую версию;
(3) Prisma — ждать 7.x с новым `effect` (мажор 8 не нужен). Срочности нет ни у одного: на живой сайт из оставшихся работает
только `zod` в `@vercel/blob`, и туда ввод посетителя не попадает.

**Critical №78 (Capacitor iOS)** закрывается этим PR — правкой `Package.swift`/`Package.resolved`, без новой AAB и без
сборки iOS. Боты Telegram (`bots/requirements.txt`) в списке Dependabot тревог не имеют.


## 7.299: решение владельца (22.11.2026)

**Заход 7.300 — одной задачей:** безопасные обновления пакетов без смены мажорной версии (пункт 2 плана ниже: `npm audit fix`
без `--force`, замер на копии — 38 → 12 пакетов, high 20 → 7, critical 0) **вместе с** Capacitor для iPhone
`capacitor-swift-pm` 8.5.0 → 8.5.1 (critical №78: строка `exact: "8.5.0"` → `"8.5.1"` в `ios/App/CapApp-SPM/Package.swift` и
`Package.resolved`; сборки iOS не нужно). Полный `verify` и CI до мержа; оболочку Android и AAB это не трогает. Мажорные
(Sentry 11, `@vercel/blob`) — по одному, позже. В 7.299 ничего не обновлялось.

## 7.298: critical назван (список Dependabot, 21.11.2026)

Право «Dependabot alerts: Read-only» у токена агента появилось. Открытых: **critical 1, high 33, medium 26, low 7**.

* **Critical — №78, GHSA-rvm3-566m-v7fv (CVSS 9.3): Capacitor, «чужое содержимое может загрузиться от имени
  приложения через внутренний путь HTTP-прокси».** Пакет `github.com/ionic-team/capacitor-swift-pm` **8.5.0** — Swift-пакет
  **оболочки iPhone**: `ios/App/CapApp-SPM/Package.swift` (`exact: "8.5.0"`) и `Package.resolved`. Исправлено в 8.5.1.
* **Где работает:** только в приложении iOS. Оно не опубликовано (линия iOS — долги 211/214) и ни у кого не стоит. **Не боты
  Telegram и не Android:** у Android та же уязвимость закрыта оболочкой 1.0.17 (Capacitor 8.5.1, PR #534, 7.288), она в
  Production с 17.11.2026. Сайт не затронут.
* **Насколько опасно сейчас:** для людей — никак (iOS-сборки нет). Станет важным в день первой сборки iOS.
* **План (ничего не обновлялось):** при первом заходе линии iOS поднять строку `exact: "8.5.0"` → `"8.5.1"` (и
  `Package.resolved` — Xcode пересчитает) вместе с остальными iOS-правками; отдельной сборки не нужно. Можно и раньше
  отдельным маленьким PR без сборки — решение владельца.


GitHub при `git push` пишет: «67 vulnerabilities (1 critical)». Это счёт
Dependabot по всем файлам зависимостей репозитория: `package-lock.json`
(сайт и инструменты), `bots/requirements.txt` (боты Telegram, на сайт не
выкатываются), `android/**/build.gradle` (оболочка).

## Откуда данные

* **Список Dependabot агенту недоступен:** `gh api
  repos/{owner}/{repo}/dependabot/alerts` → 403 «Resource not accessible by
  personal access token». Токен агента — fine-grained, права «Dependabot
  alerts» у него нет.
  **Что нажать владельцу, чтобы агент мог ЧИТАТЬ список** (ничего не
  включает и ничего не обновляет): GitHub → аватар → Settings → Developer
  settings → Personal access tokens → Fine-grained tokens → токен агента →
  Edit → Repository permissions → **Dependabot alerts: Read-only** → Update.
  «Dependabot security updates» и «version updates» при этом НЕ включать.
* **Замер по `package-lock.json` — `npm audit` той же базы GitHub
  Advisory (21.11.2026, `main` = `e15ee9c`):** 38 пакетов, 65 разных
  уязвимостей (≈ те же 67 без пары из pip/gradle); **critical — 0**, high
  20, moderate 18. Без dev-зависимостей (`--omit=dev`): 23 пакета (high 17,
  moderate 6). **Значит, единственная critical — не в пакетах npm**, а в
  `bots/requirements.txt` (aiogram / python-dotenv / apscheduler) или в
  Gradle-зависимостях оболочки. Назвать её точно можно только по списку
  Dependabot — после права выше.

## Что из этого работает на живом сайте

`npm audit` называет «prod» всё, что в `dependencies`, но большая часть
этого исполняется только при СБОРКЕ (на Vercel или на Mac), а не при
ответе посетителю.

| пакет (уязвимость) | откуда | где работает | риск для живого сайта |
|---|---|---|---|
| `undici` 6.28.0 (DoS при необработанной ошибке, GHSA-3wwx-pv8p-q78v) | `@vercel/blob` 2.8.0 | сервер: запись/удаление голосовых записей учеников в Blob | **низкий**: срабатывает на ответ сервера Blob (Vercel), посетитель его не подделает |
| `zod` 4.1.11 (память при огромной схеме, GHSA-mrhx-c7xc-m3w5) | `@vercel/blob` → `@vercel/oidc` → `@vercel/cli-config` | сервер, разбор собственного конфига OIDC | **нет**: ввод посетителя туда не попадает |
| `music-metadata` 11.15 (зависание на испорченном MP4/WebM) | прямая | только `ensureAudioAsset` — конвейер озвучки на Mac, наши же mp3 | **нет** (голос ученика этим не разбирается) |
| `prisma` / `@prisma/config` / `mysql2` / `effect` / `deepmerge-ts` / `fast-uri` | CLI Prisma | генерация клиента и схемы при сборке; MySQL не используется (Turso) | **нет** |
| `@serwist/*`, `browserslist`, `source-map-js`, `brace-expansion`, `glob`, `minimatch` | сборка воркера, CSS, плагин Sentry | только сборка | **нет** |
| `@sentry/nextjs` 10.78 → `@sentry/bundler-plugins` → `glob`/`minimatch` | плагин загрузки source maps | только сборка | **нет** (уже записано в разделе 7 — «Sentry после #522», вариант (в)) |
| `vitest`/`@vitest/mocker`, `vite`, `js-yaml`, `@xmldom/xmldom`, `typescript-eslint`, `rimraf`, `uuid`, `xcode`, `@capacitor/cli` | dev | тесты, линтер, сборка iOS-проекта на Mac | **нет** (на сайт не попадают) |

**Итог: живому сайту и приложению реальной угрозы из списка npm сейчас нет.**
Единственное, что исполняется при ответе посетителю, — `undici` внутри
`@vercel/blob`, и его уязвимость требует подделанного ответа от самого
Vercel Blob.

## План (в этом заходе ничего не обновлялось)

1. **Первой строкой — critical.** Не в npm. Нужен список Dependabot (право
   «Dependabot alerts: Read-only» токену агента) → агент называет пакет и
   файл. Если это `bots/requirements.txt` — боты на сайт не выкатываются,
   правка — нижняя граница версии в одной строке (заход ботов). Если Gradle
   оболочки — только вместе со следующей сборкой AAB (оболочку отдельно не
   трогаем).
2. **Отдельный небольшой заход «безопасные патчи без смены мажора»** (можно
   позже, срочности нет): `npm audit fix` без `--force` — закрывает почти
   все high/moderate (prisma, serwist, vitest, vite, typescript-eslint,
   music-metadata, undici внутри blob…). Полный `verify` + e2e в CI до
   мержа. Замер на копии `package-lock.json` (`npm audit fix
   --package-lock-only`, рабочее дерево не тронуто): **38 → 12 пакетов,
   high 20 → 7, moderate 18 → 5, critical 0**. Остаются: Sentry и его
   `glob`/`minimatch` (мажор 11), цепочка `@vercel/blob` → `zod`, Prisma CLI
   (`@prisma/config`, `effect`) — все, кроме `undici`/`zod` в blob, только
   сборка.
3. **Мажорные — по одному, отдельными заходами, не срочно:**
   `@vercel/blob` 2.8 → 2.4.0 (npm предлагает понижение мажора —
   проверить по журналу изменений, скорее подождать новой 2.x/3.x), Sentry
   10 → 11 (уже в разделе 7, вариант (в)).
4. **Не касается прода и может ждать сколько угодно:** все dev-пакеты
   (тесты, линтер, сборка iOS на Mac).
