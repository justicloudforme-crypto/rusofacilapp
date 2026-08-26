"use client";

/** A brief "N in a row!" pill for a correct-answer streak milestone in the
 * recall/fill-blank mini-games — pops in, holds, fades out on its own via
 * CSS (see `streak-toast` in globals.css); the caller just needs to clear
 * its own state after roughly the same duration so a new streak can
 * re-trigger it. Purely decorative, no image/SVG. */
export default function StreakToast({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="streak-toast pointer-events-none fixed left-1/2 top-20 z-40 rounded-full bg-folk-red px-4 py-2 text-sm font-semibold text-white shadow-lg"
    >
      🔥 {label}
    </div>
  );
}
