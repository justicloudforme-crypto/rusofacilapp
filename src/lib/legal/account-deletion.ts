import type { Locale } from "@/i18n/config";

/**
 * УДАЛЕНИЕ АККАУНТА: ПУБЛИЧНАЯ СТРАНИЦА И ПРЕДУПРЕЖДЕНИЕ ПРО GOOGLE PLAY —
 * заход 7.242, долги 344 и 345 (аудит 7.241, Р3 и Р4).
 *
 * ЗАЧЕМ ОТДЕЛЬНАЯ СТРАНИЦА. Анкета Google Play Data safety требует адрес
 * («Delete account URL»), по которому БЕЗ входа и без приложения видно:
 * имя приложения, шаги удаления, что удаляется, что остаётся и на какой
 * срок. Якорь `/es/privacy#tus-derechos` был одним абзацем без шагов и без
 * сроков. Страница — `/[lang]/eliminar-cuenta`, один сегмент на обе локали
 * (как `/sobre-nosotros`), без входа, в карте сайта.
 *
 * ЧЕМ ЗАЗЕМЛЕНЫ ФАКТЫ (сверяет `npm run check:account-deletion`):
 *   * ссылка живёт 30 минут — `TTL_MS.delete_account` в
 *     `src/lib/verification-token.ts`;
 *   * резервные копии — `RETENTION_COUNT = 14` ежедневных копий
 *     (`src/lib/backup.ts`, расписание `0 8 * * *` в `vercel.json`), то
 *     есть до 14 дней;
 *   * удаление отменяет только подписки Stripe
 *     (`src/app/api/auth/confirm-account-deletion/route.ts`), подписку
 *     Google Play — нет;
 *   * все строки пользователя уходят каскадом (`onDelete: Cascade`), замер
 *     7.241 раздел 3.8: 17 таблиц → 0.
 *
 * ПОЧЕМУ НЕ В `src/dictionaries/*.json`: словарь целиком уезжает во
 * flight-разметку каждой страницы (замер 7.183, см. шапку
 * `native-access-copy.ts`), а эти тексты читают три страницы.
 */

/** Центр подписок Google Play. Без `sku`/`package`: страница публичная, и
 *  человек, читающий её в браузере компьютера, должен попасть в общий
 *  список своих подписок, а не на карточку товара. */
export const PLAY_SUBSCRIPTIONS_URL = "https://play.google.com/store/account/subscriptions";

export const APP_NAME = "RusoFácil: aprender ruso";
export const SUPPORT_EMAIL = "support@rusofacilapp.com";

export interface DeletionPageSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
  /** Нумерованный список шагов, а не маркированный. */
  ordered?: boolean;
}

export interface AccountDeletionCopy {
  title: string;
  metaDescription: string;
  intro: string;
  sections: DeletionPageSection[];
  /** Предупреждение в форме удаления и на странице подтверждения — у тех, у
   *  кого подписка Google Play продлевается. */
  playWarning: string;
  /** Та же мысль условно — для страницы подтверждения, открытой без входа
   *  (ссылка из письма часто открывается в браузере, а не в приложении, и
   *  сервер не знает, чья это учётная запись). */
  playWarningUnknown: string;
  playLinkLabel: string;
  /** Ссылка из профиля и из политики на эту страницу. */
  pageLinkLabel: string;
  /** Строка на главной после `?accountDeleted=1`. */
  deletedNotice: string;
}

