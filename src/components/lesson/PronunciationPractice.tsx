import type { VocabularyItem } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import SpeakButton from "./SpeakButton";
import { vocabAudioKey } from "@/lib/lessons/audioKeys";
import VoiceRecorder from "./VoiceRecorder";

type PronunciationDict = Dictionary["lesson"]["pronunciation"];

const MAX_WORDS = 6;

/** Non-scored practice block: listen to a model word, then record and
 * compare your own pronunciation. Uses the lesson's own vocabulary, so it
 * needs no extra authoring per lesson. */
export default function PronunciationPractice({
  vocabulary,
  level,
  lessonSlug,
  dict,
  audioMap,
  ownerScope,
}: {
  vocabulary: VocabularyItem[];
  level: string;
  lessonSlug: string;
  dict: PronunciationDict;
  /** Which browser-storage bucket this student's recordings belong to —
   * see src/lib/recordings-owner.ts. Recordings never leave the device. */
  ownerScope: string;
  /** Pre-generated pronunciation audio (see prisma/generate-lesson-audio.ts),
   * keyed by the word's position in the lesson's full vocabulary array
   * (see src/lib/lessons/audioKeys.ts) — these are the same vocabulary
   * words already narrated for the Vocabulario tab. Safe as-is because
   * `items` below is always a slice starting at index 0, so each item's
   * position within `items` matches its position in the full array. */
  audioMap: Record<string, string>;
}) {
  const items = vocabulary.slice(0, MAX_WORDS);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-background p-4 dark:border-white/30">
      <div>
        <h3 className="text-sm font-semibold">{dict.title}</h3>
        <p className="mt-1 text-xs text-foreground/60">{dict.instructions}</p>
      </div>
      <div className="flex flex-col gap-4">
        {items.map((item, index) => (
          <div key={item.word} className="flex flex-col gap-2 border-t border-black/5 pt-3 first:border-t-0 first:pt-0 dark:border-white/30">
            <div className="flex items-center gap-2">
              <SpeakButton text={item.word} label={dict.listenLabel} audioUrl={audioMap[vocabAudioKey(index)]} />
              <span className="font-medium">{item.word}</span>
              <span className="text-xs text-foreground/50">[{item.transcription}]</span>
            </div>
            <VoiceRecorder
              dict={{
                recordLabel: dict.recordLabel,
                stopLabel: dict.stopLabel,
                retryLabel: dict.retryLabel,
                permissionDenied: dict.permissionDenied,
                unsupported: dict.recordingNotSupported,
                recordingFailed: dict.recordingFailed,
                playbackFailed: dict.playbackFailed,
                yourRecording: dict.yourRecording,
                storageUnavailable: dict.storageUnavailable,
                storageFull: dict.storageFull,
                savedRecordingLabel: dict.savedRecordingLabel,
                deleteRecordingLabel: dict.deleteRecordingLabel,
              }}
              target={{ level, lessonSlug, itemKey: item.word }}
              ownerScope={ownerScope}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
