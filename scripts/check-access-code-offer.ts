/**
 * ПРИГЛАШЕНИЕ ПОГАСИТЬ КОД ВИДИТ ТОЛЬКО ТОТ, КОМУ ЕГО ЕСТЬ КУДА ПРИМЕНИТЬ
 * — долг 228, решение владельца 16.09.2026, заход 7.203, часть 1.
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Снято владельцем на живом телефоне 17.09.2026: у аккаунта Vasya
 * (подписка standard, отменена, доступ до конца оплаченного периода) в
 * кабинете на вкладке «Подписка» стоит блок «Код доступа» — в обеих
 * локалях. Ввести код он может, погасить — нет: `redeemAccessCode`
 * отказывает при ЛЮБОМ живом доступе и отвечает «У вас уже есть доступ,
 * код тратить не нужно». Заход 7.202 спрятал блок только от верхнего
 * разряда (сотрудник, владелец, пожизненный), и между двумя условиями
 * остался жить ровно один разряд — standard.
 *
 * Решение владельца: блок показывается ТОЛЬКО аккаунту без действующего
 * доступа. Продления доступа кодом не делаем.
 *
 * ====================================================================
 * ЧТО ИМЕННО СТЕРЕЖЁТСЯ, И ПОЧЕМУ СТОРОЖ ДВУСТОРОННИЙ
 * ====================================================================
 *
 * Правило легко «выполнить» так, что станет хуже: спрятать блок у всех.
 * Поэтому проверок две, и они направлены в разные стороны.
 *
 *   1. ВЫЧИСЛЕНИЕ, а не текст. Настоящая функция `canRedeemAccessCode`
 *      исполняется на всех трёх разрядах: у `free` она обязана сказать
 *      «показать», у `standard` и `premium` — «скрыть». Разряд
 *      отменённой-но-действующей подписки (`standard`) приходит сюда
 *      из правила подписок и проверяется прогоном
 *      `src/lib/access-code-offer.test.ts`: `subscription.ts` серверный,
 *      и под `tsx` его не импортировать — это честная граница, а не
 *      недосмотр.
 *   2. ОДНО ОПРЕДЕЛЕНИЕ НА ДВА МЕСТА. Кабинет обязан показывать блок под
 *      `canRedeemAccessCode(tier)`, маршрут погашения — отказывать под
 *      её же отрицанием, и ни один из них не имеет права писать своё
 *      выражение (`tier !== "free"`, `isPremiumUser`, `hasAnyAccess`
 *      по месту). Сама функция объявлена ровно один раз.
 *
 * ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ (`--plant`) — в том же задании: шесть подсадок,
 * каждая из которых возвращает одну из известных поломок, включая
 * дословное состояние 7.202 (`{!isPremiumUser && (`) и «спрятать у
 * всех». Плюс отрицательный контроль на здоровых исходниках.
 *
 *   npx tsx scripts/check-access-code-offer.ts
 *   npx tsx scripts/check-access-code-offer.ts --plant
 */
import { readFileSync } from "node:fs";
import { canRedeemAccessCode } from "../src/lib/access-code-offer";
import { isEntryPoint } from "../src/lib/entry-point";

const PAGE = "src/app/[lang]/profile/page.tsx";
const REDEEM = "src/lib/access-code.ts";
const RULE = "src/lib/access-code-offer.ts";

type Sources = Record<string, string>;
type Tier = "free" | "standard" | "premium";
type OfferRule = (tier: Tier) => boolean;

const read = (path: string) => readFileSync(path, "utf8");

/** Форма — ВНУТРИ куска, открытого условием.
 *
 * Считается не регулярным выражением «условие где-то раньше формы», а
 * границами: от условия до ПЕРВОГО закрытия фрагмента `</>`; поле обязано
 * лежать в этом промежутке. Первая редакция правила границы не считала и
 * молчала на подсадке, где условие закрывалось строкой выше формы.
 */
function formIsInsideGate(page: string): boolean {
  const gate = page.indexOf("{canRedeemAccessCode(tier) && (");
  if (gate === -1) return false;
  const fragment = page.indexOf("<>", gate);
  if (fragment === -1 || fragment > gate + 80) return false;
  const closes = page.indexOf("</>", fragment);
  const form = page.indexOf('action="/api/access-code/redeem"', fragment);
  return form !== -1 && (closes === -1 || form < closes);
}

/** Комментарий этого захода называет в тексте ровно те выражения, которые
 * правило ищет. Сторож, читающий объяснение вместо решения, зелен на
 * сломанном коде — на этом в проекте попадались дважды (7.196, 7.202). */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/** Вторая половина: не текст, а ответ настоящей функции. Разряды
 * перечислены здесь, а не взяты из типа: список, который сам себя
 * выводит из кода, замолчит вместе с кодом. */
const EXPECTED: Array<{ tier: Tier; offer: boolean; who: string }> = [
  { tier: "free", offer: true, who: "аккаунт без действующего доступа" },
  { tier: "standard", offer: false, who: "подписчик standard (в том числе отменённый с доступом до конца периода)" },
  { tier: "premium", offer: false, who: "пожизненный, сотрудник, владелец" },
];

