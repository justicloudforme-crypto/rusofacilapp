import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRateLimiter } from "@/lib/rate-limit";
import { markStudyDayVisit } from "@/lib/study-day-visit";

/**
 * ДЕЙСТВИЕ, У КОТОРОГО НЕТ СВОЕГО ЗАПРОСА (заход 7.204).
 *
 * Правило дня занятий — «день ставит действие, а не открытие» — почти
 * везде обошлось без нового маршрута: ответ в карточке, сданный урок,
 * сданный экзамен, буква в игре и прочитанная половина рассказа уже
 * приезжают на сервер сами, каждое по своему делу, и отметка дня просто
 * встала рядом.
 *
 * ОДНО действие из списка владельца своего запроса не имеет вовсе —
 * упражнения под песней и видеоуроком (`MediaExercises`): они считаются
 * целиком в браузере и на сервер не ходят, а хранилища прогресса медиа в
 * базе нет (модели вроде StoryReadingProgress у медиа не существует, и
 * заводить её значило бы миграцию). Поэтому здесь один узкий маршрут
 * ровно под это действие.
 *
 * НАБОР ИСТОЧНИКОВ ЗАКРЫТ ОДНИМ ЗНАЧЕНИЕМ. Маршрут, принимающий любой
 * `source`, был бы кнопкой «поставь мне день» на все поверхности сразу —
 * в том числе на те, которые владелец из зачёта как раз убрал. Всё
 * остальное ставит день на своём собственном запросе, и расширять этот
 * список надо здесь, глазами.
 */
const STUDY_DAY_SOURCES = ["media"] as const;
type ClientStudyDaySource = (typeof STUDY_DAY_SOURCES)[number];

function isClientSource(value: unknown): value is ClientStudyDaySource {
  return typeof value === "string" && (STUDY_DAY_SOURCES as readonly string[]).includes(value);
}

// День ставится не чаще раза в сутки, поэтому потолок здесь только против
// заклинившего клиента, а не против нормального пользования.
const studyDayLimiter = getRateLimiter("studyDay", 60_000, 20);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  // Гость — не ошибка: упражнения под роликом видит и он (у бесплатной
  // пробы есть открытые песни), просто отмечать нечего.
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  if (await studyDayLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!isClientSource(body?.source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  await markStudyDayVisit(body.source, user);
  return NextResponse.json({ ok: true });
}
