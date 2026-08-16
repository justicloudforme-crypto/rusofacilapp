import type { CSSProperties } from "react";
import type { AvatarId } from "@/lib/avatars";

// Brand doll palette — same fixed (theme-independent) colors as
// MatryoshkaMark.tsx, since this is a literal painted object, not UI chrome.
const DOLL_SKIN = "#fbe3c0";
const DOLL_SCARF = "#e0a934";
const DOLL_BODY = "#2d5f8a";
const DOLL_BAND_1 = "#d63b2f";
const DOLL_APRON = "#fff8ec";
const DOLL_FLOWER_PETAL = "#e0a934";
const DOLL_FLOWER_CENTER = "#d63b2f";
const INK = "#4a3826";
const BLUSH = "#e8a2a0";

type EyeShape = "dot" | "line" | "big" | "curve";
interface FaceConfig {
  leftEye: EyeShape;
  rightEye: EyeShape;
  mouth: "smile" | "grin" | "o" | "flat";
  blush?: boolean;
  gazeShift?: number; // percent, shifts both eyes sideways (for "thinking")
}

const FACES: Record<AvatarId, FaceConfig> = {
  matryoshka_calm: { leftEye: "dot", rightEye: "dot", mouth: "smile" },
  matryoshka_happy: { leftEye: "dot", rightEye: "dot", mouth: "grin", blush: true },
  matryoshka_wink: { leftEye: "line", rightEye: "dot", mouth: "smile", blush: true },
  matryoshka_surprised: { leftEye: "big", rightEye: "big", mouth: "o" },
  matryoshka_sleepy: { leftEye: "line", rightEye: "line", mouth: "flat" },
  matryoshka_proud: { leftEye: "curve", rightEye: "curve", mouth: "grin" },
  matryoshka_thinking: { leftEye: "dot", rightEye: "dot", mouth: "flat", gazeShift: 7 },
  matryoshka_laughing: { leftEye: "curve", rightEye: "curve", mouth: "grin", blush: true },
};

function eyeStyle(shape: EyeShape): CSSProperties {
  switch (shape) {
    case "dot":
      return { width: "13%", height: "13%", borderRadius: "50%", background: INK };
    case "big":
      return { width: "19%", height: "19%", borderRadius: "50%", background: INK };
    case "line":
      return { width: "15%", height: "4%", borderRadius: "9999px", background: INK };
    case "curve":
      return {
        width: "16%",
        height: "8%",
        borderRadius: "9999px 9999px 0 0",
        background: INK,
      };
  }
}

function mouthStyle(shape: FaceConfig["mouth"]): CSSProperties {
  switch (shape) {
    case "smile":
      return { width: "20%", height: "8%", borderRadius: "0 0 9999px 9999px", background: INK };
    case "grin":
      return { width: "26%", height: "13%", borderRadius: "0 0 9999px 9999px", background: INK };
    case "o":
      return { width: "11%", height: "11%", borderRadius: "50%", background: INK };
    case "flat":
      return { width: "16%", height: "4%", borderRadius: "9999px", background: INK };
  }
}

export default function MatryoshkaAvatar({
  id,
  size = 40,
  label,
}: {
  id: AvatarId;
  size?: number;
  label?: string;
}) {
  const face = FACES[id];
  const gaze = face.gazeShift ?? 0;

  return (
    <span
      className="relative inline-block flex-shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size, background: DOLL_SKIN }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* Scarf band across the top of the head */}
      <span
        className="absolute inset-x-0 top-0"
        style={{ height: "26%", background: DOLL_SCARF }}
      />
      {/* Face */}
      <span
        className="absolute rounded-full -translate-x-1/2"
        style={{ width: "13%", aspectRatio: "1", top: "48%", left: `${44 + gaze}%`, ...eyeStyle(face.leftEye) }}
      />
      <span
        className="absolute rounded-full -translate-x-1/2"
        style={{ width: "13%", aspectRatio: "1", top: "48%", left: `${64 + gaze}%`, ...eyeStyle(face.rightEye) }}
      />
      <span
        className="absolute -translate-x-1/2"
        style={{ top: "66%", left: "50%", ...mouthStyle(face.mouth) }}
      />
      {face.blush && (
        <>
          <span
            className="absolute rounded-full -translate-x-1/2"
            style={{ width: "12%", height: "8%", top: "60%", left: "22%", background: BLUSH, opacity: 0.7 }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2"
            style={{ width: "12%", height: "8%", top: "60%", left: "82%", background: BLUSH, opacity: 0.7 }}
          />
        </>
      )}
      {/* Body — bottom two-thirds of the circle, same band/apron/flower motif
          as MatryoshkaMark.tsx, cropped into a round avatar frame instead of
          the full nesting-doll silhouette (there's no room for the tapered
          body shape at avatar sizes, so this reads as a friendly round face
          in folk dress instead). */}
      <span
        className="absolute inset-x-0 bottom-0"
        style={{ height: "34%", background: DOLL_BODY }}
      >
        <span className="absolute inset-x-0 top-0" style={{ height: "38%", background: DOLL_BAND_1 }} />
        <span
          className="absolute rounded-t-full"
          style={{ bottom: 0, left: "30%", right: "30%", height: "70%", background: DOLL_APRON }}
        />
        <span
          className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{ width: "10%", aspectRatio: "1", top: "78%", left: "50%", background: DOLL_FLOWER_CENTER }}
        />
        <span
          className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{ width: "8%", aspectRatio: "1", top: "68%", left: "42%", background: DOLL_FLOWER_PETAL }}
        />
        <span
          className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{ width: "8%", aspectRatio: "1", top: "68%", left: "58%", background: DOLL_FLOWER_PETAL }}
        />
      </span>
    </span>
  );
}
