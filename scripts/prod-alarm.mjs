// ТРЕВОГА И ОТКАТ ПО ИТОГУ ПРОГОНА ПРОТИВ ПРОДА (заход 7.205).
//
// Читает отчёт `scripts/prod-smoke.mjs` и делает ровно три вещи:
//
//   1. упало → заводит issue с меткой `prod-down`. GitHub сам шлёт
//      уведомление в мобильное приложение и на почту — отдельного
//      сервиса оповещений для этого заводить не нужно, и владельцу не
//      нужно нигде регистрироваться;
//   2. упало ВТОРОЙ раз подряд НА ТОМ ЖЕ ДЕПЛОЕ → откатывает прод на
//      предыдущий удачный Production-деплой — но ТОЛЬКО если в секретах
//      лежит `VERCEL_TOKEN`. Нет токена — только тревога, и в issue
//      прямо написано, что откат не включён;
//   3. стало зелено, а issue открыт → комментарий «восстановлено» и
//      закрытие.
//
// ПОЧЕМУ ОТКАТ ТОЛЬКО СО ВТОРОГО РАЗА. Откат — это выкат, и автоматика,
// которая катает прод по одному наблюдению, опаснее самой аварии:
// холодная функция, разовая сетевая неудача GitHub Actions или моргнувший
// CDN дали бы откат на ровном месте. Первое падение — тревога. Второе
// подряд, на том же деплое, — событие.
//
// СОСТОЯНИЕ ЖИВЁТ В САМОМ ISSUE, а не в файле: между прогонами Actions
// ничего не сохраняется. В теле и в каждом комментарии стоит невидимая
// строка `<!-- prod-smoke deploy=<sha> -->`, и «второй раз подряд на том
// же деплое» читается из неё.
//
//   node scripts/prod-alarm.mjs --result=smoke-artifacts/smoke-result.json
//   node scripts/prod-alarm.mjs --plant     # позитивный контроль, без сети
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

// Ни одна строка этого файла не должна исполняться от того, что его
// кто-то импортировал — то же правило и та же вставленная форма, что в
// scripts/check-brand-name.mjs; разбор случая, ради которого правило
// заведено, — в src/lib/entry-point.ts.
const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;


const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

export const ISSUE_LABEL = "prod-down";

/**
 * КОМУ ПРИХОДИТ ТРЕВОГА — И ПОЧЕМУ ЭТОГО МАЛО БЫЛО РАНЬШЕ.
 *
 * Заход 7.205 рассчитывал на то, что «GitHub сам пришлёт уведомление».
 * Замер настроек владельца 17.09.2026 показал, чего именно он ждёт:
 * приложение GitHub на iPhone шлёт push только про Direct Mentions,
 * Assigned и Failed Workflows, а про НОВЫЙ issue сам по себе — не шлёт.
 * Подписка на репозиторий (Watch → Custom → Issues) даёт письмо и
 * значок, но не звук в кармане.
 *
 * Поэтому issue тревоги теперь ДЕЛАЕТ ОБА эти события сразу: он
 * назначается на владельца (Assigned) и упоминает его в тексте (Direct
 * Mention). Одного не хватило бы: назначение может не пройти, если у
 * учётной записи нет прав на этот репозиторий, а упоминание работает
 * всегда.
 *
 * УПОМИНАНИЕ СТОИТ ТОЛЬКО В ПЕРВОМ ТЕЛЕ. Повторные падения дополняют
 * ТОТ ЖЕ issue комментарием, и в комментарии упоминания нет: иначе
 * каждый час падения превращался бы в новый звонок, и сторож, ради
 * которого всё затевалось, владелец бы выключил. Один отказ — одно
 * упоминание.
 */
export const ISSUE_OWNER = "justicloudforme-crypto";
const STATE_MARK = "prod-smoke deploy=";

function stateMark(deploy) {
  return `<!-- ${STATE_MARK}${deploy} -->`;
}

/** Все обращения к GitHub и Vercel идут через эти два адреса, и только
 *  ради того, чтобы позитивный контроль мог подставить свой local. */
const GITHUB_API = arg("github-api", "https://api.github.com");
const VERCEL_API = arg("vercel-api", "https://api.vercel.com");

