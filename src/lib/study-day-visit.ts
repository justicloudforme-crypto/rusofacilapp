import "server-only";
import { after } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session-token";
import { getRequestTimeZone } from "./timezone-server";
import { markStudyDay, type StudyDaySource } from "./study-day";
import { awardBadgesSafely } from "./badges";

// Одна строка, которую добавляет маршрут, чтобы его действие
// засчиталось днём занятия.
//
// Держится отдельно от study-day.ts, чтобы модуль данных не тянул за
// собой запросные API Next: streaks.ts импортирует именно его, и ничему,
// что считает серию, не нужны `after`/`cookies`.

/** Отмечает сегодняшний день занятым для того, кто вошёл; для гостя не
 * делает ничего.
 *
 * ГДЕ ЭТО ЗОВУТ — редакция 17.09.2026 (заход 7.204). Раньше — из тела
 * серверного компонента страницы, потому что правилом было «занятие =
 * открытие». Правило заменено решением владельца: день ставит ДЕЙСТВИЕ.
 * Поэтому теперь все вызовы стоят в ПИШУЩИХ маршрутах, на запросах,
 * которые продукт посылает по своим делам и без отметки дня:
 *
 *   POST /api/flashcard-progress   ответ в карточке, отметка «выучено»
 *   POST /api/progress             сданные упражнения урока
 *   POST /api/exams/…/attempt      сданный экзамен
 *   POST /api/word-games/check     буква в игре
 *   POST /api/reading-progress     рассказ прочитан хотя бы до половины
 *   POST /api/study-day            сданное упражнение под роликом
 *
 * Полный список правила — в шапке src/lib/study-day.ts, и он там один.
 * Ни одна страница (`src/app/**\/page.tsx`) звать это больше не имеет
 * права, и за этим следит `npm run check:study-day-action`.
 *
 * **Опознание ученика не стоит ни одного чтения базы.** Кука сессии
 * подписана HMAC, поэтому `verifySessionToken` уже устанавливает, что
 * идентификатор настоящий, — а больше отметке дня ничего и не нужно. Не
 * проверяется только `sessionVersion`, то есть браузер с отозванной
 * сессией мог бы поставить день сам себе; цена этому — одна строка на
 * его собственном аккаунте, и создать её для удалённого аккаунта всё
 * равно невозможно (внешний ключ).
 *
 * Маршрут, у которого строка `User` уже в руках, обязан её передать:
 * зона, записанная на аккаунте, надёжнее куки, а передача бесплатна.
 * После правки 7.204 так делают ВСЕ вызовы — у каждого пишущего маршрута
 * пользователь уже прочитан для проверки доступа.
 *
 * Сама запись отложена `after()`, поэтому ответ уже уходит к ученику,
 * когда база только трогается, и отметка не может замедлить ни страницу,
 * ни ответ маршрута. Оба чтения куки происходят ДО этого — внутри
 * `after()` трогать `cookies()` и `headers()` нельзя.
 */
export async function markStudyDayVisit(
  source: StudyDaySource,
  user?: { id: string; timezone: string | null } | null,
): Promise<void> {
  const userId = user === undefined ? await signedInUserId() : user?.id ?? null;
  if (!userId) return;
  const timeZone = await getRequestTimeZone(user?.timezone ?? null);
  after(async () => {
    // ВЫДАЧА ЗНАЧКОВ СТОИТ ТАМ, ГДЕ МЕНЯЕТСЯ УСЛОВИЕ (долг 220,
    // заход 7.200). Серию считают ДНИ ЗАНЯТИЙ, а день ставит вот эта
    // самая функция — значит и правило выдачи живёт здесь, а не только
    // в трёх маршрутах, как было до 7.200.
    //
    // После 7.204 все вызовы этой функции и так стоят в пишущих
    // маршрутах, но строка не лишняя: `/api/reading-progress` и
    // `/api/word-games/check` значков сами не выдают, и без неё читатель
    // рассказов снова остался бы с серией и без значков.
    //
    // Считается только на НОВОМ дне: `markStudyDay` возвращает `true`
    // ровно тогда, когда строка дня появилась, то есть не чаще раза в
    // сутки на человека. Каждый просмотр страницы это не удорожает.
    const dayIsNew = await markStudyDay(userId, timeZone, source);
    if (dayIsNew) await awardBadgesSafely(userId);
  });
}

async function signedInUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token)?.userId ?? null;
}
