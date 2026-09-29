# «Apply for production» — черновик ответов (заход 7.246)

Дата: 29.09.2026. Приложение: «RusoFácil: aprender ruso», `com.rusofacilapp.app`, закрытый тест Alpha с 21.09.2026, сейчас 1.0.13 (versionCode 14). Подавать **05.10.2026 или позже** (14 дней теста — аудит 7.241, раздел 5.3).

Где в консоли: **Dashboard → Apply for production** (кнопка появляется после 14 дней теста с 12+ тестировщиками).

## Как пользоваться

* Ответы — на английском, как в консоли. Под каждым — перевод на русский (в консоль не вставлять).
* Своих формулировок вопросов в проекте не было. Ниже — вопросы из формы Google для личных аккаунтов разработчика, как агент их знает (три части: закрытый тест, приложение, готовность), плюс «как набирали тестировщиков» из задания. **В консоли слова могут немного отличаться — отвечайте по смыслу, текст подходит.**
* Всё сказанное — правда по PROGRESS.md. В квадратных скобках — то, что знает только владелец: вписать самому или удалить.
* **Шаблон ответов от сервиса тестировщиков не использовать:** в нём вход через Google, кнопка «Share» и окно оценки — ничего этого в приложении нет. Ложный ответ здесь — прямой повод для отказа.

Проверить перед отправкой (консоль, только владелец):
1. **Testers** трека Alpha: в списке Google-группа `testers-community@googlegroups.com`; тестировщиков 12 и больше, 14 дней подряд. Число — вписать в ответ 2.
2. **Android vitals → Crashes and ANRs** за 28 дней и **Pre-launch report** сборки 14. Если там есть падения — ответ 2 и 8 поправить (сейчас они говорят «падений в отчётах тестировщиков не было» — это про отчёты сообщества, не про vitals).
3. Почта `support@rusofacilapp.com`: были ли письма от тестировщиков. Если были — коротко добавить в ответ 3.

---

## Часть 1. Закрытый тест

### 1. How did you recruit testers for your closed test? / How easy was it to recruit testers?

Выбор в шкале: **Easy** («Легко»).

> We recruited testers through a testers community on Google Groups (testers-community). The group was added as the tester list of our Alpha closed track, and community members opted in through the Play testing link and installed the app from Google Play. We also tested the app every day ourselves on a physical phone (Poco X6 Pro, Android 16) with our own accounts. Recruiting through the community was straightforward.

Перевод:
> Тестировщиков набрали через сообщество тестировщиков в Google Groups (testers-community). Группа указана как список тестировщиков нашего закрытого трека Alpha; участники сообщества присоединились по ссылке тестирования Play и установили приложение из Google Play. Кроме того, мы сами каждый день проверяли приложение на настоящем телефоне (Poco X6 Pro, Android 16) со своими учётными записями. Набор через сообщество прошёл просто.

### 2. Describe the engagement you received from testers during your closed test.

> [N] testers joined the closed track and kept the app installed through the 14-day test. According to the community reports, testers used lessons, stories with audio, vocabulary cards and word games. The community testers' reports did not include crashes or blocking bugs. Most of the detailed issues came from our own daily testing on a physical device, where we recorded screen videos of full scenarios: first launch, sign-in, purchase through Google Play, downloading lessons and stories, using the app in airplane mode, background audio, the Android back button and account deletion.

Перевод:
> К закрытому треку присоединились [N] тестировщиков, приложение оставалось у них установленным все 14 дней теста. По отчётам сообщества, тестировщики пользовались уроками, рассказами с аудио, карточками слов и словесными играми. В отчётах тестировщиков сообщества не было ни падений, ни блокирующих ошибок. Большая часть подробных замечаний пришла из нашей собственной ежедневной проверки на настоящем устройстве, где мы записывали видео экрана целых сценариев: первый запуск, вход, покупка через Google Play, скачивание уроков и рассказов, работа в режиме полёта, звук в фоне, кнопка «Назад» Android и удаление учётной записи.

[N] — число из вкладки Testers. Если Play показывает меньше 12 — не подавать.

### 3. Provide a summary of the feedback that you received from testers. Include how you collected the feedback.

> We collected feedback in two ways: the testers community's own reports, and email to our support address (support@rusofacilapp.com), which is shown in the app's legal pages and on the store listing. The community reports found no crashes. Our own device testing, recorded on video and logged step by step, produced the actionable feedback: the app looked empty when opened without internet; downloaded lessons could disappear from the offline list after an update; the in-app purchase did not start at first and later showed "Expired" for a few seconds after paying; the back button closed the whole app while a menu was open; a PDF download button did nothing inside the app; the Terms did not explain how to cancel a Google Play subscription; the notification permission was requested at launch instead of when the user turns on the reminder; and some website elements (footer, Telegram button) were visible inside the app. Each item was reproduced, fixed and re-checked on the device.

Перевод:
> Отзывы собирали двумя путями: отчёты самого сообщества тестировщиков и письма на адрес поддержки (support@rusofacilapp.com), который указан в юридических страницах приложения и на странице в магазине. В отчётах сообщества падений не нашлось. Полезные замечания дала наша собственная проверка на устройстве — с видеозаписью и пошаговым журналом: без интернета приложение выглядело пустым; скачанные уроки могли пропадать из списка «без сети» после обновления; покупка в приложении сначала не запускалась, а потом несколько секунд после оплаты показывала «Expirada»; кнопка «Назад» при открытом меню закрывала всё приложение; кнопка скачивания PDF внутри приложения ничего не делала; в Условиях не было сказано, как отменить подписку Google Play; разрешение на уведомления спрашивалось при запуске, а не при включении напоминания; внутри приложения были видны элементы сайта (подвал, кнопка Telegram). Каждый пункт воспроизведён, исправлен и перепроверен на устройстве.

Если писем на support@ не было — оставить как есть (фраза говорит о канале, а не о числе писем). Если были — добавить одно предложение о том, что в них было.

---

## Часть 2. Приложение

### 4. Who is the intended audience of your app?

> Adult Spanish speakers (18+) in Latin America, Spain and the United States who want to learn Russian from zero or continue to an upper-intermediate level (A1 to B2). Many of them learn for travel, work, family or an interest in Russian literature, and most learning materials for Russian are written for English speakers. Our main market for purchases is Mexico.

Перевод:
> Взрослые испаноговорящие (18+) в Латинской Америке, Испании и США, которые хотят учить русский с нуля или дойти до уровня выше среднего (от A1 до B2). Многие учат ради поездок, работы, семьи или интереса к русской литературе, а большинство материалов по русскому написаны для англоговорящих. Наш главный рынок покупок — Мексика.

### 5. Describe how your app provides value to users.

> RusoFácil is a complete Russian course written in Spanish. Every grammar rule is explained in Spanish and compared with how Spanish works, so learners understand why Russian works the way it does. The app has 120 lessons (A1–B2) with 2,134 auto-checked exercises and 12 level exams, 325 narrated stories where tapping a word shows its Spanish translation, 5,771 vocabulary cards with audio in 23 topics, 771 idioms, and word-search and crossword puzzles for review. It works on the go: lessons and stories can be downloaded with their audio and used offline, answers given offline are sent when the connection returns, story narration keeps playing with the screen off, and an optional daily reminder helps learners keep a streak. The first lesson of every level and a sample of stories, cards and games are open without paying; full access is sold only through Google Play Billing (monthly, yearly, or a one-time Premium purchase).

Перевод:
> RusoFácil — полный курс русского, написанный на испанском. Каждое правило грамматики объяснено на испанском и сравнено с тем, как устроен испанский, поэтому ученик понимает, почему русский устроен именно так. В приложении 120 уроков (A1–B2) с 2134 автоматически проверяемыми упражнениями и 12 экзаменами уровней, 325 озвученных рассказов, где нажатие на слово показывает его перевод на испанский, 5771 карточка слов с аудио в 23 темах, 771 выражение, головоломки «поиск слов» и кроссворды для повторения. Им удобно пользоваться в дороге: уроки и рассказы можно скачать со звуком и открывать без сети, ответы, данные без сети, отправляются, когда связь возвращается, озвучка рассказа звучит при выключенном экране, а необязательное ежедневное напоминание помогает держать серию дней. Первый урок каждого уровня и часть рассказов, карточек и игр открыты без оплаты; полный доступ продаётся только через Google Play Billing (месяц, год или разовая покупка Premium).

### 6. How many installs do you expect your app to have in your first year?

Выбор: **самый нижний диапазон** (обычно «0 – 10K»).

Почему: рекламного бюджета нет, приложение новое, трафик — только поиск и сайт. Честнее занизить, чем завысить: ответ ни на что не влияет, кроме доверия проверяющего. Если диапазоны в консоли другие — выбрать тот, куда попадает 1 000–5 000.

---

## Часть 3. Готовность

### 7. What changes did you make to your app based on what you learned during closed testing?

> During the closed test (21 September – 5 October 2026) we shipped new app builds up to version 1.0.13 and website updates that the app loads. Main changes:
> 1. Purchases: in-app purchase through Google Play Billing (monthly, yearly, one-time Premium) (previously the app had no in-app purchases); fixed a purchase that never started; after paying the app shows "Activating…" until access opens; store errors now show a short code for support. Web checkout is never shown inside the app. (22–29 Sep)
> 2. Offline mode: an offline screen with navigation instead of a blank page; lessons and stories can be downloaded with all their audio; downloads survive app updates; lesson answers given offline are queued and sent when the connection returns. (23–27 Sep)
> 3. Reliability: the app recovers by itself when the network returns; the sign-in is kept after the app is closed; a failed retry of a lesson no longer removes the earlier pass. (22–27 Sep)
> 4. Background audio: the story narration notification now disappears when the learner leaves the story, shows the app icon, and its progress bar starts from zero. (27–29 Sep)
> 5. Android back button: it first closes an open menu or sheet instead of closing the app. (27 Sep)
> 6. Honest store and policy behavior: removed a PDF button that could not work inside the app; the Terms and Privacy Policy now explain that Google Play subscriptions are cancelled in Google Play; account deletion inside the app warns about this, and there is a public account deletion page (rusofacilapp.com/es/eliminar-cuenta); locked materials lead to the in-app purchase. (27 Sep)
> 7. App mode: removed website elements from the app (footer, Telegram button, web payment options, "download the app"); Terms and Privacy moved to Profile → Settings; notification permission is requested only when the user turns on the daily reminder. (28 Sep)

