import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLessonAttempt, saveLessonAttempt } from "@/lib/progress";
import { isLevelSlug, isLessonSlug, isFreeTrialLesson } from "@/lib/courses";
import { getRateLimiter } from "@/lib/rate-limit";
import { awardBadgesSafely } from "@/lib/badges";
import { userHasActiveSubscription } from "@/lib/subscription";
import { isStaff } from "@/lib/roles";
import type { AnswerMap, MistakeDetail } from "@/lib/lessons/scoring";

function isMistakeDetail(value: unknown): value is MistakeDetail {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.exerciseId === "string" &&
    typeof v.prompt === "string" &&
    typeof v.yourAnswer === "string" &&
    typeof v.correctAnswer === "string" &&
    (v.explanation === undefined || typeof v.explanation === "string")
  );
}

// AnswerValue is one of a small set of JSON-safe shapes (see
// src/lib/lessons/scoring.ts) — this only needs to reject the obviously
// wrong top-level shape (not a plain object) and cap total size, not
// deeply validate every possible answer shape, since a malformed value
// just fails to render usefully on restore rather than causing harm.
function isPlainAnswerMap(value: unknown): value is AnswerMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Generous limit: a student re-checking exercises a few times per lesson
// is normal use, this only stops a runaway client from hammering the DB.
const progressLimiter = getRateLimiter("progress", 60_000, 30);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (await progressLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const level = typeof body?.level === "string" ? body.level : "";
  const lesson = typeof body?.lesson === "string" ? body.lesson : "";

  // Same access rule as the lesson page itself (src/app/[lang]/courses/[level]/[lesson]/page.tsx)
  // — every lesson except the free-trial one is behind the paywall, so
  // recording an attempt elsewhere without a subscription is either a
  // stale session or a client bypassing the page's gate; either way, this
  // must not let a non-subscriber fabricate lesson completions that then
  // feed badges, streaks, and public leaderboards.
  if (!isStaff(user.role) && !isFreeTrialLesson(level, lesson) && !(await userHasActiveSubscription(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const score =
    typeof body?.score === "number" && Number.isFinite(body.score)
      ? Math.max(0, Math.min(100, Math.round(body.score)))
      : 0;
  const passed = body?.passed === true;
  const mistakes = Array.isArray(body?.mistakes)
    ? body.mistakes.filter(isMistakeDetail).slice(0, 20)
    : [];
  const answersRaw = isPlainAnswerMap(body?.answers) ? body.answers : {};
  // A real lesson's answers JSON is a few hundred bytes; 20kb is a generous
  // ceiling that only kicks in on a malformed/abusive payload.
  const answers = JSON.stringify(answersRaw).length <= 20_000 ? answersRaw : {};

  if (!isLevelSlug(level) || !isLessonSlug(level, lesson)) {
    return NextResponse.json(
      { error: "Invalid level or lesson" },
      { status: 400 },
    );
  }

  await saveLessonAttempt(user.id, level, lesson, score, passed, mistakes, answers);
  // Deferred via after() — see flashcard-progress/route.ts's comment for
  // why. This route fires on every "Comprobar" click, pass or fail, so
  // awaiting the full badge-evaluation scan here added it to every single
  // exercise check's response time.
  after(() => awardBadgesSafely(user.id));

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") ?? "";
  const lesson = searchParams.get("lesson") ?? "";
  if (!isLevelSlug(level) || !isLessonSlug(level, lesson)) {
    return NextResponse.json({ error: "Invalid level or lesson" }, { status: 400 });
  }

  const attempt = await getLessonAttempt(user.id, level, lesson);
  return NextResponse.json({ attempt });
}
