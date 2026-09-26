/**
 * Файлы проекта ДЛЯ СТОРОЖЕЙ — отслеживаемые И новые, ещё не добавленные в
 * git (но не игнорируемые). Заход 7.236.
 *
 * ПОЧЕМУ НЕ ПРОСТО `git ls-files`. Он видит только индекс. Новый файл до
 * `git add` для сторожа не существует: локальный `npm run verify` зелен,
 * а CI — где закоммичено всё — краснеет. Оплачено дважды: PR #226
 * (`check:brand`) и PR #420 (`check:legal-truth` не увидел новый
 * `src/lib/login-signed-in.ts` с выдуманным хостом — verify прогонялся до
 * коммита). Урок записывали в комментарии сторожей словами («прогон до
 * `git add` ничего не говорит»), то есть держали его на памяти того, кто
 * запускает. Теперь сторож видит то же, что увидит CI после коммита.
 *
 * `--others --exclude-standard` — новые файлы без игнорируемых
 * (`.gitignore`: сборка, рабочие заметки заходов); удалённые с диска, но
 * ещё отслеживаемые файлы отбрасываются — CI их тоже не увидит.
 *
 * @param {string[]} [paths] ограничить каталогами, как у `git ls-files -- <paths>`
 * @returns {string[]}
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

export function repoFiles(paths = []) {
  const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...paths], {
    encoding: "utf8",
  });
  return [...new Set(out.split("\0").filter(Boolean))].filter((f) => existsSync(f));
}

/**
 * Самопроверка (правило 4.1): НЕОТСЛЕЖИВАЕМЫЙ файл с чужим хостом обязан
 * уронить `check:legal-truth` — ровно то, что пропустил verify на PR #420.
 * Второй контроль — удалённый файл в список не попадает. Файл пробы
 * удаляется в `finally`, что бы ни случилось.
 *
 *   node scripts/repo-files.mjs --self-test
 */
async function selfTest() {
  const { writeFileSync, rmSync } = await import("node:fs");
  const probe = `src/lib/__repo-files-probe-${process.pid}.ts`;
  const cases = [];
  try {
    writeFileSync(probe, 'export const probe = () => fetch("https://repo-files-probe.example/x");\n');
    cases.push({ name: "новый файл виден до `git add`", ok: repoFiles(["src"]).includes(probe) });
    let failed = false;
    try {
      execFileSync("node", ["scripts/check-legal-truth.mjs"], { stdio: "pipe" });
    } catch (error) {
      failed = String(error.stdout ?? "").concat(String(error.stderr ?? "")).includes("repo-files-probe.example");
    }
    cases.push({ name: "check:legal-truth краснеет на НЕОТСЛЕЖИВАЕМОМ файле с чужим хостом", ok: failed });
  } finally {
    rmSync(probe, { force: true });
  }
  cases.push({ name: "удалённый файл в список не попадает", ok: !repoFiles(["src"]).includes(probe) });
  let clean = true;
  try {
    execFileSync("node", ["scripts/check-legal-truth.mjs"], { stdio: "pipe" });
  } catch {
    clean = false;
  }
  cases.push({ name: "отрицательный контроль: без пробы check:legal-truth молчит", ok: clean });
  for (const c of cases) console.log(`  ${c.ok ? "да" : "НЕТ"} — ${c.name}`);
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `repo-files --self-test — ${cases.length} из ${cases.length}` : "repo-files --self-test — FAILED");
  process.exitCode = ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--self-test")) await selfTest();
}
