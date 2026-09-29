# Страница приложения в Google Play — es-419 (заход 7.246)

Дата: 29.09.2026. Приложение: «RusoFácil: aprender ruso», `com.rusofacilapp.app`, закрытый тест Alpha, 1.0.12 (versionCode 13).

Этот файл заменяет для Google Play таблицы и тексты из [`docs/store-listings.md`](store-listings.md): там старое имя «RusoFácilapp», неверные «Grupos», «синхронизация с веб-версией» и устаревшие числа. Ответы анкет консоли (Data safety, App access, декларации) — в [`docs/audit-7241-play-readiness.md`](audit-7241-play-readiness.md), раздел 3. Ответы на вопросы «Apply for production» — в [`docs/apply-production-answers.md`](apply-production-answers.md).

Куда вставлять: **Play Console → Grow users → Store presence → Main store listing** (в испанском интерфейсе консоли — «Ficha principal de Play Store»). Язык по умолчанию — «Spanish (Latin America) – es-419».

---

## 1. Откуда числа

Все числа в описании сняты 29.09.2026 со страницы живого сайта `https://rusofacilapp.com/es/courses` (её счётчики сайт считает сам из боевой базы и из кода, `src/lib/intro/stats.ts`) и сверены с кодом и локальной копией базы. Если контент пополнится, числа в описании надо обновить тем же способом.

| что | число | откуда |
|---|---|---|
| уроки | 120 (A1, A2, B1, B2 — по 30) | `src/lib/lessons/content.json`, прод `/es/courses` |
| упражнения | 2134 | то же |
| экзамены | 12 (один на каждые 10 уроков) | `src/lib/exams/content.json`, прод |
| буквы алфавита | 33 | прод |
| рассказы с аудио | 325 (по 65 на A1, A2, B1, B2, C1; озвучены все) | прод; `AudioAsset` story — 325 из 325 |
| карточки слов | 5771 в 23 темах | прод; `AudioAsset` flashcard — 5770 из 5771 с озвучкой |
| выражения и пословицы | 771 (все с озвучкой) | прод; `AudioAsset` idiom — 771 |
| «sopas de letras» / кроссворды | 2015 / 1262 | прод |
| открыто без оплаты | первый урок каждого уровня (4), 2 рассказа («Репка», «Теремок»), 10 карточек, 5 выражений, 83 головоломки | прод, `FREEMIUM.md` |
| тарифы в приложении | «Un mes», «Un año», «Premium para siempre» (разовый платёж: уровень C1 и игры со звездой) | `src/lib/native-access-copy.ts` |

**Намеренно НЕ упомянуто** (этого нет в приложении или это вне правил Play): вход через Google, «Compartir», окно оценки, Stripe, оплата на сайте, OXXO, «Descargar la app», учебные группы, сайт и «синхронизация с веб-версией». Видео и песни (275) тоже не упомянуты: это ролики с YouTube, и лишний повод для вопросов об авторских правах на витрине не нужен. Слово «gratis» не используется — вместо него «sin pagar».

---

## 2. Название (не менять)

| поле | предел | текст | символов |
|---|---|---|---|
| App name | 30 | `RusoFácil: aprender ruso` | 24 |

Совет сервиса тестировщиков поставить «Learn Russian» отклонён: страница испанская, люди ищут по-испански, а их инструмент испанский не понимает.

---

## 3. Краткое описание (Short description, ≤ 80)

| № | текст (es-419) | символов | перевод |
|---|---|---|---|
| 1 | `Aprende ruso con explicaciones en español, cuentos con audio y ejercicios` | 73 | Учи русский с объяснениями на испанском, рассказами с аудио и упражнениями |
| **2 — лучший** | `Aprende ruso desde cero: lecciones en español, cuentos con audio y juegos` | 73 | Учи русский с нуля: уроки на испанском, рассказы с аудио и игры |
| 3 | `Estudia ruso de A1 a B2 con gramática explicada en español y cuentos narrados` | 77 | Изучай русский от A1 до B2: грамматика объяснена на испанском, рассказы озвучены |

Почему №2: «aprender ruso desde cero» — самая частая испанская формулировка у начинающих; в одной строке сразу три отличия (уроки на испанском, аудио, игры). Все три начинаются с глагола и содержат «ruso».

---

## 4. Полное описание (Full description, ≤ 4000)