export const ACCOUNT_DELETION_COPY: Record<Locale, AccountDeletionCopy> = {
  es: {
    title: "Cómo eliminar tu cuenta de RusoFácil",
    metaDescription:
      "Pasos para eliminar tu cuenta de RusoFácil (app «RusoFácil: aprender ruso» y rusofacilapp.com), qué datos se borran, qué se conserva y durante cuánto tiempo.",
    intro: `Esta página explica cómo eliminar tu cuenta de la aplicación «${APP_NAME}» para Android y del sitio web rusofacilapp.com. Es la misma cuenta en los dos: si la eliminas en uno, desaparece en ambos.`,
    sections: [
      {
        heading: "Desde la aplicación o desde el sitio web",
        ordered: true,
        items: [
          "Inicia sesión y abre «Mi perfil».",
          "Entra en «Ajustes» → «Seguridad» y abre «Zona de riesgo».",
          "Escribe tu contraseña y pulsa «Eliminar cuenta».",
          "Te enviamos un correo con un enlace que vale 30 minutos. Ábrelo y pulsa «Eliminar cuenta definitivamente».",
        ],
      },
      {
        heading: "Sin la aplicación o sin contraseña",
        paragraphs: [
          `Escríbenos a ${SUPPORT_EMAIL} desde el correo con el que te registraste y pide que eliminemos tu cuenta. Comprobaremos que el correo es tuyo y la eliminaremos en un plazo máximo de 30 días; te avisaremos cuando esté hecho.`,
        ],
      },
      {
        heading: "Si pagas una suscripción en Google Play",
        paragraphs: [
          `Eliminar la cuenta NO cancela una suscripción comprada en Google Play: esa suscripción la cobra y la gestiona Google, y sólo se puede cancelar en Google Play → Suscripciones (${PLAY_SUBSCRIPTIONS_URL}). Cancélala primero; si no, Google seguirá cobrándola aunque la cuenta ya no exista.`,
          "Una suscripción comprada en el sitio web sí se cancela al eliminar la cuenta, y no se te vuelve a cobrar.",
        ],
      },
      {
        heading: "Qué se borra",
        paragraphs: ["En el momento de confirmar, de forma inmediata y permanente:"],
        items: [
          "tu cuenta: correo, nombre, avatar, contraseña cifrada, zona horaria y ajustes;",
          "tu progreso: lecciones, exámenes, tarjetas, historias leídas, juegos, días de estudio, rachas e insignias;",
          "tus suscripciones y pagos registrados en nuestra base de datos;",
          "tu participación en grupos de estudio (y los grupos que creaste) y tu perfil público, si lo tenías activado.",
        ],
      },
      {
        heading: "Qué se conserva y durante cuánto tiempo",
        items: [
          "Copias de seguridad de la base de datos: se guardan hasta 14 días y después se borran solas. No se usan para nada más que recuperar el servicio ante una avería.",
          "Registros de compra en los proveedores de pago: Google Play y RevenueCat (compras en la aplicación) y Stripe (compras en el sitio web) conservan sus propios registros de las transacciones según sus obligaciones legales y fiscales.",
          "Registros de envío de correos de Resend (dirección y asunto), durante su plazo de conservación.",
          "Informes de errores de Sentry que incluyan tu identificador interno de usuario (un código, no tu correo), durante su plazo de conservación.",
          "Si canjeaste un código de acceso, el código queda marcado como usado, ya sin ningún vínculo con tu cuenta.",
          "Tus grabaciones de pronunciación nunca salieron de tu teléfono: se borran desde el propio ejercicio o borrando los datos de la aplicación.",
        ],
      },
      {
        heading: "Contacto",
        paragraphs: [`Para cualquier duda sobre la eliminación de tus datos, escríbenos a ${SUPPORT_EMAIL}.`],
      },
    ],
    playWarning:
      "Tienes una suscripción activa de Google Play. Eliminar la cuenta NO la cancela: cancélala primero en Google Play → Suscripciones, o Google seguirá cobrándola.",
    playWarningUnknown:
      "Si pagas una suscripción a través de Google Play, eliminar la cuenta no la cancela: cancélala primero en Google Play → Suscripciones.",
    playLinkLabel: "Abrir Google Play → Suscripciones",
    pageLinkLabel: "Qué se borra y qué se conserva al eliminar la cuenta",
    deletedNotice: "Tu cuenta se ha eliminado. Gracias por aprender con nosotros.",
  },
  ru: {
    title: "Как удалить аккаунт RusoFácil",
    metaDescription:
      "Как удалить аккаунт RusoFácil (приложение «RusoFácil: aprender ruso» и rusofacilapp.com), какие данные удаляются, что остаётся и на какой срок.",
    intro: `На этой странице — как удалить аккаунт приложения «${APP_NAME}» для Android и сайта rusofacilapp.com. Аккаунт у них один и тот же: удалённый в одном месте, он исчезает в обоих.`,
    sections: [
      {
        heading: "В приложении или на сайте",
        ordered: true,
        items: [
          "Войдите и откройте «Мой профиль».",
          "Откройте «Настройки» → «Безопасность» → «Опасная зона».",
          "Введите пароль и нажмите «Удалить аккаунт».",
          "Мы пришлём письмо со ссылкой, которая действует 30 минут. Откройте её и нажмите «Удалить аккаунт навсегда».",
        ],
      },
      {
        heading: "Без приложения или без пароля",
        paragraphs: [
          `Напишите на ${SUPPORT_EMAIL} с того адреса, на который зарегистрирован аккаунт, и попросите его удалить. Мы убедимся, что адрес ваш, удалим аккаунт не позже чем через 30 дней и сообщим, когда всё будет сделано.`,
        ],
      },
      {
        heading: "Если вы платите за подписку в Google Play",
        paragraphs: [
          `Удаление аккаунта НЕ отменяет подписку, купленную в Google Play: её списывает и ведёт Google, и отменить её можно только в Google Play → «Подписки» (${PLAY_SUBSCRIPTIONS_URL}). Сначала отмените её — иначе Google продолжит списывать деньги, хотя аккаунта уже нет.`,
          "Подписка, купленная на сайте, при удалении аккаунта отменяется, и новых списаний не будет.",
        ],
      },
      {
        heading: "Что удаляется",
        paragraphs: ["Сразу после подтверждения и безвозвратно:"],
        items: [
          "аккаунт: почта, имя, аватар, зашифрованный пароль, часовой пояс и настройки;",
          "прогресс: уроки, экзамены, карточки, прочитанные рассказы, игры, дни занятий, серии и значки;",
          "подписки и платежи, записанные в нашей базе;",
          "участие в учебных группах (и созданные вами группы) и публичный профиль, если он был включён.",
        ],
      },
      {
        heading: "Что остаётся и на какой срок",
        items: [
          "Резервные копии базы: хранятся до 14 дней и потом удаляются сами. Используются только для восстановления сервиса после аварии.",
          "Записи о покупках у платёжных провайдеров: Google Play и RevenueCat (покупки в приложении) и Stripe (покупки на сайте) хранят свои записи о сделках по своим юридическим и налоговым обязанностям.",
          "Журналы отправки писем Resend (адрес и тема письма) — в течение их срока хранения.",
          "Отчёты об ошибках Sentry с вашим внутренним идентификатором (это код, а не почта) — в течение их срока хранения.",
          "Если вы погасили код доступа, код остаётся отмеченным как использованный, уже без связи с вашим аккаунтом.",
          "Записи произношения никогда не покидали ваш телефон: они удаляются в самом упражнении или очисткой данных приложения.",
        ],
      },
      {
        heading: "Контакты",
        paragraphs: [`По любым вопросам об удалении данных пишите на ${SUPPORT_EMAIL}.`],
      },
    ],
    playWarning:
      "У вас активная подписка Google Play. Удаление аккаунта её НЕ отменяет: сначала отмените её в Google Play → «Подписки», иначе Google продолжит списывать деньги.",
    playWarningUnknown:
      "Если вы платите за подписку через Google Play, удаление аккаунта её не отменяет: сначала отмените её в Google Play → «Подписки».",
    playLinkLabel: "Открыть Google Play → «Подписки»",
    pageLinkLabel: "Что удаляется и что остаётся при удалении аккаунта",
    deletedNotice: "Аккаунт удалён. Спасибо, что учились с нами.",
  },
};

export function accountDeletionCopy(lang: Locale): AccountDeletionCopy {
  return ACCOUNT_DELETION_COPY[lang];
}

/** Путь страницы без префикса локали. Один на обе локали. */
export const ACCOUNT_DELETION_PATH = "/eliminar-cuenta";
