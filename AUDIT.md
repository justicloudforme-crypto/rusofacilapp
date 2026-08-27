# RusoFácilapp — UI/Mobile-Readiness Audit

Date: 2026-08-25. Scope: read-only code analysis, no changes made. Purpose: prepare
the ground for a mobile-first design-system pass (site → future mobile app,
Capacitor shell already scaffolded).

---

## 1. Структура

```
src/
  app/
    [lang]/                      # локаль es|ru, единый layout.tsx на обе
      pricing/page.tsx           # 3 инлайн-карточки плана, без общего PlanCard
      profile/page.tsx           # серверный компонент, 7 вкладок через ?tab=
      profile/error.tsx          # error boundary (+ такие же в stories/vocabulary/word-games)
      courses/, stories/, vocabulary/, word-games/, media/, glossary/,
      groups/, admin/, account/, login/, register/, forgot-password/,
      reset-password/, confirm-delete-account/, download/, u/[slug]/
      layout.tsx                 # <meta theme-color> с хардкод-хексами
    api/
      checkout/route.ts          # создаёт Stripe Checkout Session, без try/catch
      webhooks/stripe/route.ts   # Stripe webhook (+ route.test.ts)
      webhooks/revenuecat/route.ts   # параллельный путь оплаты (мобильные IAP)
      subscription/cancel, subscription/status
      admin/subscriptions/revoke
      flashcards/summary, word-games/*, exams/*, ...
  components/
    Navbar.tsx, MobileMenu.tsx, BottomNav.tsx, ProfileMenu.tsx, LanguageSwitcher.tsx
    LevelBadge.tsx                # единственный по-настоящему общий UI-компонент
    TelegramFloatButton.tsx
    subscription/PaywallModal.tsx, NativeSubscriptionPanel.tsx
    glossary/, flashcards/, stories/, word-games/, lesson/, profile/,
    admin/, media/, video-lesson/, avatars/, celebration/ (SVG-иллюстрации)
  lib/
    stripe.ts                    # единая точка инициализации Stripe-клиента
    revenuecat-client.ts, plans.ts, entitlement.ts
    word-games/ (crossword.ts, clue.ts, generate-word-games.ts)
  i18n/config.ts, i18n/dictionaries.ts
  dictionaries/es.json, ru.json
  app/globals.css                # ЕДИНСТВЕННЫЙ источник дизайн-токенов (Tailwind v4 @theme)
prisma/schema.prisma, prisma/stories-data.ts
```

Важно: **`tailwind.config.ts` не существует** — вся конфигурация Tailwind v4
живёт в `src/app/globals.css` через `@theme inline`. Это не проблема сама по
себе, но это единственное место, где определён токен-набор — и он покрывает
только цвета (см. §2).

Stripe-интеграция сама по себе консолидирована нормально: один клиент
(`src/lib/stripe.ts`), используется только в `checkout/route.ts` и
`webhooks/stripe/route.ts`. Проблема не в интеграции, а в отсутствии
обработки ошибок (см. §5, /pricing).

---

## 2. Визуальный хаос

### Токены, которые реально есть
`src/app/globals.css:29-87` — `--background`, `--foreground`, `--brand`,
`--brand-light`, `--brand-accent`, `--brand-accent-light` (+ переопределения
для dark/reading тем, строки 53-58, 70-71), проброшены в Tailwind как
`bg-brand`, `text-brand-accent` и т.д. **Это весь набор.** Нет токенов для
radius, shadow, серой/нейтральной шкалы — компоненты используют либо сырые
классы Tailwind (`rounded-2xl`, `rounded-full`), либо произвольные bracket-
значения.

### Конфликт акцентов на /pricing — 3 разных "primary" цвета
`src/app/[lang]/pricing/page.tsx`:
- Monthly (обычный план): `bg-foreground text-background` — строка 113
  (графитовый/инвертированный по теме цвет)
- Annual (`highlighted`): `bg-brand text-white` — строка 110 (брендовый синий)
- Lifetime (`premium`): `bg-amber-500 text-white` — строка 112 (сырой
  Tailwind-amber, вне токен-системы)

Тот же 3-way сплит повторяется в рамках карточек (`border-brand bg-brand/5`
vs `border-amber-500/40 bg-amber-500/5` vs `border-black/10`, строки 56-59),
в бейдже (`bg-amber-500` vs `bg-brand-accent`, строка 65), плюс 4-й
неоформленный вариант у кнопки OXXO (строка 123). `valueNote` (строка 85)
хардкодит `text-amber-600` независимо от токена `--brand-accent`.

