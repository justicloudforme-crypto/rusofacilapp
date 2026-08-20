"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const CAP = "#e0a934";
const CAP_TRIM = "#d63b2f";

// Story beats:
//   Loop (0–1.8s, `lid-peekaboo`): the doll's own cap slides down to cover
//     her whole face, holds a beat, then slides back up to reveal a
//     confused expression — and immediately starts sliding down again. She
//     is stuck looking for the exit and hasn't found it yet.
/** EVERYDAY-tier fail scenario: not broken, not thrown, not sulking — just
 * comically unable to find her own way back out. Reuses MatryoshkaAvatar's
 * "thinking" face for the peekaboo moment. */
export default function MatryoshkaLostInside() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 64, height: 64 }}>
        <MatryoshkaAvatar id="matryoshka_thinking" size={64} />
        <span
          className="lid-peekaboo absolute inset-x-0 top-0 rounded-t-full"
          style={{ height: "62%", background: CAP }}
        >
          <span className="absolute inset-x-0 bottom-0" style={{ height: "20%", background: CAP_TRIM }} />
        </span>
      </div>
    </div>
  );
}
