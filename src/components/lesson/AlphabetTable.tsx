import type { AlphabetLetter } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import SpeakButton from "./SpeakButton";
import { alphabetAudioKey } from "@/lib/lessons/audioKeys";

type AlphabetDict = Dictionary["lesson"]["alphabet"];

const GROUP_ORDER: AlphabetLetter["type"][] = ["vowel", "consonant", "sign"];

export default function AlphabetTable({
  alphabet,
  dict,
  audioMap,
}: {
  alphabet: AlphabetLetter[];
  dict: AlphabetDict;
  /** Pre-generated pronunciation audio (see prisma/generate-lesson-audio.ts),
   * keyed by the letter's position in the full `alphabet` array (see
   * src/lib/lessons/audioKeys.ts) — not by the letter groups this
   * component itself splits the array into for display. */
  audioMap: Record<string, string>;
}) {
  const groupLabel: Record<AlphabetLetter["type"], string> = {
    vowel: dict.vowels,
    consonant: dict.consonants,
    sign: dict.signs,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">{dict.title}</h2>
        <p className="mt-1 text-sm text-foreground/60">{dict.subtitle}</p>
      </div>

      {GROUP_ORDER.map((groupType) => {
        const letters = alphabet.filter((letter) => letter.type === groupType);
        if (letters.length === 0) return null;
        return (
          <div key={groupType} className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              {groupLabel[groupType]} ({letters.length})
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {letters.map((letter) => (
                <div
                  key={letter.letter}
                  className="flex items-start gap-3 rounded-xl border border-black/10 px-3 py-2.5 dark:border-white/10"
                >
                  <span className="w-10 flex-shrink-0 text-2xl font-semibold leading-8">
                    {letter.letter}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{letter.name}</span>
                      <span className="font-mono text-xs text-foreground/50">
                        [{letter.transcription}]
                      </span>
                      <SpeakButton
                        text={letter.name}
                        label={dict.listenLabel}
                        audioUrl={audioMap[alphabetAudioKey(alphabet.indexOf(letter))]}
                      />
                    </div>
                    <p className="text-xs leading-5 text-foreground/70">{letter.pronunciation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
