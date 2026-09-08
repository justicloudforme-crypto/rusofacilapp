/**
 * Выпуск партии кодов доступа для первых учеников (PROGRESS.md 7.146).
 *
 * Печатает коды в stdout и БОЛЬШЕ НИКУДА. В файл репозитория коды не
 * пишутся ни при каком флаге: выпущенный код — это оплаченный доступ на
 * предъявителя, и попадание пачки таких в git — это раздача доступа всем,
 * у кого есть доступ к репозиторию, навсегда и задним числом.
 *
 * ПЕРВЫЙ ПРОГОН ОБЯЗАН БЫТЬ `--dry-run`. Держится это тем, что писать без
 * явного `--commit` скрипт не умеет вовсе, а `--commit` и `--dry-run`
 * взаимоисключающи: «записать, не посмотрев план» — это набрать другой флаг,
 * а не забыть один. Порядок такой:
 *
 *     npm run access-codes:generate -- --count=20 --days=90 --dry-run
 *     npm run access-codes:generate -- --count=20 --days=90 --commit
 *
 * `--force` отвергается ЯВНО и с объяснением. Флаг с таким именем в этом
 * репозитории существует ровно затем, чтобы кто-то, набравший его по
 * привычке из другого скрипта, получил отказ, а не тихое «ну ладно».
 *
 * Против боевой базы этот скрипт в заходе 7.146 НЕ прогонялся — партию
 * выпускают отдельным прогоном после мержа.
 *
 * Флаги:
 *   --count=N          сколько кодов (обязателен)
 *   --prefix=AMIGO     приставка кода (по умолчанию AMIGO)
 *   --days=90          сколько дней доступа даёт погашение
 *   --expires-in=30    через сколько дней протухает САМ код (не доступ)
 *   --expires-at=ISO   то же явной датой; с --expires-in вместе нельзя
 *   --batch=МЕТКА      метка партии (по умолчанию <prefix>-YYYY-MM-DD)
 *   --dry-run          ничего не пишет, печатает план и образец кодов
 *   --commit           пишет в базу
 */
import "dotenv/config";
import { randomInt } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";
// Алфавит, нормализация и печать — из общего с приложением модуля, а не
// переписанные здесь: разойдись нормализация на записи и на чтении хоть в
// одном знаке, и выпущенная партия перестала бы погашаться молча.
// `src/lib/access-code.ts` импортировать отсюда нельзя — он `server-only`.
import {
  ACCESS_CODE_ALPHABET as ALPHABET,
  formatAccessCode as pretty,
  normalizeAccessCode as normalize,
} from "../src/lib/access-code-format";

const DEFAULT_PREFIX = "AMIGO";
const DEFAULT_DAYS = 90;
/** Длина случайной части: 8 знаков из 26-знакового алфавита — это 26^8 ≈
 * 2·10^11 вариантов. Подбор через маршрут погашения ограничен 20 попытками
 * в минуту на аккаунт, то есть перебор бессмысленен на много порядков; при
 * этом переписать восемь знаков с бумажки человек ещё в состоянии. */
const RANDOM_LENGTH = 8;

function flag(name: string): string | undefined {
  const hit = process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (hit === undefined) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "";
}

function fail(message: string): never {
  console.error(`ОТКАЗ: ${message}`);
  process.exit(1);
}

function randomBody(): string {
  let out = "";
  // randomInt из node:crypto, а не Math.random: код — предмет на
  // предъявителя, и предсказуемый генератор здесь означает предсказуемый
  // доступ. Math.random не даёт такой гарантии вовсе.
  for (let i = 0; i < RANDOM_LENGTH; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Тот же выбор базы, что делает приложение (src/lib/db.ts): TURSO, если он
 * задан, иначе локальный файл. Никаких собственных правил — иначе скрипт мог
 * бы писать не туда, куда смотрит сайт. */
function makeClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });
}

