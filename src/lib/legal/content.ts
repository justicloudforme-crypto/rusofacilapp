/**
 * Terms of Service and Privacy Policy content — plain data, not JSX, so the
 * two page components (src/app/[lang]/terms, src/app/[lang]/privacy) stay
 * tiny renderers. Kept as a separate module rather than stuffed into
 * es.json/ru.json (the UI-microcopy dictionaries) because this is
 * long-form legal text, not short interpolated phrases — same reasoning
 * as lessons/exams living in their own content files instead of the
 * dictionaries.
 *
 * FACTS THIS TEXT IS GROUNDED IN (keep in sync with the code if either
 * changes):
 *  - Operator: an individual (Vasilii Petrov), not a registered company —
 *    see the Privacy Policy's "Responsable" section.
 *  - Governing law: Mexico (LFPDPPP for data protection) — chosen as the
 *    operator's jurisdiction, independent of the fact that the product
 *    itself is now positioned for Spanish speakers globally, not just
 *    Mexico (see the rebrand note in the marketing copy — those are two
 *    separate decisions: legal domicile vs. target audience).
 *  - Contact: support@rusofacilapp.com.
 *  - Money, as of 08.09.2026: three plans — monthly and annual are
 *    Stripe Subscriptions, Premium is a ONE-TIME payment and not a
 *    subscription at all (src/lib/plans.ts, mode "payment"). Every plan is
 *    PRICED in MXN and only MXN (BASE_CURRENCY) — but not necessarily
 *    CHARGED in it. Adaptive Pricing converts at the checkout and bills the
 *    buyer in their own currency (the owner's live checkout said "charge in
 *    EUR", with a switch back to pesos beside it); MXN is what the seller is
 *    SETTLED in, which is a different fact. Until 09.09.2026 both this file
 *    and the pricing footnote said the charge is always in pesos, and that
 *    was untrue (PROGRESS.md 7.120). The figures this site shows in other
 *    currencies are approximate by construction (src/lib/currency.ts). Cash means an
 *    OXXO voucher, valid 3 days, offered to buyers in Mexico and refused
 *    to everyone else by /api/checkout itself (src/lib/country.ts). All
 *    four facts are stated in section 3 of the Terms — keep them in step.
 *  - Data actually collected: email, optional display name, avatarId
 *    (a string like "matryoshka_calm", never a photo/file — see
 *    src/lib/avatars.ts), bcrypt password hash, session cookie,
 *    theme-preference cookie, Stripe subscription status (card details
 *    never touch our servers — Stripe Checkout handles those directly),
 *    and learning progress (lessons, flashcards, stories, exam attempts).
 *    Voice-pronunciation recordings are NOT in that list and have not been
 *    since 30.08.2026: they live in the browser's own IndexedDB
 *    (src/lib/voice-recordings-store.ts, DB "rusofacil-voice", 30 clips /
 *    20 MiB), there is no upload route among the 27 directories of
 *    src/app/api/, and the six modules of the recording path make zero
 *    network calls. Guarded mechanically by scripts/check-legal-truth.mjs.
 *  - Subprocessors — the list is MEASURED, not remembered: every external
 *    dependency imported from src/ must be named in both locales, and
 *    scripts/check-legal-truth.mjs fails the build when one is not.
 *    Stripe (payments), Resend (transactional email),
 *    Turso/libSQL (database), Vercel (hosting), Upstash (Redis — rate
 *    limiting and caching; sees email/IP as cache keys transiently, no
 *    persistent profile), OpenAI (text-to-speech, used ONCE per clip to
 *    produce the course narration — see "narration is generated once"
 *    in PROGRESS.md and src/lib/no-runtime-tts.test.ts, which fails if a
 *    speech call ever appears in runtime code; a listener's browser never
 *    reaches OpenAI), YouTube (embedded
 *    videos in the media library, governed by Google's own policies for
 *    any interaction with an embed), Sentry (error reports), RevenueCat
 *    (in-app purchases on iOS/Android; web purchases go through Stripe),
 *    and three Vercel products beyond hosting — Blob (course audio files),
 *    Web Analytics and Speed Insights (aggregate, cookieless page and
 *    load-time counts).
 *  - Account deletion is genuinely self-service and already built:
 *    password + emailed confirmation link, cascades every DB row (there are
 *    no voice recordings on disk to delete any more — see above and
 *    scripts/check-legal-truth.mjs; the text no longer promises it) (see
 *    src/app/api/auth/confirm-account-deletion/route.ts) — the Privacy
 *    Policy can honestly describe this as already working, not aspirational.
 *  - Subscription cancellation is AT PERIOD END, not immediate. Измерено
 *    по коду 16.09.2026, тремя строками: `cancel_at_period_end: true`
 *    (src/app/api/subscription/cancel/route.ts:64), `status` при отмене
 *    НЕ трогается — ставится только `canceledAt` (:71–74), а доступ
 *    решает дата (`isSubscriptionActive`,
 *    src/lib/subscription-status.ts:26–32: подписка жива, пока
 *    `currentPeriodEnd > now`). До 16.09.2026 раздел 3 обещал обратное —
 *    «доступ прекращается в момент отмены», — и это был текст от старого
 *    кода: немедленную отмену убрали правкой долга 190 (7.193), а
 *    документ за ней не поехал. Кабинет при этом говорил правду
 *    («Отменена — доступ до конца оплаченного периода», статус
 *    `canceling`), то есть расходились между собой не код и кабинет, а
 *    документ и они оба. Возврата за уже начавшийся период по-прежнему
 *    нет, и текст по-прежнему это говорит.
 *  - No age-gate exists at registration. Решение владельца 16.09.2026:
 *    сервис предназначен для лиц от 18 лет — везде, на сайте и в
 *    приложении, в обеих локалях. Формула «13 лет с согласия родителя»
 *    убрана из всех четырёх мест (два в Условиях, два в Политике).
 *    Механизма проверки возраста нет и не заводилось: это условие
 *    использования, а не автоматический контроль, и текст говорит именно
 *    это. Держится сторожем `src/lib/legal/age-18.test.ts`.
 */
