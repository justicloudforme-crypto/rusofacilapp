/**
 * Sets WordGamePuzzle.premiumOnly — the "standard" (monthly/annual)
 * subscriber loses access to, per the access-tier policy: ~30-35% of each
 * (type, level) ladder is Premium (lifetime)-exclusive.
 *
 * Unlike stories (see set-premium-only-stories.ts), word games DO have a
 * real, deterministic difficulty signal to split on: `sequence` — a
 * puzzle's rung number within its (type, level) ladder. Confirmed by
 * inspecting the data: every `curved` (★) puzzle already sits at the very
 * end of its ladder's sequence range (e.g. WORD_SEARCH/A1: sequences
 * 1-142 are non-curved, 143-196 are curved) — curved was already, by
 * construction, "the hardest tail". This sets premiumOnly for the top
 * PREMIUM_SHARE of each ladder by sequence, which necessarily includes
 * every curved puzzle (already the top ~16% on average) plus enough of
 * the hardest non-curved rungs just below them to reach the target band
 * overall (~32% at this share).
 *
 * ЭТОТ СКРИПТ БОЛЬШЕ НЕ ПИШЕТ ПО УМОЛЧАНИЮ (обезврежен 02.09.2026,
 * PROGRESS.md 7.84). Причина — в данных, а не в коде: разгрузка филвордов
 * (7.78-7.83) дописывает в ХВОСТ лестницы новые строки, поэтому «верхние
 * 32% по номеру рунга» после неё указывают на другие строки, и прогон,
 * который раньше был идемпотентным, снял бы платность с двадцати живых
 * пазлов. Защита — три слоя, все в коде:
 *
 *   1. по умолчанию — только показ (`--dry-run` подразумевается);
 *   2. запись — только с явным `--apply`;
 *   3. ОТКАЗ выполняться, если прогон снял бы платность хотя бы с одной
 *      существующей строки, — и в режиме показа тоже, со списком строк.
 *      Отказ не снимается флагом: снятие платности у живого пазла — это
 *      потеря оплаченного доступа, и решать это должен человек, а не
 *      флаг в командной строке.
 *
 * Сама доля Premium (PREMIUM_SHARE) и правило платности не менялись.
 *
 *   npm run db:set-premium-only-word-games                # показать, ничего не писать
 *   npm run db:set-premium-only-word-games -- --apply     # записать
 *   npm run db:set-premium-only-word-games -- --self-test # позитивный контроль, без базы
 */
import "dotenv/config";
import { db } from "../src/lib/db";

import { isEntryPoint } from "../src/lib/entry-point";
import {
  PREMIUM_SHARE,
  planLadder,
  wouldRemovePremium,
  type LadderPlan,
  type PremiumPlanRow,
} from "../src/lib/word-games/premium-plan";

const APPLY = process.argv.includes("--apply");
const SELF_TEST = process.argv.includes("--self-test");

function describe(type: string, level: string, row: PremiumPlanRow): string {
  return `${type}/${level}/${row.sequence} (${row.id})`;
}

/** Печатает отказ и возвращает true, если прогон снимал бы платность. */
function refuseIfItWouldRemovePremium(plans: LadderPlan[]): boolean {
  if (!wouldRemovePremium(plans)) return false;
  const rows = plans.flatMap((p) => p.toFree.map((r) => describe(p.type, p.level, r)));
  console.error(
    `\nОТКАЗ: этот прогон снял бы платность с ${rows.length} существующих строк.\n` +
      `  Так бывает, когда лестница выросла с хвоста (разгрузка дописывает новые\n` +
      `  номера), и «верхние ${(PREMIUM_SHARE * 100).toFixed(0)}% по номеру» указывают уже на другие строки.\n` +
      `  Ниже — те, кто потерял бы платность. Ничего не записано.`,
  );
  for (const r of rows) console.error(`  СНЯЛ БЫ ПЛАТНОСТЬ  ${r}`);
  return true;
}

