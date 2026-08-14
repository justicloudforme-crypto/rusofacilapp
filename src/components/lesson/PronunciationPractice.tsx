import type { VocabularyItem } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import SpeakButton from "./SpeakButton";
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
}: {
  vocabulary: VocabularyItem[];
  level: string;
  lessonSlug: string;
  dict: PronunciationDict;
}) {
  const items = vocabulary.slice(0, MAX_WORDS);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-background p-4 dark:border-white/10">
      <div>
        <h3 className="text-sm font-semibold">{dict.title}</h3>
        <p className="mt-1 text-xs text-foreground/60">{dict.instructions}</p>
      </div>
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.word} className="flex flex-col gap-2 border-t border-black/5 pt-3 first:border-t-0 first:pt-0 dark:border-white/10">
            <div className="flex items-center gap-2">
              <SpeakButton text={item.word} label={dict.listenLabel} />
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
                yourRecording: dict.yourRecording,
                submitLabel: dict.submitLabel,
                submittingLabel: dict.submittingLabel,
                submittedLabel: dict.submittedLabel,
                submitError: dict.submitError,
                submitRateLimited: dict.submitRateLimited,
                previousRecordingLabel: dict.previousRecordingLabel,
              }}
              submission={{ level, lessonSlug, itemKey: item.word }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
