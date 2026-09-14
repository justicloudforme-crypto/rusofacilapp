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
  /** Окно, которое открывается вместо пейвола по тапу на закрытый
   *  материал: замок, объяснение, одна кнопка «понятно». */
  lock: {
    heading: string;
    body: string;
    close: string;
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
    /** «В этой версии приложения закрыто {items}.» — {items} приходит из
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
      body: "Forma parte de la sección cerrada del curso. En esta versión de la aplicación no se puede abrir, y el resto del material sigue disponible como siempre.",
      close: "Entendido",
    },
    profileNote:
      "En esta versión de la aplicación no hay compras. La parte abierta del curso funciona con normalidad.",
    closedNote:
      "Esta parte del curso está cerrada en esta versión de la aplicación.",
    locked: {
      words: { one: "{count} palabra", few: "{count} palabras", many: "{count} palabras" },
      expressions: { one: "{count} expresión", few: "{count} expresiones", many: "{count} expresiones" },
      closed: "En esta versión de la aplicación hay {items} cerradas aquí.",
      closedAtLevel: "En esta versión de la aplicación hay {items} del nivel {level} cerradas.",
      closedInTopic: "En esta versión de la aplicación hay {items} cerradas en el tema «{topic}».",
      closedAtLevelInTopic:
        "En esta versión de la aplicación hay {items} del nivel {level} cerradas en el tema «{topic}».",
      rest: "El resto del material funciona con normalidad.",
      badgePremium: "Solo Premium",
      badge: "Con suscripción",
    },
    courses: {
      note: "De cada nivel está abierta la primera clase. Las demás aparecen con un candado.",
      openLine: "Abierto: {open} de {total}",
      lockedLine: "{locked} con candado",
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
      body: "Он относится к закрытой части курса. В этой версии приложения его не открыть, а остальной материал работает как обычно.",
      close: "Понятно",
    },
    profileNote:
      "В этой версии приложения покупок нет. Открытая часть курса работает как обычно.",
    closedNote:
      "Эта часть курса закрыта в этой версии приложения.",
    locked: {
      words: { one: "{count} слово", few: "{count} слова", many: "{count} слов" },
      expressions: { one: "{count} выражение", few: "{count} выражения", many: "{count} выражений" },
      closed: "В этой версии приложения закрыто {items}.",
      closedAtLevel: "В этой версии приложения закрыто {items} уровня {level}.",
      closedInTopic: "В этой версии приложения закрыто {items} в теме «{topic}».",
      closedAtLevelInTopic: "В этой версии приложения закрыто {items} уровня {level} в теме «{topic}».",
      rest: "Остальной материал работает как обычно.",
      badgePremium: "Только Premium",
      badge: "По подписке",
    },
    courses: {
      note: "На каждом уровне открыт первый урок. Остальные показаны с замком.",
      openLine: "Открыто: {open} из {total}",
      lockedLine: "{locked} с замком",
    },
  },
};

export function nativeAccessCopy(lang: Locale): NativeAccessCopy {
  return COPY[lang];
}
