"use client";

// Same four-petal Gorodets flower motif as MatryoshkaMark's apron detail,
// reused here as a standalone micro-reward rather than drawn fresh —
// keeps the folk-pattern vocabulary consistent across the app.
const PETAL = "#e0a934";
const CENTER = "#d63b2f";

/** A tiny folk-pattern flower that pops in next to the matryoshka reaction
 * on a correct flashcard answer (see AnswerPad.tsx) — 5 divs, one CSS
 * animation, no icon asset. Purely decorative. */
export default function FolkSpark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="folk-spark-pop relative inline-block flex-shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="absolute rounded-full -translate-x-1/2" style={{ width: "34%", aspectRatio: "1", top: "18%", left: "50%", background: PETAL }} />
      <span className="absolute rounded-full -translate-y-1/2" style={{ width: "34%", aspectRatio: "1", top: "50%", left: "82%", background: PETAL }} />
      <span className="absolute rounded-full -translate-x-1/2" style={{ width: "34%", aspectRatio: "1", top: "82%", left: "50%", background: PETAL }} />
      <span className="absolute rounded-full -translate-y-1/2" style={{ width: "34%", aspectRatio: "1", top: "50%", left: "18%", background: PETAL }} />
      <span className="absolute rounded-full -translate-x-1/2 -translate-y-1/2" style={{ width: "28%", aspectRatio: "1", top: "50%", left: "50%", background: CENTER }} />
    </span>
  );
}
