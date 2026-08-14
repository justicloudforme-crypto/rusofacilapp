import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { isLevelSlug, isLessonSlug } from "@/lib/courses";
import { getLessonContent } from "@/lib/lessons/content";
import { getCurrentUser } from "@/lib/auth";
import { userHasActiveSubscription } from "@/lib/subscription";
import { isStaff } from "@/lib/roles";
import { getDictionary } from "@/i18n/dictionaries";
import { LessonSlidesDocument } from "@/lib/lessons/pdf";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/lessons/[level]/[lesson]/pdf">
) {
  const { level, lesson } = await ctx.params;
  if (!isLevelSlug(level) || !isLessonSlug(level, lesson)) {
    return NextResponse.json({ error: "invalid_lesson" }, { status: 404 });
  }

  // Same access rule as the lesson page itself (src/app/[lang]/courses/[level]/[lesson]/page.tsx)
  // — the PDF must not be a way to read paywalled content without a subscription.
  const user = await getCurrentUser();
  if (!user || (!isStaff(user.role) && !(await userHasActiveSubscription(user.id)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const content = await getLessonContent(level, lesson);
  if (!content?.slides || content.slides.length === 0) {
    return NextResponse.json({ error: "no_slides" }, { status: 404 });
  }

  // Lesson content is always authored in Spanish regardless of UI language
  // (see src/lib/lessons/content.ts), so the PDF header follows suit.
  const dict = await getDictionary("es");
  const levelDict = dict.courses.levels[level];
  const lessonTitle = levelDict.lessons[Number(lesson) - 1] ?? `Lección ${lesson}`;

  const buffer = await renderToBuffer(
    <LessonSlidesDocument
      levelLabel={levelDict.title}
      lessonSlug={lesson}
      lessonTitle={lessonTitle}
      slides={content.slides}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rusofasil-${level}-${lesson}.pdf"`,
    },
  });
}
