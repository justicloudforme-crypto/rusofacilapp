# Тексты и метаданные для App Store Connect / Google Play Console

Черновик, готовый к копипасте, как только верификация обоих аккаунтов
завершится. Все цифры (уроки, флэшкарты и т.д.) взяты из реальной базы
данных на 2026-08-23 — проверьте актуальность перед публикацией, если
между подготовкой и загрузкой пройдёт много времени, т.к. контент
регулярно пополняется (см. `rusofasil_content_qa_pipeline` в памяти
ассистента).

Символьные лимиты указаны и посчитаны программно для каждого поля —
можно вставлять как есть, ничего не обрежется.

## Общие данные (используются в обеих консолях)

| Поле | Значение |
|---|---|
| Bundle ID / Package name | `com.rusofacilapp.app` |
| Support URL | `https://rusofacilapp.com/es/privacy` (или заведите отдельный `/support`, если появится форма поддержки) |
| Support email | `support@rusofacilapp.com` |
| Marketing URL | `https://rusofacilapp.com` |
| Privacy Policy URL | `https://rusofacilapp.com/es/privacy` (и `/ru/privacy` для русской локали) |
| Категория (основная) | Education / Образование |
| Категория (вторичная, App Store) | Reference |
| Юрлицо | Физическое лицо — Vasilii Petrov, без зарегистрированного юрлица, домициль в Мексике (как указано в Privacy Policy) |
| Возрастной рейтинг | 4+ / Everyone — нет насилия, нет UGC-чата между незнакомцами (см. раздел ниже) |

---

## App Store Connect

### Локаль: Español (México) — основная

| Поле | Лимит | Значение | Длина |
|---|---|---|---|
| **Name** | 30 | `RusoFácilapp` | 13 |
| **Subtitle** | 30 | `Ruso para hispanohablantes` | 26 |
| **Promotional Text** | 170 | `Aprende ruso de verdad: gramática explicada en español, cirílico desde el primer día y niveles A1 a B2. Ahora también en app nativa para iPhone y Android.` | 154 |
| **Keywords** | 100 | `ruso,aprender ruso,curso ruso,cirílico,ruso online,vocabulario,gramática,ruso B2,ruso desde cero` | 96 |

**Description** (sin límite estricto de campo, pero se recomienda no superar ~4000 caracteres):

```
RusoFácilapp es el curso de ruso pensado desde cero para hispanohablantes — no traducido del inglés, sino explicado comparando el ruso directamente con el español.

POR QUÉ RUSOFÁCILAPP

• Explicaciones en español real, no en inglés adaptado. Cada regla gramatical se compara con su equivalente (o su ausencia) en español, para que entiendas el porqué, no solo el qué.
• Cirílico desde el primer día. Sin transliteración ni atajos: lees y escribes en cirílico desde la primera semana.
• Progreso claro por niveles CEFR — A1, A2, B1 y B2 — para que siempre sepas exactamente dónde estás y qué sigue.
• Práctica oral real, con diálogos y ejercicios pensados en situaciones cotidianas, de viaje y de trabajo.

QUÉ INCLUYE

• 120 lecciones estructuradas, de A1 a B2, con ejercicios y retroalimentación instantánea.
• Más de 5,600 tarjetas de vocabulario con audio nativo.
• Más de 300 relatos originales en ruso, con vocabulario y gramática al nivel de cada etapa.
• Más de 770 modismos y expresiones rusas explicadas en español.
• Un glosario de referencia para los temas más difíciles para un hispanohablante: casos gramaticales, verbos de movimiento, aspecto verbal.
• Más de 270 videos y canciones seleccionados a mano — desde explicaciones de gramática hasta canciones y adaptaciones de clásicos de la literatura rusa — todos con subtítulos en ruso y español.
• Exámenes de nivel cada 10 lecciones, para confirmar que el progreso es real.
• Juegos de palabras (crucigramas, sopa de letras) para repasar vocabulario de forma ligera.
• Grupos de estudio — compara tu racha y tu nivel con tus compañeros.
• Sincronización completa entre la app y la versión web: tu cuenta, tu progreso y tu suscripción son los mismos en cualquier dispositivo.

SUSCRIPCIÓN

RusoFácilapp PRO desbloquea el curso completo, de A1 a B2. Ofrecemos plan mensual, plan anual (con descuento) y una opción de pago único de por vida. Los precios y condiciones de renovación se muestran en la pantalla de compra antes de confirmar, conforme a las reglas de la App Store.

Términos de uso: https://rusofacilapp.com/es/terms
Política de privacidad: https://rusofacilapp.com/es/privacy
```

