import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

// Guards against the outage from 2026-08-27: this project has no
// prisma/migrations folder (push-based workflow — `prisma db push`
// against dev.db only). At least two recent commits (47a7847 for
// Story.descriptionRu, and an earlier one for Story.readingMinutes) added
// nullable columns to schema.prisma that were only ever pushed to local
// dev.db, never to production Turso — so `/[lang]` and `/[lang]/stories`
// 500'd site-wide (both locales; Prisma selects all scalar columns by
// default) the moment that code deployed.
//
// Rather than hand-list individual columns (which just repeats this
// outage the next time someone adds a field and forgets to push), this
// parses schema.prisma directly, diffs each model's scalar fields against
// the real columns in production Turso (via PRAGMA table_info), and adds
// whatever is missing. It never drops/renames/alters an existing column —
// only ADD COLUMN for a field that's in the schema but not the DB — so it
// can't cause data loss; at worst it's a no-op.
//
// Runs at the start of `npm run build` / vercel.json's buildCommand,
// which is the only place a real TURSO_AUTH_TOKEN is available to
// non-runtime code (see PROGRESS.md — local tooling can't hold that
// secret in this environment). No-ops locally (no TURSO_DATABASE_URL).

const SCALAR_TYPE_TO_SQLITE: Record<string, string> = {
  String: "TEXT",
  Int: "INTEGER",
  Float: "REAL",
  Boolean: "INTEGER",
  DateTime: "TEXT",
  Json: "TEXT",
  BigInt: "INTEGER",
};

interface FieldDef {
  name: string;
  sqlType: string;
  /** `false` when the field is declared with `?`. Не используется самим
   * добавлением колонок (оно всегда добавляет nullable — см. комментарий
   * к ALTER TABLE ниже), но именно на этом поле стоит сверка
   * `scripts/check-schema-drift.ts`: расхождение «в схеме NOT NULL, в базе
   * nullable» не видел никто, и `Story.topic` прожил так до 08.09.2026
   * с 325 строками NULL при `String @default("other")`. */
  nullable: boolean;
  /** Содержимое `@default(...)` как оно написано в схеме, или null.
   * Сырой текст, не разобранный: разбор — дело сверки, а не парсера. */
  defaultRaw: string | null;
}

interface IndexDef {
  /** Имя, которое дала бы этому индексу миграция Prisma. */
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
}

interface ModelDef {
  name: string;
  fields: FieldDef[];
  indexes: IndexDef[];
}

/** Reads one model body by COUNTING BRACES rather than by matching up to
 * the next "}".
 *
 * The previous version used /model\s+(\w+)\s*{([^}]*)}/ and truncated a
 * model at the first closing brace that appeared anywhere inside it —
 * including inside a doc comment. WordGamePuzzle documents its JSON
 * columns as `{ size: number, grid: string[][] }` and `{ word, clue, row,
 * col, ... }`, so this script could only ever see 7 of that model's 11
 * scalar fields. Every field declared after those comments was invisible,
 * which meant a new column there was silently never added to production.
 *
 * That is not hypothetical: `updatedAt` was added to WordGamePuzzle at the
 * end of the model on 02.09.2026, this script skipped it, and sitemap.ts —
 * which selects it — returned HTTP 500 for the whole file on production
 * until the column was added by hand. A sitemap that 500s is invisible to
 * a crawler, so the fix for THAT outage is this parser, not the one
 * column. */
function modelBodies(schemaText: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  const header = /model\s+(\w+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = header.exec(schemaText))) {
    let depth = 1;
    let i = header.lastIndex;
    while (i < schemaText.length && depth > 0) {
      if (schemaText[i] === "{") depth++;
      else if (schemaText[i] === "}") depth--;
      i++;
    }
    out.push({ name: match[1], body: schemaText.slice(header.lastIndex, i - 1) });
    header.lastIndex = i;
  }
  return out;
}

/** Содержимое `@default(...)` со СЧЁТОМ скобок, а не первой закрывающей.
 * `@default(now())` и `@default(cuid())` — самые обычные значения в этой
 * схеме, и регулярка `\(([^)]*)\)` обрывала их на «now(» и «cuid(», после
 * чего сверка дефолтов рапортовала 21 ложное расхождение подряд. Ровно та
 * же ошибка, что уже стоила этому файлу четырёх невидимых полей
 * (см. modelBodies выше). */
