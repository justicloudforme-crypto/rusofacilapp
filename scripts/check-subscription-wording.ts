/**
 * ЧТО НАПИСАНО НА ЭКРАНЕ ПРО ПОДПИСКУ — СЛЕДСТВИЕ ДАТЫ, А НЕ СЛОВА ИЗ
 * КОЛОНКИ. Долг 194, заход 7.194.
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Владелец снял на живом телефоне 14.09.2026 три утверждения рядом:
 * «Отменена», «Истекла 19 сентября 2026» — при сегодняшней дате 14
 * сентября, — и закрытый доступ. Глагол в прошедшем времени стоял рядом
 * с датой в будущем, и это не описка перевода: подпись выбиралась
 * ДОСТУПОМ (`isActive ? «Действует до» : «Истекла»`), доступ — словом
 * `canceled` из колонки, а слово это поставил старый код отмены.
 *
 * Правило, которое здесь сторожится, ровно одно и состоит из пары:
 *
 *   активная подписка с назначенной отменой → «Активна до <дата>,
 *                                             продление отключено»
 *   период кончился                        → «Истекла <дата>»
 *
 * и из запрета, без которого пара была бы украшением:
 *
 *   СЛОВО «ИСТЕКЛА» НЕ ИМЕЕТ ПРАВА СТОЯТЬ РЯДОМ С ДАТОЙ В БУДУЩЕМ —
 *   ни при каком содержимом колонки `status`.
 *
 * ====================================================================
 * ЧЕМ ЭТО ПРОВЕРЯЕТСЯ
 * ====================================================================
 *
 * Двумя половинами, и вторая обязательна (PROGRESS.md 4.1).
 *
 * ПЕРВАЯ — правила прогоняются по таблице строк, покрывающей все
 * состояния, включая то, в котором лежит боевая строка сегодня.
 *
 * ВТОРАЯ (`--plant`) — те же правила прогоняются по СТАРОЙ реализации,
 * которая написана здесь целиком и заведомо неверна. Каждая подсадка
 * ОБЯЗАНА быть поймана; молчание хоть на одной означает, что правило не
 * судит ничего, и прогон красный.
 *
 * Плюс третье, короткое: страница кабинета обязана звать
 * `subscriptionDateLine`, а не выбирать подпись доступом. Иначе правило
 * было бы верным в модуле и неверным на экране.
 */
import { readFileSync } from "node:fs";
import {
  getDisplayStatus,
  subscriptionDateLine,
  isSubscriptionActive,
  type DisplayStatus,
  type SubscriptionDateLine,
} from "../src/lib/subscription-status";
import { isEntryPoint } from "../src/lib/entry-point";
import { subscriptionMoment } from "../src/lib/subscription-moment";

const PROFILE_FILE = "src/app/[lang]/profile/page.tsx";

/**
 * ====================================================================
 * ВТОРОЕ ПРАВИЛО, ЗАВЕДЁННОЕ 15.09.2026 (заход 7.197):
 * ДЕНЬ НА ЭКРАНЕ РАВЕН ДНЮ РЕАЛЬНОГО ЗАКРЫТИЯ
 * ====================================================================
 *
 * ОТКУДА. Владелец снял на телефоне «Vence el 19 de septiembre de 2026»,
 * отчёт 7.196 записал «18 сентября», а подсадка даты показывала, что
 * 18.09 23:00 UTC доступ есть, а 19.09 — нет. Три числа, и ни одно не
 * противоречит остальным: боевая строка `2026-09-18T23:47:02.000Z`,
 * `User.timezone` = `Asia/Vladivostok` (UTC+10) — это 19-е в 09:47 у
 * человека и 18-е в 23:47 в UTC.
 *
 * ДЕФЕКТ БЫЛ ОДИН, И ОН НЕ В ЭТОМ. Экран печатал ДЕНЬ, а доступ кончается
 * в МОМЕНТ: «Vence el 19» человек читает как «весь 19-й мой», а доступа
 * нет уже с 09:47. Разница — 14 ч 13 мин.
 *
 * ЧЕМ ЭТО СТЕРЕЖЁТСЯ. Двумя НЕЗАВИСИМЫМИ половинами, и в этом весь
 * смысл: если бы момент закрытия брался из того же поля, из которого
 * рисуется экран, прибор сверял бы себя с собой.
 *
 *   * момент закрытия ИЗМЕРЯЕТСЯ — двоичным поиском по самому правилу
 *     доступа `isSubscriptionActive` с подставленным «сейчас». Это
 *     ответ на вопрос «когда на самом деле перестаёт пускать», а не
 *     «что записано в колонке»;
 *   * день закрытия считается ДРУГИМ способом, чем день на экране:
 *     `toLocaleDateString("en-CA")` против `formatToParts` внутри
 *     `dateKeyIn`. Один и тот же вызов на обеих сторонах доказывал бы
 *     только то, что Intl детерминирован.
 */
