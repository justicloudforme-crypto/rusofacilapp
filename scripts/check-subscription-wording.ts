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

const PROFILE_FILE = "src/app/[lang]/profile/page.tsx";

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
 * Таблица состояний. Пятая строка — это боевая строка
 * `cmszbb7fg000104lb96t5obn4` на 14.09.2026 (замер по проду, только
 * чтение): отменена старым кодом, период ещё идёт, `canceledAt` пуст.
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

/** Подсадка «дату подписи взяли от периода всегда». */
const ALWAYS_PERIOD_END: Rules = {
  status: (row) => getDisplayStatus(row),
  line: (row) => {
    const real = subscriptionDateLine(row);
    return { kind: real.kind === "canceledOn" ? "expired" : real.kind, iso: row.currentPeriodEnd.toISOString() };
  },
};

const LIVE_RULES: Rules = { status: getDisplayStatus, line: subscriptionDateLine };

export async function main(): Promise<number> {
  const plant = process.argv.includes("--plant");

  if (plant) {
    let ok = judge(LIVE_RULES).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые правила (отрицательный контроль)`);

    const plants: Array<[string, Rules]> = [
      ["СТАРОЕ правило целиком: слово «canceled» решает раньше даты", OLD_RULES],
      ["признак отмены (canceledAt) перестал читаться", IGNORES_CANCELED_AT],
      ["дата подписи всегда берётся от конца периода", ALWAYS_PERIOD_END],
    ];
    let caught = 0;
    for (const [name, rules] of plants) {
      const found = judge(rules);
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

    ok &&= caught === plants.length + 1;
    console.log(
      ok
        ? `check:subscription-wording --plant — ${caught} из ${plants.length + 1} подсадок, 1 из 1 отрицательный контроль`
        : `check:subscription-wording --plant — FAILED (${caught} из ${plants.length + 1})`,
    );
    return ok ? 0 : 1;
  }

  const problems = [...judge(LIVE_RULES), ...wiringProblems(readFileSync(PROFILE_FILE, "utf8"))];
  if (problems.length) {
    console.error("ТЕКСТ ПРО ПОДПИСКУ РАСХОДИТСЯ С ДАТОЙ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
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