Дополнительно "premium"-цвет расходится по всему приложению: на /pricing
premium = amber, а бейджи Premium в каталоге историй (`StoriesCatalog.tsx:128`,
`stories/[id]/page.tsx:79`, `admin/stories/page.tsx:72`) используют
`bg-brand/10 text-brand`, т.е. **основной** брендовый цвет для того же
понятия «премиум».

### Инлайн-хексы (не декоративные, вне SVG-иллюстраций)
| Значение | Файлы | Частота |
|---|---|---|
| `#24A1DE` / `#2090c7` (Telegram) | `TelegramFloatButton.tsx:21`, `profile/page.tsx:369,371,383` | 2 файла, скопировано вместо общего токена/компонента |
| `#2d5f8a`, `#1b140f`, `#f6efdc` | `[lang]/layout.tsx:52-54` (`<meta theme-color>`) | дублирует значения из globals.css вместо `var()` |
| `#fff8ec`, `#1b140f`, `#f6efdc` | `profile/page.tsx:216-218` | повторный хардкод тех же тем-цветов |
| `#d63b2f`, `#e0a934` | `profile/page.tsx:685,687` | дублируют `--brand-accent`/`--brand-accent-light` как литералы |
| `#fea` | `[lang]/page.tsx:33` | одноразовое значение |

### Произвольные Tailwind bracket-значения
- Тень `shadow-[0_1px_2px_rgba(36,28,21,0.06),0_8px_24px_-12px_rgba(36,28,21,0.18)]`
  скопирована буквально в 3 файлах: `word-games/WordSearchBoard.tsx:254`,
  `word-games/CrosswordBoard.tsx:186`, `register/page.tsx:31`.
- Ещё 2 близких, но не идентичных варианта тени: `profile/WelcomeOverlay.tsx:59`
  и `profile/AvatarPicker.tsx:98` — три версии «одной и той же» тени вручную
  подобраны раздельно.
- `shadow-[0_-8px_30px_-8px_rgba(36,28,21,0.25)]` — `MobileMenu.tsx:129` и
  `profile/AvatarPicker.tsx:98`.
- Микро-размеры текста без единой шкалы: `text-[0.65rem]` (4 файла:
  `MobileMenu.tsx:181`, `BottomNav.tsx:65`, `glossary/GlossaryTermCardBody.tsx:33`,
  `glossary/GlossaryApp.tsx:202`), `text-[10px]` (3 файла), `text-[9px]`
  (`CrosswordBoard.tsx:206`) — пять разных «случайных» размеров подписей.
- `max-h-[85dvh]` дублирован (`MobileMenu.tsx:129`, `AvatarPicker.tsx:98`);
  `min-h-[60vh]` — в 3 файлах error.tsx.

**Итог:** дизайн-система покрывает только цвет бренда; тень, радиус, микро-
типографика и «premium»-акцент решаются на местах, отсюда и визуальный
разнобой, включая три конкурирующих primary-цвета на одном экране.

---

## 3. Компоненты: переиспользование vs копипаста

| Элемент | Статус | Детали |
|---|---|---|
| Button | **Нет общего компонента.** 79 файлов содержат сырой `<button className="...">`; стили "primary" переопределяются на каждом месте (см. 3-way сплит на /pricing). |
| Card | Нет общего компонента. |
| Tabs | Нет общего компонента (профильные вкладки и вкладки словаря реализованы каждая по-своему). |
| **LevelBadge (A1–C1)** | ✅ Реально переиспользуется: `src/components/LevelBadge.tsx` (карта `LEVEL_COLORS`, строки 7-13), импортируется в `courses/page.tsx`, `VocabularyApp.tsx`, `CategoryGrid.tsx`, `FlashcardsApp.tsx`, `StoriesCatalog.tsx`, `MediaCatalog.tsx`. Отдельный `glossary/LevelGlossaryBadge.tsx` — не дубликат, другая семантика (mastery, не уровень CEFR). |
| Progress bar | **Не унифицирован.** Минимум 8 независимых реализаций: `GlossaryProgress.tsx`, `LevelGlossaryProgressBar.tsx`, `LevelGlossaryBadge.tsx`, `FlashcardsApp.tsx`, `CategoryGrid.tsx`, `IdiomsList.tsx`, `StoriesCatalog.tsx`, `StoryAudioPlayer.tsx`, `profile/page.tsx:764`. |
| Бейдж «Premium» (👑) | **Копипаста, нет `PremiumBadge.tsx`.** 8 мест с разной разметкой: `WordGamesPicker.tsx:134` (голый emoji), `PaywallModal.tsx:123` (без пилюли), `StoriesCatalog.tsx:128` / `admin/stories/page.tsx:72` / `stories/[id]/page.tsx:79` — **три побайтово идентичных className**, явный кандидат на вынос в компонент, `profile/page.tsx:430`, `MatryoshkaAvatar.tsx:438`, `pricing/page.tsx:68`. |

