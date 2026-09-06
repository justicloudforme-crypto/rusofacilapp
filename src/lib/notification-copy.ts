import type { Locale } from "@/i18n/config";

// The text of the daily reminder, chosen from a rotation instead of being
// one fixed sentence.
//
// Why. Until 05.09.2026 there was exactly ONE reminder, hardcoded in
// Spanish inside src/lib/notifications.ts, and a learner in the Russian
// interface got it in Spanish too. One sentence repeated every evening
// stops being read after the first week; and a single reason to come back
// ("your streak") is the wrong reason on the day someone has no streak
// yet.
//
// The rules this list follows:
//
//  * At least eight per locale, and the REASONS differ — streak, new
//    words, an unfinished lesson, a game, a story, listening, review, the
//    alphabet. A list of eight ways to say "keep your streak" would be the
//    same notification eight times.
//  * Nothing is promised that the site does not do. No "new lesson
//    waiting", no "someone is waiting for you", no number of anything: the
//    reminder is scheduled by the phone itself and knows nothing about the
//    account's actual state (see notifications.ts — it is a
//    LocalNotifications schedule, not a server push), so any claim about
//    what is waiting would be a guess printed as a fact.
//  * The Spanish is neutral across Latin America, not Mexican: this is the
//    same rule the site's Spanish copy already follows (see
//    WhyLearnRussianBlurb.tsx's own comment). No "ahorita", no "platicar",
//    no "ordenador"/"vosotros" from the other side either.

export type NotificationCopy = { title: string; body: string };

export const NOTIFICATION_COPY: Record<Locale, readonly NotificationCopy[]> = {
  es: [
    {
      title: "Tu racha sigue viva 🔥",
      body: "Unos minutos de práctica hoy y no se corta. Entra cuando puedas.",
    },
    {
      title: "Palabras nuevas para hoy 📖",
      body: "Abre el vocabulario y suma unas cuantas palabras rusas a las que ya conoces.",
    },
    {
      title: "¿Quedó una lección a medias? ✍️",
      body: "Retomar donde la dejaste cuesta bastante menos que volver a empezar.",
    },
    {
      title: "Un rato de juego en cirílico 🧩",
      body: "Sopa de letras o crucigrama: leer ruso también se entrena jugando.",
    },
    {
      title: "Un cuento corto en ruso 📚",
      body: "Texto en ruso y español lado a lado, narrado en voz alta. Con diez minutos alcanza.",
    },
    {
      title: "Repasar es la mitad del trabajo 🔁",
      body: "Vuelve sobre las palabras que ya viste: la repetición es lo que las fija.",
    },
    {
      title: "Ponle oído al ruso 🎧",
      body: "Si hoy no te da para leer, escucha algo de la biblioteca de audio y video.",
    },
    {
      title: "Las 33 letras, otra vez 🔤",
      body: "Reconocer el alfabeto se entrena en minutos, y es lo que sostiene todo lo demás.",
    },
    {
      title: "Quince minutos, no tres horas ⏱️",
      body: "Un rato corto todos los días le gana a una maratón el domingo. Hoy toca el rato corto.",
    },
    {
      title: "Hoy, una frase entera 💬",
      body: "Lee una frase en ruso en voz alta. Escucharte a ti mismo cambia cómo suena después.",
    },
  ],
  ru: [
    {
      title: "Серия ещё жива 🔥",
      body: "Несколько минут занятий сегодня — и она не прервётся. Загляните, когда будет время.",
    },
    {
      title: "Новые слова на сегодня 📖",
      body: "Откройте словарь и добавьте несколько слов к тем, что уже знаете.",
    },
    {
      title: "Урок остался недоделанным? ✍️",
      body: "Вернуться туда, где остановились, куда легче, чем начинать заново.",
    },
    {
      title: "Немного игры с кириллицей 🧩",
      body: "Филворд или кроссворд: читать по-русски тренируется и в игре.",
    },
    {
      title: "Короткий рассказ 📚",
      body: "Русский и испанский рядом, с озвучкой. Десяти минут хватит.",
    },
    {
      title: "Повторение — половина дела 🔁",
      body: "Вернитесь к словам, которые уже видели: закрепляет именно повтор.",
    },
    {
      title: "Послушайте русский 🎧",
      body: "Если сегодня не до чтения — послушайте что-нибудь из аудио- и видеотеки.",
    },
    {
      title: "Снова 33 буквы 🔤",
      body: "Узнавание алфавита тренируется за минуты, а держится на нём всё остальное.",
    },
    {
      title: "Пятнадцать минут, а не три часа ⏱️",
      body: "Короткое занятие каждый день сильнее марафона по воскресеньям. Сегодня — короткое.",
    },
    {
      title: "Сегодня — целая фраза 💬",
      body: "Прочитайте фразу по-русски вслух. Услышать себя — это меняет то, как звучит дальше.",
    },
  ],
};

/** FNV-1a over the seed. Not a security hash — it only has to spread
 * different learners across the list and give the same learner the same
 * answer every time, which is the entire requirement. Same reasoning and
 * same constants as src/lib/sw-cache-names.ts's buildFingerprint. */
function seedHash(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Days since 1970-01-01 for a `YYYY-MM-DD` key. Pure arithmetic on the
 * three numbers in the key — no zone is applied here, because the key was
 * already produced in the learner's zone (dateKeyIn, src/lib/timezone.ts),
 * and re-parsing it as an instant would move it by up to a day. */
export function dayIndexOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * The reminder for one learner on one day.
 *
 * Deterministic, not random: the same (learner, day) always gives the same
 * text, so a re-schedule on a second app launch the same evening does not
 * swap the text under a notification already sitting in the tray.
 *
 * Two days in a row are always different, and that is arithmetic rather
 * than luck: the day index enters the sum with a coefficient of one, so
 * consecutive days land on consecutive positions, and consecutive
 * positions modulo a list longer than one cannot coincide.
 *
 * `userId` may be null — an anonymous device has no account yet. It then
 * seeds on the empty string: everyone anonymous shares one position on a
 * given day, which is fine because the property that matters (yesterday ≠
 * today) is carried by the day index, not by the learner.
 */
export function pickNotificationCopy(
  locale: Locale,
  userId: string | null,
  dateKey: string,
): NotificationCopy {
  const list = NOTIFICATION_COPY[locale];
  const index = (seedHash(userId ?? "") + dayIndexOf(dateKey)) % list.length;
  return list[index];
}
