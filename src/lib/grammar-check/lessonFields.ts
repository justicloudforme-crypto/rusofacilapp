import type {
  Exercise,
  GrammarExample,
  LessonContent,
  ReadingPracticeItem,
  Slide,
  VocabularyItem,
} from "@/lib/lessons/types";

/**
 * "grading_key" — this string is compared against student input by an
 * autograder (FillBlankExercise.answers, ListeningTranscriptionExercise.
 * acceptedAnswers, WordReorderExercise's target order, MatchingExercise's
 * paired value). Rewriting it changes what counts as correct — never
 * auto-fix, route straight to manual review even after a human confirms
 * the grammar finding is real.
 *
 * "index_graded" — shown as one of several options where grading compares
 * the STUDENT'S SELECTED INDEX, not the option text, against
 * `correctIndex` (MultipleChoiceExercise.options, ListeningExercise.
 * options, ReadingComprehensionExercise question options). Fixing the text
 * doesn't break grading as long as the array order/length is preserved —
 * lower risk than grading_key, but still flagged distinctly since an
 * automated tool could still get the order wrong.
 *
 * "safe" — pure presentational/informational text (grammar explanations,
 * slides, vocabulary, reading practice, alphabet, prompts). No grading
 * logic depends on the exact string.
 */
export type LessonFieldRisk = "safe" | "index_graded" | "grading_key";

export interface LessonCheckItem {
  path: string;
  text: string;
  risk: LessonFieldRisk;
}

const CYRILLIC = /[Ѐ-ӿ]/;
const LETTER = /\p{L}/u;

function isRussianish(s: string): boolean {
  const letters = [...s].filter((c) => LETTER.test(c));
  if (letters.length < 2) return false;
  const cyr = letters.filter((c) => CYRILLIC.test(c));
  return cyr.length / letters.length > 0.5;
}

function push(items: LessonCheckItem[], path: string, text: string | undefined, risk: LessonFieldRisk): void {
  if (typeof text === "string" && isRussianish(text)) items.push({ path, text, risk });
}

function collectExercise(items: LessonCheckItem[], prefix: string, ex: Exercise): void {
  push(items, `${prefix}.prompt`, (ex as { prompt?: string }).prompt, "safe");
  push(items, `${prefix}.explanation`, (ex as { explanation?: string }).explanation, "safe");

  switch (ex.type) {
    case "multiple-choice":
      ex.options.forEach((opt, i) => push(items, `${prefix}.options[${i}]`, opt, "index_graded"));
      break;
    case "fill-blank":
      // `before`/`after`/`answers[]` are deliberately fragments of one
      // sentence split around the blank ("Я в школ" + "е" + "." = "Я в
      // школе.") — checking a fragment alone is meaningless (it reads as
      // an incomplete sentence by design, not a grammar error) and was a
      // real, confirmed source of false positives (17 of 24 grading_key
      // findings in the first lessons audit run traced to exactly this).
      // Check the RECONSTRUCTED full sentence instead, once per accepted
      // answer alternative.
      ex.answers.forEach((a, i) => push(items, `${prefix}.reconstructed[${i}]`, `${ex.before}${a}${ex.after}`, "grading_key"));
      break;
    case "matching":
      ex.pairs.forEach((p, i) => {
        push(items, `${prefix}.pairs[${i}].left`, p.left, "grading_key");
        push(items, `${prefix}.pairs[${i}].right`, p.right, "grading_key");
      });
      break;
    case "word-reorder":
      // Checked scoring.ts: grading compares the student's reordered array
      // against `words` element-by-element — `translation` is a
      // display-only reference field, never read by the grader. `words`
      // has no punctuation (commas aren't draggable tiles), so
      // `words.join(" ")` alone produces predictable "missing comma"
      // false positives on anything with a subordinate clause, address,
      // or comparison (found this checking real content: "потому что",
      // "чем", "улице X, дом N" all flagged for exactly this). `translation`
      // already holds the same sentence correctly punctuated, so prefer
      // checking that — genuinely "safe" too, since fixing it can never
      // change what the grader accepts. Only fall back to the unpunctuated
      // `words` join (still grading_key, since it IS what's graded) when
      // no translation reference exists to check instead.
      if (ex.translation) {
        push(items, `${prefix}.translation`, ex.translation, "safe");
      } else {
        push(items, `${prefix}.words`, ex.words.join(" "), "grading_key");
      }
      break;
    case "listening":
      push(items, `${prefix}.audioText`, ex.audioText, "grading_key");
      ex.options.forEach((opt, i) => push(items, `${prefix}.options[${i}]`, opt, "index_graded"));
      break;
    case "reading-comprehension":
      push(items, `${prefix}.text`, ex.text, "safe");
      ex.questions.forEach((q, qi) => {
        push(items, `${prefix}.questions[${qi}].prompt`, q.prompt, "safe");
        push(items, `${prefix}.questions[${qi}].explanation`, q.explanation, "safe");
        q.options.forEach((opt, oi) => push(items, `${prefix}.questions[${qi}].options[${oi}]`, opt, "index_graded"));
      });
      break;
    case "listening-transcription":
      push(items, `${prefix}.audioText`, ex.audioText, "grading_key");
      ex.acceptedAnswers.forEach((a, i) => push(items, `${prefix}.acceptedAnswers[${i}]`, a, "grading_key"));
      break;
  }
}

/** Walks one lesson's full content tree and returns every Russian-bearing
 * string worth a grammar check, tagged with how risky an automated rewrite
 * of that specific string would be. Mirrors LessonContent's real shape
 * (src/lib/lessons/types.ts) instead of a generic recursive walk, so the
 * risk tag is exact rather than guessed. */
export function collectLessonItems(content: LessonContent): LessonCheckItem[] {
  const items: LessonCheckItem[] = [];

  push(items, "grammar.title", content.grammar.title, "safe");
  content.grammar.paragraphs.forEach((p, i) => push(items, `grammar.paragraphs[${i}]`, p, "safe"));
  (content.grammar.examples ?? []).forEach((ex: GrammarExample, i) => {
    push(items, `grammar.examples[${i}].russian`, ex.russian, "safe");
  });

  (content.alphabet ?? []).forEach((letter, i) => {
    push(items, `alphabet[${i}].pronunciation`, letter.pronunciation, "safe");
  });

  (content.slides ?? []).forEach((slide: Slide, i) => {
    push(items, `slides[${i}].title`, slide.title, "safe");
    slide.body.forEach((b, bi) => push(items, `slides[${i}].body[${bi}]`, b, "safe"));
    (slide.highlights ?? []).forEach((h, hi) => push(items, `slides[${i}].highlights[${hi}]`, h, "safe"));
    (slide.audioExamples ?? []).forEach((ae, ai) => {
      push(items, `slides[${i}].audioExamples[${ai}].text`, ae.text, "safe");
      push(items, `slides[${i}].audioExamples[${ai}].caption`, ae.caption, "safe");
    });
  });

  if (content.readingPractice) {
    content.readingPractice.items.forEach((item: ReadingPracticeItem, i) => {
      push(items, `readingPractice.items[${i}].text`, item.text, "safe");
    });
  }

  content.vocabulary.forEach((v: VocabularyItem, i) => {
    push(items, `vocabulary[${i}].word`, v.word, "safe");
  });

  content.exercises.forEach((ex, i) => collectExercise(items, `exercises[${i}]`, ex));

  return items;
}