function readDefault(attributes: string): string | null {
  const at = attributes.indexOf("@default(");
  if (at === -1) return null;
  let depth = 1;
  let i = at + "@default(".length;
  const start = i;
  while (i < attributes.length && depth > 0) {
    if (attributes[i] === "(") depth += 1;
    else if (attributes[i] === ")") depth -= 1;
    i += 1;
  }
  return depth === 0 ? attributes.slice(start, i - 1).trim() : null;
}

function parseSchema(schemaText: string): ModelDef[] {
  const models: ModelDef[] = [];

  for (const { name: modelName, body } of modelBodies(schemaText)) {
    const fields: FieldDef[] = [];

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;

      // e.g. "descriptionRu String?" / "readingMinutes Int?" / "id String @id @default(cuid())"
      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\?|\[\])?/);
      if (!fieldMatch) continue;
      const [, fieldName, prismaType, modifier] = fieldMatch;

      // Relation fields reference another model (capitalized custom type not
      // in our scalar map) or are lists — both are relations, not columns.
      if (modifier === "[]") continue;
      const sqlType = SCALAR_TYPE_TO_SQLITE[prismaType];
      if (!sqlType) continue;

      // Атрибуты берутся из части строки ПОСЛЕ типа: иначе `@default` из
      // соседнего поля, попавшего в ту же строку комментария, приписался
      // бы этому.
      const attributes = line.slice(fieldMatch[0].length);

      fields.push({
        name: fieldName,
        sqlType,
        nullable: modifier === "?",
        defaultRaw: readDefault(attributes),
      });
    }

    models.push({ name: modelName, fields, indexes: parseIndexes(modelName, body) });
  }

  return models;
}

/** Блоки `@@index([...])` и `@@unique([...])` одного тела модели, с ИМЕНЕМ,
 * которое им даст сама Prisma.
 *
 * Имя важнее содержимого. В проекте нет каталога миграций: схему на прод
 * доставляет этот файл. Но каталог миграций однажды появится, и если наш
 * индекс будет лежать на проде под самодельным именем, первый же прогон
 * миграций упадёт на конфликте «такой индекс уже есть под другим именем».
 * Поэтому имя строится правилом Prisma — `<Модель>_<колонки через _>_idx`
 * (и `_key` у уникального), — и это же имя проверено прогоном
 * `prisma migrate diff --from-empty --to-schema` 11.09.2026: он печатает
 * ровно `CREATE INDEX "AudioAsset_text_idx" ON "AudioAsset"("text");`. */
function parseIndexes(modelName: string, body: string): IndexDef[] {
  const out: IndexDef[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) continue;
    const m = /^@@(index|unique)\(\s*\[([^\]]*)\]/.exec(trimmed);
    if (!m) continue;
    const columns = m[2]
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (columns.length === 0) continue;
    const named = /name:\s*"([^"]+)"/.exec(trimmed) ?? /map:\s*"([^"]+)"/.exec(trimmed);
    out.push({
      name: named ? named[1] : `${modelName}_${columns.join("_")}_${m[1] === "unique" ? "key" : "idx"}`,
      table: modelName,
      columns,
      unique: m[1] === "unique",
    });
  }
  return out;
}

/** Tables this script is allowed to CREATE, with the DDL written out by
 * hand.
 *
 * The column diff above cannot help with a brand-new model: it reads
 * `PRAGMA table_info`, sees a table with no columns, and skips — which
 * means a new Prisma model reaches production as "no such table" on every
 * query that touches it. That is the same shape of outage as 27.08.2026,
 * one level up.
 *
 * Deliberately an explicit, hand-written list rather than a general
 * "generate CREATE TABLE from schema.prisma". A generated DDL would have
 * to get defaults, relation columns, indexes and constraints right for all
 * 23 models, and any mistake in it would run against production
 * unsupervised. A list of statements a human wrote and a human reviewed
 * can only ever create the tables named in it, and `IF NOT EXISTS` makes
 * every one of them a no-op on the second build. src/lib/schema-sync.test.ts
 * checks the two halves agree: every model in schema.prisma is either
 * already in production's shape or named here.
 */