---

## 4. Mobile-readiness (375px)

Оценка сделана по коду (JSX/Tailwind-классы), без реального рендера в
браузере — там, где вывод неоднозначен, это отмечено явно.

**Горизонтальные переполнения:** явных находок в целевых страницах нет.
Кроссворд/поиск слов используют `overflow-x-auto` + `minmax(22px,...)`
(`CrosswordBoard.tsx:186,189`, `WordSearchBoard.tsx:254,258`) — деградируют
в горизонтальный скролл, а не обрезаются. Единственные `<table>` в
охваченной области (`lesson/VocabularyTab.tsx:23`, `lesson/MatchingItem.tsx:47`)
корректно обёрнуты в `overflow-x-auto`. Таблицы в `/admin/**` вне запрошенного
охвата не проверены на скролл-обёртку — стоит проверить отдельно.

**Элементы < 44×44px:**
- Фильтр-чипы уровня/части речи в глоссарии: `px-3 py-1 text-xs` (~24-28px) —
  `GlossaryApp.tsx:138,151,166,179`.
- Пилюли уровня в word-games picker: `px-3 py-1.5 text-xs` (~28-30px) —
  `WordGamesPicker.tsx:89`.
- Ячейки кроссворда/поиска слов на широких пазлах сжимаются до пола 22px
  (`CrosswordBoard.tsx:189`, `WordSearchBoard.tsx:258`) — это цель ввода
  буквы, не просто декоративный элемент.
- Кнопки транспорта аудиоплеера историй: в sticky-состоянии `h-7 w-7`/`h-8 w-8`
  (28/32px), в обычном `h-9 w-9`/`h-10 w-10` (36/40px) — `StoryAudioPlayer.tsx:74,87,100`.
- Кнопки форм групп на грани (~38-40px): `groups/page.tsx:80-87,96-109`.
- Для контраста: `MobileMenu.tsx`/`BottomNav.tsx` уже везде на `min-h-11`/`h-11`
  — паттерн правильный, просто не применён единообразно.

**Hover-only взаимодействия:** не найдено ничего блокирующего. Все
`group-hover:` — косметика поверх уже кликабельных `<Link>`/`<button>`.
`ProfileMenu.tsx` и `GlossaryTermTooltip.tsx` переключаются по `onClick`.

**Не схлопывающиеся таблицы/сетки:** в целевой области не найдено (все
grid-раскладки имеют мобильные overrides, все `<table>` обёрнуты). Таблицы в
`/admin/**` не проверены (вне запрошенного охвата).

**Инпуты с шрифтом < 16px (зум в iOS Safari) — самая массовая проблема:**
практически каждый текстовый инпут в приложении — `text-sm` (14px), без
`sm:`-override до `text-base`:
- `login/page.tsx:59,70`, `register/page.tsx:63,75`,
  `forgot-password/page.tsx:36`, `reset-password/page.tsx:50`
- `groups/page.tsx:80` (имя группы), `:102` (код входа)
- `FlashcardsApp.tsx:287` (поиск по словарю), `GlossaryApp.tsx:131` (поиск)
- `lesson/MatchingItem.tsx:77` `<select>` наследует `text-sm` от родителя
- **Худший случай:** `CrosswordBoard.tsx:224` — ячейка ввода буквы явно
  `text-xs ... sm:text-base`, т.е. 12px ниже breakpoint `sm` — гарантированный
  зум при вводе на телефоне.

**100vh vs 100dvh:** проблем не найдено. `h-screen`/`min-h-screen`/`100vh`
нигде не используются; единственные найденные — уже безопасные `max-h-[85dvh]`
в `MobileMenu.tsx:129` и `AvatarPicker.tsx:98`.

---

