/**
 * Заход 7.316 (задача 1б, решение владельца 27.11.2026): в карточке «брать»
 * перевод «tomar, coger (imperfectivo)» → «tomar, agarrar (imperfectivo)».
 * В Мексике «coger» — грубое слово. Пометка вида «(imperfectivo)» оставлена:
 * она отличает «брать» от пары «взять» (perfectivo), а владелец просил
 * заменить именно «coger».
 *
 * ОДНА СТРОКА, ОДНО ПОЛЕ. Ни других карточек (в «взять» тоже «coger» — её
 * владелец решает отдельно), ни уроков, ни озвучки: `translationEs` не
 * озвучивается (озвучен русский), поэтому `AudioAsset` и правило «клип у
 * всех» не затронуты.
 *
 * ПОРЯДОК (раздел 3.2 PROGRESS.md):
 *   1. без флага — сухой прогон: печатает строку ДО и что будет записано;
 *   2. `--apply` — снимок строки «до» в ~/rusofacil-backups/ (вне репозитория),
 *      одна узкая UPDATE с условием на id + слово + СТАРЫЙ перевод
 *      (уже поправленную или чужую строку не тронет), проверка
 *      rowsAffected = 1, сверка «после». Повторный запуск — «уже поправлено», 0 строк.
 *
 * База: `--local` — `dev.db` в корне (правило 264: после записи в прод — тем же
 * вызовом и в локальную); без `--local` — боевая через `scripts/turso-env.mjs`
 * (ключ в окружении той же строки или `--env=<файл вне папки проекта>`).
 *
 *   node prisma/run-7316/fix-card-brat.mjs --local            # сухой прогон, dev.db
 *   node prisma/run-7316/fix-card-brat.mjs --local --apply
 *   node prisma/run-7316/fix-card-brat.mjs --env=~/.config/rusofacilapp/turso.env
 *   node prisma/run-7316/fix-card-brat.mjs --env=~/.config/rusofacilapp/turso.env --apply
 *
 * Кеш карточек (Upstash, `src/lib/flashcards/cache.ts`) живёт 5 минут — новый
 * перевод на сайте виден не позже чем через 5 минут после записи.
 * Откат: тот же UPDATE в обратную сторону по снимку «до».
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { readTursoEnv } from "../../scripts/turso-env.mjs";

export const CARD_ID = "cmt0ipwzq0004rqncd1r4xrju";
export const WORD = "брать";
export const OLD = "tomar, coger (imperfectivo)";
export const NEW = "tomar, agarrar (imperfectivo)";

const APPLY = process.argv.includes("--apply");
const LOCAL = process.argv.includes("--local");

const SELECT = `SELECT id, russian, translationEs, updatedAt FROM "FlashcardCard" WHERE id = ?`;

async function main() {
  const conn = LOCAL ? { url: "file:./dev.db" } : (() => { const e = readTursoEnv(); return { url: e.url, authToken: e.authToken }; })();
  const db = createClient(conn);
  const where = LOCAL ? "локальная dev.db" : "БОЕВАЯ база";
  const before = (await db.execute({ sql: SELECT, args: [CARD_ID] })).rows[0];
  if (!before) throw new Error(`ОТКАЗ: карточки ${CARD_ID} нет (${where})`);
  if (before.russian !== WORD) throw new Error(`ОТКАЗ: ${CARD_ID} — это «${before.russian}», а не «${WORD}»`);
  console.log(`${where}. ДО:    «${before.russian}» → «${before.translationEs}»`);
  if (before.translationEs === NEW) { console.log("уже поправлено — писать нечего (0 строк)"); return 0; }
  if (before.translationEs !== OLD) throw new Error(`ОТКАЗ: перевод «${before.translationEs}» ≠ ожидаемого «${OLD}» — кто-то правил карточку, сверить руками`);
  console.log(`${where}. БУДЕТ: «${WORD}» → «${NEW}»`);
  if (!APPLY) { console.log("сухой прогон — ничего не записано (запись: --apply)"); return 0; }

  if (!LOCAL) {
    const dir = path.join(os.homedir(), "rusofacil-backups");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "7316-card-brat-prod-before.json");
    writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), row: { ...before } }, null, 2));
    console.log(`снимок «до»: ${file}`);
  }
  const res = await db.execute({
    sql: `UPDATE "FlashcardCard" SET translationEs = ? WHERE id = ? AND russian = ? AND translationEs = ?`,
    args: [NEW, CARD_ID, WORD, OLD],
  });
  if (res.rowsAffected !== 1) throw new Error(`ОТКАЗ: rowsAffected = ${res.rowsAffected}, ожидалась 1`);
  const after = (await db.execute({ sql: SELECT, args: [CARD_ID] })).rows[0];
  console.log(`${where}. ПОСЛЕ: «${after.russian}» → «${after.translationEs}» (строк: ${res.rowsAffected})`);
  return after.translationEs === NEW ? 0 : 1;
}

main().then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });
