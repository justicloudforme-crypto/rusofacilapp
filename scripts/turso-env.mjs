/**
 * ОТКУДА СКРИПТ БЕРЁТ БОЕВОЙ КЛЮЧ TURSO — одно место на все скрипты
 * (заход 7.272, решение владельца 17.10.2026, раздел 3.19 п. 4).
 *
 * Ключ живёт ТОЛЬКО:
 *   · в переменных окружения на время команды —
 *       TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… node scripts/…
 *   · или в файле ВНЕ папки проекта (права 600) —
 *       node scripts/… --env=~/.config/rusofacilapp/turso.env
 *
 * Файл внутри папки проекта (прежний .env.turso, .env и любой другой,
 * даже игнорируемый git) — отказ ДО чтения: ключ, сохранённый в папке
 * проекта, — ровно то, что пункт 4 запрещает.
 */
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const TURSO_ENV_HELP =
  "нужен боевой ключ Turso: TURSO_DATABASE_URL=libsql://… и TURSO_AUTH_TOKEN=… переменными окружения " +
  "в той же строке, что и команда, или --env=<файл вне папки проекта> (например ~/.config/rusofacilapp/turso.env)";

/** Путь `--env=` внутри папки проекта? `~` раскрывается, сравнение — по
 *  разрешённому абсолютному пути. */
export function isInsideProject(file, root = PROJECT_ROOT) {
  const abs = path.resolve(file.replace(/^~(?=$|\/)/, os.homedir()));
  const rel = path.relative(path.resolve(root), abs);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function parseEnvFile(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

/**
 * Возвращает `{ url, authToken, source }` или бросает ошибку с понятным
 * текстом. Окружение главнее файла; файл читается, только если его назвали
 * явно флагом `--env=`.
 *
 * @param {{
 *   argv?: string[],
 *   env?: Record<string, string | undefined>,
 *   root?: string,
 *   read?: (file: string, encoding: "utf8") => string,
 * }} [options]
 * @returns {{ url: string, authToken: string, source: string }}
 */
export function readTursoEnv({ argv = process.argv.slice(2), env = process.env, root = PROJECT_ROOT, read = readFileSync } = {}) {
  const file = argv.find((a) => a.startsWith("--env="))?.slice(6);
  let source = "окружение";
  let vars = env;
  if (!env.TURSO_DATABASE_URL && !env.TURSO_AUTH_TOKEN && file) {
    if (isInsideProject(file, root)) {
      throw new Error(`ОТКАЗ: файл ключа «${file}» лежит в папке проекта — ключ хранится только вне её. ${TURSO_ENV_HELP}`);
    }
    vars = parseEnvFile(read(path.resolve(file.replace(/^~(?=$|\/)/, os.homedir())), "utf8"));
    source = `файл вне проекта (${file})`;
  }
  const url = vars.TURSO_DATABASE_URL ?? "";
  const authToken = vars.TURSO_AUTH_TOKEN ?? "";
  if (!/^libsql:\/\//.test(url) || !authToken) throw new Error(TURSO_ENV_HELP);
  return { url, authToken, source };
}
