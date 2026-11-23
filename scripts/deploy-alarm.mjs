#!/usr/bin/env node
/**
 * ТРЕВОГА «ВЫКАТ НА ПРОД НЕ СОБРАЛСЯ» — долг 420 (заход 7.303).
 *
 *   node scripts/deploy-alarm.mjs                 — из Actions (нужны GITHUB_TOKEN, GITHUB_REPOSITORY)
 *   node scripts/deploy-alarm.mjs --dry-run       — только прочитать и напечатать решение (ничего не писать)
 *   node scripts/deploy-alarm.mjs --plant         — позитивный и отрицательный контроль против подменённого GitHub
 *
 * ЗАЧЕМ. 23.11.2026 шесть выкатов подряд (мержи #564–#569) упали на сборке
 * Vercel («Deployment has failed»), а живой сайт остался на #562. Никто об
 * этом не узнал: «Прод после выката» запускает проверки только на
 * `deployment_status == success`, на `failure` все задания — `skipped`,
 * прогон серый, письма нет. Заметили сверкой при входе в следующий заход.
 *
 * ЧТО ДЕЛАЕТ. Берёт САМЫЙ СВЕЖИЙ GitHub Deployment окружения `Production`
 * (их заводит Vercel; документные коммиты, отменённые Ignored Build Step,
 * Deployment не заводят вовсе — сверено на #563 и #566… см. PROGRESS 7.303)
 * и его последний статус:
 *
 *   failure / error  → issue с меткой `deploy-failed`, назначен на владельца,
 *                      в теле — коммит, ссылка на выкат в Vercel и команда
 *                      журнала; прогон КРАСНЫЙ (письмо «Run failed»);
 *   success          → открытый issue `deploy-failed` закрывается с
 *                      «выкат снова собрался»; прогон зелёный;
 *   pending/queued/in_progress, нет выкатов → ничего, зелёный.
 *
 * По расписанию (раз в час) тот же отказ повторно не заводится и прогон не
 * краснеет, если issue на этот же коммит уже открыт — issue и есть
 * постоянная тревога; краснеет новый отказ (другой коммит) или событие
 * самого выката.
 *
 * КОНТРОЛЬ НА НАСТОЯЩЕМ GITHUB: ручной запуск «Прод после выката» с
 * `control: deploy_failed` подкладывает вместо настоящего статуса `failure`
 * — прогон обязан покраснеть и завести issue с пометкой «КОНТРОЛЬ»; закроет
 * его следующий прогон по расписанию, если настоящий выкат зелёный.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendFileSync } from "node:fs";

export const ISSUE_LABEL = "deploy-failed";
export const ISSUE_OWNER = "justicloudforme-crypto";
const MARK = "deploy-alarm sha=";

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const GITHUB_API = arg("github-api", "https://api.github.com");

async function api(url, { token, method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
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

const FAILED = new Set(["failure", "error"]);

/**
 * Чистое решение — подсадки судят именно его.
 *   latest: { sha, state, url, description } | null  — свежий выкат Production и его последний статус
 *   openIssue: { number, sha } | null                 — открытый issue `deploy-failed` и коммит в его метке
 *   trigger: "deployment_status" | "schedule" | "workflow_dispatch"
 * → { action: "open" | "comment" | "resolve" | "none", red: boolean }
 */
export function decide({ latest, openIssue, trigger }) {
  if (!latest) return { action: "none", red: false };
  if (FAILED.has(latest.state)) {
    if (!openIssue) return { action: "open", red: true };
    if (openIssue.sha !== latest.sha) return { action: "comment", red: true };
    // Тот же коммит уже в тревоге: по расписанию — не дублировать и не
    // звонить каждый час; на событии выката или ручном запуске — красный.
    return { action: "none", red: trigger !== "schedule" };
  }
  if (latest.state === "success") return { action: openIssue ? "resolve" : "none", red: false };
  return { action: "none", red: false };
}