import type { Locale } from "@/i18n/config";

/**
 * АБЗАЦ ДОКУМЕНТА — ДОЛГ 196, решение владельца 15.09.2026.
 *
 * Обычно это просто строка. Форма с пометкой `webOnly` нужна ровно для
 * одного случая: абзац правдив и обязан остаться НА САЙТЕ, но внутри
 * приложения его печатать нельзя.
 *
 * ОТКУДА ЭТО. Перестроенный прибор 7.194 нашёл на `/es/terms` и
 * `/ru/terms` слова «MXN» и «OXXO» во всех трёх ролях. Платёжной
 * поверхностью это не является — ни органа управления, ни ссылки на
 * оплату там нет, — но Google запрещает УВОДИТЬ на внешнюю оплату, а
 * абзац, называющий сторонний способ оплаты по имени, лежит в серой
 * зоне. Решение владельца: текст НЕ удалять, на сайте он остаётся
 * полным и правдивым (там есть и Stripe, и продажи), а внутри оболочки
 * раздел про способы оплаты не показывать.
 *
 * Почему пометка на абзаце, а не на разделе: раздел 3 — это ещё и
 * автопродление, и отмена, и право менять цену. Вырезать его целиком
 * значило бы спрятать от человека внутри приложения условия, которые к
 * способам оплаты отношения не имеют.
 *
 * Механизм — уже существующий признак оболочки (`isNativeShellRequest`,
 * заходы 7.117/7.118/7.120), нового здесь нет ничего.
 */
export type LegalParagraph =
  | string
  | { text: string; webOnly: true }
  /**
   * ВТОРАЯ ПОЛОВИНА ТОЙ ЖЕ ПАРЫ — ЗАХОД 7.200, доведение решения по
   * долгу 196.
   *
   * `webOnly` умеет только ПРЯТАТЬ. Этого хватало, пока прятали абзац,
   * без которого документ остаётся полным (способы оплаты). Но абзац
   * «платежи обрабатываются через Stripe» спрятать молча нельзя: тогда
   * внутри приложения человек не узнаёт вовсе, кто списывает деньги и
   * почему мы не храним карту, — а это условие сделки, а не подробность.
   *
   * Поэтому абзацы ходят парой: `webOnly` называет платёжную систему по
   * имени (сайт), `nativeOnly` говорит то же самое, не называя ни одной
   * (приложение). Обе версии правдивы; разная у них только степень
   * подробности, и решение владельца 16.09.2026 — внутри оболочки не
   * называть ни одной платёжной системы, а не только OXXO и MXN.
   *
   * Умолчание прежнее и осознанное: страница, забывшая спросить про
   * оболочку (`nativeShell = false`), отдаёт ВЕБ-версию, то есть документ
   * целиком. Молчаливая потеря текста правового документа хуже лишнего
   * абзаца.
   */
  | { text: string; nativeOnly: true };

export interface LegalSection {
  heading: string;
  paragraphs: LegalParagraph[];
  /**
   * Якорь на раздел: `id` у `<section>` и, значит, адрес вида
   * `/es/privacy#tus-derechos`.
   *
   * Заведён 13.09.2026 ради поля «Delete account URL» в анкете Google
   * Play Data safety: там требуется адрес, ведущий ИМЕННО на объяснение,
   * как удалить учётную запись, а не на политику целиком. Ссылка на
   * документ без якоря — это ссылка на 12 разделов, среди которых
   * проверяющий обязан искать сам, и на ревью это законное замечание.
   *
   * Слаг у обеих локалей ОДИН И ТОТ ЖЕ (`tus-derechos`), хотя заголовки
   * разные («7. Tus derechos» и «7. Ваши права»). Это сделано нарочно:
   * якорь — технический адрес, а не видимый текст, и один адрес обязан
   * работать на обеих страницах, иначе в анкету придётся вписывать два
   * разных, а поле там одно.
   *
   * Необязательное: раздел без якоря по-прежнему рисуется, просто на
   * него нельзя сослаться. Обязательным сделано только то, на что
   * ссылаются снаружи, и это стережёт `check:legal-truth`.
   */
  slug?: string;
}

export interface LegalDocument {
  title: string;
  /** ISO-дата решения, написанная рукой. НЕ время сборки: сборка идёт при
   * каждом деплое, а документ меняется по решению — путать их значит
   * заводить долг класса 39/40 («контент в коде не датирован») наоборот. */
  lastUpdated: string;
  /** Подпись перед датой. Без неё на странице стояло голое «2026-08-31», и
   * читатель не мог знать, что это за число. */
  lastUpdatedLabel: string;
  intro: string;
  sections: LegalSection[];
}

// 31.08.2026: only the OpenAI line changed, and only to say the same
// thing more precisely — the narration is pre-generated, so listening
// sends nothing to OpenAI. The old wording was in the present tense
// ("genera el audio…") and read as if a clip were synthesised while the
// student pressed play. Nothing about what is collected changed.
// 09.09.2026: восемь утверждений о голосе переписаны — они говорили, что
// запись хранится у нас, а с 30.08.2026 (7.49) она не покидает устройство
// (долг 73). Тем же заходом названы обработчики, которых текст не называл:
// Sentry, RevenueCat и три продукта Vercel (Blob, Web Analytics, Speed
// Insights) — долг 74. Дата написана рукой и НЕ берётся из времени сборки:
// сборка идёт при каждом деплое, а документ меняется по решению, и дата
// обязана означать второе (тот же класс, что долги 39 и 40).
// 16.09.2026: раздел «Несовершеннолетние» / «Menores de edad» переписан
// с 13 лет на 18 — решение владельца, одно и то же на сайте и в
// приложении. Больше в политике не изменилось ничего, но изменение
// касается того, чьи данные мы соглашаемся обрабатывать, и такое обязано
// двигать дату.
const PRIVACY_LAST_UPDATED = "2026-09-16";

