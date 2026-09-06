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
  | "openDoors"
  | "easierThanItLooks"
  | "alphabetEvening"
  | "literaryClassics"
  | "keyboardSetup"
  | "dailyHabit"
  | "methodMix"
  | "platformContents"
  | "firstWeekPlan";

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

  // Qué puertas te abre — an open door with light spilling out, a suitcase
  // and a small globe: work, travel, and a skill few people around have.
  openDoors: [
    { kind: "circle", cx: 74, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "path", d: "M96 18 L146 30 L146 106 L96 100 Z", fill: "accentLight", opacity: 0.22 },
    { kind: "rect", x: 30, y: 16, w: 66, h: 92, rx: 5, fill: "brand" },
    { kind: "rect", x: 38, y: 24, w: 50, h: 76, rx: 3, fill: "muted" },
    { kind: "path", d: "M38 24 L88 12 L88 112 L38 100 Z", fill: "brandLight" },
    { kind: "circle", cx: 80, cy: 62, r: 3.4, fill: "accentLight" },
    { kind: "rect", x: 104, y: 62, w: 30, h: 22, rx: 3, fill: "accent" },
    { kind: "rect", x: 114, y: 56, w: 10, h: 6, rx: 2, fill: "accent" },
    { kind: "path", d: "M104 72 H134", stroke: "white", strokeWidth: 1.6 },
    { kind: "circle", cx: 122, cy: 34, r: 13, fill: "brandLight" },
    { kind: "path", d: "M109 34 H135 M122 21 V47 M113 25 Q122 34 113 43 M131 25 Q122 34 131 43", stroke: "white", strokeWidth: 1.4, opacity: 0.75 },
  ],

  // Es más fácil de lo que parece — a short checklist: three things the
  // language does NOT have, and one honest line for what it does.
  easierThanItLooks: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 18, y: 18, w: 124, h: 84, rx: 14, fill: "muted" },
    { kind: "rect", x: 22, y: 22, w: 116, h: 76, rx: 12, fill: "white" },
    { kind: "circle", cx: 38, cy: 40, r: 7, fill: "accentLight" },
    { kind: "path", d: "M35 40 L37 42.5 L41.5 36.5", stroke: "white", strokeWidth: 2, round: true },
    { kind: "rect", x: 52, y: 37, w: 72, h: 6, rx: 3, fill: "muted" },
    { kind: "circle", cx: 38, cy: 60, r: 7, fill: "accentLight" },
    { kind: "path", d: "M35 60 L37 62.5 L41.5 56.5", stroke: "white", strokeWidth: 2, round: true },
    { kind: "rect", x: 52, y: 57, w: 58, h: 6, rx: 3, fill: "muted" },
    { kind: "circle", cx: 38, cy: 80, r: 7, fill: "accentLight" },
    { kind: "path", d: "M35 80 L37 82.5 L41.5 76.5", stroke: "white", strokeWidth: 2, round: true },
    { kind: "rect", x: 52, y: 77, w: 66, h: 6, rx: 3, fill: "muted" },
    { kind: "circle", cx: 130, cy: 96, r: 15, fill: "brandLight" },
    { kind: "text", x: 130, y: 101, size: 14, fill: "white", content: "!", bold: true, anchor: "middle" },
  ],

  // El alfabeto en una tarde — three Cyrillic letters and a crescent moon.
  alphabetEvening: [
    { kind: "circle", cx: 74, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 34, w: 40, h: 40, rx: 8, fill: "brandLight" },
    { kind: "text", x: 36, y: 62, size: 22, fill: "white", content: "А", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 34, w: 40, h: 40, rx: 8, fill: "accent" },
    { kind: "text", x: 80, y: 62, size: 22, fill: "white", content: "Б", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 34, w: 40, h: 40, rx: 8, fill: "brand" },
    { kind: "text", x: 124, y: 62, size: 22, fill: "white", content: "В", bold: true, anchor: "middle" },
    { kind: "path", d: "M126 88 A14 14 0 1 0 140 102 A11 11 0 1 1 126 88 Z", fill: "accentLight" },
    { kind: "circle", cx: 30, cy: 92, r: 2.6, fill: "brandLight" },
    { kind: "circle", cx: 48, cy: 100, r: 2, fill: "brandLight" },
    { kind: "circle", cx: 66, cy: 92, r: 2.6, fill: "brandLight" },
    { kind: "text", x: 88, y: 100, size: 8, fill: "inkSoft", content: "una tarde", anchor: "middle" },
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



  // Cómo escribir en ruso — el celular primero, la computadora después.
  keyboardSetup: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 12, y: 14, w: 48, h: 92, rx: 9, fill: "ink" },
    { kind: "rect", x: 17, y: 22, w: 38, h: 62, rx: 4, fill: "brandLight" },
    { kind: "text", x: 36, y: 58, size: 24, fill: "white", content: "Я", bold: true, anchor: "middle" },
    { kind: "rect", x: 17, y: 88, w: 10, h: 6, rx: 2, fill: "inkSoft" },
    { kind: "rect", x: 30, y: 88, w: 25, h: 6, rx: 2, fill: "accentLight" },
    { kind: "rect", x: 17, y: 97, w: 38, h: 5, rx: 2, fill: "inkSoft" },
    { kind: "rect", x: 72, y: 30, w: 78, h: 50, rx: 6, fill: "ink" },
    { kind: "rect", x: 77, y: 35, w: 68, h: 40, rx: 3, fill: "brandLight" },
    { kind: "text", x: 111, y: 60, size: 18, fill: "white", content: "ЙЦУКЕН", bold: true, anchor: "middle" },
    { kind: "rect", x: 66, y: 82, w: 90, h: 7, rx: 3, fill: "inkSoft" },
    { kind: "rect", x: 96, y: 96, w: 44, h: 10, rx: 4, fill: "accent" },
    { kind: "text", x: 118, y: 104, size: 6.5, fill: "white", content: "cambiar idioma", bold: true, anchor: "middle" },
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

  // Qué hay adentro — a grid of content tiles, one per family.
  platformContents: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 16, y: 20, w: 42, h: 30, rx: 6, fill: "brand" },
    { kind: "rect", x: 22, y: 28, w: 24, h: 3.5, rx: 1.75, fill: "white", opacity: 0.85 },
    { kind: "rect", x: 22, y: 35, w: 30, h: 3.5, rx: 1.75, fill: "white", opacity: 0.5 },
    { kind: "rect", x: 22, y: 42, w: 18, h: 3.5, rx: 1.75, fill: "white", opacity: 0.5 },
    { kind: "rect", x: 62, y: 20, w: 42, h: 30, rx: 6, fill: "brandLight" },
    { kind: "path", d: "M76 28 L92 35 L76 42 Z", fill: "white" },
    { kind: "rect", x: 108, y: 20, w: 36, h: 30, rx: 6, fill: "accent" },
    { kind: "path", d: "M118 28 V42 M126 24 V46 M134 30 V40", stroke: "white", strokeWidth: 2.6, round: true },
    { kind: "rect", x: 16, y: 56, w: 36, h: 30, rx: 6, fill: "accentLight" },
    { kind: "text", x: 34, y: 77, size: 15, fill: "white", content: "Аа", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 56, w: 48, h: 30, rx: 6, fill: "muted" },
    { kind: "rect", x: 62, y: 62, w: 8, h: 8, rx: 1.5, fill: "brand" },
    { kind: "rect", x: 74, y: 62, w: 8, h: 8, rx: 1.5, fill: "brandLight" },
    { kind: "rect", x: 86, y: 62, w: 8, h: 8, rx: 1.5, fill: "brand" },
    { kind: "rect", x: 62, y: 73, w: 8, h: 8, rx: 1.5, fill: "brandLight" },
    { kind: "rect", x: 74, y: 73, w: 8, h: 8, rx: 1.5, fill: "accent" },
    { kind: "rect", x: 86, y: 73, w: 8, h: 8, rx: 1.5, fill: "brandLight" },
    { kind: "rect", x: 108, y: 56, w: 36, h: 30, rx: 6, fill: "brand" },
    { kind: "path", d: "M118 66 L124 72 L136 62", stroke: "white", strokeWidth: 2.6, round: true },
    { kind: "rect", x: 16, y: 92, w: 128, h: 12, rx: 6, fill: "muted" },
    { kind: "rect", x: 16, y: 92, w: 92, h: 12, rx: 6, fill: "accentLight" },
    { kind: "text", x: 62, y: 101, size: 7, fill: "white", content: "A1 · A2 · B1 · B2", bold: true, anchor: "middle" },
    { kind: "text", x: 126, y: 101, size: 7, fill: "inkSoft", content: "C1", bold: true, anchor: "middle" },
  ],

  // Tu primera semana — a week strip with today marked and a flag at the end.
  firstWeekPlan: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 44, w: 140, h: 34, rx: 10, fill: "muted" },
    { kind: "circle", cx: 27, cy: 61, r: 12, fill: "accent" },
    { kind: "text", x: 27, y: 65, size: 9, fill: "white", content: "hoy", bold: true, anchor: "middle" },
    { kind: "circle", cx: 51, cy: 61, r: 8, fill: "brandLight" },
    { kind: "circle", cx: 71, cy: 61, r: 8, fill: "brandLight", opacity: 0.75 },
    { kind: "circle", cx: 91, cy: 61, r: 8, fill: "brandLight", opacity: 0.55 },
    { kind: "circle", cx: 111, cy: 61, r: 8, fill: "brandLight", opacity: 0.4 },
    { kind: "circle", cx: 131, cy: 61, r: 8, fill: "brandLight", opacity: 0.28 },
    { kind: "path", d: "M139 44 V22", stroke: "ink", strokeWidth: 2.4, round: true },
    { kind: "path", d: "M139 22 L118 27 L139 33 Z", fill: "accentLight" },
    { kind: "path", d: "M20 92 H140", stroke: "muted", strokeWidth: 3, round: true },
    { kind: "path", d: "M20 92 H60", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "text", x: 80, y: 108, size: 7.5, fill: "inkSoft", content: "alfabeto · lección · tarjetas · relato · juego", anchor: "middle" },
  ],
};
