# Уязвимости зависимостей — разбор и план (7.297, 21.11.2026; critical назван в 7.298)

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