async function main() {
  if (flag("force") !== undefined) {
    fail(
      "флаг --force здесь не поддерживается намеренно. Он ничего не открывает и ничего не ускоряет: " +
        "первый прогон обязан быть --dry-run, второй — --commit. Если --commit отказывается писать, " +
        "причина названа в его сообщении, и обойти её флагом нельзя."
    );
  }

  const dryRun = flag("dry-run") !== undefined;
  const commit = flag("commit") !== undefined;
  if (dryRun === commit) {
    fail("нужен ровно один из флагов --dry-run или --commit.");
  }

  const countRaw = flag("count");
  if (countRaw === undefined) fail("--count обязателен.");
  const count = Number(countRaw);
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    fail(`--count должен быть целым от 1 до 1000, получено "${countRaw}".`);
  }

  const prefix = normalize(flag("prefix") || DEFAULT_PREFIX);
  if (!/^[A-Z0-9]{2,12}$/.test(prefix)) {
    fail(`--prefix после нормализации должен быть 2–12 знаками A–Z/0–9, получено "${prefix}".`);
  }

  const days = Number(flag("days") ?? DEFAULT_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    fail(`--days должен быть целым от 1 до 3650, получено "${flag("days")}".`);
  }

  const expiresIn = flag("expires-in");
  const expiresAtRaw = flag("expires-at");
  if (expiresIn !== undefined && expiresAtRaw !== undefined) {
    fail("--expires-in и --expires-at вместе не имеют смысла: срок годности кода один.");
  }
  let expiresAt: Date | null = null;
  if (expiresIn !== undefined) {
    const inDays = Number(expiresIn);
    if (!Number.isInteger(inDays) || inDays < 1 || inDays > 3650) {
      fail(`--expires-in должен быть целым от 1 до 3650, получено "${expiresIn}".`);
    }
    expiresAt = new Date(Date.now() + inDays * 24 * 60 * 60 * 1000);
  }
  if (expiresAtRaw !== undefined) {
    const parsed = new Date(expiresAtRaw);
    if (Number.isNaN(parsed.getTime())) fail(`--expires-at не разобран как дата: "${expiresAtRaw}".`);
    if (parsed.getTime() <= Date.now()) fail("--expires-at в прошлом: такая партия мертва в момент выпуска.");
    expiresAt = parsed;
  }

  const today = new Date().toISOString().slice(0, 10);
  const batch = flag("batch") || `${prefix}-${today}`;

  console.log(`Партия:            ${batch}`);
  console.log(`Кодов:             ${count}`);
  console.log(`Приставка:         ${prefix}`);
  console.log(`Уровень:           standard (premium кодом не выдаётся)`);
  console.log(`Дней доступа:      ${days}`);
  console.log(`Срок годности кода: ${expiresAt ? expiresAt.toISOString() : "без ограничения"}`);
  console.log(`База:              ${process.env.TURSO_DATABASE_URL ? "TURSO (боевая!)" : process.env.DATABASE_URL ?? "file:./dev.db"}`);
  console.log("");

  // Коды генерируются ДО ветвления, чтобы --dry-run печатал ровно ту работу,
  // которую сделает --commit, а не её пересказ.
  const codes = new Set<string>();
  let attempts = 0;
  while (codes.size < count) {
    codes.add(`${prefix}${randomBody()}`);
    attempts += 1;
    if (attempts > count * 100) fail("генератор не набрал нужное число различных кодов — это не должно быть возможно.");
  }
  const list = [...codes];

  if (dryRun) {
    console.log(`--dry-run: в базу НЕ записано ничего. Образец первых трёх кодов той формы, что выпустит --commit:`);
    for (const code of list.slice(0, 3)) console.log(`  ${pretty(code, prefix)}`);
    console.log("");
    console.log(`Повторить с --commit, чтобы записать ${count} строк AccessCode.`);
    return;
  }

  const db = makeClient();
  try {
    const already = await db.accessCode.count({ where: { batch } });
    if (already > 0) {
      fail(
        `в партии "${batch}" уже ${already} строк. Повторный --commit с той же меткой выпустил бы вторую пачку ` +
          `под тем же именем, и отозвать партию целиком стало бы невозможно. Задайте другую --batch.`
      );
    }

    await db.accessCode.createMany({
      data: list.map((code) => ({ code, tier: "standard", durationDays: days, expiresAt, batch })),
    });

    console.log(`Записано строк: ${count}. Коды (в файл репозитория НЕ пишутся):`);
    console.log("");
    for (const code of list) console.log(pretty(code, prefix));
  } finally {
    await db.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