**2895 символов** (счёт скриптом, как считает Play: каждая буква, пробел, перевод строки и «•» — один символ). Ключевые фразы — по одному разу: «aprender ruso», «curso de ruso», «ruso para hispanohablantes». Слов капсом 0, эмодзи 0, «mejor», «n.º 1», «gratis», просьб об оценке — 0.

```text
Aprende ruso con un curso pensado para hispanohablantes. Cada regla se explica en español y se compara con lo que ya sabes de tu idioma: dónde el ruso se parece al español y dónde no. Así entiendes el porqué, no solo la regla.

Para quién es
Para quien quiere aprender ruso desde cero y para quien ya empezó y necesita orden: por un viaje, por trabajo, por la familia o por gusto por la literatura rusa. No necesitas saber inglés: todo el curso está en español.

Un curso de ruso de A1 a B2
• 120 lecciones en cuatro niveles (A1, A2, B1 y B2) con 2134 ejercicios que se corrigen al momento.
• Cada lección tiene presentación, gramática, vocabulario con audio y ejercicios.
• Un examen cada diez lecciones, 12 en total, para comprobar lo que aprendiste antes de avanzar.
• El alfabeto cirílico desde la primera lección: las 33 letras con audio y las que más confunden a un hispanohablante.
• Práctica de pronunciación: escucha la palabra, graba tu voz y compárala. La grabación se queda en tu teléfono.

Lee y escucha ruso real
• 325 cuentos y lecturas narrados en ruso, desde cuentos populares hasta adaptaciones de clásicos.
• Toca una palabra del texto y ve su traducción al español.
• La narración sigue con la pantalla apagada, y la pausas desde la notificación.

Vocabulario que se queda
• 5771 tarjetas en 23 temas, cada palabra con su audio.
• Varias formas de repasar: voltear la tarjeta, completar la frase, emparejar y escribir la palabra.
• 771 expresiones y refranes rusos explicados en español.

Juegos de palabras
• 2015 sopas de letras y 1262 crucigramas por nivel, para repasar el vocabulario jugando.

Estudia sin conexión
• Descarga lecciones y cuentos con su audio y ábrelos sin internet.
• Si respondes ejercicios sin conexión, tus respuestas se guardan y se envían solas cuando vuelve la red.

Constancia sin presión
• Recordatorio diario opcional: lo activas tú en Mi perfil → Ajustes.
• Racha de días, calendario de estudio e insignias para ver tu avance.

Ruso para hispanohablantes, en tu idioma
Todas las explicaciones están escritas en español neutro. La interfaz también está disponible en ruso.

Qué está abierto y qué requiere acceso
Puedes empezar sin pagar: la primera lección completa de cada nivel, dos cuentos, una parte del vocabulario y de los juegos.
El acceso completo se compra dentro de la app con Google Play:
• Suscripción de un mes o de un año: las 120 lecciones con sus exámenes, el vocabulario de A1 a B2, los cuentos y los juegos, salvo el material marcado como Premium.
• Premium para siempre: un solo pago que abre todo, también el nivel C1 y los juegos con estrella.
La suscripción se renueva automáticamente. Puedes cancelarla cuando quieras en Google Play → Pagos y suscripciones.

Tu cuenta
Tu progreso se guarda en tu cuenta. Puedes eliminar la cuenta desde la app, en Mi perfil.

¿Dudas o sugerencias? Escríbenos a support@rusofacilapp.com.
```

**Перевод на русский (для владельца, в консоль не вставлять):**

