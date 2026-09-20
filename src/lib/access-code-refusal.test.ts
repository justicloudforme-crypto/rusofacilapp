import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * У ОТКАЗА КОДА ДОСТУПА ЕСТЬ ИМЯ — 20.09.2026, заход 7.220.
 *
 * Что измерено и почему это срочно. Sentry `JAVASCRIPT-NEXTJS-R`:
 * `AccessCodeRefused`, сообщение `Access code refused: unknown`, маршрут
 * `POST /api/access-code/redeem`, **2 события, пользователей 1**, возраст
 * 2 недели. Это ВТОРАЯ за всю историю проекта запись, у которой
 * пострадавших не ноль. Владелец раздаёт партию `AMIGO-2026-09-08` живым
 * тестировщикам закрытого теста Google Play, и «код не сработал» — первое,
 * обо что они упрутся.
 *
 * Чем было плохо слово `unknown`. Оно отвечало за ТРИ разные ситуации:
 * поле пустое, такого кода нет, строка есть но отказ ею не объясняется.
 * Все три печатали человеку один текст — «No encontramos ese código.
 * Revisa las letras» — и уходили в Sentry одним тегом. То есть и человек,
 * и мы читали про опечатку там, где опечатки могло не быть вовсе.
 *
 * ЧТО ЗАПЕРТО ЗДЕСЬ, ТРЕМЯ ПРАВИЛАМИ:
 *   а) КАЖДАЯ причина из `ACCESS_CODE_REFUSALS` названа в таблице текстов
 *      и имеет СВОЙ текст в ОБЕИХ локалях — не пересказ соседа;
 *   б) подсадка каждой ситуации в `redeemAccessCode` называет именно её —
 *      это позитивный контроль, а не проверка типа;
 *   в) отчёт в Sentry несёт то же имя, что и ответ человеку, иначе панель
 *      и экран рассказывали бы разное про одно событие.
 *
 * Соседний `access-code.test.ts` проверяет ПОРЯДОК шагов и одноразовость;
 * здесь — только имена причин и их видимость.
 */

type Row = {
  code: string;
  tier: string;
  durationDays: number;
  expiresAt: Date | null;
  redeemedAt: Date | null;
  revokedAt: Date | null;
};

const updateMany = vi.fn<(args: unknown) => Promise<{ count: number }>>();
const findUnique = vi.fn<(args: unknown) => Promise<Row | null>>();
const extendOrGrantSubscription = vi.fn(async () => {});
const getEntitlementTierFor = vi.fn(async () => "free" as "free" | "standard" | "premium");
const captureException = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    accessCode: {
      updateMany: (args: never) => updateMany(args),
      findUnique: (args: never) => findUnique(args),
    },
  },
}));
vi.mock("@/lib/subscription", async () => {
  const actual = await vi.importActual<typeof import("@/lib/subscription")>("@/lib/subscription");
  return { ...actual, extendOrGrantSubscription: (...args: unknown[]) => extendOrGrantSubscription(...(args as [])) };
});
vi.mock("@/lib/entitlement", async () => {
  const actual = await vi.importActual<typeof import("@/lib/entitlement")>("@/lib/entitlement");
  return { ...actual, getEntitlementTierFor: () => getEntitlementTierFor() };
});
vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

const {
  redeemAccessCode,
  ACCESS_CODE_REFUSALS,
  ACCESS_CODE_OUTCOME_MESSAGE_KEY,
  accessCodeOutcomeFromQuery,
} = await import("./access-code");
const es = (await import("../dictionaries/es.json")).default as unknown as { profile: Record<string, string> };
const ru = (await import("../dictionaries/ru.json")).default as unknown as { profile: Record<string, string> };

const USER = { id: "u1", role: "student" };

function row(overrides: Partial<Row> = {}): Row {
  return {
    code: "AMIGOK7M2QW9F",
    tier: "standard",
    durationDays: 90,
    expiresAt: null,
    redeemedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getEntitlementTierFor.mockResolvedValue("free");
  updateMany.mockResolvedValue({ count: 0 });
  findUnique.mockResolvedValue(null);
});

/**
 * ПОДСАДКА КАЖДОЙ СИТУАЦИИ. Слева — состояние мира, справа — имя, которое
 * обязано прозвучать. Ситуации настоящие: три из семи вообще не доходят до
 * `updateMany`, и это видно по вызовам.
 */