const CREATE_TABLE_STATEMENTS: ReadonlyArray<{ table: string; statements: string[] }> = [
  {
    table: "StudyDay",
    statements: [
      `CREATE TABLE IF NOT EXISTS "StudyDay" (
         "id" TEXT NOT NULL PRIMARY KEY,
         "userId" TEXT NOT NULL,
         "dateKey" TEXT NOT NULL,
         "source" TEXT NOT NULL,
         "markedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT "StudyDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
       )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "StudyDay_userId_dateKey_key" ON "StudyDay"("userId", "dateKey")`,
      `CREATE INDEX IF NOT EXISTS "StudyDay_userId_idx" ON "StudyDay"("userId")`,
    ],
  },
  {
    // Журнал спроса на поиск (PROGRESS.md 7.128, долг 50). Ни одной
    // колонки, связывающей строку с человеком: ни userId, ни адреса, ни
    // сессии, ни точного времени — см. комментарий к модели в
    // schema.prisma. Поэтому и внешнего ключа здесь нет ни одного, в
    // отличие от StudyDay выше.
    table: "SearchQuery",
    statements: [
      `CREATE TABLE IF NOT EXISTS "SearchQuery" (
         "id" TEXT NOT NULL PRIMARY KEY,
         "query" TEXT NOT NULL,
         "resultCount" INTEGER NOT NULL,
         "lang" TEXT NOT NULL,
         "followed" INTEGER NOT NULL DEFAULT 0,
         "hourBucket" DATETIME NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS "SearchQuery_hourBucket_idx" ON "SearchQuery"("hourBucket")`,
      `CREATE INDEX IF NOT EXISTS "SearchQuery_query_idx" ON "SearchQuery"("query")`,
    ],
  },
  {
    // Незакрытый талон OXXO (PROGRESS.md 7.145, долг 30). Строка здесь —
    // НЕ доступ: ни срока, ни уровня, правило доступа сюда не смотрит
    // вовсе. Внешний ключ на User есть — в отличие от SearchQuery выше,
    // эта строка про конкретного человека и обязана уезжать вместе с ним.
    table: "PendingCheckout",
    statements: [
      `CREATE TABLE IF NOT EXISTS "PendingCheckout" (
         "id" TEXT NOT NULL PRIMARY KEY,
         "userId" TEXT NOT NULL,
         "plan" TEXT NOT NULL,
         "method" TEXT NOT NULL DEFAULT 'oxxo',
         "stripeSessionId" TEXT NOT NULL,
         "expiresAt" DATETIME NOT NULL,
         "settledAt" DATETIME,
         "outcome" TEXT,
         "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT "PendingCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
       )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "PendingCheckout_stripeSessionId_key" ON "PendingCheckout"("stripeSessionId")`,
      `CREATE INDEX IF NOT EXISTS "PendingCheckout_userId_idx" ON "PendingCheckout"("userId")`,
    ],
  },
  {
    // Код доступа для первых учеников (PROGRESS.md 7.146). Строка здесь —
    // НЕ доступ: доступ выдаётся строкой `Subscription` через
    // `extendOrGrantSubscription`, ту же, что пишет путь Stripe. Внешние
    // ключи на User — SET NULL, а не CASCADE: удаление аккаунта не должно
    // возвращать погашенный код в оборот.
    table: "AccessCode",
    statements: [
      `CREATE TABLE IF NOT EXISTS "AccessCode" (
         "id" TEXT NOT NULL PRIMARY KEY,
         "code" TEXT NOT NULL,
         "tier" TEXT NOT NULL DEFAULT 'standard',
         "durationDays" INTEGER NOT NULL DEFAULT 90,
         "expiresAt" DATETIME,
         "batch" TEXT,
         "redeemedAt" DATETIME,
         "redeemedById" TEXT,
         "revokedAt" DATETIME,
         "revokedById" TEXT,
         "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT "AccessCode_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
         CONSTRAINT "AccessCode_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
       )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "AccessCode_code_key" ON "AccessCode"("code")`,
      `CREATE INDEX IF NOT EXISTS "AccessCode_batch_idx" ON "AccessCode"("batch")`,
      `CREATE INDEX IF NOT EXISTS "AccessCode_redeemedById_idx" ON "AccessCode"("redeemedById")`,
    ],
  },
];

