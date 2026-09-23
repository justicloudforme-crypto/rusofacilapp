import type { Locale } from "@/i18n/config";
import type { PluralForms } from "@/lib/plural";

/**
 * Тексты, которые ВНУТРИ ПРИЛОЖЕНИЯ стоят на месте всего платного
 * (долг 179, решение владельца 13.09.2026).
 *
 * Решение целиком: в первой подаче внутри оболочки платных кнопок нет
 * ВОВСЕ. Ни веб-кассы, ни витрины магазина, ни цен, ни переключателя
 * способов оплаты. Платный материал остаётся закрытым, и человеку честно
 * сказано, что он закрыт, — без призыва оплатить где-либо ещё и без
 * упоминания сторонних способов оплаты. Это важнее удобства: Google Play
 * Payments запрещает уводить на внешнюю оплату цифрового содержимого, а
 * нативной покупки у проекта пока нет — продуктов в консоли не заведено
 * ни одного (перепись — в PROGRESS.md 7.192, часть 4).
 *
 * ПОЧЕМУ ЭТИ СТРОКИ НЕ В `src/dictionaries/*.json`. Замер 7.183: первая
 * редакция нативной витрины положила свои строки в общий словарь, и
 * веб-отдача `/es/pricing` выросла на 1 660 знаков — при том, что на вебе
 * их не читает никто. Причина в корневом макете: `Navbar`, `Footer` и
 * `BottomNav` — клиентские компоненты и получают `dict` ЦЕЛИКОМ, поэтому
 * весь словарь уезжает во flight-разметку каждой из 1913 страниц. Здесь
 * строки живут в серверном модуле, и в веб-ответ не попадает ни одна.
 *
 * НИ ОДНОЙ ЦИФРЫ ЦЕНЫ И НИ ОДНОГО СПОСОБА ОПЛАТЫ В ЭТОМ ФАЙЛЕ БЫТЬ НЕ
 * МОЖЕТ — за этим следит `npm run check:native-payments`.
 */
/**
 * Тип материала, по которому выбирается текст окна «Этот материал
 * закрыт» (7.196, часть 3).
 *
 * Список закрытый и перечислением, а не «строкой от вызывающего»: тогда
 * сторож не мог бы проверить, что у КАЖДОГО типа свой текст в КАЖДОЙ
 * локали, — а именно это и есть правило.
 */
export type LockedKind = "lesson" | "exam" | "story" | "puzzle" | "video" | "flashcard" | "idiom";

export const LOCKED_KINDS: readonly LockedKind[] = [
  "lesson",
  "exam",
  "story",
  "puzzle",
  "video",
  "flashcard",
  "idiom",
];