## 5. Состояния (loading / empty / error)

| Страница | Loading | Empty | Error |
|---|---|---|---|
| **/profile** | Нет. Серверный компонент, `Promise.all` без `Suspense`/спиннера (`page.tsx:156-177`). | Частично, по вкладкам: история платежей (`:470`), результаты уроков (`:780-782`), результаты экзаменов (`:864-867`), реф-ссылка недоступна (`:552`). Нет empty-состояния для вкладок «Значки» и «Подписка» (последняя просто показывает CTA подписки). | ✅ `profile/error.tsx` — Sentry.captureException, двуязычное сообщение, кнопка «Повторить». |
| **/vocabulary** | Нет. `categorySummary`/`categoryCards` стартуют пустыми (`FlashcardsApp.tsx:52-53`), без флага загрузки. | ✅ `dict.noSearchResultsMessage` / `dict.categoryDoneMessage` (`:331-334`). | ✅ `vocabulary/error.tsx`, тот же паттерн. |
| **/stories** | Нет. Прогресс чтения подгружается после монтирования без спиннера (`StoriesCatalog.tsx:54-60`, комментарий на `:52` подтверждает: карточки рендерятся без бейджа прогресса до подгрузки). | ✅ `dict.emptyState` при `filtered.length === 0` (`:100-101`). | ✅ `stories/error.tsx`. |
| **/word-games** | Нет. | ❌ **Не найдено.** При `total === 0` для пары (тип, уровень) рендерится пустая сетка без плиток и без сообщения (`WordGamesPicker.tsx:101-156`). | ✅ `word-games/error.tsx`. |
| **/pricing** | ❌ **Не найдено.** Кнопка оформления — обычная `<form method="POST">` (`page.tsx:100-129`), без клиентского состояния `isLoading`/disabled; единственная обратная связь — нативная задержка навигации браузера. | N/A (статичный список планов). | ❌ **Не найдено.** Нет `error.tsx` в `pricing/`. `api/checkout/route.ts` вызывает `stripe.checkout.sessions.create(...)` (строки 87-98, 116-126) **без try/catch** — сбой Stripe API даёт непойманное исключение и стандартную стилизацию Next 500 вместо локализованного сообщения на /pricing. |

---

## 6. I18N — где хардкод

**Описания рассказов — проблема ДАННЫХ, не перевода.**
`prisma/schema.prisma:173-210` — модель `Story` имеет одно поле
`description String?`, без `descriptionRu`. `prisma/stories-data.ts:23-24`
описания написаны только на испанском. `StoriesCatalog.tsx:138` рендерит
`{story.description}` безусловно для обеих локалей. Переводить нечего —
данных на русском просто нет в БД.

**Подсказки кроссворда — тоже проблема ДАННЫХ/схемы.**
`prisma/schema.prisma:429-450` — у `FlashcardCard` только `translationEs`/
`exampleEs`, нет русскоязычных полей вообще. `src/lib/word-games/clue.ts:154-166`
строит все подсказки из испанских полей; `prisma/generate-word-games.ts`
печёт подсказки в пазл на этапе генерации (не на лету), так что даже
рантайм-lookup не помог бы — нет апстрим-данных.

**Реальная (отдельная) проблема отсутствующего перевода:**
`src/components/video-lesson/VideoLessonCard.tsx` — компонент не принимает
`dict` вообще, все заголовки — испанские литералы: `"Nivel {level}"` (:18),
`"Texto / transcripción"` (:27), `"Contexto histórico y cultural"` (:34),
`"Vocabulario clave"` (:39), `"Cuestionario interactivo"` (:44). Это именно
недостающий lookup — компонент нужно подключить к `dict`, данные тут ни при
чём.

Также хардкод в `admin/MediaSubtitlesTable.tsx:132-133` и
`admin/MediaEmbedStatusPanel.tsx:113-115,159-160` (испанские заголовки
таблиц) — вероятно приемлемо, если админка намеренно только на испанском
(не подтверждено ни в ту, ни в другую сторону).

Двуязычные строки в `error.tsx` (все 4 файла) — **не баг**: `error.tsx` в
Next не получает `lang`-параметр, показ обоих языков сразу — осознанный
обход, а не недосмотр.

---

## 7. Навигация: вкладки профиля vs дропдаун «Мой профиль»

Вкладки профиля — `profile/page.tsx:100`:
`personal → progress → badges → referral → subscription → security → language`
(7 штук, рендер `:221-229`).