/** Индексы СУЩЕСТВУЮЩИХ таблиц, которые этот скрипт имеет право создать.
 *
 * Третья дыра той же формы, что две выше. Сверка колонок читает
 * `PRAGMA table_info` и про индексы не знает ничего; `CREATE_TABLE_STATEMENTS`
 * несёт индексы только у таблиц, которых на проде ещё нет. Значит
 * `@@index`, дописанный к ДАВНО живущей модели, не доезжает до прода
 * никогда — и это не гипотеза: именно так `AudioAsset.text` прожил без
 * индекса до 11.09.2026, когда полный проход по 36 316 строкам на каждый
 * рендер медиа-страницы исчерпал месячную квоту чтений Turso и уронил
 * сайт на несколько часов (PROGRESS.md 7.172, долг 135).
 *
 * Список, как и у таблиц, написан и прочитан человеком, а не сгенерирован:
 * `CREATE INDEX` на 36 тысячах строк — это запись в боевую базу, и ей не
 * место под автоматикой. `IF NOT EXISTS` делает второй прогон пустым
 * действием. Имя — то, которое дала бы миграция Prisma, чтобы будущий
 * каталог миграций не упал на конфликте; `src/lib/schema-sync.test.ts`
 * сверяет этот список с `@@index` в схеме и с именами, выведенными
 * правилом Prisma. */
const CREATE_INDEX_STATEMENTS: ReadonlyArray<{ index: string; table: string; statement: string }> = [
  {
    index: "AudioAsset_text_idx",
    table: "AudioAsset",
    statement: `CREATE INDEX IF NOT EXISTS "AudioAsset_text_idx" ON "AudioAsset"("text")`,
  },
];

/** Индексы, которые на проде БЫЛИ до 11.09.2026. Список не написан от
 * руки и не угадан: он снят запросом `select name from sqlite_master where
 * type='index'` со снимка боевой базы того же дня — 54 имени, 54 строки
 * ниже. Нужен он затем, чтобы сверка в `src/lib/schema-sync.test.ts` могла
 * сказать «этот `@@index` на проде уже есть», не имея базы под рукой:
 * `npm run test` не открывает ни одного соединения (check:no-db-in-tests).
 *
 * Новый `@@index` в схеме обязан попасть либо сюда (если он и так на
 * проде), либо в `CREATE_INDEX_STATEMENTS` — иначе тест покраснеет, и
 * именно это отличает «индекс объявлен» от «индекс доехал». */
const INDEXES_ALREADY_IN_PRODUCTION: ReadonlySet<string> = new Set([
  "AccessCode_batch_idx",
  "AccessCode_code_key",
  "AccessCode_redeemedById_idx",
  "AudioAsset_contentType_contentId_idx",
  "AudioAsset_contentType_contentId_itemKey_key",
  "ExamAttempt_userId_level_examSlug_idx",
  "Exam_level_examSlug_key",
  "FlashcardCard_category_idx",
  "FlashcardCard_level_idx",
  "FlashcardProgress_userId_cardId_key",
  "FlashcardProgress_userId_idx",
  "GlossaryTerm_category_idx",
  "GlossaryTerm_slug_key",
  "GrammarCheckResult_entityType_entityId_fieldName_key",
  "GrammarCheckResult_status_idx",
  "GroupMember_groupId_idx",
  "GroupMember_groupId_userId_key",
  "GroupMember_userId_idx",
  "Group_inviteCode_key",
  "Group_ownerUserId_idx",
  "Idiom_category_idx",
  "Idiom_level_idx",
  "LessonProgress_userId_idx",
  "LessonProgress_userId_level_lessonSlug_key",
  "Lesson_level_lessonSlug_key",
  "MediaOverride_mediaId_key",
  "PendingCheckout_stripeSessionId_key",
  "PendingCheckout_userId_idx",
  "ReferralReward_referredUserId_key",
  "ReferralReward_referrerUserId_idx",
  "SearchQuery_hourBucket_idx",
  "SearchQuery_query_idx",
  "StoryReadingProgress_userId_idx",
  "StoryReadingProgress_userId_storyId_key",
  "Story_level_idx",
  "StudyDay_userId_dateKey_key",
  "StudyDay_userId_idx",
  "Subscription_rcOriginalTransactionId_idx",
  "Subscription_rcOriginalTransactionId_key",
  "Subscription_stripeSubscriptionId_idx",
  "Subscription_stripeSubscriptionId_key",
  "Subscription_userId_createdAt_idx",
  "Subscription_userId_idx",
  "UserBadge_userId_badgeId_key",
  "UserBadge_userId_idx",
  "User_email_key",
  "User_publicHandle_key",
  "User_referralCode_key",
  "User_stripeCustomerId_key",
  "VoiceSubmission_userId_level_lessonSlug_itemKey_idx",
  "WordGameProgress_userId_idx",
  "WordGameProgress_userId_puzzleId_key",
  "WordGamePuzzle_type_level_idx",
  "WordGamePuzzle_type_level_sequence_key",
]);

