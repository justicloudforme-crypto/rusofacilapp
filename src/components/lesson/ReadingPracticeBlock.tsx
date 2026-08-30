import type { LessonContent } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import SpeakButton from "./SpeakButton";
import { readingPracticeAudioKey } from "@/lib/lessons/audioKeys";
import VoiceRecorder from "./VoiceRecorder";

type ReadAloudDict = Dictionary["lesson"]["readAloud"];

export default function ReadingPracticeBlock({
  readingPractice,
  listenLabel,
  readAloudDict,
  level,
  lessonSlug,
  audioMap,
  ownerScope,
}: {
  readingPractice: NonNullable<LessonContent["readingPractice"]>;
  listenLabel: Dictionary["lesson"]["alphabet"]["listenLabel"];
  /** When provided, each item also gets a "record yourself reading it" block. */
  readAloudDict?: ReadAloudDict;
  level: string;
  lessonSlug: string;
  /** Pre-generated pronunciation audio (see prisma/generate-lesson-audio.ts),
   * keyed by item position (see src/lib/lessons/audioKeys.ts). */
  audioMap: Record<string, string>;
  /** Which browser-storage bucket this student's recordings belong to —
   * see src/lib/recordings-owner.ts. Recordings never leave the device. */
  ownerScope: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-background p-4 dark:border-white/30">
      <h3 className="text-sm font-semibold">{readingPractice.title}</h3>
      {readAloudDict && <p className="text-xs text-foreground/60">{readAloudDict.instructions}</p>}
      <div className="flex flex-col gap-3">
        {readingPractice.items.map((item, index) => (
          <div key={item.text} className="flex flex-col gap-2 border-t border-black/5 pt-3 first:border-t-0 first:pt-0 dark:border-white/30">
            <div className="flex items-center gap-3">
              <SpeakButton text={item.text} label={listenLabel} audioUrl={audioMap[readingPracticeAudioKey(index)]} />
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
                  recordingFailed: readAloudDict.recordingFailed,
                  playbackFailed: readAloudDict.playbackFailed,
                  yourRecording: readAloudDict.yourRecording,
                  storageUnavailable: readAloudDict.storageUnavailable,
                  storageFull: readAloudDict.storageFull,
                  savedRecordingLabel: readAloudDict.savedRecordingLabel,
                  deleteRecordingLabel: readAloudDict.deleteRecordingLabel,
                }}
                target={{ level, lessonSlug, itemKey: item.text }}
                ownerScope={ownerScope}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