Перевод:
> За время закрытого теста (21 сентября — 5 октября 2026) мы выпустили новые сборки приложения до версии 1.0.13 и обновления сайта, который приложение загружает. Главные изменения:
> 1. Покупки: покупка внутри приложения через Google Play Billing (месяц, год, разовый Premium) (раньше покупок в приложении не было); исправлена покупка, которая не запускалась; после оплаты приложение показывает «Activando…», пока не откроется доступ; ошибки магазина показывают короткий код для поддержки. Оплата сайта внутри приложения не показывается никогда. (22–29.09)
> 2. Без сети: экран с меню вместо пустой страницы; уроки и рассказы скачиваются со всем звуком; скачанное переживает обновления; ответы урока без сети встают в очередь и отправляются, когда связь вернётся. (23–27.09)
> 3. Надёжность: приложение само поднимается, когда возвращается сеть; вход сохраняется после закрытия приложения; неудачная повторная попытка урока больше не снимает прошлый зачёт. (22–27.09)
> 4. Звук в фоне: уведомление с озвучкой рассказа теперь исчезает, когда ученик уходит из рассказа, показывает иконку приложения, а его шкала начинается с нуля. (27–29.09)
> 5. Кнопка «Назад» Android: сначала закрывает открытое меню или лист, а не приложение. (27.09)
> 6. Честное поведение для магазина и политики: убрана кнопка PDF, которая не могла работать в приложении; Условия и Политика объясняют, что подписка Google Play отменяется в Google Play; удаление учётной записи в приложении предупреждает об этом, и есть публичная страница удаления (rusofacilapp.com/es/eliminar-cuenta); закрытые материалы ведут к покупке в приложении. (27.09)
> 7. Режим приложения: из приложения убраны элементы сайта (подвал, кнопка Telegram, способы оплаты сайта, «скачать приложение»); Условия и Политика перенесены в «Профиль → Настройки»; разрешение на уведомления спрашивается только при включении ежедневного напоминания. (28.09)

Откуда каждая строка (для проверки): 1 — заходы 7.224, 7.225, 7.226, 7.240, 7.243 (Ж.1), 7.244; 2 — 7.227–7.237; 3 — 7.223, 7.239, 7.238; 4 — 7.240, 7.248; 5 — 7.242 (долг 347); 6 — 7.242 (долги 343–346); 7 — 7.243.

### 8. How did you decide that your app is ready for production?

> We checked it against Google Play requirements and our own test plan. Technically: target API 36, native libraries aligned to 16 KB pages, no ads and no advertising ID, and six automated monkey runs of 5,000 events each on the release build with zero crashes and zero ANRs. Every code change passes an automated suite (unit tests and more than 600 end-to-end browser tests) before release. On a physical phone we completed the full purchase cycle on 29 September: Google Play purchase window → subscription confirmed → "Activating…" for about 4 seconds → "Active"; then cancellation in Google Play → "Cancelled — access until the end of the paid period" → "Expired". Offline use, downloads, background audio, the back button, sign-in persistence and account deletion were re-checked after the fixes. The store listing, Data safety form, privacy policy and account deletion page describe what the app actually does, and a reviewer account with full access is provided in App access.

Перевод:
> Мы сверили приложение с требованиями Google Play и своим планом проверок. Технически: целевой API 36, нативные библиотеки выровнены под страницы 16 КБ, рекламы и рекламного идентификатора нет, шесть автоматических прогонов monkey по 5000 событий на релизной сборке — ноль падений и ноль зависаний (ANR). Каждое изменение кода проходит автоматический набор тестов (юнит-тесты и более 600 сквозных тестов в браузере) до выката. На настоящем телефоне 29 сентября пройден полный цикл покупки: окно оплаты Google Play → подписка оформлена → «Activando…» около 4 секунд → «Activa»; затем отмена в Google Play → «Cancelada — acceso hasta el final del período pagado» → «Expirada». Работа без сети, скачивание, звук в фоне, кнопка «Назад», сохранение входа и удаление учётной записи перепроверены после исправлений. Страница в магазине, анкета Data safety, политика конфиденциальности и страница удаления описывают то, что приложение действительно делает, а в разделе App access дана учётная запись проверяющего с полным доступом.

Откуда цифры: monkey 6×5000 и targetSdk 36, 16 КБ — аудит 7.241 разделы 4–5; «более 600» — CI #441, E2E 605 passed (7.244); цикл покупки — проверка владельца 29.09 (7.246, долг 358); учётка проверяющего — Premium до 31.03.2027 (7.242). Если Android vitals или Pre-launch report покажут падения — убрать «zero crashes» или уточнить, что это про monkey.