function issueBody({ latest, runUrl, control }) {
  const short = latest.sha.slice(0, 8);
  const dpl = /inspect\s+(dpl_[A-Za-z0-9]+)/.exec(latest.description ?? "")?.[1];
  return [
    control ? `**${control}**\n` : "",
    `@${ISSUE_OWNER} выкат на прод **не собрался** — живой сайт остался на прежней версии, новый код до посетителей не дошёл.`,
    "",
    `- коммит: \`${short}\``,
    `- статус Vercel: \`${latest.state}\` — ${latest.description ?? "без описания"}`,
    latest.url ? `- выкат в Vercel: ${latest.url}` : "",
    `- прогон тревоги: ${runUrl}`,
    "",
    "**Что делать владельцу.** Ничего не мержить поверх. Открыть ссылку выката выше → вкладка **Build Logs** →",
    "последние строки покажут причину (например, «out of memory»). Передать причину в следующий заход.",
    dpl ? `Журнал из терминала: \`npx vercel inspect ${dpl} --logs\`.` : "",
    "Живой сайт при этом работает на прошлом удачном выкате — откатывать нечего.",
    "",
    "Закроется сам, когда следующий выкат на прод соберётся (проверка раз в час и на каждом выкате).",
    "",
    `<!-- ${MARK}${latest.sha} -->`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function shaFromIssue(text) {
  const m = new RegExp(`${MARK}([0-9a-f]{7,40})`).exec(text ?? "");
  return m ? m[1] : null;
}

async function readLatest({ repo, token }) {
  const list = await api(`${GITHUB_API}/repos/${repo}/deployments?environment=Production&per_page=5`, { token });
  if (!list?.length) return null;
  // GitHub отдаёт свежие первыми; сортировка — на случай другой выдачи.
  const dep = [...list].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const statuses = await api(`${GITHUB_API}/repos/${repo}/deployments/${dep.id}/statuses?per_page=5`, { token });
  const top = statuses?.[0];
  return {
    sha: dep.sha,
    state: top?.state ?? "pending",
    url: top?.target_url ?? top?.log_url ?? "",
    description: top?.description ?? "",
    created: dep.created_at,
  };
}

async function main() {
  if (argv.includes("--plant")) return plant();
  const dryRun = argv.includes("--dry-run");
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.error("нужны GITHUB_TOKEN и GITHUB_REPOSITORY");
    process.exit(2);
  }
  const trigger = process.env.GITHUB_EVENT_NAME || "workflow_dispatch";
  const control = process.env.DEPLOY_ALARM_CONTROL === "deploy_failed";
  const runUrl = `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID ?? "local"}`;

  let latest = await readLatest({ repo, token });
  console.log(`свежий выкат Production: ${latest ? `${latest.sha.slice(0, 8)} ${latest.state} (${latest.created})` : "нет"}`);
  if (control) {
    // Подложенный отказ: настоящий статус заменён, всё остальное — как в аварии.
    latest = {
      sha: latest?.sha ?? "0000000000000000000000000000000000000000",
      state: "failure",
      url: latest?.url ?? "",
      description: "КОНТРОЛЬ deploy_failed: подложенный статус, настоящий выкат не проверялся",
    };
    console.log("КОНТРОЛЬ deploy_failed: статус подменён на failure");
  }

  const open = await api(`${GITHUB_API}/repos/${repo}/issues?state=open&labels=${ISSUE_LABEL}&per_page=1`, { token });
  let openIssue = null;
  if (open?.length) {
    const comments = await api(`${GITHUB_API}/repos/${repo}/issues/${open[0].number}/comments?per_page=100`, { token });
    const texts = [open[0].body ?? "", ...(comments ?? []).map((c) => c.body ?? "")];
    const shas = texts.map(shaFromIssue).filter(Boolean);
    openIssue = { number: open[0].number, sha: shas.at(-1) ?? null };
  }

  const verdict = decide({ latest, openIssue, trigger });
  console.log(`решение: ${verdict.action}, прогон ${verdict.red ? "КРАСНЫЙ" : "зелёный"} (повод: ${trigger})`);
  if (dryRun) {
    console.log("--dry-run: в GitHub ничего не пишется");
    return verdict.red ? 1 : 0;
  }

  const controlNote = control
    ? "КОНТРОЛЬ deploy_failed (ручной запуск): статус выката подложен, это проверка тревоги, а не авария. Закроет issue следующий прогон по расписанию при зелёном выкате."
    : "";
  if (verdict.action === "open") {
    const created = await api(`${GITHUB_API}/repos/${repo}/issues`, {
      token,
      method: "POST",
      body: {
        title: `${control ? "КОНТРОЛЬ: " : ""}Выкат на прод не собрался (${latest.sha.slice(0, 8)})`,
        labels: [ISSUE_LABEL],
        assignees: [ISSUE_OWNER],
        body: issueBody({ latest, runUrl, control: controlNote }),
      },
    });
    console.log(`заведён issue #${created.number}`);
    const gotLabel = (created.labels ?? []).some((l) => (typeof l === "string" ? l : l?.name) === ISSUE_LABEL);
    if (!gotLabel) {
      // Без метки следующий прогон issue не найдёт и заведёт ещё один.
      console.error(`::error::issue #${created.number} заведён БЕЗ метки ${ISSUE_LABEL}`);
      return 1;
    }
  } else if (verdict.action === "comment") {
    await api(`${GITHUB_API}/repos/${repo}/issues/${openIssue.number}/comments`, {
      token,
      method: "POST",
      body: { body: issueBody({ latest, runUrl, control: controlNote }) },
    });
    console.log(`дописан issue #${openIssue.number}`);
  } else if (verdict.action === "resolve") {
    await api(`${GITHUB_API}/repos/${repo}/issues/${openIssue.number}/comments`, {
      token,
      method: "POST",
      body: { body: `Выкат на прод снова собрался: \`${latest.sha.slice(0, 8)}\` — success. Закрываю. ${runUrl}` },
    });
    await api(`${GITHUB_API}/repos/${repo}/issues/${openIssue.number}`, { token, method: "PATCH", body: { state: "closed" } });
    console.log(`закрыт issue #${openIssue.number}`);
  }

  if (verdict.red) {
    const text = `Выкат на прод не собрался: ${latest.sha.slice(0, 8)} — ${latest.state}. Живой сайт на прежней версии. См. issue с меткой ${ISSUE_LABEL}.`;
    console.log(`::error title=Выкат не собрался::${text}`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${text}\n`);
    return 1;
  }
  return 0;
}

/* ───────────────────────────── контроль ───────────────────────────── */

/** Подменённый GitHub: отдаёт заданные выкаты и issue, записывает все запросы на запись. */
function fakeGitHub({ deployments, statuses, issues }) {
  const writes = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const url = new URL(req.url, "http://x");
      const send = (code, data) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      };
      if (req.method !== "GET") {
        writes.push({ method: req.method, path: url.pathname, body: body ? JSON.parse(body) : null });
        if (req.method === "POST" && /\/issues$/.test(url.pathname)) {
          const b = JSON.parse(body);
          return send(201, { number: 900, labels: (b.labels ?? []).map((name) => ({ name })) });
        }
        return send(200, {});
      }
      if (/\/deployments$/.test(url.pathname)) return send(200, deployments);
      const st = /\/deployments\/(\d+)\/statuses$/.exec(url.pathname);
      if (st) return send(200, statuses[st[1]] ?? []);
      if (/\/issues$/.test(url.pathname)) return send(200, issues);
      if (/\/issues\/\d+\/comments$/.test(url.pathname)) return send(200, []);
      return send(404, { message: "not found" });
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, writes, port: server.address().port })));
}

function runSelf({ port, env }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), `--github-api=http://127.0.0.1:${port}`], {
      env: { PATH: process.env.PATH, GITHUB_TOKEN: "plant", GITHUB_REPOSITORY: "o/r", GITHUB_RUN_ID: "1", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

const SHA_A = "c1721cbc0d1d0e1e2f3a4b5c6d7e8f9012345678";
const SHA_B = "65a620bf0d1d0e1e2f3a4b5c6d7e8f9012345678";
const dep = (id, sha, created) => ({ id, sha, environment: "Production", created_at: created });
const status = (state) => [
  {
    state,
    target_url: "https://vercel.com/team/project/abc",
    description: state === "failure" ? "Deployment has failed — run this Vercel CLI command: npx vercel inspect dpl_ABC123 --logs" : "Deployment has completed",
  },
];
const openIssueOn = (sha) => [{ number: 7, body: `…\n<!-- ${MARK}${sha} -->`, labels: [{ name: ISSUE_LABEL }] }];

async function plant() {
  console.log("deploy-alarm --plant — подменённый GitHub на 127.0.0.1, настоящий не трогается");
  const cases = [
    {
      title: "свежий выкат failure, issue нет → КРАСНЫЙ + issue deploy-failed на владельца (позитивный контроль)",
      gh: { deployments: [dep(2, SHA_A, "2026-11-23T20:35:47Z"), dep(1, SHA_B, "2026-11-23T00:23:26Z")], statuses: { 2: status("failure"), 1: status("success") }, issues: [] },
      env: { GITHUB_EVENT_NAME: "deployment_status" },
      expect: { code: 1, writes: ["POST /repos/o/r/issues"], check: (w) => w[0].body.labels.includes(ISSUE_LABEL) && w[0].body.assignees.includes(ISSUE_OWNER) && w[0].body.body.includes("vercel inspect dpl_ABC123") && w[0].body.body.includes(`${MARK}${SHA_A}`) },
    },
    {
      title: "свежий выкат error (не failure) → тоже КРАСНЫЙ + issue",
      gh: { deployments: [dep(2, SHA_A, "2026-11-23T20:35:47Z")], statuses: { 2: status("error") }, issues: [] },
      env: { GITHUB_EVENT_NAME: "schedule" },
      expect: { code: 1, writes: ["POST /repos/o/r/issues"] },
    },
    {
      title: "свежий выкат success, issue нет → зелёный, НИ ОДНОЙ записи (отрицательный контроль)",
      gh: { deployments: [dep(3, SHA_A, "2026-11-24T10:00:00Z"), dep(2, SHA_B, "2026-11-23T20:35:47Z")], statuses: { 3: status("success"), 2: status("failure") }, issues: [] },
      env: { GITHUB_EVENT_NAME: "deployment_status" },
      expect: { code: 0, writes: [] },
    },
    {
      title: "свежий выкат success, issue открыт → зелёный, комментарий и закрытие",
      gh: { deployments: [dep(3, SHA_A, "2026-11-24T10:00:00Z")], statuses: { 3: status("success") }, issues: openIssueOn(SHA_B) },
      env: { GITHUB_EVENT_NAME: "schedule" },
      expect: { code: 0, writes: ["POST /repos/o/r/issues/7/comments", "PATCH /repos/o/r/issues/7"], check: (w) => w[1].body.state === "closed" },
    },
    {
      title: "по расписанию тот же упавший коммит уже в issue → зелёный, без дубля",
      gh: { deployments: [dep(2, SHA_A, "2026-11-23T20:35:47Z")], statuses: { 2: status("failure") }, issues: openIssueOn(SHA_A) },
      env: { GITHUB_EVENT_NAME: "schedule" },
      expect: { code: 0, writes: [] },
    },
    {
      title: "упал НОВЫЙ коммит, issue открыт на старом → КРАСНЫЙ + комментарий в тот же issue",
      gh: { deployments: [dep(2, SHA_A, "2026-11-23T20:35:47Z")], statuses: { 2: status("failure") }, issues: openIssueOn(SHA_B) },
      env: { GITHUB_EVENT_NAME: "schedule" },
      expect: { code: 1, writes: ["POST /repos/o/r/issues/7/comments"] },
    },
    {
      title: "выкат ещё собирается (pending) → зелёный, без записей",
      gh: { deployments: [dep(2, SHA_A, "2026-11-23T20:35:47Z")], statuses: { 2: status("pending") }, issues: [] },
      env: { GITHUB_EVENT_NAME: "deployment_status" },
      expect: { code: 0, writes: [] },
    },
    {
      title: "КОНТРОЛЬ deploy_failed при зелёном выкате → КРАСНЫЙ + issue с пометкой «КОНТРОЛЬ»",
      gh: { deployments: [dep(3, SHA_A, "2026-11-24T10:00:00Z")], statuses: { 3: status("success") }, issues: [] },
      env: { GITHUB_EVENT_NAME: "workflow_dispatch", DEPLOY_ALARM_CONTROL: "deploy_failed" },
      expect: { code: 1, writes: ["POST /repos/o/r/issues"], check: (w) => w[0].body.title.startsWith("КОНТРОЛЬ") && w[0].body.body.includes("КОНТРОЛЬ deploy_failed") },
    },
  ];

  let ok = 0;
  for (const c of cases) {
    const fake = await fakeGitHub(c.gh);
    const { code, out } = await runSelf({ port: fake.port, env: c.env });
    fake.server.close();
    const got = fake.writes.map((w) => `${w.method} ${w.path}`);
    const pass =
      code === c.expect.code &&
      JSON.stringify(got) === JSON.stringify(c.expect.writes) &&
      (!c.expect.check || c.expect.check(fake.writes));
    if (pass) ok += 1;
    console.log(`  ${pass ? "СОШЛОСЬ   " : "НЕ СОШЛОСЬ"} ${c.title}`);
    if (!pass) console.log(`      код ${code}, записи ${JSON.stringify(got)}\n${out.split("\n").map((l) => "      | " + l).join("\n")}`);
  }

  // Чистое решение — те же правила без сети, плюс «выкатов нет».
  const pure = [
    [{ latest: null, openIssue: null, trigger: "schedule" }, "none", false],
    [{ latest: { sha: "a", state: "failure" }, openIssue: { number: 1, sha: "a" }, trigger: "deployment_status" }, "none", true],
    [{ latest: { sha: "a", state: "inactive" }, openIssue: null, trigger: "schedule" }, "none", false],
  ];
  for (const [input, action, red] of pure) {
    const v = decide(input);
    const pass = v.action === action && v.red === red;
    if (pass) ok += 1;
    console.log(`  ${pass ? "СОШЛОСЬ   " : "НЕ СОШЛОСЬ"} decide(${JSON.stringify(input)}) → ${v.action}/${v.red}`);
  }

  const total = cases.length + pure.length;
  console.log(`\ndeploy-alarm --plant: ${ok} из ${total}`);
  return ok === total ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(
    (code) => process.exit(code ?? 0),
    (error) => {
      console.error(`deploy-alarm: ${error?.stack ?? error}`);
      process.exit(2);
    },
  );
}