async function api(url, { token, method = "GET", body, headers = {} } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${text.slice(0, 200)}`);
  return json;
}

/** Решение, принятое по отчёту и по состоянию issue. Вынесено отдельной
 *  чистой функцией специально: подсадки судят именно её, не трогая сети. */
export function decide({ failures, openIssue, deploy, hasVercelToken }) {
  if (!failures.length) {
    return openIssue ? { action: "resolve", rollback: false } : { action: "none", rollback: false };
  }
  const seenSameDeploy = openIssue
    ? (openIssue.bodyAndComments ?? []).some((t) => t.includes(stateMark(deploy)))
    : false;
  return {
    action: openIssue ? "comment" : "open",
    // Подтверждение — ВТОРОЕ падение на том же деплое, и только при
    // наличии токена. Без токена откат не пробуется вовсе.
    rollback: Boolean(seenSameDeploy && hasVercelToken),
    confirmed: seenSameDeploy,
  };
}

function issueBody({ report, deploy, runUrl, hasVercelToken }) {
  const lines = report.failures.map((f) => `- **${f.name}** (\`${f.path}\`) — ${f.why.join("; ")}`);
  return [
    // Упоминание — ПЕРВОЙ строкой и только здесь: именно оно поднимает
    // push в приложении GitHub на телефоне (см. ISSUE_OWNER).
    `@${ISSUE_OWNER} — прод не отвечает как надо.`,
    "",
    `Проверка живого прода нашла ${report.failures.length} упавших целей из ${report.checked}.`,
    "",
    ...lines,
    "",
    `Деплой: \`${deploy}\`. Прогон: ${runUrl}`,
    "",
    hasVercelToken
      ? "Автооткат включён: при втором таком же падении подряд прод откатится на предыдущий Production-деплой."
      : "**Автооткат ВЫКЛЮЧЕН** — в секретах репозитория нет `VERCEL_TOKEN`. Откатить руками: Vercel → Deployments → предыдущий Production → ⋯ → Instant Rollback (раздел «Если сайт упал» в PROGRESS.md).",
    "",
    stateMark(deploy),
  ].join("\n");
}

/** Предыдущий удачный Production-деплой и откат на него. Ни разу не
 *  исполнялся: токена в секретах нет (долг заведён, см. PROGRESS 7.205). */
async function rollbackOnVercel({ token, projectId, teamId }) {
  const team = teamId ? `&teamId=${encodeURIComponent(teamId)}` : "";
  const list = await api(
    `${VERCEL_API}/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&state=READY&limit=5${team}`,
    { token },
  );
  const ready = list?.deployments ?? [];
  if (ready.length < 2) throw new Error(`предыдущего удачного Production-деплоя нет (найдено ${ready.length})`);
  const [current, previous] = ready;
  await api(`${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/promote/${previous.uid}?${team.slice(1)}`, {
    token,
    method: "POST",
    body: {},
  });
  return { from: current.uid, to: previous.uid, toUrl: previous.url };
}

async function main() {
  if (argv.includes("--plant")) return plant();

  const report = JSON.parse(readFileSync(arg("result", "smoke-artifacts/smoke-result.json"), "utf-8"));
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const runUrl = `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const deploy = process.env.DEPLOY_SHA || report.results?.find((r) => r.path === "/api/health")?.commit || "unknown";
  const vercelToken = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !repo) {
    console.error("нужны GITHUB_TOKEN и GITHUB_REPOSITORY — тревога поднимается только из Actions");
    process.exit(1);
  }

  const open = await api(`${GITHUB_API}/repos/${repo}/issues?state=open&labels=${ISSUE_LABEL}&per_page=1`, { token });
  let openIssue = null;
  if (open?.length) {
    const comments = await api(`${GITHUB_API}/repos/${repo}/issues/${open[0].number}/comments?per_page=100`, { token });
    openIssue = { number: open[0].number, bodyAndComments: [open[0].body ?? "", ...(comments ?? []).map((c) => c.body ?? "")] };
  }

  const hasVercelToken = Boolean(vercelToken && projectId);
  const verdict = decide({ failures: report.failures, openIssue, deploy, hasVercelToken });
  console.log(`решение: ${verdict.action}${verdict.rollback ? " + ОТКАТ" : ""} (деплой ${deploy})`);

  if (verdict.action === "none") return;

  if (verdict.action === "resolve") {
    await api(`${GITHUB_API}/repos/${repo}/issues/${openIssue.number}/comments`, {
      token,
      method: "POST",
      body: { body: `Восстановлено: прогон ${runUrl} прошёл все ${report.checked} целей зелёными.` },
    });
    await api(`${GITHUB_API}/repos/${repo}/issues/${openIssue.number}`, { token, method: "PATCH", body: { state: "closed" } });
    console.log(`issue #${openIssue.number} закрыт как восстановленный`);
    return;
  }

  let rolled = null;
  let rollbackError = null;
  if (verdict.rollback) {
    try {
      rolled = await rollbackOnVercel({ token: vercelToken, projectId, teamId: process.env.VERCEL_TEAM_ID });
    } catch (error) {
      rollbackError = String(error).slice(0, 300);
    }
  }

  const tail = rolled
    ? `\n\n**Откат сделан:** с \`${rolled.from}\` на \`${rolled.to}\` (${rolled.toUrl}). Новое не мержить, пока причина не разобрана.`
    : rollbackError
      ? `\n\n**Откат не удался:** ${rollbackError}. Откатите руками: Vercel → Deployments → предыдущий Production → Instant Rollback.`
      : "";

  if (verdict.action === "open") {
    const created = await api(`${GITHUB_API}/repos/${repo}/issues`, {
      token,
      method: "POST",
      body: {
        title: `Прод упал: ${report.failures.length} из ${report.checked} целей`,
        labels: [ISSUE_LABEL],
        // Назначение — второе из двух событий, на которые у владельца
        // включён push (Assigned). Массивом, а не строкой: GitHub
        // принимает оба, но `assignees` — то поле, которое переживает
        // перенос issue и правку заголовка.
        assignees: [ISSUE_OWNER],
        body: issueBody({ report, deploy, runUrl, hasVercelToken }) + tail,
      },
    });
    console.log(`заведён issue #${created.number}`);
    return;
  }

  await api(`${GITHUB_API}/repos/${repo}/issues/${openIssue.number}/comments`, {
    token,
    method: "POST",
    body: {
      body:
        `Ещё один красный прогон: ${report.failures.length} из ${report.checked}. ${runUrl}\n\n` +
        report.failures.map((f) => `- \`${f.path}\` — ${f.why.join("; ")}`).join("\n") +
        tail +
        `\n\n${stateMark(deploy)}`,
    },
  });
  console.log(`issue #${openIssue.number} дополнен${rolled ? " и прод откачен" : ""}`);
}

