/**
 * LLM-based topic tagging for the story catalog filter — replaces the
 * earlier keyword-heuristic version, which topped out with "family" (a
 * generic word list — мама/папа/брат show up in almost any dialogue)
 * swallowing 44% of the catalog and mystery stories going unrecognized
 * unless the word "тайна" happened to be in the title. One OpenAI call
 * per story (title + text in, exactly one topic key out via a
 * JSON-schema enum — never free text), model gpt-4o-mini. This is text
 * classification, NOT narration — no relation to the audio golden rule
 * in CLAUDE.md, and doesn't touch AudioAsset at all.
 *
 * RESUMABLE: every classified story is written to both the DB and a
 * local checkpoint file (prisma/.tag-story-topics-progress.json,
 * gitignored) immediately after its own API call returns — a crash or
 * Ctrl-C at story 200/315 loses nothing; re-running the same command
 * skips every story already in the checkpoint and only calls the API
 * for what's left, so a resumed run never re-bills already-classified
 * rows. Delete the checkpoint file to force a full re-classification.
 *
 * "other" is the model's own explicit answer when the prompt tells it
 * the story doesn't clearly fit any of the 7 real topics — never a
 * fallback for a malformed response (the JSON-schema enum makes a
 * malformed response impossible; a plain HTTP/network failure instead
 * leaves that story unclassified for this run, retried on the next one).
 *
 * isClassicStory (author-based, see src/lib/stories.ts) is NOT touched
 * here — that axis is reliable from existing data, no LLM needed.
 *
 * USAGE (against local dev.db, the default):
 *   npm run db:tag-story-topics                  # every story
 *   npm run db:tag-story-topics -- --limit=20     # first 20 only (pilot run)
 *   npm run db:tag-story-topics -- --random=20    # 20 random stories (pilot run)
 *
 * USAGE (against production — export the same Turso credentials
 * src/lib/db.ts uses, then run the same command):
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run db:tag-story-topics
 */
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { storyTopics, type StoryTopic } from "../src/lib/stories";

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

const CHECKPOINT_PATH = path.join(__dirname, ".tag-story-topics-progress.json");
const REAL_TOPICS = storyTopics.filter((t) => t !== "other") as Exclude<StoryTopic, "other">[];

const TOPIC_DESCRIPTIONS: Record<Exclude<StoryTopic, "other">, string> = {
  daily_life: "an ordinary/mundane routine — chores, small everyday hassles, neighbors, errands",
  family: "the STORY'S SUBJECT is a family relationship itself (reconciliation, conflict, loss, bonding) — not merely a story that happens to feature a parent, sibling, or grandparent among its characters",
  work_study: "workplace, career, job interviews, school/university studies, exams",
  childhood: "centered on a child protagonist or a childhood memory as the main subject",
  mystery: "a secret, a puzzle, something hidden or unexplained that drives the plot",
  nature_travel: "travel, journeys, or nature (forests, mountains, sea) as a central element",
  wisdom_morals: "ONLY traditional fables, parables, or folk tales told IN THAT FORMAT (e.g. Krylov's fables, 'Морозко', 'Каша из топора') — NOT a modern slice-of-life story that simply ends with a personal realization or takeaway. A contemporary story is classified by its actual SUBJECT even when it ends with a lesson.",
};

