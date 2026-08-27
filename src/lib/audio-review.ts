import "server-only";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local-only story-audio QA tool (see src/app/[lang]/admin/audio-review).
 * Findings come from prisma/audit-story-audio.ts (a read-only script,
 * re-run by hand whenever the owner wants a fresh pass — this file never
 * regenerates that data itself). Decisions ("ok" / "regenerate") are kept
 * in a separate plain JSON file rather than a new Prisma model/table —
 * standing project rule: any DB schema change needs the owner's explicit
 * "ok" first, and a flat file is exactly the "or a file" option they
 * offered when asking for this page. Both files live in prisma/ next to
 * the audit script but are NOT narration data — see .gitignore.
 */

const FINDINGS_FILE = path.join(process.cwd(), "prisma", "audio-review-findings.json");
const DECISIONS_FILE = path.join(process.cwd(), "prisma", "audio-review-decisions.json");

export interface AudioReviewIssue {
  type: string;
  severity: number;
  message: string;
}

export interface AudioReviewFinding {
  storyId: string;
  storyTitle: string;
  storyLevel: string;
  itemKey: string;
  text: string;
  audioUrl: string;
  voice: string;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  issues: AudioReviewIssue[];
  maxSeverity: number;
}

export interface AudioReviewFindingsFile {
  generatedAt: string;
  totalClips: number;
  findings: AudioReviewFinding[];
}

export type AudioReviewDecisionValue = "ok" | "regenerate";

export interface AudioReviewDecision {
  decision: AudioReviewDecisionValue;
  decidedAt: string;
}

export type AudioReviewDecisions = Record<string, AudioReviewDecision>;

export function decisionKey(storyId: string, itemKey: string): string {
  return `${storyId}::${itemKey}`;
}

export async function loadFindings(): Promise<AudioReviewFindingsFile | null> {
  try {
    const raw = await readFile(FINDINGS_FILE, "utf-8");
    return JSON.parse(raw) as AudioReviewFindingsFile;
  } catch {
    return null;
  }
}

export async function loadDecisions(): Promise<AudioReviewDecisions> {
  try {
    const raw = await readFile(DECISIONS_FILE, "utf-8");
    return JSON.parse(raw) as AudioReviewDecisions;
  } catch {
    return {};
  }
}

export async function saveDecision(storyId: string, itemKey: string, decision: AudioReviewDecisionValue): Promise<void> {
  const decisions = await loadDecisions();
  decisions[decisionKey(storyId, itemKey)] = { decision, decidedAt: new Date().toISOString() };
  await writeFile(DECISIONS_FILE, JSON.stringify(decisions, null, 2));
}

export async function clearDecision(storyId: string, itemKey: string): Promise<void> {
  const decisions = await loadDecisions();
  delete decisions[decisionKey(storyId, itemKey)];
  await writeFile(DECISIONS_FILE, JSON.stringify(decisions, null, 2));
}
