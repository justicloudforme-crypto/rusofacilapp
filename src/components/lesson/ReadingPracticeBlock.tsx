import type { LessonContent } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import SpeakButton from "./SpeakButton";
import { lookupAudio } from "@/lib/speech";
import VoiceRecorder from "./VoiceRecorder";

type ReadAloudDict = Dictionary["lesson"]["readAloud"];

export default function ReadingPracticeBlock({
  readingPractice,
  listenLabel,
  readAloudDict,
  level,
  lessonSlug,
  audioMap,
}: {
  readingPractice: NonNullable<LessonContent["readingPractice"]>;
  listenLabel: Dictionary["lesson"]["alphabet"]["listenLabel"];
  /** When provided, each item also gets a "record yourself reading it" block. */
  readAloudDict?: ReadAloudDict;
  level: string;
  lessonSlug: string;
  /** Pre-generated pronunciation audio (see prisma/generate-lesson-audio.ts),
   * keyed by the Russian text — was never wired up here before, so every
   * reading-practice item silently fell back to the browser's free built-in
   * speech synthesis instead of the paid, cached narration. */
  audioMap: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-background p-4 dark:border-white/10">
      <h3 className="text-sm font-semibold">{readingPractice.title}</h3>
      {readAloudDict && <p className="text-xs text-foreground/60">{readAloudDict.instructions}</p>}
      <div className="flex flex-col gap-3">
        {readingPractice.items.map((item) => (
          <div key={item.text} className="flex flex-col gap-2 border-t border-black/5 pt-3 first:border-t-0 first:pt-0 dark:border-white/10">
            <div className="flex items-center gap-3">
              <SpeakButton text={item.text} label={listenLabel} audioUrl={lookupAudio(audioMap, item.text)} />
              <div className="flex flex-col">
                <span className="font-medium">{item.text}</span>
                {item.translation && (
                  <span className="text-xs text-foreground/60">{item.translation}</span>
                )}
              </div>
            </div>
            {readAloudDict && (
              <VoiceRecorder
                dict={{
                  recordLabel: readAloudDict.recordLabel,
                  stopLabel: readAloudDict.stopLabel,
                  retryLabel: readAloudDict.retryLabel,
                  permissionDenied: readAloudDict.permissionDenied,
                  unsupported: readAloudDict.recordingNotSupported,
                  yourRecording: readAloudDict.yourRecording,
                  submitLabel: readAloudDict.submitLabel,
                  submittingLabel: readAloudDict.submittingLabel,
                  submittedLabel: readAloudDict.submittedLabel,
                  submitError: readAloudDict.submitError,
                  submitRateLimited: readAloudDict.submitRateLimited,
                  previousRecordingLabel: readAloudDict.previousRecordingLabel,
                }}
                submission={{ level, lessonSlug, itemKey: item.text }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
