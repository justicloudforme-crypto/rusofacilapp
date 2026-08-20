"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const SHAWL_BASE = "#d63b2f";
const SHAWL_TRIM = "#e0a934";

// Story beats:
//   Loop (0–1.6s, `shawl-tangle-wrap`): instead of MatryoshkaShawlTwirl's
//     shawl spinning cleanly overhead, it slides down and wraps across her
//     face, holds a beat fully covering her, then slides back up to start
//     over — same peekaboo shape as MatryoshkaLostInside.tsx's cap, but on
//     a shawl instead of the outer shell.
/** EVERYDAY-tier fail scenario: the MatryoshkaShawlTwirl win, tangled
 * instead of twirled. Same shawl fabric/trim vocabulary; reuses
 * MatryoshkaAvatar's "surprised" face for what's visible between wraps. */
export default function MatryoshkaShawlTangle() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_surprised" size={56} />
        <span
          className="shawl-tangle-wrap absolute inset-x-0 top-0 rounded-t-full"
          style={{ height: "70%", background: SHAWL_BASE }}
        >
          <span className="absolute inset-x-2" style={{ bottom: 4, height: 2, background: SHAWL_TRIM, opacity: 0.8 }} />
        </span>
      </div>
    </div>
  );
}
