/**
 * Hero illustrations for the Introduction presentation (homepage longread +
 * PDF export) — same flat-shape recipe as src/lib/lessons/slideIcons.ts, kept
 * as its own small parallel file (rather than adding entries to the lesson
 * icon set) because these ten scenes are specific to the intro deck and have
 * nothing to do with lesson content. See src/components/intro/IntroIllustration.tsx
 * (web) and src/lib/intro/pdf.tsx (PDF) for the two renderers that share
 * this data.
 */
export const INTRO_ILLUSTRATION_VIEWBOX = { width: 160, height: 120 };

export type IntroIllustrationColorRole =
  | "brand"
  | "brandLight"
  | "accent"
  | "accentLight"
  | "ink"
  | "inkSoft"
  | "muted"
  | "white"
  | "danger";

export type IntroIllustrationShape =
  | {
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      fill?: IntroIllustrationColorRole;
      stroke?: IntroIllustrationColorRole;
      strokeWidth?: number;
      opacity?: number;
    }
  | { kind: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill: IntroIllustrationColorRole; opacity?: number }
  | {
      kind: "path";
      d: string;
      fill?: IntroIllustrationColorRole;
      stroke?: IntroIllustrationColorRole;
      strokeWidth?: number;
      opacity?: number;
      round?: boolean;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      size: number;
      fill: IntroIllustrationColorRole;
      content: string;
      bold?: boolean;
      anchor?: "start" | "middle" | "end";
      opacity?: number;
    };

export type IntroIconKey =
  | "globalReach"
  | "russiaMap"
  | "spaceFirst"
  | "literaryClassics"
  | "keyboardWindows"
  | "keyboardMac"
  | "dailyHabit"
  | "methodMix"
  | "interactiveDictionary"
  | "communityChat";