type Render = (iso: string, locale: string, timeZone: string) => { dayKey: string; timeOfDay: string; text: string };

/** Пояса, в которых судится каждая строка. `Asia/Vladivostok` — пояс
 *  боевого аккаунта `petrov19291@gmail.com` (замер по проду, только
 *  чтение); остальные три дают разные знаки смещения. */
const ZONES = ["Asia/Vladivostok", "UTC", "America/Tijuana", "America/Mexico_City"];

/** День момента в поясе, посчитанный НЕ ТЕМ способом, что на экране. */
function dayKeyByLocale(at: Date, timeZone: string): string {
  return at.toLocaleDateString("en-CA", { timeZone });
}

/** Час и минута момента в поясе — независимая половина того же. */
function timeOfDayByLocale(at: Date, timeZone: string): string {
  return at.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * МОМЕНТ, В КОТОРЫЙ ДОСТУП ЗАКРЫВАЕТСЯ НА САМОМ ДЕЛЕ.
 *
 * Не читается из строки, а ИЩЕТСЯ: `Date.now` подменяется, и двоичный
 * поиск находит секунду, на которой `isSubscriptionActive` меняет ответ.
 * Точность — секунда, и её хватает: утверждение захода — «с точностью до
 * часа».
 */
function measuredClosure(row: Row): number {
  const realNow = Date.now;
  try {
    const end = row.currentPeriodEnd.getTime();
    let open = end - 3 * DAY;
    let shut = end + 3 * DAY;
    Date.now = () => open;
    if (!isSubscriptionActive(row)) return NaN;
    Date.now = () => shut;
    if (isSubscriptionActive(row)) return NaN;
    while (shut - open > 1000) {
      const mid = open + Math.floor((shut - open) / 2);
      Date.now = () => mid;
      if (isSubscriptionActive(row)) open = mid;
      else shut = mid;
    }
    return shut;
  } finally {
    Date.now = realNow;
  }
}

/** Доступ в названный момент — тем же правилом и с тем же подменённым
 *  «сейчас». Это и есть подсадка трёх моментов, о которой просил
 *  владелец: за сутки до конца, в последний час, в первый час после. */
function accessAt(row: Row, at: number): boolean {
  const realNow = Date.now;
  try {
    Date.now = () => at;
    return isSubscriptionActive(row);
  } finally {
    Date.now = realNow;
  }
}

/** Строки, у которых доступ действительно кончается: только на них
 *  вопрос «день на экране против дня закрытия» имеет смысл. */
const CLOSING_CASES: Array<{ name: string; row: Row }> = [
  {
    // БОЕВАЯ СТРОКА, ДОСЛОВНО (чтение прода 15.09.2026, записей 0):
    // cmszbb7fg000104lb96t5obn4, plan monthly, status active,
    // currentPeriodEnd 2026-09-18T23:47:02.000+00:00,
    // canceledAt 2026-08-19T00:07:52.622+00:00.
    name: "боевая строка petrov19291@gmail.com после миграции долга 195",
    row: {
      status: "active",
      currentPeriodEnd: new Date("2026-09-18T23:47:02.000Z"),
      canceledAt: new Date("2026-08-19T00:07:52.622Z"),
      updatedAt: new Date("2026-09-14T20:18:35.277Z"),
    },
  },
  {
    // Ровно полночь UTC: в любом поясе к востоку это уже следующий день,
    // к западу — ещё предыдущий. Самый дешёвый способ поймать «день взяли
    // не в том поясе».
    name: "конец периода ровно в полночь UTC",
    row: {
      status: "active",
      currentPeriodEnd: new Date("2026-12-31T00:00:00.000Z"),
      canceledAt: null,
      updatedAt: new Date("2026-12-01T00:00:00.000Z"),
    },
  },
  {
    name: "конец периода в полдень UTC",
    row: {
      status: "active",
      currentPeriodEnd: new Date("2027-03-15T12:00:00.000Z"),
      canceledAt: null,
      updatedAt: new Date("2027-02-15T12:00:00.000Z"),
    },
  },
];

function momentProblems(render: Render): string[] {
  const problems: string[] = [];
  for (const { name, row } of CLOSING_CASES) {
    const closedAt = measuredClosure(row);
    if (Number.isNaN(closedAt)) {
      problems.push(`«${name}»: момент закрытия не нашёлся — правило доступа не меняет ответ на этой строке`);
      continue;
    }
    // Момент закрытия, измеренный по правилу, обязан совпасть с концом
    // периода. Разойдись они — дальше сравнивать нечего.
    const drift = Math.abs(closedAt - row.currentPeriodEnd.getTime());
    if (drift > 1000) {
      problems.push(`«${name}»: доступ закрывается не в конце периода, а на ${Math.round(drift / 1000)} с позже`);
    }
    // ТРИ МОМЕНТА ПОДСАДКОЙ: за сутки до конца, в последний час, в первый
    // час после.
    const end = row.currentPeriodEnd.getTime();
    if (!accessAt(row, end - DAY)) problems.push(`«${name}»: за сутки до конца доступа НЕТ`);
    if (!accessAt(row, end - 60 * 60 * 1000)) problems.push(`«${name}»: в последний час доступа НЕТ`);
    if (accessAt(row, end + 60 * 60 * 1000)) problems.push(`«${name}»: через час после конца доступ ЕСТЬ`);

    const closed = new Date(closedAt);
    for (const zone of ZONES) {
      const closureDay = dayKeyByLocale(closed, zone);
      const closureTime = timeOfDayByLocale(closed, zone);
      const shown: Record<string, ReturnType<Render>> = {};
      for (const locale of ["ru", "es"]) {
        const moment = render(row.currentPeriodEnd.toISOString(), locale, zone);
        shown[locale] = moment;
        if (moment.dayKey !== closureDay) {
          problems.push(
            `«${name}», ${zone}, /${locale}: на экране день ${moment.dayKey}, а доступ закрывается ${closureDay} — ` +
              `человек увидит «действует» в день, когда доступа уже нет`,
          );
        }
        if (moment.timeOfDay !== closureTime) {
          problems.push(
            `«${name}», ${zone}, /${locale}: на экране ${moment.timeOfDay}, доступ закрывается в ${closureTime}`,
          );
        }
        // Час обязан быть НАПЕЧАТАН, а не только посчитан: день без часа
        // обещает до полуночи, а доступ кончается раньше.
        if (!moment.text.includes(closureTime)) {
          problems.push(
            `«${name}», ${zone}, /${locale}: на экране «${moment.text}» — часа закрытия (${closureTime}) в нём нет, ` +
              `и день обещает больше, чем даёт доступ`,
          );
        }
      }
      if (shown.ru.dayKey !== shown.es.dayKey) {
        problems.push(`«${name}», ${zone}: /ru называет ${shown.ru.dayKey}, /es — ${shown.es.dayKey}`);
      }
    }
  }
  return problems;
}

const LIVE_RENDER: Render = (iso, locale, timeZone) => subscriptionMoment(iso, locale, timeZone);

/** Ровно те поля, которые читают обе функции. */
interface Row {
  status: string;
  currentPeriodEnd: Date;
  canceledAt: Date | null;
  updatedAt: Date;
}

type Rules = {
  status: (row: Row) => DisplayStatus;
  line: (row: Row) => SubscriptionDateLine;
};

const DAY = 24 * 60 * 60 * 1000;
const future = (days: number) => new Date(Date.now() + days * DAY);
const past = (days: number) => new Date(Date.now() - days * DAY);

/**
 * Таблица состояний.
 *
 * Пятая строка — это боевая строка `cmszbb7fg000104lb96t5obn4` ДО
 * миграции долга 195: отменена старым кодом, период ещё идёт, `canceledAt`
 * пуст. Она оставлена, и оставлена намеренно: правило обязано отвечать
 * верно и на строки, которые старый код мог оставить и после.
 *
 * ШЕСТАЯ — ТА ЖЕ СТРОКА ПОСЛЕ МИГРАЦИИ, применённой к проду 14.09.2026
 * (7.196, часть 6): `status: active`, `canceledAt` проставлен,
 * `currentPeriodEnd` 18.09.2026 — то есть «отменена, но оплаченный период
 * ещё идёт». Это САМОСТОЯТЕЛЬНОЕ состояние `canceling` со своим текстом:
 * и «активна», и «отменена» про такую строку — полуправда. Доказано на
 * экране в обеих локалях: «Отменена — доступ до конца оплаченного
 * периода» / «Cancelada — acceso hasta el final del periodo pagado», под
 * ней «Действует до 18 сентября 2026 г.» / «Vence el 18 de septiembre de
 * 2026».
 */
const CASES: Array<{ name: string; row: Row; wantStatus: DisplayStatus; wantLine: SubscriptionDateLine["kind"] }> = [
  {
    name: "обычная активная, период впереди",
    row: { status: "active", currentPeriodEnd: future(10), canceledAt: null, updatedAt: past(30) },
    wantStatus: "active",
    wantLine: "expires",
  },
  {
    name: "активная с назначенной отменой (правка 7.193) — «активна до …, продление отключено»",
    row: { status: "active", currentPeriodEnd: future(5), canceledAt: past(1), updatedAt: past(1) },
    wantStatus: "canceling",
    wantLine: "expires",
  },
  {
    name: "период кончился, слово в колонке «active» — «истекла»",
    row: { status: "active", currentPeriodEnd: past(3), canceledAt: null, updatedAt: past(3) },
    wantStatus: "expired",
    wantLine: "expired",
  },
  {
    name: "период кончился, слово в колонке «canceled» — та же «истекла»",
    row: { status: "canceled", currentPeriodEnd: past(3), canceledAt: past(10), updatedAt: past(10) },
    wantStatus: "expired",
    wantLine: "expired",
  },
  {
    name: "БОЕВАЯ СТРОКА: отменена старым кодом, период ещё идёт, canceledAt пуст",
    row: { status: "canceled", currentPeriodEnd: future(4), canceledAt: null, updatedAt: past(26) },
    wantStatus: "canceled",
    wantLine: "canceledOn",
  },
  {
    // ДОЛГ 195 ПОСЛЕ ПРИМЕНЕНИЯ — 7.196, часть 6.
    name: "БОЕВАЯ СТРОКА ПОСЛЕ МИГРАЦИИ: отменена, но период ещё идёт",
    row: { status: "active", currentPeriodEnd: future(4), canceledAt: past(26), updatedAt: past(26) },
    wantStatus: "canceling",
    wantLine: "expires",
  },
  {
    name: "просрочен платёж",
    row: { status: "past_due", currentPeriodEnd: future(2), canceledAt: null, updatedAt: past(1) },
    wantStatus: "past_due",
    wantLine: "expires",
  },
];

/** Все правила разом. Возвращает список нарушений. */
function judge(rules: Rules): string[] {
  const problems: string[] = [];
  for (const testCase of CASES) {
    const status = rules.status(testCase.row);
    const line = rules.line(testCase.row);
    if (status !== testCase.wantStatus) {
      problems.push(`«${testCase.name}»: состояние ${status}, ожидалось ${testCase.wantStatus}`);
    }
    if (line.kind !== testCase.wantLine) {
      problems.push(`«${testCase.name}»: подпись даты ${line.kind}, ожидалась ${testCase.wantLine}`);
    }
    // ГЛАВНЫЙ ЗАПРЕТ. «Истекла» рядом с датой в будущем — ровно то, что
    // владелец снял на телефоне.
    if (line.kind === "expired" && new Date(line.iso).getTime() > Date.now()) {
      problems.push(
        `«${testCase.name}»: подпись «Истекла» стоит рядом с датой В БУДУЩЕМ (${line.iso}) — ` +
          `это и есть дефект долга 194`,
      );
    }
    // И обратный: «действует до» рядом с датой в прошлом.
    if (line.kind === "expires" && new Date(line.iso).getTime() <= Date.now()) {
      problems.push(`«${testCase.name}»: подпись «Действует до» стоит рядом с датой В ПРОШЛОМ (${line.iso})`);
    }
  }
  return problems;
}

/** СТАРАЯ реализация, целиком, ради подсадки: слово из колонки решает
 *  раньше даты, а подпись выбирается доступом. */
const OLD_RULES: Rules = {
  status: (row) => {
    if (row.status === "canceled") return "canceled";
    if (row.status === "past_due") return "past_due";
    if (!isSubscriptionActive(row)) return "expired";
    if (row.canceledAt) return "canceling";
    return row.status === "trialing" ? "trialing" : "active";
  },
  line: (row) => ({
    kind: isSubscriptionActive(row) ? "expires" : "expired",
    iso: row.currentPeriodEnd.toISOString(),
  }),
};

/** Подсадка «признак отмены забыли»: `canceledAt` не читается вовсе. */
const IGNORES_CANCELED_AT: Rules = {
  status: (row) => getDisplayStatus({ ...row, canceledAt: null }),
  line: (row) => subscriptionDateLine({ ...row, canceledAt: null }),
};

/**
 * ПОДСАДКА «МИГРАЦИЯ ОТКАЧЕНА» — 7.196, часть 6.
 *
 * Возвращает строку в то состояние, в котором она лежала на проде ДО
 * 14.09.2026: слово `canceled` в колонке и пустой `canceledAt`. Экран
 * тогда снова печатает «Отменена» и дату ОТМЕНЫ вместо конца оплаченного
 * периода — то есть человек не видит того, за что заплатил. Подсадка
 * обязана быть поймана: без неё «состояние canceling проверено» значило
 * бы только, что оно существует в перечислении.
 */
const MIGRATION_ROLLED_BACK: Rules = {
  status: (row) => getDisplayStatus({ ...row, status: "canceled", canceledAt: null }),
  line: (row) => subscriptionDateLine({ ...row, status: "canceled", canceledAt: null }),
};

/** Подсадка «дату подписи взяли от периода всегда». */
const ALWAYS_PERIOD_END: Rules = {
  status: (row) => getDisplayStatus(row),
  line: (row) => {
    const real = subscriptionDateLine(row);
    return { kind: real.kind === "canceledOn" ? "expired" : real.kind, iso: row.currentPeriodEnd.toISOString() };
  },
};

const LIVE_RULES: Rules = { status: getDisplayStatus, line: subscriptionDateLine };

/** ПОДСАДКА «день считает не тот пояс» — ровно прежнее поведение
 *  `LocalDate`: сервер печатал UTC, браузер потом свой пояс. На боевой
 *  строке это разница в целые сутки. */
const RENDER_IN_UTC: Render = (iso, locale) => subscriptionMoment(iso, locale, "UTC");

/** ПОДСАДКА «на экране только день, без часа» — то, что стояло до
 *  15.09.2026 во всех поясах сразу. */
const RENDER_DAY_ONLY: Render = (iso, locale, timeZone) => {
  const real = subscriptionMoment(iso, locale, timeZone);
  return {
    dayKey: real.dayKey,
    timeOfDay: real.timeOfDay,
    text: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone }).format(new Date(iso)),
  };
};