export interface NativeAccessCopy {
  /** Страница `/[lang]/pricing` внутри приложения. */
  notice: {
    heading: string;
    body: string;
    openHeading: string;
    openItems: string[];
    closedHeading: string;
    closedBody: string;
    activeHeading: string;
    activeBody: string;
    backCta: string;
  };
  /**
   * Окно, которое открывается вместо пейвола по тапу на закрытый
   * материал: замок, объяснение, одна кнопка «понятно».
   *
   * ТЕКСТ ЗАВИСИТ ОТ ТИПА МАТЕРИАЛА — 7.196, часть 3.
   *
   * До этой правки текст был ОДИН на всё: «Он относится к закрытой части
   * КУРСА. В этой версии приложения его не открыть…». Владелец снял его
   * и по тапу на закрытый пазл филворда, и по тапу на закрытый рассказ.
   * Ни пазл, ни рассказ курсом не являются: курс — это 120 уроков в
   * `/courses`, а пазлы и рассказы живут рядом с ним и в него не входят.
   * Человеку говорили неправду о том, чего он коснулся.
   *
   * Отсюда `body` — таблица по типу материала, а не строка. Типов семь,
   * и седьмой (экзамен) добавлен не «на всякий случай»: закрытый экзамен
   * открывает это же окно (`courses/[level]/page.tsx`), и без своей
   * строки он получил бы чужую.
   *
   * НИ ОДИН ИЗ ЭТИХ ТЕКСТОВ НЕ ЗОВЁТ ПОКУПАТЬ. Правило 7.192 в силе:
   * внутри оболочки нет ни цены, ни кнопки, ни ссылки на оплату, и за
   * этим следит `check:native-payments`. `premiumNote` называет ПЛАН —
   * это метка сорта, ровно как 👑, а не предложение его купить.
   */
  lock: {
    heading: string;
    body: Record<LockedKind, string>;
    /** Добавляется к тексту, когда знак — 👑: «Этот материал входит в
     *  план Premium.» Ни цены, ни кнопки, ни ссылки. */
    premiumNote: string;
    close: string;
  };
  /**
   * СТРАНИЦА «СКАЧАТЬ ПРИЛОЖЕНИЕ» ВНУТРИ ПРИЛОЖЕНИЯ — долг 154, заход
   * 7.212.
   *
   * Ссылку из подвала убрал ещё заход 7.193 (долг 188), но САМА страница
   * осталась достижимой по адресу и внутри оболочки предлагала человеку,
   * который уже в приложении, установить приложение — двумя плашками
   * «Скоро — iPhone / Android». Ревизия 7.212 прошла по всем пунктам
   * шапки, подвала и нижней навигации и нашла ровно это одно место.
   *
   * Приём тот же, которым 7.199 закрыла долг 196 (OXXO в условиях):
   * ВИТРИНА ЗНАЕТ, ГДЕ ОНА ОТКРЫТА. Страница не удаляется и не
   * переадресовывает молча (долг 197 закрывали ровно от этого) — она
   * говорит правду для того места, где её открыли.
   */
  download: {
    heading: string;
    body: string;
    cta: string;
  };
  /** Строка в разделе подписки личного кабинета. */
  profileNote: string;
  /**
   * Одна строка на месте КАЖДОЙ кнопки покупки, которая раньше стояла под
   * закрытым материалом на самой странице: три закрытых вкладки урока,
   * карточка закрытого рассказа, закрытое видео, уведомление о словах C1.
   *
   * Почему не `lock.body`: тот текст пишется в окне поверх страницы, где
   * места много, а здесь строка стоит внутри карточки рядом с числом
   * («в этом модуле 24 слова») и обязана быть короткой. Смысл тот же, и
   * это намеренно: два разных объяснения одного и того же положения дел
   * читаются как два разных положения дел.
   */
  closedNote: string;
  /**
   * ЗАКРЫТОЕ ВИДНО, ЧТО ОНО ЕСТЬ — долг 191, решение владельца 14.09.2026.
   *
   * До этой правки внутри приложения гость на уровне C1 (а после
   * клиентской фильтрации и на B2) читал «Нет карточек для этого фильтра».
   * Это неправда по факту: карточек 5771, из них 988 уровня C1, — они
   * закрыты, а не отсутствуют. Человек, поставивший приложение, из такого
   * экрана делает единственный доступный вывод: внутри ничего нет.
   *
   * Что магазины запрещают и что разрешают, разделено здесь буквально:
   * запрещён ПРИЗЫВ платить мимо их биллинга, а показать, что материал
   * СУЩЕСТВУЕТ и ЗАКРЫТ, разрешено. Поэтому ниже есть замок, число и
   * объяснение — и нет ни цены, ни кнопки, ни ссылки, ни слова «подписка»
   * в побудительном наклонении. За этим следит `check:native-payments`.
   *
   * Числа подставляются из базы (`lockedTotal`/`lockedByLevel` в ответах
   * `/api/flashcards` и `/api/idioms`), а не вписаны литералом.
   */
  /**
   * Список курсов в кабинете внутри оболочки — долг 193.
   *
   * ЧТО БЫЛО. Заголовок «Доступные курсы», сразу под ним «Эта часть курса
   * закрыта в этой версии приложения», а у уровней кнопка «Начать». Три
   * утверждения, и все три про одно и то же: доступны — закрыты — начните.
   * Человек нажимает и упирается.
   *
   * ЧТО СТАЛО. Одна картина, и она поддаётся проверке числом: у каждого
   * уровня открыт первый урок (`isFreeTrialLesson`, 1 из 30), остальные 29
   * показаны с замком и меткой. Кнопка ведёт ровно туда, где есть
   * открытое, и потому не врёт; призыва купить нет ни одного.
   */
  courses: {
    /** Подпись под заголовком вместо «эта часть закрыта». */
    note: string;
    /** «Открыто: {open} из {total}» — числа из кода курса, не литералы. */
    openLine: string;
    /** «{locked} с замком». */
    lockedLine: string;
  };
  locked: {
    /** «{count} слово/слова/слов» — только существительное с числом. */
    words: PluralForms;
    /** «{count} выражение/выражения/выражений». */
    expressions: PluralForms;
    /** «Закрыто {items}.» — {items} приходит из
     *  `words`/`expressions` выше. */
    closed: string;
    /** То же с уровнем: «…закрыто {items} уровня {level}.» */
    closedAtLevel: string;
    /**
     * ТЕМА НАЗЫВАЕТСЯ СЛОВАМИ, ЕСЛИ ЧИСЛО ПОСЧИТАНО ПО ТЕМЕ — 7.195, часть 2.
     *
     * Владелец прочитал «закрыто 8 слов уровня C1» как число уровня и
     * назвал его неверным: строк C1 в боевой базе 988. Арифметика была
     * права, предложение — нет. Восемь — это пересечение (тема «Еда» ×
     * уровень C1), и в базе их ровно 8; слова «тема» в предложении не
     * было вовсе. Разрез, по которому посчитано число, обязан звучать.
     */
    closedInTopic: string;
    closedAtLevelInTopic: string;
    /** Вторая строка, одна на оба случая. */
    rest: string;
    /**
     * Подпись премиального слоя. 👑 — это метка СОРТА материала
     * («нужен план Premium»), а не орган управления: она ничего не
     * предлагает купить, никуда не ведёт и нажатием не является
     * (`src/lib/access-marks.ts`). Значение здесь обязано совпадать знак в
     * знак с `dict.access.premiumTierBadge`, и это проверяется тестом
     * `native-access-copy.test.ts` — иначе на одном экране стояло бы
     * «Только Premium», а на соседнем что-нибудь своё.
     */
    badgePremium: string;
    /** Метка на карточке-заглушке. Существующая подпись сайта
     *  (`dict.access.subscriptionBadge`) сюда НЕ тянется намеренно: её
     *  пришлось бы протащить через пять слоёв свойств четырёх режимов
     *  словаря, а внутри оболочки текст всё равно свой. */
    badge: string;
  };
  /**
   * ЭКРАН ПОКУПКИ ВНУТРИ ПРИЛОЖЕНИЯ — заход 7.224, новое решение владельца
   * по долгу 79.
   *
   * Что изменилось по сравнению с 13.09.2026. Тогда внутри оболочки не
   * было платного пути ВОВСЕ, потому что товаров в консолях не было ни
   * одного. Теперь они есть, и платный путь внутри приложения ровно один —
   * покупка магазина. Веб-кассы здесь по-прежнему нет ни в каком виде.
   *
   * НИ ОДНОЙ ЦИФРЫ ЦЕНЫ В ЭТИХ СТРОКАХ БЫТЬ НЕ МОЖЕТ. Цену печатает
   * магазин: экран берёт `priceString` у пакета предложения. Наша сторона
   * цену не знает и знать не должна — в Play месяц стоит 149 песо, а на
   * сайте 150, и любая записанная здесь цифра однажды соврала бы.
   *
   * НИ ОДНА СТРОКА НЕ НАЗЫВАЕТ ПЛАТЁЖНУЮ СИСТЕМУ (долг 196). Системный
   * лист покупки рисует сам магазин — это не наш интерфейс, и там его имя
   * законно.
   */
  purchase: {
    heading: string;
    intro: string;
    /** Названия трёх пакетов. Цену к ним подставляет магазин. */
    planMonthly: string;
    planAnnual: string;
    planLifetime: string;
    /** Подпись под названием: что именно даёт этот пакет. */
    noteMonthly: string;
    noteAnnual: string;
    noteLifetime: string;
    loading: string;
    /**
     * ЧЕТЫРЕ РАЗНЫХ ОТКАЗА ВМЕСТО ОДНОГО НЕМОГО — заход 7.225.
     *
     * До 23.09.2026 отказ был один (`unavailable`), и он ничего не
     * различал: «в этой оболочке магазина нет», «магазин не ответил»,
     * «товаров для этой учётной записи нет» и «нет сети» выглядели
     * одинаково. Лечатся они РАЗНЫМ: первое — новой сборкой, второе —
     * повтором, третье — списком тестировщиков трека, четвёртое —
     * интернетом. Теперь у каждого свой текст и свой короткий код
     * (`RC-…`), который видно на фотографии экрана.
     */
    failPlugin: string;
    failConnect: string;
    failProducts: string;
    /** Подпись перед кодом ошибки мелким шрифтом. */
    codeLabel: string;
    retry: string;
    restoreCta: string;
    /**
     * ДВА РАЗНЫХ ИСХОДА ВОССТАНОВЛЕНИЯ ВМЕСТО ОДНОГО — заход 7.226.
     *
     * До 23.09.2026 исход был один: «Прежних покупок у этой учётной
     * записи не нашлось». Владелец снял его 23.09.2026 на POCO после
     * того, как его же тестовая подписка истекла, — то есть покупка БЫЛА,
     * и текст был неправдой. Различить эти два случая есть чем и без
     * догадок: `CustomerInfo.allPurchasedProductIdentifiers` перечисляет
     * ВСЕ купленные товары независимо от того, истёк доступ или нет, а
     * `entitlements.active` — только действующие права. Пусто и то и
     * другое — покупок не было вовсе; пусто только второе — покупки были,
     * но доступ по ним кончился.
     */
    restoredNothing: string;
    restoredExpired: string;
    /** Пока ждём подтверждения от сервера после покупки. */
    activating: string;
    activated: string;
    /** Подтверждение не доехало за отведённое время. */
    activationSlow: string;
    /** Отложенная покупка: оплата наличными в магазине. */
    pending: string;
    offline: string;
    failed: string;
    /** Аноним: покупать может только вошедший. */
    signInFirst: string;
    signInCta: string;
    /** Ссылка в кабинете для тех, кто купил в приложении. */
    manageCta: string;
    /** Строка статуса для тех, кто оплатил на сайте. */
    webBought: string;
  };
}

