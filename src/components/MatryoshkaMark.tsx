/**
 * RusoFácilapp's brand mark: a nesting-doll silhouette built entirely from
 * plain divs (border-radius + overflow:hidden bands), no image/SVG asset —
 * same technique used to pitch the "Городецкая роспись" concept, now the
 * one actually adopted. Colors are fixed to the brand palette (not the
 * light/dark `--brand` tokens) since the doll is a literal painted object,
 * not UI chrome — it should look the same regardless of site theme, same
 * reasoning as not re-tinting a photograph for dark mode.
 */
export default function MatryoshkaMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="relative inline-block flex-shrink-0"
      style={{ width: size * 0.62, height: size }}
      aria-hidden
    >
      <span
        className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
        style={{ width: "46%", aspectRatio: "1", background: "#fbe3c0" }}
      />
      <span
        className="absolute left-1/2 top-[24%] -translate-x-1/2 rounded-t-full rounded-b-[40%]"
        style={{ width: "64%", height: "18%", background: "#e0a934" }}
      />
      <span
        className="absolute inset-x-0 bottom-0 overflow-hidden"
        style={{ height: "80%", borderRadius: "46% 46% 38% 38% / 58% 58% 30% 30%", background: "#2d5f8a" }}
      >
        <span className="absolute inset-x-0" style={{ top: "30%", height: "24%", background: "#d63b2f" }} />
        <span className="absolute inset-x-0" style={{ top: "58%", height: "24%", background: "#e0a934" }} />
        <span
          className="absolute bottom-0 left-[18%] right-[18%] rounded-t-full"
          style={{ height: "46%", background: "#fff8ec" }}
        />
        <span className="absolute rounded-full" style={{ width: "15%", aspectRatio: "1", top: "44%", left: "27%", background: "#d63b2f" }} />
        <span className="absolute rounded-full" style={{ width: "15%", aspectRatio: "1", top: "44%", right: "27%", background: "#d63b2f" }} />
        <span
          className="absolute rounded-full -translate-x-1/2"
          style={{ width: "15%", aspectRatio: "1", top: "68%", left: "50%", background: "#d63b2f" }}
        />
      </span>
    </span>
  );
}