> Учи русский по курсу, созданному для испаноговорящих. Каждое правило объясняется на испанском и сравнивается с тем, что ты уже знаешь о своём языке: где русский похож на испанский, а где нет. Так ты понимаешь «почему», а не только само правило.
>
> **Для кого.** Для тех, кто хочет выучить русский с нуля, и для тех, кто уже начал и хочет навести порядок: ради поездки, работы, семьи или любви к русской литературе. Английский знать не нужно: весь курс на испанском.
>
> **Курс русского от A1 до B2.** 120 уроков на четырёх уровнях (A1, A2, B1, B2) и 2134 упражнения с мгновенной проверкой. В каждом уроке — презентация, грамматика, слова с аудио и упражнения. Экзамен после каждых десяти уроков, всего 12 — чтобы проверить выученное, прежде чем идти дальше. Кириллица с первого урока: 33 буквы с аудио и те, что больше всего путают испаноговорящих. Тренировка произношения: послушай слово, запиши свой голос и сравни. Запись остаётся на твоём телефоне.
>
> **Читай и слушай настоящий русский.** 325 рассказов и текстов с озвучкой — от народных сказок до адаптаций классики. Нажми на слово в тексте — увидишь перевод на испанский. Чтение продолжает звучать при выключенном экране, пауза — из уведомления.
>
> **Слова, которые запоминаются.** 5771 карточка в 23 темах, у каждого слова есть аудио. Несколько способов повторять: перевернуть карточку, дополнить фразу, найти пару, написать слово. 771 русское выражение и пословица с объяснением на испанском.
>
> **Словесные игры.** 2015 «поисков слов» и 1262 кроссворда по уровням — повторять слова играя.
>
> **Учись без интернета.** Скачай уроки и рассказы вместе со звуком и открывай без сети. Если отвечаешь на упражнения без сети, ответы сохраняются и отправляются сами, когда связь вернётся.
>
> **Регулярность без давления.** Необязательное ежедневное напоминание — включаешь сам в «Mi perfil → Ajustes». Серия дней, календарь занятий и значки, чтобы видеть свой прогресс.
>
> **Русский для испаноговорящих, на твоём языке.** Все объяснения на нейтральном испанском. Интерфейс есть и на русском.
>
> **Что открыто и что требует доступа.** Можно начать без оплаты: первый урок каждого уровня целиком, два рассказа, часть слов и игр. Полный доступ покупается внутри приложения через Google Play: подписка на месяц или год — 120 уроков с экзаменами, слова от A1 до B2, рассказы и игры, кроме материалов с пометкой Premium; «Premium навсегда» — один платёж, открывает всё, включая уровень C1 и игры со звёздочкой. Подписка продлевается автоматически. Отменить её можно в любой момент в Google Play → «Платежи и подписки».
>
> **Твоя учётная запись.** Прогресс сохраняется в учётной записи. Удалить её можно в приложении, в «Mi perfil».
>
> Вопросы или предложения? Пиши на support@rusofacilapp.com.

**Проверка фактов описания по коду** (что каждое утверждение правда):

| утверждение | где проверено |
|---|---|
| вкладки урока: presentación, gramática, vocabulario, ejercicios | `src/dictionaries/es.json` `lesson.tabs` (Presentación, Gramática, Vocabulario, Ejercicios; у первых уроков ещё Alfabeto) |
| запись голоса не уходит с телефона | `PronunciationPractice.tsx` («Recordings never leave the device»), `check:legal-truth` — 0 сетевых вызовов в записи |
| перевод слова по нажатию | `StoryText.tsx` (слова — кнопки, карточка перевода); без сети — «No se pudo traducir esta palabra» (долг 360) |
| звук при выключенном экране, пауза из уведомления | служба `mediaPlayback`, аудит 7.241 раздел 3.2 |
| четыре режима повторения | `es.json` `vocabulary.mode*`: Vocabulario por categorías, Escribir la palabra, Completa la frase, Emparejar |
| скачивание уроков и рассказов со звуком, очередь ответов | заходы 7.231–7.236 (`check:downloads`, `check:progress-outbox`) |
| напоминание в «Ajustes», вопрос о разрешении только при включении | 7.243, `native-access-copy.ts` `reminder` |
| серия, календарь, значки | `es.json` `profile.activityCalendarHeading`, `badgesHeading` |
| отмена подписки в Google Play, удаление учётки в приложении | 7.242 (Условия, `/es/eliminar-cuenta`, `check:account-deletion`) |
| Premium — C1 и игры со звездой | `native-access-copy.ts` `noteLifetime` |

---

## 5. Release notes для следующей подачи (es-419, ≤ 500)

**481 символ.** Поле «Release notes» выпуска (Test and release → Production → Create new release → «Notas de la versión»), язык `<es-419>`.

```text
• Compra la suscripción o Premium dentro de la app con Google Play.
• Descarga lecciones y cuentos con su audio y ábrelos sin conexión. Las respuestas sin red se envían solas al volver la conexión.
• La notificación del audio desaparece al salir del cuento.
• Tu sesión se mantiene aunque cierres la app.
• El botón Atrás cierra primero el menú o la ventana abierta.
• El permiso de notificaciones se pide solo al activar el recordatorio.
• Correcciones de estabilidad y de textos.
```