const PLANTS: Array<{
  what: string;
  raw: string;
  arrange: () => void;
  expected: string;
}> = [
  {
    what: "в поле ничего не ввели (после нормализации пусто)",
    raw: "  - - ",
    arrange: () => {},
    expected: "empty",
  },
  {
    what: "такого кода в базе нет",
    raw: "AMIGO-XXXX-XXXX",
    arrange: () => {
      updateMany.mockResolvedValue({ count: 0 });
      findUnique.mockResolvedValue(null);
    },
    expected: "not_found",
  },
  {
    what: "код уже погашен",
    raw: "AMIGO-K7M2-QW9F",
    arrange: () => {
      updateMany.mockResolvedValue({ count: 0 });
      findUnique.mockResolvedValue(row({ redeemedAt: new Date(Date.now() - 1000) }));
    },
    expected: "already_redeemed",
  },
  {
    what: "срок годности кода вышел",
    raw: "AMIGO-K7M2-QW9F",
    arrange: () => {
      updateMany.mockResolvedValue({ count: 0 });
      findUnique.mockResolvedValue(row({ expiresAt: new Date(Date.now() - 1000) }));
    },
    expected: "expired",
  },
  {
    what: "код отозван",
    raw: "AMIGO-K7M2-QW9F",
    arrange: () => {
      updateMany.mockResolvedValue({ count: 0 });
      findUnique.mockResolvedValue(row({ revokedAt: new Date(Date.now() - 1000) }));
    },
    expected: "revoked",
  },
  {
    what: "у человека уже есть доступ — код не сжигается",
    raw: "AMIGO-K7M2-QW9F",
    arrange: () => {
      getEntitlementTierFor.mockResolvedValue("standard");
    },
    expected: "already_has_access",
  },
  {
    what: "строка свободна, а UPDATE её не задел — дефект у нас",
    raw: "AMIGO-K7M2-QW9F",
    arrange: () => {
      updateMany.mockResolvedValue({ count: 0 });
      findUnique.mockResolvedValue(row());
    },
    expected: "inconsistent",
  },
];

describe("причина отказа называется своим именем", () => {
  it("подсадок ровно столько, сколько причин, и они покрывают их все", () => {
    // Без этого список подсадок мог бы тихо отстать от типа, и новая
    // причина уехала бы в прод не названной ни разу.
    expect(PLANTS).toHaveLength(ACCESS_CODE_REFUSALS.length);
    expect(new Set(PLANTS.map((p) => p.expected))).toEqual(new Set(ACCESS_CODE_REFUSALS));
  });

  it.each(PLANTS)("$what -> $expected", async ({ raw, arrange, expected }) => {
    arrange();
    const result = await redeemAccessCode(USER, raw);
    expect(result).toEqual({ ok: false, reason: expected });
    // Доступ не выдан ни в одном из семи случаев — иначе «названная
    // причина» была бы украшением поверх выданного доступа.
    expect(extendOrGrantSubscription).not.toHaveBeenCalled();
  });

  it("то же имя уходит в Sentry, а не только на экран", async () => {
    // Панель и экран обязаны говорить про одно событие одно и то же —
    // иначе разбор начинается с выяснения, какую из двух версий читать.
    for (const plant of PLANTS) {
      vi.clearAllMocks();
      getEntitlementTierFor.mockResolvedValue("free");
      updateMany.mockResolvedValue({ count: 0 });
      findUnique.mockResolvedValue(null);
      plant.arrange();
      await redeemAccessCode(USER, plant.raw);
      const calls = captureException.mock.calls;
      expect(calls.length, `${plant.expected}: отчёта нет вовсе`).toBeGreaterThan(0);
      const reported = calls.map(
        ([error, context]) =>
          (context as { tags?: { refusal?: string } } | undefined)?.tags?.refusal ??
          (error as Error).message
      );
      expect(reported, `${plant.expected}: в Sentry ушло другое имя`).toContain(plant.expected);
    }
  });

  it("`inconsistent` — единственная причина, уходящая уровнем error", async () => {
    // Шесть причин из семи описывают жизнь кода и нормальны; седьмая
    // описывает НАШУ поломку, и уровень — единственное, чем это видно в
    // панели без чтения кода.
    const levels = new Map<string, string | undefined>();
    for (const plant of PLANTS) {
      vi.clearAllMocks();
      getEntitlementTierFor.mockResolvedValue("free");
      updateMany.mockResolvedValue({ count: 0 });
      findUnique.mockResolvedValue(null);
      plant.arrange();
      await redeemAccessCode(USER, plant.raw);
      const withTag = captureException.mock.calls.find(
        ([, context]) => (context as { tags?: { refusal?: string } })?.tags?.refusal === plant.expected
      );
      levels.set(plant.expected, (withTag?.[1] as { level?: string } | undefined)?.level);
    }
    expect(levels.get("inconsistent")).toBe("error");
    for (const reason of ACCESS_CODE_REFUSALS) {
      if (reason === "inconsistent") continue;
      expect(levels.get(reason), `${reason} обязана быть info`).toBe("info");
    }
  });
});