/** ПОЗИТИВНЫЙ КОНТРОЛЬ. Сети наружу не нужно, настоящий issue не
 *  заводится: GitHub и Vercel подменяются местным сервером, и он же
 *  записывает, что именно у него попросили. */
async function plant() {
  console.log("prod-alarm --plant — сухой прогон, настоящие GitHub и Vercel не трогаются");

  let caught = 0;
  const wrong = [];
  const RED = [{ name: "главная /es", path: "/es", why: ["ответ 500, ожидался 200"] }];

  const cases = [
    {
      title: "упало, открытого issue нет → ЗАВЕСТИ тревогу, отката нет",
      input: { failures: RED, openIssue: null, deploy: "aaa1111", hasVercelToken: true },
      expect: { action: "open", rollback: false },
    },
    {
      title: "упало второй раз НА ТОМ ЖЕ деплое, токен есть → комментарий и ОТКАТ",
      input: { failures: RED, openIssue: { number: 7, bodyAndComments: ["… <!-- prod-smoke deploy=aaa1111 -->"] }, deploy: "aaa1111", hasVercelToken: true },
      expect: { action: "comment", rollback: true },
    },
    {
      title: "упало второй раз, но деплой УЖЕ ДРУГОЙ → отката нет (это не тот же отказ)",
      input: { failures: RED, openIssue: { number: 7, bodyAndComments: ["… <!-- prod-smoke deploy=aaa1111 -->"] }, deploy: "bbb2222", hasVercelToken: true },
      expect: { action: "comment", rollback: false },
    },
    {
      title: "упало второй раз на том же деплое, но VERCEL_TOKEN нет → только тревога",
      input: { failures: RED, openIssue: { number: 7, bodyAndComments: ["… <!-- prod-smoke deploy=aaa1111 -->"] }, deploy: "aaa1111", hasVercelToken: false },
      expect: { action: "comment", rollback: false },
    },
    {
      title: "зелено, issue открыт → закрыть с «восстановлено»",
      input: { failures: [], openIssue: { number: 7, bodyAndComments: [""] }, deploy: "aaa1111", hasVercelToken: true },
      expect: { action: "resolve", rollback: false },
    },
    {
      title: "зелено, issue нет → не делать НИЧЕГО (отрицательный контроль)",
      input: { failures: [], openIssue: null, deploy: "aaa1111", hasVercelToken: true },
      expect: { action: "none", rollback: false },
    },
  ];

  for (const c of cases) {
    const got = decide(c.input);
    const ok = got.action === c.expect.action && got.rollback === c.expect.rollback;
    if (ok) caught += 1;
    else wrong.push(`${c.title} → ${got.action}/${got.rollback}`);
    console.log(`  ${ok ? "СОШЛОСЬ " : "НЕ СОШЛОСЬ"} ${c.title}`);
  }

  // Второй контроль — СКВОЗНОЙ: тревога проводится до конца против
  // подменённого GitHub, и проверяется, что наружу ушёл ровно один POST
  // с меткой prod-down и правильным телом.
  //
  // Прогонов ДВА, и второй обязателен (заход 7.206): первый — когда
  // открытого issue нет (заводится новый), второй — когда он уже есть
  // (дополняется комментарием). Именно во втором проверяется, что
  // упоминания владельца в комментарии НЕТ: без этого прогона правило
  // «один отказ — одно упоминание» было бы написано словами и не
  // проверено ничем.
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawn } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "alarm-plant-"));
  const file = join(dir, "smoke-result.json");
  writeFileSync(file, JSON.stringify({ checked: 12, failures: RED, results: [] }));

  /** Один сквозной прогон против подменённого GitHub. `openIssues` —
   *  то, что отдаёт поддельный список открытых issue. */
  async function endToEndRun(openIssues) {
    const seen = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen.push({ method: req.method, url: req.url, body });
        res.writeHead(200, { "content-type": "application/json" });
        if (req.method === "GET" && req.url.includes("/issues?")) return res.end(JSON.stringify(openIssues));
        if (req.method === "GET" && req.url.includes("/comments")) return res.end("[]");
        res.end(JSON.stringify({ number: 101 }));
      });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const port = server.address().port;

    // spawn, а НЕ spawnSync: подменённый GitHub живёт в ЭТОМ же процессе, и
    // синхронное ожидание заблокировало бы его событийный цикл — дочерний
    // запрос не был бы обслужен никогда. Стоило одного зависшего прогона.
    const run = await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [process.argv[1], `--result=${file}`, `--github-api=http://127.0.0.1:${port}`, `--vercel-api=http://127.0.0.1:${port}`],
        {
          env: { ...process.env, GITHUB_TOKEN: "t", GITHUB_REPOSITORY: "o/r", GITHUB_RUN_ID: "1", DEPLOY_SHA: "ccc3333", VERCEL_TOKEN: "", VERCEL_PROJECT_ID: "" },
        },
      );
      let stderr = "";
      child.stderr.on("data", (c) => (stderr += c));
      child.stdout.on("data", () => {});
      child.on("close", (status) => resolve({ status, stderr }));
    });
    server.close();
    return { seen, run };
  }

  const { seen, run } = await endToEndRun([]);
  // Второй прогон: issue с меткой уже открыт.
  const second = await endToEndRun([{ number: 101, body: "старое тело" }]);
  const secondComment = second.seen
    .filter((s) => s.method === "POST" && s.url.includes("/comments"))
    .map((s) => JSON.parse(s.body).body);

  const posts = seen.filter((s) => s.method === "POST");
  const createdIssue = posts.find((s) => s.url.endsWith("/issues"));
  const created = createdIssue ? JSON.parse(createdIssue.body) : null;
  const labelled = created?.labels?.includes(ISSUE_LABEL);
  const saysNoRollback = created?.body?.includes("Автооткат ВЫКЛЮЧЕН");
  const noVercelCall = !seen.some((s) => s.url.includes("/v6/deployments") || s.url.includes("/promote/"));

  const endToEnd = [
    ["сквозной прогон завершился без ошибки", run.status === 0],
    ["наружу ушёл ровно один POST на заведение issue", posts.filter((s) => s.url.endsWith("/issues")).length === 1],
    ["у issue стоит метка prod-down", Boolean(labelled)],
    // Два события, на которые у владельца включён push в приложении
    // GitHub: Assigned и Direct Mention. Оба обязаны быть у ПЕРВОГО
    // issue, иначе тревога доедет только до почты.
    ["issue назначен на владельца", created?.assignees?.includes(ISSUE_OWNER) === true],
    ["в теле issue есть упоминание владельца", created?.body?.includes(`@${ISSUE_OWNER}`) === true],
    ["без VERCEL_TOKEN в теле написано, что автооткат выключен", Boolean(saysNoRollback)],
    ["без VERCEL_TOKEN в Vercel не ушло ни одного запроса", noVercelCall],
    // Повторное падение: тот же issue, комментарий — и НИ ОДНОГО нового
    // упоминания. Иначе каждый час аварии звонил бы владельцу заново.
    ["второе падение не заводит второго issue", second.seen.filter((s) => s.method === "POST" && s.url.endsWith("/issues")).length === 0],
    ["второе падение дополняет открытый issue комментарием", secondComment.length === 1],
    ["в комментарии упоминания владельца НЕТ", secondComment.every((body) => !body.includes(`@${ISSUE_OWNER}`))],
    ["второй прогон завершился без ошибки", second.run.status === 0],
  ];
  for (const [title, ok] of endToEnd) {
    if (ok) caught += 1;
    else wrong.push(title);
    console.log(`  ${ok ? "СОШЛОСЬ " : "НЕ СОШЛОСЬ"} ${title}`);
  }
  if (run.status !== 0) console.log(run.stderr?.slice(0, 400));

  const total = cases.length + endToEnd.length;
  console.log(`\nсошлось ${caught} из ${total}`);
  if (wrong.length) {
    console.error("НЕ СОШЛОСЬ: " + wrong.join("; "));
    process.exit(1);
  }
  console.log("контроль пройден");
}

if (IS_ENTRY_POINT) {
  await main();
}