export const introSlideIllustrations: Record<IntroIconKey, IntroIllustrationShape[]> = {
  // Alcance global — a globe with latitude/longitude arcs and a speaker count badge.
  globalReach: [
    { kind: "circle", cx: 66, cy: 60, r: 46, fill: "brand", opacity: 0.07 },
    { kind: "circle", cx: 66, cy: 60, r: 38, fill: "brandLight" },
    { kind: "path", d: "M28 60 H104", stroke: "white", strokeWidth: 2, opacity: 0.55 },
    { kind: "path", d: "M66 22 V98", stroke: "white", strokeWidth: 2, opacity: 0.35 },
    { kind: "path", d: "M35 40 Q66 60 35 80", stroke: "white", strokeWidth: 2, opacity: 0.5 },
    { kind: "path", d: "M97 40 Q66 60 97 80", stroke: "white", strokeWidth: 2, opacity: 0.5 },
    { kind: "path", d: "M66 22 Q90 60 66 98", stroke: "white", strokeWidth: 2, opacity: 0.35 },
    { kind: "path", d: "M66 22 Q42 60 66 98", stroke: "white", strokeWidth: 2, opacity: 0.35 },
    { kind: "circle", cx: 122, cy: 30, r: 22, fill: "accentLight" },
    { kind: "text", x: 122, y: 27, size: 11.5, fill: "white", content: "258M", bold: true, anchor: "middle" },
    { kind: "text", x: 122, y: 39, size: 6.5, fill: "white", content: "hablantes", anchor: "middle" },
    { kind: "circle", cx: 128, cy: 88, r: 13, fill: "accent" },
    { kind: "text", x: 128, y: 92, size: 12, fill: "white", content: "4", bold: true, anchor: "middle" },
  ],

  // Rusia, 11 husos horarios — a wide landmass silhouette with time-zone pins.
  russiaMap: [
    { kind: "circle", cx: 80, cy: 64, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "path", d: "M10 58 L26 46 L46 50 L60 40 L78 46 L96 38 L114 46 L132 40 L150 52 L146 70 L128 76 L108 68 L88 78 L66 72 L46 80 L24 74 L10 58 Z", fill: "brandLight" },
    { kind: "circle", cx: 24, cy: 58, r: 3.2, fill: "accentLight" },
    { kind: "circle", cx: 48, cy: 60, r: 3.2, fill: "accentLight" },
    { kind: "circle", cx: 72, cy: 58, r: 3.2, fill: "accentLight" },
    { kind: "circle", cx: 96, cy: 56, r: 3.2, fill: "accentLight" },
    { kind: "circle", cx: 120, cy: 56, r: 3.2, fill: "accentLight" },
    { kind: "circle", cx: 142, cy: 58, r: 3.2, fill: "accentLight" },
    { kind: "circle", cx: 132, cy: 22, r: 18, fill: "accent" },
    { kind: "circle", cx: 132, cy: 22, r: 12.5, stroke: "white", strokeWidth: 1.6 },
    { kind: "path", d: "M132 14 V22 L138 26", stroke: "white", strokeWidth: 1.8, round: true },
    { kind: "text", x: 132, y: 44, size: 7, fill: "brand", content: "11 husos", bold: true, anchor: "middle" },
  ],

  // Gagarin y la carrera espacial — a rocket arcing past a ringed planet.
  spaceFirst: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 46, cy: 82, r: 4, fill: "accentLight", opacity: 0.9 },
    { kind: "circle", cx: 120, cy: 30, r: 2.4, fill: "brandLight" },
    { kind: "circle", cx: 132, cy: 90, r: 2.4, fill: "brandLight" },
    { kind: "circle", cx: 30, cy: 34, r: 2, fill: "brandLight" },
    { kind: "path", d: "M70 96 C70 60 84 34 100 20 C104 40 100 66 82 88 Z", fill: "brand" },
    { kind: "path", d: "M100 20 C112 26 116 38 112 50 L94 40 Z", fill: "accentLight" },
    { kind: "circle", cx: 92, cy: 40, r: 6, fill: "white", opacity: 0.85 },
    { kind: "path", d: "M76 82 L64 96 L80 92 Z", fill: "accentLight" },
    { kind: "path", d: "M82 88 L86 104 L96 90 Z", fill: "accentLight" },
    { kind: "path", d: "M70 96 C62 104 58 112 56 118 C64 116 72 110 78 100", fill: "accent", opacity: 0.8 },
    { kind: "circle", cx: 128, cy: 66, r: 15, stroke: "brandLight", strokeWidth: 2, fill: "muted", opacity: 0.6 },
    { kind: "path", d: "M112 66 H144", stroke: "brandLight", strokeWidth: 2, opacity: 0.5 },
  ],

  // Los clásicos — a stack of open books with a quill.
  literaryClassics: [
    { kind: "circle", cx: 78, cy: 62, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 24, y: 78, w: 96, h: 10, rx: 2, fill: "brand" },
    { kind: "rect", x: 32, y: 66, w: 82, h: 10, rx: 2, fill: "brandLight" },
    { kind: "rect", x: 22, y: 54, w: 88, h: 10, rx: 2, fill: "accent" },
    { kind: "path", d: "M108 20 L132 44 L118 58 L94 34 Z", fill: "accentLight" },
    { kind: "path", d: "M96 56 L86 72 L102 64 Z", fill: "ink" },
    { kind: "circle", cx: 128, cy: 24, r: 3, fill: "accentLight" },
    { kind: "text", x: 68, y: 62, size: 7, fill: "white", content: "Достоевский", bold: true, anchor: "middle" },
    { kind: "text", x: 73, y: 74, size: 7, fill: "white", content: "Толстой", bold: true, anchor: "middle" },
    { kind: "text", x: 72, y: 86, size: 7, fill: "white", content: "Пушкин", bold: true, anchor: "middle" },
  ],

  // Teclado Windows — a keyboard with the Space bar and Win key highlighted.
  keyboardWindows: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 16, y: 30, w: 128, h: 60, rx: 10, fill: "ink" },
    { kind: "rect", x: 24, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 40, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 56, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 72, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 88, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 104, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 120, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 24, y: 54, w: 20, h: 12, rx: 3, fill: "accentLight" },
    { kind: "path", d: "M28 58 H30 M28 61 H30 M32 58 H34 M32 61 H34", stroke: "white", strokeWidth: 1.2 },
    { kind: "rect", x: 48, y: 54, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 64, y: 54, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 80, y: 54, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 96, y: 54, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 112, y: 54, w: 22, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 40, y: 70, w: 68, h: 12, rx: 3, fill: "accent" },
    { kind: "text", x: 74, y: 79, size: 7, fill: "white", content: "Win + Espacio", bold: true, anchor: "middle" },
    { kind: "rect", x: 112, y: 70, w: 22, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "circle", cx: 132, cy: 26, r: 12, fill: "brandLight" },
    { kind: "text", x: 132, y: 30, size: 12, fill: "white", content: "Я", bold: true, anchor: "middle" },
  ],

  // Teclado Mac — same recipe, Control key highlighted.
  keyboardMac: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 16, y: 30, w: 128, h: 60, rx: 10, fill: "ink" },
    { kind: "rect", x: 24, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 40, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 56, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 72, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 88, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 104, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 120, y: 38, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 24, y: 54, w: 24, h: 12, rx: 3, fill: "accentLight" },
    { kind: "text", x: 36, y: 63, size: 6, fill: "white", content: "control", bold: true, anchor: "middle" },
    { kind: "rect", x: 52, y: 54, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 68, y: 54, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 84, y: 54, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 100, y: 54, w: 14, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 116, y: 54, w: 18, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 40, y: 70, w: 68, h: 12, rx: 3, fill: "accent" },
    { kind: "text", x: 74, y: 79, size: 7, fill: "white", content: "Control + Espacio", bold: true, anchor: "middle" },
    { kind: "rect", x: 112, y: 70, w: 22, h: 12, rx: 3, fill: "inkSoft" },
    { kind: "circle", cx: 132, cy: 26, r: 12, fill: "brandLight" },
    { kind: "text", x: 132, y: 30, size: 12, fill: "white", content: "Ф", bold: true, anchor: "middle" },
  ],

  // Constancia diaria — a small calendar with checked days and a streak flame.
  dailyHabit: [
    { kind: "circle", cx: 66, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 18, y: 26, w: 96, h: 78, rx: 10, fill: "brandLight" },
    { kind: "rect", x: 18, y: 26, w: 96, h: 20, rx: 10, fill: "brand" },
    { kind: "rect", x: 30, y: 14, w: 8, h: 18, rx: 3, fill: "brand" },
    { kind: "rect", x: 94, y: 14, w: 8, h: 18, rx: 3, fill: "brand" },
    { kind: "circle", cx: 34, cy: 60, r: 7, fill: "accentLight" },
    { kind: "circle", cx: 54, cy: 60, r: 7, fill: "accentLight" },
    { kind: "circle", cx: 74, cy: 60, r: 7, fill: "accentLight" },
    { kind: "circle", cx: 94, cy: 60, r: 7, fill: "accentLight" },
    { kind: "circle", cx: 34, cy: 82, r: 7, fill: "accentLight" },
    { kind: "circle", cx: 54, cy: 82, r: 7, fill: "accentLight" },
    { kind: "circle", cx: 74, cy: 82, r: 7, fill: "white", opacity: 0.35 },
    { kind: "circle", cx: 94, cy: 82, r: 7, fill: "white", opacity: 0.35 },
    { kind: "path", d: "M31 60 L33 62 L37 57 M51 60 L53 62 L57 57 M71 60 L73 62 L77 57 M91 60 L93 62 L97 57 M31 82 L33 84 L37 79 M51 82 L53 84 L57 79", stroke: "brand", strokeWidth: 1.6, round: true },
    { kind: "circle", cx: 132, cy: 84, r: 20, fill: "accent" },
    { kind: "path", d: "M132 72 C126 82 122 88 128 94 C127 89 130 88 131 90 C133 86 138 84 134 76 C133 79 132 78 132 72 Z", fill: "white" },
  ],

  // Alternar métodos — a rotation/refresh arrow around video, audio and book icons.
  methodMix: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "path", d: "M80 22 A38 38 0 1 1 46 40", stroke: "brandLight", strokeWidth: 5, round: true },
    { kind: "path", d: "M34 32 L46 40 L40 54 Z", fill: "brandLight" },
    { kind: "circle", cx: 80, cy: 34, r: 15, fill: "accent" },
    { kind: "path", d: "M76 28 L86 34 L76 40 Z", fill: "white" },
    { kind: "circle", cx: 40, cy: 82, r: 15, fill: "brand" },
    { kind: "path", d: "M33 78 L33 86 M40 74 L40 90 M47 78 L47 86", stroke: "white", strokeWidth: 2.4, round: true },
    { kind: "circle", cx: 118, cy: 82, r: 15, fill: "accentLight" },
    { kind: "rect", x: 111, y: 76, w: 14, h: 12, rx: 2, fill: "white" },
    { kind: "rect", x: 114, y: 79, w: 8, h: 2, rx: 1, fill: "accentLight" },
    { kind: "rect", x: 114, y: 83, w: 5, h: 2, rx: 1, fill: "accentLight" },
  ],

  // Diccionario interactivo — a speech/word bubble with an underlined word and a magnifier.
  interactiveDictionary: [
    { kind: "circle", cx: 78, cy: 58, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 22, y: 24, w: 108, h: 54, rx: 16, fill: "brand" },
    { kind: "path", d: "M46 78 L36 96 L62 78 Z", fill: "brand" },
    { kind: "text", x: 76, y: 48, size: 10, fill: "white", content: "чтобы", bold: true, anchor: "middle" },
    { kind: "path", d: "M56 54 H96", stroke: "accentLight", strokeWidth: 2.5, round: true },
    { kind: "text", x: 76, y: 66, size: 7, fill: "white", content: "para que · con el fin de", opacity: 0.85, anchor: "middle" },
    { kind: "circle", cx: 128, cy: 90, r: 16, fill: "white" },
    { kind: "circle", cx: 128, cy: 90, r: 16, stroke: "accentLight", strokeWidth: 5 },
    { kind: "path", d: "M139 101 L150 112", stroke: "accentLight", strokeWidth: 6, round: true },
    { kind: "text", x: 128, y: 94, size: 12, fill: "brand", content: "?", bold: true, anchor: "middle" },
  ],

  // Comunidad en Telegram — a paper-plane message with two chat bubbles.
  communityChat: [
    { kind: "circle", cx: 78, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 60, cy: 58, r: 36, fill: "brandLight" },
    { kind: "path", d: "M38 58 L88 40 L68 82 L60 66 L46 68 Z", fill: "white" },
    { kind: "path", d: "M68 82 L60 66 L88 40", stroke: "brandLight", strokeWidth: 2, opacity: 0.4, round: true },
    { kind: "circle", cx: 126, cy: 32, r: 16, fill: "accentLight" },
    { kind: "path", d: "M112 40 L120 50 L136 40 Z", fill: "accentLight" },
    { kind: "text", x: 126, y: 36, size: 13, fill: "white", content: "✓", bold: true, anchor: "middle" },
    { kind: "circle", cx: 132, cy: 90, r: 13, fill: "accent" },
    { kind: "path", d: "M120 96 L112 104 L122 100 Z", fill: "accent" },
    { kind: "path", d: "M126 86 H138 M126 90 H136 M126 94 H132", stroke: "white", strokeWidth: 1.6, round: true },
  ],
};
