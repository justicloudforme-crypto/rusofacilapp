/**
 * Удаление тестовых аккаунтов, оставшихся в боевой базе.
 *
 * Зачем. Каждая ручная проверка состояния «залогинен, но без подписки»
 * заводила на проде живую строку `User`: три `e2e-manual-check-*@example.test`
 * (27.08 ×2, 03.09) и пять `oxxo-test-*@example.com` от проверки платёжного
 * пути. Удалять их руками нечем: `/api/auth/request-account-deletion`
 * шлёт письмо на несуществующий адрес, а SQL по живой базе — ровно тот
 * класс операции, из-за которого этот скрипт и написан.
 *
 * Состояния «залогинен без подписки» этот скрипт НЕ решает — его решает
 * `loginWithoutSubscription` в `e2e/helpers/auth.ts` и
 * `e2e/word-games-access.spec.ts`: новых строк на проде заводить больше
 * не нужно.
 *
 * Три предохранителя, и каждый закрывает свою ошибку:
 *
 * 1. **Список кандидатов задан шаблонами адресов, а не аргументом.**
 *    Никакой `--only=` не может удалить строку, чей адрес не подходит ни
 *    под один шаблон — опечатка в id не превращается в удаление живого
 *    ученика, она превращается в отказ.
 * 2. **`ALWAYS_KEEP` сильнее всего остального.** `audit-1788032054482@example.com`
 *    подходит под шаблон, но у него живая подписка `standard`, выданная
 *    владельцем вручную, и на нём держится прогон долга 17 и проверка
 *    уровня standard (PROGRESS.md). Он не удаляется даже с `--force`.
 * 3. **За аккаунтом с данными нужен `--force`.** Схема удаляет
 *    прогресс/дни/подписки каскадом (schema.prisma, onDelete: Cascade), и
 *    аккаунт, у которого эти строки есть, скорее живой, чем тестовый.
 *    Пустой удаляется без `--force`.
 *
 * Порядок работы (только владелец, ключ на запись):
 *
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
 *     npm run db:delete-test-accounts -- --dry-run
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
 *     npm run db:delete-test-accounts -- --only=<id>,<id>
 *
 *   npm run db:delete-test-accounts:self-test   # контроль правил, без базы
 *
 * Без `--dry-run` и без `--only=` скрипт не делает ничего: «удалить всё,
 * что нашёл» — не режим, а способ однажды удалить лишнее.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";

/** Адреса, которые вообще могут быть удалены этим скриптом. Проверяются
 * по строке целиком, а не поиском подстроки: `%example.test%` внутри
 * адреса живого ученика — не повод его удалить. */
export const TEST_EMAIL_PATTERNS: RegExp[] = [
  /^e2e-manual-check-[\w.-]+@example\.test$/,
  /^e2e-\d+-[\w]+@example\.test$/,
  /^oxxo-test-\d+@example\.com$/,
  /^audit-(empty-)?\d+@example\.com$/,
];

/** Подходит под шаблон, но не удаляется никогда — см. предохранитель 2. */
export const ALWAYS_KEEP: string[] = ["audit-1788032054482@example.com"];

export function isDeletableTestEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (ALWAYS_KEEP.includes(normalized)) return false;
  return TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export interface Candidate {
  id: string;
  email: string;
  createdAt: Date;
  /** Сколько строк уедет каскадом, по таблицам. */
  attached: Record<string, number>;
}

export function attachedTotal(candidate: Candidate): number {
  return Object.values(candidate.attached).reduce((sum, n) => sum + n, 0);
}

/** Что именно скрипт согласен сделать с запрошенными id. Отделено от
 * работы с базой, чтобы правило проверялось контролем, а не прогоном по
 * боевой базе. */
export function planDeletion(
  candidates: Candidate[],
  onlyIds: string[],
  force: boolean,
): { deleting: Candidate[]; refusals: string[] } {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const deleting: Candidate[] = [];
  const refusals: string[] = [];

  for (const id of onlyIds) {
    const candidate = byId.get(id);
    if (!candidate) {
      refusals.push(`${id} — не в списке кандидатов (нет такой строки или её адрес не тестовый)`);
      continue;
    }
    if (attachedTotal(candidate) > 0 && !force) {
      const detail = Object.entries(candidate.attached)
        .map(([table, n]) => `${table}=${n}`)
        .join(" ");
      refusals.push(`${id} (${candidate.email}) — за ним данные (${detail}); нужен --force`);
      continue;
    }
    deleting.push(candidate);
  }
  return { deleting, refusals };
}

/* ------------------------------------------------------------------ */
/* Контроль правил — без базы                                          */
/* ------------------------------------------------------------------ */

