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
 *  - Data actually collected: email, optional display name, avatarId
 *    (a string like "matryoshka_calm", never a photo/file — see
 *    src/lib/avatars.ts), bcrypt password hash, session cookie,
 *    theme-preference cookie, Stripe subscription status (card details
 *    never touch our servers — Stripe Checkout handles those directly),
 *    voice-pronunciation recordings (VoiceSubmission), and learning
 *    progress (lessons, flashcards, stories, exam attempts).
 *  - Subprocessors: Stripe (payments), Resend (transactional email),
 *    Turso/libSQL (database), Vercel (hosting), Upstash (Redis — rate
 *    limiting and caching; sees email/IP as cache keys transiently, no
 *    persistent profile), OpenAI (text-to-speech for course narration —
 *    processes course text, not user personal data), YouTube (embedded
 *    videos in the media library, governed by Google's own policies for
 *    any interaction with an embed).
 *  - Account deletion is genuinely self-service and already built:
 *    password + emailed confirmation link, cascades every DB row and
 *    deletes on-disk voice recordings (see
 *    src/app/api/auth/confirm-account-deletion/route.ts) — the Privacy
 *    Policy can honestly describe this as already working, not aspirational.
 *  - Subscription cancellation is immediate (not "at period end") and
 *    there's no self-service proration/refund logic in the code — the
 *    Terms describe that honestly rather than promising a refund flow
 *    that doesn't exist.
 *  - No age-gate exists at registration. The "menores de edad" / "minors"
 *    section is a policy statement (not directed at children under 13),
 *    not a claim that technical enforcement exists.
 */
import type { Locale } from "@/i18n/config";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

const LAST_UPDATED = "2026-08-18";

