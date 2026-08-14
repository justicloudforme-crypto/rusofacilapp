import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { isLevelSlug, isLessonSlug } from "@/lib/courses";
import { staticContentFor } from "@/lib/lessons/content";

const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["video/mp4", "video/webm", "video/ogg", "video/quicktime"]);

function extensionFor(file: File): string {
  const fromName = path.extname(file.name).toLowerCase();
  if (fromName) return fromName;
  const byType: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/ogg": ".ogv",
    "video/quicktime": ".mov",
  };
  return byType[file.type] ?? ".mp4";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const level = typeof form?.get("level") === "string" ? String(form.get("level")) : "";
  const lessonSlug = typeof form?.get("lesson") === "string" ? String(form.get("lesson")) : "";
  const file = form?.get("file");

  if (!isLevelSlug(level) || !isLessonSlug(level, lessonSlug)) {
    return NextResponse.json({ error: "invalid_lesson" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "videos", "lessons", level, lessonSlug);
  await mkdir(dir, { recursive: true });

  const filename = `video${extensionFor(file)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);

  const videoUrl = `/videos/lessons/${level}/${lessonSlug}/${filename}`;

  // Persist immediately so the upload isn't lost if the admin forgets to
  // click "Guardar" — LessonEditor also writes this same field on save.
  // Must merge onto the effective content (DB row, or the static seed
  // content.json as a fallback), otherwise a lesson with no prior custom
  // edit would get its real curriculum content wiped down to just
  // { videoUrl } the moment a video is uploaded.
  const existing = await db.lesson.findUnique({ where: { level_lessonSlug: { level, lessonSlug } } });
  const content = existing ? JSON.parse(existing.contentJson) : (staticContentFor(level, lessonSlug) ?? {});
  content.videoUrl = videoUrl;
  await db.lesson.upsert({
    where: { level_lessonSlug: { level, lessonSlug } },
    update: { contentJson: JSON.stringify(content), updatedBy: user.id },
    create: { level, lessonSlug, contentJson: JSON.stringify(content), updatedBy: user.id },
  });

  return NextResponse.json({ ok: true, videoUrl });
}