function selfTest(): boolean {
  let ok = true;
  const say = (pass: boolean, what: string) => {
    console.log(`  ${pass ? "OK  " : "ПРОВАЛ"} ${what}`);
    if (!pass) ok = false;
  };

  console.log("Позитивный контроль:");
  say(isDeletableTestEmail("e2e-manual-check-799-1788477184@example.test"), "ручной тестовый аккаунт удаляется");
  say(isDeletableTestEmail("oxxo-test-1787799605799@example.com"), "аккаунт проверки OXXO удаляется");

  console.log("Негативный контроль — обязан отказать:");
  say(!isDeletableTestEmail("justicloudforme@icloud.com"), "живой аккаунт владельца не удаляется");
  say(!isDeletableTestEmail("alexandermorgan77777@gmail.com"), "живой подписчик не удаляется");
  say(
    !isDeletableTestEmail("student@real.com.e2e-manual-check-1@example.test.example.org"),
    "адрес, лишь СОДЕРЖАЩИЙ шаблон, не удаляется",
  );
  say(!isDeletableTestEmail("audit-1788032054482@example.com"), "аккаунт из ALWAYS_KEEP не удаляется");

  const withData: Candidate = {
    id: "with-data",
    email: "audit-1788032054482@example.com",
    createdAt: new Date(0),
    attached: { LessonProgress: 4, Subscription: 1 },
  };
  const empty: Candidate = { id: "empty", email: "e2e-manual-check-1@example.test", createdAt: new Date(0), attached: {} };

  const plainRun = planDeletion([withData, empty], ["with-data", "empty"], false);
  say(plainRun.deleting.length === 1 && plainRun.deleting[0].id === "empty", "без --force уходит только пустой аккаунт");
  say(plainRun.refusals.length === 1, "аккаунт с данными без --force попадает в отказы");

  const forced = planDeletion([withData, empty], ["with-data"], true);
  say(forced.deleting.length === 1, "с --force аккаунт с данными удаляется");

  const unknown = planDeletion([empty], ["не-существует"], true);
  say(unknown.deleting.length === 0 && unknown.refusals.length === 1, "чужой id не удаляется даже с --force");

  console.log(ok ? "\nКонтроль пройден." : "\nКОНТРОЛЬ ПРОВАЛЕН.");
  return ok;
}

/* ------------------------------------------------------------------ */

/** Таблицы, которые уедут каскадом вместе с аккаунтом (schema.prisma). */
const CHILD_TABLES: Array<[string, string]> = [
  ["StudyDay", "userId"],
  ["Subscription", "userId"],
  ["LessonProgress", "userId"],
  ["ExamAttempt", "userId"],
  ["VoiceSubmission", "userId"],
  ["FlashcardProgress", "userId"],
  ["StoryReadingProgress", "userId"],
  ["UserBadge", "userId"],
  ["ReferralReward", "referrerUserId"],
  ["Group", "ownerUserId"],
  ["GroupMember", "userId"],
  ["WordGameProgress", "userId"],
];

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main(): Promise<void> {
  if (process.argv.includes("--self-test")) {
    process.exitCode = selfTest() ? 0 : 1;
    return;
  }

  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const onlyIds = (arg("only") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!dryRun && onlyIds.length === 0) {
    console.error(
      "Нечего делать: нужен либо --dry-run (показать список), либо --only=<id>,<id> (удалить названные).\n" +
        "Режима «удалить всё, что нашлось» здесь нет намеренно.",
    );
    process.exitCode = 1;
    return;
  }

  const dbUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaLibSql({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = new PrismaClient({ adapter });
  // Имя базы, а не URL с ключом: строка попадает в вывод, который потом
  // пересказывают в отчёте.
  const label = dbUrl.startsWith("libsql://") ? dbUrl.slice("libsql://".length).split(".")[0] : dbUrl;
  console.log(`База: ${label}\n`);

  try {
    const users = await db.user.findMany({ select: { id: true, email: true, createdAt: true } });
    const candidates: Candidate[] = [];
    for (const user of users) {
      if (!isDeletableTestEmail(user.email)) continue;
      const attached: Record<string, number> = {};
      for (const [table, column] of CHILD_TABLES) {
        const rows = await db.$queryRawUnsafe<Array<{ c: number }>>(
          `SELECT COUNT(*) AS c FROM "${table}" WHERE ${column} = ?`,
          user.id,
        );
        const count = Number(rows[0]?.c ?? 0);
        if (count > 0) attached[table] = count;
      }
      candidates.push({ ...user, attached });
    }
    candidates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    console.log(`Всего аккаунтов в базе: ${users.length}`);
    console.log(`Из них подходят под шаблоны тестовых: ${candidates.length}`);
    console.log(`Защищены от удаления (ALWAYS_KEEP): ${ALWAYS_KEEP.join(", ")}\n`);
    for (const c of candidates) {
      const detail = attachedTotal(c) === 0
        ? "за ним ничего нет"
        : Object.entries(c.attached).map(([t, n]) => `${t}=${n}`).join(" ");
      console.log(`  ${c.id}  ${c.email}  ${c.createdAt.toISOString().slice(0, 10)}  ${detail}`);
    }

    if (dryRun) {
      console.log(`\n--dry-run: ничего не удалено. Удалить названные:\n  npm run db:delete-test-accounts -- --only=${candidates.map((c) => c.id).join(",")}`);
      return;
    }

    const { deleting, refusals } = planDeletion(candidates, onlyIds, force);
    console.log("");
    for (const r of refusals) console.error(`  ОТКАЗ  ${r}`);
    if (deleting.length === 0) {
      console.error("\nУдалять нечего — ни один из названных id не прошёл правила.");
      process.exitCode = 1;
      return;
    }

    for (const c of deleting) {
      await db.user.delete({ where: { id: c.id } });
      console.log(`  УДАЛЁН  ${c.id}  ${c.email}`);
    }
    console.log(`\nУдалено аккаунтов: ${deleting.length}, отказов: ${refusals.length}.`);
    if (refusals.length > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  void main();
}