export { parseSchema, modelBodies, CREATE_TABLE_STATEMENTS, CREATE_INDEX_STATEMENTS, INDEXES_ALREADY_IN_PRODUCTION };
export type { FieldDef, ModelDef, IndexDef };

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.log("[ensure-schema-sync] No TURSO_DATABASE_URL — skipping (local/dev build).");
    return;
  }

  const schemaText = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf-8");
  const models = parseSchema(schemaText);

  const client = createClient({ url, authToken });
  let addedCount = 0;
  let createdCount = 0;

  // Tables first: a model that does not exist at all cannot be column-diffed,
  // and the loop below would silently skip it forever.
  for (const { table, statements } of CREATE_TABLE_STATEMENTS) {
    const info = await client.execute(`PRAGMA table_info("${table}")`);
    if (info.rows.length > 0) continue;
    console.log(`[ensure-schema-sync] Creating missing table ${table}...`);
    for (const statement of statements) await client.execute(statement);
    createdCount++;
  }

  // Индексы существующих таблиц — ПОСЛЕ таблиц и ДО колонок: индекс по
  // колонке, которой ещё нет, создать нельзя, а все индексы из списка
  // стоят на колонках, которые на проде есть годами.
  let indexedCount = 0;
  for (const { index, table, statement } of CREATE_INDEX_STATEMENTS) {
    const existing = await client.execute(`PRAGMA index_info("${index}")`);
    if (existing.rows.length > 0) continue;
    const tableInfo = await client.execute(`PRAGMA table_info("${table}")`);
    if (tableInfo.rows.length === 0) {
      console.log(`[ensure-schema-sync] ${table} ещё нет — индекс ${index} пропущен.`);
      continue;
    }
    console.log(`[ensure-schema-sync] Creating missing index ${index} on ${table}...`);
    await client.execute(statement);
    indexedCount++;
  }

  for (const model of models) {
    let existingColumns: Set<string>;
    try {
      const info = await client.execute(`PRAGMA table_info("${model.name}")`);
      existingColumns = new Set(info.rows.map((row) => String(row.name)));
    } catch (error) {
      console.log(`[ensure-schema-sync] Could not read ${model.name} (table may not exist yet) — skipping.`, error);
      continue;
    }
    if (existingColumns.size === 0) {
      console.log(`[ensure-schema-sync] ${model.name} has no columns (table may not exist yet) — skipping.`);
      continue;
    }

    for (const field of model.fields) {
      if (existingColumns.has(field.name)) continue;
      console.log(`[ensure-schema-sync] Adding missing column ${model.name}.${field.name} ${field.sqlType}...`);
      await client.execute(`ALTER TABLE "${model.name}" ADD COLUMN "${field.name}" ${field.sqlType}`);
      addedCount++;
    }
  }

  console.log(
    addedCount > 0 || createdCount > 0 || indexedCount > 0
      ? `[ensure-schema-sync] Created ${createdCount} missing table(s), ${indexedCount} missing index(es), added ${addedCount} missing column(s).`
      : "[ensure-schema-sync] Schema already in sync — no tables, indexes or columns added."
  );
  client.close();
}

// Only when this file is the process entry point.
//
// It used to run on import, and src/lib/schema-sync.test.ts imports it for
// parseSchema/modelBodies — so `npm run test` in a shell that happened to
// carry TURSO_DATABASE_URL would have pointed the production schema
// migrator at production. Idempotent and ADD-COLUMN-only, so the damage
// would have been bounded, but "the unit suite writes DDL to prod" is not
// a property to leave to luck. Caught 29.08.2026 when a read-only audit
// script imported this module and the connection banner appeared in its
// output.
//
// This is the same rule as VERCEL_ENV vs NODE_ENV in
// src/lib/deploy-environment.ts: the signal has to be something a
// bystander cannot accidentally satisfy.
const isEntryPoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main().catch((error) => {
    console.error("[ensure-schema-sync] Failed:", error);
    process.exit(1);
  });
}
