import type { Locale } from "@/i18n/config";

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
  },
};

export function nativeAccessCopy(lang: Locale): NativeAccessCopy {
  return COPY[lang];
}