export const TERMS_CONTENT: Record<Locale, LegalDocument> = {
  es: {
    title: "Términos de Servicio",
    lastUpdated: LAST_UPDATED,
    intro:
      "Estos Términos de Servicio ('Términos') regulan el uso de RusoFácilapp.com y de la aplicación asociada (el 'Servicio'), operado por Vasilii Petrov ('nosotros', 'el operador'). Al crear una cuenta o usar el Servicio, aceptas estos Términos. Si no estás de acuerdo, no uses el Servicio.",
    sections: [
      {
        heading: "1. Descripción del Servicio",
        paragraphs: [
          "RusoFácilapp es una plataforma de aprendizaje del idioma ruso dirigida a hablantes de español, con lecciones estructuradas (niveles A1 a B2), historias de lectura, vocabulario, idioms, ejercicios de pronunciación y una biblioteca de video y audio.",
          "El Servicio se ofrece a través del sitio web y, en el futuro, de aplicaciones móviles nativas. Algunas funciones (lecciones, exámenes, historias completas) requieren una suscripción de pago; otras son de acceso gratuito.",
        ],
      },
      {
        heading: "2. Cuentas de usuario",
        paragraphs: [
          "Para acceder a la mayoría de las funciones necesitas crear una cuenta con un correo electrónico y una contraseña. Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad que ocurra en tu cuenta.",
          "Debes proporcionar información veraz al registrarte. Si detectas un uso no autorizado de tu cuenta, cámbiala contraseña de inmediato desde tu perfil o usa la opción de recuperación de contraseña.",
          "El Servicio no está dirigido a niños menores de 13 años. Si tienes entre 13 y la mayoría de edad en tu país, necesitas el consentimiento de un padre, madre o tutor para usar el Servicio.",
        ],
      },
      {
        heading: "3. Suscripciones y pagos",
        paragraphs: [
          "Ofrecemos planes de suscripción mensual y anual. Los pagos se procesan a través de Stripe; nunca almacenamos los datos de tu tarjeta en nuestros servidores.",
          "Las suscripciones se renuevan automáticamente al final de cada periodo, salvo que las canceles antes de la fecha de renovación.",
          "Puedes cancelar tu suscripción en cualquier momento desde tu perfil. La cancelación surte efecto de inmediato: perderás el acceso a las funciones de pago en el momento de cancelar, no al final del periodo ya pagado. Salvo que la ley aplicable exija lo contrario, no ofrecemos reembolsos por el tiempo restante de un periodo ya iniciado.",
          "Nos reservamos el derecho de modificar los precios de las suscripciones. Cualquier cambio se aplicará a partir del siguiente ciclo de renovación, nunca de forma retroactiva.",
        ],
      },
      {
        heading: "4. Contenido del curso y propiedad intelectual",
        paragraphs: [
          "Todo el contenido educativo del Servicio (lecciones, historias, ejercicios, glosario, narraciones de audio) es propiedad del operador o se usa bajo licencia, y está protegido por leyes de propiedad intelectual. Puedes usarlo únicamente para tu aprendizaje personal, no comercial.",
          "Las grabaciones de voz que subas como práctica de pronunciación siguen siendo tuyas; nos concedes una licencia limitada para almacenarlas y reproducírtelas a ti como parte del Servicio. No las usamos con ningún otro fin.",
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
          "Puedes eliminar tu cuenta en cualquier momento desde tu perfil. El proceso requiere tu contraseña y la confirmación de un enlace enviado a tu correo, y elimina de forma permanente tu cuenta, tu progreso, tus grabaciones de voz y cancela cualquier suscripción activa. Esta acción no se puede deshacer.",
        ],
      },
      {
        heading: "7. Exclusión de garantías y limitación de responsabilidad",
        paragraphs: [
          "El Servicio se ofrece 'tal cual'. No garantizamos que esté libre de errores o interrupciones. En la medida permitida por la ley aplicable, no seremos responsables de daños indirectos derivados del uso del Servicio.",
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
    lastUpdated: LAST_UPDATED,
    intro:
      "Эти Условия использования («Условия») регулируют использование сайта RusoFácilapp.com и связанного с ним приложения («Сервис»), которым управляет Василий Петров («мы», «оператор»). Создавая аккаунт или используя Сервис, вы соглашаетесь с этими Условиями. Если вы не согласны — пожалуйста, не используйте Сервис.",
    sections: [
      {
        heading: "1. Описание Сервиса",
        paragraphs: [
          "RusoFácilapp — платформа для изучения русского языка испаноговорящими пользователями: структурированные уроки (уровни A1–B2), рассказы для чтения, словарь, идиомы, упражнения на произношение и библиотека аудио- и видеоматериалов.",
          "Сервис доступен через сайт и, в будущем, через нативные мобильные приложения. Часть функций (уроки, экзамены, полные рассказы) доступна по платной подписке, часть — бесплатно.",
        ],
      },
      {
        heading: "2. Аккаунты пользователей",
        paragraphs: [
          "Для доступа к большинству функций нужно зарегистрировать аккаунт с email и паролем. Вы несёте ответственность за конфиденциальность своего пароля и за любые действия в своём аккаунте.",
          "При регистрации нужно указывать достоверные данные. Если вы заметили несанкционированный доступ к своему аккаунту — немедленно смените пароль в профиле или воспользуйтесь функцией восстановления пароля.",
          "Сервис не предназначен для детей младше 13 лет. Если вам от 13 лет до совершеннолетия по законам вашей страны, для использования Сервиса вам нужно согласие родителя или законного представителя.",
        ],
      },
      {
        heading: "3. Подписки и оплата",
        paragraphs: [
          "Мы предлагаем месячную и годовую подписку. Платежи обрабатываются через Stripe; данные вашей карты никогда не хранятся на наших серверах.",
          "Подписка продлевается автоматически в конце каждого периода, если вы не отменили её заранее.",
          "Отменить подписку можно в любой момент в личном профиле. Отмена вступает в силу немедленно: доступ к платным функциям прекращается в момент отмены, а не в конце уже оплаченного периода. Если иное не требуется применимым законодательством, возврат средств за оставшуюся часть уже начавшегося периода не производится.",
          "Мы оставляем за собой право менять стоимость подписки. Любое изменение применяется начиная со следующего цикла продления, никогда задним числом.",
        ],
      },
      {
        heading: "4. Контент курса и интеллектуальная собственность",
        paragraphs: [
          "Весь учебный контент Сервиса (уроки, рассказы, упражнения, глоссарий, аудио-озвучка) принадлежит оператору или используется по лицензии и защищён законами об интеллектуальной собственности. Вы можете использовать его только для личного, некоммерческого обучения.",
          "Аудиозаписи вашего произношения, которые вы загружаете для практики, остаются вашими; вы предоставляете нам ограниченную лицензию на их хранение и воспроизведение вам же в рамках Сервиса. Мы не используем их ни для каких других целей.",
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
          "Вы можете удалить свой аккаунт в любой момент в личном профиле. Процесс требует ввода пароля и подтверждения по ссылке, отправленной на вашу почту, и безвозвратно удаляет ваш аккаунт, прогресс обучения, аудиозаписи произношения и отменяет любую активную подписку. Это действие нельзя отменить.",
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
    lastUpdated: LAST_UPDATED,
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
          "Datos de cuenta: correo electrónico, nombre (opcional), un identificador de avatar (una cadena de texto como 'matryoshka_calm' — nunca subes ni almacenamos ninguna foto tuya), y tu contraseña, que guardamos siempre cifrada (hash bcrypt), nunca en texto plano.",
          "Datos de progreso de aprendizaje: qué lecciones has completado, tu racha de estudio, tus resultados en exámenes, qué palabras y expresiones ya conoces, y tu progreso de lectura en las historias.",
          "Grabaciones de voz: si usas los ejercicios de pronunciación, almacenamos el archivo de audio que grabas para que puedas escucharlo y compararlo.",
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
          "• Vercel — alojamiento del sitio y las funciones del servidor.",
          "• Upstash — límite de intentos de inicio de sesión y caché de contenido; puede ver tu correo o dirección IP de forma transitoria, sin construir un perfil sobre ti.",
          "• OpenAI — genera el audio de narración del contenido del curso a partir del texto de las lecciones; no procesa datos personales tuyos.",
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
          "Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, el proceso (que requiere tu contraseña y confirmación por correo) borra de inmediato y de forma permanente tu cuenta, tu progreso y tus grabaciones de voz — incluidos los archivos de audio guardados en el servidor, no solo el registro en la base de datos.",
        ],
      },
      {
        heading: "7. Tus derechos",
        paragraphs: [
          "Tienes derecho a acceder, rectificar, eliminar y, en su caso, portar tus datos personales (derechos ARCO conforme a la ley mexicana). Puedes eliminar tu cuenta tú mismo en cualquier momento desde tu perfil. Para cualquier otra solicitud relacionada con tus datos, escríbenos a support@rusofacilapp.com y la atenderemos en un plazo razonable.",
        ],
      },
      {
        heading: "8. Menores de edad",
        paragraphs: [
          "El Servicio no está dirigido a niños menores de 13 años y no recopilamos intencionalmente datos de menores de esa edad. Si tienes motivos para creer que un menor de 13 años nos ha proporcionado datos personales, contáctanos y los eliminaremos.",
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
    lastUpdated: LAST_UPDATED,
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
          "Аудиозаписи произношения: если вы используете упражнения на произношение, мы сохраняем файл записи, чтобы вы могли его прослушать и сравнить.",
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
          "• Vercel — хостинг сайта и серверных функций.",
          "• Upstash — ограничение попыток входа и кэширование контента; может видеть ваш email или IP-адрес кратковременно, без построения профиля о вас.",
          "• OpenAI — генерирует аудио-озвучку учебного контента на основе текста уроков; не обрабатывает ваши персональные данные.",
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
          "Мы храним ваши данные, пока ваш аккаунт активен. Если вы удаляете аккаунт (процесс требует пароль и подтверждение по почте), мы сразу и безвозвратно удаляем ваш аккаунт, прогресс и аудиозаписи произношения — включая сами аудиофайлы на сервере, а не только запись в базе данных.",
        ],
      },
      {
        heading: "7. Ваши права",
        paragraphs: [
          "У вас есть право на доступ, исправление, удаление и, в применимых случаях, перенос своих персональных данных. Удалить аккаунт вы можете самостоятельно в любой момент в личном профиле. По любым другим запросам, связанным с вашими данными, пишите на support@rusofacilapp.com — мы ответим в разумный срок.",
        ],
      },
      {
        heading: "8. Несовершеннолетние",
        paragraphs: [
          "Сервис не предназначен для детей младше 13 лет, и мы намеренно не собираем данные таких пользователей. Если у вас есть основания полагать, что ребёнок младше 13 лет предоставил нам свои данные, свяжитесь с нами — мы их удалим.",
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
