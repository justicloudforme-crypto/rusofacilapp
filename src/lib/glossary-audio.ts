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

  // Degrades instead of throwing (29.08.2026). This one query decorates
  // /es|ru/glossary and all 234 /glossary/[slug] URLs with a play button;
  // the definition, the Russian equivalent, the transcription, the
  // examples and every internal link are already in hand by the time it
  // runs. Letting it throw meant 236 crawlable pages of real content
  // returning 500 because a narration URL could not be looked up — the
  // same trade the sitemap outage taught: losing the decoration beats
  // losing the page.
  //
  // Not silent: a glossary that quietly stops speaking for weeks is its
  // own failure, and the play button is the reason the audio was paid for.
  let rows: { contentId: string; itemKey: string; audioUrl: string }[] = [];
  try {
    rows = await db.audioAsset.findMany({
      where: { contentType: "glossary", contentId: { in: terms.map((t) => t.id) } },
      select: { contentId: true, itemKey: true, audioUrl: true },
    });
  } catch (error) {
    console.error("[glossary-audio] could not read AudioAsset; serving terms without narration", error);
  }

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
