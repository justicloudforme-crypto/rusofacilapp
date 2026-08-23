import "server-only";
import { db } from "./db";
import type { GlossaryExample } from "./glossary";

/** Attaches pre-generated narration URLs (see prisma/generate-glossary-
 * audio.ts) to a batch of glossary terms — a single AudioAsset query keyed
 * by contentId, not one query per term. `itemKey` is "term" for the
 * headword and `example-${i}` for each example sentence (index into the
 * term's own `examples` array, matching generate-glossary-audio.ts's
 * write-side convention). */
export async function attachGlossaryAudio<
  T extends { id: string; examples: GlossaryExample[] }
>(terms: T[]): Promise<(T & { audioUrl?: string })[]> {
  if (terms.length === 0) return terms as (T & { audioUrl?: string })[];

  const rows = await db.audioAsset.findMany({
    where: { contentType: "glossary", contentId: { in: terms.map((t) => t.id) } },
    select: { contentId: true, itemKey: true, audioUrl: true },
  });

  const byTerm = new Map<string, Map<string, string>>();
  for (const row of rows) {
    if (!byTerm.has(row.contentId)) byTerm.set(row.contentId, new Map());
    byTerm.get(row.contentId)!.set(row.itemKey, row.audioUrl);
  }

  return terms.map((term) => {
    const audioByKey = byTerm.get(term.id);
    return {
      ...term,
      audioUrl: audioByKey?.get("term"),
      examples: term.examples.map((example, i) => ({
        ...example,
        audioUrl: audioByKey?.get(`example-${i}`),
      })),
    };
  });
}
