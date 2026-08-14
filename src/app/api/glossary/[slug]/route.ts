import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseExamplesJson, parseRelatedLessonsJson } from "@/lib/glossary";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const term = await db.glossaryTerm.findUnique({ where: { slug } });
  if (!term) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    term: { ...term, relatedLessons: parseRelatedLessonsJson(term.relatedLessons), examples: parseExamplesJson(term.examples) },
  });
}