// 08.09.2026: section 3 of the Terms gained the three things it had never
// said out loud — that cash (an OXXO voucher) is offered to buyers in
// Mexico and to nobody else, that Premium is a one-time payment and not a
// subscription, and something about the currency that was itself wrong.
//
// 09.09.2026: that last one is corrected. The paragraph said the charge is
// always in pesos; with Adaptive Pricing on, the checkout bills the buyer
// in their own currency and offers pesos as a choice beside it (PROGRESS.md
// 7.120). Pesos are what the SELLER is settled in — a fact about our bank,
// not about the reader's card statement. Correcting what a buyer is
// promised is exactly the kind of change that has to move the date; the
// Privacy Policy did not change and keeps its own, which is why these are
// two constants and not one.
// 16.09.2026 — заход 7.200, три правки, и каждая меняет то, что человеку
// обещано:
//   * ОТМЕНА. Раздел 3 говорил «вступает в силу немедленно, доступ
//     прекращается в момент отмены». Код с 7.193 делает
//     `cancel_at_period_end`, то есть доступ держится до конца уже
//     оплаченного периода, и кабинет так и пишет. Текст приведён к коду —
//     в пользу читателя, а не против него, поэтому и дата обязана
//     сдвинуться: человек, прочитавший старую редакцию, мог не отменять
//     подписку из страха потерять оплаченное.
//   * ВОЗРАСТ. «Не для детей младше 13 лет, с 13 — с согласия родителя»
//     заменено на «от 18 лет» (решение владельца, оно же согласуется с
//     целевой аудиторией «18+» в карточке Google Play).
//   * ПЛАТЁЖНАЯ СИСТЕМА ВНУТРИ ПРИЛОЖЕНИЯ. Абзац про Stripe разведён на
//     пару `webOnly`/`nativeOnly`: на сайте система названа по имени, в
//     приложении — нет, а сам факт («карту мы не храним, списывает
//     внешний обработчик») сказан на обеих поверхностях.
// Плюс одна правка, которая обещаний не меняет, но перестала быть
// правдой: «и, в будущем, через нативные мобильные приложения» читает
// человек, уже сидящий в этом приложении.
// 16.09.2026, заход 7.202, часть 4 — ПРАВКА ЯЗЫКА, А НЕ СМЫСЛА, И ДАТА
// ПОЭТОМУ НЕ ДВИГАЕТСЯ НИ У ОДНОГО ИЗ ДВУХ ДОКУМЕНТОВ.
//
// Что поправлено в ИСПАНСКОМ тексте (русский решением владельца не
// тронут): «idioms» → «modismos» (английское слово в испанском перечне),
// «cámbiala contraseña» → «cambia la contraseña» (слипшееся «cambia la»),
// и шесть пар прямых кавычек заменены на «…» — пять во вступлении и
// разделе 7 Условий, шестая в разделе 2 Политики (`'matryoshka_calm'`),
// которую владелец не называл, а нашёл прогон всего текста.
//
// Названная владельцем «tu pais» ОПРОВЕРГНУТА числом: в репозитории 0
// вхождений, слово `país` встречается четыре раза и все четыре с
// ударением.
//
// Ни одно обещание, ни одна цифра, ни один получатель данных не
// изменились — значит и обе даты ниже остаются прежними. Обе и так стоят
// на 16.09.2026, то есть на дне этой правки: двигать нечего даже при
// обратном решении. Держит `npm run check:legal-es-text`.
const TERMS_LAST_UPDATED = "2026-09-16";