Перевод:
> • Подписку или Premium можно купить внутри приложения через Google Play.
> • Скачивай уроки и рассказы со звуком и открывай без сети. Ответы, данные без сети, отправятся сами, когда связь вернётся.
> • Уведомление о звуке исчезает, когда выходишь из рассказа.
> • Вход сохраняется, даже если закрыть приложение.
> • Кнопка «Назад» сначала закрывает открытое меню или окно.
> • Разрешение на уведомления спрашивается только при включении напоминания.
> • Исправления стабильности и текстов.

Каждая строка — сделанная за закрытый тест правка: покупка в приложении (7.224–7.226, 22–23.09), скачивание и очередь ответов (7.227–7.238, 23–27.09), шторка (7.240, 27.09), вход после закрытия (7.239, 27.09), «Назад» (7.242, 27.09), вопрос об уведомлениях (7.243, 28.09). Таймер шторки у скачанной копии (Ж.2) **не исправлен** — поэтому про «правильный прогресс в уведомлении» здесь ни слова.

---

## 6. Скриншоты телефона — снимает владелец на POCO X6 Pro

### 6.1. Подойдут ли снимки POCO как есть — **нет**

Требования Play к скриншотам телефона: JPEG или 24-битный PNG без прозрачности, от 2 до 8 штук, каждая сторона от 320 до 3840 пикселей, **длинная сторона не больше чем вдвое длиннее короткой**. Чтобы приложение могло попасть в подборки Google, нужно ещё не меньше 4 снимков с короткой стороной от 1080 пикселей в пропорции 9:16 (например, 1080×1920).

Экран POCO X6 Pro — 1220×2712: длинная сторона в **2,22 раза** длиннее короткой, Play такой снимок **не примет**. Что делать: владелец снимает как обычно и присылает файлы (из «Галерея → Скриншоты» или из папки `DCIM/Screenshots`), а агент следующим заходом подгоняет их одной командой под **1080×1920**: снимок уменьшается целиком, по бокам — фирменный синий фон `#253B7E` (как у баннера). Обрезать ничего не придётся, содержимое экрана остаётся целиком. Резать снимок до 9:16 руками не нужно — так срезается нижняя панель приложения.

Старые снимки 13.09 (`~/Desktop/rusofacil-store-assets/play-phone-screenshots/`, 5 штук 1080×1920) сделаны из браузера, а не с телефона, и до «режима приложения» 7.243. Для подачи лучше новые, с телефона.

### 6.2. Подготовка телефона (один раз, до съёмки)

1. Сделать так, чтобы на снимках не было уведомлений: смахнуть все уведомления в шторке и включить «Не беспокоить».
2. Приложение — на испанском (меню «≡» → язык «Español»).
3. Интернет включён (Wi-Fi). Режим полёта — только для снимка №7.
4. **Из своей учётной записи не выходить**: при выходе приложение стирает скачанное. Все экраны ниже — из бесплатной части курса, они открыты и так.
5. Не снимать: «Mi perfil» (там имя и почта), «Suscripción» и окно покупки (там цены), окно Google Play, клавиатуру на экране.
6. Скриншот — **кнопка питания + громкость вниз** одновременно.

### 6.3. Восемь снимков — от самого сильного

