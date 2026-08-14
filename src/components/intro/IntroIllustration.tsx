import {
  INTRO_ILLUSTRATION_VIEWBOX,
  introSlideIllustrations,
  type IntroIconKey,
  type IntroIllustrationColorRole,
} from "@/lib/intro/slideIcons";

// Fixed hex values (not CSS variables) so the illustration's own palette
// stays legible regardless of the page's light/dark theme. Mirrors the
// constants in src/components/lesson/SlideIllustration.tsx and
// src/lib/intro/pdf.tsx; keep all three in sync.
const COLORS: Record<IntroIllustrationColorRole, string> = {
  brand: "#3730a3",
  brandLight: "#4f46e5",
  accent: "#b45309",
  accentLight: "#d97706",
  ink: "#1f2130",
  inkSoft: "#4b4d5e",
  muted: "#e4e4ef",
  white: "#ffffff",
  danger: "#dc2626",
};

export default function IntroIllustration({ icon, className }: { icon: IntroIconKey; className?: string }) {
  const shapes = introSlideIllustrations[icon] ?? [];

  return (
    <svg
      viewBox={`0 0 ${INTRO_ILLUSTRATION_VIEWBOX.width} ${INTRO_ILLUSTRATION_VIEWBOX.height}`}
      className={className}
      role="img"
      aria-label=""
    >
      {shapes.map((shape, i) => {
        const key = `${icon}-${i}`;
        if (shape.kind === "circle") {
          return (
            <circle
              key={key}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.r}
              fill={shape.fill ? COLORS[shape.fill] : "none"}
              stroke={shape.stroke ? COLORS[shape.stroke] : undefined}
              strokeWidth={shape.strokeWidth}
              opacity={shape.opacity}
            />
          );
        }
        if (shape.kind === "rect") {
          return (
            <rect
              key={key}
              x={shape.x}
              y={shape.y}
              width={shape.w}
              height={shape.h}
              rx={shape.rx}
              fill={COLORS[shape.fill]}
              opacity={shape.opacity}
            />
          );
        }
        if (shape.kind === "path") {
          return (
            <path
              key={key}
              d={shape.d}
              fill={shape.fill ? COLORS[shape.fill] : "none"}
              stroke={shape.stroke ? COLORS[shape.stroke] : undefined}
              strokeWidth={shape.strokeWidth}
              strokeLinecap={shape.round ? "round" : undefined}
              strokeLinejoin={shape.round ? "round" : undefined}
              opacity={shape.opacity}
            />
          );
        }
        return (
          <text
            key={key}
            x={shape.x}
            y={shape.y}
            fontSize={shape.size}
            fill={COLORS[shape.fill]}
            fontWeight={shape.bold ? 700 : 400}
            textAnchor={shape.anchor ?? "start"}
            opacity={shape.opacity}
          >
            {shape.content}
          </text>
        );
      })}
    </svg>
  );
}