describe("человек читает причину на своём языке", () => {
  it("у каждой причины есть своя строка в обеих локалях", () => {
    for (const reason of ACCESS_CODE_REFUSALS) {
      const key = ACCESS_CODE_OUTCOME_MESSAGE_KEY[reason];
      expect(key, `${reason}: нет строки в таблице`).toBeTruthy();
      for (const [name, dict] of [["es", es], ["ru", ru]] as const) {
        const text = dict.profile[key];
        expect(text, `${name}.${key} отсутствует`).toBeTruthy();
        // Не заглушка: подсказка «что делать» длиннее ярлыка.
        expect(text.length, `${name}.${key} слишком короткая, чтобы быть подсказкой`).toBeGreaterThan(30);
      }
    }
  });

  it("тексты РАЗНЫЕ — иначе «названная причина» ничего не меняет на экране", () => {
    // Именно этим было плохо прежнее устройство: три ситуации, один текст.
    for (const [name, dict] of [["es", es], ["ru", ru]] as const) {
      const texts = ACCESS_CODE_REFUSALS.map((r) => dict.profile[ACCESS_CODE_OUTCOME_MESSAGE_KEY[r]]);
      expect(new Set(texts).size, `${name}: два отказа читаются одинаково`).toBe(texts.length);
    }
  });

  it("ни один названный исход не указывает на общий текст-хвост", () => {
    // Дыра, найденная подсадкой 3 при написании этой пробы: таблица могла
    // указать любую СУЩЕСТВУЮЩУЮ строку словаря, и правило «тексты
    // разные» этого не ловило — `accessCodeUnknown` отличается от прочих
    // и длиннее 30 знаков. А смысл его ровно один: «мы не знаем». Исход,
    // у которого имя есть, читать «мы не знаем» не имеет права.
    for (const reason of ACCESS_CODE_REFUSALS) {
      expect(
        ACCESS_CODE_OUTCOME_MESSAGE_KEY[reason],
        `${reason} показывает общий текст вместо своего`
      ).not.toBe("accessCodeUnknown");
    }
  });

  it("`rate_limited` тоже в таблице: у экрана не должно остаться безымянных исходов", () => {
    expect(ACCESS_CODE_OUTCOME_MESSAGE_KEY.rate_limited).toBe("accessCodeRateLimited");
    expect(es.profile.accessCodeRateLimited).toBeTruthy();
    expect(ru.profile.accessCodeRateLimited).toBeTruthy();
  });

  it("КОНТРОЛЬ: слово из адресной строки, не совпавшее ни с чем, исходом не считается", () => {
    // Без этой половины таблица могла бы «покрывать всё», принимая любое
    // слово, и человек, напечатавший `?accessCode=ыыы`, прочитал бы
    // выдуманную причину.
    expect(accessCodeOutcomeFromQuery("not_found")).toBe("not_found");
    expect(accessCodeOutcomeFromQuery("ыыы")).toBeNull();
    expect(accessCodeOutcomeFromQuery("redeemed")).toBeNull();
    expect(accessCodeOutcomeFromQuery(null)).toBeNull();
  });

  it("КОНТРОЛЬ: прежнее слово `unknown` исходом больше не является", () => {
    // Доказывает, что разделение состоялось, а не было дописано рядом со
    // старым словом.
    expect(ACCESS_CODE_REFUSALS).not.toContain("unknown" as never);
    expect(accessCodeOutcomeFromQuery("unknown")).toBeNull();
  });
});