/** ПОДСАДКА «день сдвинут на сутки» — требование владельца поимённо:
 *  расхождение ровно в сутки обязано ронять прогон. */
const RENDER_A_DAY_LATE: Render = (iso, locale, timeZone) =>
  subscriptionMoment(new Date(new Date(iso).getTime() + 24 * 60 * 60 * 1000).toISOString(), locale, timeZone);

/** ПОДСАДКА «час сдвинут на час» — граница, названная владельцем: «если
 *  расходятся хоть на час — это дефект». */
const RENDER_AN_HOUR_LATE: Render = (iso, locale, timeZone) =>
  subscriptionMoment(new Date(new Date(iso).getTime() + 60 * 60 * 1000).toISOString(), locale, timeZone);

export async function main(): Promise<number> {
  const plant = process.argv.includes("--plant");

  if (plant) {
    let ok = judge(LIVE_RULES).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые правила (отрицательный контроль)`);
    const momentClean = momentProblems(LIVE_RENDER);
    ok &&= momentClean.length === 0;
    console.log(
      `  ${momentClean.length === 0 ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровая отрисовка момента ` +
        `(отрицательный контроль)${momentClean.length ? `: ${momentClean[0]}` : ""}`,
    );

    const plants: Array<[string, Rules]> = [
      ["СТАРОЕ правило целиком: слово «canceled» решает раньше даты", OLD_RULES],
      ["признак отмены (canceledAt) перестал читаться", IGNORES_CANCELED_AT],
      ["дата подписи всегда берётся от конца периода", ALWAYS_PERIOD_END],
      ["миграция долга 195 откачена: строка снова canceled с пустым canceledAt", MIGRATION_ROLLED_BACK],
    ];
    let caught = 0;
    for (const [name, rules] of plants) {
      const found = judge(rules);
      if (found.length > 0) caught++;
      console.log(`  ${found.length > 0 ? "поймано" : "ПРОПУЩЕНО"} — ${name}${found.length ? ` (${found[0]})` : ""}`);
    }

    const renderPlants: Array<[string, Render]> = [
      ["день печатается в UTC, а не в поясе человека (прежний LocalDate)", RENDER_IN_UTC],
      ["на экране только день, без часа закрытия", RENDER_DAY_ONLY],
      ["день на экране сдвинут на СУТКИ", RENDER_A_DAY_LATE],
      ["момент на экране сдвинут на ЧАС", RENDER_AN_HOUR_LATE],
    ];
    for (const [name, render] of renderPlants) {
      const found = momentProblems(render);
      if (found.length > 0) caught++;
      console.log(`  ${found.length > 0 ? "поймано" : "ПРОПУЩЕНО"} — ${name}${found.length ? ` (${found[0]})` : ""}`);
    }

    // Подсадка на страницу: вернуть выбор подписи доступом.
    const source = readFileSync(PROFILE_FILE, "utf8");
    const planted = source.replace(/subscriptionDateLine/g, "неСпрашиваемДату");
    const wiringPlanted = wiringProblems(planted);
    console.log(
      `  ${wiringPlanted.length > 0 ? "поймано" : "ПРОПУЩЕНО"} — кабинет перестал звать subscriptionDateLine`,
    );
    if (wiringPlanted.length > 0) caught++;

    // И подсадка на вторую половину: дата подписи снова печатается днём
    // из браузера.
    const backToLocalDate = source.replace(
      "<dd>{subscriptionMomentText(dateLine.iso, lang, timeZone)}</dd>",
      "<dd><LocalDate iso={dateLine.iso} locale={lang} timeZone={timeZone} /></dd>",
    );
    const localDatePlanted = wiringProblems(backToLocalDate);
    console.log(
      `  ${localDatePlanted.length > 0 ? "поймано" : "ПРОПУЩЕНО"} — дата подписи снова печатается днём через <LocalDate>`,
    );
    if (localDatePlanted.length > 0) caught++;

    const expected = plants.length + renderPlants.length + 2;
    ok &&= caught === expected;
    console.log(
      ok
        ? `check:subscription-wording --plant — ${caught} из ${expected} подсадок, 2 из 2 отрицательных контроля`
        : `check:subscription-wording --plant — FAILED (${caught} из ${expected})`,
    );
    return ok ? 0 : 1;
  }

  const problems = [
    ...judge(LIVE_RULES),
    ...momentProblems(LIVE_RENDER),
    ...wiringProblems(readFileSync(PROFILE_FILE, "utf8")),
  ];
  if (problems.length) {
    console.error("ТЕКСТ ПРО ПОДПИСКУ РАСХОДИТСЯ С ДАТОЙ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    `check:subscription-wording — момент на экране равен моменту закрытия: ${CLOSING_CASES.length} строк × ` +
      `${ZONES.length} поясов × 2 локали = ${CLOSING_CASES.length * ZONES.length * 2} сличений, расхождений 0; ` +
      `/ru и /es называют один день во всех ${CLOSING_CASES.length * ZONES.length} парах.`,
  );
  console.log(
    `check:subscription-wording — ${CASES.length} состояний, включая боевую строку: ` +
      `«Истекла» ни разу не стоит рядом с датой в будущем, «Действует до» — ни разу с датой в прошлом; ` +
      `подпись и дата приходят одним решением из subscriptionDateLine. Контроль — --plant.`,
  );
  return 0;
}

/** Экранная половина: кабинет обязан брать подпись и дату из одного места. */
function wiringProblems(source: string): string[] {
  const problems: string[] = [];
  if (!source.includes("subscriptionDateLine")) {
    problems.push(`${PROFILE_FILE}: подпись и дата больше не приходят из subscriptionDateLine`);
  }
  // И ВТОРАЯ ПОЛОВИНА, 7.197: дату подписи печатает `subscriptionMomentText`,
  // то есть МОМЕНТ в поясе человека, посчитанный сервером. Прежний
  // `<LocalDate>` печатал ДЕНЬ и печатал его браузером — оба раза мимо.
  if (!source.includes("subscriptionMomentText")) {
    problems.push(`${PROFILE_FILE}: дата подписи больше не приходит из subscriptionMomentText`);
  }
  if (/<LocalDate iso=\{(?:subscription\.currentPeriodEnd|dateLine\.iso)/.test(source)) {
    problems.push(
      `${PROFILE_FILE}: дата подписи снова печатается через <LocalDate> — это ДЕНЬ вместо МОМЕНТА, ` +
        `и считает его браузер, а не сервер`,
    );
  }
  if (/isActive \? dict\.profile\.expiresLabel/.test(source)) {
    problems.push(
      `${PROFILE_FILE}: подпись под датой снова выбирается ДОСТУПОМ (isActive), а не датой — ` +
        `ровно это и печатало «Истекла» рядом с 19 сентября 14 сентября`,
    );
  }
  return problems;
}

if (isEntryPoint(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
