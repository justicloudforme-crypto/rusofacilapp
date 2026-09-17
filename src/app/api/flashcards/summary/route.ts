import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isFlashcardLevel } from "@/lib/flashcards";
import { getFlashcardIndex } from "@/lib/flashcards/cache";
import { canAccessLevel, getEntitlementTier } from "@/lib/entitlement";
import { openCardIds, siteCensus } from "@/lib/flashcards/locked-census";

// Powers the category grid + "Continue" strip on /vocabulary: total card
// count per category (public) plus, per visitor, how many of those cards
// they already know and which categories they were most recently active
// in — so each tile can show its own progress without the client fetching
// every category's full card list up front.
//
// POST, not GET: a guest's "known" progress lives only in localStorage
// (src/lib/flashcard-progress.ts) — the server has no way to see it for an
// unauthenticated visitor, which used to mean every progress bar sat at 0%
// forever for anyone not logged in. The client now sends its local
// {cardId: {known, updatedAt}} map (getProgressEntries()) as the request
// body; the server treats it as untrusted input (see validation below) and
// only ever uses it to FILL IN cards it has no server record for — a
// logged-in user's real `flashcardProgress` rows always win over whatever
// the client claims for the same card, so a forged/stale payload can never
// hide or "zero out" real progress. This endpoint never writes to the
// database either way (read-only), so the actual stored progress can't be
// corrupted by it regardless.

const MAX_ENTRY_ID_LENGTH = 64;
// A generous but real ceiling: nobody can legitimately have more "known"
// entries than there are cards in the whole bank (~5.7k today, ~350KB of
// JSON in the worst case with the current short slug-style ids) — anything
// past that is either a stale client re-sending duplicate keys or a
// forged payload, both safe to reject outright rather than trim silently.
// Re-checked against the real per-entry byte cost before picking this
// design over a "send an aggregate instead" fallback — the real worst case
// fits comfortably under ordinary request-body limits.
const MAX_BODY_CHARS = 1_000_000;

interface CategoryStat {
  total: number;
  known: number;
}

interface ProgressEntry {
  known: boolean;
  updatedAt: number;
}

