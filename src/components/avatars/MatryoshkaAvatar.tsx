import type { CSSProperties, ReactNode } from "react";
import type { AvatarId, Character } from "@/lib/avatars";
import { characterOf } from "@/lib/avatars";

// Brand palette — same fixed (theme-independent) colors as
// MatryoshkaMark.tsx, since these are literal painted/illustrated
// characters, not UI chrome. Each new character (added alongside the
// original matryoshka) reuses this palette so the whole cast reads as one
// illustration family rather than six unrelated icon sets.
const INK = "#4a3826";
const BLUSH = "#e8a2a0";
const BRAND_BLUE = "#2d5f8a";
const BRAND_RED = "#d63b2f";
const BRAND_GOLD = "#e0a934";
const SKIN = "#fbe3c0";
const CREAM = "#fff8ec";

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
  snowman_calm: { leftEye: "dot", rightEye: "dot", mouth: "smile" },
  snowman_happy: { leftEye: "dot", rightEye: "dot", mouth: "grin", blush: true },
  snowman_wink: { leftEye: "line", rightEye: "dot", mouth: "smile" },
  bear_calm: { leftEye: "dot", rightEye: "dot", mouth: "smile" },
  bear_happy: { leftEye: "dot", rightEye: "dot", mouth: "grin", blush: true },
  bear_wink: { leftEye: "line", rightEye: "dot", mouth: "smile", blush: true },
  bogatyr_calm: { leftEye: "dot", rightEye: "dot", mouth: "flat" },
  bogatyr_happy: { leftEye: "dot", rightEye: "dot", mouth: "smile" },
  bogatyr_proud: { leftEye: "curve", rightEye: "curve", mouth: "flat" },
  fox_calm: { leftEye: "dot", rightEye: "dot", mouth: "smile" },
  fox_happy: { leftEye: "dot", rightEye: "dot", mouth: "grin", blush: true },
  fox_wink: { leftEye: "line", rightEye: "dot", mouth: "smile", blush: true },
  girl_calm: { leftEye: "dot", rightEye: "dot", mouth: "smile" },
  girl_happy: { leftEye: "dot", rightEye: "dot", mouth: "grin", blush: true },
  girl_wink: { leftEye: "line", rightEye: "dot", mouth: "smile", blush: true },
};