Дропдаун «Мой профиль» / мобильное меню — единый массив
`Navbar.tsx:86-91`, используется и десктоп-дропдауном (`ProfileMenu.tsx`), и
мобильным (`MobileMenu.tsx`):
`personal → progress → subscription → language` (4 штуки).

**Расхождение:** из дропдауна/мобильного меню недоступны напрямую вкладки
**«Значки» (badges)**, **«Реферальная программа» (referral)** и
**«Безопасность» (security)** — они существуют на странице профиля
(`page.tsx:495-534, 537-569, 572-627`), но попасть на них можно только уже
находясь на /profile и кликая по внутреннему таб-бару. Порядок общих 4
пунктов совпадает в обоих списках.

---

## 8. Подтверждённые баги (код + файл/строка)

**«Аудио и видео» / «Игры со словами» — перенос на 2 строки, прыжок хедера.**
Частично подтверждено, но **не на 375px**: `Navbar.tsx:118` — десктопное меню
`hidden ... sm:flex`, при 375px не рендерится вовсе. В окне ~640–1024px
(`sm`–`lg`) `<Link>`-пункты (`:120-122`) не имеют `whitespace-nowrap`,
многословные ярлыки `nav.media` (`ru.json:9`) и `wordGames` (`ru.json:12`)
действительно могут переноситься. **Реальный риск, но не мобильный, а
планшетный/узкий-десктопный диапазон.**

**«Группа» налезает на переключатель языка.**
**Не подтверждено** как буквальное наложение и не воспроизводится на 375px
(тот же `hidden sm:flex` блок). В диапазоне `sm+` nav и language switcher —
обычные flex-соседи без `absolute`/отрицательных margin — механизма для
настоящего наложения в коде нет. Похоже на тесноту в районе 640-768px,
а не оверлап.

**Табы кабинета обрезаются справа, 7-й таб не влезает.**
**Не подтверждено как обрезка** — механизм другой: `profile/page.tsx:248-251`
— контейнер `overflow-x-auto`, элементы `flex-shrink-0` (`:259`), значит 7-й
таб доступен через горизонтальный скролл, не обрезан. Но: **никакой
визуальной подсказки о прокрутке нет** (ни fade, ни тени, ни стрелки) —
поэтому пользователь вполне может воспринимать это как «обрезано». Это
проблема обнаруживаемости, не поломки.

**Sticky-хедер перекрывает заголовок при скролле.**
**Подтверждено, и шире заявленного.** `Navbar.tsx:100` — `sticky top-0 z-50`,
нигде в проекте нет `scroll-padding-top`/`scroll-mt-*`. Якорь `#features`
на главной (`[lang]/page.tsx:33` → `id="features"` на `:41`) при переходе
будет перекрыт хедером. Важнее: `src/components/stories/StoryText.tsx:123-129`
уже explicit вычисляет `navOffset` (в комментарии прямо написано — «without
this offset, our sticky player would... end up hidden behind [the header]»),
то есть команда уже сталкивалась с этим классом бага и чинила его — но
идентичный паттерн `sticky top-0 z-10` без такого офсета остался в 6+ других
местах: `FlashcardsApp.tsx:281`, `MatchApp.tsx:112`, `RecallApp.tsx:161`,
`FillBlankApp.tsx:152`, `lesson/ExamView.tsx:113`, `lesson/ExercisesTab.tsx:231`
— панели поиска/фильтра и прогресс-бары упражнений будут частично или
полностью скрываться под хедером при скролле.

**Генератор кроссвордов: неверная нумерация подсказок.**
**Подтверждено, но не там, где казалось.** Сам алгоритм нумерации
(`src/lib/word-games/crossword.ts:169-187`, `numberPlacements`) корректен —
стандартная нумерация по позиции клетки слева-направо/сверху-вниз, общая на
оба направления (то, что «по горизонтали» начинается с 2, а не с 1, само по
себе не баг — просто слово №1 идёт только вниз). **Реальный баг** — в
рендере списков подсказок: `CrosswordBoard.tsx:257-262` и `:266-271`
фильтруют `puzzle.words` по направлению, но `puzzle.words`
(`crossword.ts:276-283`) идёт в **порядке размещения при генерации**, не
отсортирован по `.number`. Отсюда «по вертикали: 2, 1, 5» — список рисуется
в порядке постройки пазла, а не по возрастанию номера. **Правка:** добавить
`.sort((a, b) => a.number - b.number)` после `.filter(...)` на
`CrosswordBoard.tsx:258` и `:267`.