export const TERMS_CONTENT: Record<Locale, LegalDocument> = {
  es: {
    title: "Términos de Servicio",
    lastUpdated: TERMS_LAST_UPDATED,
    lastUpdatedLabel: "Última actualización:",
    intro:
      "Estos Términos de Servicio («Términos») regulan el uso de RusoFácilapp.com y de la aplicación asociada (el «Servicio»), operado por Vasilii Petrov («nosotros», «el operador»). Al crear una cuenta o usar el Servicio, aceptas estos Términos. Si no estás de acuerdo, no uses el Servicio.",
    sections: [
      {
        heading: "1. Descripción del Servicio",
        paragraphs: [
          "RusoFácilapp es una plataforma de aprendizaje del idioma ruso dirigida a hablantes de español, con lecciones estructuradas (niveles A1 a B2), historias de lectura, vocabulario, modismos, ejercicios de pronunciación y una biblioteca de video y audio.",
          "El Servicio se ofrece a través del sitio web y de la aplicación móvil. Algunas funciones (lecciones, exámenes, historias completas) requieren una suscripción de pago; otras son de acceso gratuito.",
        ],
      },
      {
        heading: "2. Cuentas de usuario",
        paragraphs: [
          "Para acceder a la mayoría de las funciones necesitas crear una cuenta con un correo electrónico y una contraseña. Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad que ocurra en tu cuenta.",
          "Debes proporcionar información veraz al registrarte. Si detectas un uso no autorizado de tu cuenta, cambia la contraseña de inmediato desde tu perfil o usa la opción de recuperación de contraseña.",
          "El Servicio está dirigido a personas mayores de 18 años. Al crear una cuenta declaras que tienes 18 años cumplidos. No comprobamos la edad por medios técnicos: es una condición de uso, no un control automático. Si sabemos que una cuenta pertenece a alguien menor de 18 años, la eliminaremos.",
        ],
      },
      {
        heading: "3. Suscripciones y pagos",
        paragraphs: [
          "Ofrecemos dos planes de suscripción —mensual y anual— y un plan Premium de pago único.",
          { webOnly: true, text: "Los pagos se procesan a través de Stripe; nunca almacenamos los datos de tu tarjeta en nuestros servidores." },
          { nativeOnly: true, text: "Los pagos los procesa un proveedor de pagos externo; nunca almacenamos los datos de tu tarjeta en nuestros servidores." },
          "Las suscripciones mensual y anual se renuevan automáticamente al final de cada periodo, salvo que las canceles antes de la fecha de renovación.",
          "El plan Premium no es una suscripción: es un pago único. No se renueva, no genera cobros posteriores y no hay nada que cancelar; el acceso que otorga se mantiene mientras el Servicio siga en funcionamiento.",
          { webOnly: true, text: "Además del pago con tarjeta, aceptamos pago en efectivo mediante un vale OXXO, y únicamente para compradores en México: OXXO es una cadena de tiendas mexicana y su vale no puede pagarse fuera del país. El vale es válido durante 3 días; si vence sin pagarse no se te cobra nada y puedes generar otro. El acceso se activa automáticamente en cuanto la tienda confirma el pago. Un pago en efectivo cubre un solo periodo y nunca genera cobros automáticos: para continuar hay que repetirlo." },
          { webOnly: true, text: "El precio base de todos los planes está fijado en pesos mexicanos (MXN). El cobro, en cambio, no siempre se hace en pesos: la página de pago puede presentarte el importe convertido a la moneda de tu país y cobrártelo en ella, y ahí mismo puedes elegir pagar en pesos si lo prefieres. El importe exacto y el tipo de cambio los fija esa página en el momento del cobro (o tu banco, si aplica su propia conversión); los importes en otras monedas que mostramos en el sitio son aproximados y pueden diferir del cargo final. En los planes mensual y anual, el importe de las renovaciones puede variar ligeramente si varía el tipo de cambio, aunque el precio en pesos siga siendo el mismo." },
          "Puedes cancelar tu suscripción mensual o anual en cualquier momento desde tu perfil. La cancelación detiene la renovación, no el acceso: conservas las funciones de pago hasta el final del periodo que ya has pagado, y al terminar ese periodo no se te cobra nada más. Salvo que la ley aplicable exija lo contrario, no ofrecemos reembolsos por el periodo en curso, precisamente porque lo sigues usando hasta el final.",
          "Nos reservamos el derecho de modificar los precios de las suscripciones. Cualquier cambio se aplicará a partir del siguiente ciclo de renovación, nunca de forma retroactiva.",
        ],
      },
      {
        heading: "4. Contenido del curso y propiedad intelectual",
        paragraphs: [
          "Todo el contenido educativo del Servicio (lecciones, historias, ejercicios, glosario, narraciones de audio) es propiedad del operador o se usa bajo licencia, y está protegido por leyes de propiedad intelectual. Puedes usarlo únicamente para tu aprendizaje personal, no comercial.",
          "Las grabaciones de práctica de pronunciación no se suben: se quedan en el almacenamiento del propio navegador de tu dispositivo (IndexedDB) y nunca llegan a nuestros servidores. Son tuyas y sólo tuyas, y no te pedimos ninguna licencia sobre ellas porque nunca las recibimos.",
          "La biblioteca de audio y video incluye videos incrustados de YouTube mediante su reproductor oficial; no alojamos ni redistribuimos esos videos. Su uso está sujeto también a los Términos de Servicio de YouTube/Google.",
        ],
      },
      {
        heading: "5. Uso aceptable",
        paragraphs: [
          "No debes: intentar acceder a cuentas ajenas, interferir con el funcionamiento del Servicio, extraer o redistribuir el contenido del curso de forma masiva, ni usar el Servicio para fines ilegales.",
          "Nos reservamos el derecho de suspender o eliminar cuentas que incumplan estos Términos.",
        ],
      },
      {
        heading: "6. Eliminación de cuenta",
        paragraphs: [
          "Puedes eliminar tu cuenta en cualquier momento desde tu perfil. El proceso requiere tu contraseña y la confirmación de un enlace enviado a tu correo, y elimina de forma permanente tu cuenta y tu progreso, y cancela cualquier suscripción activa. Esta acción no se puede deshacer. Tus grabaciones de pronunciación no entran en ese borrado porque nunca estuvieron en nuestros servidores: viven en tu dispositivo y las borras tú, desde el propio ejercicio o vaciando los datos del sitio en tu navegador.",
        ],
      },
      {
        heading: "7. Exclusión de garantías y limitación de responsabilidad",
        paragraphs: [
          "El Servicio se ofrece «tal cual». No garantizamos que esté libre de errores o interrupciones. En la medida permitida por la ley aplicable, no seremos responsables de daños indirectos derivados del uso del Servicio.",
        ],
      },
      {
        heading: "8. Cambios en estos Términos",
        paragraphs: [
          "Podemos actualizar estos Términos ocasionalmente. Publicaremos la nueva versión en esta página con la fecha de actualización correspondiente. El uso continuado del Servicio después de un cambio implica su aceptación.",
        ],
      },
      {
        heading: "9. Ley aplicable",
        paragraphs: [
          "Estos Términos se rigen por las leyes de México, sin perjuicio de los derechos que la legislación de protección al consumidor de tu país de residencia pueda otorgarte de forma imperativa.",
        ],
      },
      {
        heading: "10. Contacto",
        paragraphs: ["Para cualquier duda sobre estos Términos, escríbenos a support@rusofacilapp.com."],
      },
    ],
  },
  ru: {
    title: "Условия использования",
    lastUpdated: TERMS_LAST_UPDATED,
    lastUpdatedLabel: "Последнее изменение:",
    intro:
      "Эти Условия использования («Условия») регулируют использование сайта RusoFácilapp.com и связанного с ним приложения («Сервис»), которым управляет Василий Петров («мы», «оператор»). Создавая аккаунт или используя Сервис, вы соглашаетесь с этими Условиями. Если вы не согласны — пожалуйста, не используйте Сервис.",
    sections: [
      {
        heading: "1. Описание Сервиса",
        paragraphs: [
          "RusoFácilapp — платформа для изучения русского языка испаноговорящими пользователями: структурированные уроки (уровни A1–B2), рассказы для чтения, словарь, идиомы, упражнения на произношение и библиотека аудио- и видеоматериалов.",
          "Сервис доступен через сайт и через мобильное приложение. Часть функций (уроки, экзамены, полные рассказы) доступна по платной подписке, часть — бесплатно.",
        ],
      },
      {
        heading: "2. Аккаунты пользователей",
        paragraphs: [
          "Для доступа к большинству функций нужно зарегистрировать аккаунт с email и паролем. Вы несёте ответственность за конфиденциальность своего пароля и за любые действия в своём аккаунте.",
          "При регистрации нужно указывать достоверные данные. Если вы заметили несанкционированный доступ к своему аккаунту — немедленно смените пароль в профиле или воспользуйтесь функцией восстановления пароля.",
          "Сервис предназначен для лиц от 18 лет. Создавая аккаунт, вы подтверждаете, что вам исполнилось 18 лет. Технической проверки возраста у нас нет: это условие использования, а не автоматический контроль. Если нам станет известно, что аккаунт принадлежит человеку младше 18 лет, мы его удалим.",
        ],
      },
      {
        heading: "3. Подписки и оплата",
        paragraphs: [
          "Мы предлагаем две подписки — месячную и годовую — и тариф Premium с разовым платежом.",
          { webOnly: true, text: "Платежи обрабатываются через Stripe; данные вашей карты никогда не хранятся на наших серверах." },
          { nativeOnly: true, text: "Платежи обрабатывает внешний платёжный провайдер; данные вашей карты никогда не хранятся на наших серверах." },
          "Месячная и годовая подписки продлеваются автоматически в конце каждого периода, если вы не отменили их заранее.",
          "Premium — не подписка, а разовый платёж. Он не продлевается, не порождает последующих списаний и его нечего отменять; выданный им доступ сохраняется, пока Сервис продолжает работать.",
          { webOnly: true, text: "Кроме оплаты картой мы принимаем наличные — по ваучеру OXXO, и только для покупателей в Мексике: OXXO это сеть магазинов в Мексике, и оплатить её ваучер за пределами страны негде. Ваучер действует 3 дня; если срок истёк, с вас ничего не списано и можно выпустить новый. Доступ включается автоматически, как только магазин подтвердит оплату. Оплата наличными покрывает один период и никогда не приводит к автосписаниям: чтобы продолжить, платёж нужно повторить." },
          { webOnly: true, text: "Базовая цена всех тарифов установлена в мексиканских песо (MXN). Само списание при этом не всегда идёт в песо: платёжная страница может показать сумму, пересчитанную в валюту вашей страны, и списать именно её — там же можно выбрать оплату в песо, если вам так удобнее. Точную сумму и курс определяет эта страница в момент списания (или ваш банк, если конвертацию делает он); суммы в других валютах, которые мы показываем на сайте, — приблизительные и могут отличаться от итогового списания. У месячной и годовой подписки сумма следующих списаний может немного меняться вслед за курсом, даже если цена в песо осталась прежней." },
          "Отменить месячную или годовую подписку можно в любой момент в личном профиле. Отмена выключает продление, а не доступ: платные функции остаются у вас до конца уже оплаченного периода, а по его окончании новых списаний не будет. Если иное не требуется применимым законодательством, возврат средств за текущий период не производится — именно потому, что вы пользуетесь им до конца.",
          "Мы оставляем за собой право менять стоимость подписки. Любое изменение применяется начиная со следующего цикла продления, никогда задним числом.",
        ],
      },
      {
        heading: "4. Контент курса и интеллектуальная собственность",
        paragraphs: [
          "Весь учебный контент Сервиса (уроки, рассказы, упражнения, глоссарий, аудио-озвучка) принадлежит оператору или используется по лицензии и защищён законами об интеллектуальной собственности. Вы можете использовать его только для личного, некоммерческого обучения.",
          "Аудиозаписи произношения никуда не загружаются: они остаются в хранилище самого браузера на вашем устройстве (IndexedDB) и на наши серверы не попадают. Они ваши и только ваши, и никакой лицензии на них мы не просим — потому что никогда их не получаем.",
          "Медиатека включает видео, встроенные с YouTube через официальный плеер; мы не размещаем и не распространяем эти видео самостоятельно. Их использование также регулируется условиями использования YouTube/Google.",
        ],
      },
      {
        heading: "5. Правила использования",
        paragraphs: [
          "Запрещается: пытаться получить доступ к чужим аккаунтам, вмешиваться в работу Сервиса, массово извлекать или распространять контент курса, использовать Сервис в незаконных целях.",
          "Мы оставляем за собой право приостановить или удалить аккаунт при нарушении этих Условий.",
        ],
      },
      {
        heading: "6. Удаление аккаунта",
        paragraphs: [
          "Вы можете удалить свой аккаунт в любой момент в личном профиле. Процесс требует ввода пароля и подтверждения по ссылке, отправленной на вашу почту, безвозвратно удаляет ваш аккаунт и прогресс обучения и отменяет любую активную подписку. Это действие нельзя отменить. Аудиозаписи произношения в это удаление не входят — их никогда не было на наших серверах: они живут на вашем устройстве, и удаляете их вы сами, прямо в упражнении или очистив данные сайта в браузере.",
        ],
      },
      {
        heading: "7. Отказ от гарантий и ограничение ответственности",
        paragraphs: [
          "Сервис предоставляется «как есть». Мы не гарантируем его бесперебойную работу без ошибок. В пределах, допустимых применимым законодательством, мы не несём ответственности за косвенные убытки, связанные с использованием Сервиса.",
        ],
      },
      {
        heading: "8. Изменения Условий",
        paragraphs: [
          "Мы можем время от времени обновлять эти Условия. Новая версия будет опубликована на этой странице с указанием даты обновления. Продолжение использования Сервиса после изменений означает согласие с ними.",
        ],
      },
      {
        heading: "9. Применимое право",
        paragraphs: [
          "Эти Условия регулируются законодательством Мексики, без ущерба для прав, которые законодательство о защите прав потребителей вашей страны проживания может предоставлять вам в обязательном порядке.",
        ],
      },
      {
        heading: "10. Контакты",
        paragraphs: ["По любым вопросам об этих Условиях пишите нам на support@rusofacilapp.com."],
      },
    ],
  },
};