**What's New (versión 1.0)**:
```
¡Bienvenido a RusoFácilapp! Esta es la primera versión de nuestra app nativa: el mismo curso completo de ruso para hispanohablantes que ya usan miles de personas en la web, ahora con una experiencia a pantalla completa optimizada para tu iPhone.
```

### Локаль: Русский — вторичная

| Поле | Лимит | Значение | Длина |
|---|---|---|---|
| **Name** | 30 | `RusoFácilapp` | 13 |
| **Subtitle** | 30 | `Русский для испаноговорящих` | 27 |
| **Promotional Text** | 170 | `Учите русский по-настоящему: грамматика объясняется на испанском, кириллица с первого дня, уровни от A1 до B2. Теперь и в нативном приложении для iPhone и Android.` | 163 |
| **Keywords** | 100 | `русский язык,изучение русского,кириллица,грамматика,испанский,курс русского,уровни A1 B2` | 89 |

**Description**:
```
RusoFácilapp — курс русского языка, созданный специально для испаноговорящих: не перевод с английского, а объяснения через прямое сравнение с испанским.

ЧЕМ МЫ ОТЛИЧАЕМСЯ

• Объяснения на живом испанском, а не на адаптированном английском — каждое грамматическое правило сравнивается с испанским эквивалентом (или его отсутствием).
• Кириллица с первого дня — без транслитерации, чтение и письмо сразу на кириллице.
• Чёткий прогресс по уровням CEFR — A1, A2, B1, B2.
• Реальная разговорная практика — диалоги и упражнения на бытовые, дорожные и рабочие темы.

ЧТО ВНУТРИ

• 120 уроков от A1 до B2 с мгновенной обратной связью.
• Более 5 600 карточек слов с озвучкой.
• Более 300 оригинальных рассказов на русском языке.
• Более 770 идиом и устойчивых выражений с объяснением на испанском.
• Справочный глоссарий по самым сложным для испаноговорящих темам: падежи, глаголы движения, вид глагола.
• Более 270 отобранных вручную видео и песен — от грамматических разборов до экранизаций русской классики — все с субтитрами на русском и испанском.
• Экзамены после каждых 10 уроков.
• Словесные игры (кроссворды, поиск слов) для лёгкого повторения лексики.
• Учебные группы — сравнивайте серию занятий и уровень с другими учениками.
• Полная синхронизация между приложением и веб-версией — один аккаунт, один прогресс, одна подписка.

Условия использования: https://rusofacilapp.com/ru/terms
Политика конфиденциальности: https://rusofacilapp.com/ru/privacy
```

### App Privacy (Nutrition Label)

Ответы для анкеты "App Privacy" в App Store Connect — исходим из
реальной архитектуры (см. `src/lib/subscription.ts`,
`src/lib/auth.ts`, `src/lib/voice-storage.ts`, Sentry/Vercel Analytics
интеграции):

| Категория данных | Собирается? | Привязано к личности? | Используется для |
|---|---|---|---|
| Contact Info → Email Address | Да | Да | Аккаунт/аутентификация |
| Identifiers → User ID | Да | Да | Аккаунт/аутентификация |
| User Content → Audio Data | Да (опционально — голосовые ответы в упражнениях произношения) | Да | Функциональность приложения (App Functionality) |
| Usage Data → Product Interaction | Да (Vercel Analytics) | Нет (агрегированная) | Аналитика (Analytics) |
| Diagnostics → Crash Data, Performance Data | Да (Sentry) | Нет | Диагностика приложения (App Functionality) |
| Financial Info → Payment Info | **Нет** | — | Оплата в native-приложении полностью обрабатывается Apple (StoreKit/RevenueCat) — мы не получаем и не храним платёжные данные |
| Contacts, Location, Browsing History, Photos, Health, и т.д. | Нет | — | — |

Ключевой пункт для формы "Data Used to Track You": **ничего не
используется для трекинга между приложениями/сайтами третьих лиц** — ни
рекламных SDK, ни fingerprinting нет.