**Прогресс-бары под категориями словаря всегда пустые.**
**Не подтверждено как код-баг** — проводка выглядит корректной: API
(`api/flashcards/summary/route.ts:32-63`) правильно считает `total`/`known`
по категориям, `CategoryGrid.tsx:38-41` правильно вычисляет `%`,
`FlashcardsApp.tsx:116-122` дёргает summary при смене `[knownWords,
levelFilter]`. Единственная найденная слабость: `categorySummary` стартует
как `{}` без loading-индикатора (см. §5) и **тихо проглатывает ошибку
фетча** (`.catch(() => setCategorySummary({}))`, строка 121) — если запрос
в проде падает, пользователь увидит именно «всегда 0%», неотличимое от
настоящего нуля. **Рекомендация: проверить сеть в проде, прежде чем чинить
код** — баг может быть не в клиентской логике.

**Дата регистрации на день вперёд (таймзона).**
**Подтверждено как вероятная причина.** `profile/page.tsx:195` —
`new Intl.DateTimeFormat(lang, { dateStyle: "long" })` **без `timeZone`**,
рендерится на сервере (`:320` — «с нами с»; `:479` — история платежей) →
серверный рантайм (Vercel/Node) по умолчанию в UTC, не в таймзоне
посетителя. Пользователь из Латинской Америки (UTC-5…UTC-8), зарегистрированный
поздно вечером по местному времени, получит `createdAt`, уже перешедший в
следующие UTC-сутки — итог ровно как в отчёте. Тот же паттерн в
`admin/users/page.tsx:61`.

**Карточки рассказов разной высоты из-за необязательного блока прогресса.**
**Подтверждено.** `StoriesCatalog.tsx:141-157` — три взаимоисключающие ветки
рендера (бейдж «завершено» / блок прогресс-бара / ничего) без
фиксированной высоты-заглушки, при этом карточки лежат в одной grid-строке
(`:103`). Комментарий на `:52` прямо признаёт причину.

**/pricing: цена Premium переносится на 2 строки, карточки не выровнены.**
**Подтверждено оба пункта.** Перенос цены: `pricing/page.tsx:80-83` — `<span>`
с ценой без `whitespace-nowrap`, при `text-3xl` строка `"$169.99 USD"`
(`es.json`/`ru.json:306`) может перенестись на узких экранах. Невыровненные
карточки: `pricing/page.tsx:150` — грид явно `sm:items-start` (не
`items-stretch`), у `PlanCard` нет `h-full` (`:53-60`), а список фич у
Lifetime-плана длиннее (`dict.pricing.featuresPremium` + доп. `valueNote`,
`:190,193`) — отсюда независимая высота карточек.

---

## 9. Риски глобальной смены стилей

- **Единственный токен-слой — цвет.** Любая design-token миграция должна
  сначала добавить токены radius/shadow/spacing/font-size, иначе «перевод на
  токены» просто заменит одни магические числа другими.
- **`--brand-accent` уже частично конфликтует с amber на /pricing** —
  унификация «premium»-цвета — это продуктовое решение (какой цвет
  выбрать), не чисто техническая правка; трогать без подтверждения нельзя.
- **`LevelBadge.tsx` и его `LEVEL_COLORS`** используются в 6+ местах —
  изменение палитры уровней задевает courses, vocabulary, flashcards,
  stories, media одновременно; тестировать на всех.
- **StoryText.tsx уже содержит осознанный fix для sticky-header-offset** —
  при рефакторинге sticky-паттерна нужно скопировать именно этот подход
  (не переизобретать), и заодно закрыть 6 мест, где он ещё не применён.
- **`.catch(() => setCategorySummary({}))`-паттерн** (тихое подавление
  ошибок сети) может маскировать реальные баги под «пустое состояние» —
  трогать логику ошибок стоит осторожно, чтобы не превратить молчаливый
  сбой в шумный краш.
- **Stripe/checkout не тронуть без явной просьбы** — `api/checkout/route.ts`
  не имеет try/catch, это баг, но исправление затрагивает платёжный поток;
  требует отдельного тестирования (см. правило в CLAUDE.md).
- **Мобильный шелл (Capacitor) уже собран** — визуальные изменения нужно
  впоследствии сверять и в вебе, и в андроид/иос-сборке (см. существующие
  заметки о Capacitor-специфичных багах, `MOBILE.md`).