// `maxEntries` is the size of the WHOLE bank, not of `validCardIds`.
// The two stopped being the same number when this endpoint began answering
// per tier: `validCardIds` is what this visitor can open (no C1 unless
// Premium), while a real device can legitimately hold "known" entries for
// cards it can no longer open — a lapsed Premium period leaves exactly
// that behind. Sizing the ceiling by the accessible set would 400 those
// visitors outright and blank every progress bar on the page.
function parseEntries(
  raw: unknown,
  validCardIds: Set<string>,
  maxEntries: number,
): Map<string, ProgressEntry> {
  const out = new Map<string, ProgressEntry>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;

  const keys = Object.keys(raw as Record<string, unknown>);
  if (keys.length > maxEntries) return out; // caller rejects the whole request in this case

  for (const cardId of keys) {
    if (cardId.length > MAX_ENTRY_ID_LENGTH || !validCardIds.has(cardId)) continue;
    const value = (raw as Record<string, unknown>)[cardId];
    if (
      value &&
      typeof value === "object" &&
      typeof (value as ProgressEntry).known === "boolean" &&
      typeof (value as ProgressEntry).updatedAt === "number" &&
      Number.isFinite((value as ProgressEntry).updatedAt) &&
      (value as ProgressEntry).updatedAt >= 0
    ) {
      const entry = value as ProgressEntry;
      out.set(cardId, { known: entry.known, updatedAt: entry.updatedAt });
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const levelValue = (body as { level?: unknown } | null)?.level;
  const level = typeof levelValue === "string" && isFlashcardLevel(levelValue) ? levelValue : null;

  // Everything below counts ONE set: the cards this visitor's tier can
  // actually reach. `GET /api/flashcards` has always filtered its answer
  // through canAccessLevel, so a non-premium learner is handed a bank
  // without C1 — but this endpoint used to answer with the whole bank's
  // size, and the result panel printed it ("6 из 5683") as if all 5683
  // were reachable. 896 of them were not, at any price short of Premium.
  //
  // The fix is not a smaller number, it is a HONEST pair: how many are
  // available now, and how many are behind Premium. The second number is
  // what makes the first one truthful instead of merely smaller — a
  // learner who sees "4787 available" and nothing else has been told the
  // bank is 4787 cards, which is its own lie.
  const wholeIndex = await getFlashcardIndex();
  const tier = await getEntitlementTier();
  const index = wholeIndex.filter((c) => canAccessLevel(tier, c.level));
  const cardById = new Map(index.map((c) => [c.id, c]));
  const validCardIds = new Set(cardById.keys());

  const entriesRaw = (body as { entries?: unknown } | null)?.entries;
  if (entriesRaw && typeof entriesRaw === "object" && !Array.isArray(entriesRaw)) {
    if (Object.keys(entriesRaw as object).length > wholeIndex.length) {
      return NextResponse.json({ error: "too_many_entries" }, { status: 400 });
    }
  }
  const clientEntries = parseEntries(entriesRaw, validCardIds, wholeIndex.length);

  const user = await getCurrentUser();

  // Server rows first (authoritative). Fetches every row regardless of
  // `known` — a "Repetir" tap is still real activity worth surfacing in
  // "Continue", even though it doesn't count toward the known total below.
  const serverAnyUpdatedAt = new Map<string, number>();
  const serverKnownUpdatedAt = new Map<string, number>();
  if (user) {
    const rows = await db.flashcardProgress.findMany({
      where: { userId: user.id },
      select: { cardId: true, known: true, updatedAt: true },
    });
    for (const row of rows) {
      serverAnyUpdatedAt.set(row.cardId, row.updatedAt.getTime());
      if (row.known) serverKnownUpdatedAt.set(row.cardId, row.updatedAt.getTime());
    }
  }

  /**
   * МНЕНИЕ СЕРВЕРА СИЛЬНЕЕ ЗАЯВЛЕНИЯ БРАУЗЕРА — правка 18.09.2026,
   * находка владельца на видео проверки 7.207.
   *
   * ЧТО БЫЛО НАПИСАНО ЗДЕСЬ СЛОВАМИ И ЧТО ДЕЛАЛОСЬ НА ДЕЛЕ. Правило
   * объявлено строкой выше: карта браузера ДОПОЛНЯЕТ ответ карточками, о
   * которых сервер не знает ничего, и никогда не спорит с карточкой, о
   * которой у сервера мнение есть. А спрашивалось при этом
   * `serverKnownUpdatedAt` — множество строк, у которых `known = true`.
   * Строка «НЕ знаю» в него не попадает, и для этого условия она была
   * неотличима от отсутствия строки: браузер говорил «знаю», и его
   * заявление побеждало молча.
   *
   * ЧЕМ ЭТО БЫЛО НА ЭКРАНЕ (замер боевой базы 17.09.2026, только SELECT).
   * У проверяющего `rusofacil.review@gmail.com` в `FlashcardProgress`
   * ровно ЧЕТЫРЕ строки, у всех четырёх `known = 0`, `box = 0`, и записаны
   * они в одну секунду — это ответы в игре (`recordSrsAnswer` шлёт
   * `known = box >= 2`), а не отметка «знаю». Кабинет считает строки
   * `known = true` и печатал «0 palabras aprendidas». Сетка словаря в тот
   * же миг печатала «Вы выучили 4 из 4783»: четыре заявления браузера
   * перебили четыре строки сервера. Одна величина, два ответа.
   *
   * ЧТО ИЗМЕНИЛОСЬ. Спрашивается `serverAnyUpdatedAt` — «есть ли у сервера
   * СТРОКА про эту карточку», а не «сказал ли он про неё „знаю“». Это и
   * есть правило, записанное выше.
   *
   * ЦЕНА НАЗВАНА ЧЕСТНО. Гость, у которого сервер не знает ничего, не
   * теряет ни одной карточки — у него строк нет вовсе. Теряет тот, у кого
   * локальная отметка «знаю» РАСХОДИТСЯ со строкой сервера «не знаю»: он
   * увидит меньше, чем видел вчера. Это не потеря данных — ни одна строка
   * не трогается, — а согласие двух экранов об одном и том же числе.
   */
  const resolvedKnownIds = new Set<string>(serverKnownUpdatedAt.keys());
  for (const [cardId, entry] of clientEntries) {
    if (entry.known && !serverAnyUpdatedAt.has(cardId)) resolvedKnownIds.add(cardId);
  }

  /**
   * ЧИСЛИТЕЛЬ СЧИТАЕТСЯ ПО ТОМУ ЖЕ МНОЖЕСТВУ, ЧТО И ЗНАМЕНАТЕЛЬ — 7.206.
   *
   * `openCardIds` повторяет правило выдачи `GET /api/flashcards` целиком:
   * уровень плюс бесплатная проба (`FREE_TRIAL_LIMITS.flashcards` НА
   * ТЕМУ). До этого захода правило уровня учитывалось, а проба — нет, и
   * у бесплатного аккаунта, когда-то бывшего подписчиком, числитель
   * законно считал карточки, которых в знаменателе нет вовсе: «25 из 20»
   * — дробь, у которой нет смысла.
   *
   * Цена названа честно: бесплатный аккаунт после окончания подписки
   * увидит в счётчике меньше выученного, чем видел вчера. Ни одна строка
   * `flashcardProgress` при этом не трогается — счётчик говорит «из того,
   * что вам открыто», и только про это.
   */
  const openIds = openCardIds(wholeIndex, {
    entitled: tier !== "free",
    canAccessLevel: (lvl) => canAccessLevel(tier, lvl),
  });
  for (const cardId of [...resolvedKnownIds]) {
    if (!openIds.has(cardId)) resolvedKnownIds.delete(cardId);
  }

  const categories: Record<string, CategoryStat> = {};
  for (const card of index) {
    if (level && card.level !== level) continue;
    (categories[card.category] ??= { total: 0, known: 0 }).total += 1;
  }
  for (const cardId of resolvedKnownIds) {
    const card = cardById.get(cardId);
    if (!card) continue;
    if (level && card.level !== level) continue;
    if (categories[card.category]) categories[card.category].known += 1;
  }

  /**
   * ЗАКРЫТОЕ ВИДНО И НА СЕТКЕ ТЕМ — 7.195, части 2 и 3.
   *
   * Что было. `categories` выше считается по `index`, то есть по тому, что
   * посетитель МОЖЕТ открыть. На уровне C1 у неоплатившего это пустое
   * множество, и все 23 плитки печатали «0 слов» — при 988 строках C1 в
   * боевой базе. Ноль означал «ноль доступных», а человек читает «ничего
   * нет»: ровно тот же класс промаха, что и «Нет карточек для этого
   * фильтра» в долге 191, только на экран раньше.
   *
   * Что стало. Рядом с доступным едет перепись БАНКА тем же разрезом:
   * сколько строк есть и сколько из них закрыто. Числа — разность, а не
   * литералы (`siteCensus`), и правило выдачи у переписи то же самое,
   * которым режет список `GET /api/flashcards`.
   *
   * Разрез по уровням остаётся полным намеренно: плашка на выбранном
   * уровне обязана назвать число ЭТОГО уровня по всему банку, а не по
   * пересечению с темой, — иначе повторилась бы подмена, из-за которой
   * «8 слов темы Еда» было напечатано как «8 слов уровня C1».
   *
   * Веб этих полей не читает: их берёт только сетка внутри оболочки
   * (`CategoryGrid`, ветка `useIsNativeShell`).
   */
  const census = siteCensus(wholeIndex, {
    entitled: tier !== "free",
    canAccessLevel: (lvl) => canAccessLevel(tier, lvl),
    level,
  });

  // "Continue" candidates: same trust order (server updatedAt wins per
  // card, client fills in cards the server has no timestamp for at all),
  // then the most recently touched categories win. Uses serverAnyUpdatedAt
  // (not just the known:true subset) since "was this card touched at all"
  // is what "recently active category" means, not "was it marked known".
  const lastActivityByCardId = new Map<string, number>(serverAnyUpdatedAt);
  for (const [cardId, entry] of clientEntries) {
    if (!lastActivityByCardId.has(cardId)) lastActivityByCardId.set(cardId, entry.updatedAt);
  }
  //
  // ФИЛЬТР УРОВНЯ ЗДЕСЬ — ДОЛГ 229, заход 7.203, часть 3. До 16.09.2026 в
  // этом цикле его не было, а двадцатью строками ниже, у выбора самой
  // карточки, он стоял. Расхождение читалось на экране так: подписчик
  // standard выбирает C1, на котором ему не отдано ни одной карточки, и
  // «Продолжить» предлагает ему три темы («Работа и учёба 0/51» и
  // соседние) — потому что ТЕМА бралась по активности на ЛЮБОМ уровне, а
  // числа в той же строке считались по выбранному. `data-card` при этом
  // был null у всех трёх строк: продолжать было не с чего, нажатие
  // открывало тему с начала.
  //
  // Теперь тема попадает в список только по активности НА ЭТОМ РАЗРЕЗЕ.
  // Следствие, и оно намеренное: на уровне, где человеку не отдано
  // ничего, список пуст, а пустой список ContinueStrip не рисует вовсе
  // (`recent.length === 0` → null). Закрытый материал перестаёт
  // предлагаться, а плашка «закрыто N слов уровня C1» остаётся — она про
  // банк и говорит правду.
  //
  // Заметьте, что `cardById` — уже НЕ весь банк, а доступное этому
  // разряду; одного этого не хватало: тронутая карточка A1 из темы
  // «Работа и учёба» доступна и на C1-разрезе оставалась в списке.
  const lastActivityByCategory = new Map<string, number>();
  for (const [cardId, updatedAt] of lastActivityByCardId) {
    const card = cardById.get(cardId);
    if (!card) continue;
    if (level && card.level !== level) continue;
    const prev = lastActivityByCategory.get(card.category);
    if (!prev || updatedAt > prev) lastActivityByCategory.set(card.category, updatedAt);
  }
  // …и, для каждой из них, ТА САМАЯ карточка, на которой человек
  // остановился: строка с наибольшим `updatedAt` внутри категории.
  //
  // Ничего нового не считается и не хранится. Число `lastActivityByCardId`
  // уже собрано выше (оно и есть источник строки «Продолжить»), и до
  // 09.09.2026 оно сворачивалось до категории и выбрасывалось — из-за
  // чего нажатие на «Продолжить» открывало ПЕРВУЮ карточку темы, а не ту,
  // где человек стоял. Здесь тот же максимум берётся на шаг раньше.
  const lastCardByCategory = new Map<string, { cardId: string; updatedAt: number }>();
  for (const [cardId, updatedAt] of lastActivityByCardId) {
    const card = cardById.get(cardId);
    if (!card) continue;
    if (level && card.level !== level) continue;
    const prev = lastCardByCategory.get(card.category);
    if (!prev || updatedAt > prev.updatedAt) lastCardByCategory.set(card.category, { cardId, updatedAt });
  }

  const recent = [...lastActivityByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, lastActivityAt]) => {
      const last = lastCardByCategory.get(category);
      const card = last ? cardById.get(last.cardId) : undefined;
      return {
        category,
        total: categories[category]?.total ?? 0,
        known: categories[category]?.known ?? 0,
        lastActivityAt,
        // Сколько строк ЕСТЬ под этим разрезом, а не сколько отдано.
        // «0/0 · 0 %» в строке «Продолжить» на уровне C1 бралось отсюда:
        // знаменателем стояло ДОСТУПНОЕ, а доступного на C1 у
        // неоплатившего ноль (7.196, часть 2б).
        bankTotal: census.byCategory[category]?.bank ?? 0,
        // `null`, а не выдуманный id: под фильтром уровня последняя
        // тронутая карточка темы может оказаться другого уровня, и тогда
        // продолжать не с чего — блок откроет тему с начала, как раньше.
        lastCardId: last?.cardId ?? null,
        // Само слово, чтобы блок мог назвать его человеку. Русское —
        // одно на обе локали, как и на самой карточке.
        lastCardWord: card?.russian ?? null,
      };
    });

  // Level-independent, but NOT tier-independent: the numerator has to be
  // counted over exactly the set the denominator counts, or the fraction
  // stops meaning anything. Two ways it could drift, both closed here by
  // intersecting with the accessible index:
  //   - a `flashcardProgress` row for a card that no longer exists at all
  //     (deleted card, id changed) — those were already being counted;
  //   - a row for a C1 card, left behind by a Premium period that has
  //     since lapsed — real, and it would show a learner "12 of 4787"
  //     where some of the 12 are cards they can no longer open.
  // `resolvedKnownIds` is still built from every source first (server rows
  // win over client entries) and narrowed only at the end, so the trust
  // order above is untouched.
  //
  // И РАЗРЕЗ ТОЖЕ ТОТ ЖЕ — правка 15.09.2026, 7.197. До неё эти три числа
  // (`totalKnown`, `availableWords`, `premiumOnlyWords`) считались по
  // ВСЕМУ банку, а печатались на экране, у которого уже выбран уровень:
  // строка «Has aprendido 6 de 4787 palabras disponibles» стояла под
  // результатом раунда на уровне C1. Ровно та же семья, что «Aprendidas:
  // 0 de 216» на уровне C1 в теме из 45 строк: знаменатель отвечал не на
  // тот вопрос, который задан фильтром.
  //
  // Разрез накладывается ТОЛЬКО на эти три числа. `index`, `cardById` и
  // `validCardIds` остаются по всем уровням намеренно: по ним строятся
  // «недавние» карточки и разбирается то, что прислал браузер, и сузить
  // их значило бы молча потерять карточку другого уровня.
  const inCut = (card: { level: string }) => !level || card.level === level;
  /**
   * ЗНАМЕНАТЕЛЬ — ЭТО ТО, ЧТО ЧЕЛОВЕК ДЕЙСТВИТЕЛЬНО МОЖЕТ ОТКРЫТЬ.
   * Заход 7.206, находка 7.204, часть 3.
   *
   * Что было. `availableWords` считался как `index`, то есть по одному
   * правилу уровня (`canAccessLevel`), и БЕСПЛАТНУЮ ПРОБУ не видел вовсе.
   * А проба — это ровно то, чем ограничен бесплатный аккаунт:
   * `GET /api/flashcards` отдаёт ему `FREE_TRIAL_LIMITS.flashcards`
   * карточек НА ТЕМУ и ни одной сверх того.
   *
   * Чем это было на экране. Замер по боевому банку 17.09.2026: строк
   * всего 5771, из них не-C1 — 4783, тем — 23. Бесплатный аккаунт
   * (`justicloudforme@gmail.com`) читал под фильтром «TODOS» ровно то же
   * число, что и подписчик, — «0 de 4783 palabras disponibles», — а
   * открыть мог 10 × 23 = 230. Завышение в 4553 слова, и слово
   * «disponibles» («доступные») делало его утверждением, а не опиской.
   *
   * Что стало. Доступное считается ТЕМ ЖЕ `openCardIds`, которым его
   * считает перепись закрытого, то есть тем же правилом, каким режет
   * выдачу сам список карточек. Второго определения «доступного» в этом
   * файле больше нет.
   *
   * И ЗАКРЫТОЕ РАЗДЕЛЕНО ПО ПРИЧИНАМ. Одного числа мало: у бесплатного
   * аккаунта 4553 слова закрыты ПОДПИСКОЙ и 988 — планом Premium, и
   * печатать всё это как «столько-то ещё с Premium» значило бы звать
   * человека покупать не то, что ему нужно. Причина у карточки одна и
   * определяется правилом уровня: не пускает уровень — это Premium; не
   * пускает проба — это подписка.
   */
  const inCutBank = wholeIndex.filter(inCut);
  const availableWords = inCutBank.filter((card) => openIds.has(card.id)).length;
  const lockedInCut = inCutBank.filter((card) => !openIds.has(card.id));
  const premiumOnlyWords = lockedInCut.filter((card) => !canAccessLevel(tier, card.level)).length;
  const subscriptionOnlyWords = lockedInCut.length - premiumOnlyWords;
  const totalKnown = [...resolvedKnownIds].filter((id) => {
    const card = cardById.get(id);
    return card !== undefined && inCut(card);
  }).length;
  const hasAnyProgress = lastActivityByCardId.size > 0;


  return NextResponse.json({
    /**
     * РАЗРЕЗ, ПО КОТОРОМУ ПОСЧИТАН ЭТОТ ОТВЕТ — 7.196, часть 2.
     *
     * Без него браузер не может отличить «числа этого уровня» от «числа
     * ПРЕДЫДУЩЕГО уровня, которые ещё не сменились». Замер 14.09.2026
     * (искусственная задержка ответа 3000 мс, `?level=C1` нажатием):
     * всё время, пока ответ едет, плитка «Еда и ресторан» печатает
     * «266 слов» — число уровня ВСЕ — и знака не несёт вовсе, потому что
     * в разрезе «ВСЕ» тема не закрыта. Ровно это владелец снял с телефона
     * и описал как «плитка не слушает выбранный уровень»: уровень она
     * слушает, а вот числа держит чужие, пока не придут свои.
     *
     * `null` — «все уровни». Литералом это поле быть не может: сюда едет
     * ровно то, что разобрал `isFlashcardLevel` выше.
     */
    level,
    /**
     * Тариф самого спрашивающего — 7.196, часть 1.
     *
     * Сетка тем печатает знак сорта, а знак решает общее правило
     * `accessSignFor`, и правилу нужен тариф. Своего тарифа человек
     * отсюда не узнаёт ничего нового: рядом уже едут `availableWords` и
     * `premiumOnlyWords`, из которых он вычисляется вычитанием. Чужого
     * тарифа здесь нет и быть не может — `getEntitlementTier()` отвечает
     * про сессию запроса.
     */
    tier,
    categories,
    recent,
    totalKnown,
    bankCategories: census.byCategory,
    lockedByLevel: Object.fromEntries(Object.entries(census.byLevel).map(([lvl, row]) => [lvl, row.locked])),
    lockedTotal: census.total.locked,
    // Cards this visitor can open right now, at their current tier — В
    // ТОМ ЖЕ РАЗРЕЗЕ, что и всё остальное в этом ответе (см. `inCut`).
    availableWords,
    // Cards that exist but need the Premium plan — 0 for a premium/staff
    // visitor, which is what tells the UI to drop the second half of the
    // sentence rather than print "and 0 more in Premium".
    premiumOnlyWords,
    // Закрытые бесплатной пробой: их открывает ЛЮБАЯ подписка, и звать за
    // ними в Premium было бы враньём. 0 у всех, кроме бесплатного
    // аккаунта и гостя.
    subscriptionOnlyWords,
    hasAnyProgress,
  });
}