/**
 * Позитивный контроль: подсаженная лестница, на которой скрипт ОБЯЗАН
 * отказаться, и рядом — та, на которой он обязан промолчать. База не
 * нужна: правило целиком в planLadder.
 */
function selfTest(): boolean {
  const untouched = Array.from({ length: 100 }, (_, i) => ({
    id: `p${i + 1}`,
    sequence: i + 1,
    premiumOnly: i + 1 >= 69,
  }));
  const grownTail = [
    ...untouched,
    ...Array.from({ length: 10 }, (_, i) => ({ id: `t${i + 1}`, sequence: 101 + i, premiumOnly: false })),
  ];

  const cases: { label: string; plan: LadderPlan; mustRefuse: boolean }[] = [
    {
      label: "нетронутая лестница — обязан промолчать",
      plan: planLadder("WORD_SEARCH", "B2", untouched),
      mustRefuse: false,
    },
    {
      label: "лестница, доросшая с хвоста (подсадка) — обязан отказаться",
      plan: planLadder("WORD_SEARCH", "B2", grownTail),
      mustRefuse: true,
    },
  ];

  let ok = true;
  console.log("Позитивный контроль (база не читается):");
  for (const c of cases) {
    const refuses = c.plan.toFree.length > 0;
    const passed = refuses === c.mustRefuse;
    ok &&= passed;
    console.log(
      `  ${passed ? "OK  " : "ПРОВАЛ"} ${c.label} — снял бы платность с ${c.plan.toFree.length} строк` +
        (c.plan.toFree.length ? ` (${c.plan.toFree.map((r) => r.sequence).join(", ")})` : ""),
    );
  }
  return ok;
}

async function main() {
  if (SELF_TEST) {
    if (!selfTest()) {
      console.error("\nКонтроль не пройден — защите верить нельзя.");
      process.exitCode = 1;
    }
    return;
  }

  const groups = await db.wordGamePuzzle.groupBy({ by: ["type", "level"] });

  const plans: LadderPlan[] = [];
  for (const { type, level } of groups) {
    const rows = await db.wordGamePuzzle.findMany({
      where: { type, level },
      select: { id: true, sequence: true, premiumOnly: true },
      orderBy: { sequence: "desc" },
    });
    plans.push(planLadder(type, level, rows, PREMIUM_SHARE));
  }

  const total = plans.reduce((s, p) => s + p.total, 0);
  const premiumTotal = plans.reduce((s, p) => s + p.premiumCount, 0);
  const toPremium = plans.reduce((s, p) => s + p.toPremium.length, 0);
  const toFree = plans.reduce((s, p) => s + p.toFree.length, 0);

  console.log(
    `Лестниц: ${plans.length}. Строк: ${total}. Платными стали бы ${premiumTotal} ` +
      `(${((premiumTotal / total) * 100).toFixed(1)}%, доля ${PREMIUM_SHARE}).`,
  );
  console.log(`  поставил бы платность: ${toPremium}`);
  console.log(`  снял бы платность:     ${toFree}`);

  // Проверка идёт ДО развилки «показ или запись»: отказ обязан быть виден
  // и в показе, иначе человек добавит --apply, не увидев причины.
  if (refuseIfItWouldRemovePremium(plans)) {
    process.exitCode = 1;
    return;
  }

  if (!APPLY) {
    console.log(
      `\n--dry-run (по умолчанию): ничего не записано. ${toPremium} строк изменилось бы.\n` +
        `  Записать: npm run db:set-premium-only-word-games -- --apply`,
    );
    return;
  }

  let changed = 0;
  for (const plan of plans) {
    for (const row of plan.toPremium) {
      await db.wordGamePuzzle.update({ where: { id: row.id }, data: { premiumOnly: true } });
      changed++;
    }
  }
  console.log(
    `✔ premiumOnly set: ${changed} row(s) changed. ${premiumTotal}/${total} puzzles ` +
      `(${((premiumTotal / total) * 100).toFixed(1)}%) are now Premium-exclusive.`,
  );
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