/** Правило передаётся параметром, а не берётся из импорта по месту, ровно
 * ради подсадки: загруженную функцию строкой не подменить, и без этого
 * входа первая половина сторожа осталась бы непроверяемой. По умолчанию —
 * настоящая. */
export function judge(sources: Sources, offerRule: OfferRule = canRedeemAccessCode): string[] {
  const problems: string[] = [];

  // --- 1. Правило исполняется, а не пересказывается -------------------
  for (const { tier, offer, who } of EXPECTED) {
    const actual = offerRule(tier);
    if (actual !== offer) {
      problems.push(
        `правило «кому показать поле кода» отвечает на разряде ${tier} «${actual ? "показать" : "скрыть"}», ` +
          `а обязано «${offer ? "показать" : "скрыть"}»: это ${who}`,
      );
    }
  }

  // --- 2. Кабинет спрашивает именно её -------------------------------
  //
  // Проверяется не наличие строки где-нибудь в файле, а то, что САМО ПОЛЕ
  // ввода лежит внутри открытого ею куска разметки: условие, стоящее в
  // файле рядом с формой, но не вокруг неё, — это ровно тот сторож, что
  // зелен на сломанной странице.
  const page = withoutComments(sources[PAGE]);
  if (!page.includes("{canRedeemAccessCode(tier) && (")) {
    problems.push(
      `${PAGE}: блок «Код доступа» стоит не под общим правилом — он обязан открываться ` +
        `выражением canRedeemAccessCode(tier), тем же, которым отказывает маршрут погашения`,
    );
  } else if (!formIsInsideGate(page)) {
    problems.push(
      `${PAGE}: условие canRedeemAccessCode(tier) в файле есть, но поле ввода кода лежит НЕ внутри него — ` +
        `подписчик standard снова увидит форму, которой не сможет воспользоваться`,
    );
  }
  // И обратная сторона: ответ маршрута обязан показываться и тому, кто
  // только что перестал быть бесплатным. Успешное погашение само делает
  // человека платным, и сообщение «Доступ открыт» под тем же условием, что
  // и форма, не показалось бы никогда.
  if (!page.includes("{(canRedeemAccessCode(tier) || accessCodeOutcome !== null) && (")) {
    problems.push(
      `${PAGE}: раздел кода доступа открывается без учёта ответа маршрута — человек, погасивший код, ` +
        `увидит пустоту вместо «Доступ открыт»: погашение само делает его платным`,
    );
  }
  if (/\{!isPremiumUser && \(/.test(page)) {
    problems.push(
      `${PAGE}: блок «Код доступа» снова закрыт признаком верхнего разряда (состояние 7.202) — ` +
        `подписчик standard увидит поле, которым не сможет воспользоваться`,
    );
  }

  // --- 3. Маршрут погашения спрашивает её же -------------------------
  const redeem = withoutComments(sources[REDEEM]);
  if (!redeem.includes("if (!canRedeemAccessCode(tier))")) {
    problems.push(
      `${REDEEM}: отказ по уже имеющемуся доступу написан своим выражением — он обязан идти ` +
        `через !canRedeemAccessCode(tier), иначе условия кабинета и маршрута разойдутся молча`,
    );
  }
  if (/tier\s*!==\s*"free"/.test(redeem)) {
    problems.push(
      `${REDEEM}: в решении о погашении снова стоит дословное tier !== "free" — ровно эта копия ` +
        `правила и разошлась с кабинетом (долг 228)`,
    );
  }

  // --- 4. Определение — одно -----------------------------------------
  const rule = withoutComments(sources[RULE]);
  const declared = [...rule.matchAll(/export function canRedeemAccessCode/g)].length;
  if (declared !== 1) {
    problems.push(`${RULE}: правило объявлено ${declared} раз(а), а оно обязано быть объявлено ровно один`);
  }
  const elsewhere = [PAGE, REDEEM].filter((file) =>
    /function canRedeemAccessCode|const canRedeemAccessCode\s*=/.test(withoutComments(sources[file])),
  );
  for (const file of elsewhere) {
    problems.push(`${file}: у правила завелась вторая копия по месту — две копии расходятся молча`);
  }

  return problems;
}

export async function main(): Promise<number> {
  const plant = process.argv.includes("--plant");
  const sources: Sources = Object.fromEntries([PAGE, REDEEM, RULE].map((f) => [f, read(f)]));

  if (plant) {
    let ok = judge(sources).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые исходники (отрицательный контроль)`);

    const plants: Array<[string, Sources]> = [
      [
        "состояние 7.202 дословно: блок закрыт только верхним разрядом, standard видит поле",
        { [PAGE]: sources[PAGE].replace("{canRedeemAccessCode(tier) && (", "{!isPremiumUser && (") },
      ],
      [
        "блок «Код доступа» снова показывается всем",
        {
          [PAGE]: sources[PAGE]
            .replace("      {(canRedeemAccessCode(tier) || accessCodeOutcome !== null) && (\n      <section", "      <section")
            .replace("        {canRedeemAccessCode(tier) && (\n        <>\n", "        <>\n"),
        },
      ],
      [
        "блок спрятан у ВСЕХ — бесплатный больше не видит поля вовсе",
        { [PAGE]: sources[PAGE].replace("{canRedeemAccessCode(tier) && (", "{false && (") },
      ],
      [
        "условие осталось в файле, но закрылось ДО поля ввода (сторож рядом, а не вокруг)",
        {
          [PAGE]: sources[PAGE].replace(
            '{dict.profile.accessCodeIntro}</p>\n\n        <form action="/api/access-code/redeem"',
            '{dict.profile.accessCodeIntro}</p>\n        </>\n        )}\n        <form action="/api/access-code/redeem"',
          ),
        },
      ],
      [
        "ответ маршрута спрятан вместе с приглашением — погасивший код увидит пустоту",
        {
          [PAGE]: sources[PAGE].replace(
            "{(canRedeemAccessCode(tier) || accessCodeOutcome !== null) && (",
            "{canRedeemAccessCode(tier) && (",
          ),
        },
      ],
      [
        "маршрут погашения вернулся к своей копии правила",
        { [REDEEM]: sources[REDEEM].replace("if (!canRedeemAccessCode(tier))", 'if (tier !== "free")') },
      ],
      [
        "правило вывернуто: поле предлагается тому, у кого доступ уже есть",
        { [RULE]: sources[RULE].replace('return tier === "free";', 'return tier !== "free";') },
      ],
      [
        "правило ослаблено до верхнего разряда — то же 7.202, но в самом правиле",
        { [RULE]: sources[RULE].replace('return tier === "free";', 'return tier !== "premium";') },
      ],
    ];

    // Подсадки в САМО правило — не в текст, а в исполняемую функцию: это
    // единственный способ проверить, что первая половина сторожа вообще
    // умеет краснеть.
    const rulePlants: Array<[string, OfferRule]> = [
      ["правило в памяти вывернуто: поле предлагается имеющему доступ", (tier) => tier !== "free"],
      ["правило в памяти ослаблено до верхнего разряда (7.202)", (tier) => tier !== "premium"],
      ["правило в памяти прячет поле у всех", () => false],
    ];
    let rulesCaught = 0;
    for (const [name, rule] of rulePlants) {
      const found = judge(sources, rule);
      const hit = found.length > 0;
      if (hit) rulesCaught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}` + (hit ? ` (${found[0]})` : ""));
    }
    ok &&= rulesCaught === rulePlants.length;

    let caught = 0;
    for (const [name, patch] of plants) {
      // Подсадка обязана ИЗМЕНИТЬ исходник: `replace`, не нашедший своей
      // строки, вернул бы файл как есть, и «поймано» было бы поймано на
      // здоровом коде.
      const changed = Object.entries(patch).every(([file, text]) => text !== sources[file]);
      // Подсадки в сам файл правила меняют ТЕКСТ, а не уже загруженную
      // функцию: их ловит статическая половина, и она обязана ловить их
      // именно как расхождение с ожидаемой строкой правила.
      const patched: Sources = { ...sources, ...patch };
      const found = judge(patched).concat(rulePlantProblems(patch, sources));
      const hit = changed && found.length > 0;
      if (hit) caught++;
      console.log(
        `  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}` + (hit ? ` (${found[0]})` : changed ? "" : " [подсадка НЕ ИЗМЕНИЛА файл]"),
      );
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:access-code-offer --plant — ${caught} из ${plants.length} подсадок в исходники, ` +
            `${rulesCaught} из ${rulePlants.length} подсадок в само правило, 1 из 1 отрицательный контроль`
        : `check:access-code-offer --plant — FAILED (${caught} из ${plants.length}, правило ${rulesCaught} из ${rulePlants.length})`,
    );
    return ok ? 0 : 1;
  }

  const problems = judge(sources);
  if (problems.length) {
    console.error("ПРИГЛАШЕНИЕ ПОГАСИТЬ КОД ДОСТУПА:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    "check:access-code-offer — поле кода показывается только разряду free (проверено исполнением правила " +
      "на всех трёх разрядах), кабинет и маршрут погашения спрашивают одну и ту же функцию, и объявлена она " +
      "один раз. Отменённая подписка с неистёкшим периодом — это разряд standard, и её случай закрыт " +
      "прогоном src/lib/access-code-offer.test.ts. Контроль — --plant.",
  );
  return 0;
}

/** Текст самого правила сторож судит отдельно: загруженную функцию строкой
 * не подменить, а подмена её ИСХОДНИКА — ровно тот случай, который обязан
 * краснеть. Сверяется с единственной законной формой тела. */
function rulePlantProblems(patch: Sources, sources: Sources): string[] {
  if (!patch[RULE]) return [];
  return withoutComments(patch[RULE]).includes('return tier === "free";')
    ? []
    : [`${RULE}: тело правила стало не «tier === "free"» — это и есть то самое второе определение доступа`];
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
