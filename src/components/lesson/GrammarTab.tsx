import type { LessonContent } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import SpeakButton from "./SpeakButton";
import { lookupAudio } from "@/lib/speech";
import ReadingPracticeBlock from "./ReadingPracticeBlock";
import GlossaryText from "@/components/glossary/GlossaryText";
import GlossaryHint from "@/components/glossary/GlossaryHint";

export default function GrammarTab({
  grammar,
  readingPractice,
  spanishNote,
  dict,
  level,
  lessonSlug,
  audioMap,
}: {
  grammar: LessonContent["grammar"];
  readingPractice: LessonContent["readingPractice"];
  spanishNote: string;
  dict: Dictionary["lesson"];
  level: string;
  lessonSlug: string;
  /** Pre-generated pronunciation audio (see prisma/generate-lesson-audio.ts),
   * keyed by the Russian text — was never wired up here before, so every
   * grammar example silently fell back to the browser's free built-in
   * speech synthesis instead of the paid, cached narration. */
  audioMap: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <GlossaryHint />
      {spanishNote && (
        <p className="rounded-lg bg-foreground/5 px-3 py-2 text-xs text-foreground/60">
          {spanishNote}
        </p>
      )}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{grammar.title}</h2>
        <div className="flex flex-col gap-4">
          {grammar.paragraphs.map((paragraph) => (
            <GlossaryText key={paragraph} text={paragraph} className="leading-7 text-foreground/80" />
          ))}
        </div>
      </div>

      {grammar.examples && grammar.examples.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-background p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">{dict.alphabet.examplesTitle}</h3>
          <div className="flex flex-col gap-2">
            {grammar.examples.map((example) => (
              <div
                key={example.russian}
                className="flex items-center gap-3 border-t border-black/5 pt-2 first:border-t-0 first:pt-0 dark:border-white/10"
              >
                <SpeakButton text={example.russian} label={dict.alphabet.listenLabel} audioUrl={lookupAudio(audioMap, example.russian)} />
                <div className="flex flex-col">
                  <span className="font-medium">{example.russian}</span>
                  <span className="text-xs text-foreground/60">{example.translation}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {readingPractice && (
        <ReadingPracticeBlock
          readingPractice={readingPractice}
          listenLabel={dict.alphabet.listenLabel}
          readAloudDict={dict.readAloud}
          level={level}
          lessonSlug={lessonSlug}
          audioMap={audioMap}
        />
      )}
    </div>
  );
}