// Per-character head background (the "skin"/fur/snow base the whole circle
// starts from) and body base color (the bottom third, before that
// character's band/collar/dress overlay is drawn on top).
const HEAD_BG: Record<Character, string> = {
  matryoshka: SKIN,
  snowman: "#f4f8fb",
  bear: "#8a5a3a",
  bogatyr: SKIN,
  fox: "#d97a3f",
  girl: SKIN,
};
const BODY_BG: Record<Character, string> = {
  matryoshka: BRAND_BLUE,
  snowman: "#f4f8fb",
  bear: "#8a5a3a",
  bogatyr: BRAND_BLUE,
  fox: "#d97a3f",
  girl: BRAND_RED,
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

/** Decoration drawn on the head/face area (above the body band), specific
 * to each character — this is what makes a snowman read as a snowman
 * rather than a recolored matryoshka. */
function headDecor(character: Character): ReactNode {
  switch (character) {
    case "matryoshka":
      return (
        <span className="absolute inset-x-0 top-0" style={{ height: "26%", background: BRAND_GOLD }} />
      );
    case "snowman":
      return (
        <>
          {/* Bucket-hat brim */}
          <span className="absolute inset-x-0 top-0" style={{ height: "13%", background: "#241c15" }} />
          {/* Carrot nose */}
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "12%",
              height: "8%",
              top: "58%",
              left: "50%",
              background: "#e2762c",
              clipPath: "polygon(0 50%, 100% 0, 100% 100%)",
            }}
          />
        </>
      );
    case "bear":
      return (
        <>
          <span
            className="absolute rounded-full"
            style={{ width: "20%", height: "20%", top: "-2%", left: "8%", background: "#6b4226" }}
          />
          <span
            className="absolute rounded-full"
            style={{ width: "20%", height: "20%", top: "-2%", right: "8%", background: "#6b4226" }}
          />
          {/* Snout */}
          <span
            className="absolute rounded-full -translate-x-1/2"
            style={{ width: "34%", height: "20%", top: "56%", left: "50%", background: "#c98f5e" }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2"
            style={{ width: "9%", height: "7%", top: "60%", left: "50%", background: INK }}
          />
        </>
      );
    case "bogatyr":
      return (
        <>
          {/* Shishak-style pointed helmet, cropped by the circular frame */}
          <span
            className="absolute inset-x-0 top-0"
            style={{
              height: "36%",
              background: "#8a95a0",
              borderRadius: "0 0 45% 45% / 0 0 60% 60%",
            }}
          />
          <span className="absolute inset-x-0" style={{ top: "33%", height: "4%", background: BRAND_GOLD }} />
          {/* Nasal guard */}
          <span
            className="absolute -translate-x-1/2"
            style={{ width: "7%", height: "16%", top: "36%", left: "50%", background: "#8a95a0" }}
          />
          {/* Mustache */}
          <span
            className="absolute -translate-x-1/2"
            style={{
              width: "30%",
              height: "6%",
              top: "58%",
              left: "50%",
              background: INK,
              borderRadius: "9999px 9999px 40% 40%",
            }}
          />
        </>
      );
    case "fox":
      return (
        <>
          <span
            className="absolute"
            style={{
              width: "18%",
              height: "22%",
              top: "-6%",
              left: "10%",
              background: "#7a3f1f",
              clipPath: "polygon(50% 0, 0 100%, 100% 100%)",
            }}
          />
          <span
            className="absolute"
            style={{
              width: "18%",
              height: "22%",
              top: "-6%",
              right: "10%",
              background: "#7a3f1f",
              clipPath: "polygon(50% 0, 0 100%, 100% 100%)",
            }}
          />
          {/* White muzzle */}
          <span
            className="absolute rounded-full -translate-x-1/2"
            style={{ width: "32%", height: "19%", top: "58%", left: "50%", background: "#fdf1e2" }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2"
            style={{ width: "8%", height: "6%", top: "60%", left: "50%", background: INK }}
          />
        </>
      );
    case "girl":
      return (
        <>
          {/* Center-parted hair */}
          <span className="absolute inset-x-0 top-0" style={{ height: "24%", background: "#6b4226" }} />
          {/* Braid running down the right side */}
          <span
            className="absolute"
            style={{
              width: "17%",
              height: "58%",
              top: "18%",
              left: "72%",
              background: "#6b4226",
              borderRadius: "9999px",
            }}
          />
          <span className="absolute" style={{ width: "17%", height: "4%", top: "34%", left: "72%", background: "#8a5a3a", borderRadius: "9999px" }} />
          <span className="absolute" style={{ width: "17%", height: "4%", top: "52%", left: "72%", background: "#8a5a3a", borderRadius: "9999px" }} />
          {/* Ribbon at the braid's end */}
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ width: "13%", height: "10%", top: "76%", left: "80%", background: BRAND_RED, borderRadius: "2px" }}
          />
        </>
      );
  }
}

/** Decoration drawn over the body band (bottom third) — the
 * scarf/collar/apron/dress that finishes each character. */