---

## 10. Приоритизация задач (эффект / трудозатраты)

### Сегодня (высокий эффект, низкие трудозатраты)
1. Отсортировать подсказки кроссворда по `.number` — 2 строки правки,
   `CrosswordBoard.tsx:258,267`.
2. Добавить `whitespace-nowrap` цене на /pricing — 1 строка,
   `pricing/page.tsx:81`.
3. Зарезервировать высоту под блок прогресса в карточках историй (min-height
   или always-render placeholder) — `StoriesCatalog.tsx:141-157`.
4. Добавить `timeZone` в `Intl.DateTimeFormat` для даты регистрации/платежей
   (или форматировать на клиенте) — `profile/page.tsx:195`, `admin/users/page.tsx:61`.
5. Добавить `try/catch` вокруг `stripe.checkout.sessions.create` +
   `error.tsx` для /pricing — `api/checkout/route.ts:87-98,116-126`.
6. `sm:text-base` → `text-base` (или увеличить базовый размер) на всех
   инпутах форм (login/register/forgot/reset/groups/search) — убирает
   iOS-зум одним проходом по ~10 файлам.

### Эта неделя (средний эффект, требует дизайн-решений)
7. Ввести токены radius/shadow/spacing в globals.css и заменить 5+
   дублированных ручных теней/микро-размеров текста.
8. Решить (с пользователем) единый «premium»-акцент вместо
   graphite/blue/amber на /pricing — затем провести через все 8 мест с
   👑-бейджем.
9. Извлечь общий `PremiumBadge.tsx` (минимум 3 побайтово идентичных копии
   уже готовы к объединению: `StoriesCatalog.tsx:128`, `admin/stories/page.tsx:72`,
   `stories/[id]/page.tsx:79`).
10. Скопировать `navOffset`-паттерн из `StoryText.tsx` на 6 других
    `sticky top-0` панелей (FlashcardsApp/MatchApp/RecallApp/FillBlankApp/
    ExamView/ExercisesTab).
11. Добавить empty-state для /word-games при `total === 0` и loading-
    индикатор для /pricing checkout-кнопки.
12. Добавить видимую подсказку прокрутки на таб-баре профиля (fade/тень)
    вместо тихого overflow-scroll.

### Этот месяц (крупнее, затрагивает архитектуру/данные)
13. Общий `Button.tsx`/`Card.tsx`/`ProgressBar.tsx` — рефакторинг ~79 мест
    с сырыми `<button>` и 8 реализаций прогресс-баров; делать поэтапно по
    разделам (профиль → словарь → истории → word-games), не одним PR.
14. Схема БД: добавить локализованные поля для описаний историй и подсказок
    кроссворда (`descriptionRu`, `translationRu`/`exampleRu` и т.п.) — это
    контент-проект, не только код, координировать с существующим content
    QA pipeline.
15. Подключить `VideoLessonCard.tsx` к `dict` (сейчас все заголовки жёстко
    на испанском).
16. Свести дискрепанс между вкладками профиля (7) и пунктами дропдауна (4) —
    продуктовое решение: либо добавить «Значки»/«Реферальная»/«Безопасность»
    в меню, либо осознанно оставить как есть.
17. Провести уменьшение touch-таргетов <44px (фильтр-чипы глоссария/
    word-games, аудиоплеер-кнопки, ячейки кроссворда) — требует
    визуального ревью, не чисто механическая правка.

---

## 11. Незавершённая миграция: сырые `<button>` вне `Button`-компонента

2026-08-26, после Шага 3 (извлечение Button/Card/Tabs/ProgressBar/
PremiumBadge + новые Input/Select/Skeleton/EmptyState/Toast/Modal/Switch):
осознанно НЕ выполнена массовая замена всех сырых `<button>` на общий
`Button` — статьи из аудита (3-way конфликт на /pricing, копипаста
PremiumBadge/ProgressBar) были заменены точечно, остальное осталось как
было. **Правило: мигрировать файл на `Button`/`Input`/`Select` при
следующем содержательном касании этого файла**, не отдельным проходом —
так изменения остаются маленькими и review-able, а не одним огромным PR.

76 файлов на 2026-08-26 всё ещё содержат хотя бы один сырой `<button>`
(список ниже — не все обязательно «копии», часть — легитимно уникальная
разметка, например drag-жесты в MatchBoard.tsx; при касании файла решать
по месту, не мигрировать бездумно):