---

## Google Play Console

### Локаль: Español (México) — основная

| Поле | Лимит | Значение | Длина |
|---|---|---|---|
| **Nombre de la app** | 30 | `RusoFácilapp` | 13 |
| **Descripción breve** | 80 | `Aprende ruso desde cero, con explicaciones pensadas para hispanohablantes.` | 74 |

**Descripción completa** (≤ 4000 caracteres) — mismo texto que la
descripción de App Store de arriba (Google no penaliza reutilizar el
mismo copy entre tiendas).

### Локаль: Русский — вторичная

| Поле | Лимит | Значение | Длина |
|---|---|---|---|
| **Название приложения** | 30 | `RusoFácilapp` | 13 |
| **Краткое описание** | 80 | `Учите русский с нуля — объяснения, созданные специально для испаноговорящих.` | 76 |

**Полное описание**: тот же текст, что и в русской версии для App Store выше.

### Data Safety Form

Тот же набор фактов, что и в App Privacy выше, в терминах формы Google:

| Тип данных | Собирается | Передаётся третьим лицам | Шифруется при передаче | Можно удалить |
|---|---|---|---|---|
| Email address | Да | Нет | Да (HTTPS) | Да (удаление аккаунта в профиле) |
| User IDs | Да | Нет | Да | Да |
| Audio (голосовые ответы) | Да, опционально | Нет | Да | Да (каскадно удаляется вместе с аккаунтом) |
| App interactions (analytics) | Да | Нет (Vercel Analytics — первая сторона) | Да | Нет (агрегированные данные) |
| Crash logs / diagnostics | Да | Нет (Sentry — обработчик данных, не третья сторона в коммерческом смысле) | Да | Нет |
| Financial info | **Нет** (нативные покупки обрабатывает Google Play Billing) | — | — | — |

**"Does your app collect or share any of the required user data
types?"** → Да, но: без рекламы, без продажи данных, без стороннего
трекинга — весь сбор данных функционален (аккаунт, диагностика).

### Content Rating Questionnaire — подсказки по ответам

- Насилие, сексуальный контент, наркотики, азартные игры — везде "Нет".
- User-generated content / чат между пользователями — "Нет": разделы
  "Grupos" сравнивают прогресс/streak, свободного текстового чата между
  незнакомыми пользователями в приложении нет.
- Обмен местоположением — "Нет".
- Покупки в приложении — "Да" (подписка PRO).
- Ожидаемый итоговый рейтинг: **IARC "3+" / ESRB "Everyone"**.

---

## Скриншоты — чек-лист размеров

Пока нет ни одного скриншота — потребуется реальная сборка на
устройстве/симуляторе нужного размера экрана. Чек-лист размеров:

**App Store (обязательные размеры)**:
- 6.9″ (iPhone 16 Pro Max и аналоги) — 1320 × 2868 px
- 6.5″ (iPhone 11 Pro Max / XS Max) — 1242 × 2688 px
- iPad Pro 13″ (если планируется универсальное приложение) — 2064 × 2752 px

**Google Play**:
- Минимум 2, максимум 8 телефонных скриншотов, 16:9 или 9:16, JPEG/PNG, минимальная сторона 320px, максимальная 3840px.
- Feature Graphic (обязательно) — 1024 × 500 px, без текста поверх (Google накладывает своё название/рейтинг).
- Иконка приложения — 512 × 512 px (уже есть, `resources/icon.png` можно смасштабировать).

Рекомендуемые экраны для скриншотов (по 1 на фичу, не решать все сразу):
1. Главный экран уроков / прогресс по уровням.
2. Экран урока с упражнением и мгновенной обратной связью.
3. Флэшкарты / словарь.
4. Рассказы (Stories) на русском.
5. Медиа-галерея (песни/видео с субтитрами).
6. Paywall / экран подписки.

---

## Не хватает для полной готовности

- Реальные скриншоты (нужна сборка на устройстве/симуляторе).
- Итоговое решение по `Support URL` — сейчас указывает на страницу
  Privacy Policy как временный вариант; если захотите отдельную
  страницу поддержки, скажите — сделаю `/support` на сайте.
- Промо-видео для App Store (опционально, не обязательно для первого релиза).