export const PRIVACY_CONTENT: Record<Locale, LegalDocument> = {
  es: {
    title: "Política de Privacidad",
    lastUpdated: PRIVACY_LAST_UPDATED,
    lastUpdatedLabel: "Última actualización:",
    intro:
      "Esta Política de Privacidad explica qué datos personales recopila RusoFácilapp.com, cómo los usamos y qué derechos tienes sobre ellos. La escribimos en un lenguaje directo, evitando jerga legal innecesaria.",
    sections: [
      {
        heading: "1. Responsable del tratamiento",
        paragraphs: [
          "El responsable de tus datos personales es Vasilii Petrov, operando como persona física (sin una entidad corporativa registrada), con domicilio en México. Para cualquier consulta sobre privacidad, escribe a support@rusofacilapp.com.",
        ],
      },
      {
        heading: "2. Qué datos recopilamos",
        paragraphs: [
          "Datos de cuenta: correo electrónico, nombre (opcional), un identificador de avatar (una cadena de texto como «matryoshka_calm» — nunca subes ni almacenamos ninguna foto tuya), y tu contraseña, que guardamos siempre cifrada (hash bcrypt), nunca en texto plano.",
          "Datos de progreso de aprendizaje: qué lecciones has completado, tu racha de estudio, tus resultados en exámenes, qué palabras y expresiones ya conoces, y tu progreso de lectura en las historias.",
          "Grabaciones de voz: NO las recogemos. Si usas los ejercicios de pronunciación, el audio se guarda en el almacenamiento del propio navegador de tu dispositivo (IndexedDB, hasta 30 grabaciones o 20 MB, lo que se alcance primero) para que puedas escucharlo y compararlo. No se sube a ningún servidor, no existe ninguna ruta de subida en el Servicio y nosotros no podemos oírlo.",
          "Datos de suscripción: tu estado de suscripción (activa, cancelada, plan) y un identificador de cliente de Stripe. No almacenamos los datos de tu tarjeta de pago — Stripe los procesa directamente.",
          "Cookies técnicas: una cookie de sesión (para mantenerte conectado) y una cookie de preferencia de tema (claro/oscuro/lectura). Ninguna de las dos se usa para publicidad ni seguimiento entre sitios.",
        ],
      },
      {
        heading: "3. Para qué usamos tus datos",
        paragraphs: [
          "Para prestarte el Servicio: autenticarte, guardar tu progreso, procesar tu suscripción y enviarte correos operativos (restablecimiento de contraseña, confirmación de eliminación de cuenta).",
          "No usamos tus datos personales para entrenar modelos de inteligencia artificial ni los vendemos a terceros con fines publicitarios.",
        ],
      },
      {
        heading: "4. Con quién compartimos datos",
        paragraphs: [
          "Usamos un número reducido de proveedores externos (encargados del tratamiento), cada uno con una función técnica concreta:",
          "• Stripe — procesamiento de pagos.",
          "• Resend — envío de correos operativos (recuperación de contraseña, confirmación de eliminación de cuenta).",
          "• Turso — alojamiento de la base de datos.",
          "• Vercel — alojamiento del sitio y las funciones del servidor; almacenamiento de los archivos de audio del curso (Vercel Blob); y dos productos de medición del propio Vercel, Web Analytics y Speed Insights, que registran visitas de página y tiempos de carga de forma agregada, sin cookies y sin identificarte.",
          "• Sentry — informes de errores. Cuando algo falla en el sitio o en la aplicación, Sentry recibe el error técnico, la dirección de la página y, si has iniciado sesión, tu identificador interno de usuario, para que podamos arreglarlo. No recibe tu contraseña ni tus grabaciones de voz.",
          "• RevenueCat — gestión de las suscripciones compradas dentro de las aplicaciones móviles (App Store y Google Play). Recibe el identificador de la compra y tu identificador interno de usuario. Las compras hechas en la web no pasan por él, sino por Stripe.",
          "• Upstash — límite de intentos de inicio de sesión y caché de contenido; puede ver tu correo o dirección IP de forma transitoria, sin construir un perfil sobre ti.",
          "• OpenAI — la narración de las lecciones fue generada de antemano con su servicio de síntesis de voz, a partir del texto del curso. Los archivos de audio resultantes están guardados en nuestro propio almacenamiento: al escuchar una lección no se envía nada a OpenAI, ni texto tuyo ni datos personales.",
          "• MyMemory — traducción de palabras sueltas. Cuando tocas una palabra de un cuento que no está en nuestro propio diccionario, esa palabra se envía a MyMemory, una memoria de traducción pública de otra empresa, para obtener su traducción. Se envía sólo la palabra y el par de idiomas, nada más. La petición la hace nuestro servidor, no tu teléfono: MyMemory no recibe tu dirección IP, ni tu cuenta, ni tu progreso, y no puede saber quién tocó la palabra.",
          "• ExchangeRate-API — tipos de cambio. Para poder mostrarte el precio aproximado en la moneda de tu país, nuestro servidor le pide su tabla de cambios unas pocas veces al día. En esa petición no va nada tuyo: ni tu cuenta, ni tu dirección, ni qué estabas mirando.",
          "• Anthropic — nos ayuda a redactar los subtítulos y los borradores de las lecciones en video. Lo usamos nosotros desde el panel de administración y le enviamos texto del curso. Nada tuyo pasa por ahí.",
          "• YouTube/Google — cuando reproduces un video incrustado en nuestra biblioteca, YouTube puede recopilar datos según su propia política de privacidad, independiente de la nuestra.",
          "No compartimos tus datos con ningún otro tercero salvo que la ley nos obligue a ello.",
        ],
      },
      {
        heading: "5. Seguridad",
        paragraphs: [
          "Tu contraseña se almacena siempre cifrada (bcrypt), nunca en texto plano. Los enlaces de recuperación de contraseña y de confirmación de eliminación de cuenta son de un solo uso, caducan automáticamente y se invalidan en cuanto cambias tu contraseña. Puedes cerrar sesión en todos tus dispositivos a la vez desde tu perfil, en cualquier momento.",
        ],
      },
      {
        heading: "6. Cuánto tiempo conservamos tus datos",
        paragraphs: [
          "Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, el proceso (que requiere tu contraseña y confirmación por correo) borra de inmediato y de forma permanente tu cuenta y tu progreso, no sólo el registro principal sino todas las filas asociadas. Tus grabaciones de pronunciación no aparecen en esa lista porque nunca salieron de tu dispositivo: se borran desde el propio ejercicio o vaciando los datos del sitio en tu navegador.",
        ],
      },
      {
        heading: "7. Tus derechos",
        slug: "tus-derechos",
        paragraphs: [
          "Tienes derecho a acceder, rectificar, eliminar y, en su caso, portar tus datos personales (derechos ARCO conforme a la ley mexicana). Puedes eliminar tu cuenta tú mismo en cualquier momento desde tu perfil. Para cualquier otra solicitud relacionada con tus datos, escríbenos a support@rusofacilapp.com y la atenderemos en un plazo razonable.",
        ],
      },
      {
        heading: "8. Menores de edad",
        paragraphs: [
          "El Servicio está dirigido a personas mayores de 18 años y no recopilamos intencionalmente datos de quien no llegue a esa edad. Si tienes motivos para creer que alguien menor de 18 años nos ha proporcionado datos personales, contáctanos y los eliminaremos.",
        ],
      },
      {
        heading: "9. Transferencias internacionales de datos",
        paragraphs: [
          "Algunos de nuestros proveedores (sección 4) procesan datos fuera de México. En esos casos, exigimos que ofrezcan garantías de seguridad adecuadas conforme a sus propias políticas de privacidad.",
        ],
      },
      {
        heading: "10. Cambios en esta Política",
        paragraphs: [
          "Podemos actualizar esta Política ocasionalmente. Publicaremos la nueva versión en esta página con la fecha de actualización correspondiente.",
        ],
      },
      {
        heading: "11. Contacto",
        paragraphs: ["Para cualquier duda o solicitud sobre tus datos personales, escríbenos a support@rusofacilapp.com."],
      },
    ],
  },
  ru: {
    title: "Политика конфиденциальности",
    lastUpdated: PRIVACY_LAST_UPDATED,
    lastUpdatedLabel: "Последнее изменение:",
    intro:
      "Эта Политика конфиденциальности объясняет, какие личные данные собирает RusoFácilapp.com, как мы их используем и какие права у вас есть в отношении них. Мы старались писать простым языком, без лишнего юридического жаргона.",
    sections: [
      {
        heading: "1. Кто отвечает за обработку данных",
        paragraphs: [
          "За ваши персональные данные отвечает Василий Петров, действующий как физическое лицо (без зарегистрированного юридического лица), с местом деятельности в Мексике. По любым вопросам о конфиденциальности пишите на support@rusofacilapp.com.",
        ],
      },
      {
        heading: "2. Какие данные мы собираем",
        paragraphs: [
          "Данные аккаунта: email, имя (по желанию), идентификатор аватара (строка вроде 'matryoshka_calm' — вы никогда не загружаете и мы никогда не храним ваши фотографии), и ваш пароль, который мы всегда храним в зашифрованном виде (bcrypt-хэш), никогда в открытом тексте.",
          "Данные о прогрессе обучения: какие уроки вы прошли, ваша учебная серия (стрик), результаты экзаменов, какие слова и выражения вы уже знаете, и ваш прогресс чтения историй.",
          "Аудиозаписи произношения: мы их НЕ собираем. Если вы делаете упражнения на произношение, запись сохраняется в хранилище самого браузера на вашем устройстве (IndexedDB, до 30 записей или 20 МБ — что наступит раньше), чтобы вы могли её прослушать и сравнить. На сервер она не уходит, маршрута загрузки в Сервисе не существует, и услышать её мы не можем.",
          "Данные подписки: статус вашей подписки (активна, отменена, тариф) и идентификатор клиента Stripe. Данные вашей банковской карты мы не храним — их обрабатывает напрямую Stripe.",
          "Технические cookie: cookie сессии (чтобы вы оставались авторизованы) и cookie предпочтения темы оформления (светлая/тёмная/для чтения). Ни один из них не используется для рекламы или межсайтового отслеживания.",
        ],
      },
      {
        heading: "3. Для чего мы используем ваши данные",
        paragraphs: [
          "Чтобы предоставлять вам Сервис: авторизовывать вас, сохранять прогресс, обрабатывать подписку и отправлять служебные письма (сброс пароля, подтверждение удаления аккаунта).",
          "Мы не используем ваши персональные данные для обучения моделей искусственного интеллекта и не продаём их третьим лицам в рекламных целях.",
        ],
      },
      {
        heading: "4. С кем мы делимся данными",
        paragraphs: [
          "Мы используем небольшое число внешних поставщиков услуг, каждый с конкретной технической функцией:",
          "• Stripe — обработка платежей.",
          "• Resend — отправка служебных писем (восстановление пароля, подтверждение удаления аккаунта).",
          "• Turso — хостинг базы данных.",
          "• Vercel — хостинг сайта и серверных функций; хранение аудиофайлов курса (Vercel Blob); и два его собственных измерителя, Web Analytics и Speed Insights, которые считают просмотры страниц и время загрузки в обобщённом виде, без cookie и без вашего опознания.",
          "• Sentry — отчёты об ошибках. Когда на сайте или в приложении что-то ломается, Sentry получает техническое описание ошибки, адрес страницы и, если вы вошли в аккаунт, ваш внутренний идентификатор пользователя, чтобы мы могли это починить. Ни пароля, ни аудиозаписей произношения он не получает.",
          "• RevenueCat — управление подписками, купленными внутри мобильных приложений (App Store и Google Play). Получает идентификатор покупки и ваш внутренний идентификатор пользователя. Покупки на сайте через него не проходят — они идут через Stripe.",
          "• Upstash — ограничение попыток входа и кэширование контента; может видеть ваш email или IP-адрес кратковременно, без построения профиля о вас.",
          "• OpenAI — озвучка уроков была создана заранее его синтезатором речи на основе текста курса. Готовые аудиофайлы хранятся в нашем собственном хранилище: при прослушивании урока в OpenAI не уходит ничего — ни ваш текст, ни персональные данные.",
          "• MyMemory — перевод отдельных слов. Когда вы нажимаете в рассказе на слово, которого нет в нашем собственном словаре, это слово уходит в MyMemory — публичную память переводов другой компании — за переводом. Уходит только само слово и языковая пара, больше ничего. Запрос делает наш сервер, а не ваш телефон: MyMemory не получает ни вашего IP-адреса, ни аккаунта, ни прогресса и не может узнать, кто нажал на слово.",
          "• ExchangeRate-API — курсы валют. Чтобы показать вам примерную цену в валюте вашей страны, наш сервер несколько раз в сутки запрашивает у него таблицу курсов. В этом запросе нет ничего вашего: ни аккаунта, ни адреса, ни того, что вы смотрели.",
          "• Anthropic — помогает нам составлять субтитры и черновики видео-уроков. Им пользуемся мы сами из административной панели и отправляем туда текст курса. Ничего вашего через него не проходит.",
          "• YouTube/Google — при просмотре встроенного видео из нашей медиатеки YouTube может собирать данные согласно своей собственной политике конфиденциальности, независимой от нашей.",
          "Мы не передаём ваши данные никаким другим третьим лицам, кроме случаев, когда этого требует закон.",
        ],
      },
      {
        heading: "5. Безопасность",
        paragraphs: [
          "Ваш пароль всегда хранится в зашифрованном виде (bcrypt), никогда в открытом тексте. Ссылки для восстановления пароля и подтверждения удаления аккаунта одноразовые, автоматически истекают и аннулируются при смене пароля. Вы можете в любой момент выйти со всех устройств сразу — прямо в личном профиле.",
        ],
      },
      {
        heading: "6. Сколько мы храним ваши данные",
        paragraphs: [
          "Мы храним ваши данные, пока ваш аккаунт активен. Если вы удаляете аккаунт (процесс требует пароль и подтверждение по почте), мы сразу и безвозвратно удаляем ваш аккаунт и прогресс — не только основную запись, но и все связанные строки. Аудиозаписей произношения в этом списке нет: они никогда не покидали ваше устройство, и удаляются они вами — прямо в упражнении или очисткой данных сайта в браузере.",
        ],
      },
      {
        heading: "7. Ваши права",
        // Тот же слаг, что у испанской локали, и это не копипаста, а
        // правило — см. комментарий к `slug` в LegalSection.
        slug: "tus-derechos",
        paragraphs: [
          "У вас есть право на доступ, исправление, удаление и, в применимых случаях, перенос своих персональных данных. Удалить аккаунт вы можете самостоятельно в любой момент в личном профиле. По любым другим запросам, связанным с вашими данными, пишите на support@rusofacilapp.com — мы ответим в разумный срок.",
        ],
      },
      {
        heading: "8. Несовершеннолетние",
        paragraphs: [
          "Сервис предназначен для лиц от 18 лет, и мы намеренно не собираем данные тех, кто младше. Если у вас есть основания полагать, что свои данные нам предоставил человек младше 18 лет, свяжитесь с нами — мы их удалим.",
        ],
      },
      {
        heading: "9. Международная передача данных",
        paragraphs: [
          "Некоторые из наших поставщиков услуг (раздел 4) обрабатывают данные за пределами Мексики. В этих случаях мы требуем от них надлежащих гарантий безопасности согласно их собственным политикам конфиденциальности.",
        ],
      },
      {
        heading: "10. Изменения этой Политики",
        paragraphs: [
          "Мы можем время от времени обновлять эту Политику. Новая версия будет опубликована на этой странице с указанием даты обновления.",
        ],
      },
      {
        heading: "11. Контакты",
        paragraphs: ["По любым вопросам или запросам о ваших персональных данных пишите нам на support@rusofacilapp.com."],
      },
    ],
  },
};

