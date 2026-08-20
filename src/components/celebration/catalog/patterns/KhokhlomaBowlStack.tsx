"use client";

const BOWL_COLORS = ["#d63b2f", "#e0a934", "#241c15"];

// Story beats:
//   Loop (0–0.5s, `doll-cascade-in` reused from Matryoshka.tsx, staggered
//     ×4 top to bottom): four Khokhloma-painted bowls pop into their
//     stacked slots one after another, biggest at the bottom — same
//     bounce-in used for the doll cascade, just building a tower instead
//     of a row.
//   Loop (0–0.9s, `sparkle-twinkle` reused, delayed): a shine marks the
//     stack settling once the last bowl lands.
/** STREAK-tier win scenario: a tidy stack of nested Khokhloma-painted
 * bowls assembling themselves — reuses the doll-cascade-in bounce
 * wholesale, one notch showier than the everyday pattern scenarios. */
export default function KhokhlomaBowlStack() {
  const bowls = BOWL_COLORS.concat(["#e0a934"]);
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative flex flex-col-reverse items-center">
        {bowls.map((color, i) => (
          <span
            key={i}
            className="doll-cascade-piece rounded-t-full"
            style={{ width: 60 - i * 10, height: 16, background: color, marginBottom: i === 0 ? 0 : -6, animationDelay: `${i * 0.1}s` }}
          />
        ))}
        <span
          className="sparkle-twinkle absolute select-none text-sm"
          style={{ top: -8, right: -10, animationDelay: "0.5s" }}
        >
          ✨
        </span>
      </div>
    </div>
  );
}
