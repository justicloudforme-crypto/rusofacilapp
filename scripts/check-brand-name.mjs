// One spelling of the brand, everywhere a human reads it: RusoFácilapp.
//
// Why this exists. On 05.09.2026 the name was spelled `RusoFásil` in 53
// places at once, and two of them were surfaces the owner sees on a phone:
// the Android app label (`android/app/src/main/res/values/strings.xml`),
// which is the sender line the OS prints above every local notification,
// and the introductory presentation (`src/lib/intro/content.ts`, and the
// PDF built from it). The project was renamed on 16.08.2026; those places
// were simply never swept. Fixing them one at a time is what let the old
// spelling survive nine renames' worth of edits, so the sweep is now a
// check that runs in `npm run verify`.
//
// WHAT IS CHECKED. Every tracked text file is scanned for the DISPLAY form
// of the name — a capital `R` followed by some spelling of "ruso facil":
//
//     /Ruso ?F[áa][cs]il[A-Za-z]*/
//
// and every hit that is not exactly `RusoFácilapp` is a failure — in file
// CONTENT and in file PATHS both, because a download's file name is read by
// a human too. One shape is skipped: a hit immediately followed by `.com`
// is a host name, and the domain genuinely carries no accent
// (`rusofacilapp.com`); `canonical-host.test.ts` spells it in mixed case on
// purpose, to prove the redirect lowercases it. The
// pattern is deliberately case-SENSITIVE: lowercase `rusofacilapp` is the
// domain, and lowercase `rusofasil` only ever appears inside identifiers
// nobody reads as a name (localStorage keys such as
// `rusofasil:pending-progress`, the `com.rusofasil.app` bundle id, the
// Telegram handles `@rusofasil_history_bot`, and `rusofasil_*` references
// to memory files). Those are addresses, not text; renaming them would
// throw away user state, break an installed app's identity, or point at a
// Telegram account that does not exist. They are out of scope by
// construction, not by exception.
//
// THE ALLOWLIST IS PINNED BY COUNT. Four files are allowed to keep the old
// spelling, each for a reason written next to it, and each with the exact
// number of hits expected. A new mistake in an allowlisted file therefore
// still fails the check: the count no longer matches. A hit that
// disappears fails too, so a fixed file cannot quietly keep its exemption.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Only when this file is the process entry point. Everything below the
// definitions writes files and exits; importing it must do neither. Same
// rule and same inlined form as scripts/check-tokens.mjs — see
// src/lib/entry-point.ts for the incident behind it.
const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

const CORRECT = "RusoFácilapp";
const NAME = /Ruso ?F[áa][cs]il[A-Za-z]*/g;