/**
 * Абзацы раздела, которые видит ЭТОТ читатель.
 *
 * Правило одно и живёт здесь: внутри оболочки помеченные абзацы не
 * печатаются, в вебе печатаются все. Обе стороны держит
 * `src/lib/legal/native-terms.test.ts` и — на живой отдаче — сторож
 * `npm run check:native-payments`, у которого после этой правки больше
 * нет исключения для двух правовых адресов.
 */
export function visibleLegalParagraphs(
  section: LegalSection,
  { nativeShell }: { nativeShell: boolean },
): string[] {
  const out: string[] = [];
  for (const paragraph of section.paragraphs) {
    if (typeof paragraph === "string") {
      out.push(paragraph);
      continue;
    }
    // Две пометки, и они ровно противоположны. `webOnly` — «этого в
    // приложении не печатать», `nativeOnly` — «это печатать ТОЛЬКО в
    // приложении». Ветка написана через явный признак каждой формы, а не
    // через `else`: третья пометка, добавленная когда-нибудь позже,
    // должна ронять типы здесь, а не молча попадать в одну из двух
    // половин.
    if ("webOnly" in paragraph) {
      if (!nativeShell) out.push(paragraph.text);
      continue;
    }
    if (nativeShell) out.push(paragraph.text);
  }
  return out;
}