function bodyDecor(character: Character): ReactNode {
  switch (character) {
    case "matryoshka":
      return (
        <>
          <span className="absolute inset-x-0 top-0" style={{ height: "38%", background: BRAND_RED }} />
          <span
            className="absolute rounded-t-full"
            style={{ bottom: 0, left: "30%", right: "30%", height: "70%", background: CREAM }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ width: "10%", aspectRatio: "1", top: "78%", left: "50%", background: BRAND_RED }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ width: "8%", aspectRatio: "1", top: "68%", left: "42%", background: BRAND_GOLD }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ width: "8%", aspectRatio: "1", top: "68%", left: "58%", background: BRAND_GOLD }}
          />
        </>
      );
    case "snowman":
      return (
        <>
          <span className="absolute inset-x-0 top-0" style={{ height: "34%", background: BRAND_RED }} />
          <span
            className="absolute -translate-x-1/2"
            style={{
              width: "12%",
              height: "60%",
              top: "34%",
              left: "50%",
              background: BRAND_RED,
              clipPath: "polygon(0 0, 100% 0, 60% 100%, 40% 100%)",
            }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2"
            style={{ width: "8%", aspectRatio: "1", top: "70%", left: "34%", background: INK }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2"
            style={{ width: "8%", aspectRatio: "1", top: "70%", left: "66%", background: INK }}
          />
        </>
      );
    case "bear":
      return (
        <>
          <span className="absolute inset-x-0 top-0" style={{ height: "38%", background: BRAND_RED }} />
          <span
            className="absolute rounded-t-full"
            style={{ bottom: 0, left: "36%", right: "36%", height: "55%", background: BRAND_GOLD }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ width: "8%", aspectRatio: "1", top: "72%", left: "34%", background: "#6b4226" }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ width: "8%", aspectRatio: "1", top: "72%", left: "66%", background: "#6b4226" }}
          />
        </>
      );
    case "bogatyr":
      return (
        <>
          <span className="absolute inset-x-0 top-0" style={{ height: "40%", background: "#8a95a0" }} />
          <span className="absolute inset-x-0" style={{ top: "38%", height: "5%", background: BRAND_GOLD }} />
          <span
            className="absolute rounded-full -translate-x-1/2"
            style={{ width: "7%", aspectRatio: "1", top: "18%", left: "30%", background: BRAND_GOLD }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2"
            style={{ width: "7%", aspectRatio: "1", top: "18%", left: "50%", background: BRAND_GOLD }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2"
            style={{ width: "7%", aspectRatio: "1", top: "18%", left: "70%", background: BRAND_GOLD }}
          />
        </>
      );
    case "fox":
      return (
        <>
          <span className="absolute inset-x-0 top-0" style={{ height: "38%", background: BRAND_BLUE }} />
          <span
            className="absolute rounded-t-full"
            style={{ bottom: 0, left: "32%", right: "32%", height: "68%", background: "#fdf1e2" }}
          />
        </>
      );
    case "girl":
      return (
        <>
          <span className="absolute inset-x-0 top-0" style={{ height: "20%", background: BRAND_GOLD }} />
          <span
            className="absolute rounded-t-full"
            style={{ bottom: 0, left: "28%", right: "28%", height: "78%", background: CREAM }}
          />
          <span
            className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ width: "9%", aspectRatio: "1", top: "80%", left: "50%", background: BRAND_RED }}
          />
        </>
      );
  }
}

export default function MatryoshkaAvatar({
  id,
  size = 40,
  label,
  premium = false,
}: {
  id: AvatarId;
  size?: number;
  label?: string;
  /** Premium (lifetime) plan holders get a gold ring + crown around their
   * avatar wherever it's shown for a real account (header, profile, public
   * profile, group leaderboard) — the same amber accent already used for
   * Premium-exclusive content lock badges elsewhere in the app. Never set
   * for the celebration-catalog/flashcard-feedback illustration usages,
   * which aren't tied to an actual user's plan. The ring/crown live on an
   * outer wrapper rather than the circle itself, since the circle needs
   * `overflow-hidden` to clip its painted features and would clip them too. */
  premium?: boolean;
}) {
  const character = characterOf(id);
  const face = FACES[id];
  const gaze = face.gazeShift ?? 0;

  return (
    <span className="relative inline-block flex-shrink-0" style={{ width: size, height: size }}>
      <span
        className={`relative block h-full w-full overflow-hidden rounded-full ${
          premium ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-background" : ""
        }`}
        style={{ background: HEAD_BG[character] }}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
      {headDecor(character)}
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
      {/* Body — bottom third of the circle, character-specific band/collar/
          dress drawn by bodyDecor. */}
      <span className="absolute inset-x-0 bottom-0" style={{ height: "34%", background: BODY_BG[character] }}>
        {bodyDecor(character)}
      </span>
      </span>
      {premium && (
        <span
          className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none leading-none drop-shadow-sm"
          style={{ fontSize: Math.max(10, Math.round(size * 0.34)) }}
          aria-hidden
        >
          👑
        </span>
      )}
    </span>
  );
}