function parseArgs(argv: string[]) {
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const randomArg = argv.find((a) => a.startsWith("--random="));
  return {
    limit: limitArg ? Number(limitArg.split("=")[1]) : null,
    random: randomArg ? Number(randomArg.split("=")[1]) : null,
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadCheckpoint(): Promise<Record<string, StoryTopic>> {
  try {
    return JSON.parse(await readFile(CHECKPOINT_PATH, "utf-8"));
  } catch {
    return {};
  }
}

async function saveCheckpoint(checkpoint: Record<string, StoryTopic>) {
  await writeFile(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
}

async function classifyStory(apiKey: string, title: string, text: string): Promise<StoryTopic> {
  const prompt = [
    "You classify short Russian-language stories (for Spanish-speaking learners of Russian) into exactly one topic.",
    "",
    "IMPORTANT: a topic is what the story is ABOUT, not who appears in it. A mother, brother, or",
    "grandfather being a character does NOT by itself make a story 'family' — only pick 'family' when",
    "a family relationship is the actual subject the story is about.",
    "",
    "Examples of this distinction:",
    "- 'Репка' (grandpa, grandma, granddaughter, dog, cat, and mouse together pull up a giant turnip) is",
    "  about succeeding through joint effort, not about their family bond -> wisdom_morals, not family.",
    "- 'Теремок' (a growing group of animals move into a little house together) is about cooperation",
    "  and community, not family -> wisdom_morals, not family.",
    "- 'Маша и медведь' (a lost girl outwits a bear to get back home) is a child protagonist's",
    "  adventure -> childhood, not family, even though it's a beloved family-oriented tale.",
    "",
    "wisdom_morals is a VERY NARROW category — reserved ONLY for stories told in the traditional",
    "fable/parable/folk-tale FORMAT (Krylov's fables, 'Морозко', 'Каша из топора'). It is NOT a bucket",
    "for modern stories that happen to end with a personal realization or takeaway — classify those by",
    "their actual subject matter instead, even when they end with a lesson:",
    "- 'Честный отказ' (a coworker keeps borrowing money and not repaying it; the other sets a boundary",
    "  and offers a budgeting plan instead) is a WORKPLACE story -> work_study, not wisdom_morals, even",
    "  though it ends with a small lesson about honesty.",
    "- 'Урок от дочери' (a father learns to video-call from his teenage daughter) is a FAMILY story",
    "  -> family, not wisdom_morals, even though it ends with a lesson about learning from your child.",
    "- 'Ночь перед Рождеством' (a blacksmith flies on a devil's back through a magical Christmas Eve",
    "  night) is a fantastical/folkloric tale, not a stated moral -> mystery, not wisdom_morals.",
    "If you are not looking at an actual fable/parable/folk-tale, do NOT pick wisdom_morals just",
    "because the ending contains a lesson — nearly every short story has some takeaway, and that alone",
    "does not make it a fable.",
    "",
    "Topics:",
    ...REAL_TOPICS.map((t) => `- ${t}: ${TOPIC_DESCRIPTIONS[t]}`),
    '- other: use this if the story does not clearly fit any topic above. Prefer "other" over guessing.',
    "",
    `Title: ${title}`,
    `Text: ${text.slice(0, 4000)}`,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "story_topic",
          strict: true,
          schema: {
            type: "object",
            properties: { topic: { type: "string", enum: [...storyTopics] } },
            required: ["topic"],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(data.choices[0].message.content) as { topic: string };
  return storyTopics.includes(parsed.topic as StoryTopic) ? (parsed.topic as StoryTopic) : "other";
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set — nothing to do.");
    process.exitCode = 1;
    return;
  }

  const { limit, random } = parseArgs(process.argv.slice(2));

  const allStories = await db.story.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, text: true },
  });
  const ordered = random ? shuffle(allStories) : allStories;
  const count = random ?? limit;
  const stories = count ? ordered.slice(0, count) : ordered;
  const checkpoint = await loadCheckpoint();
  const remaining = stories.filter((s) => !(s.id in checkpoint));

  console.log(`${stories.length} stories in scope, ${stories.length - remaining.length} already done, ${remaining.length} to classify.`);

  for (const [index, story] of remaining.entries()) {
    try {
      const topic = await classifyStory(apiKey, story.title, story.text);
      await db.story.update({ where: { id: story.id }, data: { topic } });
      checkpoint[story.id] = topic;
      await saveCheckpoint(checkpoint);
      console.log(`  [${index + 1}/${remaining.length}] ${story.title} -> ${topic}`);
    } catch (err) {
      console.error(`  [${index + 1}/${remaining.length}] ${story.title} FAILED:`, err);
      console.error("  Stopping — re-run the same command to resume from here.");
      process.exitCode = 1;
      return;
    }
  }

  const counts: Record<StoryTopic, number> = Object.fromEntries(storyTopics.map((t) => [t, 0])) as Record<
    StoryTopic,
    number
  >;
  for (const story of stories) {
    const topic = checkpoint[story.id];
    if (topic) counts[topic] += 1;
  }

  console.log("\nTopic breakdown (this run's scope):");
  for (const topic of storyTopics) {
    const pct = ((counts[topic] / stories.length) * 100).toFixed(1);
    console.log(`  ${topic}: ${counts[topic]} (${pct}%)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