/** file → { hits, why }. `hits` is exact; see the header on why. */
const ALLOWED = new Map([
  [
    "prisma/stories-data.ts",
    {
      hits: 278,
      why:
        "`author: \"RusoFásil (relato original)\"` — a value, not a label. It is " +
        "printed as the byline of 114 of the 330 frozen pages measured in " +
        "docs/frozen-baseline-2026-08-30.json, and the same string lives in the " +
        "production Story.author column. Rewriting it is a frozen-page regression " +
        "plus a production write; it waits for 25.09.2026 together with debt 34.",
    },
  ],
  [
    "src/lib/stories.ts",
    {
      hits: 3,
      why: "ORIGINAL_STORY_AUTHOR must equal the value in prisma/stories-data.ts exactly.",
    },
  ],
  [
    "src/lib/story-author.ts",
    { hits: 1, why: "Documents the same author literal it must not translate." },
  ],
  [
    "src/lib/story-author.test.ts",
    { hits: 4, why: "Pins the author literal and its row count (277)." },
  ],
  [
    "src/lib/story-culture.test.ts",
    { hits: 2, why: "Splits classics from originals by that same author literal." },
  ],
  [
    "src/lib/stories-catalog.ts",
    { hits: 1, why: "Comment naming the author literal above." },
  ],
  [
    "docs/frozen-baseline-2026-08-30.json",
    {
      hits: 114,
      why:
        "A record of what production served on 30.08.2026. Editing a measurement " +
        "to make a check pass would destroy the measurement.",
    },
  ],
  [
    "ios/App/App/RusoFacilappPRO.storekit",
    {
      hits: 0,
      path: true,
      why:
        "A StoreKit configuration FILE NAME, referenced by that exact string from " +
        "App.xcscheme. Xcode resolves it by path; renaming it is an Xcode change, " +
        "not a copy change, and no user ever sees it.",
    },
  ],
  [
    "ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme",
    { hits: 1, why: "Path to the StoreKit file above." },
  ],
  [
    "MOBILE.md",
    { hits: 3, why: "Instructions that name the StoreKit file above by its file name." },
  ],
  [
    "PROGRESS.md",
    {
      hits: null,
      why:
        "The project log. It quotes wrong spellings as evidence of what was found " +
        "and when; a log that cannot record a mistake cannot record its fix.",
    },
  ],
  [
    "bots/logs/history_bot.err.log",
    { hits: 1, why: "Telegram's own name for the bot account, printed by aiogram." },
  ],
  [
    "bots/logs/moderator_bot.err.log",
    { hits: 1, why: "Telegram's own name for the bot account, printed by aiogram." },
  ],
  [
    "bots/logs/notifier_bot.err.log",
    { hits: 1, why: "Telegram's own name for the bot account, printed by aiogram." },
  ],
  [
    "bots/logs/testing_bot.err.log",
    { hits: 1, why: "Telegram's own name for the bot account, printed by aiogram." },
  ],
  [
    "bots/logs/vocabulary_bot.err.log",
    { hits: 1, why: "Telegram's own name for the bot account, printed by aiogram." },
  ],
]);

const BINARY =
  /\.(png|jpg|jpeg|gif|webp|ico|mp3|wav|m4a|pdf|zip|ttf|otf|woff2?|jar|keystore|xcuserstate)$/i;

// This file is skipped entirely, and it is the one exemption that needs no
// pinned count: a checker for wrong spellings has to WRITE the wrong
// spellings — in the pattern, in the reasons, and in the three plants
// below. Checking itself would mean it can never be clean. Stated plainly
// rather than hidden: a genuine mistake in this file's own prose is the one
// place nothing catches.
const SELF = "scripts/check-brand-name.mjs";

function scan() {
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((f) => f && f !== SELF && !BINARY.test(f));

  /** [{file, line, text, context}] for every hit that is not the correct spelling. */
  const wrong = [];
  /** file → number of wrong hits, for the allowlist arithmetic. */
  const perFile = new Map();
  const note = (file, line, text, context) => {
    perFile.set(file, (perFile.get(file) ?? 0) + 1);
    wrong.push({ file, line, text, context });
  };

  for (const file of files) {
    // File paths are a surface too — a downloaded PDF is named by one.
    for (const match of file.matchAll(NAME)) {
      if (match[0] === CORRECT) continue;
      note(file, 0, match[0], `file path: ${file}`);
    }

    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!source.includes("uso")) continue;
    source.split("\n").forEach((line, i) => {
      for (const match of line.matchAll(NAME)) {
        if (match[0] === CORRECT) continue;
        // A host name, not a label: the domain carries no accent.
        const after = line.slice(match.index + match[0].length, match.index + match[0].length + 4);
        if (after === ".com") continue;
        note(file, i + 1, match[0], line.trim().slice(0, 120));
      }
    });
  }

  const failures = [];
  const unexpected = wrong.filter((hit) => !ALLOWED.has(hit.file));
  for (const hit of unexpected) {
    failures.push(
      `${hit.file}:${hit.line}  «${hit.text}» — expected «${CORRECT}»\n      ${hit.context}`,
    );
  }

  for (const [file, rule] of ALLOWED) {
    if (rule.hits === null) continue;
    const found = perFile.get(file) ?? 0;
    // `path: true` — the hit is in the file's own name, so the path pass
    // counts one on top of whatever the content holds.
    const expected = rule.hits + (rule.path ? 1 : 0);
    if (found === expected) continue;
    failures.push(
      `${file}: allowed ${expected} old spelling(s), found ${found}.\n` +
        `      Reason on record: ${rule.why}\n` +
        `      A changed count means either a NEW mistake in this file or a fixed one; ` +
        `update scripts/check-brand-name.mjs deliberately, do not widen the exemption.`,
    );
  }

  const allowedTotal = [...perFile].reduce((n, [f, c]) => (ALLOWED.has(f) ? n + c : n), 0);
  return { failures, unexpected, scanned: files.length, allowedTotal };
}