| № | экран | шаги (кнопки как на экране) | что должно быть видно | чего не должно быть |
|---|---|---|---|---|
| 1 | **Рассказ с переводом слова** | внизу «**Cuentos**» (Рассказы) → вверху фильтр «**Nivel**» (Уровень) → «A1» → рассказ «**Репка**» → кнопка «▶» (**Escuchar el texto** — «Слушать текст») → подождать 3–4 с, пока звучит → нажать любое русское слово в тексте | русский текст, внизу плеер со звуком, всплывшая карточка с испанским переводом слова | надпись «No se pudo traducir esta palabra» (значит, нет интернета — включить Wi-Fi и повторить) |
| 2 | **Грамматика, объяснённая на испанском** | внизу «**Cursos**» (Курсы) → «**A1 · Principiante**» (A1 · Начальный) → урок 1 → вкладка «**Gramática**» (Грамматика) → пролистать до абзаца, где русский сравнивается с испанским («En español…» — «В испанском…») | заголовок урока, вкладки, текст объяснения на испанском с русскими примерами | замок, всплывающие окна |
| 3 | **Упражнение с проверкой** | тот же урок → вкладка «**Ejercicios**» (Упражнения) → ответить на первый вопрос правильно | вопрос и зелёная отметка правильного ответа | открытая клавиатура (если задание с вводом — снять после нажатия «Comprobar» — «Проверить») |
| 4 | **Кириллица** | тот же урок → вкладка «**Alfabeto**» (Алфавит) | таблица русских букв с транскрипцией и кнопками звука | — |
| 5 | **Карточка слова** | внизу «**Vocabulario**» (Словарь) → тема «**Comida y restaurante**» (Еда и ресторан) → нажать на карточку, чтобы перевернуть | русское слово, перевод на испанский, пример, кнопки «**Lo sé**» (Знаю) и «**Repetir**» (Повторить) | полоса «Suscribirme» (Подписаться) — если появилась после 10 карточек, снимать первую карточку |
| 6 | **Поиск слов (sopa de letras)** | внизу «**Juegos de palabras**» (Словесные игры) → «**Sopa de letras**» → «**Nivel**» A1 → «**Puzle 1**» → найти 2–3 слова (провести пальцем по буквам) | сетка букв с 2–3 выделенными словами, строка «Palabras encontradas» (Найдено слов) | окно «¡Puzle resuelto!» (Головоломка решена) — не решать до конца |
| 7 | **Кроссворд** | «**Juegos de palabras**» → «**Crucigrama**» → A1 → «**Puzle 1**» → вписать 1–2 слова | сетка с вписанными русскими буквами, подсказки «**Horizontal**» / «**Vertical**» (По горизонтали / По вертикали) | клавиатура поверх сетки — сначала спрятать её кнопкой «Назад» |
| 8 | **Без интернета** | открыть «Репка» (как в №1) → кнопка «**Descargar**» (Скачать) → дождаться «**Descargado ✓**» (Скачано) → включить режим полёта → закрыть приложение из списка недавних → открыть снова | экран «**Estás sin conexión**» (Нет подключения) и список «**Guardado en este teléfono**» (Сохранено на этом телефоне) с «Репкой» | — (значок самолёта в строке состояния — нормально). После снимка режим полёта выключить |

Порядок в консоли — как в таблице: сначала то, что отличает приложение (рассказ с переводом, грамматика на испанском), потом упражнения, алфавит, слова, игры и работа без сети.

Если на экране №2 абзаца «En español…» не видно без прокрутки — снимать тот кусок, где рядом русский пример и испанское объяснение: смысл тот же.

---

## 7. Feature graphic 1024×500 — **есть, делать заново не нужно**

* Файл: `~/Desktop/rusofacil-store-assets/play-feature-graphic-1024x500.jpg` — 1024×500, JPEG без прозрачности, 46 559 байт. Собран 13.09.2026 (заход 7.190) из шаблона репозитория `scripts/store-assets/feature-graphic.html` командой `store:banner`; в репозитории лежит шаблон, сама картинка — вне его.
* На баннере: иконка-матрёшка, «**RusoFácil**», «**Ruso explicado en español**» (Русский, объяснённый на испанском) и «**Cursos de A1 a B2, lecturas y vocabulario**» (Курсы от A1 до B2, чтение и словарь). Цвета — фирменные, из токенов сайта.
* Правила Play соблюдены: без эмодзи, без капса, без «mejor/#1/gratis», мелкого текста у краёв нет (Play обрезает кромку).
* Нужна ли: да — без неё нельзя ни показать видео на странице, ни попасть в подборки. Поле «Feature graphic» в той же «Main store listing».
* Иконка магазина 512×512 — там же, `play-icon-512.png`.

---

## 8. Что залить и где (сводка для владельца)

| поле консоли | что вставить |
|---|---|
| App name | раздел 2 |
| Short description | раздел 3, вариант 2 |
| Full description | раздел 4, блок `text` целиком |
| App icon | `play-icon-512.png` |
| Feature graphic | `play-feature-graphic-1024x500.jpg` |
| Phone screenshots | 8 снимков раздела 6 после подгонки под 1080×1920 |
| Release notes | раздел 5 — при создании выпуска в Production |