const COPY: Record<Locale, NativeAccessCopy> = {
  es: {
    notice: {
      heading: "Qué está abierto en la aplicación",
      body: "En esta versión de la aplicación no hay compras. Una parte del curso está abierta para todos y se usa sin límite de tiempo.",
      openHeading: "Abierto ahora",
      openItems: [
        "Una muestra fija de cuentos, palabras, juegos y clases en cada nivel",
        "Toda la gramática, el glosario y las páginas de referencia",
        "Tu progreso, tu racha de días y tu perfil",
      ],
      closedHeading: "Cerrado por ahora",
      closedBody:
        "El resto del material aparece con un candado. Seguirá cerrado en esta versión de la aplicación; no hace falta que hagas nada.",
      activeHeading: "Tu cuenta tiene el acceso completo",
      activeBody:
        "Todo el material está abierto para ti y aquí no hay nada pendiente.",
      backCta: "Volver al curso",
    },
    lock: {
      heading: "Este material está cerrado",
      body: {
        lesson:
          "Esta clase forma parte de la sección cerrada del curso. En esta versión de la aplicación no se puede abrir, y el resto del curso sigue disponible como siempre.",
        exam:
          "Este examen de nivel está cerrado en esta versión de la aplicación. Las clases abiertas y sus ejercicios siguen funcionando con normalidad.",
        story:
          "Este relato está cerrado en esta versión de la aplicación. La biblioteca tiene otros relatos abiertos, con su audio, en todos los niveles.",
        puzzle:
          "Este juego de palabras está cerrado en esta versión de la aplicación. Quedan abiertas sopas de letras y crucigramas de los dos tipos en los demás niveles.",
        video:
          "Este video está cerrado en esta versión de la aplicación. La videoteca tiene otros videos y canciones abiertos, con traducción línea por línea.",
        flashcard:
          "Estas tarjetas de vocabulario están cerradas en esta versión de la aplicación. En cada tema hay una muestra abierta que se usa sin límite de tiempo.",
        idiom:
          "Estas expresiones están cerradas en esta versión de la aplicación. La lista abierta de modismos y refranes sigue funcionando como siempre.",
      },
      premiumNote: "Este material entra en el plan Premium.",
      close: "Entendido",
    },
    download: {
      heading: "Ya tienes la aplicación",
      body:
        "Estás leyendo esto dentro de la aplicación, así que no hace falta instalar nada. El curso, el vocabulario, los cuentos y los juegos se abren aquí mismo.",
      cta: "Ir al curso",
    },
    profileNote:
      "En esta versión de la aplicación no hay compras. La parte abierta del curso funciona con normalidad.",
    closedNote:
      "Esta parte del curso está cerrada en esta versión de la aplicación.",
    locked: {
      words: { one: "{count} palabra", few: "{count} palabras", many: "{count} palabras" },
      expressions: { one: "{count} expresión", few: "{count} expresiones", many: "{count} expresiones" },
      closed: "Hay {items} cerradas.",
      closedAtLevel: "Hay {items} del nivel {level} cerradas.",
      closedInTopic: "Hay {items} cerradas en el tema «{topic}».",
      closedAtLevelInTopic: "Hay {items} del nivel {level} cerradas en el tema «{topic}».",
      rest: "El resto del material funciona con normalidad.",
      badgePremium: "Solo Premium",
      badge: "Con suscripción",
    },
    courses: {
      note: "De cada nivel está abierta la primera clase. Las demás aparecen con un candado.",
      openLine: "Abierto: {open} de {total}",
      lockedLine: "{locked} con candado",
    },
    purchase: {
      heading: "Abrir todo el curso",
      intro:
        "Con el acceso completo se abren las 120 clases, todos los cuentos con audio, el vocabulario entero y los juegos de palabras.",
      planMonthly: "Un mes",
      planAnnual: "Un año",
      planLifetime: "Premium para siempre",
      noteMonthly: "Se renueva cada mes; puedes darlo de baja cuando quieras.",
      noteAnnual: "Se renueva cada año.",
      noteLifetime: "Un solo pago. Incluye el nivel C1 y los juegos con estrella.",
      loading: "Cargando las opciones…",
      failPlugin:
        "Esta versión de la aplicación todavía no puede abrir la tienda. Actualízala a la última versión y vuelve a intentarlo.",
      failConnect:
        "No conseguimos conectar con la tienda. Espera un momento y vuelve a intentarlo.",
      failProducts:
        "La tienda respondió, pero no encontró ninguna opción para tu cuenta. Prueba de nuevo más tarde.",
      codeLabel: "Código",
      retry: "Reintentar",
      restoreCta: "Restaurar compras",
      restoredNothing: "No encontramos compras activas en esta cuenta.",
      restoredExpired: "Encontramos compras anteriores, pero su acceso ya venció.",
      activating: "Activando tu acceso…",
      activated: "Listo: tu acceso ya está abierto.",
      activationSlow:
        "El pago se registró, pero el acceso todavía no llega. Espera un momento y vuelve a intentarlo; no hace falta pagar otra vez.",
      pending:
        "Tu pago quedó pendiente. El acceso se abrirá solo en cuanto se confirme; no hace falta hacer nada más.",
      offline: "No hay conexión. Revisa tu internet y vuelve a intentarlo.",
      failed: "No se pudo completar. Vuelve a intentarlo.",
      signInFirst: "Entra en tu cuenta para abrir el acceso completo.",
      signInCta: "Entrar",
      manageCta: "Gestionar la suscripción",
      webBought: "Tu acceso viene de tu cuenta y funciona igual aquí.",
    },
  },
  ru: {
    notice: {
      heading: "Что открыто в приложении",
      body: "В этой версии приложения покупок нет. Часть курса открыта всем и работает без ограничения по времени.",
      openHeading: "Открыто сейчас",
      openItems: [
        "Постоянная выборка рассказов, слов, игр и уроков на каждом уровне",
        "Вся грамматика, глоссарий и справочные страницы",
        "Ваш прогресс, серия дней и личный кабинет",
      ],
      closedHeading: "Пока закрыто",
      closedBody:
        "Остальной материал показан с замком. В этой версии приложения он останется закрытым; делать ничего не нужно.",
      activeHeading: "У вашей учётной записи полный доступ",
      activeBody: "Весь материал открыт, и здесь ничего не требуется.",
      backCta: "Вернуться к курсу",
    },
    lock: {
      heading: "Этот материал закрыт",
      body: {
        lesson:
          "Этот урок относится к закрытой части курса. В этой версии приложения его не открыть, а остальной курс работает как обычно.",
        exam:
          "Этот экзамен уровня закрыт в этой версии приложения. Открытые уроки и упражнения к ним работают как обычно.",
        story:
          "Этот рассказ закрыт в этой версии приложения. В библиотеке остаются открытые рассказы с озвучкой — на каждом уровне.",
        puzzle:
          "Эта игра со словами закрыта в этой версии приложения. Открытыми остаются филворды и кроссворды обоих видов на остальных уровнях.",
        video:
          "Это видео закрыто в этой версии приложения. В видеотеке остаются открытые видео и песни с построчным переводом.",
        flashcard:
          "Эти карточки словаря закрыты в этой версии приложения. В каждой теме есть открытая выборка, и она работает без ограничения по времени.",
        idiom:
          "Эти выражения закрыты в этой версии приложения. Открытый список идиом и пословиц работает как обычно.",
      },
      premiumNote: "Этот материал входит в план Premium.",
      close: "Понятно",
    },
    download: {
      heading: "Приложение уже установлено",
      body:
        "Вы читаете это внутри приложения, устанавливать ничего не нужно. Курс, словарь, рассказы и игры открываются прямо здесь.",
      cta: "Перейти к курсу",
    },
    profileNote:
      "В этой версии приложения покупок нет. Открытая часть курса работает как обычно.",
    closedNote:
      "Эта часть курса закрыта в этой версии приложения.",
    locked: {
      words: { one: "{count} слово", few: "{count} слова", many: "{count} слов" },
      expressions: { one: "{count} выражение", few: "{count} выражения", many: "{count} выражений" },
      closed: "Закрыто {items}.",
      closedAtLevel: "Закрыто {items} уровня {level}.",
      closedInTopic: "Закрыто {items} в теме «{topic}».",
      closedAtLevelInTopic: "Закрыто {items} уровня {level} в теме «{topic}».",
      rest: "Остальной материал работает как обычно.",
      badgePremium: "Только Premium",
      badge: "По подписке",
    },
    courses: {
      note: "На каждом уровне открыт первый урок. Остальные показаны с замком.",
      openLine: "Открыто: {open} из {total}",
      lockedLine: "{locked} с замком",
    },
    purchase: {
      heading: "Открыть весь курс",
      intro:
        "С полным доступом открываются все 120 уроков, рассказы с озвучкой, весь словарь и игры со словами.",
      planMonthly: "Месяц",
      planAnnual: "Год",
      planLifetime: "Premium навсегда",
      noteMonthly: "Продлевается каждый месяц, отменить можно в любой момент.",
      noteAnnual: "Продлевается раз в год.",
      noteLifetime: "Один платёж. Включает уровень C1 и игры со звездой.",
      loading: "Загружаем варианты…",
      failPlugin:
        "Эта версия приложения пока не умеет открывать магазин. Обновите приложение до последней версии и попробуйте снова.",
      failConnect:
        "Не удалось связаться с магазином. Подождите немного и попробуйте ещё раз.",
      failProducts:
        "Магазин ответил, но вариантов для вашей учётной записи не нашлось. Попробуйте позже.",
      codeLabel: "Код",
      retry: "Повторить",
      restoreCta: "Восстановить покупки",
      restoredNothing: "Активных покупок у этой учётной записи не нашлось.",
      restoredExpired: "Прежние покупки нашлись, но срок доступа по ним уже закончился.",
      activating: "Активируем доступ…",
      activated: "Готово: доступ открыт.",
      activationSlow:
        "Оплата прошла, а доступ ещё не доехал. Подождите немного и нажмите ещё раз — платить второй раз не нужно.",
      pending:
        "Оплата пока не подтверждена. Доступ откроется сам, как только она пройдёт; делать ничего не нужно.",
      offline: "Нет соединения. Проверьте интернет и попробуйте ещё раз.",
      failed: "Не получилось завершить. Попробуйте ещё раз.",
      signInFirst: "Войдите в учётную запись, чтобы открыть полный доступ.",
      signInCta: "Войти",
      manageCta: "Управлять подпиской",
      webBought: "Доступ привязан к вашей учётной записи и работает здесь так же.",
    },
  },
};

export function nativeAccessCopy(lang: Locale): NativeAccessCopy {
  return COPY[lang];
}

/**
 * Готовый текст окна «Этот материал закрыт» — ОДНА точка сборки на все
 * три поверхности, где он печатается (само окно, страница рассказа,
 * страница видео). 7.196, часть 3.
 *
 * Собирается здесь, а не у вызывающих, по той же причине, по какой знак
 * собирает `accessSignFor`: три места, собирающие один текст, — это три
 * места, где он может разойтись.
 */
export function nativeLockBody(lang: Locale, kind: LockedKind, premium: boolean): string {
  const lock = COPY[lang].lock;
  return premium ? `${lock.body[kind]} ${lock.premiumNote}` : lock.body[kind];
}