function report({ failures, unexpected, scanned, allowedTotal }) {
  if (failures.length) {
    console.error("check:brand — FAILED\n");
    for (const f of failures) console.error(`  ${f}\n`);
    console.error(
      `Scanned ${scanned} tracked files. ` +
        `${unexpected.length} hit(s) outside the allowlist, ${allowedTotal} inside it.`,
    );
    return false;
  }
  console.log(
    "check:brand — one spelling everywhere. " +
      `Scanned ${scanned} tracked files; 0 wrong spellings outside the allowlist, ` +
      `${allowedTotal} inside it across ${ALLOWED.size} files, every count pinned.`,
  );
  return true;
}

// `--plant` is the positive control, and it is the whole point of the file:
// a check that has never been seen to fail is not evidence of anything. It
// plants the old spelling three ways — in an ordinary file, as an EXTRA hit
// inside an allowlisted file (the exemption must not absorb new mistakes),
// and in a file NAME — and requires the scan to catch each one and to come
// back clean afterwards.
function plantControls() {
  const PLANTED = "scripts/__brand-plant__.generated.ts";
  const controls = [
    {
      name: "old spelling in an ordinary file",
      plant: () => {
        writeFileSync(PLANTED, "// RusoFásil\nexport {};\n");
        execFileSync("git", ["add", "-N", PLANTED]);
      },
      undo: () => {
        execFileSync("git", ["rm", "-q", "--cached", PLANTED]);
        rmSync(PLANTED);
      },
      expect: (r) => r.unexpected.some((h) => h.file === PLANTED && h.line > 0),
    },
    {
      name: "one EXTRA old spelling inside an allowlisted file",
      plant: () => {
        const f = "src/lib/stories.ts";
        writeFileSync(f, "// RusoFásil\n" + readFileSync(f, "utf8"));
      },
      undo: () => {
        const f = "src/lib/stories.ts";
        writeFileSync(f, readFileSync(f, "utf8").replace("// RusoFásil\n", ""));
      },
      expect: (r) => r.failures.some((m) => m.startsWith("src/lib/stories.ts: allowed 3")),
    },
    {
      name: "old spelling in a file NAME",
      plant: () => {
        writeFileSync("scripts/RusoFasil-plant.generated.ts", "export {};\n");
        execFileSync("git", ["add", "-N", "scripts/RusoFasil-plant.generated.ts"]);
      },
      undo: () => {
        execFileSync("git", ["rm", "-q", "--cached", "scripts/RusoFasil-plant.generated.ts"]);
        rmSync("scripts/RusoFasil-plant.generated.ts");
      },
      expect: (r) => r.unexpected.some((h) => h.line === 0 && h.text === "RusoFasil"),
    },
  ];

  let ok = true;
  for (const control of controls) {
    control.plant();
    let caught;
    try {
      caught = control.expect(scan());
    } finally {
      control.undo();
    }
    console.log(`  ${caught ? "caught" : "MISSED"} — ${control.name}`);
    ok &&= caught;
  }
  const clean = scan();
  const cleanAgain = clean.failures.length === 0;
  console.log(`  ${cleanAgain ? "clean" : "STILL DIRTY"} — after undoing all three plants`);
  ok &&= cleanAgain;
  console.log(ok ? "check:brand --plant — 4 of 4" : "check:brand --plant — FAILED");
  return ok;
}

if (IS_ENTRY_POINT) {
  const ok = process.argv.includes("--plant") ? plantControls() : report(scan());
  process.exitCode = ok ? 0 : 1;
}
