import type { VocabularyItem } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import SpeakButton from "./SpeakButton";

export default function VocabularyTab({
  vocabulary,
  dict,
  listenLabel,
  audioMap,
}: {
  vocabulary: VocabularyItem[];
  dict: Dictionary["lesson"]["vocabulary"];
  listenLabel: string;
  /** Pre-generated pronunciation audio for this lesson, keyed by the
   * Russian word — see prisma/generate-lesson-audio.ts. Omit (or leave a
   * word out of it) to fall back to browser speech synthesis for that
   * word. */
  audioMap?: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-foreground/50">
            <th className="pb-2 pr-2"></th>
            <th className="pb-2 pr-4">{dict.wordHeader}</th>
            <th className="pb-2 pr-4">{dict.transcriptionHeader}</th>
            <th className="pb-2">{dict.translationHeader}</th>
          </tr>
        </thead>
        <tbody>
          {vocabulary.map((item) => (
            <tr key={item.word} className="border-t border-black/5 dark:border-white/10">
              <td className="py-2.5 pr-2">
                <SpeakButton text={item.word} label={listenLabel} audioUrl={audioMap?.[item.word]} />
              </td>
              <td className="py-2.5 pr-4 font-medium">{item.word}</td>
              <td className="py-2.5 pr-4 font-mono text-foreground/60">
                [{item.transcription}]
              </td>
              <td className="py-2.5 text-foreground/80">{item.translation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
