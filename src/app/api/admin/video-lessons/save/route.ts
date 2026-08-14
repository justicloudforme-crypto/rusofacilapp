import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { validateVideoLessonData } from "@/lib/video-lesson/validateLesson";
import { saveVideoLesson } from "@/lib/video-lesson/lessonStore";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const lessonJson = typeof body?.lessonJson === "string" ? body.lessonJson : "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(lessonJson);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = validateVideoLessonData(parsed);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await saveVideoLesson(result.lesson);
  return NextResponse.json({ ok: true });
}