```
src/app/[lang]/admin/stories/page.tsx
src/app/[lang]/admin/subscriptions/page.tsx
src/app/[lang]/admin/users/page.tsx
src/app/[lang]/confirm-delete-account/page.tsx
src/app/[lang]/forgot-password/page.tsx
src/app/[lang]/groups/[groupId]/page.tsx
src/app/[lang]/groups/join/page.tsx
src/app/[lang]/groups/page.tsx
src/app/[lang]/media/error.tsx
src/app/[lang]/profile/error.tsx
src/app/[lang]/profile/page.tsx
src/app/[lang]/reset-password/page.tsx
src/app/[lang]/stories/error.tsx
src/app/[lang]/vocabulary/error.tsx
src/app/[lang]/word-games/error.tsx
src/components/MobileMenu.tsx
src/components/ProfileMenu.tsx
src/components/SoundToggle.tsx
src/components/admin/ExamEditor.tsx
src/components/admin/FlashcardAdminApp.tsx
src/components/admin/GlossaryAdminApp.tsx
src/components/admin/IdiomAdminApp.tsx
src/components/admin/LessonEditor.tsx
src/components/admin/MediaEmbedStatusPanel.tsx
src/components/admin/MediaSubtitlesTable.tsx
src/components/admin/NewExamForm.tsx
src/components/admin/StoryEditor.tsx
src/components/admin/VideoLessonGenerator.tsx
src/components/celebration/CelebrationModal.tsx
src/components/celebration/EncouragementModal.tsx
src/components/flashcards/AnswerPad.tsx
src/components/flashcards/CategoryGrid.tsx
src/components/flashcards/CyrillicKeyboard.tsx
src/components/flashcards/FillBlankApp.tsx
src/components/flashcards/FlashcardsApp.tsx
src/components/flashcards/FreeTrialLimitBanner.tsx
src/components/flashcards/IdiomsList.tsx
src/components/flashcards/LevelFilterBar.tsx
src/components/flashcards/MatchApp.tsx
src/components/flashcards/MatchBoard.tsx
src/components/flashcards/RecallApp.tsx
src/components/flashcards/VocabularyApp.tsx
src/components/glossary/GlossaryApp.tsx
src/components/glossary/GlossaryHint.tsx
src/components/glossary/GlossaryTermPopover.tsx
src/components/glossary/GlossaryTermTooltip.tsx
src/components/glossary/TermQuiz.tsx
src/components/intro/IntroPresentation.tsx
src/components/lesson/ExamView.tsx
src/components/lesson/ExercisesTab.tsx
src/components/lesson/LessonView.tsx
src/components/lesson/SlidesTab.tsx
src/components/lesson/SpeakButton.tsx
src/components/lesson/VoiceRecorder.tsx
src/components/lesson/WordReorderItem.tsx
src/components/media/MediaCatalog.tsx
src/components/media/MediaExercises.tsx
src/components/profile/AvatarPicker.tsx
src/components/profile/ChangePasswordForm.tsx
src/components/profile/CopyReferralLink.tsx
src/components/profile/DeleteAccountForm.tsx
src/components/profile/ProfileNameForm.tsx
src/components/profile/ThemeSwitcher.tsx
src/components/profile/WelcomeOverlay.tsx
src/components/stories/StoriesCatalog.tsx
src/components/stories/StoryAudioPlayer.tsx
src/components/stories/StoryText.tsx
src/components/subscription/NativeSubscriptionPanel.tsx
src/components/subscription/PaywallModal.tsx
src/components/video-lesson/HistoricalContextAccordion.tsx
src/components/video-lesson/SubtitleTrack.tsx
src/components/video-lesson/VideoLessonQuiz.tsx
src/components/video-lesson/WordTooltip.tsx
src/components/word-games/CrosswordBoard.tsx
src/components/word-games/WordGamesPicker.tsx
src/components/word-games/WordSearchBoard.tsx
```

Также ещё не применены новые компоненты Input/Select к формам с
`text-sm`-инпутами вне login/register (см. AUDIT.md §4 — groups/page.tsx,
GlossaryApp.tsx поиск, FlashcardsApp.tsx поиск, CrosswordBoard.tsx ячейка
ввода) — тот же принцип: мигрировать при следующем касании файла, не
отдельным проходом.
