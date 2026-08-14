import type { SlideIconKey } from "./types";

/**
 * Small hero illustrations for the lesson slide deck (web SlidesTab and the
 * PDF export) — one flat-design vector scene per SlideIconKey, built from
 * plain shapes (no external image assets, since none exist for this
 * project) so the same recipe renders identically as a plain <svg> on the
 * web and as a react-pdf <Svg> in the downloaded PDF. Colors are passed in
 * by the caller so both renderers can use their own brand-color constants
 * (see BRAND/BRAND_LIGHT/BRAND_ACCENT/BRAND_ACCENT_LIGHT in
 * SlideIllustration.tsx and pdf.tsx) rather than duplicating a palette here.
 */
export const ILLUSTRATION_VIEWBOX = { width: 160, height: 120 };

export type IllustrationColorRole = "brand" | "brandLight" | "accent" | "accentLight" | "ink" | "inkSoft" | "muted" | "white" | "danger";

export type IllustrationShape =
  | {
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      fill?: IllustrationColorRole;
      stroke?: IllustrationColorRole;
      strokeWidth?: number;
      opacity?: number;
    }
  | { kind: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill: IllustrationColorRole; opacity?: number }
  | {
      kind: "path";
      d: string;
      fill?: IllustrationColorRole;
      stroke?: IllustrationColorRole;
      strokeWidth?: number;
      opacity?: number;
      round?: boolean;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      size: number;
      fill: IllustrationColorRole;
      content: string;
      bold?: boolean;
      anchor?: "start" | "middle" | "end";
      opacity?: number;
    };

export const slideIllustrations: Record<SlideIconKey, IllustrationShape[]> = {
  // Bienvenida — a sparkle burst.
  star: [
    { kind: "circle", cx: 80, cy: 60, r: 46, fill: "brand", opacity: 0.08 },
    { kind: "path", d: "M80 26 C83 46 92 55 114 60 C92 65 83 74 80 94 C77 74 68 65 46 60 C68 55 77 46 80 26 Z", fill: "accentLight" },
    { kind: "circle", cx: 32, cy: 34, r: 5, fill: "brandLight", opacity: 0.8 },
    { kind: "circle", cx: 124, cy: 88, r: 4, fill: "brand", opacity: 0.7 },
    { kind: "circle", cx: 128, cy: 30, r: 3, fill: "accent", opacity: 0.7 },
  ],

  // Estructura del alfabeto — an open book with a "33" badge.
  book: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 28, y: 38, w: 46, h: 56, rx: 5, fill: "brand" },
    { kind: "rect", x: 86, y: 38, w: 46, h: 56, rx: 5, fill: "brandLight" },
    { kind: "rect", x: 72, y: 36, w: 16, h: 60, rx: 3, fill: "ink" },
    { kind: "rect", x: 36, y: 50, w: 30, h: 4, rx: 2, fill: "white", opacity: 0.6 },
    { kind: "rect", x: 36, y: 60, w: 30, h: 4, rx: 2, fill: "white", opacity: 0.45 },
    { kind: "rect", x: 36, y: 70, w: 22, h: 4, rx: 2, fill: "white", opacity: 0.3 },
    { kind: "rect", x: 94, y: 50, w: 30, h: 4, rx: 2, fill: "white", opacity: 0.6 },
    { kind: "rect", x: 94, y: 60, w: 30, h: 4, rx: 2, fill: "white", opacity: 0.45 },
    { kind: "rect", x: 94, y: 70, w: 22, h: 4, rx: 2, fill: "white", opacity: 0.3 },
    { kind: "circle", cx: 132, cy: 26, r: 17, fill: "accentLight" },
    { kind: "text", x: 132, y: 31, size: 13, fill: "white", content: "33", bold: true, anchor: "middle" },
  ],

  // Vocales — a speaker with sound waves and floating vowel chips.
  ear: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "path", d: "M32 48 L48 48 L66 34 L66 86 L48 72 L32 72 Z", fill: "brand" },
    { kind: "path", d: "M78 46 A16 16 0 0 1 78 74", stroke: "accentLight", strokeWidth: 4, round: true },
    { kind: "path", d: "M88 36 A28 28 0 0 1 88 84", stroke: "accentLight", strokeWidth: 4, opacity: 0.6, round: true },
    { kind: "path", d: "M98 26 A40 40 0 0 1 98 94", stroke: "accentLight", strokeWidth: 4, opacity: 0.35, round: true },
    { kind: "circle", cx: 128, cy: 22, r: 13, fill: "accent" },
    { kind: "text", x: 128, y: 27, size: 13, fill: "white", content: "А", bold: true, anchor: "middle" },
    { kind: "circle", cx: 142, cy: 58, r: 13, fill: "brandLight" },
    { kind: "text", x: 142, y: 63, size: 13, fill: "white", content: "О", bold: true, anchor: "middle" },
    { kind: "circle", cx: 126, cy: 96, r: 13, fill: "accentLight" },
    { kind: "text", x: 126, y: 101, size: 13, fill: "white", content: "У", bold: true, anchor: "middle" },
  ],

  // Consonantes — a speech bubble with three tricky letters.
  chat: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 22, y: 22, w: 116, h: 56, rx: 18, fill: "brand" },
    { kind: "path", d: "M50 78 L40 96 L66 78 Z", fill: "brand" },
    { kind: "text", x: 52, y: 58, size: 24, fill: "white", content: "Ж", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 24, fill: "accentLight", content: "Ш", bold: true, anchor: "middle" },
    { kind: "text", x: 108, y: 58, size: 24, fill: "white", content: "Ч", bold: true, anchor: "middle" },
  ],

  // Trampas de pronunciación — a magnifying glass over a letter.
  warning: [
    { kind: "circle", cx: 70, cy: 58, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 66, cy: 54, r: 26, fill: "white" },
    { kind: "circle", cx: 66, cy: 54, r: 26, stroke: "accentLight", strokeWidth: 6 },
    { kind: "text", x: 66, y: 63, size: 26, fill: "brand", content: "Л", bold: true, anchor: "middle" },
    { kind: "path", d: "M85 73 L104 92", stroke: "accentLight", strokeWidth: 7, round: true },
    { kind: "circle", cx: 130, cy: 26, r: 15, fill: "danger" },
    { kind: "text", x: 130, y: 32, size: 16, fill: "white", content: "!", bold: true, anchor: "middle" },
  ],

  // Falsos amigos visuales — a Latin letter crossed out next to its
  // Cyrillic look-alike with a checkmark. The single most content-relevant
  // illustration in the set.
  compare: [
    { kind: "rect", x: 14, y: 24, w: 58, h: 68, rx: 12, fill: "muted" },
    { kind: "text", x: 43, y: 70, size: 36, fill: "inkSoft", content: "B", bold: true, anchor: "middle" },
    { kind: "path", d: "M26 38 L60 82", stroke: "danger", strokeWidth: 5, round: true },
    { kind: "path", d: "M72 58 L90 58 M83 50 L92 58 L83 66", stroke: "accentLight", strokeWidth: 5, round: true },
    { kind: "rect", x: 88, y: 24, w: 58, h: 68, rx: 12, fill: "brand" },
    { kind: "text", x: 117, y: 70, size: 36, fill: "white", content: "В", bold: true, anchor: "middle" },
    { kind: "circle", cx: 134, cy: 32, r: 12, fill: "accentLight" },
    { kind: "path", d: "M129 32 L133 36 L140 27", stroke: "white", strokeWidth: 3, round: true },
  ],

  // Primeras palabras — a little house saying "дом".
  house: [
    { kind: "circle", cx: 65, cy: 65, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "path", d: "M28 62 L78 26 L128 62 Z", fill: "brand" },
    { kind: "rect", x: 42, y: 62, w: 72, h: 46, rx: 4, fill: "brandLight" },
    { kind: "rect", x: 70, y: 84, w: 16, h: 24, rx: 2, fill: "ink" },
    { kind: "rect", x: 52, y: 72, w: 14, h: 14, rx: 2, fill: "white", opacity: 0.85 },
    { kind: "rect", x: 96, y: 10, w: 56, h: 30, rx: 10, fill: "accentLight" },
    { kind: "path", d: "M106 40 L100 52 L120 40 Z", fill: "accentLight" },
    { kind: "text", x: 124, y: 30, size: 15, fill: "white", content: "дом", bold: true, anchor: "middle" },
  ],

  // Resumen — graduation cap + a completion check.
  graduation: [
    { kind: "circle", cx: 75, cy: 55, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "path", d: "M76 20 L126 44 L76 68 L26 44 Z", fill: "brand" },
    { kind: "rect", x: 54, y: 66, w: 44, h: 18, rx: 4, fill: "brandLight" },
    { kind: "path", d: "M126 44 L138 72", stroke: "accentLight", strokeWidth: 4, round: true },
    { kind: "circle", cx: 138, cy: 76, r: 4, fill: "accentLight" },
    { kind: "circle", cx: 122, cy: 96, r: 16, fill: "accentLight" },
    { kind: "path", d: "M114 96 L120 102 L131 88", stroke: "white", strokeWidth: 3.5, round: true },
    { kind: "circle", cx: 30, cy: 100, r: 4, fill: "brand", opacity: 0.5 },
    { kind: "circle", cx: 44, cy: 104, r: 4, fill: "brandLight", opacity: 0.6 },
    { kind: "circle", cx: 58, cy: 100, r: 4, fill: "accentLight", opacity: 0.7 },
  ],

  // Saludo informal — a person waving, saying "Привет!".
  wave: [
    { kind: "circle", cx: 60, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 45, cy: 40, r: 14, fill: "brand" },
    { kind: "rect", x: 30, y: 54, w: 30, h: 42, rx: 15, fill: "brand" },
    { kind: "path", d: "M58 58 L74 38", stroke: "brand", strokeWidth: 10, round: true },
    { kind: "circle", cx: 76, cy: 34, r: 7, fill: "brand" },
    { kind: "rect", x: 80, y: 12, w: 68, h: 34, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M96 46 L90 58 L108 46 Z", fill: "accentLight" },
    { kind: "text", x: 114, y: 33, size: 14, fill: "white", content: "Привет!", bold: true, anchor: "middle" },
  ],

  // Saludo formal — two hands meeting, saying "Здравствуйте!".
  handshake: [
    { kind: "circle", cx: 80, cy: 65, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "path", d: "M18 70 L70 55 L74 65 L22 82 Z", fill: "brand" },
    { kind: "path", d: "M142 70 L90 55 L86 65 L138 82 Z", fill: "brandLight" },
    { kind: "circle", cx: 80, cy: 62, r: 10, fill: "accentLight" },
    { kind: "rect", x: 32, y: 10, w: 96, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M75 42 L70 54 L88 42 Z", fill: "brand" },
    { kind: "text", x: 80, y: 30, size: 10.5, fill: "white", content: "Здравствуйте!", bold: true, anchor: "middle" },
  ],

  // Pronombres — я / ты / вы as three simple figures.
  people: [
    { kind: "circle", cx: 30, cy: 38, r: 13, fill: "brand" },
    { kind: "rect", x: 17, y: 50, w: 26, h: 36, rx: 12, fill: "brand" },
    { kind: "circle", cx: 30, cy: 100, r: 14, fill: "brand" },
    { kind: "text", x: 30, y: 105, size: 13, fill: "white", content: "Я", bold: true, anchor: "middle" },
    { kind: "circle", cx: 80, cy: 32, r: 13, fill: "brandLight" },
    { kind: "rect", x: 67, y: 44, w: 26, h: 36, rx: 12, fill: "brandLight" },
    { kind: "circle", cx: 80, cy: 100, r: 14, fill: "brandLight" },
    { kind: "text", x: 80, y: 105, size: 10, fill: "white", content: "ТЫ", bold: true, anchor: "middle" },
    { kind: "circle", cx: 124, cy: 32, r: 11, fill: "accentLight", opacity: 0.85 },
    { kind: "circle", cx: 140, cy: 36, r: 11, fill: "accentLight" },
    { kind: "rect", x: 113, y: 43, w: 22, h: 32, rx: 10, fill: "accentLight", opacity: 0.85 },
    { kind: "rect", x: 129, y: 46, w: 22, h: 32, rx: 10, fill: "accentLight" },
    { kind: "circle", cx: 131, cy: 100, r: 14, fill: "accentLight" },
    { kind: "text", x: 131, y: 105, size: 9.5, fill: "white", content: "ВЫ", bold: true, anchor: "middle" },
  ],

  // "Меня зовут ___" — a name tag.
  badge: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "path", d: "M80 8 L80 22", stroke: "inkSoft", strokeWidth: 3, round: true },
    { kind: "circle", cx: 80, cy: 8, r: 5, fill: "inkSoft" },
    { kind: "rect", x: 33, y: 20, w: 94, h: 70, rx: 12, fill: "brand" },
    { kind: "rect", x: 37, y: 24, w: 86, h: 62, rx: 8, fill: "white" },
    { kind: "rect", x: 37, y: 24, w: 86, h: 20, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 37, size: 8.5, fill: "white", content: "МЕНЯ ЗОВУТ", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 20, fill: "brand", content: "Ана", bold: true, anchor: "middle" },
    { kind: "circle", cx: 133, cy: 96, r: 4, fill: "accentLight", opacity: 0.6 },
    { kind: "circle", cx: 24, cy: 88, r: 3, fill: "brandLight", opacity: 0.6 },
  ],

  // "Как дела?" — "Хорошо!" question-and-answer exchange.
  exchange: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 92, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M30 48 L24 60 L44 48 Z", fill: "brand" },
    { kind: "text", x: 60, y: 37, size: 13, fill: "white", content: "Как дела?", bold: true, anchor: "middle" },
    { kind: "rect", x: 54, y: 66, w: 92, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M130 66 L136 54 L116 66 Z", fill: "accentLight" },
    { kind: "text", x: 100, y: 87, size: 13, fill: "white", content: "Хорошо!", bold: true, anchor: "middle" },
  ],

  // Despedida — a figure waving goodbye through a door, "Пока!".
  farewell: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 90, y: 20, w: 50, h: 90, rx: 4, fill: "brand" },
    { kind: "rect", x: 96, y: 26, w: 38, h: 78, rx: 2, fill: "brandLight" },
    { kind: "circle", cx: 124, cy: 65, r: 3, fill: "accentLight" },
    { kind: "circle", cx: 40, cy: 55, r: 12, fill: "inkSoft" },
    { kind: "rect", x: 28, y: 66, w: 24, h: 34, rx: 10, fill: "inkSoft" },
    { kind: "path", d: "M52 68 L66 52", stroke: "inkSoft", strokeWidth: 8, round: true },
    { kind: "circle", cx: 68, cy: 49, r: 6, fill: "inkSoft" },
    { kind: "rect", x: 8, y: 12, w: 58, h: 28, rx: 12, fill: "accentLight" },
    { kind: "path", d: "M28 40 L24 50 L42 40 Z", fill: "accentLight" },
    { kind: "text", x: 37, y: 30, size: 13, fill: "white", content: "Пока!", bold: true, anchor: "middle" },
  ],

  // Español (orden/preposiciones fijos) vs. ruso (la palabra misma cambia).
  structureCompare: [
    { kind: "rect", x: 14, y: 20, w: 60, h: 80, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 36, size: 13, fill: "inkSoft", content: "ES", bold: true, anchor: "middle" },
    { kind: "rect", x: 22, y: 50, w: 44, h: 10, rx: 4, fill: "inkSoft", opacity: 0.5 },
    { kind: "rect", x: 22, y: 64, w: 44, h: 10, rx: 4, fill: "inkSoft", opacity: 0.35 },
    { kind: "rect", x: 22, y: 78, w: 44, h: 10, rx: 4, fill: "inkSoft", opacity: 0.2 },
    { kind: "path", d: "M76 60 L84 60 M80 55 L86 60 L80 65", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 86, y: 20, w: 60, h: 80, rx: 10, fill: "brand" },
    { kind: "text", x: 116, y: 36, size: 13, fill: "white", content: "RU", bold: true, anchor: "middle" },
    { kind: "text", x: 116, y: 62, size: 13, fill: "white", content: "стол", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 68, w: 24, h: 12, rx: 4, fill: "accentLight" },
    { kind: "text", x: 116, y: 77, size: 8, fill: "white", content: "-а", bold: true, anchor: "middle" },
  ],

  // Los 6 casos gramaticales como una rueda de opciones alrededor de "¿cuál?".
  casesWheel: [
    { kind: "circle", cx: 80, cy: 60, r: 52, fill: "brand", opacity: 0.05 },
    { kind: "path", d: "M80 60 L122 60", stroke: "brand", strokeWidth: 2, opacity: 0.3 },
    { kind: "path", d: "M80 60 L101 24", stroke: "brand", strokeWidth: 2, opacity: 0.3 },
    { kind: "path", d: "M80 60 L59 24", stroke: "brand", strokeWidth: 2, opacity: 0.3 },
    { kind: "path", d: "M80 60 L38 60", stroke: "brand", strokeWidth: 2, opacity: 0.3 },
    { kind: "path", d: "M80 60 L59 96", stroke: "brand", strokeWidth: 2, opacity: 0.3 },
    { kind: "path", d: "M80 60 L101 96", stroke: "brand", strokeWidth: 2, opacity: 0.3 },
    { kind: "circle", cx: 80, cy: 60, r: 17, fill: "brand" },
    { kind: "text", x: 80, y: 65, size: 16, fill: "white", content: "?", bold: true, anchor: "middle" },
    { kind: "circle", cx: 122, cy: 60, r: 15, fill: "brandLight" },
    { kind: "text", x: 122, y: 63, size: 8, fill: "white", content: "Ном.", bold: true, anchor: "middle" },
    { kind: "circle", cx: 101, cy: 24, r: 15, fill: "accentLight" },
    { kind: "text", x: 101, y: 27, size: 8, fill: "white", content: "Род.", bold: true, anchor: "middle" },
    { kind: "circle", cx: 59, cy: 24, r: 15, fill: "brandLight" },
    { kind: "text", x: 59, y: 27, size: 8, fill: "white", content: "Дат.", bold: true, anchor: "middle" },
    { kind: "circle", cx: 38, cy: 60, r: 15, fill: "accentLight" },
    { kind: "text", x: 38, y: 63, size: 8, fill: "white", content: "Вин.", bold: true, anchor: "middle" },
    { kind: "circle", cx: 59, cy: 96, r: 15, fill: "brandLight" },
    { kind: "text", x: 59, y: 99, size: 7, fill: "white", content: "Твор.", bold: true, anchor: "middle" },
    { kind: "circle", cx: 101, cy: 96, r: 15, fill: "accentLight" },
    { kind: "text", x: 101, y: 99, size: 6.5, fill: "white", content: "Предл.", bold: true, anchor: "middle" },
  ],

  // Empieza siempre por el nominativo — una forma sólida en el centro, las
  // demás (todavía) en segundo plano.
  safeStart: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 16, w: 38, h: 18, rx: 6, fill: "muted", opacity: 0.7 },
    { kind: "text", x: 35, y: 28, size: 8, fill: "inkSoft", content: "стола", opacity: 0.7, anchor: "middle" },
    { kind: "rect", x: 106, y: 86, w: 38, h: 18, rx: 6, fill: "muted", opacity: 0.7 },
    { kind: "text", x: 125, y: 98, size: 8, fill: "inkSoft", content: "столу", opacity: 0.7, anchor: "middle" },
    { kind: "rect", x: 16, y: 86, w: 38, h: 18, rx: 6, fill: "muted", opacity: 0.7 },
    { kind: "text", x: 35, y: 98, size: 7.5, fill: "inkSoft", content: "столом", opacity: 0.7, anchor: "middle" },
    { kind: "rect", x: 52, y: 38, w: 56, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 63, size: 17, fill: "white", content: "стол", bold: true, anchor: "middle" },
    { kind: "circle", cx: 118, cy: 40, r: 13, fill: "accentLight" },
    { kind: "path", d: "M112 40 L117 45 L126 34", stroke: "white", strokeWidth: 3, round: true },
  ],

  // Masculino / femenino / neutro, reconocibles por la terminación.
  genderTrio: [
    { kind: "rect", x: 8, y: 20, w: 44, h: 80, rx: 10, fill: "brand" },
    { kind: "text", x: 30, y: 44, size: 11, fill: "white", content: "город", bold: true, anchor: "middle" },
    { kind: "rect", x: 18, y: 52, w: 24, h: 12, rx: 4, fill: "accentLight" },
    { kind: "text", x: 30, y: 61, size: 7, fill: "white", content: "-∅", bold: true, anchor: "middle" },
    { kind: "circle", cx: 30, cy: 86, r: 12, fill: "white", opacity: 0.9 },
    { kind: "text", x: 30, y: 91, size: 13, fill: "brand", content: "М", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 20, w: 44, h: 80, rx: 10, fill: "brandLight" },
    { kind: "text", x: 80, y: 44, size: 11, fill: "white", content: "книга", bold: true, anchor: "middle" },
    { kind: "rect", x: 70, y: 52, w: 20, h: 12, rx: 4, fill: "accentLight" },
    { kind: "text", x: 80, y: 61, size: 8, fill: "white", content: "-а", bold: true, anchor: "middle" },
    { kind: "circle", cx: 80, cy: 86, r: 12, fill: "white", opacity: 0.9 },
    { kind: "text", x: 80, y: 91, size: 13, fill: "brandLight", content: "Ж", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 20, w: 44, h: 80, rx: 10, fill: "accentLight" },
    { kind: "text", x: 130, y: 44, size: 11, fill: "white", content: "окно", bold: true, anchor: "middle" },
    { kind: "rect", x: 120, y: 52, w: 20, h: 12, rx: 4, fill: "brand" },
    { kind: "text", x: 130, y: 61, size: 8, fill: "white", content: "-о", bold: true, anchor: "middle" },
    { kind: "circle", cx: 130, cy: 86, r: 12, fill: "white", opacity: 0.9 },
    { kind: "text", x: 130, y: 91, size: 13, fill: "accent", content: "С", bold: true, anchor: "middle" },
  ],

  // Un pequeño set de tarjetas de vocabulario, como flashcards.
  wordCards: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 13, fill: "white", content: "стол", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "mesa", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 13, fill: "white", content: "книга", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "libro", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 13, fill: "white", content: "окно", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "ventana", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 13, fill: "white", content: "дверь", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "puerta", opacity: 0.85, anchor: "middle" },
  ],

  // "Это" + objeto = tu primera frase completa.
  template: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 44, w: 44, h: 32, rx: 10, fill: "brand" },
    { kind: "text", x: 32, y: 65, size: 15, fill: "white", content: "Это", bold: true, anchor: "middle" },
    { kind: "text", x: 64, y: 65, size: 18, fill: "inkSoft", content: "+", bold: true, anchor: "middle" },
    { kind: "rect", x: 76, y: 40, w: 60, h: 40, rx: 10, fill: "accentLight", opacity: 0.18 },
    { kind: "rect", x: 88, y: 52, w: 36, h: 20, rx: 3, fill: "accentLight" },
    { kind: "rect", x: 104, y: 50, w: 4, h: 24, fill: "brand" },
    { kind: "text", x: 80, y: 104, size: 10, fill: "inkSoft", content: "= Это книга.", bold: true, anchor: "middle" },
  ],

  // Los números 0-10, como una fila de fichas.
  numberGrid: [
    { kind: "rect", x: 10, y: 14, w: 42, h: 34, rx: 8, fill: "brand" },
    { kind: "text", x: 31, y: 37, size: 16, fill: "white", content: "0", bold: true, anchor: "middle" },
    { kind: "rect", x: 62, y: 14, w: 42, h: 34, rx: 8, fill: "brandLight" },
    { kind: "text", x: 83, y: 37, size: 16, fill: "white", content: "1", bold: true, anchor: "middle" },
    { kind: "rect", x: 114, y: 14, w: 42, h: 34, rx: 8, fill: "accentLight" },
    { kind: "text", x: 135, y: 37, size: 16, fill: "white", content: "2", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 54, w: 42, h: 34, rx: 8, fill: "accentLight" },
    { kind: "text", x: 31, y: 77, size: 16, fill: "white", content: "3", bold: true, anchor: "middle" },
    { kind: "rect", x: 62, y: 54, w: 42, h: 34, rx: 8, fill: "brand" },
    { kind: "text", x: 83, y: 77, size: 16, fill: "white", content: "4", bold: true, anchor: "middle" },
    { kind: "rect", x: 114, y: 54, w: 42, h: 34, rx: 8, fill: "brandLight" },
    { kind: "text", x: 135, y: 77, size: 16, fill: "white", content: "5", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 104, size: 11, fill: "inkSoft", content: "… hasta 10", bold: true, anchor: "middle" },
  ],

  // 11-20: el sufijo "-надцать" — y el 20 que rompe el patrón.
  numberBuild: [
    { kind: "rect", x: 8, y: 38, w: 48, h: 32, rx: 8, fill: "brand" },
    { kind: "text", x: 32, y: 58, size: 12, fill: "white", content: "один", bold: true, anchor: "middle" },
    { kind: "text", x: 64, y: 58, size: 16, fill: "inkSoft", content: "+", bold: true, anchor: "middle" },
    { kind: "rect", x: 74, y: 38, w: 66, h: 32, rx: 8, fill: "accentLight" },
    { kind: "text", x: 107, y: 58, size: 9.5, fill: "white", content: "-надцать", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 10.5, fill: "brand", content: "= одиннадцать (11)", bold: true, anchor: "middle" },
    { kind: "circle", cx: 140, cy: 18, r: 15, fill: "danger" },
    { kind: "text", x: 140, y: 22, size: 12, fill: "white", content: "20", bold: true, anchor: "middle" },
    { kind: "text", x: 140, y: 40, size: 6, fill: "danger", content: "excepción", bold: true, anchor: "middle" },
  ],

  // "Сколько это стоит?" — una etiqueta de precio con rublos.
  priceTag: [
    { kind: "circle", cx: 65, cy: 65, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "path", d: "M20 55 L38 37 L104 37 L104 74 L38 74 Z", fill: "accentLight" },
    { kind: "circle", cx: 38, cy: 55, r: 5, fill: "white" },
    { kind: "text", x: 74, y: 62, size: 20, fill: "white", content: "₽", bold: true, anchor: "middle" },
    { kind: "rect", x: 92, y: 8, w: 62, h: 30, rx: 14, fill: "brand" },
    { kind: "path", d: "M112 36 L106 48 L124 36 Z", fill: "brand" },
    { kind: "text", x: 123, y: 27, size: 10, fill: "white", content: "Сколько?", bold: true, anchor: "middle" },
    { kind: "text", x: 24, y: 96, size: 11, fill: "brandLight", content: "10", bold: true, anchor: "middle", opacity: 0.8 },
    { kind: "text", x: 132, y: 100, size: 11, fill: "brand", content: "50", bold: true, anchor: "middle", opacity: 0.6 },
  ],

  // рубль / рубля / рублей — la misma regla 1 / 2-4 / 5+ aplicada al rublo.
  rubleCount: [
    { kind: "rect", x: 6, y: 14, w: 44, h: 92, rx: 8, fill: "brand" },
    { kind: "circle", cx: 28, cy: 40, r: 12, fill: "white", opacity: 0.9 },
    { kind: "text", x: 28, y: 45, size: 12, fill: "brand", content: "₽", bold: true, anchor: "middle" },
    { kind: "text", x: 28, y: 80, size: 9.5, fill: "white", content: "рубль", bold: true, anchor: "middle" },
    { kind: "text", x: 28, y: 98, size: 8, fill: "white", content: "1", opacity: 0.8, anchor: "middle" },
    { kind: "rect", x: 58, y: 14, w: 44, h: 92, rx: 8, fill: "brandLight" },
    { kind: "circle", cx: 72, cy: 38, r: 10, fill: "white", opacity: 0.9 },
    { kind: "circle", cx: 90, cy: 38, r: 10, fill: "white", opacity: 0.9 },
    { kind: "text", x: 80, y: 80, size: 9.5, fill: "white", content: "рубля", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 8, fill: "white", content: "2-4", opacity: 0.8, anchor: "middle" },
    { kind: "rect", x: 110, y: 14, w: 44, h: 92, rx: 8, fill: "accentLight" },
    { kind: "circle", cx: 122, cy: 36, r: 8, fill: "white", opacity: 0.9 },
    { kind: "circle", cx: 138, cy: 36, r: 8, fill: "white", opacity: 0.9 },
    { kind: "circle", cx: 130, cy: 48, r: 8, fill: "white", opacity: 0.9 },
    { kind: "text", x: 132, y: 80, size: 8.5, fill: "white", content: "рублей", bold: true, anchor: "middle" },
    { kind: "text", x: 132, y: 98, size: 8, fill: "white", content: "5+", opacity: 0.8, anchor: "middle" },
  ],

  // "Который час?" — un reloj preguntando la hora.
  clockFace: [
    { kind: "circle", cx: 55, cy: 60, r: 46, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 55, cy: 60, r: 38, fill: "white" },
    { kind: "circle", cx: 55, cy: 60, r: 38, stroke: "brand", strokeWidth: 5 },
    { kind: "circle", cx: 55, cy: 26, r: 2, fill: "inkSoft" },
    { kind: "circle", cx: 89, cy: 60, r: 2, fill: "inkSoft" },
    { kind: "circle", cx: 55, cy: 94, r: 2, fill: "inkSoft" },
    { kind: "circle", cx: 21, cy: 60, r: 2, fill: "inkSoft" },
    { kind: "path", d: "M55 60 L55 38", stroke: "brand", strokeWidth: 4, round: true },
    { kind: "path", d: "M55 60 L74 60", stroke: "accentLight", strokeWidth: 4, round: true },
    { kind: "circle", cx: 55, cy: 60, r: 4, fill: "brand" },
    { kind: "rect", x: 90, y: 14, w: 62, h: 30, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M108 44 L102 56 L120 44 Z", fill: "accentLight" },
    { kind: "text", x: 121, y: 33, size: 9, fill: "white", content: "Который час?", bold: true, anchor: "middle" },
  ],

  // час / часа / часов — la misma regla 1 / 2-4 / 5+ aplicada a la hora.
  hourCount: [
    { kind: "rect", x: 6, y: 14, w: 44, h: 92, rx: 8, fill: "accentLight" },
    { kind: "circle", cx: 28, cy: 38, r: 13, fill: "white", opacity: 0.9 },
    { kind: "path", d: "M28 38 L28 30", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "text", x: 28, y: 80, size: 10, fill: "white", content: "час", bold: true, anchor: "middle" },
    { kind: "text", x: 28, y: 98, size: 8, fill: "white", content: "1", opacity: 0.8, anchor: "middle" },
    { kind: "rect", x: 58, y: 14, w: 44, h: 92, rx: 8, fill: "brand" },
    { kind: "circle", cx: 80, cy: 38, r: 13, fill: "white", opacity: 0.9 },
    { kind: "path", d: "M80 38 L80 30", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "text", x: 80, y: 80, size: 9.5, fill: "white", content: "часа", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 8, fill: "white", content: "2-4", opacity: 0.8, anchor: "middle" },
    { kind: "rect", x: 110, y: 14, w: 44, h: 92, rx: 8, fill: "brandLight" },
    { kind: "circle", cx: 132, cy: 38, r: 13, fill: "white", opacity: 0.9 },
    { kind: "path", d: "M132 38 L132 30", stroke: "brandLight", strokeWidth: 3, round: true },
    { kind: "text", x: 132, y: 80, size: 8.5, fill: "white", content: "часов", bold: true, anchor: "middle" },
    { kind: "text", x: 132, y: 98, size: 8, fill: "white", content: "5+", opacity: 0.8, anchor: "middle" },
  ],

  // "Я хочу..." — un cliente pidiendo algo en el restaurante.
  orderBubble: [
    { kind: "circle", cx: 40, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 30, cy: 50, r: 12, fill: "brand" },
    { kind: "rect", x: 18, y: 62, w: 24, h: 32, rx: 10, fill: "brand" },
    { kind: "rect", x: 54, y: 16, w: 96, h: 40, rx: 16, fill: "accentLight" },
    { kind: "path", d: "M74 56 L66 70 L88 56 Z", fill: "accentLight" },
    { kind: "text", x: 94, y: 32, size: 13, fill: "white", content: "Я хочу...", bold: true, anchor: "middle" },
    { kind: "circle", cx: 130, cy: 36, r: 10, fill: "white", opacity: 0.9 },
    { kind: "path", d: "M126 24 L126 18 M134 24 L134 18", stroke: "white", strokeWidth: 2, opacity: 0.7, round: true },
    { kind: "text", x: 100, y: 100, size: 9, fill: "inkSoft", content: "кофе · чай · суп", bold: true, anchor: "middle" },
  ],

  // Conjugación completa de "хотеть" (querer) en una rejilla de 6.
  verbConjugation: [
    { kind: "rect", x: 8, y: 6, w: 72, h: 32, rx: 8, fill: "brand" },
    { kind: "text", x: 44, y: 26, size: 9, fill: "white", content: "я — хочу", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 6, w: 64, h: 32, rx: 8, fill: "brandLight" },
    { kind: "text", x: 120, y: 26, size: 8.5, fill: "white", content: "ты — хочешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 44, w: 72, h: 32, rx: 8, fill: "accentLight" },
    { kind: "text", x: 44, y: 64, size: 7.5, fill: "white", content: "он/она — хочет", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 44, w: 64, h: 32, rx: 8, fill: "brand" },
    { kind: "text", x: 120, y: 64, size: 9, fill: "white", content: "мы — хотим", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 82, w: 72, h: 32, rx: 8, fill: "brandLight" },
    { kind: "text", x: 44, y: 102, size: 8.5, fill: "white", content: "вы — хотите", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 82, w: 64, h: 32, rx: 8, fill: "accentLight" },
    { kind: "text", x: 120, y: 102, size: 8.5, fill: "white", content: "они — хотят", bold: true, anchor: "middle" },
  ],

  // "Можно...?" — pedir permiso o pedir algo, con el menú de fondo.
  permissionAsk: [
    { kind: "circle", cx: 60, cy: 55, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "path", d: "M40 30 L40 20 M50 28 L50 16 M60 30 L60 20", stroke: "brand", strokeWidth: 5, round: true },
    { kind: "circle", cx: 50, cy: 45, r: 18, fill: "brand" },
    { kind: "rect", x: 42, y: 60, w: 16, h: 30, rx: 8, fill: "brand" },
    { kind: "circle", cx: 112, cy: 32, r: 20, fill: "accentLight" },
    { kind: "text", x: 112, y: 40, size: 22, fill: "white", content: "?", bold: true, anchor: "middle" },
    { kind: "rect", x: 90, y: 64, w: 56, h: 44, rx: 6, fill: "muted" },
    { kind: "rect", x: 98, y: 74, w: 40, h: 4, rx: 2, fill: "inkSoft", opacity: 0.5 },
    { kind: "rect", x: 98, y: 84, w: 40, h: 4, rx: 2, fill: "inkSoft", opacity: 0.4 },
    { kind: "rect", x: 98, y: 94, w: 32, h: 4, rx: 2, fill: "inkSoft", opacity: 0.3 },
    { kind: "text", x: 50, y: 106, size: 11, fill: "brand", content: "Можно?", bold: true, anchor: "middle" },
  ],

  // "Здесь есть...?" — un estante de tienda con productos.
  shopShelf: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "text", x: 55, y: 18, size: 10.5, fill: "brand", content: "Здесь есть...?", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 40, w: 24, h: 30, rx: 4, fill: "brand" },
    { kind: "rect", x: 54, y: 46, w: 24, h: 24, rx: 4, fill: "brandLight" },
    { kind: "rect", x: 88, y: 36, w: 24, h: 34, rx: 4, fill: "accentLight" },
    { kind: "rect", x: 10, y: 70, w: 140, h: 6, fill: "inkSoft" },
    { kind: "rect", x: 30, y: 80, w: 20, h: 20, rx: 4, fill: "accentLight", opacity: 0.8 },
    { kind: "rect", x: 70, y: 78, w: 20, h: 22, rx: 4, fill: "brand", opacity: 0.8 },
    { kind: "rect", x: 10, y: 106, w: 140, h: 6, fill: "inkSoft" },
    { kind: "circle", cx: 133, cy: 20, r: 15, fill: "accentLight" },
    { kind: "text", x: 133, y: 26, size: 15, fill: "white", content: "?", bold: true, anchor: "middle" },
  ],

  // "Счёт, пожалуйста" — la cuenta del restaurante.
  receipt: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 10, w: 68, h: 96, rx: 6, fill: "brand" },
    { kind: "rect", x: 20, y: 14, w: 60, h: 88, rx: 4, fill: "white" },
    { kind: "rect", x: 28, y: 26, w: 44, h: 4, rx: 2, fill: "inkSoft", opacity: 0.4 },
    { kind: "rect", x: 28, y: 36, w: 40, h: 4, rx: 2, fill: "inkSoft", opacity: 0.35 },
    { kind: "rect", x: 28, y: 46, w: 44, h: 4, rx: 2, fill: "inkSoft", opacity: 0.3 },
    { kind: "rect", x: 28, y: 56, w: 36, h: 4, rx: 2, fill: "inkSoft", opacity: 0.35 },
    { kind: "text", x: 50, y: 90, size: 13, fill: "brand", content: "450 ₽", bold: true, anchor: "middle" },
    { kind: "rect", x: 92, y: 18, w: 56, h: 44, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M108 62 L102 74 L120 62 Z", fill: "accentLight" },
    { kind: "text", x: 120, y: 36, size: 10, fill: "white", content: "Счёт,", bold: true, anchor: "middle" },
    { kind: "text", x: 120, y: 50, size: 8.5, fill: "white", content: "пожалуйста", bold: true, anchor: "middle" },
  ],

  // Un set de tarjetas de vocabulario de comida y bebida.
  foodCards: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 13, fill: "white", content: "чай", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "té", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 13, fill: "white", content: "кофе", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "café", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 13, fill: "white", content: "хлеб", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "pan", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 13, fill: "white", content: "суп", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "sopa", opacity: 0.85, anchor: "middle" },
  ],

  // мама / папа / сестра / брат — un pequeño árbol familiar de cuatro nodos.
  familyTree: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "path", d: "M46 30 L46 60 L114 60 L114 30", stroke: "inkSoft", strokeWidth: 3, opacity: 0.4, round: true },
    { kind: "path", d: "M80 60 L80 90", stroke: "inkSoft", strokeWidth: 3, opacity: 0.4, round: true },
    { kind: "circle", cx: 46, cy: 20, r: 16, fill: "brand" },
    { kind: "text", x: 46, y: 25, size: 9, fill: "white", content: "мама", bold: true, anchor: "middle" },
    { kind: "circle", cx: 114, cy: 20, r: 16, fill: "brandLight" },
    { kind: "text", x: 114, y: 25, size: 9, fill: "white", content: "папа", bold: true, anchor: "middle" },
    { kind: "circle", cx: 52, cy: 100, r: 16, fill: "accentLight" },
    { kind: "text", x: 52, y: 105, size: 8, fill: "white", content: "сестра", bold: true, anchor: "middle" },
    { kind: "circle", cx: 108, cy: 100, r: 16, fill: "accent" },
    { kind: "text", x: 108, y: 105, size: 9, fill: "white", content: "брат", bold: true, anchor: "middle" },
  ],

  // "У меня есть..." — una persona señalando hacia una familia pequeña.
  possessPhrase: [
    { kind: "circle", cx: 40, cy: 62, r: 46, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 32, cy: 46, r: 13, fill: "brand" },
    { kind: "rect", x: 19, y: 58, w: 26, h: 36, rx: 12, fill: "brand" },
    { kind: "rect", x: 60, y: 14, w: 90, h: 36, rx: 16, fill: "accentLight" },
    { kind: "path", d: "M80 50 L72 64 L94 50 Z", fill: "accentLight" },
    { kind: "text", x: 105, y: 36, size: 11.5, fill: "white", content: "У меня есть...", bold: true, anchor: "middle" },
    { kind: "circle", cx: 100, cy: 92, r: 14, fill: "brandLight" },
    { kind: "text", x: 100, y: 97, size: 8.5, fill: "white", content: "сестра", bold: true, anchor: "middle" },
    { kind: "circle", cx: 132, cy: 88, r: 12, fill: "brand", opacity: 0.85 },
    { kind: "text", x: 132, y: 92, size: 7.5, fill: "white", content: "брат", bold: true, anchor: "middle" },
  ],

  // Terminaciones -ый / -ая / -ое según el género del sustantivo.
  adjectiveGender: [
    { kind: "rect", x: 8, y: 20, w: 44, h: 80, rx: 10, fill: "brand" },
    { kind: "text", x: 30, y: 44, size: 10, fill: "white", content: "большой", bold: true, anchor: "middle" },
    { kind: "rect", x: 16, y: 52, w: 28, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 30, y: 62, size: 8, fill: "white", content: "-ый", bold: true, anchor: "middle" },
    { kind: "circle", cx: 30, cy: 88, r: 13, fill: "white", opacity: 0.9 },
    { kind: "text", x: 30, y: 93, size: 13, fill: "brand", content: "М", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 20, w: 44, h: 80, rx: 10, fill: "brandLight" },
    { kind: "text", x: 80, y: 44, size: 9, fill: "white", content: "большая", bold: true, anchor: "middle" },
    { kind: "rect", x: 66, y: 52, w: 28, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 80, y: 62, size: 8, fill: "white", content: "-ая", bold: true, anchor: "middle" },
    { kind: "circle", cx: 80, cy: 88, r: 13, fill: "white", opacity: 0.9 },
    { kind: "text", x: 80, y: 93, size: 13, fill: "brandLight", content: "Ж", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 20, w: 44, h: 80, rx: 10, fill: "accentLight" },
    { kind: "text", x: 130, y: 44, size: 9, fill: "white", content: "большое", bold: true, anchor: "middle" },
    { kind: "rect", x: 116, y: 52, w: 28, h: 14, rx: 5, fill: "brand" },
    { kind: "text", x: 130, y: 62, size: 8, fill: "white", content: "-ое", bold: true, anchor: "middle" },
    { kind: "circle", cx: 130, cy: 88, r: 13, fill: "white", opacity: 0.9 },
    { kind: "text", x: 130, y: 93, size: 13, fill: "accent", content: "С", bold: true, anchor: "middle" },
  ],

  // большой vs. маленький — dos cajas de tamaño contrastante.
  adjectivePair: [
    { kind: "circle", cx: 80, cy: 62, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 12, y: 18, w: 66, h: 66, rx: 12, fill: "brand" },
    { kind: "text", x: 45, y: 56, size: 12, fill: "white", content: "большой", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 70, size: 8, fill: "white", content: "grande", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 96, y: 60, w: 30, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 111, y: 78, size: 8, fill: "white", content: "малень-", bold: true, anchor: "middle" },
    { kind: "text", x: 111, y: 100, size: 7, fill: "inkSoft", content: "кий (pequeño)", anchor: "middle" },
    { kind: "path", d: "M82 50 L92 50 M87 45 L92 50 L87 55", stroke: "inkSoft", strokeWidth: 3, round: true, opacity: 0.5 },
  ],

  // El adjetivo va ANTES del sustantivo — orden con una flecha guía.
  wordOrderFamily: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 44, w: 62, h: 32, rx: 8, fill: "accentLight" },
    { kind: "text", x: 45, y: 64, size: 11, fill: "white", content: "большая", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 60 L96 60", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "path", d: "M90 54 L96 60 L90 66", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 44, w: 46, h: 32, rx: 8, fill: "brand" },
    { kind: "text", x: 123, y: 64, size: 12, fill: "white", content: "семья", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 9.5, fill: "inkSoft", content: "adjetivo + sustantivo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 102, size: 9, fill: "brandLight", content: "\"Семья большая\" también existe", bold: true, anchor: "middle" },
  ],

  // дедушка / бабушка / сын / дочь — la familia extendida.
  extendedFamily: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "circle", cx: 30, cy: 26, r: 16, fill: "brandLight" },
    { kind: "text", x: 30, y: 31, size: 8, fill: "white", content: "дедушка", bold: true, anchor: "middle" },
    { kind: "circle", cx: 90, cy: 20, r: 16, fill: "brand" },
    { kind: "text", x: 90, y: 25, size: 7.5, fill: "white", content: "бабушка", bold: true, anchor: "middle" },
    { kind: "circle", cx: 40, cy: 92, r: 15, fill: "accentLight" },
    { kind: "text", x: 40, y: 97, size: 9.5, fill: "white", content: "сын", bold: true, anchor: "middle" },
    { kind: "circle", cx: 122, cy: 88, r: 15, fill: "accent" },
    { kind: "text", x: 122, y: 93, size: 9, fill: "white", content: "дочь", bold: true, anchor: "middle" },
    { kind: "path", d: "M30 42 L38 78", stroke: "inkSoft", strokeWidth: 2, opacity: 0.35, round: true },
    { kind: "path", d: "M90 36 L118 74", stroke: "inkSoft", strokeWidth: 2, opacity: 0.35, round: true },
  ],

  // читать → чита- + terminación: el infinitivo se parte en raíz + sufijo.
  verbEndings: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 66, h: 36, rx: 10, fill: "brand" },
    { kind: "text", x: 47, y: 65, size: 15, fill: "white", content: "чита-", bold: true, anchor: "middle" },
    { kind: "text", x: 90, y: 65, size: 16, fill: "inkSoft", content: "+", bold: true, anchor: "middle" },
    { kind: "rect", x: 100, y: 42, w: 46, h: 36, rx: 10, fill: "accentLight" },
    { kind: "text", x: 123, y: 65, size: 13, fill: "white", content: "-ю", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 10.5, fill: "brandLight", content: "я читаю", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 10, fill: "inkSoft", content: "raíz + terminación", bold: true, anchor: "middle" },
  ],

  // работать / делать / знать — la misma terminación, distintas raíces.
  rootSwap: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 8, y: 14, w: 68, h: 26, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 32, size: 10, fill: "white", content: "работа-ешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 14, w: 64, h: 26, rx: 8, fill: "brandLight" },
    { kind: "text", x: 116, y: 32, size: 11, fill: "white", content: "дела-ешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 48, w: 68, h: 26, rx: 8, fill: "accentLight" },
    { kind: "text", x: 42, y: 66, size: 11, fill: "white", content: "зна-ешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 48, w: 64, h: 26, rx: 8, fill: "accent" },
    { kind: "text", x: 116, y: 66, size: 11, fill: "white", content: "чита-ешь", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 11, fill: "brand", content: "misma terminación: -ешь", bold: true, anchor: "middle" },
  ],

  // ты (informal, singular) vs. вы (formal / plural) — como usted/ustedes en México.
  formalityMap: [
    { kind: "circle", cx: 45, cy: 55, r: 15, fill: "brandLight" },
    { kind: "text", x: 45, y: 60, size: 12, fill: "white", content: "ТЫ", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 88, size: 8, fill: "inkSoft", content: "informal · 1 persona", anchor: "middle" },
    { kind: "circle", cx: 110, cy: 40, r: 14, fill: "accentLight", opacity: 0.9 },
    { kind: "circle", cx: 128, cy: 44, r: 14, fill: "accentLight" },
    { kind: "circle", cx: 119, cy: 62, r: 14, fill: "accent" },
    { kind: "text", x: 119, y: 67, size: 11, fill: "white", content: "ВЫ", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 96, size: 8, fill: "inkSoft", content: "formal · o varias personas", anchor: "middle" },
    { kind: "text", x: 80, y: 16, size: 9, fill: "brand", content: "= usted / ustedes (México)", bold: true, anchor: "middle" },
  ],

  // "я читаю" = leo / estoy leyendo — dos traducciones válidas del mismo verbo.
  dualMeaning: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 48, y: 46, w: 64, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 66, size: 13, fill: "white", content: "я читаю", bold: true, anchor: "middle" },
    { kind: "path", d: "M62 82 L40 100", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "path", d: "M98 82 L120 100", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 10, y: 96, w: 56, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 38, y: 111, size: 9.5, fill: "white", content: "leo", bold: true, anchor: "middle" },
    { kind: "rect", x: 96, y: 96, w: 56, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 124, y: 111, size: 8, fill: "white", content: "estoy leyendo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 24, size: 9, fill: "inkSoft", content: "sin verbo auxiliar", bold: true, anchor: "middle" },
  ],

  // "не" delante del verbo niega — más simple que en español.
  negationMark: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 44, cy: 58, r: 26, fill: "danger" },
    { kind: "text", x: 44, y: 66, size: 20, fill: "white", content: "не", bold: true, anchor: "middle" },
    { kind: "path", d: "M74 58 L90 58 M84 52 L90 58 L84 64", stroke: "inkSoft", strokeWidth: 3, round: true, opacity: 0.6 },
    { kind: "rect", x: 96, y: 40, w: 54, h: 36, rx: 10, fill: "brand" },
    { kind: "text", x: 123, y: 63, size: 11.5, fill: "white", content: "знаю", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 10.5, fill: "brandLight", content: "я не знаю = yo no sé", bold: true, anchor: "middle" },
  ],

  // Conjugación completa de "работать" (trabajar) en una rejilla de 6.
  workConjugation: [
    { kind: "rect", x: 8, y: 6, w: 72, h: 32, rx: 8, fill: "brand" },
    { kind: "text", x: 44, y: 26, size: 9, fill: "white", content: "я — работаю", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 6, w: 64, h: 32, rx: 8, fill: "brandLight" },
    { kind: "text", x: 120, y: 26, size: 8, fill: "white", content: "ты — работаешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 44, w: 72, h: 32, rx: 8, fill: "accentLight" },
    { kind: "text", x: 44, y: 64, size: 7.5, fill: "white", content: "он/она — работает", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 44, w: 64, h: 32, rx: 8, fill: "brand" },
    { kind: "text", x: 120, y: 64, size: 9, fill: "white", content: "мы — работаем", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 82, w: 72, h: 32, rx: 8, fill: "brandLight" },
    { kind: "text", x: 44, y: 102, size: 8, fill: "white", content: "вы — работаете", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 82, w: 64, h: 32, rx: 8, fill: "accentLight" },
    { kind: "text", x: 120, y: 102, size: 8, fill: "white", content: "они — работают", bold: true, anchor: "middle" },
  ],

  // улица / площадь / метро / автобус — cuatro tarjetas de vocabulario urbano.
  cityWords: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 12, fill: "white", content: "улица", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "calle", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 11, fill: "white", content: "площадь", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "plaza", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 12, fill: "white", content: "метро", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "metro", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 11, fill: "white", content: "автобус", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "autobús", opacity: 0.85, anchor: "middle" },
  ],

  // "Где...?" — una persona preguntando, con un signo de interrogación grande.
  whereQuestion: [
    { kind: "circle", cx: 55, cy: 62, r: 46, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 40, cy: 44, r: 13, fill: "brand" },
    { kind: "rect", x: 27, y: 56, w: 26, h: 36, rx: 12, fill: "brand" },
    { kind: "circle", cx: 118, cy: 34, r: 22, fill: "accentLight" },
    { kind: "text", x: 118, y: 43, size: 24, fill: "white", content: "?", bold: true, anchor: "middle" },
    { kind: "rect", x: 62, y: 70, w: 88, h: 34, rx: 14, fill: "brand" },
    { kind: "path", d: "M82 100 L74 112 L94 100 Z", fill: "brand" },
    { kind: "text", x: 106, y: 91, size: 12.5, fill: "white", content: "Где метро?", bold: true, anchor: "middle" },
  ],

  // налево / направо / прямо — tres flechas de dirección.
  directionArrows: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "path", d: "M50 30 L26 30 M32 22 L26 30 L32 38", stroke: "brand", strokeWidth: 6, round: true },
    { kind: "text", x: 38, y: 50, size: 9, fill: "brand", content: "налево", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 26 L80 94", stroke: "accent", strokeWidth: 6, round: true },
    { kind: "path", d: "M72 86 L80 94 L88 86", stroke: "accent", strokeWidth: 6, round: true },
    { kind: "text", x: 80, y: 110, size: 9, fill: "accent", content: "прямо", bold: true, anchor: "middle" },
    { kind: "path", d: "M110 30 L134 30 M128 22 L134 30 L128 38", stroke: "brandLight", strokeWidth: 6, round: true },
    { kind: "text", x: 122, y: 50, size: 9, fill: "brandLight", content: "направо", bold: true, anchor: "middle" },
  ],

  // "Извините, где...?" cortés + "Это далеко? / близко" — burbujas de cortesía.
  politeAsk: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 140, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M30 46 L24 58 L44 46 Z", fill: "brand" },
    { kind: "text", x: 80, y: 35, size: 11.5, fill: "white", content: "Извините, где метро?", bold: true, anchor: "middle" },
    { kind: "rect", x: 18, y: 68, w: 56, h: 30, rx: 12, fill: "accentLight" },
    { kind: "text", x: 46, y: 87, size: 10, fill: "white", content: "далеко?", bold: true, anchor: "middle" },
    { kind: "rect", x: 86, y: 68, w: 56, h: 30, rx: 12, fill: "accent" },
    { kind: "text", x: 114, y: 87, size: 10, fill: "white", content: "близко", bold: true, anchor: "middle" },
  ],

  // "Идите прямо" — el imperativo formal, con una persona caminando.
  imperativeWalk: [
    { kind: "circle", cx: 60, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 46, cy: 34, r: 12, fill: "brand" },
    { kind: "path", d: "M46 46 L46 76 M46 60 L28 72 M46 60 L64 68 M46 76 L34 100 M46 76 L60 98", stroke: "brand", strokeWidth: 6, round: true },
    { kind: "path", d: "M78 70 L120 70", stroke: "accentLight", strokeWidth: 3, opacity: 0.6, round: true },
    { kind: "path", d: "M112 62 L120 70 L112 78", stroke: "accentLight", strokeWidth: 3, opacity: 0.6, round: true },
    { kind: "rect", x: 76, y: 14, w: 68, h: 34, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M96 44 L90 56 L108 44 Z", fill: "accentLight" },
    { kind: "text", x: 110, y: 27, size: 10.5, fill: "white", content: "Идите прямо", bold: true, anchor: "middle" },
    { kind: "text", x: 60, y: 112, size: 8, fill: "inkSoft", content: "imperativo formal de идти", anchor: "middle" },
  ],

  // "рядом с" (al lado de) y "между" (entre) — tres edificios con relaciones espaciales.
  nearBetween: [
    { kind: "circle", cx: 80, cy: 62, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 14, y: 50, w: 30, h: 46, rx: 4, fill: "brand" },
    { kind: "rect", x: 54, y: 40, w: 30, h: 56, rx: 4, fill: "accentLight" },
    { kind: "rect", x: 94, y: 50, w: 30, h: 46, rx: 4, fill: "brandLight" },
    { kind: "path", d: "M44 74 L54 74", stroke: "inkSoft", strokeWidth: 3, round: true, opacity: 0.6 },
    { kind: "text", x: 49, y: 20, size: 8.5, fill: "brand", content: "рядом с", bold: true, anchor: "middle" },
    { kind: "text", x: 69, y: 108, size: 8, fill: "accent", content: "между", bold: true, anchor: "middle" },
    { kind: "path", d: "M44 96 L94 96", stroke: "accent", strokeWidth: 2, opacity: 0.5, round: true },
  ],

  // слушать → слушай — el imperativo informal (tú), formado del tema de presente.
  imperativeTyForm: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 12, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 42, y: 64, size: 11, fill: "inkSoft", content: "слушать", bold: true, anchor: "middle" },
    { kind: "path", d: "M76 58 L94 58 M88 52 L94 58 L88 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 98, y: 34, w: 50, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 123, y: 60, size: 13, fill: "white", content: "слушай!", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9, fill: "brandLight", content: "-й / -и / -ь + tema", bold: true, anchor: "middle" },
  ],

  // слушай → слушайте — el imperativo formal/plural con -те.
  imperativeVyForm: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 12, y: 42, w: 56, h: 34, rx: 10, fill: "brand" },
    { kind: "text", x: 40, y: 64, size: 11, fill: "white", content: "слушай", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 64, size: 15, fill: "inkSoft", content: "+", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 42, w: 30, h: 34, rx: 10, fill: "accentLight" },
    { kind: "text", x: 103, y: 64, size: 12, fill: "white", content: "-те", bold: true, anchor: "middle" },
    { kind: "circle", cx: 118, cy: 24, r: 12, fill: "accentLight", opacity: 0.9 },
    { kind: "circle", cx: 132, cy: 28, r: 12, fill: "accent" },
    { kind: "text", x: 80, y: 100, size: 10, fill: "brand", content: "слушайте! (usted / ustedes)", bold: true, anchor: "middle" },
  ],

  // Tres tipos de terminación imperativa: -й / -и / -ь.
  suffixTrio: [
    { kind: "rect", x: 8, y: 20, w: 44, h: 80, rx: 10, fill: "brand" },
    { kind: "text", x: 30, y: 44, size: 11, fill: "white", content: "слушай", bold: true, anchor: "middle" },
    { kind: "circle", cx: 30, cy: 86, r: 13, fill: "white", opacity: 0.9 },
    { kind: "text", x: 30, y: 91, size: 14, fill: "brand", content: "й", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 20, w: 44, h: 80, rx: 10, fill: "brandLight" },
    { kind: "text", x: 80, y: 44, size: 10, fill: "white", content: "говори", bold: true, anchor: "middle" },
    { kind: "circle", cx: 80, cy: 86, r: 13, fill: "white", opacity: 0.9 },
    { kind: "text", x: 80, y: 91, size: 14, fill: "brandLight", content: "и", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 20, w: 44, h: 80, rx: 10, fill: "accentLight" },
    { kind: "text", x: 130, y: 44, size: 10, fill: "white", content: "смотри", bold: true, anchor: "middle" },
    { kind: "circle", cx: 130, cy: 86, r: 13, fill: "white", opacity: 0.9 },
    { kind: "text", x: 130, y: 91, size: 14, fill: "accent", content: "и", bold: true, anchor: "middle" },
  ],

  // "Не" + imperativo = prohibición.
  negativeImperative: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 44, cy: 58, r: 26, fill: "danger" },
    { kind: "text", x: 44, y: 66, size: 20, fill: "white", content: "не", bold: true, anchor: "middle" },
    { kind: "path", d: "M74 58 L90 58 M84 52 L90 58 L84 64", stroke: "inkSoft", strokeWidth: 3, round: true, opacity: 0.6 },
    { kind: "rect", x: 96, y: 40, w: 54, h: 36, rx: 10, fill: "brand" },
    { kind: "text", x: 123, y: 63, size: 10.5, fill: "white", content: "говори!", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 10, fill: "brandLight", content: "Не говори! = ¡No hables!", bold: true, anchor: "middle" },
  ],

  // "Извините" + imperativo — órdenes y peticiones corteses.
  politeCommand: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 132, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M34 48 L28 60 L48 48 Z", fill: "accentLight" },
    { kind: "text", x: 80, y: 37, size: 12, fill: "white", content: "Извините...", bold: true, anchor: "middle" },
    { kind: "rect", x: 30, y: 70, w: 46, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 53, y: 89, size: 9.5, fill: "white", content: "помогите", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 70, w: 50, h: 30, rx: 10, fill: "brandLight" },
    { kind: "text", x: 109, y: 89, size: 9.5, fill: "white", content: "не волнуйтесь", bold: true, anchor: "middle" },
  ],

  // Un set de tarjetas de verbos de imperativo comunes.
  commandCards: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 12, fill: "white", content: "пиши!", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "escribe", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 12, fill: "white", content: "читай!", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "lee", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10.5, fill: "white", content: "отдыхай!", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "descansa", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 10, fill: "white", content: "помогай!", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "ayuda", opacity: 0.85, anchor: "middle" },
  ],

  // хотеть completo — una figura alcanzando lo que quiere.
  modalWant: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 36, cy: 42, r: 12, fill: "brand" },
    { kind: "rect", x: 24, y: 54, w: 24, h: 34, rx: 11, fill: "brand" },
    { kind: "path", d: "M46 60 L70 44", stroke: "brand", strokeWidth: 8, round: true },
    { kind: "circle", cx: 96, cy: 30, r: 18, fill: "accentLight" },
    { kind: "text", x: 96, y: 36, size: 15, fill: "white", content: "?", bold: true, anchor: "middle" },
    { kind: "rect", x: 62, y: 66, w: 84, h: 40, rx: 10, fill: "brandLight" },
    { kind: "text", x: 104, y: 82, size: 9, fill: "white", content: "хочу · хочешь", bold: true, anchor: "middle" },
    { kind: "text", x: 104, y: 96, size: 9, fill: "white", content: "хочет · хотим", bold: true, anchor: "middle" },
    { kind: "text", x: 104, y: 110, size: 8.5, fill: "white", content: "хотите · хотят", bold: true, anchor: "middle" },
  ],

  // мочь completo — un puño mostrando fuerza/capacidad, con las 6 formas.
  modalCan: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 40, cy: 44, r: 22, fill: "accent" },
    { kind: "path", d: "M28 40 L36 32 L44 40 L52 30", stroke: "white", strokeWidth: 4, round: true },
    { kind: "rect", x: 66, y: 20, w: 80, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 106, y: 38, size: 9, fill: "white", content: "могу · можешь", bold: true, anchor: "middle" },
    { kind: "text", x: 106, y: 52, size: 9, fill: "white", content: "может · можем", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 82, w: 120, h: 26, rx: 10, fill: "brandLight" },
    { kind: "text", x: 80, y: 99, size: 9, fill: "white", content: "можете · могут", bold: true, anchor: "middle" },
  ],

  // хочу / могу + infinitivo — dos verbos modales encadenados con un tercero.
  modalInfinitive: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 8, y: 22, w: 62, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 39, y: 42, size: 11.5, fill: "white", content: "я хочу", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 68, w: 62, h: 30, rx: 8, fill: "accent" },
    { kind: "text", x: 39, y: 88, size: 11, fill: "white", content: "я могу", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 16, fill: "inkSoft", content: "+", bold: true, anchor: "middle" },
    { kind: "rect", x: 92, y: 45, w: 58, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 121, y: 65, size: 12, fill: "white", content: "есть", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 105, size: 9, fill: "brand", content: "modal + infinitivo, siempre", bold: true, anchor: "middle" },
  ],

  // "Ты можешь мне помочь?" — pregunta de capacidad, con signo de interrogación.
  canQuestion: [
    { kind: "circle", cx: 55, cy: 62, r: 46, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 40, cy: 44, r: 13, fill: "brand" },
    { kind: "rect", x: 27, y: 56, w: 26, h: 36, rx: 12, fill: "brand" },
    { kind: "circle", cx: 118, cy: 34, r: 22, fill: "accentLight" },
    { kind: "text", x: 118, y: 43, size: 24, fill: "white", content: "?", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 70, w: 90, h: 40, rx: 14, fill: "brand" },
    { kind: "path", d: "M80 100 L72 112 L92 100 Z", fill: "brand" },
    { kind: "text", x: 105, y: 88, size: 9.5, fill: "white", content: "Ты можешь мне", bold: true, anchor: "middle" },
    { kind: "text", x: 105, y: 100, size: 9.5, fill: "white", content: "помочь?", bold: true, anchor: "middle" },
  ],

  // "не могу" / "не хочет" — capacidad y deseo negados, lado a lado.
  modalNegation: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 40, cy: 50, r: 22, fill: "danger" },
    { kind: "text", x: 40, y: 56, size: 12, fill: "white", content: "не могу", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 84, size: 8, fill: "inkSoft", content: "no puedo", anchor: "middle" },
    { kind: "circle", cx: 118, cy: 50, r: 22, fill: "danger", opacity: 0.75 },
    { kind: "text", x: 118, y: 56, size: 11, fill: "white", content: "не хочет", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 84, size: 8, fill: "inkSoft", content: "no quiere", anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 9, fill: "brand", content: "не + verbo modal", bold: true, anchor: "middle" },
  ],

  // есть / пить / помочь / прийти / работать / спать — set de verbos de acción.
  actionVerbCards: [
    { kind: "rect", x: 6, y: 8, w: 46, h: 32, rx: 7, fill: "brand" },
    { kind: "text", x: 29, y: 28, size: 10, fill: "white", content: "есть", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 8, w: 46, h: 32, rx: 7, fill: "brandLight" },
    { kind: "text", x: 80, y: 28, size: 10, fill: "white", content: "пить", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 46, h: 32, rx: 7, fill: "accentLight" },
    { kind: "text", x: 131, y: 28, size: 9, fill: "white", content: "спать", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 45, w: 70, h: 32, rx: 7, fill: "accent" },
    { kind: "text", x: 41, y: 65, size: 9, fill: "white", content: "помочь", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 45, w: 74, h: 32, rx: 7, fill: "brand" },
    { kind: "text", x: 117, y: 65, size: 9, fill: "white", content: "прийти", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 82, w: 148, h: 32, rx: 7, fill: "brandLight" },
    { kind: "text", x: 80, y: 102, size: 10, fill: "white", content: "работать", bold: true, anchor: "middle" },
  ],

  // хотеть (deseo) vs. мочь (capacidad) — dos escalas de significado distinto.
  wantVsCan: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 12, y: 18, w: 62, h: 84, rx: 12, fill: "brand" },
    { kind: "text", x: 43, y: 42, size: 12, fill: "white", content: "хотеть", bold: true, anchor: "middle" },
    { kind: "text", x: 43, y: 60, size: 8, fill: "white", content: "quiero", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 43, y: 90, size: 7.5, fill: "white", content: "(deseo)", opacity: 0.7, anchor: "middle" },
    { kind: "rect", x: 86, y: 18, w: 62, h: 84, rx: 12, fill: "accent" },
    { kind: "text", x: 117, y: 42, size: 12, fill: "white", content: "мочь", bold: true, anchor: "middle" },
    { kind: "text", x: 117, y: 60, size: 8, fill: "white", content: "puedo", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 117, y: 90, size: 7.5, fill: "white", content: "(capacidad)", opacity: 0.7, anchor: "middle" },
  ],

  // школа → школе / дом → доме — masculino y neutro añaden -е.
  prepositionalMasc: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 12, fill: "inkSoft", content: "школа", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 12, fill: "white", content: "школе", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-е", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9.5, fill: "brandLight", content: "дом → доме", bold: true, anchor: "middle" },
  ],

  // Россия → России / дверь → двери — femenino en -я o -ь también cambia.
  prepositionalFem: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 11, fill: "inkSoft", content: "Россия", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brandLight" },
    { kind: "text", x: 124, y: 60, size: 11, fill: "white", content: "России", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-и", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9.5, fill: "brandLight", content: "дверь → двери", bold: true, anchor: "middle" },
  ],

  // "в" (dentro) vs. "на" (sobre/en superficie) — dos preposiciones, dos escenas.
  vNaCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 12, y: 20, w: 58, h: 50, rx: 8, fill: "brand" },
    { kind: "rect", x: 22, y: 34, w: 38, h: 26, rx: 4, fill: "white", opacity: 0.9 },
    { kind: "text", x: 41, y: 51, size: 11, fill: "brand", content: "в", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 82, size: 9, fill: "brand", content: "школе", bold: true, anchor: "middle" },
    { kind: "rect", x: 90, y: 50, w: 58, h: 8, rx: 3, fill: "accentLight" },
    { kind: "rect", x: 108, y: 30, w: 22, h: 20, rx: 3, fill: "accent" },
    { kind: "text", x: 119, y: 44, size: 10, fill: "white", content: "на", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 82, size: 9, fill: "accent", content: "столе", bold: true, anchor: "middle" },
  ],

  // Tabla de terminaciones: школа/дом/окно → -е en el caso preposicional.
  endingGrid: [
    { kind: "rect", x: 8, y: 14, w: 44, h: 92, rx: 8, fill: "brand" },
    { kind: "text", x: 30, y: 40, size: 10, fill: "white", content: "школа", bold: true, anchor: "middle" },
    { kind: "circle", cx: 30, cy: 66, r: 12, fill: "white", opacity: 0.9 },
    { kind: "text", x: 30, y: 71, size: 12, fill: "brand", content: "Ж", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 96, size: 9, fill: "white", content: "школе", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 14, w: 44, h: 92, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 40, size: 11, fill: "white", content: "дом", bold: true, anchor: "middle" },
    { kind: "circle", cx: 80, cy: 66, r: 12, fill: "white", opacity: 0.9 },
    { kind: "text", x: 80, y: 71, size: 12, fill: "brandLight", content: "М", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 9, fill: "white", content: "доме", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 14, w: 44, h: 92, rx: 8, fill: "accentLight" },
    { kind: "text", x: 130, y: 40, size: 10, fill: "white", content: "окно", bold: true, anchor: "middle" },
    { kind: "circle", cx: 130, cy: 66, r: 12, fill: "white", opacity: 0.9 },
    { kind: "text", x: 130, y: 71, size: 12, fill: "accent", content: "С", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 96, size: 9, fill: "white", content: "окне", bold: true, anchor: "middle" },
  ],

  // "Где ты?" — "Я в школе." — un mini diálogo de ubicación.
  whereDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 90, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M34 48 L28 60 L48 48 Z", fill: "brand" },
    { kind: "text", x: 59, y: 37, size: 13, fill: "white", content: "Где ты?", bold: true, anchor: "middle" },
    { kind: "rect", x: 54, y: 66, w: 92, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M130 66 L136 54 L116 66 Z", fill: "accentLight" },
    { kind: "text", x: 100, y: 87, size: 12, fill: "white", content: "Я в школе.", bold: true, anchor: "middle" },
  ],

  // парк / магазин / работа / улица — tarjetas de lugares de la ciudad.
  placeCards: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 11, fill: "white", content: "парк", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "parque", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "магазин", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "tienda", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "работа", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "trabajo", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 10, fill: "white", content: "улица", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "calle", opacity: 0.85, anchor: "middle" },
  ],

  // автобус / поезд / машина / метро — tarjetas de vocabulario de transporte.
  transportGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "автобус", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "autobús", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 11, fill: "white", content: "поезд", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "tren", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "машина", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "coche", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 11, fill: "white", content: "метро", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "metro", opacity: 0.85, anchor: "middle" },
  ],

  // Conjugación de "ехать" (ir en vehículo): еду, едешь, едет, едем, едете, едут.
  edatConjugation: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 20, y: 16, w: 56, h: 24, rx: 8, fill: "brand" },
    { kind: "text", x: 48, y: 32, size: 10, fill: "white", content: "я еду", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 16, w: 56, h: 24, rx: 8, fill: "brandLight" },
    { kind: "text", x: 112, y: 32, size: 9, fill: "white", content: "ты едешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 48, w: 56, h: 24, rx: 8, fill: "accent" },
    { kind: "text", x: 48, y: 64, size: 9, fill: "white", content: "он едет", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 48, w: 56, h: 24, rx: 8, fill: "accentLight" },
    { kind: "text", x: 112, y: 64, size: 9, fill: "white", content: "мы едем", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 80, w: 56, h: 24, rx: 8, fill: "ink", opacity: 0.85 },
    { kind: "text", x: 48, y: 96, size: 8.5, fill: "white", content: "вы едете", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 80, w: 56, h: 24, rx: 8, fill: "ink" },
    { kind: "text", x: 112, y: 96, size: 9, fill: "white", content: "они едут", bold: true, anchor: "middle" },
  ],

  // автобус → на автобусе / поезд → на поезде — terminación -е en transporte.
  transportEndings: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 10, fill: "inkSoft", content: "автобус", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 10, fill: "white", content: "автобусе", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-е", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9.5, fill: "brandLight", content: "поезд → поезде", bold: true, anchor: "middle" },
  ],

  // метро / такси — no cambian de forma (indeclinables).
  indeclinableWords: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 24, y: 32, w: 52, h: 56, rx: 10, fill: "accent" },
    { kind: "text", x: 50, y: 63, size: 12, fill: "white", content: "метро", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 32, w: 52, h: 56, rx: 10, fill: "accent" },
    { kind: "text", x: 110, y: 63, size: 11, fill: "white", content: "такси", bold: true, anchor: "middle" },
    { kind: "circle", cx: 80, cy: 22, r: 14, fill: "brandLight" },
    { kind: "path", d: "M74 22 L79 27 L87 17", stroke: "white", strokeWidth: 3, round: true },
    { kind: "text", x: 80, y: 108, size: 8.5, fill: "inkSoft", content: "no cambian nunca", bold: true, anchor: "middle" },
  ],

  // "На чём ты едешь?" — "Я еду на автобусе." — mini diálogo de transporte.
  naChemDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 16, w: 104, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M30 48 L24 60 L44 48 Z", fill: "brand" },
    { kind: "text", x: 62, y: 37, size: 11.5, fill: "white", content: "На чём ты едешь?", bold: true, anchor: "middle" },
    { kind: "rect", x: 48, y: 66, w: 98, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M126 66 L132 54 L112 66 Z", fill: "accentLight" },
    { kind: "text", x: 97, y: 87, size: 11, fill: "white", content: "Я еду на автобусе.", bold: true, anchor: "middle" },
  ],

  // самолёт (лететь) / пешком (идти) — transportes adicionales y a pie.
  transportCards: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "самолёт", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "avión (лететь)", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "такси", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "taxi", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 9, fill: "white", content: "велосипед", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "bicicleta", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 10, fill: "white", content: "пешком", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "a pie (идти)", opacity: 0.85, anchor: "middle" },
  ],

  // книга / фильм / музыка / письмо — tarjetas de vocabulario del caso acusativo.
  accusativeGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "книга", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "libro", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "фильм", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "película", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "музыка", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "música", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 10, fill: "white", content: "письмо", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "carta", opacity: 0.85, anchor: "middle" },
  ],

  // книга → книгу / машина → машину — femenino en -а cambia a -у en acusativo.
  accusativeFemEnding: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 10, fill: "inkSoft", content: "книга", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 10, fill: "white", content: "книгу", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-у", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9.5, fill: "brandLight", content: "машина → машину", bold: true, anchor: "middle" },
  ],

  // дом / окно — masculino y neutro inanimados no cambian en acusativo.
  accusativeUnchanged: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 30, y: 34, w: 100, h: 52, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 56, size: 12, fill: "white", content: "дом = дом", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 12, fill: "white", content: "окно = окно", bold: true, anchor: "middle" },
    { kind: "circle", cx: 80, cy: 22, r: 14, fill: "brandLight" },
    { kind: "path", d: "M74 22 L79 27 L87 17", stroke: "white", strokeWidth: 3, round: true },
    { kind: "text", x: 80, y: 108, size: 8.5, fill: "inkSoft", content: "sin cambios (inanimados)", bold: true, anchor: "middle" },
  ],

  // друг → друга — masculino animado toma la forma del genitivo.
  accusativeAnimate: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 44, cy: 54, r: 22, fill: "accent" },
    { kind: "text", x: 44, y: 59, size: 11, fill: "white", content: "друг", bold: true, anchor: "middle" },
    { kind: "path", d: "M70 54 L88 54 M82 48 L88 54 L82 60", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "circle", cx: 118, cy: 54, r: 24, fill: "brand" },
    { kind: "text", x: 118, y: 59, size: 10, fill: "white", content: "друга", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9, fill: "brandLight", content: "Я вижу друга.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 112, size: 7.5, fill: "inkSoft", content: "(igual que el genitivo)", anchor: "middle" },
  ],

  // меня, тебя, его, её, нас, вас, их — pronombres personales en acusativo.
  accusativePronouns: [
    { kind: "rect", x: 8, y: 10, w: 46, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 31, y: 29, size: 10.5, fill: "white", content: "меня", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 10, w: 46, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 29, size: 10.5, fill: "white", content: "тебя", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 10, w: 46, h: 30, rx: 8, fill: "accent" },
    { kind: "text", x: 129, y: 29, size: 10.5, fill: "white", content: "его", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 45, w: 46, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 31, y: 64, size: 10.5, fill: "white", content: "её", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 45, w: 46, h: 30, rx: 8, fill: "ink", opacity: 0.85 },
    { kind: "text", x: 80, y: 64, size: 10.5, fill: "white", content: "нас", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 45, w: 46, h: 30, rx: 8, fill: "ink" },
    { kind: "text", x: 129, y: 64, size: 10.5, fill: "white", content: "вас", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 80, w: 46, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 80, y: 99, size: 10.5, fill: "white", content: "их", bold: true, anchor: "middle" },
  ],

  // "Что ты читаешь?" — "Я читаю книгу." — mini diálogo del caso acusativo.
  accusativeDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 16, w: 104, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M30 48 L24 60 L44 48 Z", fill: "brand" },
    { kind: "text", x: 62, y: 37, size: 12, fill: "white", content: "Что ты читаешь?", bold: true, anchor: "middle" },
    { kind: "rect", x: 48, y: 66, w: 98, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M126 66 L132 54 L112 66 Z", fill: "accentLight" },
    { kind: "text", x: 97, y: 87, size: 12, fill: "white", content: "Я читаю книгу.", bold: true, anchor: "middle" },
  ],

  // школа / работа / магазин / город — tarjetas de destinos (куда?).
  directionGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "школа", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "escuela", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "работа", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "trabajo", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 9, fill: "white", content: "магазин", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "tienda", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 10, fill: "white", content: "город", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "ciudad", opacity: 0.85, anchor: "middle" },
  ],

  // Conjugación de "идти" (ir a pie): иду, идёшь, идёт, идём, идёте, идут.
  idtiConjugation: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 20, y: 16, w: 56, h: 24, rx: 8, fill: "brand" },
    { kind: "text", x: 48, y: 32, size: 10, fill: "white", content: "я иду", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 16, w: 56, h: 24, rx: 8, fill: "brandLight" },
    { kind: "text", x: 112, y: 32, size: 8.5, fill: "white", content: "ты идёшь", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 48, w: 56, h: 24, rx: 8, fill: "accent" },
    { kind: "text", x: 48, y: 64, size: 9, fill: "white", content: "он идёт", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 48, w: 56, h: 24, rx: 8, fill: "accentLight" },
    { kind: "text", x: 112, y: 64, size: 9, fill: "white", content: "мы идём", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 80, w: 56, h: 24, rx: 8, fill: "ink", opacity: 0.85 },
    { kind: "text", x: 48, y: 96, size: 8.5, fill: "white", content: "вы идёте", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 80, w: 56, h: 24, rx: 8, fill: "ink" },
    { kind: "text", x: 112, y: 96, size: 8.5, fill: "white", content: "они идут", bold: true, anchor: "middle" },
  ],

  // Где ты? (estático, preposicional) vs Куда ты идёшь? (dirección, acusativo).
  staticVsDirection: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 18, w: 66, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 43, y: 34, size: 10, fill: "white", content: "Где ты?", bold: true, anchor: "middle" },
    { kind: "text", x: 43, y: 48, size: 8, fill: "white", content: "я в школе", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 84, y: 18, w: 66, h: 40, rx: 10, fill: "accent" },
    { kind: "text", x: 117, y: 34, size: 9, fill: "white", content: "Куда ты идёшь?", bold: true, anchor: "middle" },
    { kind: "text", x: 117, y: 48, size: 8, fill: "white", content: "я иду в школу", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 43, y: 76, size: 8.5, fill: "brandLight", content: "preposicional", bold: true, anchor: "middle" },
    { kind: "text", x: 117, y: 76, size: 8.5, fill: "accentLight", content: "acusativo", bold: true, anchor: "middle" },
    { kind: "path", d: "M20 92 L140 92", stroke: "muted", strokeWidth: 2 },
    { kind: "text", x: 80, y: 106, size: 8, fill: "inkSoft", content: "ubicación vs. dirección", anchor: "middle" },
  ],

  // школа → в школу / работа → на работу — terminación -у del acusativo de dirección.
  accusativeDirectionEndings: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 10, fill: "inkSoft", content: "школа", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 10, fill: "white", content: "в школу", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-у", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9.5, fill: "brandLight", content: "работа → на работу", bold: true, anchor: "middle" },
  ],

  // "домой" — a casa, sin preposición (excepción a la regla).
  domoyHome: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "path", d: "M80 24 L34 60 L44 60 L44 96 L70 96 L70 72 L90 72 L90 96 L116 96 L116 60 L126 60 Z", fill: "brand" },
    { kind: "text", x: 80, y: 112, size: 10, fill: "brandLight", content: "Я иду домой.", bold: true, anchor: "middle" },
    { kind: "circle", cx: 128, cy: 24, r: 15, fill: "danger" },
    { kind: "text", x: 128, y: 30, size: 14, fill: "white", content: "!", bold: true, anchor: "middle" },
  ],

  // "Куда ты идёшь?" — "Я иду в магазин." — mini diálogo de dirección.
  kudaDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 16, w: 104, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M30 48 L24 60 L44 48 Z", fill: "brand" },
    { kind: "text", x: 62, y: 37, size: 12, fill: "white", content: "Куда ты идёшь?", bold: true, anchor: "middle" },
    { kind: "rect", x: 48, y: 66, w: 98, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M126 66 L132 54 L112 66 Z", fill: "accentLight" },
    { kind: "text", x: 97, y: 87, size: 12, fill: "white", content: "Я иду в магазин.", bold: true, anchor: "middle" },
  ],

  // читать → читал — quitar -ть e добавir -л (pasado).
  pastFormation: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 11, fill: "inkSoft", content: "читать", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 11, fill: "white", content: "читал", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-ть → -л", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9, fill: "brandLight", content: "работать → работал", bold: true, anchor: "middle" },
  ],

  // он читал / она читала / оно читало / они читали — género, no persona.
  pastGenderAgreement: [
    { kind: "rect", x: 8, y: 10, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 29, size: 10.5, fill: "white", content: "он читал", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 10, w: 68, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 118, y: 29, size: 9.5, fill: "white", content: "она читала", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 45, w: 68, h: 30, rx: 8, fill: "accent" },
    { kind: "text", x: 42, y: 64, size: 9.5, fill: "white", content: "оно читало", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 45, w: 68, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 118, y: 64, size: 9.5, fill: "white", content: "они читали", bold: true, anchor: "middle" },
    { kind: "path", d: "M20 88 L140 88", stroke: "muted", strokeWidth: 2 },
    { kind: "text", x: 80, y: 102, size: 8, fill: "inkSoft", content: "género y número, no persona", anchor: "middle" },
    { kind: "text", x: 80, y: 113, size: 7.5, fill: "danger", content: "(a diferencia del español)", anchor: "middle" },
  ],

  // был / была / было / были — pasado irregular del verbo "быть" (ser/estar).
  pastByt: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 56, h: 26, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 33, size: 11, fill: "white", content: "был", bold: true, anchor: "middle" },
    { kind: "rect", x: 90, y: 16, w: 56, h: 26, rx: 8, fill: "brandLight" },
    { kind: "text", x: 118, y: 33, size: 11, fill: "white", content: "была", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 50, w: 56, h: 26, rx: 8, fill: "accent" },
    { kind: "text", x: 42, y: 67, size: 11, fill: "white", content: "было", bold: true, anchor: "middle" },
    { kind: "rect", x: 90, y: 50, w: 56, h: 26, rx: 8, fill: "accentLight" },
    { kind: "text", x: 118, y: 67, size: 11, fill: "white", content: "были", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 9, fill: "inkSoft", content: "быть = ser / estar", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 8, fill: "brandLight", content: "Я был дома.", anchor: "middle" },
  ],

  // "Я не читал." — не + verbo en pasado para negar.
  pastNegation: [
    { kind: "circle", cx: 70, cy: 58, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 66, cy: 54, r: 26, fill: "white" },
    { kind: "circle", cx: 66, cy: 54, r: 26, stroke: "accentLight", strokeWidth: 6 },
    { kind: "text", x: 66, y: 62, size: 20, fill: "brand", content: "не", bold: true, anchor: "middle" },
    { kind: "path", d: "M85 73 L104 92", stroke: "accentLight", strokeWidth: 7, round: true },
    { kind: "rect", x: 20, y: 92, w: 100, h: 22, rx: 8, fill: "muted" },
    { kind: "text", x: 70, y: 107, size: 9.5, fill: "inkSoft", content: "Я не читал книгу.", bold: true, anchor: "middle" },
  ],

  // "Что ты делал вчера?" — "Я работал." — mini diálogo en pasado.
  pastDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 6, y: 16, w: 112, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M26 48 L20 60 L40 48 Z", fill: "brand" },
    { kind: "text", x: 62, y: 37, size: 11.5, fill: "white", content: "Что ты делал вчера?", bold: true, anchor: "middle" },
    { kind: "rect", x: 54, y: 66, w: 92, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M130 66 L136 54 L116 66 Z", fill: "accentLight" },
    { kind: "text", x: 100, y: 87, size: 12, fill: "white", content: "Я работал.", bold: true, anchor: "middle" },
  ],

  // говорил / смотрел / читал / работал — tarjetas de verbos comunes en pasado.
  pastMoreVerbs: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "говорил", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "habló", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "смотрел", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "vio", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "читал", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "leyó", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 10, fill: "white", content: "работал", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "trabajó", opacity: 0.85, anchor: "middle" },
  ],

  // завтра / суббота / скоро / потом — tarjetas de vocabulario del futuro.
  futureVocab: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "завтра", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "mañana", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 9, fill: "white", content: "суббота", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "sábado", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "скоро", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "pronto", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 10, fill: "white", content: "потом", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "después", opacity: 0.85, anchor: "middle" },
  ],

  // читать/прочитать, писать/написать — pares aspectuales imperfectivo/perfectivo.
  aspectPairs: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 20, w: 62, h: 34, rx: 8, fill: "brand" },
    { kind: "text", x: 41, y: 42, size: 11, fill: "white", content: "читать", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 66, w: 62, h: 34, rx: 8, fill: "brandLight" },
    { kind: "text", x: 41, y: 88, size: 10, fill: "white", content: "прочитать", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 34, rx: 8, fill: "accent" },
    { kind: "text", x: 119, y: 42, size: 11, fill: "white", content: "писать", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 66, w: 62, h: 34, rx: 8, fill: "accentLight" },
    { kind: "text", x: 119, y: 88, size: 10, fill: "white", content: "написать", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 14, size: 7.5, fill: "brandLight", content: "imperfectivo / perfectivo", anchor: "middle" },
  ],

  // Conjugación de "быть" en futuro: буду, будешь, будет, будем, будете, будут.
  futureByt: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 20, y: 16, w: 56, h: 24, rx: 8, fill: "brand" },
    { kind: "text", x: 48, y: 32, size: 10, fill: "white", content: "я буду", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 16, w: 56, h: 24, rx: 8, fill: "brandLight" },
    { kind: "text", x: 112, y: 32, size: 8.5, fill: "white", content: "ты будешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 48, w: 56, h: 24, rx: 8, fill: "accent" },
    { kind: "text", x: 48, y: 64, size: 9, fill: "white", content: "он будет", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 48, w: 56, h: 24, rx: 8, fill: "accentLight" },
    { kind: "text", x: 112, y: 64, size: 9, fill: "white", content: "мы будем", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 80, w: 56, h: 24, rx: 8, fill: "ink", opacity: 0.85 },
    { kind: "text", x: 48, y: 96, size: 8.5, fill: "white", content: "вы будете", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 80, w: 56, h: 24, rx: 8, fill: "ink" },
    { kind: "text", x: 112, y: 96, size: 8.5, fill: "white", content: "они будут", bold: true, anchor: "middle" },
  ],

  // читать → прочитать — prefijo про- forma el aspecto perfectivo.
  perfectiveFormation: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 11, fill: "inkSoft", content: "читать", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 30, w: 48, h: 50, rx: 10, fill: "brand" },
    { kind: "rect", x: 100, y: 30, w: 20, h: 50, rx: 10, fill: "accentLight" },
    { kind: "text", x: 110, y: 58, size: 9, fill: "white", content: "про", bold: true, anchor: "middle" },
    { kind: "text", x: 134, y: 58, size: 9, fill: "white", content: "чи", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 9, fill: "brandLight", content: "писать → написать", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 7.5, fill: "inkSoft", content: "cada prefijo se aprende con su verbo", anchor: "middle" },
  ],

  // "Я не буду читать." / "Я не прочитаю." — negación del futuro.
  futureNegation: [
    { kind: "circle", cx: 70, cy: 58, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 66, cy: 54, r: 26, fill: "white" },
    { kind: "circle", cx: 66, cy: 54, r: 26, stroke: "accentLight", strokeWidth: 6 },
    { kind: "text", x: 66, y: 62, size: 20, fill: "brand", content: "не", bold: true, anchor: "middle" },
    { kind: "path", d: "M85 73 L104 92", stroke: "accentLight", strokeWidth: 7, round: true },
    { kind: "rect", x: 12, y: 92, w: 116, h: 22, rx: 8, fill: "muted" },
    { kind: "text", x: 70, y: 107, size: 9, fill: "inkSoft", content: "Я не буду читать книгу.", bold: true, anchor: "middle" },
  ],

  // "Что ты будешь делать завтра?" — "Я буду работать." — diálogo en futuro.
  futureDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 4, y: 16, w: 120, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M24 48 L18 60 L38 48 Z", fill: "brand" },
    { kind: "text", x: 64, y: 37, size: 10.5, fill: "white", content: "Что ты будешь делать завтра?", bold: true, anchor: "middle" },
    { kind: "rect", x: 54, y: 66, w: 92, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M130 66 L136 54 L116 66 Z", fill: "accentLight" },
    { kind: "text", x: 100, y: 87, size: 12, fill: "white", content: "Я буду работать.", bold: true, anchor: "middle" },
  ],

  // собака / время / деньги / машина — tarjetas de vocabulario de posesión.
  possessionGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "собака", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "perro", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "время", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "tiempo", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "деньги", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "dinero", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 10, fill: "white", content: "машина", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "coche", opacity: 0.85, anchor: "middle" },
  ],

  // у меня, у тебя, у него, у неё, у нас, у вас, у них — pronombres en genitivo.
  genitivePronounsFull: [
    { kind: "rect", x: 8, y: 8, w: 46, h: 28, rx: 8, fill: "brand" },
    { kind: "text", x: 31, y: 26, size: 9.5, fill: "white", content: "у меня", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 8, w: 46, h: 28, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 26, size: 9.5, fill: "white", content: "у тебя", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 8, w: 46, h: 28, rx: 8, fill: "accent" },
    { kind: "text", x: 129, y: 26, size: 9.5, fill: "white", content: "у него", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 41, w: 46, h: 28, rx: 8, fill: "accentLight" },
    { kind: "text", x: 31, y: 59, size: 9.5, fill: "white", content: "у неё", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 41, w: 46, h: 28, rx: 8, fill: "ink", opacity: 0.85 },
    { kind: "text", x: 80, y: 59, size: 9.5, fill: "white", content: "у нас", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 41, w: 46, h: 28, rx: 8, fill: "ink" },
    { kind: "text", x: 129, y: 59, size: 9.5, fill: "white", content: "у вас", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 74, w: 46, h: 28, rx: 8, fill: "brand" },
    { kind: "text", x: 80, y: 92, size: 9.5, fill: "white", content: "у них", bold: true, anchor: "middle" },
  ],

  // "yo tengo un perro" vs "у меня есть собака" — verbo personal vs construcción impersonal.
  estContrast: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 9.5, fill: "inkSoft", content: "yo tengo", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 9.5, fill: "inkSoft", content: "un perro", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 74, size: 7.5, fill: "danger", content: "(verbo personal)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 38, size: 9, fill: "white", content: "у меня", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 51, size: 9, fill: "white", content: "есть собака", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 74, size: 7.5, fill: "accentLight", content: "(existencia)", anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "inkSoft", content: "literalmente: 'junto a mí hay un perro'", anchor: "middle" },
  ],

  // "У меня новая машина" (sin "есть") — se omite al describir cualidad, no existencia.
  possessionOmitEst: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 24, w: 132, h: 26, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 42, size: 10.5, fill: "white", content: "У меня есть машина.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 8, fill: "inkSoft", content: "(existencia: ¿tengo una?)", anchor: "middle" },
    { kind: "rect", x: 14, y: 74, w: 132, h: 26, rx: 10, fill: "accentLight" },
    { kind: "text", x: 80, y: 92, size: 10.5, fill: "white", content: "У меня новая машина.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 111, size: 8, fill: "inkSoft", content: "(cualidad: cómo es — sin 'есть')", anchor: "middle" },
  ],

  // "У меня есть машина" → "У меня нет машины" — el objeto cambia a genitivo al negar.
  negationGenitiveShift: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 60, size: 9.5, fill: "inkSoft", content: "есть машина", bold: true, anchor: "middle" },
    { kind: "text", x: 44, y: 72, size: 7, fill: "inkSoft", content: "(nominativo)", anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "danger" },
    { kind: "text", x: 124, y: 56, size: 9, fill: "white", content: "нет машины", bold: true, anchor: "middle" },
    { kind: "text", x: 124, y: 68, size: 7, fill: "white", content: "(genitivo)", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8.5, fill: "brandLight", content: "нет siempre pide genitivo", bold: true, anchor: "middle" },
  ],

  // "У тебя есть время?" — "Да, у меня есть время." — mini diálogo de posesión.
  possessionDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 16, w: 104, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M30 48 L24 60 L44 48 Z", fill: "brand" },
    { kind: "text", x: 62, y: 37, size: 12, fill: "white", content: "У тебя есть время?", bold: true, anchor: "middle" },
    { kind: "rect", x: 34, y: 66, w: 112, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M126 66 L132 54 L112 66 Z", fill: "accentLight" },
    { kind: "text", x: 90, y: 87, size: 11.5, fill: "white", content: "Да, у меня есть время.", bold: true, anchor: "middle" },
  ],

  // час / утро / день / вечер / ночь — tarjetas de vocabulario del tiempo.
  clockGrid: [
    { kind: "circle", cx: 80, cy: 44, r: 30, fill: "white" },
    { kind: "circle", cx: 80, cy: 44, r: 30, stroke: "brand", strokeWidth: 5 },
    { kind: "path", d: "M80 44 L80 26 M80 44 L94 50", stroke: "brand", strokeWidth: 4, round: true },
    { kind: "circle", cx: 80, cy: 44, r: 3, fill: "brand" },
    { kind: "rect", x: 8, y: 86, w: 44, h: 26, rx: 8, fill: "brandLight" },
    { kind: "text", x: 30, y: 103, size: 9, fill: "white", content: "утро", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 86, w: 44, h: 26, rx: 8, fill: "accent" },
    { kind: "text", x: 80, y: 103, size: 9, fill: "white", content: "день", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 86, w: 44, h: 26, rx: 8, fill: "ink" },
    { kind: "text", x: 130, y: 103, size: 8, fill: "white", content: "вечер / ночь", bold: true, anchor: "middle" },
  ],

  // 1 час / 2-4 часа / 5-20 часов — concordancia numeral-sustantivo con "час".
  hourNumberAgreement: [
    { kind: "rect", x: 6, y: 12, w: 46, h: 92, rx: 8, fill: "brand" },
    { kind: "text", x: 29, y: 40, size: 13, fill: "white", content: "1", bold: true, anchor: "middle" },
    { kind: "text", x: 29, y: 70, size: 10, fill: "white", content: "час", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 12, w: 46, h: 92, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 40, size: 13, fill: "white", content: "2-4", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 10, fill: "white", content: "часа", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 12, w: 46, h: 92, rx: 8, fill: "accentLight" },
    { kind: "text", x: 131, y: 40, size: 12, fill: "white", content: "5-20", bold: true, anchor: "middle" },
    { kind: "text", x: 131, y: 70, size: 10, fill: "white", content: "часов", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 112, size: 7.5, fill: "inkSoft", content: "el número cambia la terminación de 'час'", anchor: "middle" },
  ],

  // утром / днём / вечером / ночью — instrumental sin preposición.
  dayPartsInstrumental: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 20, w: 62, h: 34, rx: 8, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 10, fill: "inkSoft", content: "por la mañana", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 62, size: 8, fill: "danger", content: "(con preposición)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 34, rx: 8, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 11, fill: "white", content: "утром", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 62, size: 8, fill: "accentLight", content: "(sin preposición)", anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 9, fill: "brandLight", content: "днём / вечером / ночью", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 106, size: 7.5, fill: "inkSoft", content: "por el día / por la tarde / por la noche", anchor: "middle" },
  ],

  // половина третьего / без четверти три — media hora y cuarto para hora.
  halfAndQuarter: [
    { kind: "circle", cx: 80, cy: 54, r: 32, fill: "white" },
    { kind: "circle", cx: 80, cy: 54, r: 32, stroke: "accent", strokeWidth: 5 },
    { kind: "path", d: "M80 54 L80 32", stroke: "accent", strokeWidth: 4, round: true },
    { kind: "path", d: "M80 54 L98 44", stroke: "brand", strokeWidth: 4, round: true },
    { kind: "circle", cx: 80, cy: 54, r: 3, fill: "ink" },
    { kind: "rect", x: 10, y: 96, w: 68, h: 20, rx: 7, fill: "brandLight" },
    { kind: "text", x: 44, y: 110, size: 8, fill: "white", content: "половина третьего", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 96, w: 68, h: 20, rx: 7, fill: "accentLight" },
    { kind: "text", x: 116, y: 110, size: 7.5, fill: "white", content: "без четверти три", bold: true, anchor: "middle" },
  ],

  // "в два часа" / "в девять часов" — "в" + número para decir "a las...".
  atTimeConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 26, y: 40, w: 108, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 58, size: 12, fill: "white", content: "в два часа", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 8, fill: "white", content: "a las dos", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 36, y: 18, w: 30, h: 16, rx: 6, fill: "accentLight" },
    { kind: "text", x: 51, y: 30, size: 9, fill: "white", content: "в", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 9, fill: "brandLight", content: "в девять часов", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 7.5, fill: "inkSoft", content: "a las nueve", anchor: "middle" },
  ],

  // "Который час?" — "Сейчас пять часов." — mini diálogo de la hora.
  timeDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 18, y: 16, w: 96, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M38 48 L32 60 L52 48 Z", fill: "brand" },
    { kind: "text", x: 66, y: 37, size: 12, fill: "white", content: "Который час?", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 66, w: 106, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M126 66 L132 54 L112 66 Z", fill: "accentLight" },
    { kind: "text", x: 93, y: 87, size: 11.5, fill: "white", content: "Сейчас пять часов.", bold: true, anchor: "middle" },
  ],

  // Los 7 días de la semana en un ciclo circular.
  weekCycle: [
    { kind: "circle", cx: 80, cy: 60, r: 46, stroke: "brand", strokeWidth: 3, opacity: 0.3 },
    { kind: "circle", cx: 80, cy: 16, r: 13, fill: "brand" },
    { kind: "text", x: 80, y: 20, size: 7, fill: "white", content: "пн", bold: true, anchor: "middle" },
    { kind: "circle", cx: 116, cy: 30, r: 13, fill: "brandLight" },
    { kind: "text", x: 116, y: 34, size: 7, fill: "white", content: "вт", bold: true, anchor: "middle" },
    { kind: "circle", cx: 128, cy: 64, r: 13, fill: "accent" },
    { kind: "text", x: 128, y: 68, size: 7, fill: "white", content: "ср", bold: true, anchor: "middle" },
    { kind: "circle", cx: 106, cy: 98, r: 13, fill: "accentLight" },
    { kind: "text", x: 106, y: 102, size: 7, fill: "white", content: "чт", bold: true, anchor: "middle" },
    { kind: "circle", cx: 62, cy: 104, r: 13, fill: "ink" },
    { kind: "text", x: 62, y: 108, size: 7, fill: "white", content: "пт", bold: true, anchor: "middle" },
    { kind: "circle", cx: 34, cy: 78, r: 13, fill: "brand" },
    { kind: "text", x: 34, y: 82, size: 7, fill: "white", content: "сб", bold: true, anchor: "middle" },
    { kind: "circle", cx: 32, cy: 36, r: 13, fill: "danger" },
    { kind: "text", x: 32, y: 40, size: 7, fill: "white", content: "вс", bold: true, anchor: "middle" },
  ],

  // Rejilla de 12 meses del año, estilo calendario.
  monthsGrid: [
    { kind: "rect", x: 6, y: 8, w: 148, h: 104, rx: 10, fill: "muted", opacity: 0.4 },
    { kind: "rect", x: 12, y: 14, w: 34, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 29, y: 29, size: 6.5, fill: "white", content: "янв", bold: true, anchor: "middle" },
    { kind: "rect", x: 50, y: 14, w: 34, h: 22, rx: 5, fill: "brandLight" },
    { kind: "text", x: 67, y: 29, size: 6.5, fill: "white", content: "фев", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 14, w: 34, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 105, y: 29, size: 6.5, fill: "white", content: "март", bold: true, anchor: "middle" },
    { kind: "rect", x: 126, y: 14, w: 24, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 138, y: 29, size: 6.5, fill: "white", content: "апр", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 42, w: 34, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 29, y: 57, size: 6.5, fill: "white", content: "май", bold: true, anchor: "middle" },
    { kind: "rect", x: 50, y: 42, w: 34, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 67, y: 57, size: 6.5, fill: "white", content: "июнь", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 42, w: 34, h: 22, rx: 5, fill: "brandLight" },
    { kind: "text", x: 105, y: 57, size: 6.5, fill: "white", content: "июль", bold: true, anchor: "middle" },
    { kind: "rect", x: 126, y: 42, w: 24, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 138, y: 57, size: 6.5, fill: "white", content: "авг", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 70, w: 34, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 29, y: 85, size: 6, fill: "white", content: "сент", bold: true, anchor: "middle" },
    { kind: "rect", x: 50, y: 70, w: 34, h: 22, rx: 5, fill: "brandLight" },
    { kind: "text", x: 67, y: 85, size: 6, fill: "white", content: "окт", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 70, w: 34, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 105, y: 85, size: 6, fill: "white", content: "нояб", bold: true, anchor: "middle" },
    { kind: "rect", x: 126, y: 70, w: 24, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 138, y: 85, size: 6, fill: "white", content: "дек", bold: true, anchor: "middle" },
  ],

  // среда → в среду — días con acusativo (misma regla de a1-13: -а → -у).
  daysAccusative: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 11, fill: "inkSoft", content: "среда", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 10, fill: "white", content: "в среду", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-у", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9, fill: "brandLight", content: "суббота → в субботу", bold: true, anchor: "middle" },
  ],

  // январь → в январе — meses con preposicional (misma regla de a1-11: -е).
  monthsPrepositional: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 11, fill: "inkSoft", content: "январь", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brandLight" },
    { kind: "text", x: 124, y: 60, size: 10, fill: "white", content: "в январе", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-е", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9, fill: "brandLight", content: "май → в мае", bold: true, anchor: "middle" },
  ],

  // Minúsculas en ambos idiomas, pero el ruso añade cambio de caso; el español no.
  dayMonthCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 9.5, fill: "inkSoft", content: "el lunes", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 9.5, fill: "inkSoft", content: "en mayo", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 74, size: 7.5, fill: "danger", content: "(sin cambios)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 38, size: 9, fill: "white", content: "в понедельник", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 51, size: 9, fill: "white", content: "в мае", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 74, size: 7.5, fill: "accentLight", content: "(caso cambia)", anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "inkSoft", content: "ambos usan minúscula, pero solo el ruso declina", anchor: "middle" },
  ],

  // "Какой сегодня день?" — "Сегодня среда." — mini diálogo de calendario.
  calendarDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 16, w: 116, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M30 48 L24 60 L44 48 Z", fill: "brand" },
    { kind: "text", x: 68, y: 37, size: 11.5, fill: "white", content: "Какой сегодня день?", bold: true, anchor: "middle" },
    { kind: "rect", x: 54, y: 66, w: 92, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M130 66 L136 54 L116 66 Z", fill: "accentLight" },
    { kind: "text", x: 100, y: 87, size: 12, fill: "white", content: "Сегодня среда.", bold: true, anchor: "middle" },
  ],

  // число / дата / год / праздник — tarjetas de vocabulario de fechas.
  dateVocab: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "число", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "fecha", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "дата", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "fecha", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "год", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "año", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 9, fill: "white", content: "праздник", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "fiesta", opacity: 0.85, anchor: "middle" },
  ],

  // первое, второе, третье... десятое — tabla de ordinales en nominativo neutro.
  ordinalNominativeTable: [
    { kind: "rect", x: 6, y: 10, w: 46, h: 26, rx: 7, fill: "brand" },
    { kind: "text", x: 29, y: 27, size: 9, fill: "white", content: "первое", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 10, w: 46, h: 26, rx: 7, fill: "brandLight" },
    { kind: "text", x: 80, y: 27, size: 9, fill: "white", content: "второе", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 10, w: 46, h: 26, rx: 7, fill: "accent" },
    { kind: "text", x: 131, y: 27, size: 9, fill: "white", content: "третье", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 44, w: 46, h: 26, rx: 7, fill: "accentLight" },
    { kind: "text", x: 29, y: 61, size: 8, fill: "white", content: "четвёртое", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 44, w: 46, h: 26, rx: 7, fill: "ink", opacity: 0.85 },
    { kind: "text", x: 80, y: 61, size: 9, fill: "white", content: "пятое", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 44, w: 46, h: 26, rx: 7, fill: "ink" },
    { kind: "text", x: 131, y: 61, size: 8.5, fill: "white", content: "шестое", bold: true, anchor: "middle" },
    { kind: "rect", x: 32, y: 78, w: 46, h: 26, rx: 7, fill: "brand" },
    { kind: "text", x: 55, y: 95, size: 8, fill: "white", content: "седьмое", bold: true, anchor: "middle" },
    { kind: "rect", x: 83, y: 78, w: 46, h: 26, rx: 7, fill: "brandLight" },
    { kind: "text", x: 106, y: 95, size: 8, fill: "white", content: "десятое", bold: true, anchor: "middle" },
  ],

  // первое → первого — el ordinal cambia según su función en la frase.
  ordinalGenitiveShift: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 10, fill: "white", content: "первое", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 55, size: 7, fill: "white", content: "сегодня...", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "accent" },
    { kind: "text", x: 119, y: 40, size: 10, fill: "white", content: "первого", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 55, size: 7, fill: "white", content: "я родился...", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 8, fill: "brandLight", content: "nominativo (hoy es)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 8, fill: "accentLight", content: "genitivo (nací el)", bold: true, anchor: "middle" },
  ],

  // сентября / марта / января — el mes siempre va en genitivo, sin excepción.
  monthAlwaysGenitive: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 20, y: 34, w: 120, h: 24, rx: 8, fill: "brand" },
    { kind: "text", x: 80, y: 51, size: 10.5, fill: "white", content: "первое сентября", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 64, w: 120, h: 24, rx: 8, fill: "accent" },
    { kind: "text", x: 80, y: 81, size: 10.5, fill: "white", content: "пятого мая", bold: true, anchor: "middle" },
    { kind: "circle", cx: 128, cy: 20, r: 15, fill: "brandLight" },
    { kind: "path", d: "M122 20 L127 25 L135 15", stroke: "white", strokeWidth: 3, round: true },
    { kind: "text", x: 80, y: 108, size: 8, fill: "inkSoft", content: "el mes siempre en genitivo", anchor: "middle" },
  ],

  // "el cinco de mayo" (una sola forma) vs "пятое / пятого мая" (dos formas).
  spanishDateCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 40, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 9, fill: "inkSoft", content: "el cinco de mayo", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 7.5, fill: "danger", content: "(siempre igual)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 8.5, fill: "white", content: "пятое / пятого", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 52, size: 8.5, fill: "white", content: "мая", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 62, size: 7.5, fill: "accentLight", content: "(dos formas)", anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 8, fill: "inkSoft", content: "el español no distingue función; el ruso sí", anchor: "middle" },
  ],

  // "Какое сегодня число?" — "Сегодня первое сентября." — mini diálogo de fechas.
  dateDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 8, y: 16, w: 120, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 48 L22 60 L42 48 Z", fill: "brand" },
    { kind: "text", x: 68, y: 37, size: 11, fill: "white", content: "Какое сегодня число?", bold: true, anchor: "middle" },
    { kind: "rect", x: 30, y: 66, w: 116, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M130 66 L136 54 L116 66 Z", fill: "accentLight" },
    { kind: "text", x: 88, y: 87, size: 11, fill: "white", content: "Сегодня первое сентября.", bold: true, anchor: "middle" },
  ],

  // стул / стол / вода / комната — tarjetas de vocabulario del genitivo.
  genitiveVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "стул", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "silla", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "стол", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "mesa", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "вода", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "agua", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 9, fill: "white", content: "комната", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "habitación", opacity: 0.85, anchor: "middle" },
  ],

  // стол → стола / окно → окна — genitivo masculino y neutro, terminación -а.
  genitiveMascNeutEndings: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 11, fill: "inkSoft", content: "стол", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 11, fill: "white", content: "стола", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-а", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9, fill: "brandLight", content: "окно → окна", bold: true, anchor: "middle" },
  ],

  // книга → книги (no книгы) — genitivo femenino y la regla ortográfica de 7 letras.
  genitiveFemEndings: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 11, fill: "inkSoft", content: "книга", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 11, fill: "white", content: "книги", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "danger" },
    { kind: "text", x: 124, y: 76, size: 7, fill: "white", content: "-и no -ы", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "inkSoft", content: "después de г,к,х,ж,ш,щ,ч siempre -и", anchor: "middle" },
  ],

  // ничего, никого, нигде, никогда — familia de pronombres y adverbios negativos.
  negativePronouns: [
    { kind: "rect", x: 8, y: 10, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 29, size: 9.5, fill: "white", content: "ничего", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 10, w: 68, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 118, y: 29, size: 9.5, fill: "white", content: "никого", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 45, w: 68, h: 30, rx: 8, fill: "accent" },
    { kind: "text", x: 42, y: 64, size: 9.5, fill: "white", content: "нигде", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 45, w: 68, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 118, y: 64, size: 8.5, fill: "white", content: "никогда", bold: true, anchor: "middle" },
    { kind: "path", d: "M20 88 L140 88", stroke: "muted", strokeWidth: 2 },
    { kind: "text", x: 80, y: 102, size: 8, fill: "inkSoft", content: "siempre con 'не' — doble negación", anchor: "middle" },
  ],

  // "В комнате нет стула." — el genitivo con "нет" se aplica a cualquier lugar.
  genitiveLocationExistence: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 20, y: 34, w: 120, h: 24, rx: 8, fill: "brand" },
    { kind: "text", x: 80, y: 51, size: 10.5, fill: "white", content: "В комнате нет стула.", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 64, w: 120, h: 24, rx: 8, fill: "accent" },
    { kind: "text", x: 80, y: 81, size: 10.5, fill: "white", content: "Здесь нет воды.", bold: true, anchor: "middle" },
    { kind: "circle", cx: 128, cy: 20, r: 15, fill: "danger" },
    { kind: "text", x: 128, y: 26, size: 14, fill: "white", content: "✕", bold: true, anchor: "middle" },
  ],

  // "Здесь есть вода?" — "Нет, здесь нет воды." — mini diálogo de ausencia.
  genitiveDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 18, y: 16, w: 96, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M38 48 L32 60 L52 48 Z", fill: "brand" },
    { kind: "text", x: 66, y: 37, size: 12, fill: "white", content: "Здесь есть вода?", bold: true, anchor: "middle" },
    { kind: "rect", x: 24, y: 66, w: 122, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M126 66 L132 54 L112 66 Z", fill: "accentLight" },
    { kind: "text", x: 85, y: 87, size: 11, fill: "white", content: "Нет, здесь нет воды.", bold: true, anchor: "middle" },
  ],

  // много / мало / сколько / несколько — tarjetas de vocabulario de cantidad.
  quantityVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "много", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "mucho", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "мало", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "poco", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 9, fill: "white", content: "сколько", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "cuánto", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 8.5, fill: "white", content: "несколько", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "algunos", opacity: 0.85, anchor: "middle" },
  ],

  // один / одна / одно — el número 1 concuerda en género, como un adjetivo.
  oneGenderAgreement: [
    { kind: "rect", x: 8, y: 20, w: 46, h: 60, rx: 8, fill: "brand" },
    { kind: "text", x: 31, y: 46, size: 11, fill: "white", content: "один", bold: true, anchor: "middle" },
    { kind: "text", x: 31, y: 62, size: 8, fill: "white", content: "стол", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 57, y: 20, w: 46, h: 60, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 46, size: 10.5, fill: "white", content: "одна", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 8, fill: "white", content: "книга", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 106, y: 20, w: 46, h: 60, rx: 8, fill: "accent" },
    { kind: "text", x: 129, y: 46, size: 10.5, fill: "white", content: "одно", bold: true, anchor: "middle" },
    { kind: "text", x: 129, y: 62, size: 8, fill: "white", content: "окно", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "inkSoft", content: "masculino / femenino / neutro", anchor: "middle" },
  ],

  // два (masc/neut) vs две (fem) — el número 2 también cambia según género.
  twoGenderSplit: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 12, fill: "white", content: "два", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 7.5, fill: "white", content: "стола / окна", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 40, rx: 10, fill: "accentLight" },
    { kind: "text", x: 119, y: 44, size: 12, fill: "white", content: "две", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 7.5, fill: "white", content: "книги", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8.5, fill: "brandLight", content: "три, четыре — no cambian", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "три стола, четыре книги", anchor: "middle" },
  ],

  // 1 → nominativo, 2-4 → genitivo singular, 5+ → genitivo plural.
  numeralCaseTable: [
    { kind: "rect", x: 6, y: 12, w: 46, h: 92, rx: 8, fill: "brand" },
    { kind: "text", x: 29, y: 34, size: 13, fill: "white", content: "1", bold: true, anchor: "middle" },
    { kind: "text", x: 29, y: 64, size: 8.5, fill: "white", content: "nominativo", bold: true, anchor: "middle" },
    { kind: "text", x: 29, y: 92, size: 8, fill: "white", content: "стол", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 57, y: 12, w: 46, h: 92, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 34, size: 12, fill: "white", content: "2-4", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 8, fill: "white", content: "genitivo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 72, size: 8, fill: "white", content: "singular", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 8, fill: "white", content: "стола", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 108, y: 12, w: 46, h: 92, rx: 8, fill: "accentLight" },
    { kind: "text", x: 131, y: 34, size: 11, fill: "white", content: "5+", bold: true, anchor: "middle" },
    { kind: "text", x: 131, y: 60, size: 8, fill: "white", content: "genitivo", bold: true, anchor: "middle" },
    { kind: "text", x: 131, y: 72, size: 8, fill: "white", content: "plural", bold: true, anchor: "middle" },
    { kind: "text", x: 131, y: 92, size: 8, fill: "white", content: "столов", opacity: 0.85, anchor: "middle" },
  ],

  // стол → столов / книга → книг / окно → окон — patrones del genitivo plural.
  genitivePluralFormation: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "стол", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7.5, fill: "white", content: "→ столов", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "книга", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7.5, fill: "white", content: "→ книг", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "окно", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7.5, fill: "white", content: "→ окон", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 9, fill: "white", content: "яблоко", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7.5, fill: "white", content: "→ яблок", opacity: 0.85, anchor: "middle" },
  ],

  // много книг / мало времени / сколько денег — cantidad + genitivo.
  quantityWords: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 30, w: 128, h: 24, rx: 8, fill: "brand" },
    { kind: "text", x: 80, y: 47, size: 10.5, fill: "white", content: "много книг", bold: true, anchor: "middle" },
    { kind: "rect", x: 16, y: 60, w: 128, h: 24, rx: 8, fill: "accent" },
    { kind: "text", x: 80, y: 77, size: 10.5, fill: "white", content: "мало времени", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "inkSoft", content: "plural contable / singular incontable", anchor: "middle" },
  ],

  // "Сколько у тебя книг?" — "У меня много книг." — mini diálogo de cantidad.
  quantityDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 12, y: 16, w: 112, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M32 48 L26 60 L46 48 Z", fill: "brand" },
    { kind: "text", x: 68, y: 37, size: 11.5, fill: "white", content: "Сколько у тебя книг?", bold: true, anchor: "middle" },
    { kind: "rect", x: 38, y: 66, w: 108, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M130 66 L136 54 L116 66 Z", fill: "accentLight" },
    { kind: "text", x: 92, y: 87, size: 11.5, fill: "white", content: "У меня много книг.", bold: true, anchor: "middle" },
  ],

  // брат / сестра / мама / письмо — tarjetas de vocabulario de pertenencia.
  originVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "брат", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "hermano", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "сестра", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "hermana", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "мама", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "mamá", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 9, fill: "white", content: "письмо", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "carta", opacity: 0.85, anchor: "middle" },
  ],

  // "книга брата" — posesión sin preposición, solo con el genitivo.
  possessionNoPreposition: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 40, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 9, fill: "inkSoft", content: "el libro del", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 9, fill: "inkSoft", content: "hermano", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 10, fill: "white", content: "книга", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 10, fill: "white", content: "брата", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 8, fill: "inkSoft", content: "sin preposición: el caso genitivo hace todo el trabajo", anchor: "middle" },
  ],

  // "Чья это книга?" — pregunta con чей/чья/чьё (¿de quién?).
  chiyQuestion: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 12, y: 20, w: 46, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 35, y: 39, size: 10, fill: "white", content: "чей", bold: true, anchor: "middle" },
    { kind: "rect", x: 63, y: 20, w: 46, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 86, y: 39, size: 10, fill: "white", content: "чья", bold: true, anchor: "middle" },
    { kind: "rect", x: 114, y: 20, w: 34, h: 30, rx: 8, fill: "accent" },
    { kind: "text", x: 131, y: 39, size: 9, fill: "white", content: "чьё", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 10, fill: "brandLight", content: "Чья это книга?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 9, fill: "accentLight", content: "Книга брата.", bold: true, anchor: "middle" },
  ],

  // "из" (origen encerrado) vs "от" (persona o punto de partida).
  izVsOt: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 12, fill: "white", content: "из", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 8, fill: "white", content: "Мексики", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "accent" },
    { kind: "text", x: 119, y: 40, size: 12, fill: "white", content: "от", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 8, fill: "white", content: "мамы", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 41, y: 78, size: 7.5, fill: "brandLight", content: "lugar de origen", anchor: "middle" },
    { kind: "text", x: 119, y: 78, size: 7.5, fill: "accentLight", content: "persona / punto", anchor: "middle" },
  ],

  // в/на (hacia dentro) ↔ из/с (desde dentro) — pares simétricos de preposiciones.
  vNaIzSPairing: [
    { kind: "rect", x: 6, y: 10, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 40, y: 29, size: 11, fill: "white", content: "в школу", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 10, w: 68, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 118, y: 29, size: 10, fill: "white", content: "из школы", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 45, w: 68, h: 30, rx: 8, fill: "accent" },
    { kind: "text", x: 40, y: 64, size: 11, fill: "white", content: "на стол", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 45, w: 68, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 118, y: 64, size: 10, fill: "white", content: "со стола", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 25 L82 25 M78 60 L82 60", stroke: "muted", strokeWidth: 2 },
    { kind: "text", x: 80, y: 90, size: 8, fill: "inkSoft", content: "hacia dentro (в/на) ↔ desde dentro (из/с)", anchor: "middle" },
    { kind: "text", x: 80, y: 102, size: 7.5, fill: "inkSoft", content: "el mismo par en direcciones opuestas", anchor: "middle" },
  ],

  // "Откуда ты?" — "Я из Мексики." — mini diálogo de origen.
  originDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 20, y: 16, w: 76, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M40 48 L34 60 L54 48 Z", fill: "brand" },
    { kind: "text", x: 58, y: 37, size: 12, fill: "white", content: "Откуда ты?", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 66, w: 102, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M130 66 L136 54 L116 66 Z", fill: "accentLight" },
    { kind: "text", x: 95, y: 87, size: 12, fill: "white", content: "Я из Мексики.", bold: true, anchor: "middle" },
  ],

  // брата, сестры, отца, мамы — tabla ampliada de familia en genitivo.
  extendedFamilyGenitive: [
    { kind: "rect", x: 8, y: 10, w: 68, h: 26, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 27, size: 9.5, fill: "white", content: "брата", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 10, w: 68, h: 26, rx: 8, fill: "brandLight" },
    { kind: "text", x: 118, y: 27, size: 9.5, fill: "white", content: "сестры", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 42, w: 68, h: 26, rx: 8, fill: "accent" },
    { kind: "text", x: 42, y: 59, size: 9.5, fill: "white", content: "отца", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 42, w: 68, h: 26, rx: 8, fill: "accentLight" },
    { kind: "text", x: 118, y: 59, size: 9.5, fill: "white", content: "мамы", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 74, w: 68, h: 26, rx: 8, fill: "ink", opacity: 0.85 },
    { kind: "text", x: 42, y: 91, size: 8.5, fill: "white", content: "бабушки", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 74, w: 68, h: 26, rx: 8, fill: "ink" },
    { kind: "text", x: 118, y: 91, size: 8.5, fill: "white", content: "дедушки", bold: true, anchor: "middle" },
  ],

  // мне, тебе, ему, ей, нам, вам, им — pronombres personales en caso dativo.
  dativePronounsFull: [
    { kind: "rect", x: 8, y: 8, w: 46, h: 28, rx: 8, fill: "brand" },
    { kind: "text", x: 31, y: 26, size: 9.5, fill: "white", content: "мне", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 8, w: 46, h: 28, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 26, size: 9.5, fill: "white", content: "тебе", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 8, w: 46, h: 28, rx: 8, fill: "accent" },
    { kind: "text", x: 129, y: 26, size: 9.5, fill: "white", content: "ему", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 41, w: 46, h: 28, rx: 8, fill: "accentLight" },
    { kind: "text", x: 31, y: 59, size: 9.5, fill: "white", content: "ей", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 41, w: 46, h: 28, rx: 8, fill: "ink", opacity: 0.85 },
    { kind: "text", x: 80, y: 59, size: 9.5, fill: "white", content: "нам", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 41, w: 46, h: 28, rx: 8, fill: "ink" },
    { kind: "text", x: 129, y: 59, size: 9.5, fill: "white", content: "вам", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 74, w: 46, h: 28, rx: 8, fill: "brand" },
    { kind: "text", x: 80, y: 92, size: 9.5, fill: "white", content: "им", bold: true, anchor: "middle" },
  ],

  // "Мне двадцать лет." — construcción dativo + número + год/года/лет.
  ageConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 44, w: 40, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 34, y: 63, size: 10, fill: "white", content: "мне", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 44, w: 52, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 84, y: 63, size: 9, fill: "white", content: "двадцать", bold: true, anchor: "middle" },
    { kind: "rect", x: 114, y: 44, w: 34, h: 30, rx: 8, fill: "accent" },
    { kind: "text", x: 131, y: 63, size: 9.5, fill: "white", content: "лет", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 9, fill: "inkSoft", content: "a-mí veinte años (lit.)", anchor: "middle" },
  ],

  // 1 → год, 2-4 → года, 5+ → лет — concordancia numeral-edad.
  ageNumberAgreement: [
    { kind: "rect", x: 6, y: 12, w: 46, h: 92, rx: 8, fill: "brand" },
    { kind: "text", x: 29, y: 34, size: 13, fill: "white", content: "1", bold: true, anchor: "middle" },
    { kind: "text", x: 29, y: 70, size: 10, fill: "white", content: "год", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 12, w: 46, h: 92, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 34, size: 12, fill: "white", content: "2-4", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 10, fill: "white", content: "года", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 12, w: 46, h: 92, rx: 8, fill: "accentLight" },
    { kind: "text", x: 131, y: 34, size: 11, fill: "white", content: "5+", bold: true, anchor: "middle" },
    { kind: "text", x: 131, y: 70, size: 10, fill: "white", content: "лет", bold: true, anchor: "middle" },
  ],

  // once a catorce siempre usan "лет" — excepción de los números "-надцать".
  teenNumbersException: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 20, y: 34, w: 120, h: 26, rx: 8, fill: "danger" },
    { kind: "text", x: 80, y: 51, size: 10, fill: "white", content: "одиннадцать лет", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 64, w: 120, h: 26, rx: 8, fill: "ink" },
    { kind: "text", x: 80, y: 81, size: 10, fill: "white", content: "четырнадцать лет", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 8, fill: "danger", content: "excepción: nunca 'года', aunque terminen en 1-4", bold: true, anchor: "middle" },
  ],

  // "me gusta" / "мне..." — pronombres experimentadores en ambos idiomas.
  spanishDativeCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 40, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 9.5, fill: "inkSoft", content: "me, te, le...", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 7.5, fill: "danger", content: "objeto indirecto", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 9.5, fill: "white", content: "мне, тебе...", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 7.5, fill: "accentLight", content: "caso dativo", anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 8, fill: "inkSoft", content: "misma lógica: 'a mí me...' = 'мне...'", anchor: "middle" },
  ],

  // "Дай книгу другу." — vistazo al dativo de sustantivos: -у/-ю, -е.
  nounDativeGlimpse: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 11, fill: "inkSoft", content: "друг", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 10, fill: "white", content: "другу", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-у", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 9, fill: "brandLight", content: "сестра → сестре (-е)", bold: true, anchor: "middle" },
  ],

  // "Сколько тебе лет?" — "Мне двадцать лет." — mini diálogo de edad.
  ageDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 108, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M34 48 L28 60 L48 48 Z", fill: "brand" },
    { kind: "text", x: 68, y: 37, size: 12, fill: "white", content: "Сколько тебе лет?", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 66, w: 102, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M130 66 L136 54 L116 66 Z", fill: "accentLight" },
    { kind: "text", x: 95, y: 87, size: 12, fill: "white", content: "Мне двадцать лет.", bold: true, anchor: "middle" },
  ],

  // нравится / холодно / интересно / весело — tarjetas de sentimientos y estados.
  feelingsVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 9, fill: "white", content: "нравится", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "gusta", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 9, fill: "white", content: "холодно", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "frío", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 8.5, fill: "white", content: "интересно", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "interesante", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 9, fill: "white", content: "весело", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "divertido", opacity: 0.85, anchor: "middle" },
  ],

  // "Мне нравится музыка." / "Мне нравятся книги." — concordancia con lo que gusta.
  nravitsyaAgreement: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 9, fill: "white", content: "музыка", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 9, fill: "white", content: "нравится", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "accent" },
    { kind: "text", x: 119, y: 40, size: 9, fill: "white", content: "книги", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 9, fill: "white", content: "нравятся", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 78, size: 7.5, fill: "brandLight", content: "singular", anchor: "middle" },
    { kind: "text", x: 119, y: 78, size: 7.5, fill: "accentLight", content: "plural", anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "inkSoft", content: "el verbo concuerda con lo que gusta", anchor: "middle" },
  ],

  // "a mí me gusta" ↔ "мне нравится" — comparación estructural exacta con el español.
  spanishGustarCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "a mí me gusta", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 8.5, fill: "inkSoft", content: "la música", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8.5, fill: "white", content: "мне нравится", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 8.5, fill: "white", content: "музыка", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8.5, fill: "brandLight", content: "misma estructura exacta", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "objeto indirecto + verbo que concuerda con lo gustado", anchor: "middle" },
  ],

  // "нравиться" (dativo, concuerda con lo gustado) vs "любить" (acusativo, concuerda con la persona).
  nravitsyaVsLyubit: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 38, size: 9, fill: "white", content: "Мне нравится", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 52, size: 9, fill: "white", content: "музыка.", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "accentLight" },
    { kind: "text", x: 119, y: 38, size: 9, fill: "white", content: "Я люблю", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 52, size: 9, fill: "white", content: "музыку.", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 76, size: 7.5, fill: "brandLight", content: "dativo (yo no soy sujeto)", anchor: "middle" },
    { kind: "text", x: 119, y: 76, size: 7.5, fill: "accentLight", content: "acusativo (yo soy sujeto)", anchor: "middle" },
  ],

  // "Мне холодно." / "Мне весело." — adverbios de estado + dativo, sin verbo.
  impersonalStateWords: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 30, w: 128, h: 24, rx: 8, fill: "brand" },
    { kind: "text", x: 80, y: 47, size: 10.5, fill: "white", content: "Мне холодно.", bold: true, anchor: "middle" },
    { kind: "rect", x: 16, y: 60, w: 128, h: 24, rx: 8, fill: "accent" },
    { kind: "text", x: 80, y: 77, size: 10.5, fill: "white", content: "Мне весело.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "inkSoft", content: "dativo + adverbio, sin ningún verbo", anchor: "middle" },
  ],

  // "Мне не нравится..." — la negación con "не" antes del verbo.
  negationNravitsya: [
    { kind: "circle", cx: 70, cy: 58, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 66, cy: 54, r: 26, fill: "white" },
    { kind: "circle", cx: 66, cy: 54, r: 26, stroke: "accentLight", strokeWidth: 6 },
    { kind: "text", x: 66, y: 62, size: 20, fill: "brand", content: "не", bold: true, anchor: "middle" },
    { kind: "path", d: "M85 73 L104 92", stroke: "accentLight", strokeWidth: 7, round: true },
    { kind: "rect", x: 12, y: 92, w: 116, h: 22, rx: 8, fill: "muted" },
    { kind: "text", x: 70, y: 107, size: 8.5, fill: "inkSoft", content: "Мне не нравится музыка.", bold: true, anchor: "middle" },
  ],

  // "Тебе нравится музыка?" — "Да, мне очень нравится." — mini diálogo de gustos.
  feelingsDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 108, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M34 48 L28 60 L48 48 Z", fill: "brand" },
    { kind: "text", x: 68, y: 37, size: 11.5, fill: "white", content: "Тебе нравится музыка?", bold: true, anchor: "middle" },
    { kind: "rect", x: 24, y: 66, w: 122, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M126 66 L132 54 L112 66 Z", fill: "accentLight" },
    { kind: "text", x: 85, y: 87, size: 11, fill: "white", content: "Да, мне очень нравится.", bold: true, anchor: "middle" },
  ],

  // врач / учитель / инженер / повар — tarjetas de vocabulario de profesiones.
  professionsVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "врач", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "médico", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 9, fill: "white", content: "учитель", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "profesor", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 8.5, fill: "white", content: "инженер", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "ingeniero", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 10, fill: "white", content: "повар", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "cocinero", opacity: 0.85, anchor: "middle" },
  ],

  // врач → врачом / учитель → учителем — instrumental masculino, -ом / -ем.
  instrumentalMascEndings: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 11, fill: "inkSoft", content: "врач", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 10, fill: "white", content: "врачом", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-ом", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8.5, fill: "brandLight", content: "учитель → учителем (-ь suave)", bold: true, anchor: "middle" },
  ],

  // учительница → учительницей — instrumental femenino, -ой / -ей.
  instrumentalFemEndings: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 9, fill: "inkSoft", content: "учительница", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brandLight" },
    { kind: "text", x: 124, y: 60, size: 8.5, fill: "white", content: "учительницей", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 66, w: 32, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-ей", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8.5, fill: "brandLight", content: "медсестра → медсестрой (-ой)", bold: true, anchor: "middle" },
  ],

  // "Я врач" (nominativo) vs. "Я работаю врачом" (instrumental con 'работать').
  nominativeVsInstrumental: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 40, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 44, size: 9.5, fill: "inkSoft", content: "Я врач.", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 7.5, fill: "danger", content: "(nominativo)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 8.5, fill: "white", content: "Я работаю", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 52, size: 8.5, fill: "white", content: "врачом.", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 62, size: 7, fill: "accentLight", content: "(instrumental)", anchor: "middle" },
  ],

  // "Он был врачом." — con "быть" en pasado/futuro, la profesión siempre va en instrumental.
  bytPastInstrumental: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 34, w: 128, h: 26, rx: 8, fill: "brand" },
    { kind: "text", x: 80, y: 51, size: 11, fill: "white", content: "Он был врачом.", bold: true, anchor: "middle" },
    { kind: "rect", x: 16, y: 64, w: 128, h: 26, rx: 8, fill: "accent" },
    { kind: "text", x: 80, y: 81, size: 10.5, fill: "white", content: "Она будет врачом.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 8, fill: "danger", content: "быть (pasado/futuro) + profesión = siempre instrumental", bold: true, anchor: "middle" },
  ],

  // "trabajar de/como médico" — la preposición española frente al caso ruso.
  spanishComoDeCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "trabajar como", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 8.5, fill: "inkSoft", content: "médico", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8.5, fill: "white", content: "работать", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 8.5, fill: "white", content: "врачом", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "'como' (preposición) = terminación -ом/-ой", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "el ruso reemplaza la preposición por un caso", anchor: "middle" },
  ],

  // "Кем ты работаешь?" — "Я работаю врачом." — mini diálogo de profesiones.
  professionsDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 18, y: 16, w: 100, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M38 48 L32 60 L52 48 Z", fill: "brand" },
    { kind: "text", x: 68, y: 37, size: 12, fill: "white", content: "Кем ты работаешь?", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 66, w: 106, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M130 66 L136 54 L116 66 Z", fill: "accentLight" },
    { kind: "text", x: 93, y: 87, size: 11.5, fill: "white", content: "Я работаю врачом.", bold: true, anchor: "middle" },
  ],

  // друг / подруга / семья / коллега — vocabulario de personas para el instrumental "с".
  sVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "друг", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "amigo", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 9, fill: "white", content: "подруга", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "amiga", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 9.5, fill: "white", content: "семья", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "familia", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 9, fill: "white", content: "коллега", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "colega", opacity: 0.85, anchor: "middle" },
  ],

  // "с" + instrumental: друг → с другом — la preposición с siempre rige instrumental.
  sPrepositionRule: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 44, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 36, y: 64, size: 12, fill: "inkSoft", content: "с", bold: true, anchor: "middle" },
    { kind: "path", d: "M62 58 L80 58 M74 52 L80 58 L74 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 84, y: 34, w: 62, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 115, y: 60, size: 10.5, fill: "white", content: "другом", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 8.5, fill: "danger", content: "с + instrumental (nunca nominativo)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "друг → другом (compañía)", bold: true, anchor: "middle" },
  ],

  // я/ты/он/она/мы/вы/они → со мной/с тобой/с ним/с ней/с нами/с вами/с ними.
  instrumentalPronounsFull: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 42, y: 22, size: 8, fill: "inkSoft", content: "я → со мной", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 114, y: 22, size: 8, fill: "white", content: "ты → с тобой", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 32, w: 68, h: 20, rx: 6, fill: "brandLight" },
    { kind: "text", x: 42, y: 46, size: 8, fill: "white", content: "он → с ним", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 32, w: 68, h: 20, rx: 6, fill: "accentLight" },
    { kind: "text", x: 114, y: 46, size: 8, fill: "white", content: "она → с ней", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 56, w: 68, h: 20, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 70, size: 8, fill: "white", content: "мы → с нами", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 56, w: 68, h: 20, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 70, size: 8, fill: "white", content: "вы → с вами", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 80, w: 68, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 78, y: 94, size: 8, fill: "white", content: "они → с ними", bold: true, anchor: "middle" },
  ],

  // со мной (no *с мной) — la с se convierte en со delante de grupos consonánticos difíciles.
  sBecomesSoRule: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 20, w: 128, h: 30, rx: 10, fill: "muted" },
    { kind: "text", x: 80, y: 32, size: 9, fill: "danger", content: "✗ с мной", bold: true, anchor: "middle" },
    { kind: "path", d: "M50 34 L110 44", stroke: "danger", strokeWidth: 2.5 },
    { kind: "text", x: 80, y: 45, size: 7.5, fill: "inkSoft", content: "difícil de pronunciar", anchor: "middle" },
    { kind: "rect", x: 16, y: 62, w: 128, h: 34, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 84, size: 12, fill: "white", content: "✓ со мной", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 8, fill: "brandLight", content: "с → со solo antes de мной (excepción fija)", bold: true, anchor: "middle" },
  ],

  // "С кем ты идёшь?" — construcción de pregunta con кто en instrumental.
  withWhomQuestion: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 40, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 58, size: 12, fill: "white", content: "С кем ты идёшь?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 8, fill: "accentLight", content: "¿Con quién vas?", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 88, w: 80, h: 20, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 102, size: 8.5, fill: "white", content: "кто → кем (instrumental)", bold: true, anchor: "middle" },
  ],

  // говорить с / встречаться с / дружить с / играть с — verbos que rigen с + instrumental.
  socialVerbsCards: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 9, fill: "white", content: "говорить с", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "hablar con", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 8.5, fill: "white", content: "встречаться с", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "encontrarse con", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 9, fill: "white", content: "дружить с", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "ser amigo de", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 9, fill: "white", content: "играть с", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "jugar con", opacity: 0.85, anchor: "middle" },
  ],

  // conmigo/contigo (formas irregulares) vs. со мной/с тобой (regla regular predecible).
  spanishConCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 44, size: 9.5, fill: "inkSoft", content: "conmigo", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 7.5, fill: "danger", content: "(forma irregular)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 44, size: 9.5, fill: "white", content: "со мной", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 7, fill: "accentLight", content: "(с + instrumental)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español fusiona 'con' + mí en una palabra", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "el ruso solo cambia la terminación del pronombre", anchor: "middle" },
  ],

  // "Ты хочешь пойти со мной?" — "Да, с удовольствием!" — mini diálogo de compañía.
  withDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 120, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M34 48 L28 60 L48 48 Z", fill: "brand" },
    { kind: "text", x: 74, y: 37, size: 10.5, fill: "white", content: "Ты хочешь пойти со мной?", bold: true, anchor: "middle" },
    { kind: "rect", x: 30, y: 66, w: 116, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M136 66 L142 54 L122 66 Z", fill: "accentLight" },
    { kind: "text", x: 88, y: 87, size: 11, fill: "white", content: "Да, с удовольствием!", bold: true, anchor: "middle" },
  ],

  // официант / меню / счёт / заказать — vocabulario base del restaurante.
  restaurantVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 8.5, fill: "white", content: "официант", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "camarero", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "меню", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "menú", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "счёт", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "cuenta", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 8.5, fill: "white", content: "заказать", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "pedir", opacity: 0.85, anchor: "middle" },
  ],

  // "Я хочу заказать суп" — заказать rige acusativo, igual que otros verbos transitivos.
  zakazatAccusative: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 20, w: 132, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 39, size: 11, fill: "white", content: "Я хочу заказать суп.", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 58, w: 80, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 73, size: 8.5, fill: "white", content: "заказать + acusativo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "суп / салат / пиццу — objeto directo", bold: true, anchor: "middle" },
  ],

  // "Дайте, пожалуйста, счёт" / "Принесите, пожалуйста, меню" — imperativo cortés de servicio.
  politeImperativeRequests: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 36, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 30, size: 9.5, fill: "white", content: "Дайте, пожалуйста, счёт.", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 43, size: 7.5, fill: "accentLight", content: "Deme la cuenta, por favor.", anchor: "middle" },
    { kind: "rect", x: 8, y: 58, w: 136, h: 36, rx: 10, fill: "brandLight" },
    { kind: "text", x: 76, y: 74, size: 9.5, fill: "white", content: "Принесите, пожалуйста, меню.", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 87, size: 7.5, fill: "white", content: "Traiga el menú, por favor.", opacity: 0.85, anchor: "middle" },
  ],

  // "Что вы будете заказывать?" — "Я буду суп и салат, пожалуйста." — diálogo de restaurante.
  restaurantDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 128, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 74, y: 35, size: 9.5, fill: "white", content: "Что вы будете заказывать?", bold: true, anchor: "middle" },
    { kind: "rect", x: 22, y: 64, w: 124, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M134 64 L140 52 L120 64 Z", fill: "accentLight" },
    { kind: "text", x: 84, y: 85, size: 9.5, fill: "white", content: "Я буду суп и салат, пожалуйста.", bold: true, anchor: "middle" },
  ],

  // гостиница / номер / свободный / забронировать — vocabulario base del hotel.
  hotelVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 8, fill: "white", content: "гостиница", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "hotel", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "номер", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "habitación", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 8.5, fill: "white", content: "свободный", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "libre", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 8, fill: "white", content: "забронировать", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "reservar", opacity: 0.85, anchor: "middle" },
  ],

  // "У вас есть свободный номер?" — construcción у + genitivo + есть, aplicada a la recepción.
  uVasEstConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 52, size: 11, fill: "white", content: "У вас есть свободный номер?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 8, fill: "accentLight", content: "¿Tienen habitación libre?", anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 8, fill: "brandLight", content: "у + genitivo (вас) + есть — construcción de a1-17/21", bold: true, anchor: "middle" },
  ],

  // "забронировать на два дня" — на + acusativo para expresar duración.
  durationAccusative: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 9, fill: "inkSoft", content: "забронировать", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 54, size: 9, fill: "white", content: "на два", bold: true, anchor: "middle" },
    { kind: "text", x: 124, y: 66, size: 9, fill: "white", content: "дня", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "на + acusativo = duración (por dos días)", bold: true, anchor: "middle" },
  ],

  // "¿Podría traerme...?" (condicional cortés) vs. "Принесите, пожалуйста" (imperativo + пожалуйста).
  spanishServiceCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "inkSoft", content: "¿Podría traerme", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 55, size: 8, fill: "inkSoft", content: "el menú?", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "Принесите,", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 55, size: 8, fill: "white", content: "пожалуйста", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español suaviza con condicional; el ruso usa", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 8, fill: "brandLight", content: "imperativo directo + пожалуйста — no es descortés", bold: true, anchor: "middle" },
  ],

  // "У вас есть свободный номер?" — "Да, номер на втором этаже." — diálogo de recepción de hotel.
  hotelDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9.5, fill: "white", content: "У вас есть свободный номер?", bold: true, anchor: "middle" },
    { kind: "rect", x: 18, y: 64, w: 128, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M138 64 L144 52 L124 64 Z", fill: "accentLight" },
    { kind: "text", x: 82, y: 85, size: 9.5, fill: "white", content: "Да, номер на втором этаже.", bold: true, anchor: "middle" },
  ],

  // светофор / угол / дорога / остановка — vocabulario base de la calle.
  streetVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 8.5, fill: "white", content: "светофор", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "semáforo", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "угол", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "esquina", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 9.5, fill: "white", content: "дорога", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "calle", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 8, fill: "white", content: "остановка", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "parada", opacity: 0.85, anchor: "middle" },
  ],

  // "Скажите, пожалуйста, где метро?" — imperativo formal + пожалуйста para pedir información.
  politeDirectionsAsk: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 52, size: 10.5, fill: "white", content: "Скажите, пожалуйста, где метро?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 8, fill: "accentLight", content: "Diga, por favor, ¿dónde está el metro?", anchor: "middle" },
    { kind: "text", x: 80, y: 94, size: 8, fill: "brandLight", content: "también: Простите, где...? (Disculpe, ¿dónde...?)", bold: true, anchor: "middle" },
  ],

  // идите / поверните — tabla de imperativos direccionales (forma formal -те).
  turnImperativeTable: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 29, size: 9.5, fill: "white", content: "идите прямо", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 40, size: 7, fill: "accentLight", content: "vaya recto", anchor: "middle" },
    { kind: "rect", x: 8, y: 50, w: 136, h: 30, rx: 10, fill: "brandLight" },
    { kind: "text", x: 76, y: 65, size: 9.5, fill: "white", content: "поверните налево", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 76, size: 7, fill: "white", content: "gire a la izquierda", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 8, y: 86, w: 136, h: 26, rx: 10, fill: "accentLight" },
    { kind: "text", x: 76, y: 103, size: 8.5, fill: "white", content: "-те = forma cortés/formal (a1-9)", bold: true, anchor: "middle" },
  ],

  // "Перейдите через дорогу" — через + acusativo, nueva preposición de movimiento "a través de".
  throughAccusative: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 20, w: 132, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 39, size: 10.5, fill: "white", content: "Перейдите через дорогу.", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 58, w: 80, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 73, size: 8.5, fill: "white", content: "через + acusativo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "cruce la calle — 'a través de'", bold: true, anchor: "middle" },
  ],

  // "далеко от" / "близко от" + genitivo — distancia relativa a un punto de referencia.
  farNearFromGenitive: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 9, fill: "white", content: "далеко от", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 7, fill: "accentLight", content: "lejos de", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 44, size: 9, fill: "white", content: "близко от", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 7, fill: "white", content: "cerca de", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "от + genitivo (a1-23): далеко от метро", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "недалеко = no muy lejos", anchor: "middle" },
  ],

  // "у светофора" (у + genitivo) vs. "рядом с остановкой" (рядом с + instrumental) — dos formas de ubicar un punto de referencia.
  landmarkPrepositions: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 44, size: 9, fill: "inkSoft", content: "у светофора", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 7, fill: "danger", content: "(у + genitivo)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "рядом с", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 8, fill: "white", content: "остановкой", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 64, size: 6.5, fill: "accentLight", content: "(рядом с + instrumental)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "у = justo en el punto; рядом с = al lado de", bold: true, anchor: "middle" },
  ],

  // "первый поворот" / "второй поворот направо" — ordinales aplicados a giros en la calle.
  turnOrdinals: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 40, w: 60, h: 36, rx: 10, fill: "brand" },
    { kind: "text", x: 44, y: 62, size: 9, fill: "white", content: "первый", bold: true, anchor: "middle" },
    { kind: "text", x: 44, y: 73, size: 6.5, fill: "accentLight", content: "поворот", anchor: "middle" },
    { kind: "rect", x: 86, y: 40, w: 60, h: 36, rx: 10, fill: "brandLight" },
    { kind: "text", x: 116, y: 62, size: 9, fill: "white", content: "второй", bold: true, anchor: "middle" },
    { kind: "text", x: 116, y: 73, size: 6.5, fill: "white", content: "поворот", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 8, fill: "danger", content: "второй поворот направо (a1-20)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "= la segunda vuelta a la derecha", anchor: "middle" },
  ],

  // "doble a la derecha" (imperativo español) vs. "поверните направо" — comparación de cortesía y estructura.
  spanishDirectionsCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "inkSoft", content: "doble a la", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 55, size: 8, fill: "inkSoft", content: "derecha", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "поверните", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 55, size: 8, fill: "white", content: "направо", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "ambos idiomas usan imperativo formal para indicar", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "direcciones — misma estructura, distinto verbo", anchor: "middle" },
  ],

  // "Скажите, где банк?" — "Идите прямо, потом налево, у светофора." — mini diálogo callejero.
  directionsDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9.5, fill: "white", content: "Скажите, где банк?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 34, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 82, size: 8.5, fill: "white", content: "Идите прямо, потом налево,", bold: true, anchor: "middle" },
    { kind: "text", x: 79, y: 93, size: 8.5, fill: "white", content: "у светофора.", bold: true, anchor: "middle" },
  ],

  // аэропорт / рейс / регистрация / паспорт — vocabulario base del aeropuerto.
  airportVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 8, fill: "white", content: "аэропорт", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "aeropuerto", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "рейс", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "vuelo", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 8, fill: "white", content: "регистрация", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "check-in", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 9, fill: "white", content: "паспорт", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "pasaporte", opacity: 0.85, anchor: "middle" },
  ],

  // нужен / нужна / нужно / нужны — adjetivo corto que concuerda en género/número con lo necesitado.
  nuzhenAgreement: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 22, size: 8, fill: "white", content: "билет → нужен", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 20, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 22, size: 8, fill: "white", content: "виза → нужна", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 32, w: 68, h: 20, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 46, size: 7.5, fill: "white", content: "время → нужно", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 32, w: 68, h: 20, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 46, size: 7.5, fill: "white", content: "документы → нужны", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "нужен concuerda con lo necesitado, no con quien lo necesita", bold: true, anchor: "middle" },
  ],

  // "Мне нужен билет до Москвы" — dativo experimentador (a1-24) + нужен, desglose completo.
  nuzhenDativeConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 20, w: 136, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 78, y: 39, size: 10, fill: "white", content: "Мне нужен билет до Москвы.", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 58, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 43, y: 73, size: 7.5, fill: "white", content: "мне (dativo)", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 58, w: 58, h: 22, rx: 8, fill: "brandLight" },
    { kind: "text", x: 113, y: 73, size: 7, fill: "white", content: "нужен (nominativo)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "estructura igual a мне нравится (a1-25)", bold: true, anchor: "middle" },
  ],

  // "до Москвы" / "до аэропорта" — до + genitivo (destino/límite), casi 1:1 con el español "hasta".
  doGenitiveDestination: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 44, size: 9, fill: "inkSoft", content: "в аэропорт", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 7, fill: "danger", content: "(в + acusativo, destino)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 44, size: 9, fill: "white", content: "до Москвы", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 7, fill: "accentLight", content: "(до + genitivo, límite)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "до = 'hasta' — билет до Москвы = billete hasta Moscú", bold: true, anchor: "middle" },
  ],

  // "Спасибо за помощь" — за + acusativo, preposición de causa/motivo.
  zaAccusativeGratitude: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 20, w: 132, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 39, size: 11, fill: "white", content: "Спасибо за помощь!", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 58, w: 80, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 73, size: 8.5, fill: "white", content: "за + acusativo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "gracias por (motivo/causa)", bold: true, anchor: "middle" },
  ],

  // посадка / задержка / объявление / таможня / виза / граница — vocabulario del proceso de viaje.
  airportProcessVocab: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 24, size: 8, fill: "white", content: "посадка", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 33, size: 6.5, fill: "accentLight", content: "embarque", anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 24, size: 8, fill: "white", content: "задержка", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 33, size: 6.5, fill: "white", content: "retraso", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 8, y: 42, w: 68, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 42, y: 58, size: 8, fill: "white", content: "таможня", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 67, size: 6.5, fill: "white", content: "aduana", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 80, y: 42, w: 68, h: 30, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 58, size: 8, fill: "white", content: "виза", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 67, size: 6.5, fill: "white", content: "visa", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 44, y: 76, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 78, y: 92, size: 8, fill: "white", content: "граница", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 101, size: 6.5, fill: "accentLight", content: "frontera", anchor: "middle" },
  ],

  // "Necesito un billete" (sujeto español) vs. "Мне нужен билет" (dativo + adjetivo corto ruso).
  spanishNecesitoCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "Necesito un", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 8.5, fill: "inkSoft", content: "billete", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8.5, fill: "white", content: "Мне нужен", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 8.5, fill: "white", content: "билет", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español conjuga por sujeto ('yo necesito');", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "el ruso pone al experimentador en dativo, como мне нравится", anchor: "middle" },
  ],

  // Insignia de finalización del nivel A1 — próximo paso: el examen final.
  courseCompletionBadge: [
    { kind: "circle", cx: 80, cy: 60, r: 52, fill: "brand", opacity: 0.08 },
    { kind: "circle", cx: 80, cy: 56, r: 34, fill: "brand" },
    { kind: "path", d: "M64 56 L76 68 L98 44", stroke: "white", strokeWidth: 6, round: true },
    { kind: "text", x: 80, y: 100, size: 10, fill: "brandLight", content: "¡Nivel A1 completo!", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 114, size: 7.5, fill: "inkSoft", content: "Siguiente paso: el examen final A1", anchor: "middle" },
  ],

  // "Где регистрация на рейс?" — "Вот ваш билет и посадочный талон." — diálogo de check-in.
  airportDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9.5, fill: "white", content: "Где регистрация на рейс?", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 64, w: 132, h: 34, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 80, y: 82, size: 8.5, fill: "white", content: "Вот ваш билет и посадочный", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 93, size: 8.5, fill: "white", content: "талон. Счастливого пути!", bold: true, anchor: "middle" },
  ],

  // Proceso (barra continua) vs. resultado (marca de check) — la idea central del aspecto verbal.
  aspectConceptCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "rect", x: 18, y: 46, w: 46, h: 8, rx: 4, fill: "inkSoft" },
    { kind: "text", x: 41, y: 62, size: 8, fill: "inkSoft", content: "imperfectivo", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 34, size: 7, fill: "danger", content: "proceso", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "path", d: "M104 46 L116 58 L136 36", stroke: "white", strokeWidth: 5, round: true },
    { kind: "text", x: 119, y: 62, size: 8, fill: "white", content: "perfectivo", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 34, size: 7, fill: "accentLight", content: "resultado", anchor: "middle" },
  ],

  // делать → сделать / писать → написать — formación del perfectivo añadiendo un prefijo.
  aspectPrefixFormation: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 10, fill: "inkSoft", content: "делать", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 9, fill: "white", content: "сделать", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 66, w: 40, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "prefijo с-", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "no hay una regla única — cada par se aprende aparte", bold: true, anchor: "middle" },
  ],

  // Tabla de 6 pares aspectuales comunes de la lección.
  aspectPairsTableA2: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 18, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 21, size: 7.5, fill: "white", content: "читать/прочитать", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 18, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 21, size: 7.5, fill: "white", content: "писать/написать", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 30, w: 68, h: 18, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 43, size: 7.5, fill: "white", content: "делать/сделать", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 30, w: 68, h: 18, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 43, size: 7, fill: "white", content: "говорить/сказать", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 52, w: 68, h: 18, rx: 6, fill: "ink" },
    { kind: "text", x: 42, y: 65, size: 6.5, fill: "white", content: "смотреть/посмотреть", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 52, w: 68, h: 18, rx: 6, fill: "accentLight" },
    { kind: "text", x: 114, y: 65, size: 7.5, fill: "white", content: "учить/выучить", bold: true, anchor: "middle" },
  ],

  // "весь вечер читал" (proceso, imperfectivo) vs. "прочитал" (resultado, perfectivo) en pasado.
  aspectPastMeaning: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "inkSoft", content: "весь вечер", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 8, fill: "inkSoft", content: "читал", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 48, size: 9, fill: "white", content: "прочитал", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "proceso/hábito (imperf.) vs. acción terminada (perf.)", bold: true, anchor: "middle" },
  ],

  // "я буду читать" (futuro imperfectivo, auxiliar) vs. "я прочитаю" (futuro perfectivo, conjugación directa).
  aspectFutureConjugation: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 34, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 32, size: 10, fill: "white", content: "я буду читать", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 44, size: 7, fill: "accentLight", content: "быть + infinitivo imperfectivo", anchor: "middle" },
    { kind: "rect", x: 8, y: 58, w: 136, h: 34, rx: 10, fill: "brandLight" },
    { kind: "text", x: 76, y: 76, size: 10, fill: "white", content: "я прочитаю", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 88, size: 7, fill: "white", content: "conjugación directa del perfectivo", opacity: 0.85, anchor: "middle" },
  ],

  // "¿proceso o resultado?" — prueba mental para elegir entre imperfectivo y perfectivo.
  aspectQuestionTest: [
    { kind: "circle", cx: 80, cy: 46, r: 32, fill: "brand" },
    { kind: "text", x: 80, y: 42, size: 9, fill: "white", content: "¿proceso o", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 9, fill: "white", content: "resultado?", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 92, w: 62, h: 26, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 108, size: 7.5, fill: "inkSoft", content: "proceso → imperf.", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 92, w: 62, h: 26, rx: 10, fill: "accentLight" },
    { kind: "text", x: 119, y: 108, size: 7.5, fill: "white", content: "resultado → perf.", bold: true, anchor: "middle" },
    { kind: "path", d: "M60 74 L41 92", stroke: "brand", strokeWidth: 2.5 },
    { kind: "path", d: "M100 74 L119 92", stroke: "brand", strokeWidth: 2.5 },
  ],

  // Pretérito imperfecto/indefinido (español) vs. aspecto imperfectivo/perfectivo (ruso) — paralelo parcial, no exacto.
  spanishAspectCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "inkSoft", content: "leía / leí", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 7, fill: "danger", content: "(imperfecto/indefinido)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "читал / прочитал", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 7, fill: "accentLight", content: "(imperfectivo/perfectivo)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "parecido en el pasado, pero el ruso lo aplica también", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "al futuro — el español no distingue aspecto ahí", anchor: "middle" },
  ],

  // "Ты прочитал книгу?" — "Нет, я ещё читаю." — mini diálogo de aspecto verbal.
  aspectDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 120, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M34 48 L28 60 L48 48 Z", fill: "brand" },
    { kind: "text", x: 74, y: 37, size: 10.5, fill: "white", content: "Ты прочитал книгу?", bold: true, anchor: "middle" },
    { kind: "rect", x: 30, y: 66, w: 116, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M136 66 L142 54 L122 66 Z", fill: "accentLight" },
    { kind: "text", x: 88, y: 87, size: 10, fill: "white", content: "Нет, я ещё читаю.", bold: true, anchor: "middle" },
  ],

  // был / была / было / были — tabla completa de concordancia de género/número del pasado de быть.
  pastGenderAgreementFullTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 8.5, fill: "white", content: "он был", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 8.5, fill: "white", content: "она была", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 8.5, fill: "white", content: "оно было", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 8.5, fill: "white", content: "они были", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "concuerda con género/número, no con persona", bold: true, anchor: "middle" },
  ],

  // "Вчера не было хлеба" — не было es invariable, sin importar el género/número del sustantivo negado.
  neBiloImpersonalNegation: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 20, w: 128, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 39, size: 10.5, fill: "white", content: "Вчера не было хлеба.", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 58, w: 80, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 73, size: 8, fill: "white", content: "не было (invariable)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 7.5, fill: "brandLight", content: "хлеб en genitivo (a1-21) — nunca 'не был/не была'", anchor: "middle" },
  ],

  // "буду читать" (futuro imperfectivo, proceso) vs. "прочитаю" (futuro perfectivo, resultado) — repaso a2-1.
  futureAspectRecap: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 44, size: 9, fill: "inkSoft", content: "буду читать", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 7, fill: "danger", content: "(proceso, imperf.)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 44, size: 9, fill: "white", content: "прочитаю", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 7, fill: "accentLight", content: "(resultado, perf.)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el mismo aspecto de a2-1 también se aplica al futuro", bold: true, anchor: "middle" },
  ],

  // вчера / позавчера / потом / скоро / сразу / наконец — vocabulario ampliado de secuencia temporal.
  sequencingAdverbsGrid: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 8.5, fill: "white", content: "потом", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 8.5, fill: "white", content: "скоро", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 8.5, fill: "white", content: "сразу", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 8, fill: "white", content: "наконец", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "conectores para narrar una secuencia de eventos", bold: true, anchor: "middle" },
  ],

  // "На прошлой неделе... Вчера... Завтра..." — encadenar varios tiempos en una narración.
  narratingSequence: [
    { kind: "rect", x: 8, y: 10, w: 136, h: 20, rx: 8, fill: "brand" },
    { kind: "text", x: 76, y: 24, size: 8, fill: "white", content: "На прошлой неделе я был в городе.", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 36, w: 136, h: 20, rx: 8, fill: "brandLight" },
    { kind: "text", x: 76, y: 50, size: 8, fill: "white", content: "Вчера я работал дома.", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 62, w: 136, h: 20, rx: 8, fill: "accentLight" },
    { kind: "text", x: 76, y: 76, size: 8, fill: "white", content: "Завтра я буду работать в городе.", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 96, size: 7.5, fill: "inkSoft", content: "una narración fluida combina pasado y futuro", anchor: "middle" },
  ],

  // быть cubre "ser" Y "estar"; se omite en presente pero reaparece en pasado/futuro — contraste con el español.
  spanishSerEstarCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "es / está", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 7, fill: "danger", content: "(dos verbos)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8.5, fill: "white", content: "(él) — / был", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 7, fill: "accentLight", content: "(быть, un solo verbo)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "быть cubre 'ser' y 'estar' a la vez, y se omite en", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "presente — pero reaparece siempre en pasado/futuro", anchor: "middle" },
  ],

  // буду / будешь / будет / будем / будете / будут — conjugación completa de быть en futuro.
  bytFullConjugationTable: [
    { kind: "rect", x: 6, y: 8, w: 45, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 28, y: 22, size: 7.5, fill: "white", content: "буду", bold: true, anchor: "middle" },
    { kind: "rect", x: 55, y: 8, w: 45, h: 20, rx: 6, fill: "brandLight" },
    { kind: "text", x: 77, y: 22, size: 7.5, fill: "white", content: "будешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 8, w: 45, h: 20, rx: 6, fill: "accentLight" },
    { kind: "text", x: 126, y: 22, size: 7.5, fill: "white", content: "будет", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 32, w: 45, h: 20, rx: 6, fill: "accentLight" },
    { kind: "text", x: 28, y: 46, size: 7.5, fill: "white", content: "будем", bold: true, anchor: "middle" },
    { kind: "rect", x: 55, y: 32, w: 45, h: 20, rx: 6, fill: "brandLight" },
    { kind: "text", x: 77, y: 46, size: 7, fill: "white", content: "будете", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 32, w: 45, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 126, y: 46, size: 7.5, fill: "white", content: "будут", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 66, size: 8, fill: "danger", content: "+ infinitivo imperfectivo = futuro imperfectivo", bold: true, anchor: "middle" },
  ],

  // "Что ты будешь делать завтра?" — "Не знаю, но вчера я был очень занят." — diálogo pasado/futuro.
  pastFutureDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9.5, fill: "white", content: "Что ты будешь делать завтра?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 34, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 82, size: 8.5, fill: "white", content: "Не знаю, но вчера я был", bold: true, anchor: "middle" },
    { kind: "text", x: 79, y: 93, size: 8.5, fill: "white", content: "очень занят.", bold: true, anchor: "middle" },
  ],

  // Árbol de decisión: ¿posesión/negación/número/preposición? → genitivo. ¿objeto directo? → acusativo.
  genAccDecisionTree: [
    { kind: "circle", cx: 80, cy: 30, r: 26, fill: "brand" },
    { kind: "text", x: 80, y: 27, size: 8, fill: "white", content: "¿Qué función", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 37, size: 8, fill: "white", content: "cumple?", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 70, w: 68, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 40, y: 86, size: 7.5, fill: "inkSoft", content: "posesión / negación /", anchor: "middle" },
    { kind: "text", x: 40, y: 96, size: 7.5, fill: "inkSoft", content: "número / preposición", anchor: "middle" },
    { kind: "text", x: 40, y: 108, size: 8, fill: "danger", content: "→ genitivo", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 70, w: 68, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 116, y: 90, size: 7.5, fill: "white", content: "objeto directo", anchor: "middle" },
    { kind: "text", x: 116, y: 108, size: 8, fill: "accentLight", content: "→ acusativo", bold: true, anchor: "middle" },
  ],

  // книга (nominativo) / книги (genitivo) / книгу (acusativo) — mismo sustantivo, tres casos.
  genAccVocabGridBook: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 34, rx: 8, fill: "muted" },
    { kind: "text", x: 30, y: 22, size: 8, fill: "inkSoft", content: "книга", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 34, size: 6.5, fill: "inkSoft", content: "nominativo", anchor: "middle" },
    { kind: "rect", x: 58, y: 8, w: 44, h: 34, rx: 8, fill: "brand" },
    { kind: "text", x: 80, y: 22, size: 8, fill: "white", content: "книги", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 34, size: 6.5, fill: "accentLight", content: "genitivo", anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 44, h: 34, rx: 8, fill: "brandLight" },
    { kind: "text", x: 130, y: 22, size: 8, fill: "white", content: "книгу", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 34, size: 6.5, fill: "white", content: "acusativo", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 8, fill: "danger", content: "el mismo sustantivo cambia según su función", bold: true, anchor: "middle" },
  ],

  // "Я вижу брата" (acusativo = genitivo, masc. animado) vs. "Я вижу сестру" (acusativo regular, fem.).
  animateAccusativeDeepDive: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 9, fill: "white", content: "вижу брата", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6.5, fill: "accentLight", content: "(acus. = genitivo)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 44, size: 9, fill: "inkSoft", content: "вижу сестру", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6.5, fill: "inkSoft", content: "(acusativo regular)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "solo los masculinos animados copian el genitivo;", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "los femeninos siguen la regla normal -а → -у", anchor: "middle" },
  ],

  // "Veo a mi hermano" ('a' personal) vs. "Я вижу брата" (acusativo animado) — paralelo parcial.
  spanishPersonalACompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "inkSoft", content: "Veo a mi", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 8, fill: "inkSoft", content: "hermano", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8.5, fill: "white", content: "Я вижу", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 8.5, fill: "white", content: "брата", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "ambos idiomas marcan especialmente el objeto humano:", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "el español con la preposición 'a', el ruso con el caso", anchor: "middle" },
  ],

  // без / из / до / у — repaso de preposiciones que rigen genitivo.
  genitivePrepositionsRecap: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 8.5, fill: "white", content: "без — sin", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 8.5, fill: "white", content: "из — de/desde", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 8.5, fill: "white", content: "до — hasta", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 8.5, fill: "white", content: "у — cerca de", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "todas rigen genitivo, sin excepción", bold: true, anchor: "middle" },
  ],

  // "У меня нет книги, но я вижу книгу" — genitivo (negación) y acusativo (objeto directo) en la misma frase.
  sameSentenceBothCases: [
    { kind: "rect", x: 8, y: 20, w: 136, h: 26, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 37, size: 9, fill: "white", content: "У меня нет книги,", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 52, w: 136, h: 26, rx: 10, fill: "accentLight" },
    { kind: "text", x: 76, y: 69, size: 9, fill: "white", content: "но я вижу книгу.", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 92, size: 7.5, fill: "brandLight", content: "нет + genitivo (книги) — вижу + acusativo (книгу)", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 104, size: 7, fill: "inkSoft", content: "misma palabra, dos casos distintos en una sola frase", anchor: "middle" },
  ],

  // 2-4 + genitivo singular / 5+ + genitivo plural — repaso de la concordancia numeral (a1-22).
  numeralsGenitiveRecap: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 32, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 30, size: 9, fill: "white", content: "две книги / пять книг", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 42, size: 7, fill: "accentLight", content: "genitivo singular / genitivo plural", anchor: "middle" },
    { kind: "text", x: 76, y: 70, size: 8, fill: "brandLight", content: "el genitivo también aparece tras cualquier numeral", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 84, size: 7.5, fill: "inkSoft", content: "mayor que uno (a1-22) — no solo con нет/без/из", anchor: "middle" },
  ],

  // "Что ты видишь на столе?" — "Я вижу книгу без обложки." — mini diálogo combinando genitivo y acusativo.
  casesDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9.5, fill: "white", content: "Что ты видишь на столе?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 34, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 86, size: 8.5, fill: "white", content: "Я вижу книгу без обложки.", bold: true, anchor: "middle" },
  ],

  // зима / весна / лето / осень — vocabulario de las cuatro estaciones.
  seasonsVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 10, fill: "white", content: "зима", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "invierno", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 10, fill: "white", content: "весна", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "primavera", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 10, fill: "white", content: "лето", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "verano", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 10, fill: "white", content: "осень", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "otoño", opacity: 0.85, anchor: "middle" },
  ],

  // "На улице холодно" — construcción impersonal: sin verbo, solo adverbio predicativo.
  impersonalWeatherConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 12, fill: "white", content: "На улице холодно.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 8, fill: "accentLight", content: "Hace frío afuera.", anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 8, fill: "brandLight", content: "sin verbo — solo adverbio predicativo (холодно)", bold: true, anchor: "middle" },
  ],

  // "hace frío" (verbo impersonal español) vs. "холодно" (adverbio predicativo ruso, sin verbo).
  spanishHacerCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 9, fill: "inkSoft", content: "Hace frío.", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(verbo 'hacer')", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 9, fill: "white", content: "Холодно.", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(sin verbo)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español necesita un verbo impersonal ('hacer');", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "el ruso solo usa el adverbio, sin ningún verbo", anchor: "middle" },
  ],

  // "снег идёт" / "дождь идёт" — идти (ir a pie) reutilizado para fenómenos meteorológicos.
  weatherVerbsIdti: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 34, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 32, size: 11, fill: "white", content: "Идёт снег.", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 44, size: 7, fill: "accentLight", content: "Nieva (lit. 'la nieve va/camina').", anchor: "middle" },
    { kind: "rect", x: 8, y: 58, w: 136, h: 34, rx: 10, fill: "brandLight" },
    { kind: "text", x: 76, y: 76, size: 11, fill: "white", content: "Идёт дождь.", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 88, size: 7, fill: "white", content: "Llueve (lit. 'la lluvia va/camina').", opacity: 0.85, anchor: "middle" },
  ],

  // зимой / весной / летом / осенью — en realidad son formas de caso instrumental (a1-26/27).
  seasonsInstrumentalReveal: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 10, fill: "inkSoft", content: "зима", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 9, fill: "white", content: "зимой", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 8, fill: "danger", content: "¡sorpresa! ya sabes este caso desde a1-26/27", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "зима → зимой = terminación instrumental -ой", bold: true, anchor: "middle" },
  ],

  // температура / градус / облачно / ветрено / гроза / сухо — vocabulario ampliado de clima.
  weatherVocabExpanded: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 24, size: 7.5, fill: "white", content: "температура", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 33, size: 6, fill: "accentLight", content: "temperatura", anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 24, size: 8, fill: "white", content: "градус", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 33, size: 6.5, fill: "white", content: "grado", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 8, y: 42, w: 68, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 42, y: 58, size: 7.5, fill: "white", content: "облачно", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 67, size: 6.5, fill: "white", content: "nublado", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 80, y: 42, w: 68, h: 30, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 58, size: 7.5, fill: "white", content: "ветрено", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 67, size: 6.5, fill: "white", content: "con viento", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 44, y: 76, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 78, y: 92, size: 8, fill: "white", content: "гроза", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 101, size: 6.5, fill: "accentLight", content: "tormenta", anchor: "middle" },
  ],

  // холодно → холоднее / тепло → теплее / жарко → жарче — grado comparativo de adverbios de clima.
  weatherComparatives: [
    { kind: "rect", x: 8, y: 10, w: 136, h: 22, rx: 8, fill: "brand" },
    { kind: "text", x: 76, y: 25, size: 9, fill: "white", content: "холодно → холоднее", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 38, w: 136, h: 22, rx: 8, fill: "brandLight" },
    { kind: "text", x: 76, y: 53, size: 9, fill: "white", content: "тепло → теплее", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 66, w: 136, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 76, y: 81, size: 9, fill: "white", content: "жарко → жарче (irregular)", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 100, size: 7.5, fill: "inkSoft", content: "comparativo simple, sin 'más' — una sola palabra", anchor: "middle" },
  ],

  // "Какая сегодня погода?" — "Холодно, идёт снег." — mini diálogo sobre el clima.
  weatherDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 120, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M34 48 L28 60 L48 48 Z", fill: "brand" },
    { kind: "text", x: 74, y: 37, size: 10.5, fill: "white", content: "Какая сегодня погода?", bold: true, anchor: "middle" },
    { kind: "rect", x: 30, y: 66, w: 116, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M136 66 L142 54 L122 66 Z", fill: "accentLight" },
    { kind: "text", x: 88, y: 87, size: 10, fill: "white", content: "Холодно, идёт снег.", bold: true, anchor: "middle" },
  ],

  // "Я иду" (a pie) vs. "Я еду" (en vehículo) — repaso de a1-12.
  idtiVsEkhatRecap: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 9, fill: "inkSoft", content: "Я иду", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(a pie)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 9, fill: "white", content: "Я еду", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(en vehículo)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el ruso distingue el medio de desplazamiento (a1-12)", bold: true, anchor: "middle" },
  ],

  // поехать / приехать / уехать — un solo verbo raíz (ехать) con tres prefijos distintos.
  motionVerbPrefixTable: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 24, rx: 8, fill: "brand" },
    { kind: "text", x: 76, y: 30, size: 9.5, fill: "white", content: "по + ехать = поехать", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 42, w: 136, h: 24, rx: 8, fill: "brandLight" },
    { kind: "text", x: 76, y: 58, size: 9.5, fill: "white", content: "при + ехать = приехать", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 70, w: 136, h: 24, rx: 8, fill: "accentLight" },
    { kind: "text", x: 76, y: 86, size: 9.5, fill: "white", content: "у + ехать = уехать", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 104, size: 7.5, fill: "inkSoft", content: "una sola raíz, tres prefijos con significados distintos", anchor: "middle" },
  ],

  // по- (inicio del movimiento) / при- (llegada) / у- (partida) — desglose del significado de cada prefijo.
  prefixMeaningBreakdown: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 24, size: 8, fill: "white", content: "по-", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 33, size: 6.5, fill: "accentLight", content: "ponerse en camino", anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 24, size: 8, fill: "white", content: "при-", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 33, size: 6.5, fill: "white", content: "llegar", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 44, y: 42, w: 68, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 78, y: 58, size: 8, fill: "white", content: "у-", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 67, size: 6.5, fill: "white", content: "partir, irse", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 78, y: 90, size: 7.5, fill: "danger", content: "estos mismos prefijos funcionan con идти también", anchor: "middle" },
  ],

  // "llegar" / "irse" / "partir" (verbos distintos) vs. при-/у-/по- + ехать (una sola raíz).
  spanishMotionVerbsCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "inkSoft", content: "llegar / irse /", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 8, fill: "inkSoft", content: "partir", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "при-/у-/по-", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 8, fill: "white", content: "+ ехать", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español usa tres verbos sin relación entre sí;", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "el ruso deriva los tres de una sola raíz con prefijos", anchor: "middle" },
  ],

  // "Когда отправляется поезд?" / "Во сколько прибывает самолёт?" — vocabulario de horarios.
  scheduleVocabConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 20, w: 136, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 78, y: 39, size: 9.5, fill: "white", content: "Когда отправляется поезд?", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 56, w: 136, h: 30, rx: 10, fill: "brandLight" },
    { kind: "text", x: 78, y: 75, size: 9, fill: "white", content: "Во сколько прибывает самолёт?", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 100, size: 7.5, fill: "brandLight", content: "отправляться (salir) / прибывать (llegar) — horarios", bold: true, anchor: "middle" },
  ],

  // "Один билет до Москвы, пожалуйста" / "туда и обратно" / "в один конец" — frases para comprar billetes.
  ticketBuyingPhrases: [
    { kind: "rect", x: 8, y: 10, w: 136, h: 26, rx: 8, fill: "brand" },
    { kind: "text", x: 76, y: 27, size: 8.5, fill: "white", content: "Один билет до Москвы,", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 40, w: 136, h: 24, rx: 8, fill: "brandLight" },
    { kind: "text", x: 76, y: 56, size: 8.5, fill: "white", content: "туда и обратно", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 66, size: 6.5, fill: "white", content: "ida y vuelta", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 8, y: 70, w: 136, h: 24, rx: 8, fill: "accentLight" },
    { kind: "text", x: 76, y: 86, size: 8.5, fill: "white", content: "в один конец", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 96, size: 6.5, fill: "white", content: "solo ida", opacity: 0.85, anchor: "middle" },
  ],

  // вокзал / платформа / расписание / путешествие — vocabulario ampliado de viajes.
  transportVocabExpanded: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 24, size: 8, fill: "white", content: "вокзал", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 33, size: 6.5, fill: "accentLight", content: "estación de tren", anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 24, size: 8, fill: "white", content: "платформа", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 33, size: 6.5, fill: "white", content: "andén", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 8, y: 42, w: 68, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 42, y: 58, size: 8, fill: "white", content: "расписание", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 67, size: 6.5, fill: "white", content: "horario", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 80, y: 42, w: 68, h: 30, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 58, size: 7.5, fill: "white", content: "путешествие", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 67, size: 6.5, fill: "white", content: "viaje", opacity: 0.85, anchor: "middle" },
  ],

  // "Когда отправляется поезд?" — "В десять утра, с третьей платформы." — mini diálogo de viaje.
  travelDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9.5, fill: "white", content: "Когда отправляется поезд?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 34, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 82, size: 8.5, fill: "white", content: "В десять утра, с третьей", bold: true, anchor: "middle" },
    { kind: "text", x: 79, y: 93, size: 8.5, fill: "white", content: "платформы.", bold: true, anchor: "middle" },
  ],

  // кухня / спальня / ванная / гостиная — vocabulario básico de las habitaciones de la casa.
  houseRoomsVocabGrid: [
    { kind: "rect", x: 14, y: 14, w: 64, h: 38, rx: 8, fill: "brand" },
    { kind: "text", x: 46, y: 32, size: 9, fill: "white", content: "кухня", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 44, size: 7, fill: "white", content: "cocina", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 64, h: 38, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 32, size: 8.5, fill: "white", content: "спальня", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 7, fill: "white", content: "dormitorio", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 64, h: 38, rx: 8, fill: "accentLight" },
    { kind: "text", x: 46, y: 76, size: 9, fill: "white", content: "ванная", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 88, size: 7, fill: "white", content: "baño", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 82, y: 58, w: 64, h: 38, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 76, size: 8.5, fill: "white", content: "гостиная", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 88, size: 7, fill: "white", content: "sala", opacity: 0.85, anchor: "middle" },
  ],

  // балкон / лестница / подъезд / двор — vocabulario ampliado de la vivienda y el edificio.
  moreRoomsVocabGrid: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 24, size: 8.5, fill: "white", content: "балкон", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 33, size: 6.5, fill: "accentLight", content: "balcón", anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 24, size: 8, fill: "white", content: "лестница", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 33, size: 6.5, fill: "white", content: "escalera", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 8, y: 42, w: 68, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 42, y: 58, size: 8, fill: "white", content: "подъезд", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 67, size: 6.5, fill: "white", content: "portal/entrada", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 80, y: 42, w: 68, h: 30, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 58, size: 9, fill: "white", content: "двор", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 67, size: 6.5, fill: "white", content: "patio", opacity: 0.85, anchor: "middle" },
  ],

  // кровать / диван / шкаф / холодильник — vocabulario de muebles.
  furnitureVocabGrid: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 24, size: 8, fill: "white", content: "кровать", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 33, size: 6.5, fill: "accentLight", content: "cama", anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 24, size: 9, fill: "white", content: "диван", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 33, size: 6.5, fill: "white", content: "sofá", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 8, y: 42, w: 68, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 42, y: 58, size: 9, fill: "white", content: "шкаф", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 67, size: 6.5, fill: "white", content: "armario", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 80, y: 42, w: 68, h: 30, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 58, size: 7.5, fill: "white", content: "холодильник", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 67, size: 6.5, fill: "white", content: "refrigerador", opacity: 0.85, anchor: "middle" },
  ],

  // "в доме" (dentro, espacio cerrado) vs. "на улице" (superficie/espacio abierto) — regla de en/na aplicada a la casa.
  vNaHouseDistinction: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 9.5, fill: "white", content: "в доме", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6.5, fill: "accentLight", content: "(espacio cerrado)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 44, size: 9.5, fill: "white", content: "на улице", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6.5, fill: "white", content: "(espacio abierto)", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "la elección в/на se memoriza por palabra (a1-11),", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "no es traducible literalmente desde el español", anchor: "middle" },
  ],

  // "Я живу на улице Пушкина, дом 5, квартира 12" — construcción completa de una dirección.
  addressConstruction: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 24, rx: 8, fill: "brand" },
    { kind: "text", x: 76, y: 30, size: 8.5, fill: "white", content: "на улице Пушкина", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 42, w: 68, h: 24, rx: 8, fill: "brandLight" },
    { kind: "text", x: 42, y: 58, size: 8, fill: "white", content: "дом 5", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 42, w: 64, h: 24, rx: 8, fill: "accentLight" },
    { kind: "text", x: 112, y: 58, size: 8, fill: "white", content: "квартира 12", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 84, size: 7.5, fill: "inkSoft", content: "calle (prepositivo) + número de casa + número de piso", anchor: "middle" },
  ],

  // "рядом с домом" (instrumental) vs. "около дома" (genitivo) — dos formas de decir "cerca de".
  nearbyPrepositionsCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 8.5, fill: "white", content: "рядом с домом", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6.5, fill: "accentLight", content: "(+ instrumental)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 44, size: 9, fill: "white", content: "около дома", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6.5, fill: "white", content: "(+ genitivo)", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "dos preposiciones, un solo significado en español", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "('cerca de'), pero cada una rige un caso distinto", anchor: "middle" },
  ],

  // El español usa "en" para ambos; el ruso separa siempre в (dentro) y на (superficie).
  spanishEnCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 9, fill: "inkSoft", content: "en la casa /", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 9, fill: "inkSoft", content: "en la calle", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 9, fill: "white", content: "в доме /", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 9, fill: "white", content: "на улице", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español usa 'en' para ambos casos; el ruso siempre", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "distingue в (dentro) de на (superficie/evento)", anchor: "middle" },
  ],

  // "Где ты живёшь?" — "Я живу рядом с парком, на третьем этаже." — mini diálogo sobre la vivienda.
  houseDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 120, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M34 48 L28 60 L48 48 Z", fill: "brand" },
    { kind: "text", x: 74, y: 37, size: 10.5, fill: "white", content: "Где ты живёшь?", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 66, w: 136, h: 34, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M146 66 L152 54 L132 66 Z", fill: "accentLight" },
    { kind: "text", x: 78, y: 84, size: 8.5, fill: "white", content: "Я живу рядом с парком,", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 95, size: 8.5, fill: "white", content: "на третьем этаже.", bold: true, anchor: "middle" },
  ],

  // интересный → интереснее — formación regular del comparativo con el sufijo -ее.
  comparativeSuffixFormation: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 9, fill: "inkSoft", content: "интересный", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 8.5, fill: "white", content: "интереснее", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 66, w: 36, h: 14, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 76, size: 8, fill: "white", content: "-ее", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "forma predicativa, invariable (no concuerda)", bold: true, anchor: "middle" },
  ],

  // "более интересная книга" — forma compuesta del comparativo, usada de manera atributiva.
  compoundComparativeMore: [
    { kind: "rect", x: 8, y: 20, w: 136, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 39, size: 9.5, fill: "white", content: "более интересная книга", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 58, size: 8, fill: "danger", content: "más + adjetivo concordado (atributivo, ante el sustantivo)", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 78, size: 7.5, fill: "inkSoft", content: "vs. 'Эта книга интереснее' (predicativo, invariable)", anchor: "middle" },
  ],

  // хороший → лучше / плохой → хуже / большой → больше / маленький → меньше — comparativos irregulares.
  irregularComparativesTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 8, fill: "white", content: "хороший → лучше", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 8, fill: "white", content: "плохой → хуже", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7.5, fill: "white", content: "большой → больше", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 7, fill: "white", content: "маленький → меньше", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "igual que 'bueno → mejor' en español: no siguen la regla", bold: true, anchor: "middle" },
  ],

  // самый интересный — superlativo: самый + adjetivo en su forma completa (concuerda en género/número).
  superlativeSamyi: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 11.5, fill: "white", content: "самый интересный", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 8, fill: "accentLight", content: "el más interesante", anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 8, fill: "brandLight", content: "самая / самое / самые — concuerda en género/número", bold: true, anchor: "middle" },
  ],

  // "интереснее, чем английский" (чем + nominativo) vs. "старше меня" (genitivo, sin чем).
  chemVsGenitiveCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "white", content: "интереснее,", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 55, size: 8, fill: "white", content: "чем английский", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 42, size: 9, fill: "white", content: "старше меня", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "white", content: "(genitivo, sin чем)", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "dos formas de comparar: чем + nominativo, o", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "directamente genitivo sin чем — mismo significado", anchor: "middle" },
  ],

  // Я думаю, что... / По-моему... / Мне кажется... / На мой взгляд... — frases para dar una opinión.
  opinionPhrasesGrid: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7.5, fill: "white", content: "Я думаю, что...", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 8, fill: "white", content: "По-моему...", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7.5, fill: "white", content: "Мне кажется...", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 7, fill: "white", content: "На мой взгляд...", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "cuatro formas de introducir una opinión personal", bold: true, anchor: "middle" },
  ],

  // Español: un solo sistema "más...que"; ruso: sufijo -ee, compuesto "более", y comparativo por genitivo.
  spanishMasQueCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "más interesante", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(un solo patrón)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8.5, fill: "white", content: "интереснее /", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 8, fill: "white", content: "более интересный", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español usa siempre 'más...que'; el ruso tiene dos", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "formas de comparativo y una alternativa sin 'чем'", anchor: "middle" },
  ],

  // "Русский язык интереснее, чем английский?" — "По-моему, да, гораздо интереснее." — mini diálogo de opinión.
  comparisonDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9, fill: "white", content: "Русский интереснее, чем", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 40, size: 9, fill: "white", content: "английский?", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 64, w: 132, h: 34, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M146 64 L152 52 L132 64 Z", fill: "accentLight" },
    { kind: "text", x: 80, y: 82, size: 8.5, fill: "white", content: "По-моему, да, гораздо", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 93, size: 8.5, fill: "white", content: "интереснее.", bold: true, anchor: "middle" },
  ],

  // спина / зубы / глаза / уши / горло / сердце — vocabulario ampliado del cuerpo, con plurales irregulares.
  moreBodyPartsGrid: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 24, size: 8.5, fill: "white", content: "спина", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 33, size: 6.5, fill: "accentLight", content: "espalda", anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 24, size: 8, fill: "white", content: "глаз / глаза", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 33, size: 6.5, fill: "white", content: "ojo/ojos (irregular)", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 8, y: 42, w: 68, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 42, y: 58, size: 8, fill: "white", content: "ухо / уши", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 67, size: 6.5, fill: "white", content: "oído/oídos (irregular)", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 80, y: 42, w: 68, h: 30, rx: 8, fill: "ink" },
    { kind: "text", x: 114, y: 58, size: 8.5, fill: "white", content: "сердце", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 67, size: 6.5, fill: "white", content: "corazón", opacity: 0.85, anchor: "middle" },
  ],

  // "У меня болит голова" (singular) vs. "У меня болят ноги" (plural) — болит/болят concuerda con lo que duele.
  bolitSingularPlural: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 33, size: 10, fill: "white", content: "У меня болит голова.", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 44, size: 6.5, fill: "accentLight", content: "болит (singular)", anchor: "middle" },
    { kind: "rect", x: 8, y: 52, w: 136, h: 30, rx: 10, fill: "brandLight" },
    { kind: "text", x: 76, y: 71, size: 10, fill: "white", content: "У меня болят ноги.", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 82, size: 6.5, fill: "white", content: "болят (plural)", opacity: 0.85, anchor: "middle" },
  ],

  // "Me duele la cabeza" / "Me duelen las piernas" — un paralelo casi exacto con болит/болят.
  spanishDuelerCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "inkSoft", content: "me duele /", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 8, fill: "inkSoft", content: "me duelen", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "у меня болит /", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 8, fill: "white", content: "болят", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "¡uno de los paralelos más exactos del curso!", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "ambos concuerdan con lo que duele, no con la persona", anchor: "middle" },
  ],

  // болеть (imperfectivo, estar enfermo, proceso) vs. заболеть (perfectivo, enfermarse, evento) — repaso a2-1.
  boletAspectPair: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 44, size: 9, fill: "inkSoft", content: "Я болею", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6.5, fill: "danger", content: "(proceso, imperf.)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 44, size: 9, fill: "white", content: "Я заболел", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6.5, fill: "accentLight", content: "(evento, perf.)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el mismo par aspectual proceso/resultado de a2-1,", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "aplicado ahora al verbo 'estar/ponerse enfermo'", anchor: "middle" },
  ],

  // температура / кашель / насморк — vocabulario de síntomas comunes.
  symptomsVocabGrid: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 24, size: 7.5, fill: "white", content: "температура", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 33, size: 6, fill: "accentLight", content: "fiebre", anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 114, y: 24, size: 8.5, fill: "white", content: "кашель", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 33, size: 6.5, fill: "white", content: "tos", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 44, y: 42, w: 68, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 78, y: 58, size: 8, fill: "white", content: "насморк", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 67, size: 6.5, fill: "white", content: "resfriado nasal", opacity: 0.85, anchor: "middle" },
  ],

  // "Мне плохо" (dativo impersonal, a1-25/a2-4) vs. "У меня болит..." (genitivo + sujeto nominativo) — dos construcciones distintas.
  feelingBadConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 9.5, fill: "white", content: "Мне плохо.", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6.5, fill: "accentLight", content: "(dativo, impersonal)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 44, size: 9, fill: "white", content: "У меня болит...", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6.5, fill: "white", content: "(genitivo + sujeto)", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "malestar general (dativo) vs. dolor localizado", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "en una parte específica del cuerpo (genitivo + nominativo)", anchor: "middle" },
  ],

  // "Вам нужно отдохнуть" / "Примите лекарство" — consejos e imperativos del médico.
  doctorAdviceImperatives: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 30, size: 9, fill: "white", content: "Вам нужно отдохнуть.", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 41, size: 6.5, fill: "accentLight", content: "Necesita descansar.", anchor: "middle" },
    { kind: "rect", x: 8, y: 52, w: 136, h: 30, rx: 10, fill: "brandLight" },
    { kind: "text", x: 76, y: 68, size: 9, fill: "white", content: "Примите лекарство.", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 79, size: 6.5, fill: "white", content: "Tome la medicina.", opacity: 0.85, anchor: "middle" },
  ],

  // "Что у вас болит?" — "У меня болит горло и температура." — mini diálogo médico.
  healthDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 120, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M34 48 L28 60 L48 48 Z", fill: "brand" },
    { kind: "text", x: 74, y: 37, size: 10.5, fill: "white", content: "Что у вас болит?", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 66, w: 136, h: 34, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M146 66 L152 54 L132 66 Z", fill: "accentLight" },
    { kind: "text", x: 78, y: 84, size: 8.5, fill: "white", content: "У меня болит горло и", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 95, size: 8.5, fill: "white", content: "температура.", bold: true, anchor: "middle" },
  ],

  // новый → нового / новая → новой — terminaciones genitivas de adjetivos, masc./neutro y femenino.
  adjGenEndingsTable: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 30, size: 9.5, fill: "white", content: "новый → нового / новое → нового", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 41, size: 6.5, fill: "accentLight", content: "masculino / neutro: -ого/-его", anchor: "middle" },
    { kind: "rect", x: 8, y: 52, w: 136, h: 30, rx: 10, fill: "brandLight" },
    { kind: "text", x: 76, y: 68, size: 9.5, fill: "white", content: "новая → новой", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 79, size: 6.5, fill: "white", content: "femenino: -ой/-ей", opacity: 0.85, anchor: "middle" },
  ],

  // мой → моего/моей / наш → нашего/нашей — los posesivos se declinan igual que cualquier adjetivo.
  possessivePronounDeclineTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 8, fill: "white", content: "мой → моего", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 8, fill: "white", content: "мой → моей", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7.5, fill: "white", content: "наш → нашего", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 7.5, fill: "white", content: "наш → нашей", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "мой/твой/наш/ваш se declinan como adjetivos", bold: true, anchor: "middle" },
  ],

  // его / её / их — formas genitivas congeladas de он/она/они, nunca cambian de forma.
  egoEyoIkhInvariable: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 20, w: 128, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 39, size: 10.5, fill: "white", content: "его дом / его дома / его домом", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 58, w: 80, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 73, size: 8, fill: "white", content: "его siempre igual", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "его/её/их NUNCA se declinan, en ningún caso", bold: true, anchor: "middle" },
  ],

  // "su casa" (una sola palabra, sin declinar) vs. мой/твой/наш (se declinan) + его/её/их (congelados) — asimetría rusa.
  spanishPossessiveCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "su casa", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(invariable siempre)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "моего/его", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(uno declina, otro no)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español no declina ningún posesivo; el ruso tiene", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "una asimetría interna: мой/наш sí, его/её/их no", anchor: "middle" },
  ],

  // красивые → красивых — en plural, todos los géneros comparten la misma terminación genitiva.
  pluralGenAdjEnding: [
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 9, fill: "inkSoft", content: "красивые", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 9, fill: "white", content: "красивых", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 8, fill: "danger", content: "plural: un solo patrón para los tres géneros", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "-ых/-их, sin importar masc./fem./neutro", bold: true, anchor: "middle" },
  ],

  // Repaso de los contextos que exigen genitivo, ahora aplicados a frases adjetivo+sustantivo completas.
  genitiveContextsRecap: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7.5, fill: "white", content: "нет + genitivo", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 7.5, fill: "white", content: "2-4 + genitivo", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7, fill: "white", content: "без/у/до + gen.", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 7, fill: "white", content: "comparativo + gen.", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "los mismos contextos de a1, ahora con adjetivos también", bold: true, anchor: "middle" },
  ],

  // "старше моего брата" — comparativo (a2-7) + adjetivo posesivo en genitivo, sin чем.
  comparisonWithGenitive: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 11, fill: "white", content: "старше моего брата", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 8, fill: "accentLight", content: "mayor que mi hermano", anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 8, fill: "brandLight", content: "comparativo (a2-7) + adjetivo posesivo en genitivo (моего)", bold: true, anchor: "middle" },
  ],

  // "Это дом твоего брата?" — "Нет, это дом моего друга." — mini diálogo de posesión con genitivo.
  possessionGenitiveDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9.5, fill: "white", content: "Это дом твоего брата?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 9, fill: "white", content: "Нет, это дом моего друга.", bold: true, anchor: "middle" },
  ],

  // новый → новому / новое → новому — terminaciones dativas de adjetivos, masc./neutro.
  dativeMascNeutAdjEndings: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 30, size: 9.5, fill: "white", content: "новый → новому / новое → новому", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 41, size: 6.5, fill: "accentLight", content: "masculino / neutro: -ому/-ему", anchor: "middle" },
    { kind: "rect", x: 8, y: 52, w: 136, h: 30, rx: 10, fill: "brandLight" },
    { kind: "text", x: 76, y: 68, size: 9.5, fill: "white", content: "звонить, помогать, дать", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 79, size: 6.5, fill: "white", content: "verbos que rigen dativo", opacity: 0.85, anchor: "middle" },
  ],

  // новая → новой — terminación dativa de adjetivos femeninos, misma forma que el instrumental.
  dativeFemAdjEndings: [
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 9, fill: "inkSoft", content: "новая", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 9, fill: "white", content: "новой", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 8, fill: "danger", content: "femenino dativo: -ой/-ей", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 7.5, fill: "brandLight", content: "misma forma que el instrumental (a1-26/27)", anchor: "middle" },
  ],

  // мой → моему/моей / наш → нашему/нашей — los posesivos también se declinan en dativo.
  possessiveDativeTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 8, fill: "white", content: "мой → моему", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 8, fill: "white", content: "мой → моей", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7.5, fill: "white", content: "наш → нашему", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 7.5, fill: "white", content: "наш → нашей", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "мой/твой/наш/ваш se declinan como adjetivos", bold: true, anchor: "middle" },
  ],

  // его / её / их — invariables también en dativo, la misma excepción del genitivo (a2-9).
  egoEyoIkhDativeInvariable: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 20, w: 128, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 39, size: 10.5, fill: "white", content: "я помогаю его сестре", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 58, w: 80, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 73, size: 8, fill: "white", content: "его siempre igual", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "его/её/их NUNCA se declinan, tampoco en dativo", bold: true, anchor: "middle" },
  ],

  // звонить / писать / советовать / объяснять / помогать / нравиться / верить — verbos que rigen dativo sin preposición.
  dativeGoverningVerbsGrid: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7.5, fill: "white", content: "звонить", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 7.5, fill: "white", content: "писать", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7, fill: "white", content: "советовать", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 7, fill: "white", content: "объяснять", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "persona destinataria en dativo, sin preposición", bold: true, anchor: "middle" },
  ],

  // "le llamo / le escribo" (español, palabra aparte) vs. terminación dativa rusa — comparación directa.
  spanishIndirectObjectCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "le llamo", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(palabra aparte)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "звоню ему", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(terminación -у)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el dativo ruso funciona como le/les en español", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "pero se marca con una terminación, no una palabra", anchor: "middle" },
  ],

  // красивые → красивым — en plural, todos los géneros comparten la misma terminación dativa.
  dativePluralAdjEnding: [
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 9, fill: "inkSoft", content: "красивые", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 9, fill: "white", content: "красивым", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 8, fill: "danger", content: "plural: un solo patrón para los tres géneros", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "-ым/-им, sin importar masc./fem./neutro", bold: true, anchor: "middle" },
  ],

  // "Что ты даришь своему другу?" — "Я дарю моему старому другу книгу." — mini diálogo con dativo de adjetivos.
  dativeAdjDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9, fill: "white", content: "Что ты даришь своему другу?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 8.5, fill: "white", content: "Я дарю моему старому другу книгу.", bold: true, anchor: "middle" },
  ],

  // новый → новым (duro) / синий → синим (blando) — terminaciones instrumentales masc./neutro.
  instrumentalMascNeutAdjEndings: [
    { kind: "rect", x: 8, y: 14, w: 136, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 30, size: 9.5, fill: "white", content: "новый → новым (tema duro)", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 41, size: 6.5, fill: "accentLight", content: "masculino / neutro: -ым", anchor: "middle" },
    { kind: "rect", x: 8, y: 52, w: 136, h: 30, rx: 10, fill: "brandLight" },
    { kind: "text", x: 76, y: 68, size: 9.5, fill: "white", content: "синий → синим (tema blando)", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 79, size: 6.5, fill: "white", content: "adjetivos en -ний: -им", opacity: 0.85, anchor: "middle" },
  ],

  // новая → новой — terminación instrumental femenina, misma forma que el dativo.
  instrumentalFemAdjEndings: [
    { kind: "rect", x: 14, y: 42, w: 60, h: 34, rx: 10, fill: "muted" },
    { kind: "text", x: 44, y: 64, size: 9, fill: "inkSoft", content: "новая", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 58 L96 58 M90 52 L96 58 L90 64", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 34, w: 48, h: 42, rx: 10, fill: "brand" },
    { kind: "text", x: 124, y: 60, size: 9, fill: "white", content: "новой", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 8, fill: "danger", content: "femenino instrumental: -ой/-ей", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 7.5, fill: "brandLight", content: "misma forma que el dativo femenino (a2-10)", anchor: "middle" },
  ],

  // мой → моим/моей / наш → нашим/нашей — los posesivos también se declinan en instrumental.
  possessiveInstrumentalTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 8, fill: "white", content: "мой → моим", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 8, fill: "white", content: "мой → моей", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7.5, fill: "white", content: "наш → нашим", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 7.5, fill: "white", content: "наш → нашей", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "мой/твой/наш/ваш se declinan como adjetivos", bold: true, anchor: "middle" },
  ],

  // его / её / их — invariables también en instrumental, tercera confirmación de la excepción (a2-9/a2-10).
  egoEyoIkhInstrumentalInvariable: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 20, w: 128, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 39, size: 10.5, fill: "white", content: "она гуляет с его сестрой", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 58, w: 80, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 73, size: 8, fill: "white", content: "его siempre igual", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 8, fill: "brandLight", content: "его/её/их: la tercera vez que NO se declinan", bold: true, anchor: "middle" },
  ],

  // со мной / с тобой / с ним / с ней / с нами / с вами / с ними — repaso de a1-27, combinado con adjetivos.
  sMnoyPronounsRecap: [
    { kind: "rect", x: 8, y: 8, w: 42, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 29, y: 23, size: 7.5, fill: "white", content: "со мной", bold: true, anchor: "middle" },
    { kind: "rect", x: 54, y: 8, w: 42, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 75, y: 23, size: 7.5, fill: "white", content: "с тобой", bold: true, anchor: "middle" },
    { kind: "rect", x: 100, y: 8, w: 48, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 124, y: 23, size: 7, fill: "white", content: "с ним/ней", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 42, y: 49, size: 7, fill: "white", content: "с нами/вами", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 114, y: 49, size: 7, fill: "white", content: "с ними", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "solo 'со мной' cambia с→со por pronunciación", bold: true, anchor: "middle" },
  ],

  // "con mi amigo" (sin cambio) vs "conmigo" (fusión irregular) vs со мной/с моим другом (patrón regular).
  spanishConmigoCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "conmigo", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(fusión irregular)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "со мной", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(patrón regular)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "'con' no cambia sustantivos en español; el ruso", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "marca 'con' con la terminación instrumental", anchor: "middle" },
  ],

  // "он стал хорошим врачом" — быть/стать + adjetivo+sustantivo en instrumental, sin preposición.
  bytStatInstrumentalAdjective: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 11, fill: "white", content: "он стал хорошим врачом", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 8, fill: "accentLight", content: "se convirtió en buen médico", anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 8, fill: "brandLight", content: "стать + adjetivo+sustantivo en instrumental, sin preposición", bold: true, anchor: "middle" },
  ],

  // "С кем ты путешествуешь?" — "Я путешествую с моей лучшей подругой." — mini diálogo con instrumental de adjetivos.
  instrumentalAdjDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9.5, fill: "white", content: "С кем ты путешествуешь?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 8.5, fill: "white", content: "Я путешествую с моей лучшей подругой.", bold: true, anchor: "middle" },
  ],

  // из-за, вместо, кроме, вокруг, напротив, после — el patrón por defecto de las preposiciones compuestas: genitivo.
  genitiveDefaultPrepositionsGrid: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 7, fill: "white", content: "из-за", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 78, y: 23, size: 7, fill: "white", content: "вместо", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 126, y: 23, size: 7, fill: "white", content: "кроме", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 44, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 30, y: 49, size: 6.5, fill: "white", content: "вокруг", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 34, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "white", content: "напротив", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 34, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 126, y: 49, size: 6.5, fill: "white", content: "после", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "el patrón por defecto: genitivo", bold: true, anchor: "middle" },
  ],

  // между, перед, над, под — el pequeño grupo espacial que rige instrumental.
  instrumentalSpatialPrepositions: [
    { kind: "rect", x: 8, y: 14, w: 68, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 42, y: 33, size: 9, fill: "white", content: "между / перед", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 14, w: 64, h: 30, rx: 10, fill: "brandLight" },
    { kind: "text", x: 112, y: 33, size: 9, fill: "white", content: "над / под", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 52, w: 136, h: 26, rx: 10, fill: "accentLight" },
    { kind: "text", x: 76, y: 69, size: 8, fill: "white", content: "над столом / под столом", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 96, size: 7.5, fill: "brandLight", content: "cuatro preposiciones espaciales, un solo caso", anchor: "middle" },
  ],

  // благодаря, согласно, вопреки — las tres únicas excepciones que rigen dativo.
  dativeExceptionPrepositions: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 20, w: 128, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 39, size: 9.5, fill: "white", content: "благодаря / согласно / вопреки", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 58, w: 80, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 73, size: 8, fill: "white", content: "solo estas tres: dativo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 7.5, fill: "brandLight", content: "el resto: genitivo o instrumental", anchor: "middle" },
  ],

  // Árbol de decisión simple: genitivo por defecto, instrumental si es espacial de dos objetos, dativo si es una de las tres excepciones.
  complexPrepositionDecisionRule: [
    { kind: "rect", x: 46, y: 6, w: 68, h: 20, rx: 8, fill: "ink" },
    { kind: "text", x: 80, y: 20, size: 8, fill: "white", content: "¿qué preposición?", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 26 L80 36", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 8, y: 40, w: 44, h: 24, rx: 8, fill: "brand" },
    { kind: "text", x: 30, y: 55, size: 6.5, fill: "white", content: "por defecto", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 76, size: 7, fill: "brandLight", content: "genitivo", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 40, w: 44, h: 24, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 51, size: 6, fill: "white", content: "espacial", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 6, fill: "white", content: "de 2 objetos", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 7, fill: "brandLight", content: "instrumental", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 40, w: 44, h: 24, rx: 8, fill: "accentLight" },
    { kind: "text", x: 130, y: 55, size: 6.5, fill: "white", content: "3 excepciones", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 76, size: 7, fill: "brandLight", content: "dativo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 7.5, fill: "danger", content: "una regla práctica, no gramática exacta", anchor: "middle" },
  ],

  // "según él" (sin cambio) vs. согласно + dativo — comparación de preposiciones fijas.
  spanishFixedPrepositionCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "según él", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(sin cambio)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "согласно ему", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(dativo)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "ninguna preposición española cambia el sustantivo;", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "el ruso exige memorizar el caso de cada una", anchor: "middle" },
  ],

  // Tabla resumen de las diez preposiciones de esta lección, agrupadas por caso.
  prepositionCaseTableFull: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7.5, fill: "white", content: "genitivo: 6", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 7.5, fill: "white", content: "instrumental: 4", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7.5, fill: "white", content: "dativo: 3", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 7, fill: "white", content: "10 preposiciones", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "misma preposición = siempre el mismo caso", bold: true, anchor: "middle" },
  ],

  // Frases completas ("Магазин между банком и парком", "Все, кроме брата") en contexto, no aisladas.
  prepositionSentenceExamples: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 34, size: 9, fill: "white", content: "Магазин между банком и парком.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 46, size: 6.5, fill: "accentLight", content: "La tienda está entre el banco y el parque.", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 76, size: 9, fill: "white", content: "Все пришли, кроме моего брата.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "white", content: "Todos vinieron, excepto mi hermano.", opacity: 0.85, anchor: "middle" },
  ],

  // "Где находится магазин?" — "Он напротив школы, между банком и парком." — mini diálogo con preposiciones complejas.
  prepositionDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9.5, fill: "white", content: "Где находится магазин?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 8, fill: "white", content: "Он напротив школы, между банком и парком.", bold: true, anchor: "middle" },
  ],

  // Los seis casos con su pregunta clave, en una sola tabla de referencia.
  sixCaseQuestionWordsTable: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 21, size: 6.5, fill: "white", content: "кто/что", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 44, h: 20, rx: 6, fill: "brandLight" },
    { kind: "text", x: 78, y: 21, size: 6, fill: "white", content: "кого/чего", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 8, w: 44, h: 20, rx: 6, fill: "accentLight" },
    { kind: "text", x: 126, y: 21, size: 7, fill: "white", content: "кому", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 32, w: 44, h: 20, rx: 6, fill: "ink" },
    { kind: "text", x: 30, y: 45, size: 6, fill: "white", content: "кого/что", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 32, w: 44, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 78, y: 45, size: 5.5, fill: "white", content: "с кем/чем", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 32, w: 44, h: 20, rx: 6, fill: "brandLight" },
    { kind: "text", x: 126, y: 45, size: 5.5, fill: "white", content: "о ком/чём", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 66, size: 8, fill: "danger", content: "seis casos, seis preguntas clave", bold: true, anchor: "middle" },
  ],

  // новый дом → нового дома → новому дому → новым домом → о новом доме — una frase, seis formas.
  sixCaseEndingChainDemo: [
    { kind: "rect", x: 8, y: 10, w: 68, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7, fill: "white", content: "новый дом", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 20 L96 20 M90 14 L96 20 L90 26", stroke: "accentLight", strokeWidth: 2.5, round: true },
    { kind: "rect", x: 100, y: 10, w: 48, h: 20, rx: 6, fill: "brandLight" },
    { kind: "text", x: 124, y: 23, size: 6.5, fill: "white", content: "нового дома", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 40, w: 68, h: 20, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 53, size: 6.5, fill: "white", content: "новому дому", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 50 L96 50 M90 44 L96 50 L90 56", stroke: "brand", strokeWidth: 2.5, round: true },
    { kind: "rect", x: 100, y: 40, w: 48, h: 20, rx: 6, fill: "ink" },
    { kind: "text", x: 124, y: 53, size: 6.5, fill: "white", content: "новым домом", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 68, w: 80, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 81, size: 6.5, fill: "white", content: "о новом доме", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 100, size: 7.5, fill: "brandLight", content: "el mismo sustantivo, seis funciones", anchor: "middle" },
  ],

  // Repaso de qué preposiciones marcan cada caso, tirando de a1 y a2-12.
  caseTriggerPrepositionsRecap: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7, fill: "white", content: "у/до/из/без", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 7, fill: "white", content: "к/благодаря", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7, fill: "white", content: "с/между/над", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 7, fill: "white", content: "в/на/о", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "cada preposición apunta a un caso fijo", bold: true, anchor: "middle" },
  ],

  // любить/помогать/гордиться/говорить о — verbos que exigen un caso concreto para su complemento.
  verbGovernedCasesRecap: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7.5, fill: "white", content: "любить + acc.", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 7, fill: "white", content: "помогать + dat.", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7, fill: "white", content: "гордиться + instr.", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "говорить о + prep.", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "el verbo decide el caso del complemento", bold: true, anchor: "middle" },
  ],

  // El español no tiene casos: sustantivo/adjetivo nunca cambian; el ruso codifica todo con terminaciones.
  spanishNoCasesCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "inkSoft", content: "casa nueva", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(siempre igual)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 7.5, fill: "white", content: "новый дом → …", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(seis formas distintas)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español no tiene sistema de casos gramaticales;", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "el ruso codifica la función con terminaciones", anchor: "middle" },
  ],

  // "Мама любит сына." = "Сына любит мама." — el caso, no el orden, indica sujeto y objeto.
  wordOrderFlexibilityDemo: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 18, w: 132, h: 30, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 37, size: 10, fill: "white", content: "Мама любит сына.", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 56, w: 132, h: 30, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 75, size: 10, fill: "white", content: "Сына любит мама.", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 100, size: 7.5, fill: "danger", content: "mismo significado — el caso decide, no la posición", bold: true, anchor: "middle" },
  ],

  // 1) encuentra el verbo, 2) qué caso exige cada complemento, 3) revisa la concordancia — estrategia de lectura en tres pasos.
  readingStrategyDiagram: [
    { kind: "rect", x: 8, y: 40, w: 40, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 28, y: 58, size: 8, fill: "white", content: "1. verbo", bold: true, anchor: "middle" },
    { kind: "path", d: "M52 55 L66 55 M60 49 L66 55 L60 61", stroke: "accentLight", strokeWidth: 2.5, round: true },
    { kind: "rect", x: 60, y: 40, w: 40, h: 30, rx: 10, fill: "brandLight" },
    { kind: "text", x: 80, y: 53, size: 6.5, fill: "white", content: "2. ¿qué", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 63, size: 6.5, fill: "white", content: "caso?", bold: true, anchor: "middle" },
    { kind: "path", d: "M104 55 L118 55 M112 49 L118 55 L112 61", stroke: "brand", strokeWidth: 2.5, round: true },
    { kind: "rect", x: 112, y: 40, w: 40, h: 30, rx: 10, fill: "accentLight" },
    { kind: "text", x: 132, y: 53, size: 6.5, fill: "white", content: "3. concor-", bold: true, anchor: "middle" },
    { kind: "text", x: 132, y: 63, size: 6.5, fill: "white", content: "dancia", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 8, fill: "danger", content: "tres pasos para leer cualquier frase rusa", bold: true, anchor: "middle" },
  ],

  // "Я живу в новом доме с моей семьёй." — "Вчера я подарил цветы моей маме." — mini diálogo con varios casos a la vez.
  allCasesDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 8.5, fill: "white", content: "Я живу в новом доме с моей семьёй.", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 8.5, fill: "white", content: "Вчера я подарил цветы моей маме.", bold: true, anchor: "middle" },
  ],

  // идти (trayecto puntual, una dirección) vs. ходить (habitual, repetido) — el contraste central de la lección.
  unidirectionalVsMultidirectionalCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 9, fill: "white", content: "иду", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6.5, fill: "accentLight", content: "ahora, una dirección", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 44, size: 9, fill: "white", content: "хожу", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6.5, fill: "white", content: "habitual, repetido", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 8, fill: "danger", content: "el par unidireccional / multidireccional", bold: true, anchor: "middle" },
  ],

  // Tabla completa de conjugación presente de идти y ходить lado a lado.
  idtiKhoditConjugationTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7.5, fill: "white", content: "иду / идёшь", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 7, fill: "white", content: "хожу / ходишь", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7, fill: "white", content: "идём / идёте", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "ходим / ходите", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "dos conjugaciones irregulares distintas", bold: true, anchor: "middle" },
  ],

  // "¿estoy en camino ahora mismo?" → идти; "¿es habitual/repetido?" → ходить — la prueba práctica.
  motionDecisionTest: [
    { kind: "rect", x: 46, y: 6, w: 68, h: 20, rx: 8, fill: "ink" },
    { kind: "text", x: 80, y: 20, size: 7, fill: "white", content: "¿en camino ahora?", bold: true, anchor: "middle" },
    { kind: "path", d: "M60 26 L40 40 M100 26 L120 40", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 8, y: 42, w: 60, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 38, y: 58, size: 7, fill: "white", content: "sí → идти", bold: true, anchor: "middle" },
    { kind: "rect", x: 92, y: 42, w: 60, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 122, y: 58, size: 6.5, fill: "white", content: "no, habitual → ходить", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 8, fill: "danger", content: "una pregunta, dos verbos", bold: true, anchor: "middle" },
  ],

  // шёл (en camino, pasado) vs. ходил (fui y volví) — la sutileza del pasado.
  pastTenseIdtiKhoditNuance: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "шёл домой", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "en camino, un momento del pasado", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 78, size: 10, fill: "white", content: "ходил в магазин", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "white", content: "fui y ya volví (viaje completo)", opacity: 0.85, anchor: "middle" },
  ],

  // пойти / прийти / уйти (perfectivos, sobre идти) — recap de los prefijos direccionales de a2-5.
  prefixedMotionVerbsPreview: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 7.5, fill: "white", content: "по+идти", bold: true, anchor: "middle" },
    { kind: "path", d: "M56 19 L68 19 M62 13 L68 19 L62 25", stroke: "accentLight", strokeWidth: 2, round: true },
    { kind: "rect", x: 72, y: 8, w: 40, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 92, y: 23, size: 8, fill: "white", content: "пойти", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 30, y: 49, size: 7, fill: "white", content: "при+идти", bold: true, anchor: "middle" },
    { kind: "path", d: "M56 45 L68 45 M62 39 L68 45 L62 51", stroke: "brand", strokeWidth: 2, round: true },
    { kind: "rect", x: 72, y: 34, w: 40, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 92, y: 49, size: 7, fill: "white", content: "прийти", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "prefijos de a2-5 + идти = perfectivo", bold: true, anchor: "middle" },
  ],

  // "иди!" (orden puntual) frente a "ходи!" (menos común, repetido) — imperativo de los verbos de movimiento.
  imperativeMotionVerbs: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 30, y: 30, w: 100, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 50, size: 12, fill: "white", content: "иди!", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 7, fill: "accentLight", content: "¡ve! — orden puntual, la más común", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "'ходи!' existe, pero es mucho menos frecuente", anchor: "middle" },
  ],

  // El español usa un solo "ir" para trayecto puntual y habitual; el ruso obliga a elegir идти/ходить.
  spanishSingleIrCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "voy", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(un solo verbo, siempre)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "иду / хожу", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(dos verbos distintos)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español no distingue puntual de habitual;", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "el ruso obliga a elegir el verbo correcto", anchor: "middle" },
  ],

  // идти/ходить = solo a pie; coche/autobús/avión usan ехать/ездить (aviso que enlaza con a2-15).
  onFootOnlyDisclaimer: [
    { kind: "rect", x: 14, y: 20, w: 132, h: 32, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 38, size: 9.5, fill: "white", content: "идти / ходить = solo a pie", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 32, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 9, fill: "inkSoft", content: "coche/autobús/avión → ехать / ездить", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 7.5, fill: "brandLight", content: "otro par completo — próxima lección", anchor: "middle" },
  ],

  // бежит (corriendo ahora, una dirección) vs. бегает (actividad habitual) — el contraste central de la lección.
  runningVerbsUnidirMultidirCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 9, fill: "white", content: "бежит", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6.5, fill: "accentLight", content: "ahora, una dirección", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 44, size: 9, fill: "white", content: "бегает", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6.5, fill: "white", content: "habitual, actividad", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 8, fill: "danger", content: "el mismo par que идти/ходить, para correr", bold: true, anchor: "middle" },
  ],

  // Tabla completa de conjugación presente de бежать y бегать lado a lado.
  begatBezhatConjugationTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7.5, fill: "white", content: "бегу / бежишь", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "бегаю / бегаешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7, fill: "white", content: "бежим / бежите", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "бегаем / бегаете", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "бежать irregular, бегать regular", bold: true, anchor: "middle" },
  ],

  // бегу/бегут (como 1ª conjugación) + бежишь/бежит (como 2ª conjugación) — un patrón mixto irregular único.
  begatBezhatIrregularStemNote: [
    { kind: "rect", x: 16, y: 20, w: 128, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 39, size: 9.5, fill: "white", content: "бегу / бегут — como 1ª conjugación", bold: true, anchor: "middle" },
    { kind: "rect", x: 16, y: 58, w: 128, h: 30, rx: 10, fill: "brandLight" },
    { kind: "text", x: 80, y: 77, size: 9.5, fill: "white", content: "бежишь / бежит — como 2ª conjugación", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 7.5, fill: "danger", content: "patrón mixto único — memorizar aparte", bold: true, anchor: "middle" },
  ],

  // побежать / прибежать / убежать (perfectivos, sobre бежать) — mismos prefijos de a2-5/a2-14.
  prefixedRunningVerbsPreview: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "по+бежать", bold: true, anchor: "middle" },
    { kind: "path", d: "M56 19 L68 19 M62 13 L68 19 L62 25", stroke: "accentLight", strokeWidth: 2, round: true },
    { kind: "rect", x: 72, y: 8, w: 40, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 92, y: 23, size: 7, fill: "white", content: "побежать", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 30, y: 49, size: 6.5, fill: "white", content: "у+бежать", bold: true, anchor: "middle" },
    { kind: "path", d: "M56 45 L68 45 M62 39 L68 45 L62 51", stroke: "brand", strokeWidth: 2, round: true },
    { kind: "rect", x: 72, y: 34, w: 40, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 92, y: 49, size: 7, fill: "white", content: "убежать", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "los mismos prefijos, ahora sobre бежать", bold: true, anchor: "middle" },
  ],

  // "беги!" (orden puntual, común) frente a "бегай!" (menos común) — imperativo de бежать/бегать.
  imperativeRunningVerbs: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 30, y: 30, w: 100, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 50, size: 12, fill: "white", content: "беги!", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 7, fill: "accentLight", content: "¡corre! — orden puntual, la más común", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "'бегай!' existe, pero es mucho menos frecuente", anchor: "middle" },
  ],

  // El español usa un solo "correr" para ambos sentidos; el ruso repite la distinción de идти/ходить.
  spanishCorrerSingleVerbCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "corro", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(un solo verbo, siempre)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "бегу / бегаю", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(dos verbos distintos)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el mismo patrón que идти/ходить, aplicado", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "a un verbo distinto: correr en vez de caminar", anchor: "middle" },
  ],

  // идти/ходить, бежать/бегать — y próximamente летать/лететь, плавать/плыть, носить/нести: un patrón, muchos verbos.
  motionVerbPatternBridge: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7.5, fill: "white", content: "идти / ходить", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 7, fill: "white", content: "бежать / бегать", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 140, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 78, y: 49, size: 7, fill: "white", content: "летать/лететь, плавать/плыть, носить/нести →", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "mismo sistema, distinto verbo cada vez", bold: true, anchor: "middle" },
  ],

  // "Куда ты бежишь так быстро?" — "Я бегу на автобус, я опаздываю!" — mini diálogo con бежать.
  runningDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9, fill: "white", content: "Куда ты бежишь так быстро?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 8, fill: "white", content: "Я бегу на автобус, я опаздываю!", bold: true, anchor: "middle" },
  ],

  // идти/ходить (a pie) vs. ехать/ездить (en vehículo) — sistemas paralelos, nunca intercambiables.
  vehicleVsWalkingMotionCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "иду", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(a pie, a2-14)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8.5, fill: "white", content: "еду", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(en vehículo)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 8, fill: "brandLight", content: "dos sistemas paralelos, nunca intercambiables", bold: true, anchor: "middle" },
  ],

  // Tabla completa de conjugación presente de ехать y ездить lado a lado.
  yekhatYezditConjugationTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7.5, fill: "white", content: "еду / едешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "езжу / ездишь", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7, fill: "white", content: "едем / едете", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "ездим / ездите", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "dos conjugaciones irregulares, como идти/ходить", bold: true, anchor: "middle" },
  ],

  // "¿en camino ahora, en vehículo?" → ехать; "¿es habitual?" → ездить — la misma prueba práctica de a2-14.
  vehicleMotionDecisionTest: [
    { kind: "rect", x: 40, y: 6, w: 80, h: 20, rx: 8, fill: "ink" },
    { kind: "text", x: 80, y: 20, size: 6.5, fill: "white", content: "¿en camino ahora, en vehículo?", bold: true, anchor: "middle" },
    { kind: "path", d: "M60 26 L40 40 M100 26 L120 40", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 8, y: 42, w: 60, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 38, y: 58, size: 7, fill: "white", content: "sí → ехать", bold: true, anchor: "middle" },
    { kind: "rect", x: 92, y: 42, w: 60, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 122, y: 58, size: 6.5, fill: "white", content: "no, habitual → ездить", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 8, fill: "danger", content: "misma pregunta, ahora para vehículos", bold: true, anchor: "middle" },
  ],

  // ехал (en camino, pasado) vs. ездил (fui y volví en vehículo) — la misma sutileza del pasado, para vehículos.
  pastTenseYekhatYezditNuance: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "ехал домой", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "en camino, un momento del pasado", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 78, size: 10, fill: "white", content: "ездил в Москву", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "white", content: "fui y ya volví (viaje completo)", opacity: 0.85, anchor: "middle" },
  ],

  // поехать / приехать / уехать (perfectivos, sobre ехать) — mismos prefijos de a2-5/a2-14/a2-16.
  prefixedVehicleMotionVerbsPreview: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "по+ехать", bold: true, anchor: "middle" },
    { kind: "path", d: "M56 19 L68 19 M62 13 L68 19 L62 25", stroke: "accentLight", strokeWidth: 2, round: true },
    { kind: "rect", x: 72, y: 8, w: 40, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 92, y: 23, size: 7, fill: "white", content: "поехать", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 30, y: 49, size: 6.5, fill: "white", content: "при+ехать", bold: true, anchor: "middle" },
    { kind: "path", d: "M56 45 L68 45 M62 39 L68 45 L62 51", stroke: "brand", strokeWidth: 2, round: true },
    { kind: "rect", x: 72, y: 34, w: 40, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 92, y: 49, size: 7, fill: "white", content: "приехать", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "los mismos prefijos, ahora sobre ехать", bold: true, anchor: "middle" },
  ],

  // "поезжай!" — imperativo supletivo irregular; no existe una forma regular '*ехай!'.
  irregularImperativeYekhat: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 20, y: 30, w: 120, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 50, size: 11, fill: "white", content: "поезжай!", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 6.5, fill: "accentLight", content: "¡ve! (en vehículo) — forma supletiva", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "danger", content: "'*ехай!' no existe — excepción real del sistema", bold: true, anchor: "middle" },
  ],

  // El español usa "ir en coche/tren/avión" (mismo verbo 'ir'); el ruso usa ехать/ездить, verbos distintos.
  spanishVehicleMotionCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "inkSoft", content: "voy en coche", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(verbo 'ir' + frase)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "еду / езжу", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(verbo distinto)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español mantiene 'ir'; el ruso cambia de verbo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "por completo solo para vehículos", anchor: "middle" },
  ],

  // "Сейчас мы едем в аэропорт." — "Поезжай осторожно!" — mini diálogo con ехать/ездить.
  vehicleMotionDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9, fill: "white", content: "Сейчас мы едем в аэропорт.", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 9, fill: "white", content: "Поезжай осторожно!", bold: true, anchor: "middle" },
  ],

  // лететь/летать, плыть/плавать, нести/носить — tres pares más con el mismo sistema unidireccional/multidireccional.
  threeMoreMotionPairsOverview: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "лететь/", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 30, size: 6, fill: "accentLight", content: "летать", anchor: "middle" },
    { kind: "rect", x: 58, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 23, size: 6.5, fill: "white", content: "плыть/", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 30, size: 6, fill: "white", content: "плавать", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 130, y: 23, size: 6.5, fill: "white", content: "нести/", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 30, size: 6, fill: "white", content: "носить", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 78, y: 60, size: 8, fill: "danger", content: "el mismo par de siempre, tres verbos más", bold: true, anchor: "middle" },
  ],

  // Tabla completa de conjugación presente de лететь y летать lado a lado.
  letatLetetConjugationTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7.5, fill: "white", content: "лечу / летишь", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "летаю / летаешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7, fill: "white", content: "летим / летите", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "летаем / летаете", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "лететь irregular, летать regular", bold: true, anchor: "middle" },
  ],

  // Tabla completa de conjugación presente de плыть y плавать lado a lado.
  plavatPlytConjugationTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7, fill: "white", content: "плыву / плывёшь", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "плаваю / плаваешь", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6.5, fill: "white", content: "плывём / плывёте", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "плаваем / плаваете", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "плыть irregular, плавать regular", bold: true, anchor: "middle" },
  ],

  // Tabla completa de conjugación presente de нести y носить lado a lado — ambos irregulares.
  nositNestiConjugationTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7, fill: "white", content: "несу / несёшь", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "ношу / носишь", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6.5, fill: "white", content: "несём / несёте", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "носим / носите", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "ambos irregulares, a diferencia de летать/плавать", bold: true, anchor: "middle" },
  ],

  // "Она носит очки." — носить también significa "llevar puesto", extensión semántica que нести nunca tiene.
  nositWearMeaningExtension: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 16, y: 20, w: 128, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 39, size: 10, fill: "white", content: "Она носит очки.", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 58, w: 80, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 73, size: 7.5, fill: "white", content: "'llevar puesto', no cargar", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 7.5, fill: "brandLight", content: "нести NUNCA tiene este significado", bold: true, anchor: "middle" },
  ],

  // полететь / поплыть / принести (perfectivos) — mismos prefijos de a2-5/a2-14/a2-15/a2-16.
  prefixedThreeMotionVerbsPreview: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "по+лететь", bold: true, anchor: "middle" },
    { kind: "path", d: "M56 19 L68 19 M62 13 L68 19 L62 25", stroke: "accentLight", strokeWidth: 2, round: true },
    { kind: "rect", x: 72, y: 8, w: 40, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 92, y: 23, size: 7, fill: "white", content: "полетел", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 30, y: 49, size: 6.5, fill: "white", content: "при+нести", bold: true, anchor: "middle" },
    { kind: "path", d: "M56 45 L68 45 M62 39 L68 45 L62 51", stroke: "brand", strokeWidth: 2, round: true },
    { kind: "rect", x: 72, y: 34, w: 40, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 92, y: 49, size: 7, fill: "white", content: "принеси", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "los mismos prefijos, en tres verbos más", bold: true, anchor: "middle" },
  ],

  // El español usa "volar", "nadar", "llevar" como un solo verbo cada uno; "llevar" cubre además cargar y vestir.
  spanishLlevarSingleVerbCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "llevar", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(cargar Y vestir)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "нести / носить", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(dos verbos distintos)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "'llevar' en español cubre cargar y vestir a la vez;", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "el ruso separa ambos sentidos por el mismo patrón", anchor: "middle" },
  ],

  // "Принеси мне воду, пожалуйста." — "Он полетел в Париж." — mini diálogo con лететь/плыть/нести.
  threeVerbsDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9, fill: "white", content: "Принеси мне воду, пожалуйста.", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 9, fill: "white", content: "Он полетел в Париж.", bold: true, anchor: "middle" },
  ],

  // Los seis pares de verbos de movimiento (a2-14 a a2-17) en una sola tabla de repaso.
  sixMotionPairsFullRecap: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 21, size: 6, fill: "white", content: "идти/ходить", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 44, h: 20, rx: 6, fill: "brandLight" },
    { kind: "text", x: 78, y: 21, size: 6, fill: "white", content: "ехать/ездить", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 8, w: 44, h: 20, rx: 6, fill: "accentLight" },
    { kind: "text", x: 126, y: 21, size: 5.5, fill: "white", content: "бежать/бегать", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 32, w: 44, h: 20, rx: 6, fill: "ink" },
    { kind: "text", x: 30, y: 45, size: 6, fill: "white", content: "лететь/летать", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 32, w: 44, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 78, y: 45, size: 6, fill: "white", content: "плыть/плавать", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 32, w: 44, h: 20, rx: 6, fill: "brandLight" },
    { kind: "text", x: 126, y: 45, size: 6, fill: "white", content: "нести/носить", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 66, size: 8, fill: "danger", content: "el mismo sistema, seis medios distintos", bold: true, anchor: "middle" },
  ],

  // Dos preguntas (¿CÓMO? y ¿CUÁNDO?) determinan qué verbo de movimiento usar.
  motionVerbChoiceBySituation: [
    { kind: "rect", x: 8, y: 10, w: 66, h: 26, rx: 8, fill: "brand" },
    { kind: "text", x: 41, y: 24, size: 7, fill: "white", content: "¿CÓMO?", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 32, size: 5.5, fill: "accentLight", content: "a pie/vehículo/...", anchor: "middle" },
    { kind: "rect", x: 82, y: 10, w: 66, h: 26, rx: 8, fill: "brandLight" },
    { kind: "text", x: 115, y: 24, size: 7, fill: "white", content: "¿CUÁNDO?", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 32, size: 5.5, fill: "white", content: "ahora/hábito", opacity: 0.85, anchor: "middle" },
    { kind: "path", d: "M78 46 L78 56", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 20, y: 60, w: 120, h: 26, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 76, size: 7.5, fill: "white", content: "= el verbo correcto", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 7.5, fill: "brandLight", content: "dos respuestas, un solo verbo", anchor: "middle" },
  ],

  // по-/при-/у- aplicados a los seis verbos base — un sistema de prefijos, multiplicado seis veces.
  sixPairsPrefixMultiplicationTable: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 7.5, fill: "white", content: "по- (partir)", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 78, y: 23, size: 7, fill: "white", content: "при- (llegar)", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 126, y: 23, size: 7.5, fill: "white", content: "у- (irse)", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 46, size: 7, fill: "inkSoft", content: "× идти, ехать, бежать, лететь, плыть, нести", anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "un sistema, aplicado seis veces", bold: true, anchor: "middle" },
  ],

  // шёл/ехал/бежал/летел/плыл/нёс (en camino) vs. ходил/ездил/бегал/... (fue y volvió) — repaso narrativo.
  narrativePastAllSixVerbs: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 9, fill: "white", content: "шёл / ехал / бежал / летел / плыл / нёс", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "en camino, un momento del pasado", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 78, size: 8.5, fill: "white", content: "ходил / ездил / бегал / летал / плавал / носил", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "white", content: "fue y ya volvió (viaje completo)", opacity: 0.85, anchor: "middle" },
  ],

  // "— Куда ты идёшь? — Я иду в магазин. — Ты часто туда ходишь?" — diálogo modelo paso a paso.
  dialoguePracticeWalkthrough: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 10, w: 132, h: 24, rx: 10, fill: "brand" },
    { kind: "text", x: 76, y: 26, size: 8, fill: "white", content: "— Куда ты идёшь? — Я иду в магазин.", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 40, w: 132, h: 24, rx: 10, fill: "brandLight" },
    { kind: "text", x: 76, y: 56, size: 7.5, fill: "white", content: "— Ты часто туда ходишь?", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 70, w: 132, h: 24, rx: 10, fill: "accentLight" },
    { kind: "text", x: 76, y: 86, size: 7.5, fill: "white", content: "— Да, хожу каждую неделю.", bold: true, anchor: "middle" },
  ],

  // El español usa "ir"/"viajar" para casi todo; el ruso exige elegir entre seis verbos según el medio.
  spanishSingleIrVsSixVerbsCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8.5, fill: "inkSoft", content: "ir / viajar", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(casi siempre el mismo)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "6 verbos", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(según el medio)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el mayor contraste estructural de todo este", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "bloque: el ruso elige el verbo por el medio", anchor: "middle" },
  ],

  // "✗ сейчас я хожу" / "✗ иду на машине" — dos errores frecuentes al elegir el verbo de movimiento.
  commonMistakesMotionVerbs: [
    { kind: "rect", x: 14, y: 20, w: 132, h: 32, rx: 12, fill: "danger" },
    { kind: "text", x: 80, y: 38, size: 9, fill: "white", content: "✗ сейчас я хожу", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 48, size: 6, fill: "white", content: "(debería ser: иду)", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 32, rx: 12, fill: "danger" },
    { kind: "text", x: 80, y: 78, size: 9, fill: "white", content: "✗ иду на машине", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6, fill: "white", content: "(debería ser: еду)", opacity: 0.85, anchor: "middle" },
  ],

  // "Мы шли, ехали и даже летели..." — "Она принесла подарок, когда прилетела." — mini historia combinando verbos.
  motionVerbsStoryDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 8.5, fill: "white", content: "Мы шли, ехали и даже летели...", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 8, fill: "white", content: "Она принесла подарок, когда прилетела.", bold: true, anchor: "middle" },
  ],

  // Repaso visual de a2-7: comparativo simple, compuesto, superlativo e irregulares básicos.
  comparativeRecapBridge: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "интереснее (simple)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6, fill: "white", content: "более... (compuesto)", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6.5, fill: "white", content: "самый (superlativo)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6, fill: "white", content: "лучше/хуже (a2-7)", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "esta lección no repite esto — va más allá", bold: true, anchor: "middle" },
  ],

  // дорогой→дороже, дешёвый→дешевле, молодой→моложе, короткий→короче — la familia de mutación consonántica.
  consonantMutationComparativesTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7, fill: "white", content: "дорогой→дороже", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "дешёвый→дешевле", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7, fill: "white", content: "молодой→моложе", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "короткий→короче", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "solo -е, con mutación de consonante", bold: true, anchor: "middle" },
  ],

  // далёкий→дальше, близкий→ближе, лёгкий→легче — más ejemplos del mismo patrón sin regla fonética predecible.
  moreConsonantMutationExamples: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "далёкий→", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 30, size: 6, fill: "accentLight", content: "дальше", anchor: "middle" },
    { kind: "rect", x: 58, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 23, size: 6.5, fill: "white", content: "близкий→", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 30, size: 6, fill: "white", content: "ближе", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 130, y: 23, size: 6.5, fill: "white", content: "лёгкий→", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 30, size: 6, fill: "white", content: "легче", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 78, y: 60, size: 8, fill: "danger", content: "sin regla fonética — hay que memorizarlos", bold: true, anchor: "middle" },
  ],

  // намного/гораздо (mucho más) vs. чуть/немного (un poco más) — intensificadores del comparativo.
  intensifiersMasVsPoco: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 8.5, fill: "white", content: "намного/", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 8.5, fill: "white", content: "гораздо", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 64, size: 6, fill: "accentLight", content: "mucho más", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 44, size: 8.5, fill: "white", content: "чуть/", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 8.5, fill: "white", content: "немного", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 64, size: 6, fill: "white", content: "un poco más", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 8, fill: "brandLight", content: "ambos van antes del comparativo", bold: true, anchor: "middle" },
  ],

  // "✗ очень интереснее" — очень NUNCA se combina con un comparativo en ruso.
  neverUseOchenComparative: [
    { kind: "rect", x: 14, y: 30, w: 132, h: 40, rx: 12, fill: "danger" },
    { kind: "text", x: 80, y: 50, size: 12, fill: "white", content: "✗ очень интереснее", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 7, fill: "white", content: "incorrecto — usa намного/гораздо", opacity: 0.9, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "trampa común: 'muy' sí funciona con el superlativo español", anchor: "middle" },
  ],

  // "Чем больше, тем лучше." — construcción "cuanto más..., más..." con dos comparativos paralelos.
  chemTemConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 12, fill: "white", content: "Чем больше, тем лучше.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 8, fill: "accentLight", content: "cuanto más, mejor", anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 8, fill: "brandLight", content: "чем + comparativo, тем + comparativo", bold: true, anchor: "middle" },
  ],

  // "Он не такой высокий, как ты." — alternativa negativa sin usar la forma comparativa.
  neTakoyKakConstruction: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "Он не такой высокий, как ты.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "él no es tan alto como tú", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 9, fill: "inkSoft", content: "высокий — forma normal, no comparativa", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "danger", content: "'не такой + adj. + как' evita el comparativo", anchor: "middle" },
  ],

  // "Этот отель намного дороже." — "Но он не такой далёкий, как тот." — mini diálogo comparando hoteles.
  comparativesDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9, fill: "white", content: "Этот отель намного дороже.", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 8.5, fill: "white", content: "Но он не такой далёкий, как тот.", bold: true, anchor: "middle" },
  ],

  // быстрый (adjetivo) y быстро (adverbio) comparten exactamente la misma forma comparativa: быстрее.
  adjVsAdvComparativeSameForm: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "inkSoft", content: "быстрый", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "(adjetivo)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "быстро", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "(adverbio)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 9, fill: "brandLight", content: "→ быстрее", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "misma forma comparativa para los dos", anchor: "middle" },
  ],

  // "она быстрее" (adjetivo) vs. "она бежит быстрее" (adverbio) — la prueba de desambiguación.
  adjVsAdvDisambiguationTest: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "она быстрее", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "describe a 'ella' → adjetivo", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 78, size: 9.5, fill: "white", content: "она бежит быстрее", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "white", content: "modifica 'бежит' → adverbio", opacity: 0.85, anchor: "middle" },
  ],

  // хорошо→лучше, плохо→хуже, много→больше, мало→меньше — los mismos irregulares de a2-7, ahora como adverbios.
  adverbComparativeIrregularsRecap: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 7, fill: "white", content: "хорошо→лучше", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 7, fill: "white", content: "плохо→хуже", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 7, fill: "white", content: "много→больше", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "мало→меньше", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "mismas formas que en a2-7, otra función", bold: true, anchor: "middle" },
  ],

  // "Она поёт красивее всех." — comparativo + genitivo plural de "todos" = superlativo, exclusivo del adverbio.
  vsekhSuperlativeConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 12, fill: "white", content: "красивее всех", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 8, fill: "accentLight", content: "la/el que mejor... de todos", anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 8, fill: "brandLight", content: "comparativo + всех — sin самый, solo con adverbios", bold: true, anchor: "middle" },
  ],

  // El español marca el adverbio con -mente, pero en comparativo suele reusar la forma del adjetivo.
  spanishMenteVsRussianCompare: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 7.5, fill: "inkSoft", content: "rápidamente", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "danger", content: "→ más rápido", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 8, fill: "white", content: "быстро", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "accentLight", content: "→ быстрее", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 8, fill: "brandLight", content: "el español abandona -mente en comparativo;", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 7.5, fill: "inkSoft", content: "el ruso nunca tuvo un sufijo adverbial distinto", anchor: "middle" },
  ],

  // наизусть, вслух, внимательно, спокойно, ясно, громко/тихо — vocabulario nuevo de adverbios de manera.
  adverbComparativeVocabGrid: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "наизусть", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 78, y: 23, size: 6.5, fill: "white", content: "внимательно", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 126, y: 23, size: 6.5, fill: "white", content: "спокойно", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 44, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 30, y: 49, size: 6.5, fill: "white", content: "ясно", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 34, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "white", content: "громко", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 34, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 126, y: 49, size: 6.5, fill: "white", content: "тихо", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "adverbios de manera para practicar el comparativo", bold: true, anchor: "middle" },
  ],

  // "✗ самый быстрее" — самый no se combina con adverbios; el superlativo adverbial usa comparativo + всех.
  commonMistakesAdvComparative: [
    { kind: "rect", x: 14, y: 30, w: 132, h: 40, rx: 12, fill: "danger" },
    { kind: "text", x: 80, y: 50, size: 12, fill: "white", content: "✗ самый быстрее", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 7, fill: "white", content: "incorrecto — usa comparativo + всех", opacity: 0.9, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "самый solo se usa con la forma completa del adjetivo", anchor: "middle" },
  ],

  // "Говори тише, пожалуйста." — "Она поёт красивее всех в классе." — mini diálogo con comparativos de adverbios.
  adverbComparativeDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9, fill: "white", content: "Говори тише, пожалуйста.", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 8, fill: "white", content: "Она поёт красивее всех в классе.", bold: true, anchor: "middle" },
  ],

  // самый интересный (a2-7, repaso) — esta lección no lo repite, va más allá.
  superlativeRecapBridge: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "самый интересный", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "самая интересная", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6.5, fill: "white", content: "самое интересное", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "самые интересные", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "esta lección no repite esto — va más allá", bold: true, anchor: "middle" },
  ],

  // лучший → лучшего → лучшему → лучшим → о лучшем — лучший declina como un adjetivo normal en -ий.
  luchshiyKhudshiyDeclensionTable: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "лучший", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 23, size: 6.5, fill: "white", content: "лучшего", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 130, y: 23, size: 6.5, fill: "white", content: "лучшему", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 44, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 30, y: 49, size: 6.5, fill: "white", content: "лучшим", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 34, w: 94, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 105, y: 49, size: 6.5, fill: "inkSoft", content: "о лучшем", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "declina en todos los casos, como любой adjetivo", bold: true, anchor: "middle" },
  ],

  // наилучший, наихудший, наибольший, наименьший — registro formal/literario del superlativo.
  naiPrefixLiteraryForms: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "наилучший", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "наихудший", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6.5, fill: "white", content: "наибольший", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "наименьший", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "registro formal/literario (noticias, documentos)", bold: true, anchor: "middle" },
  ],

  // "из всех" (genitivo plural, grupo) vs. "в мире" (prepositional, lugar) — dos formas de marcar el conjunto de comparación.
  izVsemGenitiveConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 8.5, fill: "white", content: "из всех", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 60, size: 6, fill: "accentLight", content: "genitivo pl. (grupo)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 44, size: 8.5, fill: "white", content: "в мире", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 60, size: 6, fill: "white", content: "prepositional (lugar)", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 8, fill: "brandLight", content: "grupo vs. lugar cambian la preposición", bold: true, anchor: "middle" },
  ],

  // "один из самых красивых городов" — самый+adjetivo y el sustantivo van siempre en genitivo plural.
  odinIzSamykhConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 30, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 50, size: 10, fill: "white", content: "один из самых красивых городов", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 7, fill: "accentLight", content: "una de las ciudades más bellas", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "самых красивых городов — ambos en genitivo plural", anchor: "middle" },
  ],

  // "✗ самый интереснее" incorrecto — pero "✓ самый лучший" sí es correcto (лучший no es comparativo en -ее).
  neverSamyyPlusComparative: [
    { kind: "rect", x: 14, y: 16, w: 132, h: 30, rx: 12, fill: "danger" },
    { kind: "text", x: 80, y: 33, size: 10, fill: "white", content: "✗ самый интереснее", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 43, size: 6, fill: "white", content: "самый exige forma completa", opacity: 0.9, anchor: "middle" },
    { kind: "rect", x: 14, y: 54, w: 132, h: 30, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 71, size: 10, fill: "white", content: "✓ самый лучший", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 81, size: 6, fill: "accentLight", content: "лучший es forma completa: sí vale", anchor: "middle" },
  ],

  // interesantísimo (-ísimo, español) vs. чрезвычайно интересный (ruso, sin sufijo equivalente).
  spanishIsimoVsSamyyCompare: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 44, size: 7.5, fill: "inkSoft", content: "interesantísimo", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6, fill: "danger", content: "sufijo -ísimo (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 7, fill: "white", content: "чрезвычайно", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 50, size: 7, fill: "white", content: "интересный", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 62, size: 6, fill: "accentLight", content: "sin sufijo equivalente (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "el ruso no reduplica la terminación de la palabra", anchor: "middle" },
  ],

  // "Это лучший ресторан в городе?" — "Да, один из самых лучших мест здесь." — mini diálogo sobre el superlativo.
  superlativeDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9, fill: "white", content: "Это лучший ресторан в городе?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 8, fill: "white", content: "Да, один из самых лучших мест здесь.", bold: true, anchor: "middle" },
  ],

  // "Чем больше, тем лучше." (a2-19, repaso) — esta lección no lo repite, va a igualdad y cambio gradual.
  equalityRecapBridge: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "Чем больше, тем лучше.", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6, fill: "white", content: "не такой высокий, как", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 140, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "inkSoft", content: "(a2-19 — ya visto, no se repite aquí)", anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "esta lección va más allá: igualdad y cambio gradual", bold: true, anchor: "middle" },
  ],

  // "Он такой же высокий, как его отец." — такой же concuerda con el sustantivo, como un demostrativo.
  takoyZheKakConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 11, fill: "white", content: "такой же высокий, как", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 7, fill: "accentLight", content: "tan alto como", anchor: "middle" },
    { kind: "text", x: 80, y: 94, size: 7.5, fill: "brandLight", content: "такой же concuerda: -ой/-ая/-ое/-ие", bold: true, anchor: "middle" },
  ],

  // такой же (adjetivo, concuerda) vs. так же (adverbio, invariable) — misma distinción que a2-20.
  takVsTakoyDisambiguation: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 8, fill: "white", content: "такой же", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6, fill: "accentLight", content: "adjetivo, concuerda", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 44, size: 8, fill: "white", content: "так же", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6, fill: "white", content: "adverbio, invariable", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 7.5, fill: "danger", content: "misma distinción de a2-20, aplicada a la igualdad", bold: true, anchor: "middle" },
  ],

  // "Они одинаково умные." — одинаково es invariable, alternativa sin 'как'.
  odinakovoAlternative: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "Они одинаково умные.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "son igual de inteligentes", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 8.5, fill: "inkSoft", content: "одинаково — invariable, sin 'как'", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "danger", content: "la segunda parte de la comparación queda implícita", anchor: "middle" },
  ],

  // "не такой (же) высокий, как" — 'же' es opcional, ambas frases significan lo mismo.
  negationOfEquality: [
    { kind: "rect", x: 14, y: 16, w: 132, h: 30, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 33, size: 9.5, fill: "white", content: "не такой высокий, как", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 43, size: 6, fill: "accentLight", content: "(a2-19)", anchor: "middle" },
    { kind: "rect", x: 14, y: 54, w: 132, h: 30, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 71, size: 9.5, fill: "white", content: "не такой же высокий, как", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 81, size: 6, fill: "white", content: "(же refuerza, opcional)", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 7, fill: "danger", content: "esencialmente el mismo significado", bold: true, anchor: "middle" },
  ],

  // всё лучше / всё быстрее и быстрее (simple) — всё более сложной (forma compuesta, formal) — cambio gradual.
  vsyoComparativeGradualChange: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 22, size: 6.5, fill: "white", content: "всё лучше", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 31, size: 5.5, fill: "accentLight", content: "cada vez mejor", anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 26, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 22, size: 6, fill: "white", content: "всё быстрее и быстрее", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 31, size: 5.5, fill: "white", content: "cada vez más rápido", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 8, y: 38, w: 140, h: 26, rx: 6, fill: "ink" },
    { kind: "text", x: 78, y: 52, size: 6.5, fill: "white", content: "всё более сложной", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 61, size: 5.5, fill: "accentLight", content: "cada vez más complicada (forma compuesta, formal)", anchor: "middle" },
    { kind: "text", x: 78, y: 78, size: 7.5, fill: "danger", content: "simple + comparativo o более/менее + adjetivo completo", bold: true, anchor: "middle" },
  ],

  // 'cada vez más/mejor' (ES) = всё + comparativo (RU); pero 'tan... como' (ES) no distingue adjetivo/adverbio.
  spanishCadaVezCompare: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 7, fill: "inkSoft", content: "cada vez más", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "danger", content: "tan... como (ES, sin distinción)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 7, fill: "white", content: "всё + comparativo", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "accentLight", content: "такой же/так же (RU, sí distingue)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "el ruso distingue adjetivo vs. adverbio, el español no", anchor: "middle" },
  ],

  // "Твой брат такой же высокий, как ты?" — "Да, и он играет в футбол всё увереннее." — mini diálogo.
  equalityDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 35, size: 9, fill: "white", content: "Твой брат такой же высокий, как ты?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 7.5, fill: "white", content: "Да, и он играет в футбол всё увереннее.", bold: true, anchor: "middle" },
  ],

  // кто-то, что-то, какой-то, где-то, куда-то, когда-то, почему-то, как-то — la familia completa de indefinidos con -то.
  neopredelennieMestoimeniyaGrid: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "кто-то", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 23, size: 6.5, fill: "white", content: "что-то", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 130, y: 23, size: 6, fill: "white", content: "какой-то", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 44, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 30, y: 49, size: 6.5, fill: "white", content: "где-то", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 34, w: 44, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 80, y: 49, size: 6, fill: "inkSoft", content: "куда-то", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 34, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 130, y: 49, size: 6, fill: "white", content: "когда-то", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "todas: palabra interrogativa + partícula -то fija", bold: true, anchor: "middle" },
  ],

  // кто-то → кого-то → кому-то → кем-то → о ком-то — solo la parte pronominal declina, -то queda fija.
  ktoChtoToDeclensionTable: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "кто-то", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 23, size: 6.5, fill: "white", content: "кого-то", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 130, y: 23, size: 6.5, fill: "white", content: "кому-то", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 44, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 30, y: 49, size: 6.5, fill: "white", content: "кем-то", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 34, w: 94, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 105, y: 49, size: 6.5, fill: "inkSoft", content: "о ком-то", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "кто-то sigue el mismo patrón: чего-то, чему-то...", bold: true, anchor: "middle" },
  ],

  // какой-то declina completo, como cualquier adjetivo — какой-то → какого-то → какому-то → каким-то.
  kakoyToAdjectiveDeclension: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "какой-то (nom.)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "какого-то (gen.)", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6.5, fill: "white", content: "какому-то (dat.)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "каким-то (instr.)", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "concuerda en género/número/caso, como любой adjetivo", bold: true, anchor: "middle" },
  ],

  // где-то, куда-то, когда-то, почему-то, как-то — invariables, no declinan.
  toAdverbsFamily: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 42, size: 7, fill: "white", content: "где-то / куда-то", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "accentLight", content: "lugar / dirección", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 42, size: 7, fill: "white", content: "когда-то / как-то", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "tiempo / manera", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 8, fill: "brandLight", content: "invariables — nunca cambian de forma", bold: true, anchor: "middle" },
  ],

  // "Это чья-то сумка." — чей-то declina completo como un posesivo: чей-то/чья-то/чьё-то/чьи-то.
  cheyToPossessive: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "Это чья-то сумка.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "esto es la bolsa de alguien", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 8, fill: "inkSoft", content: "чей-то / чья-то / чьё-то / чьи-то", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "danger", content: "declina como un posesivo normal", anchor: "middle" },
  ],

  // "Кто-то звонил." (hecho concreto, -то) vs. "Кто-нибудь звонил?" (pregunta/hipótesis, -нибудь).
  toVsNibudSneakPeek: [
    { kind: "rect", x: 14, y: 16, w: 132, h: 30, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 33, size: 10, fill: "white", content: "Кто-то звонил.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 43, size: 6, fill: "accentLight", content: "hecho concreto — alguien SÍ llamó", anchor: "middle" },
    { kind: "rect", x: 14, y: 54, w: 132, h: 30, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 71, size: 10, fill: "white", content: "Кто-нибудь звонил?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 81, size: 6, fill: "white", content: "pregunta — no sabemos si pasó", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 7, fill: "danger", content: "-нибудь se profundiza en la siguiente lección", bold: true, anchor: "middle" },
  ],

  // "alguien/algo" (ES, invariable) vs. кто-то/что-то (RU, declina la parte pronominal).
  spanishAlguienNoDeclineCompare: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 44, size: 8, fill: "inkSoft", content: "alguien / algo", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6, fill: "danger", content: "invariable (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 7, fill: "white", content: "кто-то → кого-то", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 50, size: 7, fill: "white", content: "→ кому-то...", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 62, size: 6, fill: "accentLight", content: "declina por caso (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "el español no declina; el ruso sí", anchor: "middle" },
  ],

  // "Кто-то звонит в дверь. Ты кого-то ждёшь?" — "Нет, но я купил кому-то подарок вчера." — mini diálogo.
  indefinitePronounsDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 30, size: 8, fill: "white", content: "Кто-то звонит в дверь.", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 40, size: 7.5, fill: "white", content: "Ты кого-то ждёшь?", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 7.5, fill: "white", content: "Нет, но я купил кому-то подарок вчера.", bold: true, anchor: "middle" },
  ],

  // "Кто-то звонил." (a2-23, hecho concreto) vs. "Кто-нибудь звонил?" (esta lección, incierto/pregunta).
  nibudRecapBridge: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "Кто-то звонил.", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6, fill: "white", content: "Кто-нибудь звонил?", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 140, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "inkSoft", content: "(a2-23 vs. esta lección)", anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "-то = hecho afirmativo, -нибудь = incierto", bold: true, anchor: "middle" },
  ],

  // кто-нибудь → кого-нибудь → кому-нибудь → кем-нибудь — mismo patrón de declinación que -то.
  ktoChtoNibudDeclensionTable: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6, fill: "white", content: "кто-нибудь", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 23, size: 6, fill: "white", content: "кого-нибудь", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 130, y: 23, size: 6, fill: "white", content: "кому-нибудь", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 42, y: 49, size: 6, fill: "white", content: "кем-нибудь", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 114, y: 49, size: 6, fill: "inkSoft", content: "о ком-нибудь", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "кто-нибудь sigue el mismo patrón", bold: true, anchor: "middle" },
  ],

  // какой-нибудь declina completo, como cualquier adjetivo — какой-нибудь → какого-нибудь → какому-нибудь.
  kakoyNibudDeclensionTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6, fill: "white", content: "какой-нибудь", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6, fill: "white", content: "какого-нибудь", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6, fill: "white", content: "какому-нибудь", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6, fill: "white", content: "каким-нибудь", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "concuerda en género/número/caso", bold: true, anchor: "middle" },
  ],

  // pregunta / condicional / petición / futuro — los cuatro contextos típicos de uso de -нибудь.
  nibudUsageContexts: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "¿pregunta?", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "если... (condicional)", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6.5, fill: "white", content: "дай мне... (petición)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "futuro", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "los cuatro contextos típicos de -нибудь", bold: true, anchor: "middle" },
  ],

  // "какие-либо вопросы" (formal/escrito) = "какие-нибудь вопросы" (coloquial) — mismo significado.
  liboFormalSynonym: [
    { kind: "rect", x: 14, y: 16, w: 132, h: 30, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 33, size: 9.5, fill: "white", content: "какие-либо вопросы", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 43, size: 6, fill: "accentLight", content: "registro formal/escrito", anchor: "middle" },
    { kind: "rect", x: 14, y: 54, w: 132, h: 30, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 71, size: 9.5, fill: "white", content: "какие-нибудь вопросы", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 81, size: 6, fill: "white", content: "registro coloquial", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 7, fill: "danger", content: "mismo significado, distinto registro", bold: true, anchor: "middle" },
  ],

  // "✗ Кто-то придёт завтра?" incorrecto — "✓ Кто-нибудь придёт завтра?" correcto (pregunta sobre el futuro).
  commonMistakeToInWrongContext: [
    { kind: "rect", x: 14, y: 16, w: 132, h: 30, rx: 12, fill: "danger" },
    { kind: "text", x: 80, y: 33, size: 10, fill: "white", content: "✗ Кто-то придёт завтра?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 43, size: 6, fill: "white", content: "incorrecto en pregunta/futuro", opacity: 0.9, anchor: "middle" },
    { kind: "rect", x: 14, y: 54, w: 132, h: 30, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 71, size: 10, fill: "white", content: "✓ Кто-нибудь придёт завтра?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 81, size: 6, fill: "accentLight", content: "correcto — pregunta sobre el futuro", anchor: "middle" },
  ],

  // где-нибудь, куда-нибудь, когда-нибудь, как-нибудь — invariables, para incertidumbre.
  nibudAdverbsFamily: [
    { kind: "circle", cx: 80, cy: 60, r: 50, fill: "brand", opacity: 0.05 },
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 42, size: 6.5, fill: "white", content: "где-нибудь /", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 52, size: 6.5, fill: "white", content: "куда-нибудь", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 62, size: 6, fill: "accentLight", content: "lugar / dirección", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 42, size: 6.5, fill: "white", content: "когда-нибудь /", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 52, size: 6.5, fill: "white", content: "как-нибудь", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 62, size: 6, fill: "white", content: "tiempo / manera", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "invariables — mismo patrón que -то (a2-23)", anchor: "middle" },
  ],

  // "alguien/algo/algún" (ES, una sola forma) vs. -то/-нибудь (RU, dos categorías distintas).
  spanishNoToNibudDistinction: [
    { kind: "rect", x: 10, y: 24, w: 132, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 76, y: 44, size: 8, fill: "inkSoft", content: "alguien / algo / algún", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 58, size: 6.5, fill: "danger", content: "una sola forma para todo (ES)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 8, fill: "brandLight", content: "-то (hecho) frente a -нибудь (incierto) — distinción exclusiva del ruso", bold: true, anchor: "middle" },
  ],

  // "Я ничего не вижу." (a1-21, repaso básico) — esta lección profundiza: declinación completa + preposiciones.
  negativePronounsA1RecapBridge: [
    { kind: "rect", x: 8, y: 8, w: 140, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 78, y: 23, size: 7, fill: "white", content: "Я ничего не вижу. (a1-21)", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 140, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "inkSoft", content: "doble negación básica — ya la conoces", anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "esta lección va más allá: declinación + preposiciones", bold: true, anchor: "middle" },
  ],

  // никто → никого → никому → никем — declinación completa del pronombre negativo.
  niktoFullDeclensionTable: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "никто", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 23, size: 6.5, fill: "white", content: "никого", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 130, y: 23, size: 6.5, fill: "white", content: "никому", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 140, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "white", content: "никем (instrumental)", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "declina exactamente como кто, con 'ни-' fijo", bold: true, anchor: "middle" },
  ],

  // ничто (raro, sujeto) → ничего (gen./acus., objeto común) → ничему → ничем.
  nichtoFullDeclensionTable: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "ничто", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 23, size: 6.5, fill: "white", content: "ничего", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 130, y: 23, size: 6.5, fill: "white", content: "ничему", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 140, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "white", content: "ничем (instrumental)", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "ничего es la forma de objeto más común", bold: true, anchor: "middle" },
  ],

  // "✗ с никем" incorrecto — "✓ ни с кем" correcto: la preposición se inserta entre 'ни' y la forma declinada.
  prepositionSplitRule: [
    { kind: "rect", x: 14, y: 16, w: 132, h: 30, rx: 12, fill: "danger" },
    { kind: "text", x: 80, y: 33, size: 10, fill: "white", content: "✗ с никем", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 43, size: 6, fill: "white", content: "incorrecto", opacity: 0.9, anchor: "middle" },
    { kind: "rect", x: 14, y: 54, w: 132, h: 30, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 71, size: 10, fill: "white", content: "✓ ни с кем", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 81, size: 6, fill: "accentLight", content: "ни + preposición + forma declinada", anchor: "middle" },
  ],

  // никакой/никакая/никакое/никакие — declina completo como cualquier adjetivo.
  nikakoyAdjectiveAgreement: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "никакой (masc.)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "никакая (fem.)", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6.5, fill: "white", content: "никакое (neutro)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "никакие (plural)", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "concuerda en género/número/caso, como любой adjetivo", bold: true, anchor: "middle" },
  ],

  // "Ни один студент не сдал экзамен." — ни один refuerza la negación con sustantivos contables.
  niOdinConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 10, fill: "white", content: "Ни один студент не сдал.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "accentLight", content: "ni un solo estudiante aprobó", anchor: "middle" },
    { kind: "text", x: 80, y: 94, size: 7.5, fill: "brandLight", content: "más enfático que 'никто не сдал'", bold: true, anchor: "middle" },
  ],

  // "Ничто не вечно." (sujeto, formal/proverbio) vs. "Я ничего не вижу." (objeto, cotidiano).
  nichtoVsNichegoRegister: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "Ничто не вечно.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "sujeto — formal/literario/proverbio", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 9, fill: "inkSoft", content: "Я ничего не вижу.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "danger", content: "objeto — forma cotidiana habitual", anchor: "middle" },
  ],

  // "con nadie" (ES, una sola palabra) vs. "ни с кем" (RU, tres piezas: ни + preposición + forma).
  spanishNegationPrepositionCompare: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 44, size: 8, fill: "inkSoft", content: "con nadie", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6, fill: "danger", content: "una sola palabra (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 7, fill: "white", content: "ни с кем", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "accentLight", content: "tres piezas fragmentadas (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "el ruso divide el pronombre; el español no", anchor: "middle" },
  ],

  // "Я никогда не был в Париже." (a1-21, repaso básico) — esta lección profundiza: familia completa + síntesis.
  adverbNegRecapBridge: [
    { kind: "rect", x: 8, y: 8, w: 140, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 78, y: 23, size: 6.5, fill: "white", content: "Я никогда не был в Париже. (a1-21)", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 140, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "inkSoft", content: "doble negación básica — ya la conoces", anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "esta lección va más allá: familia completa + síntesis", bold: true, anchor: "middle" },
  ],

  // где→нигде, куда→никуда, когда→никогда, как→никак — los cuatro pares base de la familia negativa.
  adverbFamilyFullGrid: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "где → нигде", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "куда → никуда", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6.5, fill: "white", content: "когда → никогда", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "как → никак", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "todos con el prefijo 'ни-' fijo", bold: true, anchor: "middle" },
  ],

  // "Я никак не могу решить эту задачу." — никак enfatiza la imposibilidad, no un simple 'no'.
  nikakConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 10.5, fill: "white", content: "Я никак не могу решить.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "accentLight", content: "no logro decidir de ninguna manera", anchor: "middle" },
    { kind: "text", x: 80, y: 94, size: 7.5, fill: "brandLight", content: "énfasis en la imposibilidad, muy usado con мочь", bold: true, anchor: "middle" },
  ],

  // "Эта посылка ниоткуда не пришла." — откуда→ниоткуда, extensión menos frecuente del mismo patrón.
  niotkudaExtension: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 9.5, fill: "white", content: "Посылка ниоткуда не пришла.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "el paquete no llegó de ningún lugar", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 8.5, fill: "inkSoft", content: "откуда → ниоткуда", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "danger", content: "mismo patrón, menos frecuente", anchor: "middle" },
  ],

  // где → где-то (a2-23) → где-нибудь (a2-24) → нигде — el sistema completo de cuatro categorías.
  fourWaySynthesisTable: [
    { kind: "rect", x: 8, y: 8, w: 34, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 25, y: 23, size: 6.5, fill: "inkSoft", content: "где", bold: true, anchor: "middle" },
    { kind: "rect", x: 45, y: 8, w: 34, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 62, y: 23, size: 6, fill: "white", content: "где-то", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 8, w: 34, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 99, y: 23, size: 5.5, fill: "white", content: "где-нибудь", bold: true, anchor: "middle" },
    { kind: "rect", x: 119, y: 8, w: 34, h: 22, rx: 6, fill: "danger" },
    { kind: "text", x: 136, y: 23, size: 6, fill: "white", content: "нигде", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 43, size: 6, fill: "inkSoft", content: "interrogativo → hecho (a2-23) → incierto (a2-24) → negación", anchor: "middle" },
    { kind: "text", x: 78, y: 60, size: 7.5, fill: "danger", content: "mismo sistema para куда/когда/как", bold: true, anchor: "middle" },
  ],

  // "Я никогда не был..." (habitual, antes del verbo) vs. final de frase para dar énfasis coloquial.
  wordOrderFlexibility: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 7.5, fill: "white", content: "adverbio + не", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6, fill: "accentLight", content: "antes del verbo (habitual)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 44, size: 7.5, fill: "white", content: "al final", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6, fill: "white", content: "énfasis coloquial", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "mismo significado en ambos casos", anchor: "middle" },
  ],

  // "Она красива как никогда." (más que nunca) — "Никогда в жизни..." (nunca en la vida) — expresiones idiomáticas.
  idiomaticNikogdaExpressions: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "Она красива как никогда.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "más hermosa que nunca", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 78, size: 9.5, fill: "white", content: "Никогда в жизни...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "white", content: "nunca en la vida — refuerzo enfático", opacity: 0.85, anchor: "middle" },
  ],

  // "nunca / en ningún lugar / de ninguna manera" (ES, varias palabras) vs. никогда/нигде/никак (RU, una sola).
  spanishNuncaCompare: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "inkSoft", content: "nunca / en ningún", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 50, size: 6.5, fill: "inkSoft", content: "lugar / de ninguna", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 60, size: 6, fill: "danger", content: "varias palabras (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 44, size: 7, fill: "white", content: "никогда / нигде", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 7, fill: "white", content: "/ никак", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 64, size: 6, fill: "accentLight", content: "una sola palabra (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7, fill: "brandLight", content: "ambos idiomas exigen doble negación", anchor: "middle" },
  ],

  // "У меня болит голова." (a2-8, repaso básico) — esta lección profundiza: especialistas, cita, farmacia, instrumental.
  healthA2RecapBridge: [
    { kind: "rect", x: 8, y: 8, w: 140, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 78, y: 23, size: 6.5, fill: "white", content: "У меня болит голова. (a2-8)", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 140, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "inkSoft", content: "síntoma localizado — ya lo conoces", anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 8, fill: "danger", content: "esta lección va más allá: especialistas, cita, farmacia", bold: true, anchor: "middle" },
  ],

  // "У меня болит горло." (impersonal, síntoma) vs. "Я болею ангиной." (personal + instrumental, diagnóstico).
  boletVsInstrumentalContrast: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "У меня болит горло.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "impersonal — síntoma localizado (a2-8)", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 78, size: 9.5, fill: "white", content: "Я болею ангиной.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "white", content: "personal + instrumental — diagnóstico", opacity: 0.85, anchor: "middle" },
  ],

  // грипп→болеть гриппом, ангина→болеть ангиной, простуда→болеть простудой — la enfermedad siempre en instrumental.
  illnessInstrumentalExamples: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "гриппом", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 23, size: 6.5, fill: "white", content: "ангиной", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 130, y: 23, size: 6, fill: "white", content: "простудой", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 43, size: 7, fill: "inkSoft", content: "болеть + instrumental de la enfermedad", anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "nunca en nominativo con esta construcción", bold: true, anchor: "middle" },
  ],

  // терапевт, стоматолог, окулист, кардиолог — grid de especialistas médicos.
  medicalSpecialistsGrid: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "терапевт", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "стоматолог", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6.5, fill: "white", content: "окулист", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "кардиолог", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "elige el especialista correcto para pedir cita", bold: true, anchor: "middle" },
  ],

  // "Я хочу записаться на приём к терапевту." — "У вас есть свободное время на завтра?" — mini diálogo de cita.
  appointmentBookingDialogue: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 10, y: 14, w: 132, h: 32, rx: 14, fill: "brand" },
    { kind: "path", d: "M28 46 L22 58 L42 46 Z", fill: "brand" },
    { kind: "text", x: 76, y: 30, size: 7.5, fill: "white", content: "Хочу записаться на приём", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 40, size: 7.5, fill: "white", content: "к терапевту.", bold: true, anchor: "middle" },
    { kind: "rect", x: 12, y: 64, w: 134, h: 32, rx: 14, fill: "accentLight" },
    { kind: "path", d: "M142 64 L148 52 L128 64 Z", fill: "accentLight" },
    { kind: "text", x: 79, y: 85, size: 7.5, fill: "white", content: "Есть время завтра в 15:00.", bold: true, anchor: "middle" },
  ],

  // "Дайте мне что-нибудь от головной боли." — "Без рецепта?" — vocabulario de la farmacia.
  pharmacyVisitConstruction: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 32, size: 8.5, fill: "white", content: "Дайте что-нибудь от", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 43, size: 8.5, fill: "white", content: "головной боли.", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 9, fill: "inkSoft", content: "рецепт vs. без рецепта", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "danger", content: "con receta vs. venta libre", anchor: "middle" },
  ],

  // "Я болею уже три дня." — "Симптомы начались вчера." — expresiones de duración de la enfermedad.
  illnessDurationExpressions: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 42, size: 7, fill: "white", content: "уже три дня", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6, fill: "accentLight", content: "desde hace tres días", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 42, size: 6.5, fill: "white", content: "начались вчера", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6, fill: "white", content: "empezaron ayer", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "muy frecuentes en la consulta médica", anchor: "middle" },
  ],

  // "рецепт" = "receta" (médica y de cocina, ES=RU) — pero болеть-impersonal vs. instrumental no tiene par en español.
  spanishRecetaParallelCompare: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "white", content: "рецепт / receta", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6, fill: "accentLight", content: "médica y de cocina, igual", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 42, size: 7, fill: "inkSoft", content: "болеть impersonal", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 52, size: 7, fill: "inkSoft", content: "vs. instrumental", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 62, size: 6, fill: "danger", content: "sin equivalente en español", anchor: "middle" },
  ],

  // рубашка, платье, куртка, юбка, свитер, туфли — vocabulario esencial de prendas de ropa.
  clothingVocabGrid: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "рубашка", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 8, w: 44, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 23, size: 6.5, fill: "white", content: "платье", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 44, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 130, y: 23, size: 6.5, fill: "white", content: "куртка", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 44, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 30, y: 49, size: 6.5, fill: "white", content: "юбка", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 34, w: 44, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 80, y: 49, size: 6.5, fill: "inkSoft", content: "свитер", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 34, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 130, y: 49, size: 6.5, fill: "white", content: "туфли", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "vocabulario esencial de esta lección", bold: true, anchor: "middle" },
  ],

  // "Эти брюки мне велики." — брюки/джинсы solo existen en plural, nunca hay forma singular.
  pluraleTantumClothing: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "Эти брюки мне велики.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "estos pantalones me quedan grandes", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "danger" },
    { kind: "text", x: 80, y: 78, size: 9.5, fill: "white", content: "✗ этот брюк", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "white", content: "no existe forma singular", opacity: 0.9, anchor: "middle" },
  ],

  // красное платье (neutro), синяя рубашка (femenino), чёрные туфли (plural) — repaso de concordancia de color.
  colorAdjectiveAgreement: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "красное платье", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "синяя рубашка", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 140, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "white", content: "чёрные туфли (plural)", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "el color concuerda como cualquier adjetivo", bold: true, anchor: "middle" },
  ],

  // "мне идёт" (estilo) vs. "мне мало/велико" (talla) — dos juicios dativos independientes sobre la misma prenda.
  idyotVsMaloDistinction: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "мне идёт", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "me favorece — ESTILO", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 78, size: 9.5, fill: "white", content: "мне мало / велико", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "white", content: "queda pequeño/grande — TALLA", opacity: 0.85, anchor: "middle" },
  ],

  // "У вас есть размер побольше?" — по- + comparativo simple (a2-19/20) para pedir 'un poco más' de algo.
  comparativeSizeRequest: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 10, fill: "white", content: "У вас есть размер побольше?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "accentLight", content: "¿tiene una talla más grande?", anchor: "middle" },
    { kind: "text", x: 80, y: 94, size: 7.5, fill: "brandLight", content: "по- + comparativo (a2-19/20) = 'un poco más'", bold: true, anchor: "middle" },
  ],

  // "Если это будет мало, я верну." — repaso de если + futuro (a2-24) aplicado a una situación de compras.
  conditionalReturnConstruction: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 9.5, fill: "white", content: "Если это будет мало,", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 9.5, fill: "white", content: "я верну.", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 8, fill: "inkSoft", content: "si me queda pequeño, lo devuelvo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "danger", content: "если + futuro (repaso a2-24)", anchor: "middle" },
  ],

  // обмен (cambio de artículo) vs. возврат (reembolso del dinero) — dos procesos distintos en la tienda.
  obmenVsVozvratDistinction: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 44, size: 8, fill: "white", content: "обмен", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6, fill: "accentLight", content: "cambio de artículo", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 44, size: 8, fill: "white", content: "возврат", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6, fill: "white", content: "reembolso del dinero", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "dos procesos distintos, dos palabras distintas", anchor: "middle" },
  ],

  // "te queda bien" (ES, cubre estilo y talla) vs. идёт/мало-велико (RU, dos construcciones separadas).
  spanishQuedarCompare: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 7, fill: "inkSoft", content: "te queda bien", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "danger", content: "estilo + talla, una sola frase (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 7, fill: "white", content: "идёт / мало-велико", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "accentLight", content: "separadas estrictamente (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "el ruso distingue estilo de talla; el español no", anchor: "middle" },
  ],

  // "Идите прямо, поверните направо." (a1-29) / "На улице холодно." (a2-4) — repaso básico combinado.
  navigationWeatherRecapBridge: [
    { kind: "rect", x: 8, y: 8, w: 140, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 78, y: 23, size: 6.5, fill: "white", content: "Идите прямо, поверните направо. (a1-29)", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 140, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "inkSoft", content: "На улице холодно. (a2-4) — ya lo conoces", anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "esta lección va más allá: pronóstico + до- + perderse", bold: true, anchor: "middle" },
  ],

  // "Завтра будет дождь." — futuro de быть + clima, pronóstico.
  weatherForecastFuture: [
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 11, fill: "white", content: "Завтра будет дождь.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 7, fill: "accentLight", content: "mañana lloverá", anchor: "middle" },
    { kind: "text", x: 80, y: 94, size: 7.5, fill: "brandLight", content: "будет (futuro de быть) + clima", bold: true, anchor: "middle" },
  ],

  // "Обещают дождь на выходных." — plural impersonal idiomático, sin sujeto explícito, para reportar el pronóstico.
  obeshchayutWeatherIdiom: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 9.5, fill: "white", content: "Обещают дождь на выходных.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "pronostican lluvia para el fin de semana", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 8, fill: "inkSoft", content: "обещают — literalmente 'prometen'", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "danger", content: "plural impersonal, sin sujeto", anchor: "middle" },
  ],

  // доехать (vehículo) / дойти (a pie) — nuevo prefijo до- 'hasta', junto a по-/при-/у- de a2-14 a a2-18.
  doPrefixArrivalVerbs: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "доехать (до)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "дойти (до)", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 140, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 78, y: 49, size: 6.5, fill: "inkSoft", content: "до- = 'hasta un destino específico'", anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "nuevo prefijo, junto a по-/при-/у- (a2-14 a 18)", bold: true, anchor: "middle" },
  ],

  // "Я заблудился, вы не подскажете дорогу?" — frases de supervivencia si te pierdes.
  gettingLostPhrases: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 50, size: 9.5, fill: "white", content: "Я заблудился.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 8, fill: "white", content: "Не подскажете дорогу?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "me perdí — ¿podría indicarme el camino?", anchor: "middle" },
  ],

  // "На каком автобусе можно доехать до центра?" — на + prepositional (transporte) + доехать до + genitivo (destino).
  publicTransportWayfinding: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 42, size: 7, fill: "white", content: "на автобусе", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "accentLight", content: "transporte (repaso)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 42, size: 7, fill: "white", content: "доехать до", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "destino (genitivo)", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7, fill: "brandLight", content: "combinados: на каком автобусе доехать до...", anchor: "middle" },
  ],

  // "Если будет дождь, мы останемся дома." — если (repaso a2-24) + будет (pronóstico), condición sobre el clima.
  conditionalWeatherPlanning: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 33, size: 9, fill: "white", content: "Если будет дождь,", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 44, size: 9, fill: "white", content: "мы останемся дома.", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 58, w: 132, h: 34, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 76, size: 8, fill: "inkSoft", content: "si llueve, nos quedaremos en casa", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 87, size: 6.5, fill: "danger", content: "если (a2-24) + будет (pronóstico)", anchor: "middle" },
  ],

  // "mañana lloverá" (ES, futuro similar) vs. "llegar hasta" (ES, dos palabras) frente a доехать/дойти (RU, una sola).
  spanishPronosticoCompare: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "inkSoft", content: "mañana lloverá", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "danger", content: "futuro, paralelo directo", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 7, fill: "white", content: "llegar hasta", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 50, size: 7, fill: "white", content: "= доехать/дойти", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 62, size: 6, fill: "accentLight", content: "dos palabras (ES) vs. una (RU)", anchor: "middle" },
  ],

  // высокий/низкий/среднего роста, худой/полный/спортивный — vocabulario de altura y complexión.
  physicalHeightBuildGrid: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6, fill: "white", content: "среднего роста", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6.5, fill: "white", content: "спортивного", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6.5, fill: "white", content: "худой", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 6.5, fill: "white", content: "полный", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "altura y complexión, vocabulario básico", bold: true, anchor: "middle" },
  ],

  // "У неё длинные тёмные волосы." — "У него голубые глаза." — у + genitivo, repaso de posesión aplicado al aspecto.
  hairEyesUGenitiveConstruction: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 9.5, fill: "white", content: "У неё длинные тёмные волосы.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6, fill: "accentLight", content: "ella tiene el cabello largo y oscuro", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 78, size: 9.5, fill: "white", content: "У него голубые глаза.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6, fill: "white", content: "él tiene ojos azules", opacity: 0.85, anchor: "middle" },
  ],

  // "у меня голубые глаза" (rasgo, sin 'есть') vs. "у меня есть книга" (posesión de objeto, con 'есть').
  estNoEstNuanceForTraits: [
    { kind: "rect", x: 14, y: 16, w: 132, h: 30, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 33, size: 9.5, fill: "white", content: "у меня голубые глаза", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 43, size: 6, fill: "accentLight", content: "rasgo inherente — SIN 'есть'", anchor: "middle" },
    { kind: "rect", x: 14, y: 54, w: 132, h: 30, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 71, size: 9.5, fill: "inkSoft", content: "у меня есть книга", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 81, size: 6, fill: "danger", content: "posesión de un objeto — CON 'есть'", anchor: "middle" },
  ],

  // круглое/овальное лицо, борода/усы, в очках — rasgos de la cara.
  faceFeaturesGlassesBeard: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 42, size: 7, fill: "white", content: "борода / усы", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "accentLight", content: "barba / bigote", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 119, y: 42, size: 7, fill: "white", content: "в очках", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "con gafas", opacity: 0.85, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7, fill: "brandLight", content: "круглое / овальное лицо", anchor: "middle" },
  ],

  // добрый/злой, весёлый/грустный, умный/глупый, трудолюбивый/ленивый — grid de adjetivos de carácter opuestos.
  characterVocabGrid: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 42, y: 23, size: 6.5, fill: "white", content: "добрый / злой", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 23, size: 6, fill: "white", content: "весёлый / грустный", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 34, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 42, y: 49, size: 6, fill: "white", content: "умный / глупый", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 114, y: 49, size: 5.5, fill: "white", content: "трудолюбивый / ленивый", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 68, size: 7.5, fill: "danger", content: "pares opuestos de carácter", bold: true, anchor: "middle" },
  ],

  // очень (muy) — довольно (bastante) — немного (un poco) — escala de tres niveles de intensidad.
  intensifiersDovolnoScale: [
    { kind: "rect", x: 8, y: 24, w: 44, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 30, y: 44, size: 7, fill: "white", content: "очень", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 58, size: 5.5, fill: "accentLight", content: "muy", anchor: "middle" },
    { kind: "rect", x: 58, y: 24, w: 44, h: 44, rx: 10, fill: "brandLight" },
    { kind: "text", x: 80, y: 44, size: 7, fill: "white", content: "довольно", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 5.5, fill: "white", content: "bastante", opacity: 0.85, anchor: "middle" },
    { kind: "rect", x: 108, y: 24, w: 44, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 130, y: 44, size: 6.5, fill: "inkSoft", content: "немного", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 58, size: 5.5, fill: "danger", content: "un poco", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7, fill: "brandLight", content: "довольно es un matiz nuevo, entre los otros dos", anchor: "middle" },
  ],

  // "Мой брат добрее, чем я." / "Она самая весёлая в нашей семье." — repaso comparativo/superlativo (a2-19/21) aplicado al carácter.
  comparativeSuperlativeCharacterReview: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 9.5, fill: "white", content: "Мой брат добрее, чем я.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6, fill: "accentLight", content: "comparativo (a2-19)", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "brandLight" },
    { kind: "text", x: 80, y: 78, size: 9, fill: "white", content: "Она самая весёлая в семье.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6, fill: "white", content: "superlativo (a2-21)", opacity: 0.85, anchor: "middle" },
  ],

  // "он весёлый" = 'él es alegre' O 'él está alegre' (RU, una sola forma) — el español exige elegir ser/estar.
  spanishSerEstarTraitsCompare: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 7, fill: "white", content: "он весёлый", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "accentLight", content: "una sola forma (RU)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "inkSoft", content: "es / está alegre", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "danger", content: "dos verbos obligatorios (ES)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7, fill: "brandLight", content: "el ruso no distingue rasgo de estado", anchor: "middle" },
  ],

  // "Я не пошёл на работу, потому что я заболел." — потому что introduce la causa, nunca abre la oración.
  potomuChtoCauseConstruction: [
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 50, size: 9, fill: "white", content: "...потому что я заболел.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 64, size: 6.5, fill: "accentLight", content: "porque me enfermé", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "la causa va SIEMPRE después de la consecuencia", bold: true, anchor: "middle" },
  ],

  // "Так как я заболел, я не пошёл на работу." — так как (formal), a diferencia de потому что, sí abre la oración.
  takKakFormalCauseSynonym: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 9.5, fill: "white", content: "Так как я заболел,...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6, fill: "accentLight", content: "ya que me enfermé (formal)", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 8.5, fill: "inkSoft", content: "так как SÍ puede abrir la oración", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "danger", content: "потому que NUNCA puede", anchor: "middle" },
  ],

  // "Я заболел, поэтому я не пошёл на работу." — поэтому introduce la consecuencia, dirección opuesta a потому что.
  poetomuConsequenceConstruction: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 34, w: 132, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 10, fill: "white", content: "Я заболел, поэтому...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "accentLight", content: "me enfermé, por eso...", anchor: "middle" },
    { kind: "text", x: 80, y: 94, size: 7.5, fill: "brandLight", content: "causa primero, поэтому + consecuencia", bold: true, anchor: "middle" },
  ],

  // "Я пошёл на работу, хотя я заболел." — хотя introduce un hecho contradictorio sin cambiar el resultado.
  khotyaConcessionConstruction: [
    { kind: "rect", x: 14, y: 18, w: 132, h: 34, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 10, fill: "white", content: "Я пошёл на работу,", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 6.5, fill: "accentLight", content: "хотя я заболел", anchor: "middle" },
    { kind: "rect", x: 14, y: 60, w: 132, h: 34, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 8, fill: "inkSoft", content: "fui a trabajar, aunque me enfermé", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 89, size: 6.5, fill: "danger", content: "hecho contrario, mismo resultado", anchor: "middle" },
  ],

  // "Несмотря на то, что я заболел, я пошёл на работу." — sinónimo formal de хотя; несмотря на + acusativo con sustantivo.
  nesmotryaNaToChtoFormalConcession: [
    { kind: "rect", x: 14, y: 16, w: 132, h: 30, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 33, size: 8.5, fill: "white", content: "Несмотря на то, что я заболел...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 43, size: 6, fill: "accentLight", content: "a pesar de que me enfermé (formal)", anchor: "middle" },
    { kind: "rect", x: 14, y: 54, w: 132, h: 30, rx: 12, fill: "muted" },
    { kind: "text", x: 80, y: 71, size: 8.5, fill: "inkSoft", content: "несмотря на дождь", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 81, size: 6, fill: "danger", content: "+ sustantivo → acusativo directo", anchor: "middle" },
  ],

  // причина + потому что/так как + resultado  <->  resultado + поэтому + причина — esquema de flujo causa/consecuencia.
  causeConsequenceDiagram: [
    { kind: "rect", x: 8, y: 8, w: 44, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 30, y: 23, size: 6.5, fill: "white", content: "причина", bold: true, anchor: "middle" },
    { kind: "path", d: "M58 19 L78 19 L72 14 M78 19 L72 24", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "rect", x: 82, y: 8, w: 66, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 115, y: 23, size: 6, fill: "white", content: "потому что/так как", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 40, w: 66, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 41, y: 55, size: 6, fill: "white", content: "resultado", bold: true, anchor: "middle" },
    { kind: "path", d: "M82 51 L102 51 L96 46 M102 51 L96 56", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "rect", x: 106, y: 40, w: 44, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 128, y: 55, size: 6, fill: "white", content: "поэтому", bold: true, anchor: "middle" },
    { kind: "text", x: 78, y: 82, size: 7, fill: "danger", content: "хотя / несмотря на то, que rompen esta relación esperada", bold: true, anchor: "middle" },
  ],

  // потому что/поэтому/хотя (neutro, habla cotidiana) vs. так как/—/несмотря на то, que (formal, texto escrito).
  registerComparisonTable: [
    { kind: "rect", x: 8, y: 8, w: 68, h: 46, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 24, size: 6.5, fill: "white", content: "потому что", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 34, size: 6.5, fill: "white", content: "поэтому", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 44, size: 6.5, fill: "white", content: "хотя", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 54, size: 5.5, fill: "accentLight", content: "neutro / cotidiano", anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 46, rx: 8, fill: "muted" },
    { kind: "text", x: 114, y: 24, size: 6, fill: "inkSoft", content: "так как", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 34, size: 6, fill: "inkSoft", content: "несмотря на то,", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 44, size: 6, fill: "inkSoft", content: "что", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 54, size: 5.5, fill: "danger", content: "formal / escrito", anchor: "middle" },
  ],

  // "porque/por eso/aunque" (ES) = потому что/поэтому/хотя (RU) — paralelo casi exacto, incluida la distinción de registro.
  spanishConnectorsParallelCompare: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 7, fill: "inkSoft", content: "porque / por eso", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "danger", content: "aunque (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 7, fill: "white", content: "потому что / поэтому", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "accentLight", content: "хотя (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "paralelo casi exacto, incluido el registro", anchor: "middle" },
  ],

  // "Я даю книгу другу." — el objeto indirecto en dativo, sin preposición, marcado por la terminación -у.
  dativeIndirectObjectDeepen: [
    { kind: "rect", x: 10, y: 44, w: 46, h: 32, rx: 8, fill: "brand" },
    { kind: "text", x: 33, y: 64, size: 8, fill: "white", content: "книгу", bold: true, anchor: "middle" },
    { kind: "path", d: "M60 60 L104 60 L96 53 M104 60 L96 67", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 108, y: 40, w: 42, h: 40, rx: 8, fill: "muted" },
    { kind: "text", x: 129, y: 58, size: 9, fill: "inkSoft", content: "друг", bold: true, anchor: "middle" },
    { kind: "text", x: 129, y: 70, size: 10, fill: "danger", content: "у", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 7, fill: "inkSoft", content: "¿a quién? → dativo", anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 6.5, fill: "brandLight", content: "звонить / писать / помогать + dativo, sin preposición", anchor: "middle" },
  ],

  // "Мне нужно работать." — [dativo] + нужно/надо/можно/нельзя + infinitivo.
  dativeImpersonalNeedModal: [
    { kind: "rect", x: 14, y: 16, w: 40, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 34, y: 35, size: 10, fill: "white", content: "мне", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 16, w: 86, h: 30, rx: 10, fill: "accentLight" },
    { kind: "text", x: 103, y: 35, size: 8, fill: "white", content: "нужно / надо", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 52 L80 66", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "rect", x: 14, y: 70, w: 132, h: 30, rx: 10, fill: "muted" },
    { kind: "text", x: 80, y: 89, size: 8.5, fill: "inkSoft", content: "работать (infinitivo)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 106, size: 6.5, fill: "danger", content: "можно = se puede · нельзя = no se puede", anchor: "middle" },
  ],

  // "Мне холодно / жарко / интересно / скучно / жаль." — [dativo] + adverbio, sin verbo ser/estar.
  dativeImpersonalStateAdjectives: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "rect", x: 14, y: 16, w: 62, h: 22, rx: 8, fill: "brand" },
    { kind: "text", x: 45, y: 31, size: 7, fill: "white", content: "мне холодно", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 16, w: 62, h: 22, rx: 8, fill: "brandLight" },
    { kind: "text", x: 115, y: 31, size: 7, fill: "white", content: "мне жарко", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 44, w: 62, h: 22, rx: 8, fill: "accent" },
    { kind: "text", x: 45, y: 59, size: 7, fill: "white", content: "мне интересно", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 44, w: 62, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 115, y: 59, size: 7, fill: "white", content: "мне скучно", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 72, w: 72, h: 22, rx: 8, fill: "ink" },
    { kind: "text", x: 80, y: 87, size: 7, fill: "white", content: "мне жаль", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 106, size: 6.5, fill: "inkSoft", content: "[dativo] + adverbio, sin 'ser/estar'", anchor: "middle" },
  ],

  // Мне/тебе/ему/ей/нам/вам/им 20 лет — paradigma completo del dativo para la edad.
  dativeAgeParadigmTable: [
    { kind: "rect", x: 8, y: 10, w: 46, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 31, y: 25, size: 7.5, fill: "white", content: "мне", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 10, w: 46, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 25, size: 7.5, fill: "white", content: "тебе", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 10, w: 46, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 129, y: 25, size: 7.5, fill: "white", content: "ему/ей", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 36, w: 46, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 31, y: 51, size: 7.5, fill: "white", content: "нам", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 36, w: 46, h: 22, rx: 6, fill: "accent" },
    { kind: "text", x: 80, y: 51, size: 7.5, fill: "white", content: "вам", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 36, w: 46, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 129, y: 51, size: 7.5, fill: "white", content: "им", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 66, w: 144, h: 26, rx: 8, fill: "muted" },
    { kind: "text", x: 80, y: 83, size: 8.5, fill: "inkSoft", content: "+ 20 лет / 25 лет / 30 лет", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 104, size: 6.5, fill: "danger", content: "tengo / tienes / tiene ... años", anchor: "middle" },
  ],

  // "Он стал инженером. / Она работает учительницей." — instrumental sin preposición con стать/работать/быть.
  instrumentalProfessionStative: [
    { kind: "circle", cx: 40, cy: 40, r: 18, fill: "brand" },
    { kind: "text", x: 40, y: 45, size: 9, fill: "white", content: "он", bold: true, anchor: "middle" },
    { kind: "path", d: "M62 40 L96 40 L88 33 M96 40 L88 47", stroke: "inkSoft", strokeWidth: 2.5, round: true },
    { kind: "rect", x: 100, y: 24, w: 50, h: 32, rx: 8, fill: "accentLight" },
    { kind: "text", x: 125, y: 40, size: 7.5, fill: "white", content: "стал", bold: true, anchor: "middle" },
    { kind: "text", x: 125, y: 51, size: 8, fill: "white", content: "инженером", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 72, w: 132, h: 30, rx: 10, fill: "muted" },
    { kind: "text", x: 80, y: 91, size: 8, fill: "inkSoft", content: "работать / быть / стать + instrumental", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 6.5, fill: "danger", content: "sin preposición, sin 'с'", anchor: "middle" },
  ],

  // "Я пишу ручкой. / Он режет хлеб ножом." — instrumental de medio, sin preposición.
  instrumentalMeansTool: [
    { kind: "rect", x: 12, y: 20, w: 60, h: 34, rx: 10, fill: "brand" },
    { kind: "text", x: 42, y: 38, size: 8, fill: "white", content: "пишу", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 49, size: 8.5, fill: "accentLight", content: "ручкой", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 60, h: 34, rx: 10, fill: "brandLight" },
    { kind: "text", x: 118, y: 38, size: 8, fill: "white", content: "режет", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 49, size: 8.5, fill: "accentLight", content: "ножом", bold: true, anchor: "middle" },
    { kind: "path", d: "M20 66 L140 66", stroke: "muted", strokeWidth: 2 },
    { kind: "text", x: 80, y: 86, size: 8, fill: "inkSoft", content: "¿con qué? → instrumental", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 104, size: 6.5, fill: "danger", content: "reemplaza directamente a 'con' del español", anchor: "middle" },
  ],

  // утром/вечером/зимой/летом — instrumental de tiempo, sin preposición.
  instrumentalTimeExpressions: [
    { kind: "circle", cx: 40, cy: 34, r: 16, fill: "accentLight" },
    { kind: "text", x: 40, y: 39, size: 7, fill: "white", content: "утром", bold: true, anchor: "middle" },
    { kind: "circle", cx: 120, cy: 34, r: 16, fill: "ink" },
    { kind: "text", x: 120, y: 39, size: 7, fill: "white", content: "вечером", bold: true, anchor: "middle" },
    { kind: "circle", cx: 40, cy: 78, r: 16, fill: "brand" },
    { kind: "text", x: 40, y: 83, size: 7, fill: "white", content: "зимой", bold: true, anchor: "middle" },
    { kind: "circle", cx: 120, cy: 78, r: 16, fill: "brandLight" },
    { kind: "text", x: 120, y: 83, size: 7, fill: "white", content: "летом", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 6.5, fill: "inkSoft", content: "instrumental sin preposición: cuándo", anchor: "middle" },
  ],

  // "tengo que / tengo frío / me parece" (ES, varios verbos) vs. [dativo] + palabra invariable (RU, un solo patrón).
  spanishDativeInstrumentalCompare: [
    { kind: "rect", x: 10, y: 16, w: 62, h: 60, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 34, size: 6.5, fill: "inkSoft", content: "tengo que...", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 46, size: 6.5, fill: "inkSoft", content: "tengo frío", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 6.5, fill: "inkSoft", content: "me parece...", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 70, size: 6, fill: "danger", content: "(varios verbos, ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 16, w: 62, h: 60, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 38, size: 7.5, fill: "white", content: "[dativo] +", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 50, size: 7.5, fill: "white", content: "palabra", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 62, size: 7.5, fill: "white", content: "invariable", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 74, size: 6, fill: "accentLight", content: "(un solo patrón, RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 6.5, fill: "brandLight", content: "и 'con' + sustantivo (ES) = instrumental sin preposición (RU)", anchor: "middle" },
  ],

  // думаю/по-моему/кажется/на мой взгляд — cuatro formas casi sinónimas de introducir una opinión.
  opinionIntroducersCompare: [
    { kind: "rect", x: 8, y: 10, w: 68, h: 22, rx: 7, fill: "brand" },
    { kind: "text", x: 42, y: 25, size: 7, fill: "white", content: "я думаю, что...", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 10, w: 68, h: 22, rx: 7, fill: "brandLight" },
    { kind: "text", x: 118, y: 25, size: 7, fill: "white", content: "по-моему...", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 40, w: 68, h: 22, rx: 7, fill: "accent" },
    { kind: "text", x: 42, y: 55, size: 6.5, fill: "white", content: "мне кажется...", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 40, w: 68, h: 22, rx: 7, fill: "accentLight" },
    { kind: "text", x: 118, y: 55, size: 6, fill: "white", content: "на мой взгляд...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 7.5, fill: "inkSoft", content: "cuatro formas de decir: 'creo que...'", anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 6.5, fill: "danger", content: "на мой взгляд = más formal", anchor: "middle" },
  ],

  // согласен (masc.) / согласна (fem.) / согласны (plural/usted) — concordancia del adjetivo corto de acuerdo.
  agreementShortAdjectiveGender: [
    { kind: "rect", x: 10, y: 16, w: 42, h: 34, rx: 8, fill: "brand" },
    { kind: "text", x: 31, y: 31, size: 6.5, fill: "white", content: "он", bold: true, anchor: "middle" },
    { kind: "text", x: 31, y: 43, size: 7, fill: "accentLight", content: "согласен", bold: true, anchor: "middle" },
    { kind: "rect", x: 59, y: 16, w: 42, h: 34, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 31, size: 6.5, fill: "white", content: "она", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 43, size: 7, fill: "accentLight", content: "согласна", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 16, w: 42, h: 34, rx: 8, fill: "accentLight" },
    { kind: "text", x: 129, y: 31, size: 6.5, fill: "white", content: "мы", bold: true, anchor: "middle" },
    { kind: "text", x: 129, y: 43, size: 7, fill: "white", content: "согласны", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 8, fill: "inkSoft", content: "точно! · именно так · конечно", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 6.5, fill: "danger", content: "refuerzos del acuerdo", anchor: "middle" },
  ],

  // "не согласен" (directo) vs. "наоборот / не совсем согласен / я думаю иначе" (suavizado).
  disagreementSoftenedConstruction: [
    { kind: "rect", x: 14, y: 14, w: 132, h: 26, rx: 10, fill: "danger" },
    { kind: "text", x: 80, y: 31, size: 8, fill: "white", content: "не согласен / не согласна", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 46 L80 58", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "rect", x: 14, y: 62, w: 132, h: 40, rx: 10, fill: "muted" },
    { kind: "text", x: 80, y: 78, size: 7, fill: "inkSoft", content: "наоборот · я думаю иначе", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 91, size: 7, fill: "inkSoft", content: "не совсем согласен", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 103, size: 6, fill: "brandLight", content: "más suave, sin negar del todo", anchor: "middle" },
  ],

  // возможно/наверное/может быть — matización sin afirmar ni negar.
  hedgingUncertaintyWords: [
    { kind: "circle", cx: 80, cy: 60, r: 48, fill: "brand", opacity: 0.06 },
    { kind: "circle", cx: 40, cy: 44, r: 22, fill: "accentLight" },
    { kind: "text", x: 40, y: 48, size: 7, fill: "white", content: "возможно", bold: true, anchor: "middle" },
    { kind: "circle", cx: 120, cy: 44, r: 22, fill: "accent" },
    { kind: "text", x: 120, y: 48, size: 7, fill: "white", content: "наверное", bold: true, anchor: "middle" },
    { kind: "circle", cx: 80, cy: 86, r: 22, fill: "brandLight" },
    { kind: "text", x: 80, y: 90, size: 6.5, fill: "white", content: "может быть", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 112, size: 6.5, fill: "inkSoft", content: "bajan la fuerza de una afirmación", anchor: "middle" },
  ],

  // "С одной стороны... с другой стороны..." — estructura para equilibrar dos ideas contrarias.
  oneHandOtherHandStructure: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 42, size: 6.5, fill: "white", content: "с одной", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 53, size: 6.5, fill: "white", content: "стороны...", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 46 L84 46", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "accentLight" },
    { kind: "text", x: 119, y: 42, size: 6.5, fill: "white", content: "с другой", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 53, size: 6.5, fill: "white", content: "стороны...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "inkSoft", content: "por un lado... por otro lado...", anchor: "middle" },
    { kind: "text", x: 80, y: 106, size: 6.5, fill: "brandLight", content: "equilibra dos ideas contrarias", anchor: "middle" },
  ],

  // согласен/согласна/согласны sigue el mismo patrón que рад/рада/рады y готов/готова/готовы.
  shortAdjectiveGenderPatternGeneral: [
    { kind: "rect", x: 8, y: 12, w: 46, h: 24, rx: 7, fill: "brand" },
    { kind: "text", x: 31, y: 28, size: 7, fill: "white", content: "согласен", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 12, w: 46, h: 24, rx: 7, fill: "brandLight" },
    { kind: "text", x: 80, y: 28, size: 7.5, fill: "white", content: "рад", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 12, w: 46, h: 24, rx: 7, fill: "accentLight" },
    { kind: "text", x: 129, y: 28, size: 6.5, fill: "white", content: "готов", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 44, w: 144, h: 24, rx: 7, fill: "muted" },
    { kind: "text", x: 80, y: 60, size: 7, fill: "inkSoft", content: "-а (fem.) · -ы (plural)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 7, fill: "danger", content: "solo existen en forma corta", anchor: "middle" },
    { kind: "text", x: 80, y: 104, size: 6.5, fill: "inkSoft", content: "concuerdan en género y número", anchor: "middle" },
  ],

  // точно/именно так → возможно/наверное → не совсем/наоборот → не согласен: espectro de reacción a una opinión.
  agreeDisagreeHedgeSpectrum: [
    { kind: "rect", x: 6, y: 44, w: 34, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 23, y: 58, size: 5.5, fill: "white", content: "точно!", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 44, w: 34, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 61, y: 58, size: 5, fill: "white", content: "возможно", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 44, w: 34, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 99, y: 58, size: 5, fill: "white", content: "наоборот", bold: true, anchor: "middle" },
    { kind: "rect", x: 120, y: 44, w: 34, h: 22, rx: 6, fill: "danger" },
    { kind: "text", x: 137, y: 58, size: 4.5, fill: "white", content: "не согласен", bold: true, anchor: "middle" },
    { kind: "path", d: "M6 78 L154 78", stroke: "muted", strokeWidth: 2 },
    { kind: "text", x: 80, y: 20, size: 7.5, fill: "inkSoft", content: "acuerdo ← incertidumbre → desacuerdo", anchor: "middle" },
  ],

  // "creo que/en mi opinión/me parece que" (ES) = думаю/по-моему/кажется (RU) — paralelo casi exacto.
  spanishOpinionAgreementCompare: [
    { kind: "rect", x: 10, y: 24, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6.5, fill: "inkSoft", content: "creo que /", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6.5, fill: "inkSoft", content: "me parece que", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 65, size: 5.5, fill: "danger", content: "por un lado... (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6.5, fill: "white", content: "думаю /", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6.5, fill: "white", content: "мне кажется", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 65, size: 5.5, fill: "accentLight", content: "с одной стороны... (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "brandLight", content: "paralelo casi exacto, palabra por palabra", anchor: "middle" },
  ],

  // "Мой рабочий день начинается в девять." — la jornada laboral y su график (horario general).
  workingDayScheduleOverview: [
    { kind: "circle", cx: 80, cy: 46, r: 30, fill: "brand" },
    { kind: "path", d: "M80 30 L80 46 L94 54", stroke: "white", strokeWidth: 3, round: true },
    { kind: "text", x: 80, y: 88, size: 7.5, fill: "inkSoft", content: "рабочий день", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 96, w: 132, h: 18, rx: 8, fill: "muted" },
    { kind: "text", x: 80, y: 109, size: 7, fill: "danger", content: "график = horario / cronograma", anchor: "middle" },
  ],

  // "Я работаю с девяти до шести." — с + genitivo... до + genitivo, rango de horas.
  sDoGenitiveTimeRange: [
    { kind: "rect", x: 10, y: 40, w: 40, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 30, y: 59, size: 9, fill: "white", content: "с 9", bold: true, anchor: "middle" },
    { kind: "path", d: "M54 55 L104 55 L96 48 M104 55 L96 62", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 108, y: 40, w: 42, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 129, y: 59, size: 8.5, fill: "white", content: "до 6", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 7, fill: "inkSoft", content: "с + genitivo ... до + genitivo", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 6.5, fill: "danger", content: "rango: inicio → fin", anchor: "middle" },
  ],

  // начальник/коллега/совещание/зарплата/отпуск — vocabulario de oficina en una cuadrícula.
  workplaceVocabGrid: [
    { kind: "rect", x: 8, y: 10, w: 68, h: 22, rx: 7, fill: "brand" },
    { kind: "text", x: 42, y: 25, size: 6.5, fill: "white", content: "начальник", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 10, w: 68, h: 22, rx: 7, fill: "brandLight" },
    { kind: "text", x: 118, y: 25, size: 6.5, fill: "white", content: "коллега", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 40, w: 68, h: 22, rx: 7, fill: "accent" },
    { kind: "text", x: 42, y: 55, size: 6, fill: "white", content: "совещание", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 40, w: 30, h: 22, rx: 7, fill: "accentLight" },
    { kind: "text", x: 99, y: 55, size: 6, fill: "white", content: "зарплата", bold: true, anchor: "middle" },
    { kind: "rect", x: 122, y: 40, w: 30, h: 22, rx: 7, fill: "ink" },
    { kind: "text", x: 137, y: 55, size: 5.5, fill: "white", content: "отпуск", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 7, fill: "inkSoft", content: "vocabulario de la oficina", anchor: "middle" },
  ],

  // семестр/курс/предмет/лекция — vocabulario universitario en una cuadrícula.
  studyRoutineVocabGrid: [
    { kind: "rect", x: 8, y: 10, w: 68, h: 22, rx: 7, fill: "brand" },
    { kind: "text", x: 42, y: 25, size: 6.5, fill: "white", content: "семестр", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 10, w: 68, h: 22, rx: 7, fill: "brandLight" },
    { kind: "text", x: 118, y: 25, size: 7, fill: "white", content: "курс", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 40, w: 68, h: 22, rx: 7, fill: "accent" },
    { kind: "text", x: 42, y: 55, size: 6.5, fill: "white", content: "предмет", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 40, w: 68, h: 22, rx: 7, fill: "accentLight" },
    { kind: "text", x: 118, y: 55, size: 6.5, fill: "white", content: "лекция", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 7, fill: "inkSoft", content: "vocabulario universitario", anchor: "middle" },
  ],

  // "поступить в университет" (perfectivo, momento puntual) vs. "учиться в университете" (proceso continuo).
  postuplitUchitsyaCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 40, rx: 10, fill: "accentLight" },
    { kind: "text", x: 41, y: 38, size: 7, fill: "white", content: "поступить", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 50, size: 6, fill: "white", content: "(momento)", anchor: "middle" },
    { kind: "path", d: "M76 40 L82 40", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 86, y: 20, w: 64, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 118, y: 38, size: 7, fill: "white", content: "учиться", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 50, size: 6, fill: "accentLight", content: "(proceso)", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 7, fill: "inkSoft", content: "ingresar (una vez) → estudiar (continuo)", anchor: "middle" },
  ],

  // сдавать (imperfectivo, proceso) vs. сдать (perfectivo, resultado exitoso) — par aspectual del examen.
  sdavatSdatAspectPair: [
    { kind: "rect", x: 10, y: 16, w: 62, h: 40, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 34, size: 7, fill: "inkSoft", content: "сдавать", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 46, size: 6, fill: "danger", content: "presentarse (proceso)", anchor: "middle" },
    { kind: "path", d: "M76 36 L82 36", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 86, y: 16, w: 64, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 118, y: 34, size: 7, fill: "white", content: "сдать", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 46, size: 6, fill: "accentLight", content: "aprobar (resultado)", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 7, fill: "inkSoft", content: "не сдать = no lograr aprobar", anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 6.5, fill: "danger", content: "un par aspectual, dos verbos en español", anchor: "middle" },
  ],

  // "заниматься русским языком" (+instrumental, autodidacta) vs. "изучать русский язык" (+acusativo, en clase).
  zanimatsyaVsIzuchatCompare: [
    { kind: "rect", x: 10, y: 20, w: 64, h: 40, rx: 10, fill: "brandLight" },
    { kind: "text", x: 42, y: 38, size: 7, fill: "white", content: "заниматься", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 50, size: 6, fill: "white", content: "+ instrumental", anchor: "middle" },
    { kind: "rect", x: 86, y: 20, w: 64, h: 40, rx: 10, fill: "accentLight" },
    { kind: "text", x: 118, y: 38, size: 7, fill: "white", content: "изучать", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 50, size: 6, fill: "white", content: "+ acusativo", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 7, fill: "inkSoft", content: "por cuenta propia ↔ en clase, formal", anchor: "middle" },
  ],

  // "trabajo de 9 a 6" (ES) = "работаю с девяти до шести" (RU, con genitivo); pero сдавать/сдать sin par exacto en español.
  spanishWorkStudyRoutineCompare: [
    { kind: "rect", x: 10, y: 16, w: 62, h: 46, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 34, size: 6.5, fill: "inkSoft", content: "trabajo de 9 a 6", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 48, size: 6, fill: "danger", content: "presentar / aprobar (2 verbos)", anchor: "middle" },
    { kind: "rect", x: 88, y: 16, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 34, size: 6.5, fill: "white", content: "с 9 до 6", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 48, size: 6, fill: "accentLight", content: "сдавать/сдать (1 verbo)", anchor: "middle" },
    { kind: "text", x: 80, y: 80, size: 7, fill: "brandLight", content: "el horario calca; el aspecto verbal no tiene par en español", anchor: "middle" },
  ],

  // "Однажды я гулял в парке..." — однажды abre casi cualquier historia, como "había una vez".
  odnazhdyStoryOpener: [
    { kind: "circle", cx: 80, cy: 50, r: 34, fill: "brand", opacity: 0.1 },
    { kind: "rect", x: 24, y: 34, w: 112, h: 32, rx: 14, fill: "brand" },
    { kind: "text", x: 80, y: 55, size: 10, fill: "white", content: "однажды...", bold: true, anchor: "middle" },
    { kind: "path", d: "M46 78 C60 92 100 92 114 78", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "text", x: 80, y: 104, size: 7, fill: "inkSoft", content: "\"había una vez\" / \"un día\"", anchor: "middle" },
  ],

  // сначала → потом/затем → после этого → наконец/в итоге — la cadena de secuencia narrativa.
  narrativeSequenceChain: [
    { kind: "rect", x: 4, y: 46, w: 34, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 21, y: 60, size: 5.5, fill: "white", content: "сначала", bold: true, anchor: "middle" },
    { kind: "path", d: "M40 57 L48 57", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 50, y: 46, w: 34, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 67, y: 60, size: 5.5, fill: "white", content: "потом", bold: true, anchor: "middle" },
    { kind: "path", d: "M86 57 L94 57", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 96, y: 46, w: 34, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 113, y: 60, size: 5, fill: "white", content: "после", bold: true, anchor: "middle" },
    { kind: "path", d: "M132 57 L140 57", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 122, y: 20, w: 34, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 139, y: 34, size: 5, fill: "white", content: "наконец", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 7, fill: "inkSoft", content: "la columna vertebral del relato", anchor: "middle" },
  ],

  // "Пока мы искали грибы, было тихо." — пока + imperfectivo, trasfondo simultáneo, distinto de когда.
  pokaVsKogdaBackground: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 38, size: 8, fill: "white", content: "пока", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 50, size: 6, fill: "accentLight", content: "duración continua", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 40, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 38, size: 8, fill: "inkSoft", content: "когда", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 50, size: 6, fill: "danger", content: "fondo o momento puntual", anchor: "middle" },
    { kind: "text", x: 80, y: 78, size: 7, fill: "inkSoft", content: "пока: siempre continuo, más específico", anchor: "middle" },
  ],

  // "Тем временем начался дождь." — escena paralela, otro plano de la historia, distinta oración.
  temVremenemParallelScene: [
    { kind: "rect", x: 10, y: 20, w: 60, h: 40, rx: 10, fill: "brandLight" },
    { kind: "text", x: 40, y: 44, size: 7.5, fill: "white", content: "escena A", bold: true, anchor: "middle" },
    { kind: "rect", x: 90, y: 20, w: 60, h: 40, rx: 10, fill: "accentLight" },
    { kind: "text", x: 120, y: 44, size: 7.5, fill: "white", content: "escena B", bold: true, anchor: "middle" },
    { kind: "path", d: "M40 64 L40 74 L120 74 L120 64", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "text", x: 80, y: 90, size: 7.5, fill: "inkSoft", content: "тем временем: al mismo tiempo, otro plano", anchor: "middle" },
    { kind: "text", x: 80, y: 106, size: 6.5, fill: "danger", content: "dos oraciones separadas", anchor: "middle" },
  ],

  // "Вдруг мы услышали странный звук." — вдруг/неожиданно rompen la secuencia previsible.
  vdrugUnexpectedTwist: [
    { kind: "path", d: "M10 60 L60 60 L60 40 L100 70 L60 70 L60 60", fill: "muted" },
    { kind: "circle", cx: 118, cy: 60, r: 30, fill: "accentLight" },
    { kind: "path", d: "M118 44 C121 52 128 55 134 60 C128 65 121 68 118 76 C115 68 108 65 102 60 C108 55 115 52 118 44 Z", fill: "white" },
    { kind: "text", x: 118, y: 96, size: 7, fill: "danger", content: "вдруг / неожиданно", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 96, size: 6.5, fill: "inkSoft", content: "rompe lo previsible", anchor: "middle" },
  ],

  // "Я жил там два года." — acusativo de duración, sin preposición, distinto del instrumental de tiempo (b1-2).
  accusativeDurationNoPreposition: [
    { kind: "rect", x: 10, y: 40, w: 140, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 59, size: 8.5, fill: "white", content: "два года / весь вечер", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 22, size: 7, fill: "inkSoft", content: "¿cuánto duró? → acusativo, sin preposición", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "danger", content: "no confundir con утром/зимой (¿cuándo?, b1-2)", anchor: "middle" },
  ],

  // наконец (neutro) / в итоге (resultado lógico) / в конце концов (esfuerzo, alivio) — tres matices de cierre.
  narrativeClosingCompare: [
    { kind: "rect", x: 6, y: 16, w: 46, h: 34, rx: 8, fill: "brand" },
    { kind: "text", x: 29, y: 36, size: 6, fill: "white", content: "наконец", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 16, w: 46, h: 34, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 36, size: 5.5, fill: "white", content: "в итоге", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 16, w: 46, h: 34, rx: 8, fill: "accentLight" },
    { kind: "text", x: 131, y: 32, size: 5, fill: "white", content: "в конце", bold: true, anchor: "middle" },
    { kind: "text", x: 131, y: 42, size: 5, fill: "white", content: "концов", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 6.5, fill: "inkSoft", content: "neutro · resultado lógico · con esfuerzo/alivio", anchor: "middle" },
  ],

  // "una vez/primero/luego/mientras tanto/de repente/al final" (ES) = однажды/сначала/потом/тем временем/вдруг/наконец (RU).
  spanishNarrativeConnectorsCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 38, size: 6, fill: "inkSoft", content: "una vez / primero /", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 49, size: 6, fill: "inkSoft", content: "luego / de repente /", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 60, size: 6, fill: "danger", content: "al final (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 38, size: 6, fill: "white", content: "однажды / сначала /", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 49, size: 6, fill: "white", content: "потом / вдруг /", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 60, size: 6, fill: "accentLight", content: "наконец (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 7, fill: "brandLight", content: "misma caja de herramientas, palabra por palabra", anchor: "middle" },
  ],

  // газета/журнал/радио/телевидение/интернет/сайт — panorama de canales de información.
  mediaLandscapeGrid: [
    { kind: "rect", x: 6, y: 10, w: 44, h: 26, rx: 7, fill: "brand" },
    { kind: "text", x: 28, y: 27, size: 6, fill: "white", content: "газета", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 10, w: 44, h: 26, rx: 7, fill: "brandLight" },
    { kind: "text", x: 80, y: 27, size: 6, fill: "white", content: "журнал", bold: true, anchor: "middle" },
    { kind: "rect", x: 110, y: 10, w: 44, h: 26, rx: 7, fill: "accent" },
    { kind: "text", x: 132, y: 27, size: 6.5, fill: "white", content: "радио", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 44, w: 68, h: 26, rx: 7, fill: "accentLight" },
    { kind: "text", x: 40, y: 61, size: 5.5, fill: "white", content: "телевидение", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 44, w: 34, h: 26, rx: 7, fill: "ink" },
    { kind: "text", x: 99, y: 61, size: 5.5, fill: "white", content: "интернет", bold: true, anchor: "middle" },
    { kind: "rect", x: 122, y: 44, w: 32, h: 26, rx: 7, fill: "brand" },
    { kind: "text", x: 138, y: 61, size: 6, fill: "white", content: "сайт", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 7, fill: "inkSoft", content: "el panorama completo de medios", anchor: "middle" },
  ],

  // журналист/ведущий/зритель/слушатель — las personas del mundo de los medios.
  mediaPeopleRoles: [
    { kind: "circle", cx: 30, cy: 40, r: 22, fill: "brand" },
    { kind: "text", x: 30, y: 44, size: 6, fill: "white", content: "журналист", bold: true, anchor: "middle" },
    { kind: "circle", cx: 90, cy: 40, r: 22, fill: "brandLight" },
    { kind: "text", x: 90, y: 44, size: 6.5, fill: "white", content: "ведущий", bold: true, anchor: "middle" },
    { kind: "circle", cx: 40, cy: 88, r: 20, fill: "accentLight" },
    { kind: "text", x: 40, y: 91, size: 6, fill: "white", content: "зритель", bold: true, anchor: "middle" },
    { kind: "circle", cx: 116, cy: 88, r: 20, fill: "accent" },
    { kind: "text", x: 116, y: 91, size: 5.5, fill: "white", content: "слушатель", bold: true, anchor: "middle" },
  ],

  // сообщать/сообщить (informar) и объявлять/объявить (anunciar) — par aspectual del lenguaje de noticias.
  reportingVerbsAspectPair: [
    { kind: "rect", x: 10, y: 16, w: 62, h: 40, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 34, size: 6.5, fill: "inkSoft", content: "сообщать", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 46, size: 6, fill: "danger", content: "proceso habitual", anchor: "middle" },
    { kind: "rect", x: 88, y: 16, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 34, size: 6.5, fill: "white", content: "объявить", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 46, size: 6, fill: "accentLight", content: "anuncio puntual", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 7, fill: "inkSoft", content: "imperfectivo ↔ perfectivo", anchor: "middle" },
  ],

  // "по данным.../по словам..." — по + dativo plural, citar la fuente de una información.
  poDativeSourceCitation: [
    { kind: "rect", x: 14, y: 20, w: 132, h: 26, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 37, size: 8, fill: "white", content: "по данным журналистов", bold: true, anchor: "middle" },
    { kind: "rect", x: 14, y: 54, w: 132, h: 26, rx: 10, fill: "brandLight" },
    { kind: "text", x: 80, y: 71, size: 8, fill: "white", content: "по словам министра", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 7, fill: "danger", content: "по + dativo plural (-ам/-ям)", anchor: "middle" },
    { kind: "text", x: 80, y: 110, size: 6.5, fill: "inkSoft", content: "según datos de... / según las palabras de...", anchor: "middle" },
  ],

  // "Новости сообщают, что завтра будет дождь." — patrón fijo [informar] + что + oración.
  chtoLightIndirectSpeechBridge: [
    { kind: "rect", x: 10, y: 24, w: 60, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 40, y: 43, size: 7.5, fill: "white", content: "сообщают", bold: true, anchor: "middle" },
    { kind: "circle", cx: 88, cy: 39, r: 14, fill: "accentLight" },
    { kind: "text", x: 88, y: 43, size: 8, fill: "white", content: "что", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 24, w: 44, h: 30, rx: 10, fill: "muted" },
    { kind: "text", x: 128, y: 43, size: 6.5, fill: "inkSoft", content: "oración", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 7, fill: "inkSoft", content: "patrón fijo de noticias", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "danger", content: "sistema completo → b1-23/b1-24", anchor: "middle" },
  ],

  // "«Президент в Москве»" — titulares omiten быть por brevedad, registro telegráfico.
  headlineRegisterOmission: [
    { kind: "rect", x: 10, y: 14, w: 140, h: 30, rx: 8, fill: "ink" },
    { kind: "text", x: 80, y: 34, size: 9, fill: "white", content: "«Президент в Москве»", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 52 L80 62", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "text", x: 80, y: 78, size: 7.5, fill: "danger", content: "sin 'быть': registro telegráfico", anchor: "middle" },
    { kind: "text", x: 80, y: 94, size: 6.5, fill: "inkSoft", content: "solo en titulares, nunca en el cuerpo del texto", anchor: "middle" },
  ],

  // ежедневно/еженедельно/в прямом эфире/в записи — frecuencia y formato de transmisión.
  broadcastFrequencyFormat: [
    { kind: "rect", x: 8, y: 12, w: 68, h: 24, rx: 7, fill: "brand" },
    { kind: "text", x: 42, y: 28, size: 6, fill: "white", content: "ежедневно", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 12, w: 68, h: 24, rx: 7, fill: "brandLight" },
    { kind: "text", x: 118, y: 28, size: 5.5, fill: "white", content: "еженедельно", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 42, w: 68, h: 24, rx: 7, fill: "accentLight" },
    { kind: "text", x: 42, y: 58, size: 5.5, fill: "white", content: "в прямом эфире", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 42, w: 68, h: 24, rx: 7, fill: "muted" },
    { kind: "text", x: 118, y: 58, size: 6, fill: "inkSoft", content: "в записи", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "danger", content: "en vivo ↔ grabado", anchor: "middle" },
  ],

  // "según datos de/según las palabras de" (ES) = по данным/по словам (RU) — paralelo casi exacto.
  spanishMediaVocabCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6, fill: "inkSoft", content: "según datos de /", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 51, size: 6, fill: "inkSoft", content: "según palabras de", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 63, size: 5.5, fill: "danger", content: "sin verbo en titulares (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6, fill: "white", content: "по данным /", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 51, size: 6, fill: "white", content: "по словам", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 63, size: 5.5, fill: "accentLight", content: "sin быть en titulares (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "brandLight", content: "el registro periodístico se comparte casi punto por punto", anchor: "middle" },
  ],

  // масленица/баня/самовар/матрёшка — cuatro símbolos culturales básicos.
  russianCulturalSymbolsGrid: [
    { kind: "rect", x: 6, y: 10, w: 68, h: 26, rx: 8, fill: "brand" },
    { kind: "text", x: 40, y: 27, size: 6.5, fill: "white", content: "масленица", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 10, w: 68, h: 26, rx: 8, fill: "brandLight" },
    { kind: "text", x: 116, y: 27, size: 7, fill: "white", content: "баня", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 44, w: 68, h: 26, rx: 8, fill: "accentLight" },
    { kind: "text", x: 40, y: 61, size: 6.5, fill: "white", content: "самовар", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 44, w: 68, h: 26, rx: 8, fill: "accent" },
    { kind: "text", x: 116, y: 61, size: 6.5, fill: "white", content: "матрёшка", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 7, fill: "inkSoft", content: "cuatro símbolos culturales", anchor: "middle" },
  ],

  // русский/русская/русское/русские — patrón de terminación -ский para adjetivos culturales.
  skiyAdjectiveEndingPattern: [
    { kind: "rect", x: 8, y: 14, w: 34, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 25, y: 30, size: 6, fill: "white", content: "-ский", bold: true, anchor: "middle" },
    { kind: "rect", x: 46, y: 14, w: 34, h: 24, rx: 6, fill: "brandLight" },
    { kind: "text", x: 63, y: 30, size: 6, fill: "white", content: "-ская", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 14, w: 34, h: 24, rx: 6, fill: "accentLight" },
    { kind: "text", x: 101, y: 30, size: 5.5, fill: "white", content: "-ское", bold: true, anchor: "middle" },
    { kind: "rect", x: 122, y: 14, w: 32, h: 24, rx: 6, fill: "ink" },
    { kind: "text", x: 138, y: 30, size: 5.5, fill: "white", content: "-ские", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 7.5, fill: "inkSoft", content: "русский / традиционный / народный", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 6.5, fill: "danger", content: "masc. / fem. / neutro / plural", anchor: "middle" },
  ],

  // "В России принято снимать обувь дома." — [lugar] + принято + infinitivo, costumbre social.
  prinyatoImpersonalCustomConstruction: [
    { kind: "rect", x: 10, y: 20, w: 50, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 35, y: 39, size: 7.5, fill: "white", content: "в России", bold: true, anchor: "middle" },
    { kind: "rect", x: 66, y: 20, w: 46, h: 30, rx: 8, fill: "accentLight" },
    { kind: "text", x: 89, y: 39, size: 7.5, fill: "white", content: "принято", bold: true, anchor: "middle" },
    { kind: "rect", x: 118, y: 20, w: 32, h: 30, rx: 8, fill: "muted" },
    { kind: "text", x: 134, y: 34, size: 6, fill: "inkSoft", content: "снимать", bold: true, anchor: "middle" },
    { kind: "text", x: 134, y: 44, size: 6, fill: "inkSoft", content: "обувь", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 7, fill: "inkSoft", content: "не принято = no es costumbre", anchor: "middle" },
  ],

  // принято (norma social, sin dativo) vs. нужно (necesidad personal, con dativo) — comparación directa.
  prinyatoVsNuzhnoCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 8, fill: "white", content: "принято", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "accentLight", content: "sin dativo, norma social", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 8, fill: "inkSoft", content: "нужно", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "danger", content: "+ dativo, necesidad", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "ambas + infinitivo, distinto matiz", anchor: "middle" },
  ],

  // Новый год (x2) / Рождество (7 enero) / Пасха — el calendario ortodoxo de fiestas.
  orthodoxCalendarFestivals: [
    { kind: "circle", cx: 40, cy: 40, r: 22, fill: "brand" },
    { kind: "text", x: 40, y: 38, size: 5.5, fill: "white", content: "Новый год", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 48, size: 5, fill: "accentLight", content: "×2", anchor: "middle" },
    { kind: "circle", cx: 118, cy: 40, r: 22, fill: "brandLight" },
    { kind: "text", x: 118, y: 38, size: 5.5, fill: "white", content: "Рождество", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 48, size: 4.5, fill: "accentLight", content: "7 января", anchor: "middle" },
    { kind: "rect", x: 44, y: 76, w: 72, h: 26, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 93, size: 7, fill: "white", content: "Пасха", bold: true, anchor: "middle" },
  ],

  // No dar la mano por el umbral, silencio antes del viaje, no silbar en casa — суеверия y приметы.
  superstitionsAndPortentsList: [
    { kind: "rect", x: 8, y: 10, w: 144, h: 20, rx: 8, fill: "muted" },
    { kind: "text", x: 80, y: 24, size: 6.5, fill: "inkSoft", content: "no dar la mano por el umbral", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 36, w: 144, h: 20, rx: 8, fill: "muted" },
    { kind: "text", x: 80, y: 50, size: 6.5, fill: "inkSoft", content: "silencio antes de un viaje largo", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 62, w: 144, h: 20, rx: 8, fill: "muted" },
    { kind: "text", x: 80, y: 76, size: 6.5, fill: "inkSoft", content: "no silbar en casa (ahuyenta el dinero)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 6.5, fill: "danger", content: "суеверия · приметы", anchor: "middle" },
  ],

  // "Гостей встречают хлебом и солью." — el ritual de hospitalidad con pan y sal.
  khlebSolHospitalityRitual: [
    { kind: "circle", cx: 80, cy: 44, r: 32, fill: "accentLight" },
    { kind: "rect", x: 58, y: 32, w: 44, h: 20, rx: 6, fill: "white" },
    { kind: "text", x: 80, y: 46, size: 7, fill: "ink", content: "хлеб и соль", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 7.5, fill: "inkSoft", content: "гостеприимство: добро пожаловать!", anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 6.5, fill: "danger", content: "símbolo de respeto y bienvenida", anchor: "middle" },
  ],

  // Semana de блины (representan el sol) → provожают зиму quemando un muñeco de paja — Масленица.
  maslenitsaWeekBlinyRitual: [
    { kind: "circle", cx: 40, cy: 40, r: 20, fill: "accentLight" },
    { kind: "text", x: 40, y: 44, size: 6.5, fill: "white", content: "блины", bold: true, anchor: "middle" },
    { kind: "path", d: "M64 40 L94 40 L86 33 M94 40 L86 47", stroke: "inkSoft", strokeWidth: 2.5, round: true },
    { kind: "path", d: "M112 24 L128 24 L128 56 L112 56 Z", fill: "brand" },
    { kind: "circle", cx: 120, cy: 20, r: 8, fill: "brandLight" },
    { kind: "text", x: 120, y: 74, size: 6, fill: "inkSoft", content: "чучело зимы", anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 6.5, fill: "danger", content: "una semana de blinis, se despide el invierno", anchor: "middle" },
  ],

  // "Уважаемый Иван Петрович," — la apertura estándar de cualquier correo formal ruso.
  formalEmailOpeningGreeting: [
    { kind: "rect", x: 10, y: 34, w: 140, h: 40, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 52, size: 8.5, fill: "white", content: "Уважаемый", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 65, size: 8, fill: "accentLight", content: "Иван Петрович,", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 20, size: 7, fill: "inkSoft", content: "nombre + patronímico", anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 6.5, fill: "danger", content: "apertura casi obligatoria", anchor: "middle" },
  ],

  // Пётр → Петрович (masc.) / Петровна (fem.) — el patrón de formación del отчество.
  patronymicFormationPattern: [
    { kind: "rect", x: 10, y: 40, w: 44, h: 26, rx: 7, fill: "muted" },
    { kind: "text", x: 32, y: 57, size: 7.5, fill: "inkSoft", content: "Пётр", bold: true, anchor: "middle" },
    { kind: "path", d: "M58 53 L70 53", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 74, y: 14, w: 76, h: 26, rx: 7, fill: "brand" },
    { kind: "text", x: 112, y: 31, size: 7, fill: "white", content: "Петрович", bold: true, anchor: "middle" },
    { kind: "rect", x: 74, y: 66, w: 76, h: 26, rx: 7, fill: "brandLight" },
    { kind: "text", x: 112, y: 83, size: 7, fill: "white", content: "Петровна", bold: true, anchor: "middle" },
    { kind: "text", x: 112, y: 22, size: 5.5, fill: "danger", content: "-ович (masc.)", anchor: "middle" },
    { kind: "text", x: 112, y: 97, size: 5.5, fill: "danger", content: "-овна (fem.)", anchor: "middle" },
  ],

  // Прошу вас.../Сообщаю вам, что.../Буду благодарен.../Прилагаю... — las frases fijas del cuerpo del correo.
  formalRequestPhrasesGrid: [
    { kind: "rect", x: 8, y: 10, w: 68, h: 22, rx: 7, fill: "brand" },
    { kind: "text", x: 42, y: 25, size: 6, fill: "white", content: "прошу вас...", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 10, w: 68, h: 22, rx: 7, fill: "brandLight" },
    { kind: "text", x: 118, y: 25, size: 5.5, fill: "white", content: "сообщаю, что...", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 40, w: 68, h: 22, rx: 7, fill: "accent" },
    { kind: "text", x: 42, y: 55, size: 5.5, fill: "white", content: "буду благодарен", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 40, w: 68, h: 22, rx: 7, fill: "accentLight" },
    { kind: "text", x: 118, y: 55, size: 6, fill: "white", content: "прилагаю...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 7, fill: "inkSoft", content: "las fórmulas fijas del cuerpo del correo", anchor: "middle" },
  ],

  // "Вы" con mayúscula (escrito, respeto) vs. "вы" minúscula (hablado, sin distinción) — solo por escrito.
  vyCapitalizedWrittenRegister: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 48, size: 16, fill: "white", content: "Вы", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 62, size: 6, fill: "accentLight", content: "por escrito, respeto", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 48, size: 16, fill: "inkSoft", content: "вы", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 62, size: 6, fill: "danger", content: "hablado, sin distinción", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "la mayúscula solo existe por escrito", anchor: "middle" },
  ],

  // "Тема: Вопрос о встрече." — la línea de asunto, breve y clara.
  temaSubjectLineFormat: [
    { kind: "rect", x: 10, y: 30, w: 140, h: 30, rx: 8, fill: "ink" },
    { kind: "text", x: 20, y: 50, size: 9, fill: "accentLight", content: "Тема:", bold: true, anchor: "start" },
    { kind: "text", x: 55, y: 50, size: 8, fill: "white", content: "Вопрос о встрече", bold: true, anchor: "start" },
    { kind: "text", x: 80, y: 76, size: 7, fill: "inkSoft", content: "breve y clara, siempre al inicio", anchor: "middle" },
  ],

  // "Не могли бы Вы отправить документы завтра?" — бы + pasado, la cortesía del condicional.
  neMogliByPoliteConditional: [
    { kind: "rect", x: 10, y: 30, w: 60, h: 30, rx: 8, fill: "muted" },
    { kind: "text", x: 40, y: 45, size: 7, fill: "inkSoft", content: "не могли", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 56, size: 6, fill: "danger", content: "(pasado, forma)", anchor: "middle" },
    { kind: "circle", cx: 90, cy: 45, r: 16, fill: "accentLight" },
    { kind: "text", x: 90, y: 49, size: 9, fill: "white", content: "бы", bold: true, anchor: "middle" },
    { kind: "rect", x: 112, y: 30, w: 38, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 131, y: 49, size: 7.5, fill: "white", content: "Вы...?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 6.5, fill: "inkSoft", content: "бы = partícula de cortesía, no de tiempo pasado", anchor: "middle" },
  ],

  // "С уважением," (estándar) vs. "С наилучшими пожеланиями," (más cálido) — las variantes de cierre.
  formalClosingVariants: [
    { kind: "rect", x: 10, y: 16, w: 140, h: 26, rx: 8, fill: "brand" },
    { kind: "text", x: 80, y: 33, size: 8, fill: "white", content: "С уважением,", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 50, w: 140, h: 26, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 67, size: 7, fill: "white", content: "С наилучшими пожеланиями,", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 6.5, fill: "inkSoft", content: "estándar ↔ más cálido", anchor: "middle" },
  ],

  // "Estimado.../Atentamente," (ES) = "Уважаемый.../С уважением," (RU) — la gran diferencia: отчество.
  spanishFormalEmailCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "inkSoft", content: "Estimado Sr.", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 51, size: 6.5, fill: "inkSoft", content: "Pérez /", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 63, size: 5.5, fill: "danger", content: "Atentamente (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "white", content: "Уважаемый" },
    { kind: "text", x: 119, y: 51, size: 6.5, fill: "white", content: "Иван Петрович" },
    { kind: "text", x: 119, y: 63, size: 5.5, fill: "accentLight", content: "nombre + отчество (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "brandLight", content: "paralelo casi exacto, salvo el patronímico", anchor: "middle" },
  ],

  // прийти/приехать/прилететь/приплыть — при- marca siempre la llegada al punto final.
  priPrefixArrivalMeaning: [
    { kind: "circle", cx: 118, cy: 60, r: 26, fill: "brand" },
    { kind: "path", d: "M12 60 L86 60 L78 53 M86 60 L78 67", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "text", x: 118, y: 64, size: 9, fill: "white", content: "при-", bold: true, anchor: "middle" },
    { kind: "text", x: 60, y: 90, size: 7, fill: "inkSoft", content: "прийти · приехать · прилететь · приплыть", anchor: "middle" },
    { kind: "text", x: 118, y: 100, size: 6.5, fill: "danger", content: "llegada al destino", anchor: "middle" },
  ],

  // уйти/уехать/улететь — у- marca siempre la partida, el alejamiento del origen.
  uPrefixDepartureMeaning: [
    { kind: "circle", cx: 42, cy: 60, r: 26, fill: "accentLight" },
    { kind: "path", d: "M148 60 L74 60 L82 53 M74 60 L82 67", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "text", x: 42, y: 64, size: 9, fill: "white", content: "у-", bold: true, anchor: "middle" },
    { kind: "text", x: 100, y: 90, size: 7, fill: "inkSoft", content: "уйти · уехать · улететь", anchor: "middle" },
    { kind: "text", x: 42, y: 100, size: 6.5, fill: "danger", content: "partida del origen", anchor: "middle" },
  ],

  // "Он пришёл в семь" (perfectivo, puntual) vs. "Он приходит каждый день" (imperfectivo, habitual).
  prefixedAspectPunctualHabitual: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 7.5, fill: "white", content: "пришёл", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "accentLight", content: "puntual, perfectivo", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 7.5, fill: "inkSoft", content: "приходит", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "danger", content: "habitual, imperfectivo", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "ya no hay uni-/multidireccional", anchor: "middle" },
  ],

  // приходить/прийти, приезжать/приехать, прилетать/прилететь, приплывать/приплыть — tabla de combinaciones.
  motionRootCombinationTable: [
    { kind: "rect", x: 6, y: 10, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 40, y: 25, size: 6, fill: "white", content: "при- + йти", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 10, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 116, y: 25, size: 6, fill: "white", content: "при- + ехать", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 40, w: 68, h: 22, rx: 6, fill: "accent" },
    { kind: "text", x: 40, y: 55, size: 6, fill: "white", content: "при- + лететь", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 40, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 116, y: 55, size: 6, fill: "white", content: "при- + плыть", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 7, fill: "inkSoft", content: "el mismo prefijo, todas las raíces", anchor: "middle" },
  ],

  // приходить/приезжать + в/на + acusativo (destino) vs. уходить/уезжать + из/с + genitivo (origen).
  destinationOriginPrepositionTable: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 38, size: 7.5, fill: "white", content: "в / на", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 50, size: 6, fill: "accentLight", content: "+ acusativo", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 40, rx: 10, fill: "accentLight" },
    { kind: "text", x: 119, y: 38, size: 7.5, fill: "white", content: "из / с", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 50, size: 6, fill: "white", content: "+ genitivo", anchor: "middle" },
    { kind: "text", x: 41, y: 74, size: 6.5, fill: "inkSoft", content: "destino (при-)", anchor: "middle" },
    { kind: "text", x: 119, y: 74, size: 6.5, fill: "inkSoft", content: "origen (у-)", anchor: "middle" },
  ],

  // "приходи(те)" (ven/vengan) vs. "уходи(те)" (vete/váyanse) — el imperativo cotidiano de при-/у-.
  priUImperativeForms: [
    { kind: "rect", x: 10, y: 30, w: 62, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 49, size: 8, fill: "white", content: "приходи(те)", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 30, w: 62, h: 30, rx: 10, fill: "accentLight" },
    { kind: "text", x: 119, y: 49, size: 8, fill: "white", content: "уходи(те)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 6.5, fill: "inkSoft", content: "ven/vengan ↔ vete/váyanse", anchor: "middle" },
  ],

  // прощаться/попрощаться, расставание, скучать по + dativo — el vocabulario social de la despedida.
  farewellMissingVocabGroup: [
    { kind: "rect", x: 8, y: 12, w: 68, h: 24, rx: 7, fill: "brand" },
    { kind: "text", x: 42, y: 28, size: 5.5, fill: "white", content: "прощаться", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 12, w: 68, h: 24, rx: 7, fill: "brandLight" },
    { kind: "text", x: 118, y: 28, size: 6, fill: "white", content: "расставание", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 44, w: 72, h: 24, rx: 7, fill: "accentLight" },
    { kind: "text", x: 80, y: 60, size: 6, fill: "white", content: "скучать по", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "el vocabulario de la despedida", anchor: "middle" },
  ],

  // "llegar/irse" (ES, dos verbos sin relación) vs. приходить/уходить (RU, misma raíz, distinto prefijo).
  spanishArriveLeaveCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 7, fill: "inkSoft", content: "llegar", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 7, fill: "inkSoft", content: "irse", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "verbos sin relación (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6.5, fill: "white", content: "при-йти", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "white", content: "у-йти", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "misma raíz (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "brandLight", content: "un prefijo predice decenas de verbos", anchor: "middle" },
  ],

  // войти/въехать/влететь — в- marca siempre movimiento hacia ADENTRO de un espacio concreto.
  vPrefixEntryMeaning: [
    { kind: "rect", x: 96, y: 20, w: 54, h: 60, rx: 8, fill: "muted" },
    { kind: "path", d: "M10 50 L88 50 L78 42 M88 50 L78 58", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "circle", cx: 30, cy: 50, r: 18, fill: "brand" },
    { kind: "text", x: 30, y: 54, size: 9, fill: "white", content: "в-", bold: true, anchor: "middle" },
    { kind: "text", x: 70, y: 92, size: 7, fill: "inkSoft", content: "войти · въехать · влететь", anchor: "middle" },
    { kind: "text", x: 70, y: 108, size: 6.5, fill: "danger", content: "hacia adentro, в + acusativo", anchor: "middle" },
  ],

  // выйти/выехать/вылететь — вы- marca siempre movimiento hacia AFUERA de un espacio concreto.
  vyPrefixExitMeaning: [
    { kind: "rect", x: 10, y: 20, w: 54, h: 60, rx: 8, fill: "muted" },
    { kind: "path", d: "M76 50 L148 50 L138 42 M148 50 L138 58", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "circle", cx: 128, cy: 50, r: 18, fill: "accentLight" },
    { kind: "text", x: 128, y: 54, size: 8, fill: "white", content: "вы-", bold: true, anchor: "middle" },
    { kind: "text", x: 88, y: 92, size: 7, fill: "inkSoft", content: "выйти · выехать · вылететь", anchor: "middle" },
    { kind: "text", x: 88, y: 108, size: 6.5, fill: "danger", content: "hacia afuera, из + genitivo", anchor: "middle" },
  ],

  // вы́йти/вы́ехать/вы́лететь — el acento cae siempre en el prefijo вы- en los perfectivos.
  vyStressAlwaysOnPrefix: [
    { kind: "rect", x: 14, y: 24, w: 132, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 60, y: 44, size: 11, fill: "accentLight", content: "ВЫ́", bold: true, anchor: "middle" },
    { kind: "text", x: 105, y: 44, size: 9, fill: "white", content: "йти", bold: true, anchor: "middle" },
    { kind: "path", d: "M60 20 L60 12", stroke: "danger", strokeWidth: 2, round: true },
    { kind: "text", x: 80, y: 68, size: 7, fill: "inkSoft", content: "вы́йти · вы́ехать · вы́лететь", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "danger", content: "el acento siempre en el prefijo", anchor: "middle" },
  ],

  // "*вйти" → "войти" — inserción de una 'о' de enlace por eufonía, mismo prefijo в-.
  voEuphonicInsertionRule: [
    { kind: "rect", x: 10, y: 22, w: 50, h: 28, rx: 8, fill: "muted" },
    { kind: "text", x: 35, y: 41, size: 8, fill: "danger", content: "*вйти", bold: true, anchor: "middle" },
    { kind: "path", d: "M66 36 L96 36 L88 29 M96 36 L88 43", stroke: "inkSoft", strokeWidth: 2.5, round: true },
    { kind: "rect", x: 100, y: 22, w: 50, h: 28, rx: 8, fill: "brand" },
    { kind: "text", x: 125, y: 41, size: 8, fill: "white", content: "войти", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 7, fill: "inkSoft", content: "'о' de enlace, mismo prefijo в-", anchor: "middle" },
    { kind: "text", x: 80, y: 86, size: 6.5, fill: "danger", content: "eufonía: evita el grupo consonántico", anchor: "middle" },
  ],

  // в+acusativo (adentro) / из+genitivo (afuera) — el mismo patrón de при-/у- (b1-9), reforzado.
  entryExitPrepositionConsistency: [
    { kind: "rect", x: 10, y: 16, w: 62, h: 34, rx: 9, fill: "brand" },
    { kind: "text", x: 41, y: 30, size: 7, fill: "white", content: "в + acusativo", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 42, size: 5.5, fill: "accentLight", content: "при- (b1-9) · в- (aquí)", anchor: "middle" },
    { kind: "rect", x: 88, y: 16, w: 62, h: 34, rx: 9, fill: "accentLight" },
    { kind: "text", x: 119, y: 30, size: 7, fill: "white", content: "из + genitivo", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 42, size: 5.5, fill: "white", content: "у- (b1-9) · вы- (aquí)", anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 7, fill: "inkSoft", content: "el mismo patrón, reforzado", anchor: "middle" },
  ],

  // выйти замуж за / войти в историю / выйти на пенсию — usos figurados frecuentes de в-/вы-.
  figurativeVIdiomsGroup: [
    { kind: "rect", x: 8, y: 10, w: 144, h: 22, rx: 8, fill: "brand" },
    { kind: "text", x: 80, y: 25, size: 6.5, fill: "white", content: "выйти замуж за (casarse)", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 38, w: 144, h: 22, rx: 8, fill: "brandLight" },
    { kind: "text", x: 80, y: 53, size: 6.5, fill: "white", content: "войти в историю (pasar a la historia)", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 66, w: 144, h: 22, rx: 8, fill: "accentLight" },
    { kind: "text", x: 80, y: 81, size: 6.5, fill: "white", content: "выйти на пенсию (jubilarse)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 102, size: 6.5, fill: "danger", content: "significados figurados frecuentes", anchor: "middle" },
  ],

  // "вошла" (perfectivo, puntual) vs. "входит" (imperfectivo, habitual) — mismo contraste que при-/у-.
  vhoditVsVoshedAspectCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 8, fill: "white", content: "вошла", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "accentLight", content: "puntual, perfectivo", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 8, fill: "inkSoft", content: "входит", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "danger", content: "habitual, imperfectivo", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "mismo contraste que при-/у- (b1-9)", anchor: "middle" },
  ],

  // "entrar/salir" (ES, sin relación) vs. в-/вы- + raíz (RU, misma base, preposición predecible).
  spanishEntryExitCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 7, fill: "inkSoft", content: "entrar", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 7, fill: "inkSoft", content: "salir", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "verbos sin relación (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6.5, fill: "white", content: "в-йти", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "white", content: "вы-йти", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "misma raíz (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "brandLight", content: "preposición siempre predecible", anchor: "middle" },
  ],

  // подойти/подъехать — под- marca aproximación hasta cerca de algo, sin llegar al interior.
  podPrefixApproachMeaning: [
    { kind: "circle", cx: 128, cy: 60, r: 20, fill: "muted" },
    { kind: "path", d: "M20 60 L96 60 L86 52 M96 60 L86 68", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "circle", cx: 40, cy: 60, r: 14, fill: "brand" },
    { kind: "text", x: 40, y: 64, size: 8, fill: "white", content: "под-", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 7, fill: "inkSoft", content: "подойти · подъехать", anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 6.5, fill: "danger", content: "к + dativo, hasta cerca de", anchor: "middle" },
  ],

  // отойти/отъехать — от- marca alejamiento de un punto cercano, separación.
  otPrefixDistancingMeaning: [
    { kind: "circle", cx: 32, cy: 60, r: 20, fill: "muted" },
    { kind: "path", d: "M140 60 L64 60 L74 52 M64 60 L74 68", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "circle", cx: 120, cy: 60, r: 14, fill: "accentLight" },
    { kind: "text", x: 120, y: 64, size: 7.5, fill: "white", content: "от-", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 7, fill: "inkSoft", content: "отойти · отъехать", anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 6.5, fill: "danger", content: "от + genitivo, alejarse de", anchor: "middle" },
  ],

  // "отошёл от платформы" (movimiento corto y local) vs. "уехал в Петербург" (destino global, при-/у-).
  podOtVsPriUCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 7, fill: "white", content: "отошёл от", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 52, size: 6, fill: "accentLight", content: "platform, corto", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 7, fill: "inkSoft", content: "уехал в", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 52, size: 6, fill: "danger", content: "Петербург, global", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "под-/от- (corto) vs. при-/у- (b1-9, global)", anchor: "middle" },
  ],

  // "подойти к двери" (sin cruzar) vs. "войти в комнату" (cruzando el umbral, в-/вы-).
  podOtVsVVyCompare: [
    { kind: "rect", x: 96, y: 30, w: 54, h: 50, rx: 8, fill: "muted" },
    { kind: "path", d: "M10 55 L86 55 L76 47 M86 55 L76 63", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "text", x: 45, y: 80, size: 6.5, fill: "inkSoft", content: "подойти: se detiene junto", anchor: "middle" },
    { kind: "path", d: "M116 30 L116 12", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "text", x: 123, y: 96, size: 6.5, fill: "danger", content: "войти: cruza el umbral (b1-10)", anchor: "middle" },
  ],

  // "Мужчина подошёл к нам и спросил дорогу." — acercarse/alejarse de una persona en interacción social.
  socialApproachDistanceUsage: [
    { kind: "circle", cx: 40, cy: 50, r: 16, fill: "brand" },
    { kind: "text", x: 40, y: 54, size: 6, fill: "white", content: "он", bold: true, anchor: "middle" },
    { kind: "path", d: "M60 50 L96 50 L88 43 M96 50 L88 57", stroke: "inkSoft", strokeWidth: 2.5, round: true },
    { kind: "circle", cx: 118, cy: 50, r: 16, fill: "accentLight" },
    { kind: "text", x: 118, y: 54, size: 6, fill: "white", content: "мы", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 7, fill: "inkSoft", content: "подойти к кому-то · отойти от кого-то", anchor: "middle" },
  ],

  // "Это платье тебе подходит." — подходить en sentido figurado: convenir, quedar bien.
  podhoditFigurativeSuitable: [
    { kind: "rect", x: 40, y: 16, w: 80, h: 48, rx: 12, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 8, fill: "white", content: "тебе", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 50, size: 9, fill: "accentLight", content: "подходит", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 68 L80 78", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "text", x: 80, y: 92, size: 7, fill: "inkSoft", content: "te queda bien / te conviene", anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 6.5, fill: "danger", content: "sin relación con movimiento físico", anchor: "middle" },
  ],

  // "подошёл" (perfectivo, puntual) vs. "подходит" (imperfectivo, habitual) — mismo contraste del bloque.
  podOtAspectCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 8, fill: "white", content: "подошёл", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "accentLight", content: "puntual, perfectivo", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 8, fill: "inkSoft", content: "подходит", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "danger", content: "habitual, imperfectivo", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "mismo contraste que при-/у- y в-/вы-", anchor: "middle" },
  ],

  // "acercarse/alejarse" (ES, verbos reflexivos sin relación) vs. под-/от- + raíz (RU, misma base).
  spanishApproachDistanceCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6.5, fill: "inkSoft", content: "acercarse", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "inkSoft", content: "alejarse", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "reflexivos, sin relación (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6.5, fill: "white", content: "под-йти", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "white", content: "от-йти", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "misma raíz (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "brandLight", content: "к+dativo / от+genitivo, siempre predecible", anchor: "middle" },
  ],

  // перейти/переехать/перелететь — пере- marca siempre ir de un lado a otro, atravesar.
  crossPrefixPhysicalMeaning: [
    { kind: "rect", x: 10, y: 44, w: 50, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 35, y: 63, size: 7, fill: "white", content: "lado A", bold: true, anchor: "middle" },
    { kind: "path", d: "M64 59 L96 59 L88 51 M96 59 L88 67", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 100, y: 44, w: 50, h: 30, rx: 8, fill: "brandLight" },
    { kind: "text", x: 125, y: 63, size: 7, fill: "white", content: "lado B", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 7, fill: "inkSoft", content: "перейти · переехать · перелететь", anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 6.5, fill: "danger", content: "de un lado a otro", anchor: "middle" },
  ],

  // "перейти улицу" / "перейти через улицу" — через opcional en calles simples, casi obligatorio en obstáculos notables.
  cherezOptionalConstruction: [
    { kind: "rect", x: 10, y: 16, w: 132, h: 26, rx: 8, fill: "muted" },
    { kind: "text", x: 76, y: 33, size: 7.5, fill: "inkSoft", content: "перейти улицу", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 50, w: 132, h: 26, rx: 8, fill: "brand" },
    { kind: "text", x: 76, y: 67, size: 7.5, fill: "white", content: "перейти через мост", bold: true, anchor: "middle" },
    { kind: "text", x: 76, y: 92, size: 6.5, fill: "danger", content: "через: opcional (calle) → casi obligatorio (puente)", anchor: "middle" },
  ],

  // "Мы переехали в новую квартиру." — переехать en su sentido figurado más frecuente: mudarse.
  pereehatMudanzaFigurative: [
    { kind: "rect", x: 10, y: 20, w: 56, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 38, y: 46, size: 6.5, fill: "inkSoft", content: "casa vieja", bold: true, anchor: "middle" },
    { kind: "path", d: "M72 42 L94 42 L86 35 M94 42 L86 49", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "rect", x: 98, y: 20, w: 56, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 126, y: 46, size: 6.5, fill: "white", content: "квартира", bold: true, anchor: "middle" },
    { kind: "text", x: 82, y: 84, size: 7, fill: "inkSoft", content: "переехать = mudarse", anchor: "middle" },
    { kind: "text", x: 82, y: 100, size: 6.5, fill: "danger", content: "sin cruzar nada físicamente", anchor: "middle" },
  ],

  // перевести/переписать/передумать — пере- con la idea de transformación, cambio de un estado a otro.
  pereStateChangeFigurativeGroup: [
    { kind: "rect", x: 8, y: 10, w: 68, h: 24, rx: 7, fill: "brand" },
    { kind: "text", x: 42, y: 26, size: 6.5, fill: "white", content: "перевести", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 10, w: 68, h: 24, rx: 7, fill: "brandLight" },
    { kind: "text", x: 118, y: 26, size: 6.5, fill: "white", content: "переписать", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 42, w: 72, h: 24, rx: 7, fill: "accentLight" },
    { kind: "text", x: 80, y: 58, size: 6.5, fill: "white", content: "передумать", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 7, fill: "inkSoft", content: "cambio, transformación", anchor: "middle" },
  ],

  // пересесть/переписываться/переговоры — пере- con la idea de reciprocidad, entre varias partes.
  peresestTransferExchangeGroup: [
    { kind: "circle", cx: 40, cy: 50, r: 18, fill: "brand" },
    { kind: "text", x: 40, y: 54, size: 6.5, fill: "white", content: "A", bold: true, anchor: "middle" },
    { kind: "path", d: "M62 44 L98 44 L90 37 M98 44 L90 51", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "path", d: "M98 58 L62 58 L70 51 M62 58 L70 65", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "circle", cx: 120, cy: 50, r: 18, fill: "accentLight" },
    { kind: "text", x: 120, y: 54, size: 6.5, fill: "white", content: "B", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7, fill: "inkSoft", content: "пересесть · переписываться · переговоры", anchor: "middle" },
  ],

  // при-/у- (global) — в-/вы- (cruzar umbral) — под-/от- (cercano) — пере- (atravesar/cambiar): tabla del bloque.
  motionPrefixBlockComparisonTable: [
    { kind: "rect", x: 6, y: 10, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 40, y: 25, size: 6, fill: "white", content: "при-/у- (b1-9)", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 10, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 116, y: 25, size: 6, fill: "white", content: "в-/вы- (b1-10)", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 40, w: 68, h: 22, rx: 6, fill: "accent" },
    { kind: "text", x: 40, y: 55, size: 6, fill: "white", content: "под-/от- (b1-11)", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 40, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 116, y: 55, size: 6, fill: "white", content: "пере- (aquí)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "global · umbral · cercano · atravesar/cambiar", anchor: "middle" },
  ],

  // "перешли" (perfectivo, puntual) vs. "переходим" (imperfectivo, habitual) — mismo contraste del bloque.
  pereAspectCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 8, fill: "white", content: "перешли", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "accentLight", content: "puntual, perfectivo", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 8, fill: "inkSoft", content: "переходим", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "danger", content: "habitual, imperfectivo", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "mismo contraste de todo el bloque", anchor: "middle" },
  ],

  // "cruzar/mudarse" (ES, verbos sin relación) vs. пере- + raíz (RU, un solo prefijo para ambos).
  spanishCrossChangeCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6.5, fill: "inkSoft", content: "cruzar", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "inkSoft", content: "mudarse", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "verbos sin relación (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6.5, fill: "white", content: "пере-йти", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "white", content: "пере-ехать", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "un solo prefijo (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "brandLight", content: "cruzar, traducir, cambiar de opinión: todo пере-", anchor: "middle" },
  ],

  // "Мы прошли мимо магазина." — про- + мимо + genitivo, pasar de largo sin detenerse.
  proPrefixPassByMeaning: [
    { kind: "rect", x: 60, y: 40, w: 40, h: 34, rx: 8, fill: "muted" },
    { kind: "text", x: 80, y: 61, size: 6.5, fill: "inkSoft", content: "магазин", bold: true, anchor: "middle" },
    { kind: "path", d: "M8 60 L150 60", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "path", d: "M140 60 L150 60 L144 53 M150 60 L144 67", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "text", x: 80, y: 90, size: 7, fill: "inkSoft", content: "прошли мимо, sin entrar", anchor: "middle" },
    { kind: "text", x: 80, y: 106, size: 6.5, fill: "danger", content: "мимо + genitivo", anchor: "middle" },
  ],

  // "Я прошёл десять километров." — про- + distancia en acusativo, recorrer un trayecto completo.
  proPrefixFullDistanceMeaning: [
    { kind: "path", d: "M10 60 L150 60", stroke: "brand", strokeWidth: 4, round: true },
    { kind: "circle", cx: 10, cy: 60, r: 6, fill: "brand" },
    { kind: "circle", cx: 150, cy: 60, r: 6, fill: "accentLight" },
    { kind: "text", x: 80, y: 40, size: 8, fill: "inkSoft", content: "10 километров", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 86, size: 7, fill: "danger", content: "distancia en acusativo, sin preposición", anchor: "middle" },
  ],

  // "Как доехать до вокзала?" — до- + до + genitivo, alcanzar un límite/destino.
  doPrefixReachDestinationMeaning: [
    { kind: "path", d: "M10 60 L104 60 L96 53 M104 60 L96 67", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 108, y: 40, w: 42, h: 40, rx: 8, fill: "brand" },
    { kind: "text", x: 129, y: 64, size: 6.5, fill: "white", content: "вокзал", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 7, fill: "inkSoft", content: "дойти / доехать до вокзала", anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 6.5, fill: "danger", content: "до + genitivo", anchor: "middle" },
  ],

  // "прийти" (resultado final) vs. "дойти" (proceso, con esfuerzo) — comparación directa.
  priVsDoCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 8, fill: "white", content: "прийти", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "accentLight", content: "resultado (b1-9)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "accentLight" },
    { kind: "text", x: 119, y: 40, size: 8, fill: "white", content: "дойти", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "white", content: "proceso, esfuerzo", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "мы наконец дошли до вершины", anchor: "middle" },
  ],

  // "Что произошло?" — происходить/произойти, про- en sentido figurado de suceder/ocurrir.
  proFigurativeContinuityGroup: [
    { kind: "circle", cx: 80, cy: 50, r: 30, fill: "brand" },
    { kind: "text", x: 80, y: 47, size: 8, fill: "white", content: "что", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 7, fill: "accentLight", content: "произошло?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 94, size: 7, fill: "inkSoft", content: "происходить / произойти", anchor: "middle" },
    { kind: "text", x: 80, y: 110, size: 6.5, fill: "danger", content: "suceder, ocurrir (figurado)", anchor: "middle" },
  ],

  // "Он наконец добился успеха." — договориться/добиться, до- en sentido figurado de lograr con esfuerzo.
  doFigurativeAchievementGroup: [
    { kind: "rect", x: 8, y: 14, w: 68, h: 26, rx: 8, fill: "brand" },
    { kind: "text", x: 42, y: 31, size: 6.5, fill: "white", content: "договориться", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 14, w: 68, h: 26, rx: 8, fill: "accentLight" },
    { kind: "text", x: 118, y: 31, size: 7, fill: "white", content: "добиться", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 7, fill: "inkSoft", content: "он наконец добился успеха", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "danger", content: "lograr una meta tras esfuerzo", anchor: "middle" },
  ],

  // при-/у- + в-/вы- + под-/от- + пере- + про-/до- — el sistema completo de cinco pares de prefijos.
  fullPrefixSystemReviewTable: [
    { kind: "rect", x: 4, y: 8, w: 68, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 22, size: 5.5, fill: "white", content: "при-/у- (b1-9)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 68, h: 20, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 22, size: 5.5, fill: "white", content: "в-/вы- (b1-10)", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 34, w: 68, h: 20, rx: 6, fill: "accent" },
    { kind: "text", x: 38, y: 48, size: 5.5, fill: "white", content: "под-/от- (b1-11)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 68, h: 20, rx: 6, fill: "accentLight" },
    { kind: "text", x: 114, y: 48, size: 5.5, fill: "white", content: "пере- (b1-12)", bold: true, anchor: "middle" },
    { kind: "rect", x: 42, y: 60, w: 68, h: 20, rx: 6, fill: "ink" },
    { kind: "text", x: 76, y: 74, size: 5.5, fill: "white", content: "про-/до- (aquí)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 98, size: 6.5, fill: "inkSoft", content: "cinco pares, un solo sistema predecible", anchor: "middle" },
  ],

  // "pasar de largo/llegar hasta" (ES, sin raíz compartida) vs. про-/до- + raíz (RU, mismo sistema).
  spanishPassReachCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6.5, fill: "inkSoft", content: "pasar de largo", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6.5, fill: "inkSoft", content: "llegar hasta", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "sin raíz compartida (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6.5, fill: "white", content: "про-йти", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6.5, fill: "white", content: "до-йти", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "mismo sistema (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "brandLight", content: "preposiciones siempre predecibles", anchor: "middle" },
  ],

  // Árbol de decisión: ¿destino lejano? umbral? cercano? atravesar? pasar de largo? — un prefijo por respuesta.
  fullPrefixSystemDecisionTree: [
    { kind: "circle", cx: 24, cy: 20, r: 12, fill: "brand" },
    { kind: "text", x: 24, y: 23, size: 6, fill: "white", content: "?", bold: true, anchor: "middle" },
    { kind: "path", d: "M24 32 L24 100", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "path", d: "M24 46 L60 46", stroke: "brandLight", strokeWidth: 2, round: true },
    { kind: "text", x: 108, y: 49, size: 6, fill: "inkSoft", content: "destino lejano → при-/у-", anchor: "middle" },
    { kind: "path", d: "M24 62 L60 62", stroke: "accent", strokeWidth: 2, round: true },
    { kind: "text", x: 108, y: 65, size: 6, fill: "inkSoft", content: "umbral → в-/вы-", anchor: "middle" },
    { kind: "path", d: "M24 78 L60 78", stroke: "accentLight", strokeWidth: 2, round: true },
    { kind: "text", x: 108, y: 81, size: 6, fill: "inkSoft", content: "cercano → под-/от-", anchor: "middle" },
    { kind: "path", d: "M24 94 L60 94", stroke: "ink", strokeWidth: 2, round: true },
    { kind: "text", x: 108, y: 97, size: 6, fill: "inkSoft", content: "atravesar/pasar → пере-/про-/до-", anchor: "middle" },
  ],

  // при-/у- (b1-9): dos cajas comparando llegada global y partida global.
  priUReviewCompact: [
    { kind: "rect", x: 10, y: 30, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 47, size: 7.5, fill: "white", content: "пришёл", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 61, size: 6, fill: "accentLight", content: "llegada (b1-9)", anchor: "middle" },
    { kind: "rect", x: 88, y: 30, w: 62, h: 40, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 47, size: 7.5, fill: "inkSoft", content: "ушла", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 61, size: 6, fill: "danger", content: "partida (b1-9)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 6.5, fill: "inkSoft", content: "он пришёл в семь, она ушла в восемь", anchor: "middle" },
  ],

  // в-/вы- (b1-10): puerta con flechas de entrada y salida.
  vVyReviewCompact: [
    { kind: "rect", x: 66, y: 16, w: 28, h: 70, rx: 4, fill: "muted" },
    { kind: "path", d: "M10 40 L64 40 L56 33 M64 40 L56 47", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "path", d: "M96 62 L150 62 L142 55 M150 62 L142 69", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "text", x: 37, y: 30, size: 6, fill: "brand", content: "войти", bold: true, anchor: "middle" },
    { kind: "text", x: 123, y: 78, size: 6, fill: "accentLight", content: "выйти", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 104, size: 6.5, fill: "inkSoft", content: "cruzar el umbral, adentro y afuera", anchor: "middle" },
  ],

  // под-/от- (b1-11): un punto con flechas cortas de aproximación y alejamiento.
  podOtReviewCompact: [
    { kind: "circle", cx: 80, cy: 55, r: 10, fill: "ink" },
    { kind: "path", d: "M20 55 L66 55 L58 48 M66 55 L58 62", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "path", d: "M94 55 L140 55 L132 48 M140 55 L132 62", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "text", x: 43 , y: 42, size: 6, fill: "brand", content: "подойти", bold: true, anchor: "middle" },
    { kind: "text", x: 117, y: 42, size: 6, fill: "accentLight", content: "отойти", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 6.5, fill: "inkSoft", content: "cerca de un punto, sin cruzar nada", anchor: "middle" },
  ],

  // пере-/про-/до- (b1-12/b1-13): tres tramos de un mismo camino con sus tres matices.
  pereProDoReviewCompact: [
    { kind: "path", d: "M8 60 L150 60", stroke: "muted", strokeWidth: 3, round: true },
    { kind: "circle", cx: 30, cy: 60, r: 8, fill: "brand" },
    { kind: "circle", cx: 80, cy: 60, r: 8, fill: "accent" },
    { kind: "circle", cx: 130, cy: 60, r: 8, fill: "accentLight" },
    { kind: "text", x: 30, y: 40, size: 5.5, fill: "brand", content: "перейти", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 40, size: 5.5, fill: "accent", content: "пройти мимо", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 40, size: 5.5, fill: "accentLight", content: "дойти до", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 6.5, fill: "inkSoft", content: "cruzar · pasar de largo · alcanzar", anchor: "middle" },
  ],

  // перейти/войти/отойти figurados: tres cajas con sus significados no espaciales.
  figurativeMotionVerbsGroup: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 24, rx: 7, fill: "brand" },
    { kind: "text", x: 38, y: 26, size: 6, fill: "white", content: "перейти к теме", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 10, w: 70, h: 24, rx: 7, fill: "brandLight" },
    { kind: "text", x: 117, y: 26, size: 6, fill: "white", content: "войти в моду", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 42, w: 72, h: 24, rx: 7, fill: "accentLight" },
    { kind: "text", x: 80, y: 58, size: 6, fill: "white", content: "отойти от шока", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "movimiento físico → movimiento emocional/temático", anchor: "middle" },
  ],

  // вывод/переводчик/продолжать/цель: sustantivos y verbos figurados derivados del sistema.
  figurativeDerivedNounsGroup: [
    { kind: "rect", x: 4, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 22, size: 6, fill: "white", content: "вывод", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 70, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 115, y: 22, size: 6, fill: "white", content: "переводчик", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 34, w: 68, h: 22, rx: 6, fill: "accent" },
    { kind: "text", x: 38, y: 48, size: 6, fill: "white", content: "продолжить", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 70, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 115, y: 48, size: 6, fill: "white", content: "цель", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 6.5, fill: "inkSoft", content: "sustantivos y verbos figurados del sistema", anchor: "middle" },
  ],

  // "llegar/partir/entrar/salir/acercarse/alejarse/cruzar/alcanzar" (ES) vs. un sistema de prefijos (RU).
  spanishManyVerbsVsOneSystemCompare: [
    { kind: "rect", x: 6, y: 14, w: 68, h: 60, rx: 10, fill: "muted" },
    { kind: "text", x: 40, y: 30, size: 5.5, fill: "inkSoft", content: "llegar · partir", anchor: "middle" },
    { kind: "text", x: 40, y: 44, size: 5.5, fill: "inkSoft", content: "entrar · salir", anchor: "middle" },
    { kind: "text", x: 40, y: 58, size: 5.5, fill: "inkSoft", content: "acercarse · alejarse", anchor: "middle" },
    { kind: "text", x: 40, y: 68, size: 5, fill: "danger", content: "ocho verbos (ES)", anchor: "middle" },
    { kind: "rect", x: 86, y: 14, w: 68, h: 60, rx: 10, fill: "brand" },
    { kind: "text", x: 120, y: 40, size: 7, fill: "white", content: "-йти", bold: true, anchor: "middle" },
    { kind: "text", x: 120, y: 54, size: 6, fill: "accentLight", content: "+ 8 prefijos", anchor: "middle" },
    { kind: "text", x: 120, y: 66, size: 5, fill: "white", content: "un sistema (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 6.5, fill: "inkSoft", content: "misma raíz, un prefijo por matiz", anchor: "middle" },
  ],

  // "Ты когда-нибудь читал «Войну и мир»?" — general-fáctico: importa la experiencia, no el resultado.
  aspectGeneralFactualMeaning: [
    { kind: "circle", cx: 80, cy: 46, r: 26, fill: "brand" },
    { kind: "text", x: 80, y: 43, size: 7, fill: "white", content: "когда-", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 55, size: 7, fill: "accentLight", content: "нибудь?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 7, fill: "inkSoft", content: "importa la experiencia", anchor: "middle" },
    { kind: "text", x: 80, y: 104, size: 6.5, fill: "danger", content: "no el resultado ni el momento", anchor: "middle" },
  ],

  // брать/взять, класть/положить, ловить/поймать — raíces distintas, sin relación de prefijo.
  aspectSuppletivePairsGroup: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 24, size: 6, fill: "white", content: "брать → взять", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 10, w: 74, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 119, y: 24, size: 6, fill: "white", content: "класть → положить", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 42, w: 72, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 80, y: 56, size: 6, fill: "white", content: "ловить → поймать", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "raíces distintas, sin prefijo compartido", anchor: "middle" },
  ],

  // "Он встал, оделся и вышел." — cadena de tres eventos perfectivos sucesivos.
  aspectNarrativeSequenceChain: [
    { kind: "circle", cx: 24, cy: 60, r: 12, fill: "brand" },
    { kind: "text", x: 24, y: 63, size: 5.5, fill: "white", content: "1", bold: true, anchor: "middle" },
    { kind: "path", d: "M36 60 L64 60 L57 54 M64 60 L57 66", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "circle", cx: 80, cy: 60, r: 12, fill: "accent" },
    { kind: "text", x: 80, y: 63, size: 5.5, fill: "white", content: "2", bold: true, anchor: "middle" },
    { kind: "path", d: "M92 60 L120 60 L113 54 M120 60 L113 66", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "circle", cx: 136, cy: 60, r: 12, fill: "accentLight" },
    { kind: "text", x: 136, y: 63, size: 5.5, fill: "white", content: "3", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 6.5, fill: "inkSoft", content: "встал → оделся → вышел, uno tras otro", anchor: "middle" },
  ],

  // "Когда я готовил ужин, зазвонил телефон." — fondo imperfectivo interrumpido por evento perfectivo.
  aspectBackgroundEventContrast: [
    { kind: "rect", x: 6, y: 34, w: 148, h: 24, rx: 8, fill: "muted" },
    { kind: "text", x: 80, y: 50, size: 6.5, fill: "inkSoft", content: "готовил ужин (fondo)", bold: true, anchor: "middle" },
    { kind: "circle", cx: 120, cy: 34, r: 11, fill: "danger" },
    { kind: "text", x: 120, y: 37, size: 5.5, fill: "white", content: "!", bold: true, anchor: "middle" },
    { kind: "text", x: 120, y: 18, size: 5.5, fill: "danger", content: "зазвонил", anchor: "middle" },
    { kind: "text", x: 80, y: 78, size: 6.5, fill: "inkSoft", content: "imperfectivo (proceso) + perfectivo (evento)", anchor: "middle" },
  ],

  // "Я три раза прочитал эту статью." — perfectivo con número exacto de repeticiones completadas.
  aspectCountedRepetitionPerfective: [
    { kind: "circle", cx: 30, cy: 50, r: 16, fill: "brand" },
    { kind: "text", x: 30, y: 54, size: 6.5, fill: "white", content: "1", bold: true, anchor: "middle" },
    { kind: "circle", cx: 80, cy: 50, r: 16, fill: "brand" },
    { kind: "text", x: 80, y: 54, size: 6.5, fill: "white", content: "2", bold: true, anchor: "middle" },
    { kind: "circle", cx: 130, cy: 50, r: 16, fill: "brand" },
    { kind: "text", x: 130, y: 54, size: 6.5, fill: "white", content: "3", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 7, fill: "inkSoft", content: "три раза прочитал", anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 6.5, fill: "danger", content: "cada vez completada (perfectivo)", anchor: "middle" },
  ],

  // "Кто открыл окно?" (resultado) vs. "Кто открывал окно?" (general-fáctico) — contraste clásico de a2-1.
  aspectClassicContrastRevisited: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 7.5, fill: "white", content: "открыл", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "accentLight", content: "resultado", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 7.5, fill: "inkSoft", content: "открывал", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "danger", content: "general-fáctico", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "el mismo contraste de a2-1, con nombre técnico", anchor: "middle" },
  ],

  // Tabla resumen: proceso/hábito, general-fáctico (imperf.) — secuencia, repetición contada (perf.).
  aspectPastUsesSummaryTable: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 38, y: 25, size: 5.5, fill: "inkSoft", content: "proceso / hábito", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 10, w: 68, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 114, y: 25, size: 5.5, fill: "inkSoft", content: "general-fáctico", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 40, w: 68, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 55, size: 5.5, fill: "white", content: "secuencia narrativa", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 40, w: 68, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 114, y: 55, size: 5.5, fill: "white", content: "repetición contada", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "imperfectivo (arriba) vs. perfectivo (abajo)", anchor: "middle" },
  ],

  // Español: imperfecto/indefinido no marcan pares supletivos ni repetición contada como el ruso.
  spanishPastAspectNuanceCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6, fill: "inkSoft", content: "tomar / coger", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "inkSoft", content: "leí tres veces", anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "sin marca aspectual (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6, fill: "white", content: "брать / взять", anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "три раза прочитал", anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "aspecto marcado (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "el ruso codifica estos matices en el verbo", anchor: "middle" },
  ],

  // буду + infinitivo (compuesto, proceso) vs. forma perfectiva conjugada directamente (simple, resultado).
  futureCompoundSimpleReviewCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 7, fill: "inkSoft", content: "буду работать", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "danger", content: "compuesto, proceso", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 7, fill: "white", content: "сделаю", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "accentLight", content: "simple, resultado", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "repaso de a2-1: dos formas de futuro", anchor: "middle" },
  ],

  // El perfectivo no tiene presente: su conjugación no-pasada (que parece presente) es siempre futuro.
  futureNoPresentPerfectiveExplain: [
    { kind: "rect", x: 6, y: 14, w: 68, h: 26, rx: 8, fill: "muted" },
    { kind: "text", x: 40, y: 31, size: 6.5, fill: "danger", content: "presente: — (no existe)", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 14, w: 68, h: 26, rx: 8, fill: "brand" },
    { kind: "text", x: 118, y: 31, size: 6.5, fill: "white", content: "прочитаю = futuro", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 7, fill: "inkSoft", content: "acción completa ≠ 'ocurriendo ahora'", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "conjugación no-pasada del perfectivo = futuro", anchor: "middle" },
  ],

  // "буду звонить каждый день" (hábito) vs. "позвоню завтра" (acción única) en futuro.
  futureHabitualVsSingleAction: [
    { kind: "circle", cx: 34, cy: 40, r: 9, fill: "brand" },
    { kind: "circle", cx: 60, cy: 40, r: 9, fill: "brand" },
    { kind: "circle", cx: 86, cy: 40, r: 9, fill: "brand" },
    { kind: "text", x: 60, y: 62, size: 6, fill: "brand", content: "буду звонить каждый день", bold: true, anchor: "middle" },
    { kind: "circle", cx: 128, cy: 40, r: 12, fill: "accentLight" },
    { kind: "text", x: 128, y: 90, size: 6, fill: "accentLight", content: "позвоню завтра", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 6.5, fill: "inkSoft", content: "hábito repetido vs. una sola vez", anchor: "middle" },
  ],

  // "как только / если" + futuro (RU) vs. subjuntivo en la cláusula correspondiente (ES).
  futureTemporalClauseContrastES: [
    { kind: "rect", x: 6, y: 16, w: 68, h: 30, rx: 8, fill: "muted" },
    { kind: "text", x: 40, y: 32, size: 6, fill: "inkSoft", content: "cuando llegues", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 42, size: 5, fill: "danger", content: "subjuntivo (ES)", anchor: "middle" },
    { kind: "rect", x: 84, y: 16, w: 68, h: 30, rx: 8, fill: "brand" },
    { kind: "text", x: 118, y: 32, size: 6, fill: "white", content: "когда придёшь", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 42, size: 5, fill: "accentLight", content: "futuro (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 6.5, fill: "inkSoft", content: "как только / если + futuro, sin cambio de modo", anchor: "middle" },
  ],

  // взять→возьму, класть→положу, ловить→поймаю — supletivos de b1-15, conjugados en futuro.
  futureSuppletivePairsBridge: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 24, size: 6, fill: "white", content: "взять → возьму", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 10, w: 74, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 119, y: 24, size: 6, fill: "white", content: "класть → положу", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 42, w: 72, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 80, y: 56, size: 6, fill: "white", content: "ловить → поймаю", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "conjugación directa del perfectivo (b1-15 → futuro)", anchor: "middle" },
  ],

  // "обещаю, что сделаю" (promesa, perfectivo) vs. "буду стараться" (esfuerzo, imperfectivo).
  futurePromiseVsEffortRegister: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 7, fill: "white", content: "сделаю", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "accentLight", content: "promesa, resultado", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 7, fill: "inkSoft", content: "буду стараться", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "danger", content: "esfuerzo, sin garantía", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "compromiso firme vs. mejor esfuerzo", anchor: "middle" },
  ],

  // Tabla resumen del futuro: imperfectivo (proceso/hábito) vs. perfectivo (resultado/promesa/puntual).
  futureAspectSummaryTable: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 38, y: 25, size: 5.5, fill: "inkSoft", content: "proceso / duración", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 10, w: 68, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 114, y: 25, size: 5.5, fill: "inkSoft", content: "hábito repetido", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 40, w: 68, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 55, size: 5.5, fill: "white", content: "resultado único", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 40, w: 68, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 114, y: 55, size: 5.5, fill: "white", content: "promesa concreta", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "imperfectivo (arriba) vs. perfectivo (abajo)", anchor: "middle" },
  ],

  // Español necesita subjuntivo tras conjunciones temporales/condicionales; el ruso solo usa el aspecto.
  spanishSubjunctiveVsRussianFutureCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6, fill: "inkSoft", content: "cuando llegues", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "inkSoft", content: "si vinieras", anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "cambio de modo (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6, fill: "white", content: "когда придёшь", anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "если придёшь", anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "solo aspecto, indicativo (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "el ruso no cambia de modo verbal", anchor: "middle" },
  ],

  // начать/продолжать/перестать + infinitivo SIEMPRE imperfectivo — marcan inicio/continuación/fin de un proceso.
  phaseVerbsAlwaysImperfective: [
    { kind: "rect", x: 4, y: 14, w: 68, h: 24, rx: 7, fill: "brand" },
    { kind: "text", x: 38, y: 30, size: 6, fill: "white", content: "начать читать", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 14, w: 70, h: 24, rx: 7, fill: "brandLight" },
    { kind: "text", x: 117, y: 30, size: 6, fill: "white", content: "перестать курить", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 7, fill: "danger", content: "siempre + infinitivo imperfectivo", anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "inicio/continuación/fin de un PROCESO", anchor: "middle" },
  ],

  // мочь/смочь, хотеть/захотеть, уметь/суметь — ambos aspectos posibles, cambia el matiz.
  modalVerbsBothAspectsNuance: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6.5, fill: "inkSoft", content: "мочь / хотеть", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 5.5, fill: "inkSoft", content: "уметь", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6.5, fill: "white", content: "ambos aspectos", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 5.5, fill: "accentLight", content: "cambia el matiz", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "a diferencia de los verbos de fase", anchor: "middle" },
  ],

  // "мог" (capacidad general, imperfectivo) vs. "смог" (intento puntual, perfectivo).
  mochSmochCapacityVsAttemptContrast: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 8, fill: "inkSoft", content: "мог", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 6, fill: "danger", content: "capacidad general", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 8, fill: "white", content: "смог", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "accentLight", content: "intento puntual", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "не смог поднять чемодан", anchor: "middle" },
  ],

  // "хочу написать" (perfectivo, resultado) vs. "хочу писать" (imperfectivo, proceso).
  hotetAspectNuanceGroup: [
    { kind: "circle", cx: 45, cy: 50, r: 26, fill: "brand" },
    { kind: "text", x: 45, y: 47, size: 6.5, fill: "white", content: "написать", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 60, size: 5.5, fill: "accentLight", content: "resultado", anchor: "middle" },
    { kind: "circle", cx: 115, cy: 50, r: 26, fill: "muted" },
    { kind: "text", x: 115, y: 47, size: 6.5, fill: "inkSoft", content: "писать", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 60, size: 5.5, fill: "danger", content: "proceso", anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 6.5, fill: "inkSoft", content: "хочу + infinitivo: dos matices de deseo", anchor: "middle" },
  ],

  // "забыл выключить" (olvido puntual, perfectivo) vs. "забывает выключать" (olvido habitual, imperfectivo).
  zabytZabyvatNegationHabitContrast: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "white", content: "забыл выключить", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5.5, fill: "accentLight", content: "una vez, puntual", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "inkSoft", content: "забывает выключать", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5.5, fill: "danger", content: "siempre, habitual", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "он всегда забывает выключать свет", anchor: "middle" },
  ],

  // успеть/решить/удаться — verbos de logro puntual, casi siempre + infinitivo perfectivo.
  achievementVerbsPerfectiveGroup: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 24, size: 6, fill: "white", content: "успеть закончить", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 10, w: 70, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 115, y: 24, size: 6, fill: "white", content: "решить отказаться", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 42, w: 72, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 80, y: 56, size: 6, fill: "white", content: "удалось поднять", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "logro/decisión puntual → infinitivo perfectivo", anchor: "middle" },
  ],

  // Tabla resumen: fase (siempre imperf.) — modales (ambos) — logro puntual (casi siempre perf.).
  infinitiveAspectDecisionSummaryTable: [
    { kind: "rect", x: 4, y: 10, w: 45, h: 60, rx: 6, fill: "brand" },
    { kind: "text", x: 26, y: 30, size: 5.5, fill: "white", content: "fase", bold: true, anchor: "middle" },
    { kind: "text", x: 26, y: 44, size: 5, fill: "accentLight", content: "siempre", anchor: "middle" },
    { kind: "text", x: 26, y: 55, size: 5, fill: "accentLight", content: "imperfectivo", anchor: "middle" },
    { kind: "rect", x: 57, y: 10, w: 45, h: 60, rx: 6, fill: "accent" },
    { kind: "text", x: 79, y: 30, size: 5.5, fill: "white", content: "modales", bold: true, anchor: "middle" },
    { kind: "text", x: 79, y: 44, size: 5, fill: "white", content: "ambos", anchor: "middle" },
    { kind: "text", x: 79, y: 55, size: 5, fill: "white", content: "aspectos", anchor: "middle" },
    { kind: "rect", x: 110, y: 10, w: 45, h: 60, rx: 6, fill: "accentLight" },
    { kind: "text", x: 132, y: 30, size: 5.5, fill: "white", content: "logro", bold: true, anchor: "middle" },
    { kind: "text", x: 132, y: 44, size: 5, fill: "white", content: "casi siempre", anchor: "middle" },
    { kind: "text", x: 132, y: 55, size: 5, fill: "white", content: "perfectivo", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "tres grupos, tres reglas", anchor: "middle" },
  ],

  // El infinitivo español no distingue aspecto: "empezar a leer" no tiene contraste morfológico equivalente.
  spanishNoInfinitiveAspectCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6, fill: "inkSoft", content: "empezar a leer", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "inkSoft", content: "(un solo infinitivo)", anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "sin aspecto marcado (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6, fill: "white", content: "начать читать", anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "*начать прочитать", anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "aspecto obligatorio (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "el ruso elige, el español no distingue", anchor: "middle" },
  ],

  // "не читал" — negación con imperfectivo: opción por defecto, simple hecho negativo.
  negationImperfectiveDefaultMeaning: [
    { kind: "circle", cx: 80, cy: 50, r: 30, fill: "muted" },
    { kind: "text", x: 80, y: 47, size: 7, fill: "inkSoft", content: "не читал", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 5.5, fill: "danger", content: "hecho simple", anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 7, fill: "inkSoft", content: "opción por defecto, sin más matiz", anchor: "middle" },
  ],

  // "не прочитал" — perfectivo negado: había un intento, y el resultado no se logró.
  negationPerfectiveFailedAttempt: [
    { kind: "path", d: "M10 60 L96 60", stroke: "brand", strokeWidth: 3, round: true },
    { kind: "circle", cx: 10, cy: 60, r: 7, fill: "brand" },
    { kind: "text", x: 118, y: 55, size: 9, fill: "danger", content: "✕", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 7, fill: "inkSoft", content: "не прочитал до конца", anchor: "middle" },
    { kind: "text", x: 80, y: 104, size: 6.5, fill: "danger", content: "intento sin resultado", anchor: "middle" },
  ],

  // "автобус не пришёл" — perfectivo negado: expectativa concreta que no se cumplió.
  negationPerfectiveUnmetExpectation: [
    { kind: "rect", x: 60, y: 16, w: 40, h: 30, rx: 6, fill: "muted" },
    { kind: "text", x: 80, y: 35, size: 6, fill: "inkSoft", content: "остановка", anchor: "middle" },
    { kind: "path", d: "M80 50 L80 78", stroke: "danger", strokeWidth: 2 },
    { kind: "text", x: 80, y: 92, size: 9, fill: "danger", content: "✕", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 108, size: 6.5, fill: "inkSoft", content: "автобус не пришёл — se esperaba y no llegó", anchor: "middle" },
  ],

  // Repetición habitual (imperfectivo, sin cuenta) vs. contada (perfectivo, b1-15, con número exacto).
  repetitionHabitualVsCountedBridge: [
    { kind: "rect", x: 6, y: 16, w: 68, h: 40, rx: 8, fill: "muted" },
    { kind: "text", x: 40, y: 34, size: 6, fill: "inkSoft", content: "всегда / часто", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 46, size: 5.5, fill: "danger", content: "imperfectivo", anchor: "middle" },
    { kind: "rect", x: 86, y: 16, w: 68, h: 40, rx: 8, fill: "brand" },
    { kind: "text", x: 120, y: 34, size: 6, fill: "white", content: "три раза (b1-15)", bold: true, anchor: "middle" },
    { kind: "text", x: 120, y: 46, size: 5.5, fill: "accentLight", content: "perfectivo", anchor: "middle" },
    { kind: "text", x: 80, y: 78, size: 6.5, fill: "inkSoft", content: "sin cuenta vs. número exacto completado", anchor: "middle" },
  ],

  // "ни разу не опоздал" — negación enfática de la repetición, casi siempre imperfectivo.
  niRazuEmphaticNegationGroup: [
    { kind: "circle", cx: 30, cy: 55, r: 9, fill: "muted" },
    { kind: "circle", cx: 60, cy: 55, r: 9, fill: "muted" },
    { kind: "circle", cx: 90, cy: 55, r: 9, fill: "muted" },
    { kind: "circle", cx: 120, cy: 55, r: 9, fill: "muted" },
    { kind: "path", d: "M10 55 L140 55", stroke: "danger", strokeWidth: 2 },
    { kind: "text", x: 80, y: 30, size: 6.5, fill: "danger", content: "ни разу", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "más enfático que 'никогда'", anchor: "middle" },
  ],

  // "чуть не забыл" / "чудом не пропустил" — casi ocurre, pero se evita en el último momento.
  chutNeNearMissPerfectiveGroup: [
    { kind: "path", d: "M10 60 L120 60 L108 50 M120 60 L108 70", stroke: "accentLight", strokeWidth: 3, round: true },
    { kind: "rect", x: 122, y: 44, w: 30, h: 32, rx: 6, fill: "danger" },
    { kind: "text", x: 137, y: 64, size: 8, fill: "white", content: "✕", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 7, fill: "inkSoft", content: "чуть не / чудом не + perfectivo", anchor: "middle" },
    { kind: "text", x: 80, y: 106, size: 6.5, fill: "danger", content: "a punto de... pero no ocurrió", anchor: "middle" },
  ],

  // Tabla resumen: negación (hecho / intento fallido / expectativa) y repetición (habitual / contada).
  negationRepetitionSummaryTable: [
    { kind: "rect", x: 4, y: 8, w: 48, h: 26, rx: 6, fill: "muted" },
    { kind: "text", x: 28, y: 24, size: 5, fill: "inkSoft", content: "hecho simple", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 48, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 24, size: 5, fill: "white", content: "intento fallido", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 48, h: 26, rx: 6, fill: "brandLight" },
    { kind: "text", x: 132, y: 24, size: 5, fill: "white", content: "expectativa", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 40, w: 74, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "inkSoft", content: "repetición habitual", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 40, w: 74, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "white", content: "repetición contada", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "negación (arriba) y repetición (abajo)", anchor: "middle" },
  ],

  // Español: "no" no cambia la forma verbal; el matiz se expresa con perífrasis o contexto.
  spanishNegationNoAspectChangeCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6, fill: "inkSoft", content: "no leí", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "inkSoft", content: "no llegué a leer", anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "misma forma verbal (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6, fill: "white", content: "не читал", anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "не прочитал", anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "aspecto distinto (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "el ruso codifica el matiz en el verbo", anchor: "middle" },
  ],

  // читают → читающий: raíz de 3ª pl. presente + -ущ-/-ющ-/-ащ-/-ящ- + terminación de adjetivo.
  presentActiveParticipleFormation: [
    { kind: "rect", x: 4, y: 18, w: 60, h: 28, rx: 7, fill: "muted" },
    { kind: "text", x: 34, y: 36, size: 6.5, fill: "inkSoft", content: "читают", bold: true, anchor: "middle" },
    { kind: "path", d: "M68 32 L94 32 L87 26 M94 32 L87 38", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "rect", x: 98, y: 18, w: 58, h: 28, rx: 7, fill: "brand" },
    { kind: "text", x: 127, y: 36, size: 6.5, fill: "white", content: "читающий", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "danger", content: "+ -ущ-/-ющ- (1ª conj.) / -ащ-/-ящ- (2ª conj.)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "solo verbos imperfectivos", anchor: "middle" },
  ],

  // читал → читавший: raíz del pasado (sin -л) + -вш-/-ш- + terminación de adjetivo.
  pastActiveParticipleFormation: [
    { kind: "rect", x: 4, y: 18, w: 60, h: 28, rx: 7, fill: "muted" },
    { kind: "text", x: 34, y: 36, size: 6.5, fill: "inkSoft", content: "читал", bold: true, anchor: "middle" },
    { kind: "path", d: "M68 32 L94 32 L87 26 M94 32 L87 38", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "rect", x: 98, y: 18, w: 58, h: 28, rx: 7, fill: "brand" },
    { kind: "text", x: 127, y: 36, size: 6.5, fill: "white", content: "читавший", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "danger", content: "+ -вш- (vocal) / -ш- (consonante)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "verbos imperfectivos Y perfectivos", anchor: "middle" },
  ],

  // читавший (imperfectivo, proceso) vs. прочитавший (perfectivo, resultado) — mismo contraste de b1-15.
  aspectPastParticipleContrast: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "inkSoft", content: "читавший", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5.5, fill: "danger", content: "imperfectivo, proceso", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "white", content: "прочитавший", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5.5, fill: "accentLight", content: "perfectivo, resultado", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "el aspecto se conserva en el participio", anchor: "middle" },
  ],

  // студент читающий / студентка читающая / студенты читающие — concordancia como cualquier adjetivo.
  participleAdjectiveAgreementTable: [
    { kind: "rect", x: 4, y: 12, w: 48, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 28, y: 28, size: 5.5, fill: "white", content: "читающий", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 12, w: 48, h: 24, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 28, size: 5.5, fill: "white", content: "читающая", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 12, w: 48, h: 24, rx: 6, fill: "accentLight" },
    { kind: "text", x: 132, y: 28, size: 5.5, fill: "white", content: "читающие", bold: true, anchor: "middle" },
    { kind: "text", x: 28, y: 48, size: 5, fill: "inkSoft", content: "masc.", anchor: "middle" },
    { kind: "text", x: 80, y: 48, size: 5, fill: "inkSoft", content: "fem.", anchor: "middle" },
    { kind: "text", x: 132, y: 48, size: 5, fill: "inkSoft", content: "plural", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 6.5, fill: "inkSoft", content: "género, número y caso, como un adjetivo", anchor: "middle" },
  ],

  // Frase participial pospuesta: se separa con comas. Antepuesta: sin comas.
  participleCommaPlacementRules: [
    { kind: "text", x: 80, y: 32, size: 7, fill: "brand", content: "Студент, читающий книгу,", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 46, size: 6, fill: "danger", content: "pospuesto → con comas", anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 7, fill: "accentLight", content: "Читающий книгу студент", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6, fill: "danger", content: "antepuesto → sin comas", anchor: "middle" },
  ],

  // который (hablado, cotidiano) vs. participio (escrito, formal/literario) — mismo contenido gramatical.
  kotoryVsParticipleRegisterCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 7, fill: "inkSoft", content: "который", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 5.5, fill: "danger", content: "hablado, cotidiano", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 7, fill: "white", content: "читающий", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 5.5, fill: "accentLight", content: "escrito, formal", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "misma información, distinto registro", anchor: "middle" },
  ],

  // настоящий/будущий/следующий/учащийся/служащий — participios lexicalizados como palabras independientes.
  lexicalizedParticiplesGroup: [
    { kind: "rect", x: 4, y: 8, w: 48, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 28, y: 22, size: 5.5, fill: "white", content: "настоящий", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 48, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 22, size: 5.5, fill: "white", content: "следующий", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 48, h: 22, rx: 6, fill: "accent" },
    { kind: "text", x: 132, y: 22, size: 5.5, fill: "white", content: "будущий", bold: true, anchor: "middle" },
    { kind: "rect", x: 30, y: 36, w: 48, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 54, y: 50, size: 5.5, fill: "white", content: "учащийся", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 36, w: 48, h: 22, rx: 6, fill: "ink" },
    { kind: "text", x: 106, y: 50, size: 5.5, fill: "white", content: "служащий", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 6.5, fill: "inkSoft", content: "ya no significan literalmente 'el que hace X'", anchor: "middle" },
  ],

  // "amante/viviente" (ES, lexicalizados, no productivos) vs. el sistema productivo de participios del ruso.
  spanishNoProductiveParticipleCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6, fill: "inkSoft", content: "amante, viviente", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "inkSoft", content: "(pocos, fijos)", anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "no productivo (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6, fill: "white", content: "-ющий/-ящий", anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "-вший/-ший", anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "productivo, cualquier verbo (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "el español usa cláusulas relativas en su lugar", anchor: "middle" },
  ],

  // читаем/любим → читаемый/любимый — pasivo de presente, mucho menos productivo que el activo.
  passivePresentParticipleFormation: [
    { kind: "rect", x: 4, y: 18, w: 60, h: 28, rx: 7, fill: "muted" },
    { kind: "text", x: 34, y: 36, size: 6.5, fill: "inkSoft", content: "любим", bold: true, anchor: "middle" },
    { kind: "path", d: "M68 32 L94 32 L87 26 M94 32 L87 38", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "rect", x: 98, y: 18, w: 58, h: 28, rx: 7, fill: "brand" },
    { kind: "text", x: 127, y: 36, size: 6.5, fill: "white", content: "любимый", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "danger", content: "grupo reducido de verbos frecuentes", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "mucho menos productivo que el activo", anchor: "middle" },
  ],

  // написать→написанный / купить→купленный / открыть→открытый — tres patrones del pasivo pasado.
  passivePastParticipleFormationTable: [
    { kind: "rect", x: 4, y: 10, w: 48, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 28, y: 24, size: 5.5, fill: "white", content: "-ать → -анный", bold: true, anchor: "middle" },
    { kind: "text", x: 28, y: 34, size: 5, fill: "accentLight", content: "написанный", anchor: "middle" },
    { kind: "rect", x: 56, y: 10, w: 48, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 80, y: 24, size: 5.5, fill: "white", content: "-ить → -енный", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 34, size: 5, fill: "white", content: "купленный", anchor: "middle" },
    { kind: "rect", x: 108, y: 10, w: 48, h: 26, rx: 6, fill: "accentLight" },
    { kind: "text", x: 132, y: 24, size: 5.5, fill: "white", content: "-ыть → -тый", bold: true, anchor: "middle" },
    { kind: "text", x: 132, y: 34, size: 5, fill: "white", content: "открытый", anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 6.5, fill: "inkSoft", content: "tres patrones, según el infinitivo", anchor: "middle" },
  ],

  // написанная (larga, declina como adjetivo) vs. написано (corta, invariable en caso, predicativa).
  fullVsShortFormContrast: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "white", content: "написанная", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5.5, fill: "accentLight", content: "larga, atributiva", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "inkSoft", content: "написано", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5.5, fill: "danger", content: "corta, predicativa", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "declina como adjetivo vs. invariable en caso", anchor: "middle" },
  ],

  // закрыт/открыта/решён — forma corta usada para el estado resultante de una acción completada.
  shortFormResultativeStateGroup: [
    { kind: "rect", x: 4, y: 12, w: 48, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 28, y: 28, size: 5.5, fill: "white", content: "закрыт", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 12, w: 48, h: 24, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 28, size: 5.5, fill: "white", content: "открыта", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 12, w: 48, h: 24, rx: 6, fill: "accentLight" },
    { kind: "text", x: 132, y: 28, size: 5.5, fill: "white", content: "решён", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 6.5, fill: "inkSoft", content: "estado resultante — como 'estar + participio' (ES)", anchor: "middle" },
  ],

  // "Автор написал книгу" (activa) → "Книга написана автором" (pasiva, agente en instrumental).
  passiveInstrumentalAgentConstruction: [
    { kind: "text", x: 80, y: 28, size: 6.5, fill: "inkSoft", content: "Автор написал книгу", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 42, size: 5.5, fill: "danger", content: "activa", anchor: "middle" },
    { kind: "path", d: "M50 56 L110 56 L103 50 M110 56 L103 62", stroke: "brand", strokeWidth: 2, round: true },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "brand", content: "Книга написана автором", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 5.5, fill: "accentLight", content: "pasiva — agente en instrumental, sin preposición", anchor: "middle" },
  ],

  // "читающий студент" (activo) vs. "читаемая книга" (pasivo) — quién hace vs. quién recibe.
  activeVsPassiveParticipleChoice: [
    { kind: "circle", cx: 45, cy: 50, r: 26, fill: "brand" },
    { kind: "text", x: 45, y: 47, size: 6, fill: "white", content: "читающий", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 60, size: 5.5, fill: "accentLight", content: "hace la acción", anchor: "middle" },
    { kind: "circle", cx: 115, cy: 50, r: 26, fill: "muted" },
    { kind: "text", x: 115, y: 47, size: 6, fill: "inkSoft", content: "читаемая", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 60, size: 5.5, fill: "danger", content: "recibe la acción", anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 6.5, fill: "inkSoft", content: "b1-19 (activo) + b1-20 (pasivo)", anchor: "middle" },
  ],

  // "любимый" ya no exige agente explícito — funciona como adjetivo fijo, igual que "известный".
  lyubimyLexicalizedGroup: [
    { kind: "rect", x: 20, y: 20, w: 120, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 40, size: 8, fill: "white", content: "любимый", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 7, fill: "inkSoft", content: "favorito — sin agente explícito", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "danger", content: "adjetivo fijo, igual que 'известный'", anchor: "middle" },
  ],

  // Español: "ser escrito" (acción) vs. "estar escrito" (estado) — dos cópulas frente a un participio ruso.
  spanishEstarSerParticipleCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6, fill: "inkSoft", content: "ser escrito", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "inkSoft", content: "estar escrito", anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "dos cópulas (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6, fill: "white", content: "написана", anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "написано", anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "un participio, forma larga/corta (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "matices parecidos, sistemas distintos", anchor: "middle" },
  ],

  // читать → читая: tema de presente + -я (-а tras ж/ш/ч/щ) — forma invariable, adverbial.
  gerundImperfectiveFormationRule: [
    { kind: "rect", x: 4, y: 18, w: 60, h: 28, rx: 7, fill: "muted" },
    { kind: "text", x: 34, y: 36, size: 6.5, fill: "inkSoft", content: "читать", bold: true, anchor: "middle" },
    { kind: "path", d: "M68 32 L94 32 L87 26 M94 32 L87 38", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "rect", x: 98, y: 18, w: 58, h: 28, rx: 7, fill: "brand" },
    { kind: "text", x: 127, y: 36, size: 6.5, fill: "white", content: "читая", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "danger", content: "tema de presente + -я / -а", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "forma invariable, adverbial", anchor: "middle" },
  ],

  // улыбаться → улыбаясь (siempre -ясь); смеяться → смеясь (excepción, la я ya está en la raíz).
  gerundReflexiveEndingRule: [
    { kind: "rect", x: 4, y: 12, w: 68, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 28, size: 6, fill: "white", content: "улыбаться → улыбаясь", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 42, w: 68, h: 24, rx: 6, fill: "accentLight" },
    { kind: "text", x: 38, y: 58, size: 6, fill: "white", content: "смеяться → смеясь", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 30, size: 6.5, fill: "danger", content: "siempre -ясь", anchor: "middle" },
    { kind: "text", x: 118, y: 50, size: 5.5, fill: "inkSoft", content: "(смеясь: excepción,", anchor: "middle" },
    { kind: "text", x: 118, y: 62, size: 5.5, fill: "inkSoft", content: "la я ya está en la raíz)", anchor: "middle" },
  ],

  // быть/мочь/петь — verbos sin gerundio imperfectivo de uso natural, se evitan en la práctica.
  gerundDefectiveVerbsGroup: [
    { kind: "rect", x: 4, y: 8, w: 45, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 26, y: 24, size: 6, fill: "danger", content: "быть", bold: true, anchor: "middle" },
    { kind: "rect", x: 57, y: 8, w: 45, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 79, y: 24, size: 6, fill: "danger", content: "мочь", bold: true, anchor: "middle" },
    { kind: "rect", x: 110, y: 8, w: 45, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 132, y: 24, size: 6, fill: "danger", content: "петь", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 50, size: 6.5, fill: "inkSoft", content: "sin gerundio de uso natural", anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "inkSoft", content: "se sustituyen por 'когда...'", anchor: "middle" },
  ],

  // La frase con деепричастие se separa con comas sin importar su posición: principio, medio o final.
  gerundCommaAlwaysRule: [
    { kind: "text", x: 80, y: 30, size: 6.5, fill: "brand", content: "Читая книгу, я услышал шум.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 6.5, fill: "brand", content: "Я услышал шум, читая книгу.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 6.5, fill: "danger", content: "siempre con comas, en cualquier posición", anchor: "middle" },
  ],

  // "Читая книгу, я услышал шум" — mismo sujeto (yo leía Y yo oí) en ambas acciones.
  gerundSameSubjectRule: [
    { kind: "circle", cx: 45, cy: 50, r: 22, fill: "brand" },
    { kind: "text", x: 45, y: 47, size: 6, fill: "white", content: "читая", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 60, size: 5.5, fill: "accentLight", content: "(yo)", anchor: "middle" },
    { kind: "path", d: "M70 50 L95 50 L88 44 M95 50 L88 56", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "circle", cx: 118, cy: 50, r: 22, fill: "brand" },
    { kind: "text", x: 118, y: 47, size: 6, fill: "white", content: "услышал", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 60, size: 5.5, fill: "accentLight", content: "(yo)", anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 6.5, fill: "inkSoft", content: "el mismo sujeto en las dos acciones", anchor: "middle" },
  ],

  // "Подъезжая к станции, у меня слетела шляпа" — chiste de Chéjov, sujetos distintos, incorrecto.
  chekhovJokeSameSubjectViolation: [
    { kind: "circle", cx: 45, cy: 46, r: 20, fill: "muted" },
    { kind: "text", x: 45, y: 43, size: 5.5, fill: "inkSoft", content: "подъезжая", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 55, size: 5, fill: "danger", content: "(yo)", anchor: "middle" },
    { kind: "text", x: 90, y: 46, size: 9, fill: "danger", content: "≠", bold: true, anchor: "middle" },
    { kind: "circle", cx: 132, cy: 46, r: 20, fill: "muted" },
    { kind: "text", x: 132, y: 43, size: 5.5, fill: "inkSoft", content: "слетела", bold: true, anchor: "middle" },
    { kind: "text", x: 132, y: 55, size: 5, fill: "danger", content: "(шляпа)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "danger", content: "sujetos distintos — ¡incorrecto!", anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 6, fill: "inkSoft", content: "correcto: 'когда я подъезжал...'", anchor: "middle" },
  ],

  // El деепричастие sustituye una oración con 'когда', igual que el participio sustituye a 'который'.
  gerundVsSubordinateClauseFunction: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "inkSoft", content: "когда я шёл...", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5.5, fill: "danger", content: "oración subordinada", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "white", content: "идя...", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5.5, fill: "accentLight", content: "más compacto, formal", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "misma economía que el participio frente a 'который'", anchor: "middle" },
  ],

  // Español: gerundio ("-ando/-iendo") — paralelo cercano, pero de uso más laxo que el ruso.
  spanishGerundioCloseParallelCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6, fill: "inkSoft", content: "leyendo", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "inkSoft", content: "(uso más laxo)", anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "finalidad/consecuencia (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6, fill: "white", content: "читая", anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "(uso estricto)", anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "solo simultaneidad, mismo sujeto (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "un paralelo cercano, con matices", anchor: "middle" },
  ],

  // прочитать → прочитав: tema de pasado + -в; reflexivos: вернуться → вернувшись (-вшись).
  gerundPerfectiveFormationRule: [
    { kind: "rect", x: 4, y: 18, w: 60, h: 28, rx: 7, fill: "muted" },
    { kind: "text", x: 34, y: 36, size: 6.5, fill: "inkSoft", content: "прочитать", bold: true, anchor: "middle" },
    { kind: "path", d: "M68 32 L94 32 L87 26 M94 32 L87 38", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "rect", x: 98, y: 18, w: 58, h: 28, rx: 7, fill: "brand" },
    { kind: "text", x: 127, y: 36, size: 6.5, fill: "white", content: "прочитав", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "danger", content: "tema de pasado + -в", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "reflexivos: -вшись (вернувшись)", anchor: "middle" },
  ],

  // прочитав (estándar, escrito) vs. прочитавши (coloquial/regional, se evita en registro formal).
  gerundPerfectiveRegisterVariants: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 7, fill: "white", content: "прочитав", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5.5, fill: "accentLight", content: "estándar, escrito", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "inkSoft", content: "прочитавши", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5.5, fill: "danger", content: "coloquial, evitar", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "en reflexivos, -вшись es la única forma", anchor: "middle" },
  ],

  // прийти→придя, войти→войдя, дойти→дойдя — verbos en -йти usan -я, no -в (excepción fonética).
  gerundItiExceptionRule: [
    { kind: "rect", x: 4, y: 8, w: 48, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 28, y: 24, size: 5.5, fill: "white", content: "прийти → придя", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 48, h: 24, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 24, size: 5.5, fill: "white", content: "войти → войдя", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 48, h: 24, rx: 6, fill: "accentLight" },
    { kind: "text", x: 132, y: 24, size: 5.5, fill: "white", content: "дойти → дойдя", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 6.5, fill: "danger", content: "terminación -я, igual que el imperfectivo", anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 6.5, fill: "inkSoft", content: "pero el significado es de acción completada", anchor: "middle" },
  ],

  // "Встав, умывшись и позавтракав..." — cadena de gerundios perfectivos, mismo sujeto, secuencia.
  gerundSequentialChainExample: [
    { kind: "circle", cx: 24, cy: 60, r: 12, fill: "brand" },
    { kind: "text", x: 24, y: 63, size: 5.5, fill: "white", content: "1", bold: true, anchor: "middle" },
    { kind: "path", d: "M36 60 L64 60 L57 54 M64 60 L57 66", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "circle", cx: 80, cy: 60, r: 12, fill: "accent" },
    { kind: "text", x: 80, y: 63, size: 5.5, fill: "white", content: "2", bold: true, anchor: "middle" },
    { kind: "path", d: "M92 60 L120 60 L113 54 M120 60 L113 66", stroke: "inkSoft", strokeWidth: 2, round: true },
    { kind: "circle", cx: 136, cy: 60, r: 12, fill: "accentLight" },
    { kind: "text", x: 136, y: 63, size: 5.5, fill: "white", content: "3", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 6.5, fill: "inkSoft", content: "встав → умывшись → позавтракав", anchor: "middle" },
  ],

  // Mismo sujeto (b1-21) y comas siempre, sin importar la posición — regla compartida con el imperfectivo.
  gerundSameSubjectCommaBridge: [
    { kind: "text", x: 80, y: 30, size: 6.5, fill: "brand", content: "Прочитав книгу, он ушёл.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 6.5, fill: "brand", content: "Он ушёл, прочитав книгу.", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 6.5, fill: "danger", content: "mismo sujeto + comas siempre (repaso b1-21)", anchor: "middle" },
  ],

  // "прочитанный" (participio, adjetivo) vs. "прочитав" (gerundio, adverbio) — misma raíz, funciones distintas.
  participleVsGerundDisambiguation: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "inkSoft", content: "прочитанный", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5.5, fill: "danger", content: "adjetivo, concuerda", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "white", content: "прочитав", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5.5, fill: "accentLight", content: "adverbio, invariable", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "misma raíz, funciones gramaticales distintas", anchor: "middle" },
  ],

  // "читая" (b1-21, simultáneo) vs. "прочитав" (b1-22, anterior) — el aspecto marca la diferencia.
  imperfectiveVsPerfectiveGerundContrast: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 7, fill: "inkSoft", content: "читая", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5.5, fill: "danger", content: "simultáneo (b1-21)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 7, fill: "white", content: "прочитав", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5.5, fill: "accentLight", content: "anterior (b1-22)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "el aspecto del verbo marca la diferencia", anchor: "middle" },
  ],

  // Español: "habiendo leído" (gerundio compuesto, pesado, poco frecuente) vs. el productivo -в ruso.
  spanishCompoundGerundCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6, fill: "inkSoft", content: "habiendo leído", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "inkSoft", content: "(dos palabras)", anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "pesado, poco frecuente (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6, fill: "white", content: "прочитав", anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "(una palabra)", anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "compacto, muy productivo (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "recurso preferido en la narración escrita", anchor: "middle" },
  ],

  // "Я работаю" (presente en la cita) → "что она работает" (presente conservado) — sin consecutio temporum.
  indirectSpeechNoTenseBackshift: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "inkSoft", content: "trabaja → trabajaba", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5.5, fill: "danger", content: "cambia de tiempo (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "white", content: "работает → работает", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5.5, fill: "accentLight", content: "sin cambio (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "el tiempo se ancla al momento descrito", anchor: "middle" },
  ],

  // "Я устал" (я) → "что он устал" (он) — cambio de pronombres según la perspectiva del nuevo hablante.
  indirectSpeechPronounShiftTable: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 24, size: 5.5, fill: "white", content: "я → он / она", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 10, w: 68, h: 22, rx: 6, fill: "brandLight" },
    { kind: "text", x: 114, y: 24, size: 5.5, fill: "white", content: "мой → его / её", bold: true, anchor: "middle" },
    { kind: "rect", x: 42, y: 36, w: 68, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 76, y: 50, size: 5.5, fill: "white", content: "здесь → там", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 72, size: 6.5, fill: "inkSoft", content: "igual que en español, según quién cuenta", anchor: "middle" },
  ],

  // сегодня→в тот день, завтра→на следующий день, вчера→накануне — adverbios deícticos.
  indirectSpeechDeicticAdverbShiftTable: [
    { kind: "rect", x: 4, y: 8, w: 48, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 28, y: 22, size: 5, fill: "white", content: "сегодня", bold: true, anchor: "middle" },
    { kind: "text", x: 28, y: 31, size: 4.5, fill: "accentLight", content: "→ в тот день", anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 48, h: 26, rx: 6, fill: "brandLight" },
    { kind: "text", x: 80, y: 22, size: 5, fill: "white", content: "завтра", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 31, size: 4.5, fill: "accentLight", content: "→ на след. день", anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 48, h: 26, rx: 6, fill: "accentLight" },
    { kind: "text", x: 132, y: 22, size: 5, fill: "white", content: "вчера", bold: true, anchor: "middle" },
    { kind: "text", x: 132, y: 31, size: 4.5, fill: "white", content: "→ накануне", anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 6.5, fill: "inkSoft", content: "cuando el momento de contarlo es distinto", anchor: "middle" },
  ],

  // "Dijo que..." (ES, sin coma) vs. "Он сказал, что..." (RU, coma siempre) — contraste de puntuación.
  indirectSpeechCommaContrastES: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 44, size: 6.5, fill: "inkSoft", content: "Dijo que...", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 5.5, fill: "danger", content: "sin coma (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 44, size: 6.5, fill: "white", content: "Сказал, что...", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 5.5, fill: "accentLight", content: "coma siempre (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "error frecuente de hispanohablantes", anchor: "middle" },
  ],

  // сказать (neutro) — сообщить/утверждать (formal) — объяснить (explicativo) — думать (opinión).
  indirectSpeechReportingVerbsRegisterGroup: [
    { kind: "rect", x: 4, y: 8, w: 68, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 38, y: 22, size: 5.5, fill: "inkSoft", content: "сказать (neutro)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 70, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 115, y: 22, size: 5.5, fill: "white", content: "сообщить (formal)", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 34, w: 68, h: 22, rx: 6, fill: "accent" },
    { kind: "text", x: 38, y: 48, size: 5.5, fill: "white", content: "объяснить", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 70, h: 22, rx: 6, fill: "accentLight" },
    { kind: "text", x: 115, y: 48, size: 5.5, fill: "white", content: "думать", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "inkSoft", content: "todos + que + oración completa", anchor: "middle" },
  ],

  // что (hechos) vs. чтобы (deseos/órdenes, b1-24) — vista previa transparente del siguiente mecanismo.
  chtoByVsChtoPreviewBridge: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 7, fill: "white", content: "что", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5.5, fill: "accentLight", content: "hechos (hoy)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 7, fill: "inkSoft", content: "чтобы", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5.5, fill: "danger", content: "deseos (b1-24)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "dos mecanismos gramaticales distintos", anchor: "middle" },
  ],

  // Vista previa de las preguntas indirectas (b1-25): palabras interrogativas o "ли".
  indirectQuestionsPreviewBridge: [
    { kind: "circle", cx: 80, cy: 46, r: 28, fill: "muted" },
    { kind: "text", x: 80, y: 43, size: 7, fill: "inkSoft", content: "как / где", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 6.5, fill: "danger", content: "когда / ли?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 6.5, fill: "inkSoft", content: "un tercer mecanismo — tema de b1-25", anchor: "middle" },
  ],

  // Español: "que" universal (afirmación/deseo/pregunta) vs. el sistema ruso dividido en tres.
  spanishUniversalQueVsRussianSplitCompare: [
    { kind: "rect", x: 10, y: 16, w: 62, h: 58, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 8, fill: "inkSoft", content: "que", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 5.5, fill: "danger", content: "sirve para casi todo (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 16, w: 62, h: 58, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 34, size: 6, fill: "white", content: "что", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 46, size: 6, fill: "white", content: "чтобы", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 6, fill: "white", content: "как/где/ли", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "tres construcciones distintas (RU)", anchor: "middle" },
  ],

  // "Он сказал, чтобы я пришёл" — el pasado tras чтобы es irrealis (deseo), no tiempo real.
  chtobyPastTenseIrrealisRule: [
    { kind: "rect", x: 20, y: 18, w: 120, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 38, size: 8, fill: "white", content: "чтобы + пришёл", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 64, size: 6.5, fill: "danger", content: "no es tiempo real", anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "marca de deseo/irrealidad (irrealis)", anchor: "middle" },
  ],

  // "Я хочу пойти" (mismo sujeto, infinitivo) vs. "Я хочу, чтобы ты пошёл" (sujeto distinto, pasado).
  chtobySameSubjectInfinitiveException: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "white", content: "хочу пойти", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5.5, fill: "accentLight", content: "mismo sujeto, infinitivo", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "inkSoft", content: "чтобы ты пошёл", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5.5, fill: "danger", content: "sujeto distinto, pasado", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "la clave: ¿coincide el sujeto?", anchor: "middle" },
  ],

  // хотеть/просить (neutros) — приказывать/требовать/настаивать/запрещать (registro fuerte) + чтобы.
  chtobyGoverningVerbsRegisterGroup: [
    { kind: "rect", x: 4, y: 8, w: 68, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 38, y: 22, size: 5.5, fill: "inkSoft", content: "хотеть / просить", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 70, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 115, y: 22, size: 5.5, fill: "inkSoft", content: "советовать", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 34, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 48, size: 5.5, fill: "white", content: "требовать", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 70, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 115, y: 48, size: 5.5, fill: "white", content: "настаивать", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "inkSoft", content: "todos + чтобы, distinto grado de firmeza", anchor: "middle" },
  ],

  // "чтобы я не опаздывал" — la negación va justo antes del verbo en pasado.
  chtobyNegationPlacement: [
    { kind: "text", x: 40, y: 50, size: 7, fill: "inkSoft", content: "чтобы", bold: true, anchor: "middle" },
    { kind: "rect", x: 74, y: 36, w: 26, h: 26, rx: 6, fill: "danger" },
    { kind: "text", x: 87, y: 53, size: 7, fill: "white", content: "не", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 50, size: 7, fill: "brand", content: "опаздывал", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "не se coloca justo antes del verbo", anchor: "middle" },
  ],

  // "que vengas" (subjuntivo, ES) vs. "чтобы ты пришёл" (RU) — un paralelo directo entre modos.
  spanishSubjunctiveChtobyParallelCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 50, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6, fill: "inkSoft", content: "que vengas", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 6, fill: "inkSoft", content: "(subjuntivo)", anchor: "middle" },
    { kind: "text", x: 41, y: 68, size: 5.5, fill: "danger", content: "cambio de modo (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 50, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6, fill: "white", content: "чтобы пришёл", anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 6, fill: "white", content: "(irrealis)", anchor: "middle" },
    { kind: "text", x: 119, y: 68, size: 5.5, fill: "accentLight", content: "чтобы + pasado (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "un paralelo genuino entre los dos idiomas", anchor: "middle" },
  ],

  // что (hechos, indicativo) vs. чтобы (deseos, pasado/infinitivo) — tabla de contraste b1-23 + b1-24.
  chtoVsChtobyDirectContrastTable: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 24, size: 5.5, fill: "white", content: "что (b1-23)", bold: true, anchor: "middle" },
    { kind: "text", x: 38, y: 33, size: 4.5, fill: "accentLight", content: "hechos, sin cambio", anchor: "middle" },
    { kind: "rect", x: 80, y: 10, w: 70, h: 26, rx: 6, fill: "accentLight" },
    { kind: "text", x: 115, y: 24, size: 5.5, fill: "white", content: "чтобы (hoy)", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 33, size: 4.5, fill: "white", content: "deseos, pasado/inf.", anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 6.5, fill: "inkSoft", content: "dos mecanismos, un mismo sistema", anchor: "middle" },
  ],

  // El mismo requisito de "mismo sujeto" que en los gerundios (b1-21) se aplica a чтобы + infinitivo.
  gerundSameSubjectBridgeReview: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "inkSoft", content: "деепричастие", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5.5, fill: "danger", content: "mismo sujeto (b1-21)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "white", content: "чтобы + inf.", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5.5, fill: "accentLight", content: "mismo sujeto (hoy)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "la misma lógica gramatical, dos temas distintos", anchor: "middle" },
  ],

  // Vista previa de b1-25: preguntas indirectas con palabras interrogativas o "ли".
  indirectQuestionsPreviewBridgeReprise: [
    { kind: "circle", cx: 80, cy: 46, r: 28, fill: "muted" },
    { kind: "text", x: 80, y: 43, size: 7, fill: "inkSoft", content: "как / где", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 6.5, fill: "danger", content: "когда / ли?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 6.5, fill: "inkSoft", content: "el tercer mecanismo — tema de b1-25", anchor: "middle" },
  ],

  // "Он спросил, где я живу" — где se conserva tal cual, sin что ni чтобы.
  indirectQuestionsWordKeptRule: [
    { kind: "text", x: 34, y: 50, size: 7, fill: "inkSoft", content: "спросил,", bold: true, anchor: "middle" },
    { kind: "rect", x: 66, y: 36, w: 34, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 83, y: 53, size: 7, fill: "white", content: "где", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 50, size: 6.5, fill: "inkSoft", content: "я живу", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "danger", content: "sin что, sin чтобы", anchor: "middle" },
  ],

  // Mismo tiempo verbal, orden de afirmación (no de pregunta directa).
  indirectQuestionsNoTenseBackshiftWordOrder: [
    { kind: "rect", x: 10, y: 18, w: 62, h: 40, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 36, size: 6, fill: "inkSoft", content: "«Когда...?»", anchor: "middle" },
    { kind: "text", x: 41, y: 50, size: 5.5, fill: "danger", content: "pregunta directa", anchor: "middle" },
    { kind: "rect", x: 88, y: 18, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 36, size: 6, fill: "white", content: "..., когда...", anchor: "middle" },
    { kind: "text", x: 119, y: 50, size: 5.5, fill: "accentLight", content: "mismo tiempo, sin inversión", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 6.5, fill: "inkSoft", content: "igual regla de tiempo que что (b1-23)", anchor: "middle" },
  ],

  // ли: partícula de segunda posición, tras la palabra foco.
  liParticlePlacementRule: [
    { kind: "text", x: 30, y: 50, size: 7, fill: "inkSoft", content: "приду", bold: true, anchor: "middle" },
    { kind: "rect", x: 54, y: 36, w: 24, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 66, y: 53, size: 7, fill: "white", content: "ли", bold: true, anchor: "middle" },
    { kind: "text", x: 100, y: 50, size: 6.5, fill: "inkSoft", content: "я", bold: true, anchor: "middle" },
    { kind: "path", d: "M50 62 L50 70 L70 70 L70 62", stroke: "danger", strokeWidth: 1.5 },
    { kind: "text", x: 60, y: 82, size: 6, fill: "danger", content: "justo tras la palabra foco", anchor: "middle" },
  ],

  // "приду ли я" (foco: ¿vendré?) vs. "я ли приду" (foco: ¿seré yo?).
  liFocusShiftContrastGroup: [
    { kind: "rect", x: 10, y: 16, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 34, size: 6, fill: "white", content: "приду ли я", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 48, size: 5.5, fill: "accentLight", content: "¿vendré?", anchor: "middle" },
    { kind: "rect", x: 88, y: 16, w: 62, h: 40, rx: 10, fill: "accent" },
    { kind: "text", x: 119, y: 34, size: 6, fill: "white", content: "я ли приду", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 48, size: 5.5, fill: "white", content: "¿seré yo?", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 6.5, fill: "inkSoft", content: "el foco cambia el significado", anchor: "middle" },
  ],

  // Español: "si" siempre al inicio, invariable frente al ли móvil del ruso.
  spanishSiInvariantPositionCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 46, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 7, fill: "inkSoft", content: "si vendría", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 5.5, fill: "danger", content: "'si' fijo al inicio (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 7, fill: "white", content: "...ли...", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 5.5, fill: "accentLight", content: "móvil, según el foco (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "el español no tiene esta flexibilidad", anchor: "middle" },
  ],

  // спросить (neutro) — поинтересоваться (cortés) — узнать/выяснить — гадать (literario).
  questionReportingVerbsRegisterLadder: [
    { kind: "rect", x: 4, y: 8, w: 68, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 38, y: 21, size: 5.5, fill: "inkSoft", content: "спросить", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 70, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 115, y: 21, size: 5.5, fill: "inkSoft", content: "поинтересоваться", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 32, w: 68, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 45, size: 5.5, fill: "white", content: "узнать / выяснить", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 32, w: 70, h: 20, rx: 6, fill: "accent" },
    { kind: "text", x: 115, y: 45, size: 5.5, fill: "white", content: "гадать", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 6.5, fill: "inkSoft", content: "neutro → cortés → indagador → literario", anchor: "middle" },
  ],

  // La pregunta indirecta termina en punto, no en "?" — es una afirmación sobre una pregunta.
  indirectQuestionPeriodNotQuestionMarkRule: [
    { kind: "circle", cx: 55, cy: 46, r: 22, fill: "danger" },
    { kind: "text", x: 55, y: 55, size: 20, fill: "white", content: "?", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 46 L100 46", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "circle", cx: 122, cy: 46, r: 22, fill: "brand" },
    { kind: "text", x: 122, y: 54, size: 16, fill: "white", content: ".", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 86, size: 6.5, fill: "inkSoft", content: "afirmación sobre una pregunta", anchor: "middle" },
  ],

  // Síntesis final: что / чтобы / palabra interrogativa + ли — árbol de decisión.
  indirectSpeechThreeWayDecisionTree: [
    { kind: "circle", cx: 80, cy: 18, r: 12, fill: "inkSoft" },
    { kind: "text", x: 80, y: 21, size: 6, fill: "white", content: "¿pregunta?", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 42, w: 46, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 29, y: 57, size: 5.5, fill: "inkSoft", content: "no → что/чтобы", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 42, w: 46, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 81, y: 57, size: 5.5, fill: "white", content: "sí, palabra", bold: true, anchor: "middle" },
    { kind: "rect", x: 110, y: 42, w: 46, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 133, y: 57, size: 5.5, fill: "white", content: "sí, sin palabra", bold: true, anchor: "middle" },
    { kind: "text", x: 81, y: 78, size: 5.5, fill: "inkSoft", content: "se conserva la palabra", anchor: "middle" },
    { kind: "text", x: 133, y: 78, size: 5.5, fill: "inkSoft", content: "ли tras el foco", anchor: "middle" },
    { kind: "text", x: 80, y: 100, size: 6.5, fill: "inkSoft", content: "b1-23 + b1-24 + b1-25, un mismo sistema", anchor: "middle" },
  ],

  // Dos ejes independientes: género/número del antecedente, caso de la función en la subordinada.
  kotoryGenderNumberFromAntecedentCaseFromRoleRule: [
    { kind: "text", x: 30, y: 30, size: 6.5, fill: "inkSoft", content: "книга", bold: true, anchor: "middle" },
    { kind: "path", d: "M30 38 L30 50", stroke: "brand", strokeWidth: 1.5 },
    { kind: "text", x: 30, y: 62, size: 5.5, fill: "brand", content: "género/número", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 36, rx: 8, fill: "brand" },
    { kind: "text", x: 119, y: 38, size: 6.5, fill: "white", content: "которую", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 52, size: 5, fill: "accentLight", content: "caso: rol en la subordinada", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "dos ejes totalmente independientes", anchor: "middle" },
  ],

  // Tabla de declinación completa de который en los seis casos.
  kotoryFullDeclensionTable: [
    { kind: "rect", x: 4, y: 8, w: 46, h: 16, rx: 4, fill: "muted" },
    { kind: "text", x: 27, y: 19, size: 5, fill: "inkSoft", content: "nom. который", anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 46, h: 16, rx: 4, fill: "muted" },
    { kind: "text", x: 79, y: 19, size: 5, fill: "inkSoft", content: "gen. которого", anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 46, h: 16, rx: 4, fill: "muted" },
    { kind: "text", x: 131, y: 19, size: 5, fill: "inkSoft", content: "dat. которому", anchor: "middle" },
    { kind: "rect", x: 4, y: 30, w: 46, h: 16, rx: 4, fill: "brand" },
    { kind: "text", x: 27, y: 41, size: 5, fill: "white", content: "acc. который/-ого", anchor: "middle" },
    { kind: "rect", x: 56, y: 30, w: 46, h: 16, rx: 4, fill: "brand" },
    { kind: "text", x: 79, y: 41, size: 5, fill: "white", content: "instr. которым", anchor: "middle" },
    { kind: "rect", x: 108, y: 30, w: 46, h: 16, rx: 4, fill: "brand" },
    { kind: "text", x: 131, y: 41, size: 5, fill: "white", content: "prep. котором", anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 6.5, fill: "inkSoft", content: "se declina como un adjetivo en -ый", anchor: "middle" },
  ],

  // Acusativo animado: который → которого (misma regla que sustantivos animados).
  kotoryAnimateAccusativeRule: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 40, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 38, size: 6.5, fill: "inkSoft", content: "который", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 52, size: 5.5, fill: "danger", content: "inanimado (acc. = nom.)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 38, size: 6.5, fill: "white", content: "которого", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 52, size: 5.5, fill: "accentLight", content: "animado (acc. = gen.)", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 6.5, fill: "inkSoft", content: "misma regla que sustantivos/adjetivos animados", anchor: "middle" },
  ],

  // Preposiciones que se pegan a который e imponen su caso.
  kotoryPrepositionAttachmentGrid: [
    { kind: "rect", x: 4, y: 8, w: 46, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 27, y: 21, size: 5.5, fill: "inkSoft", content: "в котором", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 46, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 79, y: 21, size: 5.5, fill: "inkSoft", content: "с которым", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 46, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 131, y: 21, size: 5.5, fill: "inkSoft", content: "о которой", bold: true, anchor: "middle" },
    { kind: "rect", x: 30, y: 34, w: 46, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 53, y: 47, size: 5.5, fill: "white", content: "для которого", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 34, w: 46, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 105, y: 47, size: 5.5, fill: "white", content: "без которого", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "inkSoft", content: "la preposición decide el caso", anchor: "middle" },
  ],

  // чей (concuerda con lo poseído) vs. который en genitivo (más formal/escrito).
  cheyVsKotoryGenitivePossessiveCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 46, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 7, fill: "inkSoft", content: "чья машина", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 5, fill: "danger", content: "concuerda con lo poseído", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 38, size: 6, fill: "white", content: "произведения", anchor: "middle" },
    { kind: "text", x: 119, y: 50, size: 6, fill: "white", content: "которого", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 62, size: 5, fill: "accentLight", content: "genitivo, más formal", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "dos formas de decir 'cuyo/a'", anchor: "middle" },
  ],

  // El ruso pone comas siempre con который; el español distingue restrictiva/no restrictiva.
  kotoryCommaMandatoryVsSpanishRestrictiveCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 46, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6, fill: "inkSoft", content: "el libro que leo", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 5, fill: "danger", content: "sin comas (restrictiva, ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6, fill: "white", content: ", которую ,", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 5, fill: "accentLight", content: "comas siempre (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "el ruso no distingue restrictiva/no restrictiva", anchor: "middle" },
  ],

  // El participio solo sustituye a который-sujeto (nominativo); en los demás casos, который es la única opción.
  kotoryVsParticipleSubjectOnlyRegisterBridge: [
    { kind: "circle", cx: 45, cy: 46, r: 26, fill: "brand" },
    { kind: "text", x: 45, y: 42, size: 6, fill: "white", content: "который", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 55, size: 5, fill: "accentLight", content: "= sujeto", anchor: "middle" },
    { kind: "path", d: "M74 46 L96 46", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "circle", cx: 122, cy: 46, r: 26, fill: "muted" },
    { kind: "text", x: 122, y: 42, size: 6, fill: "inkSoft", content: "participio", bold: true, anchor: "middle" },
    { kind: "text", x: 122, y: 55, size: 5, fill: "danger", content: "(b1-19/20)", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 6.5, fill: "inkSoft", content: "solo posible cuando который es nominativo", anchor: "middle" },
  ],

  // Pregunta de autochequeo: ¿qué papel cumple который en SU propia oración?
  kotoryCaseSelfTestPrompt: [
    { kind: "circle", cx: 80, cy: 40, r: 24, fill: "accent" },
    { kind: "text", x: 80, y: 37, size: 7, fill: "white", content: "который", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 49, size: 6, fill: "white", content: "¿qué papel?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "el papel en su propia oración decide el caso", anchor: "middle" },
  ],

  // El registro formal с вы domina toda la entrevista de trabajo.
  formalVyRegisterInterviewReview: [
    { kind: "rect", x: 20, y: 18, w: 120, h: 30, rx: 10, fill: "brand" },
    { kind: "text", x: 80, y: 38, size: 7.5, fill: "white", content: "Расскажите о себе", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 6.5, fill: "danger", content: "registro formal con вы", anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "obligatorio en toda entrevista", anchor: "middle" },
  ],

  // владеть (instrumental, formal/CV) vs. знать (neutro/cotidiano, a1-7).
  vladetVsZnatLanguageMasteryRegisterCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "white", content: "владею языком", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "accentLight", content: "formal, CV/entrevista", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "inkSoft", content: "знаю язык", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "danger", content: "neutro, cotidiano (a1-7)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "владеть rige instrumental", anchor: "middle" },
  ],

  // опыт работы / стаж работы — genitivo tras sustantivos de cantidad.
  genitiveExperienceQualificationConstruction: [
    { kind: "text", x: 34, y: 46, size: 7, fill: "inkSoft", content: "опыт / стаж", bold: true, anchor: "middle" },
    { kind: "rect", x: 74, y: 32, w: 58, h: 28, rx: 8, fill: "brand" },
    { kind: "text", x: 103, y: 51, size: 7, fill: "white", content: "работы", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "работы siempre en genitivo", anchor: "middle" },
  ],

  // Cadena de verbos de contratación: distinto sujeto en cada uno.
  hiringFiringVerbLadderVoiceContrast: [
    { kind: "rect", x: 4, y: 8, w: 68, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 38, y: 21, size: 5, fill: "inkSoft", content: "устроиться (candidato)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 70, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 115, y: 21, size: 5, fill: "inkSoft", content: "уволиться (candidato)", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 32, w: 68, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 45, size: 5, fill: "white", content: "нанять (empresa)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 32, w: 70, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 115, y: 45, size: 5, fill: "white", content: "уволить (empresa)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 6.5, fill: "inkSoft", content: "el sujeto cambia el verbo", anchor: "middle" },
  ],

  // если + futuro, futuro (RU) vs. si + subjuntivo (ES) para condición futura hipotética.
  siConditionalFutureIndicativeVsSpanishSubjunctiveCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 46, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6, fill: "inkSoft", content: "si me contratan", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 5, fill: "danger", content: "subjuntivo (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6, fill: "white", content: "если примут", anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 5, fill: "accentLight", content: "futuro indicativo (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "sin cambio de modo en ruso", anchor: "middle" },
  ],

  // Colocaciones fijas del proceso de solicitud de empleo.
  fixedInterviewCollocationsGrid: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 25, size: 5, fill: "white", content: "подать резюме", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 10, w: 70, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 115, y: 25, size: 5, fill: "white", content: "пройти собеседование", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 40, w: 68, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 38, y: 55, size: 5, fill: "white", content: "рассмотреть кандидатуру", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 40, w: 70, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 115, y: 55, size: 5, fill: "white", content: "получить предложение", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 6.5, fill: "inkSoft", content: "expresiones fijas del proceso", anchor: "middle" },
  ],

  // Banco de preguntas típicas de entrevista.
  interviewQuestionPhraseBank: [
    { kind: "rect", x: 6, y: 10, w: 148, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 80, y: 23, size: 5.5, fill: "inkSoft", content: "Расскажите о себе", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 36, w: 148, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 80, y: 49, size: 5.5, fill: "inkSoft", content: "Какой у вас опыт работы?", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 62, w: 148, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 75, size: 5.5, fill: "white", content: "Почему вы хотите работать у нас?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 6, fill: "inkSoft", content: "preguntas estándar de entrevista", anchor: "middle" },
  ],

  // Repaso: registro informal (b1-4) vs. registro formal de la entrevista (hoy).
  informalVsFormalWorkRegisterBridgeReview: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6, fill: "inkSoft", content: "начальник, отпуск", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "danger", content: "día a día (b1-4)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6, fill: "white", content: "собеседование", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "accentLight", content: "proceso formal (hoy)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "un mismo campo, dos registros", anchor: "middle" },
  ],

  // Repaso rápido: работать/стать/быть + instrumental de profesión, ya visto en a1-26.
  instrumentalProfessionA1BridgeRecap: [
    { kind: "rect", x: 20, y: 20, w: 120, h: 30, rx: 10, fill: "muted" },
    { kind: "text", x: 80, y: 40, size: 7, fill: "inkSoft", content: "работает врачом", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 64, size: 6.5, fill: "danger", content: "instrumental (a1-26)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "hoy: estructuras nuevas sobre esta base", anchor: "middle" },
  ],

  // чем + comparativo, тем + comparativo — proporcionalidad paralela.
  chemTemComparativeConstructionRule: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "white", content: "чем выше", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "accentLight", content: "образование", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "accent" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "white", content: "тем больше", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "white", content: "возможностей", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "estructura paralela nueva", anchor: "middle" },
  ],

  // "cuanto más..., (tanto) más..." (ES) — un paralelo casi exacto con чем/тем (RU).
  chemTemSpanishCuantoMasParallelCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 46, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6, fill: "inkSoft", content: "cuanto más", anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "inkSoft", content: "(tanto) más", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6, fill: "white", content: "чем...", anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 6, fill: "white", content: "тем...", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "estructura casi idéntica", anchor: "middle" },
  ],

  // поступить В + acusativo (institución) vs. НА + acusativo (facultad/programa).
  postupatVNaFacultyPrepositionNuance: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "white", content: "в университет", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "accentLight", content: "institución completa", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "accent" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "white", content: "на факультет", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "white", content: "facultad/programa", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "поступить: dos regímenes distintos", anchor: "middle" },
  ],

  // бакалавриат → магистратура → аспирантура frente al sistema hispanohablante.
  russianDegreeLadderVsSpanishSystemCompare: [
    { kind: "rect", x: 4, y: 10, w: 46, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 27, y: 24, size: 5, fill: "white", content: "бакалавриат", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 10, w: 46, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 79, y: 24, size: 5, fill: "white", content: "магистратура", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 10, w: 46, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 131, y: 24, size: 5, fill: "white", content: "аспирантура", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 50, size: 5.5, fill: "inkSoft", content: "≈ licenciatura / maestría / doctorado", anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 6.5, fill: "danger", content: "aproximaciones, no coinciden exactamente", anchor: "middle" },
  ],

  // доктор наук: un segundo doctorado ruso, superior al кандидат наук, sin equivalente hispanohablante.
  kandidatNaukDoktorNaukTwoTierDoctorateUnique: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6, fill: "white", content: "кандидат наук", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "accentLight", content: "≈ PhD", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "danger" },
    { kind: "text", x: 119, y: 40, size: 6, fill: "white", content: "доктор наук", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "white", content: "sin equivalente", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "un escalón académico extra en ruso", anchor: "middle" },
  ],

  // специализироваться НА + prepositivo.
  specializirovatsyaNaPrepositionalRule: [
    { kind: "text", x: 30, y: 46, size: 6.5, fill: "inkSoft", content: "специализируется", bold: true, anchor: "middle" },
    { kind: "rect", x: 74, y: 32, w: 24, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 86, y: 49, size: 7, fill: "white", content: "на", bold: true, anchor: "middle" },
    { kind: "text", x: 128, y: 46, size: 6.5, fill: "inkSoft", content: "праве", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "на + prepositivo", anchor: "middle" },
  ],

  // продвигаться ПО карьерной лестнице — по + dativo.
  careerAdvancementPoDativePhraseGroup: [
    { kind: "text", x: 30, y: 46, size: 6.5, fill: "inkSoft", content: "продвигаться", bold: true, anchor: "middle" },
    { kind: "rect", x: 68, y: 32, w: 20, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 78, y: 49, size: 7, fill: "white", content: "по", bold: true, anchor: "middle" },
    { kind: "text", x: 128, y: 46, size: 5.5, fill: "inkSoft", content: "лестнице", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "по + dativo", anchor: "middle" },
  ],

  // понравился (reacción puntual, perfectivo) vs. нравится (gusto continuado, imperfectivo, a1-25/a2-10).
  ponravitsyaVsNravitsyaAspectReactionCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "white", content: "понравился", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "accentLight", content: "reacción puntual", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "inkSoft", content: "нравится", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "danger", content: "gusto continuado (a1-25)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "perfectivo vs. imperfectivo", anchor: "middle" },
  ],

  // понравился/понравилась/понравилось/понравились — concuerda con lo que gustó.
  ponravitsyaPastGenderAgreementTable: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 23, size: 5, fill: "white", content: "понравился (фильм)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 10, w: 70, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 115, y: 23, size: 5, fill: "white", content: "понравилась (книга)", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 34, w: 68, h: 20, rx: 6, fill: "accent" },
    { kind: "text", x: 38, y: 47, size: 5, fill: "white", content: "понравилось (кино)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 70, h: 20, rx: 6, fill: "accent" },
    { kind: "text", x: 115, y: 47, size: 5, fill: "white", content: "понравились (актёры)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 6.5, fill: "inkSoft", content: "concuerda con lo que gustó", anchor: "middle" },
  ],

  // произвести/производить впечатление НА + acusativo (registro formal/literario).
  proizvestiVpechatlenieNaAccusativeConstruction: [
    { kind: "text", x: 26, y: 46, size: 6, fill: "inkSoft", content: "произвёл впечатление", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 32, w: 22, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 95, y: 49, size: 7, fill: "white", content: "на", bold: true, anchor: "middle" },
    { kind: "text", x: 132, y: 46, size: 6.5, fill: "inkSoft", content: "меня", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "на + acusativo (no dativo)", anchor: "middle" },
  ],

  // Construcciones fijas para resumir el argumento de una obra.
  plotSummaryImpersonalConstructionsGroup: [
    { kind: "rect", x: 6, y: 10, w: 148, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 80, y: 23, size: 5.5, fill: "inkSoft", content: "Фильм рассказывает о...", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 36, w: 148, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 80, y: 49, size: 5.5, fill: "inkSoft", content: "Действие происходит в...", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 62, w: 148, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 75, size: 5.5, fill: "white", content: "Главный герой — ...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 6, fill: "inkSoft", content: "el kit para resumir el argumento", anchor: "middle" },
  ],

  // основан на... — repaso: forma corta del participio pasivo (b1-19/20).
  osnovanNaShortParticipleBridgeReview: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "inkSoft", content: "основан", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "danger", content: "part. pasivo corto (b1-19/20)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "white", content: "на реальных", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "accentLight", content: "событиях", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "una colocación cultural frecuente", anchor: "middle" },
  ],

  // Comparativo simple (a2-7/a2-21) vs. чем...тем... (proporcionalidad, b1-28).
  simpleComparativeVsChemTemBridgeReview: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6, fill: "white", content: "интереснее, чем", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 5, fill: "accentLight", content: "comparación única", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 46, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 6, fill: "inkSoft", content: "чем..., тем...", anchor: "middle" },
    { kind: "text", x: 119, y: 56, size: 5, fill: "danger", content: "proporcionalidad (b1-28)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "dos estructuras distintas", anchor: "middle" },
  ],

  // снят в жанре триллера — в + prepositivo (жанре) + genitivo (триллера).
  vZhanreGenitiveConstruction: [
    { kind: "text", x: 26, y: 46, size: 6.5, fill: "inkSoft", content: "снят", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 32, w: 46, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 79, y: 49, size: 6, fill: "white", content: "в жанре", bold: true, anchor: "middle" },
    { kind: "text", x: 132, y: 46, size: 6.5, fill: "inkSoft", content: "триллера", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "жанр + genitivo del tipo concreto", anchor: "middle" },
  ],

  // Síntesis: las cinco piezas para reseñar una película o un libro.
  reviewToolkitSynthesisTable: [
    { kind: "rect", x: 4, y: 8, w: 46, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 27, y: 21, size: 5, fill: "white", content: "reacción", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 8, w: 46, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 79, y: 21, size: 5, fill: "white", content: "impresión", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 8, w: 46, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 131, y: 21, size: 5, fill: "white", content: "argumento", bold: true, anchor: "middle" },
    { kind: "rect", x: 30, y: 32, w: 46, h: 20, rx: 6, fill: "accent" },
    { kind: "text", x: 53, y: 45, size: 5, fill: "white", content: "valoración", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 32, w: 46, h: 20, rx: 6, fill: "accent" },
    { kind: "text", x: 105, y: 45, size: 5, fill: "white", content: "recomendación", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 6.5, fill: "inkSoft", content: "las cinco piezas de una reseña", anchor: "middle" },
  ],

  // какой + sustantivo (concuerda) vs. как + adjetivo/adverbio (invariable).
  kakoyVsKakAdjectiveNounExclamativeChoiceRule: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "white", content: "какая картина!", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "accentLight", content: "+ sustantivo, concuerda", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "accent" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "white", content: "как интересно!", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "white", content: "+ adjetivo/adverbio", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "la elección depende de lo que sigue", anchor: "middle" },
  ],

  // какой/какая/какое/какие: concordancia exclamativa completa.
  kakoyGenderAgreementExclamativeTable: [
    { kind: "rect", x: 4, y: 10, w: 46, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 27, y: 23, size: 5, fill: "inkSoft", content: "masc. какой", anchor: "middle" },
    { kind: "rect", x: 56, y: 10, w: 46, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 79, y: 23, size: 5, fill: "inkSoft", content: "fem. какая", anchor: "middle" },
    { kind: "rect", x: 108, y: 10, w: 46, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 131, y: 23, size: 5, fill: "inkSoft", content: "neutro какое", anchor: "middle" },
    { kind: "rect", x: 56, y: 36, w: 46, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 79, y: 49, size: 5, fill: "white", content: "plural какие", anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "inkSoft", content: "igual que el какой interrogativo", anchor: "middle" },
  ],

  // Español "qué" universal vs. la división obligatoria del ruso какой/как.
  spanishQueUniversalVsRussianKakoyKakSplitCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 46, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 8, fill: "inkSoft", content: "¡qué...!", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 5, fill: "danger", content: "sirve para todo (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 36, size: 6, fill: "white", content: "какой / как", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 5, fill: "accentLight", content: "división obligatoria (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "la trampa más frecuente del tema", anchor: "middle" },
  ],

  // невероятно/потрясающе/безумно — intensificadores más fuertes que очень (a1-25).
  intensifierAdverbLadderGroup: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 20, rx: 6, fill: "muted" },
    { kind: "text", x: 38, y: 23, size: 5.5, fill: "inkSoft", content: "очень (a1-25)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 10, w: 70, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 115, y: 23, size: 5.5, fill: "white", content: "невероятно", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 34, w: 68, h: 20, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 47, size: 5.5, fill: "white", content: "потрясающе", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 70, h: 20, rx: 6, fill: "accent" },
    { kind: "text", x: 115, y: 47, size: 5.5, fill: "white", content: "безумно", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 6.5, fill: "inkSoft", content: "intensidad creciente", anchor: "middle" },
  ],

  // Как/Какой..., что... — repaso de b1-23: что introduce el motivo de la exclamación.
  chtoClauseAfterExclamationBridgeReview: [
    { kind: "text", x: 30, y: 46, size: 6.5, fill: "inkSoft", content: "Как здорово,", bold: true, anchor: "middle" },
    { kind: "rect", x: 78, y: 32, w: 24, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 90, y: 49, size: 7, fill: "white", content: "что", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 46, size: 6, fill: "inkSoft", content: "приехал", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "что introduce el motivo (repaso b1-23)", anchor: "middle" },
  ],

  // здорово (neutro/informal) → круто (jerga) → потрясающе (formal/literario).
  colloquialInterjectionRegisterLadder: [
    { kind: "rect", x: 4, y: 10, w: 46, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 27, y: 24, size: 5, fill: "inkSoft", content: "здорово", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 10, w: 46, h: 22, rx: 6, fill: "accent" },
    { kind: "text", x: 79, y: 24, size: 5, fill: "white", content: "круто (jerga)", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 10, w: 46, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 131, y: 24, size: 5, fill: "white", content: "потрясающе", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 50, size: 6, fill: "inkSoft", content: "neutro → coloquial → formal/literario", anchor: "middle" },
  ],

  // жаль: "Как жаль!" (exclamación corta) vs. "Мне жаль, что..." (b1-2, oración completa).
  zhalStandaloneVsB12FullSentenceBridgeReview: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "white", content: "Как жаль!", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "accentLight", content: "exclamación corta (hoy)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 6, fill: "inkSoft", content: "Мне жаль, что...", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "danger", content: "oración completa (b1-2)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "misma palabra, dos formas de usarla", anchor: "middle" },
  ],

  // Síntesis de cierre del nivel B1: comparativos + чем/тем + понравиться/впечатление + exclamaciones.
  b1LevelSynthesisReviewToolkit: [
    { kind: "rect", x: 4, y: 8, w: 68, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 38, y: 22, size: 5, fill: "inkSoft", content: "comparativos", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 70, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 115, y: 22, size: 5, fill: "inkSoft", content: "чем...тем... (b1-28)", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 34, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 48, size: 5, fill: "white", content: "понравиться (b1-29)", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 70, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 115, y: 48, size: 5, fill: "white", content: "exclamaciones (hoy)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "inkSoft", content: "listo para el examen final de B1", anchor: "middle" },
  ],

  // Repaso: "Не могли бы Вы...?" (b1-8) era solo la punta del iceberg del sistema de бы.
  b1CourtesyPreviewBridgeReview: [
    { kind: "rect", x: 20, y: 20, w: 120, h: 30, rx: 10, fill: "muted" },
    { kind: "text", x: 80, y: 40, size: 7, fill: "inkSoft", content: "Не могли бы Вы...?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 64, size: 6.5, fill: "danger", content: "cortesía (b1-8)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "hoy: el sistema completo de бы", anchor: "middle" },
  ],

  // пасado (concuerda género/número) + бы (invariable) — sin conjugación por persona, a diferencia del español.
  byPastTenseGenderOnlyNoPersonConjugation: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "white", content: "сказал бы", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "accentLight", content: "género/número, no persona", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "inkSoft", content: "diría/dirías...", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "danger", content: "conjuga por persona (ES)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "бы nunca cambia de forma", anchor: "middle" },
  ],

  // Cuatro usos de бы: deseo hipotético, consejo suave, cortesía, condición irreal.
  byUsesGroup: [
    { kind: "rect", x: 4, y: 8, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 22, size: 5, fill: "white", content: "deseo hipotético", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 70, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 115, y: 22, size: 5, fill: "white", content: "consejo suave", bold: true, anchor: "middle" },
    { kind: "rect", x: 4, y: 34, w: 68, h: 22, rx: 6, fill: "accent" },
    { kind: "text", x: 38, y: 48, size: 5, fill: "white", content: "cortesía", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 34, w: 70, h: 22, rx: 6, fill: "accent" },
    { kind: "text", x: 115, y: 48, size: 5, fill: "white", content: "condición irreal", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "inkSoft", content: "una misma estructura, cuatro usos", anchor: "middle" },
  ],

  // "Я бы пошёл" vs. "Пошёл бы я" — бы móvil como ли (b1-25), marca el foco.
  byPositionMobilityFocusShift: [
    { kind: "rect", x: 10, y: 16, w: 62, h: 40, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 34, size: 6, fill: "white", content: "Я бы пошёл", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 48, size: 5, fill: "accentLight", content: "foco: ir", anchor: "middle" },
    { kind: "rect", x: 88, y: 16, w: 62, h: 40, rx: 10, fill: "accent" },
    { kind: "text", x: 119, y: 34, size: 6, fill: "white", content: "Пошёл бы я", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 48, size: 5, fill: "white", content: "foco: yo", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 6.5, fill: "inkSoft", content: "бы es móvil, igual que ли (b1-25)", anchor: "middle" },
  ],

  // если бы + pasado, ...бы + pasado — бы SIEMPRE pegado a если.
  esliBiIrrealConditionalStructure: [
    { kind: "text", x: 34, y: 46, size: 6.5, fill: "inkSoft", content: "если бы", bold: true, anchor: "middle" },
    { kind: "rect", x: 66, y: 32, w: 30, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 81, y: 49, size: 6.5, fill: "white", content: "знал", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 46, size: 6, fill: "inkSoft", content: "..., ...бы", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "если бы: bloque fijo, nunca separado", anchor: "middle" },
  ],

  // Español: dos tiempos condicionales distintos vs. ruso: siempre pasado + бы.
  spanishTwoConditionalTensesVsRussianSinglePastCompare: [
    { kind: "rect", x: 10, y: 16, w: 62, h: 48, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 36, size: 5.5, fill: "inkSoft", content: "si tuviera... iría", anchor: "middle" },
    { kind: "text", x: 41, y: 50, size: 5.5, fill: "inkSoft", content: "si hubiera... habría", anchor: "middle" },
    { kind: "text", x: 41, y: 62, size: 5, fill: "danger", content: "dos tiempos (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 16, w: 62, h: 48, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6, fill: "white", content: "если бы + pasado", anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 5, fill: "accentLight", content: "una sola estructura (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 6, fill: "inkSoft", content: "el contexto aclara el matiz", anchor: "middle" },
  ],

  // чтобы + pasado (b1-24) y бы (hoy): el mismo recurso — pasado usado como marca de irrealis.
  chtobyVsByBothPastIrrealisMarkingBridge: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6.5, fill: "inkSoft", content: "чтобы + pasado", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "danger", content: "irrealis (b1-24)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6.5, fill: "white", content: "бы + pasado", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "accentLight", content: "irrealis (hoy)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "el mismo recurso gramatical del ruso", anchor: "middle" },
  ],

  // хотелось бы / лучше бы / не мог ли бы — expresiones fijas construidas sobre pasado + бы.
  fixedByExpressionsGroup: [
    { kind: "rect", x: 4, y: 10, w: 68, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 38, y: 24, size: 5, fill: "white", content: "хотелось бы", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 10, w: 70, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 115, y: 24, size: 5, fill: "white", content: "лучше бы", bold: true, anchor: "middle" },
    { kind: "rect", x: 30, y: 36, w: 100, h: 22, rx: 6, fill: "accent" },
    { kind: "text", x: 80, y: 50, size: 5, fill: "white", content: "не мог ли бы", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 6.5, fill: "inkSoft", content: "todas construidas sobre pasado + бы", anchor: "middle" },
  ],

  // если + presente/futuro, SIN бы — condición real.
  esliRealConditionNoByPresentFutureRule: [
    { kind: "text", x: 30, y: 46, size: 7, fill: "inkSoft", content: "если", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 32, w: 60, h: 28, rx: 8, fill: "brand" },
    { kind: "text", x: 88, y: 50, size: 6.5, fill: "white", content: "позвонишь", bold: true, anchor: "middle" },
    { kind: "rect", x: 126, y: 32, w: 26, h: 28, rx: 8, fill: "danger" },
    { kind: "text", x: 139, y: 50, size: 7, fill: "white", content: "✕бы", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "condición real, sin бы", anchor: "middle" },
  ],

  // если (condición incierta) vs. когда (tiempo, se sabe que ocurrirá).
  esliVsKogdaConditionVsTimeCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 42, size: 7, fill: "white", content: "если", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 5, fill: "accentLight", content: "condición incierta", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 46, rx: 10, fill: "accent" },
    { kind: "text", x: 119, y: 42, size: 7, fill: "white", content: "когда", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 5, fill: "white", content: "tiempo, seguro", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "¿pasará o no? vs. ¿cuándo pasará?", anchor: "middle" },
  ],

  // «то» opcional, marca el inicio de la consecuencia, nunca aparece sin если antes.
  toOptionalConsequenceMarkerRule: [
    { kind: "text", x: 30, y: 46, size: 6.5, fill: "inkSoft", content: "если...,", bold: true, anchor: "middle" },
    { kind: "rect", x: 66, y: 32, w: 26, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 79, y: 49, size: 7, fill: "white", content: "то", bold: true, anchor: "middle" },
    { kind: "text", x: 128, y: 46, size: 6, fill: "inkSoft", content: "мы пойдём", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "opcional; nunca sin если antes", anchor: "middle" },
  ],

  // если + pasado real: un paralelo casi exacto con el español "si" + indicativo pasado.
  esliPastRealConditionSpanishParallelCompare: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 46, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6, fill: "inkSoft", content: "si llegó tarde", anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 5, fill: "inkSoft", content: "se disgustó (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6, fill: "white", content: "если опоздал", anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 5, fill: "accentLight", content: "расстроился (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "un paralelo casi exacto entre idiomas", anchor: "middle" },
  ],

  // если бы (irreal, b2-1) vs. если (real, hoy) — la presencia de бы es la única marca.
  esliByVsEsliNoByIrrealVsRealSynthesisBridge: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 46, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 42, size: 6.5, fill: "inkSoft", content: "если бы", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 58, size: 5, fill: "danger", content: "irreal (b2-1)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 42, size: 6.5, fill: "white", content: "если", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 5, fill: "accentLight", content: "real (hoy)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "бы es la única marca que los distingue", anchor: "middle" },
  ],

  // при условии, что / в случае, если — variantes formales de если, propias de negocios.
  priUsloviiVSluchaeFormalConditionalPhraseGroup: [
    { kind: "rect", x: 6, y: 12, w: 148, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 27, size: 5.5, fill: "white", content: "при условии, что...", bold: true, anchor: "middle" },
    { kind: "rect", x: 6, y: 40, w: 148, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 55, size: 5.5, fill: "white", content: "в случае, если...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 6.5, fill: "inkSoft", content: "registro formal: contratos y negocios", anchor: "middle" },
  ],

  // Verdad general (presente + presente) e imperativo como consecuencia de если.
  generalTruthImperativeConsequenceGroup: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 41, y: 40, size: 6, fill: "white", content: "нагреть → закипает", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "accentLight", content: "verdad general", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "accent" },
    { kind: "text", x: 119, y: 40, size: 6, fill: "white", content: "увидишь → передай", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "white", content: "imperativo", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "dos consecuencias posibles de если", anchor: "middle" },
  ],

  // Repaso b1-16: позвонишь (perfectivo, forma "presente") ya expresa futuro.
  perfectivePresentFutureValueBridgeReview: [
    { kind: "rect", x: 20, y: 20, w: 120, h: 30, rx: 10, fill: "muted" },
    { kind: "text", x: 80, y: 40, size: 7, fill: "inkSoft", content: "позвонишь", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 64, size: 6.5, fill: "danger", content: "forma «presente», valor futuro", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "el perfectivo no tiene presente real (b1-16)", anchor: "middle" },
  ],

  // Repaso: по-моему, согласен/согласна, с одной стороны... — el sistema base de opinión (b1-3).
  opinionAgreementB13BridgeReview: [
    { kind: "rect", x: 20, y: 20, w: 120, h: 30, rx: 10, fill: "muted" },
    { kind: "text", x: 80, y: 40, size: 7, fill: "inkSoft", content: "по-моему, согласен", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 64, size: 6.5, fill: "danger", content: "opinión básica (b1-3)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "hoy: el registro del debate formal", anchor: "middle" },
  ],

  // Tesis → argumento → ejemplo/prueba → conclusión — esqueleto del ensayo argumentativo.
  formalArgumentEssaySkeletonStructure: [
    { kind: "rect", x: 4, y: 24, w: 34, h: 28, rx: 6, fill: "brand" },
    { kind: "text", x: 21, y: 41, size: 5, fill: "white", content: "tesis", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 24, w: 34, h: 28, rx: 6, fill: "brand" },
    { kind: "text", x: 61, y: 41, size: 5, fill: "white", content: "argumento", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 24, w: 34, h: 28, rx: 6, fill: "accent" },
    { kind: "text", x: 101, y: 41, size: 5, fill: "white", content: "ejemplo", bold: true, anchor: "middle" },
    { kind: "rect", x: 124, y: 24, w: 32, h: 28, rx: 6, fill: "accent" },
    { kind: "text", x: 140, y: 41, size: 5, fill: "white", content: "conclusión", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 6.5, fill: "inkSoft", content: "el esquema clásico del debate ruso", anchor: "middle" },
  ],

  // во-первых → кроме того → следовательно — escalera de conectores formales.
  formalSequencingConnectorsLadder: [
    { kind: "rect", x: 4, y: 8, w: 68, h: 22, rx: 6, fill: "muted" },
    { kind: "text", x: 38, y: 22, size: 5, fill: "inkSoft", content: "во-первых/во-вторых", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 8, w: 70, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 115, y: 22, size: 5, fill: "white", content: "кроме того/более того", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 34, w: 80, h: 22, rx: 6, fill: "accent" },
    { kind: "text", x: 80, y: 48, size: 5, fill: "white", content: "следовательно", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6.5, fill: "inkSoft", content: "más formal que сначала/потом (b1-5)", anchor: "middle" },
  ],

  // я сомневаюсь, что + indicativo — nunca subjuntivo, a diferencia del español.
  certaintyVerbsIndicativeNoSubjunctiveRule: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 46, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6, fill: "inkSoft", content: "dudo que SEA", anchor: "middle" },
    { kind: "text", x: 41, y: 56, size: 5, fill: "danger", content: "subjuntivo (ES)", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 46, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6, fill: "white", content: "сомневаюсь, что ЯВЛЯЕТСЯ", anchor: "middle" },
    { kind: "text", x: 119, y: 58, size: 4.5, fill: "accentLight", content: "indicativo siempre (RU)", anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "el ruso no tiene subjuntivo aquí", anchor: "middle" },
  ],

  // Repaso: что exige coma obligatoria antes, en cualquier subordinada de opinión (b1-23).
  commaBeforeChtoOpinionClauseBridgeReview: [
    { kind: "text", x: 30, y: 46, size: 6.5, fill: "inkSoft", content: "Я считаю", bold: true, anchor: "middle" },
    { kind: "circle", cx: 70, cy: 46, r: 8, fill: "danger" },
    { kind: "text", x: 70, y: 49, size: 8, fill: "white", content: ",", bold: true, anchor: "middle" },
    { kind: "text", x: 110, y: 46, size: 6.5, fill: "inkSoft", content: "что...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "coma obligatoria antes de что (b1-23)", anchor: "middle" },
  ],

  // хотя..., всё же... — matizar antes de contradecir.
  hotyaVsyoTakiSofteningConcessionStructure: [
    { kind: "rect", x: 10, y: 20, w: 62, h: 44, rx: 10, fill: "muted" },
    { kind: "text", x: 41, y: 40, size: 6, fill: "inkSoft", content: "хотя доля правды", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 54, size: 5, fill: "danger", content: "reconoce algo de razón", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 62, h: 44, rx: 10, fill: "brand" },
    { kind: "text", x: 119, y: 40, size: 6, fill: "white", content: "всё же не согласен", anchor: "middle" },
    { kind: "text", x: 119, y: 54, size: 5, fill: "accentLight", content: "luego discrepa", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "cortesía típica del debate ruso", anchor: "middle" },
  ],

  // согласен С ТЕМ, что... — с + instrumental de тем, ancla obligatoria antes de что.
  soglasenSTemChtoConstructionRule: [
    { kind: "text", x: 26, y: 46, size: 6, fill: "inkSoft", content: "согласен", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 32, w: 42, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 81, y: 49, size: 6, fill: "white", content: "с тем,", bold: true, anchor: "middle" },
    { kind: "text", x: 132, y: 46, size: 6, fill: "inkSoft", content: "что...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6.5, fill: "inkSoft", content: "nunca «согласен, что» directamente", anchor: "middle" },
  ],

  // нельзя не согласиться — doble negación retórica que refuerza el acuerdo.
  nelzyaNeSoglasitsyaDoubleNegativeEmphasisRule: [
    { kind: "circle", cx: 55, cy: 46, r: 22, fill: "muted" },
    { kind: "text", x: 55, y: 43, size: 5.5, fill: "inkSoft", content: "нельзя не", bold: true, anchor: "middle" },
    { kind: "text", x: 55, y: 55, size: 5.5, fill: "danger", content: "согласиться", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 46 L100 46", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "circle", cx: 122, cy: 46, r: 22, fill: "brand" },
    { kind: "text", x: 122, y: 49, size: 6, fill: "white", content: "= acuerdo fuerte", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "la doble negación refuerza, no cancela", anchor: "middle" },
  ],

  // Orden invertido: "Тихо шумел лес" en vez de "Лес тихо шумел" — el elemento clave al final.
  invertedWordOrderPoeticEmphasisRule: [
    { kind: "text", x: 80, y: 30, size: 6, fill: "inkSoft", content: "Лес тихо шумел", anchor: "middle" },
    { kind: "path", d: "M50 40 L110 40", stroke: "muted", strokeWidth: 1.5 },
    { kind: "rect", x: 34, y: 50, w: 92, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 61, size: 6, fill: "white", content: "Тихо шумел", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 71, size: 6.5, fill: "accentLight", content: "ЛЕС", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 6.5, fill: "inkSoft", content: "lo importante va al final", anchor: "middle" },
  ],

  // El orden neutro es SVO; el registro literario mueve el sujeto al final como información nueva.
  newInformationSentenceFinalPositionRule: [
    { kind: "text", x: 30, y: 42, size: 6, fill: "inkSoft", content: "S", bold: true, anchor: "middle" },
    { kind: "text", x: 55, y: 42, size: 6, fill: "inkSoft", content: "V", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 42, size: 6, fill: "inkSoft", content: "O", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 5.5, fill: "muted", content: "orden neutro", anchor: "middle" },
    { kind: "path", d: "M55 65 L55 78", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "circle", cx: 55, cy: 88, r: 4, fill: "inkSoft" },
    { kind: "text", x: 55, y: 100, size: 5.5, fill: "muted", content: "V", anchor: "middle" },
    { kind: "text", x: 90, y: 100, size: 6.5, fill: "brand", content: "→ S al final", bold: true, anchor: "middle" },
  ],

  // Vocabulario poético/arcaico: очи, уста, чело, ланиты — reconocimiento pasivo, no productivo.
  archaicPoeticVocabularyPassiveRecognitionRule: [
    { kind: "rect", x: 24, y: 24, w: 50, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 49, y: 40, size: 6, fill: "white", content: "очи", bold: true, anchor: "middle" },
    { kind: "text", x: 49, y: 50, size: 5, fill: "accentLight", content: "глаза", anchor: "middle" },
    { kind: "rect", x: 86, y: 24, w: 50, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 111, y: 40, size: 6, fill: "white", content: "уста", bold: true, anchor: "middle" },
    { kind: "text", x: 111, y: 50, size: 5, fill: "accentLight", content: "губы", anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6, fill: "inkSoft", content: "solo se leen, no se hablan", anchor: "middle" },
    { kind: "text", x: 80, y: 90, size: 5.5, fill: "muted", content: "vocabulario pasivo", anchor: "middle" },
  ],

  // Las cuatro figuras estilísticas básicas: эпитет, метафора, сравнение, олицетворение.
  epitetMetaphoraSravneniyeOlitsetvoreniyeFourFigures: [
    { kind: "rect", x: 20, y: 18, w: 56, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 48, y: 32, size: 5.5, fill: "white", content: "эпитет", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 18, w: 56, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 112, y: 32, size: 5.5, fill: "white", content: "метафора", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 46, w: 56, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 48, y: 60, size: 5.5, fill: "ink", content: "сравнение", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 46, w: 56, h: 22, rx: 5, fill: "muted" },
    { kind: "text", x: 112, y: 60, size: 5.5, fill: "inkSoft", content: "олицетворение", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "las 4 herramientas del comentario", anchor: "middle" },
  ],

  // метафора vs сравнение: la partícula "как/словно/будто" decide.
  metaphorVsSravneniyeComoParticleContrastRule: [
    { kind: "text", x: 40, y: 34, size: 6, fill: "inkSoft", content: "море огня", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 46, size: 5, fill: "danger", content: "sin «как»", anchor: "middle" },
    { kind: "text", x: 40, y: 60, size: 6, fill: "brand", content: "= метафора", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 20 L80 76", stroke: "muted", strokeWidth: 1.5 },
    { kind: "text", x: 120, y: 34, size: 6, fill: "inkSoft", content: "белый, как снег", bold: true, anchor: "middle" },
    { kind: "text", x: 120, y: 46, size: 5, fill: "accent", content: "con «как»", anchor: "middle" },
    { kind: "text", x: 120, y: 60, size: 6, fill: "brand", content: "= сравнение", bold: true, anchor: "middle" },
  ],

  // Repaso puente: participios/gerundios (b1-19–22, b2-9–11) funcionando con densidad estilística.
  participlesGerundsStylisticDensityBridgeReview: [
    { kind: "circle", cx: 45, cy: 46, r: 20, fill: "muted" },
    { kind: "text", x: 45, y: 43, size: 5.5, fill: "inkSoft", content: "причастия", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 53, size: 5, fill: "inkSoft", content: "деепричастия", anchor: "middle" },
    { kind: "path", d: "M68 46 L96 46", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "circle", cx: 120, cy: 46, r: 20, fill: "brand" },
    { kind: "text", x: 120, y: 49, size: 5.5, fill: "white", content: "стиль текста", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "b1-19–22 y b2-9–11 en acción", anchor: "middle" },
  ],

  // Fórmulas fijas del comentario literario: автор описывает.../главная мысль заключается в том, что...
  literaryCommentaryFixedPhrasesRule: [
    { kind: "rect", x: 20, y: 20, w: 120, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 80, y: 33, size: 5.5, fill: "white", content: "автор описывает...", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 44, w: 120, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 57, size: 5.5, fill: "white", content: "главная мысль в том, что...", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 68, w: 120, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 80, y: 81, size: 5.5, fill: "ink", content: "автор использует..., чтобы...", bold: true, anchor: "middle" },
  ],

  // El tono del texto: настроение — грустное/светлое/мрачное/радостное.
  moodToneVocabularyLightDarkContrastRule: [
    { kind: "circle", cx: 45, cy: 46, r: 22, fill: "inkSoft" },
    { kind: "text", x: 45, y: 43, size: 5.5, fill: "white", content: "грустное", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 53, size: 5, fill: "muted", content: "мрачное", anchor: "middle" },
    { kind: "circle", cx: 120, cy: 46, r: 22, fill: "accentLight" },
    { kind: "text", x: 120, y: 43, size: 5.5, fill: "ink", content: "светлое", bold: true, anchor: "middle" },
    { kind: "text", x: 120, y: 53, size: 5, fill: "ink", content: "радостное", anchor: "middle" },
    { kind: "text", x: 80, y: 88, size: 6.5, fill: "inkSoft", content: "настроение текста", anchor: "middle" },
  ],

  // Partículas discursivas: ну, вот, же, ведь, -то — organizan el habla oral.
  discourseParticlesNuVotZheVedOverviewTable: [
    { kind: "rect", x: 16, y: 18, w: 30, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 31, y: 32, size: 6, fill: "white", content: "ну", bold: true, anchor: "middle" },
    { kind: "rect", x: 50, y: 18, w: 30, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 65, y: 32, size: 6, fill: "white", content: "вот", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 18, w: 30, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 99, y: 32, size: 6, fill: "ink", content: "же", bold: true, anchor: "middle" },
    { kind: "rect", x: 118, y: 18, w: 30, h: 22, rx: 5, fill: "muted" },
    { kind: "text", x: 133, y: 32, size: 5.5, fill: "inkSoft", content: "ведь", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 6.5, fill: "inkSoft", content: "sin traducción palabra por palabra", anchor: "middle" },
    { kind: "text", x: 80, y: 80, size: 6, fill: "muted", content: "organizan el discurso oral", anchor: "middle" },
  ],

  // же añade énfasis/insistencia justo después de la palabra que refuerza.
  zhePartikleEmphasisInsistenceRule: [
    { kind: "text", x: 40, y: 46, size: 6.5, fill: "inkSoft", content: "Я", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 33, w: 30, h: 24, rx: 6, fill: "danger" },
    { kind: "text", x: 73, y: 49, size: 6.5, fill: "white", content: "же", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 46, size: 6, fill: "inkSoft", content: "говорил!", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "¡si ya te lo dije! (énfasis)", anchor: "middle" },
  ],

  // -то (enclítica) señala/contrasta el elemento al que se pega.
  toPartikleaHighlightingPointingRule: [
    { kind: "text", x: 45, y: 46, size: 6.5, fill: "inkSoft", content: "А ты", bold: true, anchor: "middle" },
    { kind: "rect", x: 78, y: 33, w: 26, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 91, y: 49, size: 6.5, fill: "white", content: "-то", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 46, size: 5.5, fill: "inkSoft", content: "что думаешь?", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "contrasta específicamente a «ты»", anchor: "middle" },
  ],

  // Expresiones fijas: всё путём, так себе, не вопрос — significado no literal, bloque completo.
  fixedColloquialExpressionsBlockMeaningRule: [
    { kind: "rect", x: 20, y: 20, w: 120, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 80, y: 34, size: 6, fill: "white", content: "всё путём", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 52, size: 5.5, fill: "muted", content: "≠ traducción literal", anchor: "middle" },
    { kind: "rect", x: 20, y: 62, w: 120, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 80, y: 76, size: 6, fill: "ink", content: "= todo va bien", bold: true, anchor: "middle" },
  ],

  // Jerga juvenil/internet: uso pasivo, cambia rápido según edad/región.
  internetYouthSlangPassiveRecognitionWarning: [
    { kind: "circle", cx: 80, cy: 40, r: 22, fill: "muted" },
    { kind: "text", x: 80, y: 37, size: 5.5, fill: "inkSoft", content: "крутой", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 5, fill: "inkSoft", content: "тусовка", anchor: "middle" },
    { kind: "path", d: "M60 70 L100 70", stroke: "danger", strokeWidth: 2 },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "danger", content: "reconocer, no usar sin confirmar vigencia", anchor: "middle" },
  ],

  // Escalera de registro: coloquial → neutro → formal.
  registerLadderColoquialNeutralFormalCompare: [
    { kind: "rect", x: 18, y: 60, w: 38, h: 20, rx: 5, fill: "danger" },
    { kind: "text", x: 37, y: 73, size: 5, fill: "white", content: "coloquial", bold: true, anchor: "middle" },
    { kind: "rect", x: 61, y: 40, w: 38, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 53, size: 5, fill: "white", content: "neutro", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 20, w: 38, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 123, y: 33, size: 5, fill: "white", content: "formal", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 96, size: 6, fill: "inkSoft", content: "mismo mensaje, tres niveles", anchor: "middle" },
  ],

  // короче (coloquial) vs в общем (neutro) vs таким образом (formal, repaso B2-25).
  korocheVObschemFormalPhraseLadderCompare: [
    { kind: "text", x: 40, y: 34, size: 5.5, fill: "danger", content: "короче", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 46, size: 5, fill: "muted", content: "coloquial", anchor: "middle" },
    { kind: "text", x: 90, y: 34, size: 5.5, fill: "accent", content: "в общем", bold: true, anchor: "middle" },
    { kind: "text", x: 90, y: 46, size: 5, fill: "muted", content: "neutro", anchor: "middle" },
    { kind: "text", x: 130, y: 34, size: 5, fill: "brand", content: "таким образом", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 46, size: 5, fill: "muted", content: "formal", anchor: "middle" },
    { kind: "text", x: 80, y: 78, size: 6.5, fill: "inkSoft", content: "mismo conector de cierre", anchor: "middle" },
  ],

  // держись, забей, не парься — kit de ánimo/tranquilización coloquial.
  colloquialFarewellReassurancePhrasesRule: [
    { kind: "rect", x: 18, y: 24, w: 40, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 38, y: 38, size: 5.5, fill: "white", content: "держись", bold: true, anchor: "middle" },
    { kind: "rect", x: 62, y: 24, w: 40, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 82, y: 38, size: 5.5, fill: "white", content: "забей", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 24, w: 40, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 126, y: 38, size: 5, fill: "ink", content: "не парься", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 64, size: 6.5, fill: "inkSoft", content: "ánimo / tranquilización coloquial", anchor: "middle" },
  ],

  // Vocabulario temático de sociedad: общество, неравенство, безработица...
  socialVocabularyThematicOverviewTable: [
    { kind: "rect", x: 16, y: 20, w: 62, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 47, y: 33, size: 5.5, fill: "white", content: "общество", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 20, w: 62, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 113, y: 33, size: 5.5, fill: "white", content: "неравенство", bold: true, anchor: "middle" },
    { kind: "rect", x: 16, y: 46, w: 62, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 47, y: 59, size: 5.5, fill: "ink", content: "безработица", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 46, w: 62, h: 20, rx: 5, fill: "muted" },
    { kind: "text", x: 113, y: 59, size: 5.5, fill: "inkSoft", content: "реформа", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6, fill: "inkSoft", content: "vocabulario de actualidad", anchor: "middle" },
  ],

  // Считается, что.../Говорят, что.../Наблюдается... — construcciones impersonales.
  impersonalConstructionsSchitaetsyaGovoryatNablyudaetsyaRule: [
    { kind: "text", x: 80, y: 30, size: 6, fill: "inkSoft", content: "Считается, что...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 46, size: 6, fill: "inkSoft", content: "Говорят, что...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 6, fill: "inkSoft", content: "Наблюдается...", bold: true, anchor: "middle" },
    { kind: "path", d: "M40 76 L120 76", stroke: "muted", strokeWidth: 1.5 },
    { kind: "text", x: 80, y: 90, size: 6.5, fill: "brand", content: "= 'se' impersonal español", anchor: "middle" },
  ],

  // из-за (negativa) / в связи с (neutra) / в результате (consecuencia).
  causalPrepositionsIzZaVSvyazSVResultateTable: [
    { kind: "rect", x: 14, y: 22, w: 42, h: 24, rx: 5, fill: "danger" },
    { kind: "text", x: 35, y: 33, size: 5, fill: "white", content: "из-за", bold: true, anchor: "middle" },
    { kind: "text", x: 35, y: 43, size: 4.5, fill: "white", content: "+ genitivo", anchor: "middle" },
    { kind: "rect", x: 59, y: 22, w: 42, h: 24, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 33, size: 5, fill: "white", content: "в связи с", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 43, size: 4.5, fill: "white", content: "+ instrumental", anchor: "middle" },
    { kind: "rect", x: 104, y: 22, w: 42, h: 24, rx: 5, fill: "brand" },
    { kind: "text", x: 125, y: 33, size: 4.8, fill: "white", content: "в результате", bold: true, anchor: "middle" },
    { kind: "text", x: 125, y: 43, size: 4.5, fill: "white", content: "+ genitivo", anchor: "middle" },
    { kind: "text", x: 80, y: 72, size: 5.5, fill: "inkSoft", content: "negativa / neutra / consecuencia", anchor: "middle" },
  ],

  // по мнению.../с точки зрения... — atribuir una opinión a una fuente.
  sociologicalOpinionFormulasByMneniyuSTochkiZreniya: [
    { kind: "rect", x: 20, y: 24, w: 120, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 80, y: 38, size: 5.5, fill: "white", content: "по мнению экспертов", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 52, w: 120, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 80, y: 66, size: 5.5, fill: "ink", content: "с точки зрения общества", bold: true, anchor: "middle" },
  ],

  // обеспокоен(а) + instrumental — "preocupado POR" rige instrumental, no "о".
  publicOpinionConcernExpressionsRule: [
    { kind: "text", x: 35, y: 46, size: 5.5, fill: "inkSoft", content: "обеспокоена", bold: true, anchor: "middle" },
    { kind: "rect", x: 78, y: 33, w: 60, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 108, y: 46, size: 5.5, fill: "white", content: "ростом цен", bold: true, anchor: "middle" },
    { kind: "text", x: 108, y: 56, size: 4.5, fill: "accentLight", content: "(instrumental)", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "danger", content: "¡nunca «о + prepositional»!", anchor: "middle" },
  ],

  // расти → рост, снижаться → снижение — pares verbo/sustantivo verbal.
  growthDeclineVerbNounPairsTable: [
    { kind: "text", x: 40, y: 34, size: 5.5, fill: "inkSoft", content: "расти", anchor: "middle" },
    { kind: "path", d: "M40 40 L40 52", stroke: "inkSoft", strokeWidth: 1.5 },
    { kind: "text", x: 40, y: 64, size: 5.5, fill: "brand", content: "рост", bold: true, anchor: "middle" },
    { kind: "text", x: 120, y: 34, size: 5.5, fill: "inkSoft", content: "снижаться", anchor: "middle" },
    { kind: "path", d: "M120 40 L120 52", stroke: "inkSoft", strokeWidth: 1.5 },
    { kind: "text", x: 120, y: 64, size: 5, fill: "brand", content: "снижение", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 86, size: 6, fill: "inkSoft", content: "verbo → sustantivo verbal", anchor: "middle" },
  ],

  // развитие, изменение — sustantivos verbales, tono formal/objetivo.
  verbalNounsFormalToneRule: [
    { kind: "circle", cx: 55, cy: 46, r: 22, fill: "muted" },
    { kind: "text", x: 55, y: 43, size: 5.5, fill: "inkSoft", content: "то, что", bold: true, anchor: "middle" },
    { kind: "text", x: 55, y: 53, size: 5, fill: "inkSoft", content: "растёт...", anchor: "middle" },
    { kind: "path", d: "M80 46 L100 46", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "circle", cx: 122, cy: 46, r: 22, fill: "brand" },
    { kind: "text", x: 122, y: 49, size: 5.5, fill: "white", content: "рост", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "más compacto, más formal", anchor: "middle" },
  ],

  // Adelanto: -ся para procesos sociales sin agente (repaso ampliado en b2-13).
  passiveSyaSocialProcessesBridgeReview: [
    { kind: "text", x: 45, y: 40, size: 6, fill: "inkSoft", content: "улучшается", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 54, size: 6, fill: "inkSoft", content: "снижается", bold: true, anchor: "middle" },
    { kind: "rect", x: 90, y: 30, w: 46, h: 32, rx: 6, fill: "brand" },
    { kind: "text", x: 113, y: 44, size: 5.5, fill: "white", content: "sin agente", bold: true, anchor: "middle" },
    { kind: "text", x: 113, y: 54, size: 5, fill: "accentLight", content: "explícito", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6, fill: "inkSoft", content: "repaso ampliado en b2-13", anchor: "middle" },
  ],

  // Vocabulario de oficina: совещание, переговоры, сделка, бюджет.
  businessVocabularyThematicOverviewTable: [
    { kind: "rect", x: 16, y: 20, w: 62, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 47, y: 33, size: 5.5, fill: "white", content: "совещание", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 20, w: 62, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 113, y: 33, size: 5.5, fill: "white", content: "переговоры", bold: true, anchor: "middle" },
    { kind: "rect", x: 16, y: 46, w: 62, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 47, y: 59, size: 5.5, fill: "ink", content: "сделка", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 46, w: 62, h: 20, rx: 5, fill: "muted" },
    { kind: "text", x: 113, y: 59, size: 5.5, fill: "inkSoft", content: "бюджет", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6, fill: "inkSoft", content: "vocabulario de oficina", anchor: "middle" },
  ],

  // Разрешите представиться / Я отвечаю за... — presentación profesional.
  professionalIntroductionFixedPhrasesRule: [
    { kind: "rect", x: 20, y: 24, w: 120, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 80, y: 38, size: 5.5, fill: "white", content: "Разрешите представиться", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 52, w: 120, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 80, y: 66, size: 5.5, fill: "ink", content: "Я отвечаю за...", bold: true, anchor: "middle" },
  ],

  // Fórmulas de reunión: proponer, aceptar, aclarar, cerrar.
  meetingNegotiationPhrasesLadderTable: [
    { kind: "text", x: 80, y: 26, size: 5.5, fill: "inkSoft", content: "Я предлагаю...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 42, size: 5.5, fill: "inkSoft", content: "Полностью согласен(на)", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 5.5, fill: "inkSoft", content: "Не могли бы вы уточнить?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 5.5, fill: "brand", content: "Подведём итоги", bold: true, anchor: "middle" },
    { kind: "path", d: "M40 84 L120 84", stroke: "muted", strokeWidth: 1.5 },
    { kind: "text", x: 80, y: 96, size: 5.5, fill: "muted", content: "proponer → aceptar → aclarar → cerrar", anchor: "middle" },
  ],

  // Позвольте не согласиться — desacuerdo cortés de registro de negocios.
  courtePoliteDisagreementPozvolteNeSoglasitsyaRule: [
    { kind: "rect", x: 20, y: 30, w: 120, h: 28, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 44, size: 5.5, fill: "white", content: "Позвольте не", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 5.5, fill: "white", content: "согласиться", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 6, fill: "inkSoft", content: "más formal que b2-3", anchor: "middle" },
  ],

  // Вы obligatorio en el registro profesional; el paso a ты exige acuerdo explícito.
  vyFormalAddressBusinessObligatoryRule: [
    { kind: "circle", cx: 55, cy: 46, r: 22, fill: "brand" },
    { kind: "text", x: 55, y: 50, size: 7, fill: "white", content: "Вы", bold: true, anchor: "middle" },
    { kind: "path", d: "M80 46 L100 46", stroke: "danger", strokeWidth: 2 },
    { kind: "circle", cx: 122, cy: 46, r: 22, fill: "muted" },
    { kind: "text", x: 122, y: 50, size: 7, fill: "inkSoft", content: "ты", anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6, fill: "danger", content: "solo con acuerdo explícito", anchor: "middle" },
  ],

  // Colocaciones fijas: заключить сделку, снизить расходы, выполнить план.
  fixedBusinessCollocationsBlockTable: [
    { kind: "rect", x: 20, y: 18, w: 120, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 80, y: 31, size: 5.5, fill: "white", content: "заключить сделку", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 42, w: 120, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 55, size: 5.5, fill: "white", content: "снизить расходы", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 66, w: 120, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 80, y: 79, size: 5.5, fill: "ink", content: "выполнить план", bold: true, anchor: "middle" },
  ],

  // Подведём итоги — fórmula fija de cierre de reunión.
  meetingSummaryClosingPhrasesRule: [
    { kind: "circle", cx: 80, cy: 44, r: 26, fill: "brand" },
    { kind: "text", x: 80, y: 41, size: 5.5, fill: "white", content: "Подведём", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 51, size: 5.5, fill: "white", content: "итоги", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6, fill: "inkSoft", content: "cierre de la reunión", anchor: "middle" },
  ],

  // вырасти/снизиться на + acusativo (número) процентов — cifras de negocio.
  percentageGrowthBusinessStatsRule: [
    { kind: "text", x: 40, y: 40, size: 6, fill: "inkSoft", content: "Прибыль выросла", bold: true, anchor: "middle" },
    { kind: "rect", x: 96, y: 26, w: 44, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 118, y: 43, size: 6.5, fill: "white", content: "на 15%", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 6, fill: "inkSoft", content: "на + acusativo + процентов", anchor: "middle" },
  ],

  // Forma corta: masculino Ø, femenino -а, neutro -о, plural -ы/-и.
  shortAdjectiveFormationMascFemNeutPlTable: [
    { kind: "rect", x: 14, y: 20, w: 32, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 30, y: 34, size: 5.5, fill: "white", content: "готов", bold: true, anchor: "middle" },
    { kind: "rect", x: 50, y: 20, w: 32, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 66, y: 34, size: 5.5, fill: "white", content: "готова", bold: true, anchor: "middle" },
    { kind: "rect", x: 86, y: 20, w: 32, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 102, y: 34, size: 5, fill: "ink", content: "готово", bold: true, anchor: "middle" },
    { kind: "rect", x: 122, y: 20, w: 32, h: 22, rx: 5, fill: "muted" },
    { kind: "text", x: 138, y: 34, size: 5, fill: "inkSoft", content: "готовы", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 60, size: 5.5, fill: "inkSoft", content: "masc. Ø / fem. -а / neu. -о / pl. -ы", anchor: "middle" },
  ],

  // La forma corta solo va como predicado, nunca delante del sustantivo.
  shortAdjectivePredicateOnlyNeverPrenominalRule: [
    { kind: "text", x: 45, y: 40, size: 6, fill: "inkSoft", content: "Стол готов.", bold: true, anchor: "middle" },
    { kind: "circle", cx: 130, cy: 40, r: 4, fill: "brand" },
    { kind: "text", x: 45, y: 66, size: 6, fill: "danger", content: "✗ Готов стол.", bold: true, anchor: "middle" },
    { kind: "path", d: "M100 60 L140 60", stroke: "danger", strokeWidth: 2 },
    { kind: "text", x: 80, y: 90, size: 6, fill: "inkSoft", content: "solo como predicado", anchor: "middle" },
  ],

  // рад, должен, готов, согласен: casi solo forma corta en el ruso moderno.
  shortOnlyAdjectivesRadDolzhenGotovSoglasenList: [
    { kind: "rect", x: 16, y: 20, w: 32, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 32, y: 33, size: 5.5, fill: "white", content: "рад", bold: true, anchor: "middle" },
    { kind: "rect", x: 52, y: 20, w: 32, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 68, y: 33, size: 5, fill: "white", content: "должен", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 32, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 104, y: 33, size: 5, fill: "ink", content: "готов", bold: true, anchor: "middle" },
    { kind: "rect", x: 124, y: 20, w: 32, h: 20, rx: 5, fill: "muted" },
    { kind: "text", x: 140, y: 33, size: 4.5, fill: "inkSoft", content: "согласен", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 6, fill: "inkSoft", content: "sin forma larga de uso común", anchor: "middle" },
  ],

  // болен (estado temporal) vs. больной (cualidad permanente/sustantivado).
  shortVsLongAdjectiveMeaningContrastRule: [
    { kind: "rect", x: 20, y: 24, w: 55, h: 28, rx: 6, fill: "brand" },
    { kind: "text", x: 47, y: 38, size: 5.5, fill: "white", content: "он болен", bold: true, anchor: "middle" },
    { kind: "text", x: 47, y: 48, size: 4.5, fill: "accentLight", content: "temporal", anchor: "middle" },
    { kind: "rect", x: 85, y: 24, w: 55, h: 28, rx: 6, fill: "muted" },
    { kind: "text", x: 112, y: 38, size: 5, fill: "inkSoft", content: "он больной", bold: true, anchor: "middle" },
    { kind: "text", x: 112, y: 48, size: 4.5, fill: "inkSoft", content: "permanente", anchor: "middle" },
  ],

  // 1 → nominativo, 2-4 → genitivo sg., 5+ → genitivo pl.
  numeralNounAgreementOneTwoFourFiveTable: [
    { kind: "text", x: 32, y: 30, size: 5.5, fill: "inkSoft", content: "1", bold: true, anchor: "middle" },
    { kind: "text", x: 32, y: 44, size: 4.5, fill: "muted", content: "стол", anchor: "middle" },
    { kind: "text", x: 80, y: 30, size: 5.5, fill: "inkSoft", content: "2-4", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 44, size: 4.5, fill: "muted", content: "стола", anchor: "middle" },
    { kind: "text", x: 128, y: 30, size: 5.5, fill: "inkSoft", content: "5+", bold: true, anchor: "middle" },
    { kind: "text", x: 128, y: 44, size: 4.5, fill: "muted", content: "столов", anchor: "middle" },
    { kind: "path", d: "M16 54 L144 54", stroke: "muted", strokeWidth: 1.5 },
    { kind: "text", x: 80, y: 68, size: 5.5, fill: "brand", content: "nom.sg / gen.sg / gen.pl", bold: true, anchor: "middle" },
  ],

  // пять → пяти → пятью — los numerales también se declinan por caso.
  numeralDeclensionByCaseTable: [
    { kind: "text", x: 40, y: 34, size: 6, fill: "inkSoft", content: "пять", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 46, size: 4.5, fill: "muted", content: "nominativo", anchor: "middle" },
    { kind: "path", d: "M56 40 L84 40", stroke: "inkSoft", strokeWidth: 1.5 },
    { kind: "text", x: 100, y: 34, size: 6, fill: "inkSoft", content: "пяти", bold: true, anchor: "middle" },
    { kind: "text", x: 100, y: 46, size: 4.5, fill: "muted", content: "genitivo/dativo", anchor: "middle" },
    { kind: "path", d: "M116 40 L134 40", stroke: "inkSoft", strokeWidth: 1.5 },
    { kind: "text", x: 138, y: 34, size: 5.5, fill: "brand", content: "пятью", bold: true, anchor: "middle" },
    { kind: "text", x: 138, y: 46, size: 4, fill: "muted", content: "instr.", anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 6, fill: "inkSoft", content: "el numeral cambia de forma", anchor: "middle" },
  ],

  // Numerales compuestos: cada palabra declina por separado.
  compoundNumeralEachWordDeclinesRule: [
    { kind: "rect", x: 18, y: 30, w: 56, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 46, y: 45, size: 5.5, fill: "white", content: "двадцатью", bold: true, anchor: "middle" },
    { kind: "text", x: 82, y: 44, size: 6, fill: "inkSoft", content: "+", anchor: "middle" },
    { kind: "rect", x: 92, y: 30, w: 50, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 117, y: 45, size: 5.5, fill: "white", content: "пятью", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 72, size: 6, fill: "inkSoft", content: "cada palabra declina por separado", anchor: "middle" },
  ],

  // Repaso: la forma corta de los participios pasivos (b1-20) ya usaba este patrón.
  shortAdjectiveBridgeReviewB120Participles: [
    { kind: "circle", cx: 45, cy: 46, r: 20, fill: "muted" },
    { kind: "text", x: 45, y: 43, size: 5, fill: "inkSoft", content: "причастие", anchor: "middle" },
    { kind: "text", x: 45, y: 53, size: 5, fill: "inkSoft", content: "краткое", anchor: "middle" },
    { kind: "path", d: "M68 46 L96 46", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "circle", cx: 120, cy: 46, r: 20, fill: "brand" },
    { kind: "text", x: 120, y: 49, size: 5.5, fill: "white", content: "adjetivo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 6.5, fill: "inkSoft", content: "b1-20: mismo patrón generalizado", anchor: "middle" },
  ],

  // который (sujeto) → participio: la transformación central de la lección.
  relativeClauseToParticipleTransformationRule: [
    { kind: "text", x: 45, y: 40, size: 5.5, fill: "inkSoft", content: "который читает", bold: true, anchor: "middle" },
    { kind: "path", d: "M78 40 L100 40", stroke: "inkSoft", strokeWidth: 2 },
    { kind: "rect", x: 104, y: 27, w: 40, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 124, y: 44, size: 5.5, fill: "white", content: "читающий", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 6, fill: "inkSoft", content: "solo si который es sujeto", anchor: "middle" },
  ],

  // Activo (antecedente realiza) vs. pasivo (antecedente recibe).
  activeVsPassiveParticipleAgentAntecedentRule: [
    { kind: "rect", x: 20, y: 24, w: 55, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 47, y: 38, size: 5, fill: "white", content: "работающий", bold: true, anchor: "middle" },
    { kind: "text", x: 47, y: 48, size: 4.5, fill: "accentLight", content: "REALIZA", anchor: "middle" },
    { kind: "rect", x: 85, y: 24, w: 55, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 112, y: 38, size: 5, fill: "white", content: "написанный", bold: true, anchor: "middle" },
    { kind: "text", x: 112, y: 48, size: 4.5, fill: "accentLight", content: "RECIBE", anchor: "middle" },
  ],

  // El participio concuerda con el antecedente, no con el sujeto principal.
  participleAgreesWithAntecedentNotMainSubjectRule: [
    { kind: "text", x: 40, y: 36, size: 5.5, fill: "muted", content: "Я говорил", anchor: "middle" },
    { kind: "rect", x: 76, y: 24, w: 60, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 106, y: 35, size: 5, fill: "white", content: "со студентом,", bold: true, anchor: "middle" },
    { kind: "text", x: 106, y: 45, size: 5, fill: "white", content: "читающим", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 6, fill: "inkSoft", content: "concuerda con «студентом», no «я»", anchor: "middle" },
  ],

  // El agente de la pasiva pasa a instrumental: написанная автором.
  passiveParticipleAgentToInstrumentalRule: [
    { kind: "text", x: 40, y: 40, size: 6, fill: "inkSoft", content: "написанная", bold: true, anchor: "middle" },
    { kind: "rect", x: 90, y: 27, w: 50, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 115, y: 40, size: 5.5, fill: "white", content: "автором", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 50, size: 4.5, fill: "accentLight", content: "(instrumental)", anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 6, fill: "danger", content: "¡nunca nominativo!", anchor: "middle" },
  ],

  // La sustitución solo es posible cuando который es sujeto de su oración.
  participleSubjectOnlyRestrictionRule: [
    { kind: "circle", cx: 45, cy: 44, r: 22, fill: "brand" },
    { kind: "text", x: 45, y: 41, size: 5, fill: "white", content: "который =", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 51, size: 5, fill: "white", content: "sujeto", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 44, size: 6, fill: "inkSoft", content: "✓", bold: true, anchor: "middle" },
    { kind: "circle", cx: 122, cy: 44, r: 22, fill: "muted" },
    { kind: "text", x: 122, y: 41, size: 5, fill: "inkSoft", content: "который =", bold: true, anchor: "middle" },
    { kind: "text", x: 122, y: 51, size: 5, fill: "inkSoft", content: "objeto", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 6, fill: "inkSoft", content: "objeto exige participio pasivo", anchor: "middle" },
  ],

  // Repaso: formación de participios activos/pasivos (b1-19/b1-20).
  participleFormationBridgeReviewB1920: [
    { kind: "rect", x: 18, y: 20, w: 60, h: 40, rx: 6, fill: "muted" },
    { kind: "text", x: 48, y: 36, size: 5, fill: "inkSoft", content: "-ущ-/-ющ-", anchor: "middle" },
    { kind: "text", x: 48, y: 46, size: 5, fill: "inkSoft", content: "-вш-/-ш-", anchor: "middle" },
    { kind: "text", x: 48, y: 56, size: 4.5, fill: "muted", content: "b1-19", anchor: "middle" },
    { kind: "rect", x: 82, y: 20, w: 60, h: 40, rx: 6, fill: "brand" },
    { kind: "text", x: 112, y: 36, size: 5, fill: "white", content: "-ем-/-им-", anchor: "middle" },
    { kind: "text", x: 112, y: 46, size: 5, fill: "white", content: "-нн-/-т-", anchor: "middle" },
    { kind: "text", x: 112, y: 56, size: 4.5, fill: "accentLight", content: "b1-20", anchor: "middle" },
  ],

  // который = habla cotidiana; participio = registro escrito formal.
  participleFormalRegisterVsKotoryColloquialRule: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "danger" },
    { kind: "text", x: 46, y: 41, size: 5.5, fill: "white", content: "который", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 58, size: 5, fill: "muted", content: "habla cotidiana", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 114, y: 41, size: 5, fill: "white", content: "participio", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 58, size: 5, fill: "muted", content: "texto formal", anchor: "middle" },
  ],

  // Tabla resumen: который-clause → participio, tres ejemplos.
  relativeClauseParticipleTransformationTable: [
    { kind: "text", x: 45, y: 26, size: 5, fill: "muted", content: "который живёт", anchor: "middle" },
    { kind: "text", x: 45, y: 38, size: 5.5, fill: "brand", content: "→ живущий", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 56, size: 5, fill: "muted", content: "которую написали", anchor: "middle" },
    { kind: "text", x: 45, y: 68, size: 5.5, fill: "brand", content: "→ написанная", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 26, size: 5, fill: "muted", content: "которые играют", anchor: "middle" },
    { kind: "text", x: 115, y: 38, size: 5.5, fill: "brand", content: "→ играющие", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 56, size: 5, fill: "muted", content: "который построили", anchor: "middle" },
    { kind: "text", x: 115, y: 68, size: 5.5, fill: "brand", content: "→ построенный", bold: true, anchor: "middle" },
  ],

  // Repaso: formación del gerundio imperfectivo (b1-21) y perfectivo (b1-22).
  gerundBridgeReviewB121B122Formation: [
    { kind: "rect", x: 18, y: 20, w: 60, h: 40, rx: 6, fill: "muted" },
    { kind: "text", x: 48, y: 38, size: 5.5, fill: "inkSoft", content: "читая", bold: true, anchor: "middle" },
    { kind: "text", x: 48, y: 52, size: 4.5, fill: "muted", content: "b1-21", anchor: "middle" },
    { kind: "rect", x: 82, y: 20, w: 60, h: 40, rx: 6, fill: "brand" },
    { kind: "text", x: 112, y: 38, size: 5.5, fill: "white", content: "написав", bold: true, anchor: "middle" },
    { kind: "text", x: 112, y: 52, size: 4.5, fill: "accentLight", content: "b1-22", anchor: "middle" },
  ],

  // когда+simultáneo→imperfectivo; после того как→perfectivo.
  subordinateClauseToGerundAspectChoiceTable: [
    { kind: "text", x: 40, y: 28, size: 5, fill: "muted", content: "когда + simultáneo", anchor: "middle" },
    { kind: "text", x: 40, y: 42, size: 5.5, fill: "brand", content: "→ imperfectivo", bold: true, anchor: "middle" },
    { kind: "text", x: 120, y: 28, size: 5, fill: "muted", content: "после того как", anchor: "middle" },
    { kind: "text", x: 120, y: 42, size: 5.5, fill: "brand", content: "→ perfectivo", bold: true, anchor: "middle" },
    { kind: "path", d: "M16 56 L144 56", stroke: "muted", strokeWidth: 1.5 },
    { kind: "text", x: 80, y: 70, size: 6, fill: "inkSoft", content: "según la relación temporal", anchor: "middle" },
  ],

  // не + gerundio: causa o modo negativo.
  negativeNyeGerundCausalModalRule: [
    { kind: "text", x: 35, y: 44, size: 6.5, fill: "danger", content: "не", bold: true, anchor: "middle" },
    { kind: "rect", x: 55, y: 30, w: 60, h: 28, rx: 6, fill: "brand" },
    { kind: "text", x: 85, y: 44, size: 5.5, fill: "white", content: "зная", bold: true, anchor: "middle" },
    { kind: "text", x: 85, y: 54, size: 4.5, fill: "accentLight", content: "gerundio", anchor: "middle" },
    { kind: "text", x: 80, y: 80, size: 6, fill: "inkSoft", content: "causa o modo negativo", anchor: "middle" },
  ],

  // Gerundio invariable vs. participio que concuerda (contraste con b2-9).
  gerundInvariableVsParticipleAgreementContrastB29: [
    { kind: "rect", x: 20, y: 24, w: 55, h: 28, rx: 6, fill: "brand" },
    { kind: "text", x: 47, y: 38, size: 5.5, fill: "white", content: "читая", bold: true, anchor: "middle" },
    { kind: "text", x: 47, y: 48, size: 4.5, fill: "accentLight", content: "invariable", anchor: "middle" },
    { kind: "rect", x: 85, y: 24, w: 55, h: 28, rx: 6, fill: "muted" },
    { kind: "text", x: 112, y: 38, size: 5.5, fill: "inkSoft", content: "читающий", bold: true, anchor: "middle" },
    { kind: "text", x: 112, y: 48, size: 4.5, fill: "inkSoft", content: "concuerda (b2-9)", anchor: "middle" },
  ],

  // Repaso: el mismo sujeto es obligatorio (chiste de Chéjov, b1-21).
  gerundSameSubjectRestrictionBridgeReview: [
    { kind: "text", x: 80, y: 32, size: 5.5, fill: "danger", content: "✗ Читая книгу,", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 46, size: 5.5, fill: "danger", content: "зазвонил телефон", bold: true, anchor: "middle" },
    { kind: "path", d: "M40 56 L120 56", stroke: "danger", strokeWidth: 2 },
    { kind: "text", x: 80, y: 74, size: 6, fill: "inkSoft", content: "sujetos distintos = agramatical", anchor: "middle" },
  ],

  // Cadena de gerundios perfectivos para secuencias de acciones.
  gerundChainSequentialActionsFormalNarrationRule: [
    { kind: "rect", x: 14, y: 30, w: 40, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 34, y: 44, size: 4.5, fill: "white", content: "проснувшись", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 30, w: 40, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 44, size: 4.5, fill: "white", content: "встав", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 30, w: 40, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 126, y: 44, size: 4.2, fill: "ink", content: "позавтракав", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 6, fill: "inkSoft", content: "secuencia sin repetir el sujeto", anchor: "middle" },
  ],

  // Repaso: verbos en -йти → gerundio en -я (excepción de b1-22).
  movementVerbYtiGerundExceptionBridgeReview: [
    { kind: "text", x: 40, y: 40, size: 6, fill: "inkSoft", content: "выйти", bold: true, anchor: "middle" },
    { kind: "path", d: "M60 40 L90 40", stroke: "inkSoft", strokeWidth: 1.5 },
    { kind: "text", x: 118, y: 40, size: 6, fill: "brand", content: "выйдя", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 5.5, fill: "danger", content: "no ✗выйдв — excepción con -я", anchor: "middle" },
    { kind: "text", x: 80, y: 78, size: 5, fill: "muted", content: "repaso b1-22", anchor: "middle" },
  ],

  // Tabla práctica: subordinada → gerundio, tres ejemplos.
  clauseGerundTransformationPracticeTable: [
    { kind: "text", x: 45, y: 24, size: 4.8, fill: "muted", content: "когда я вышел", anchor: "middle" },
    { kind: "text", x: 45, y: 36, size: 5.5, fill: "brand", content: "→ выйдя", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 54, size: 4.8, fill: "muted", content: "так как она устала", anchor: "middle" },
    { kind: "text", x: 45, y: 66, size: 5.5, fill: "brand", content: "→ устав", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 24, size: 4.5, fill: "muted", content: "после того как закончили", anchor: "middle" },
    { kind: "text", x: 115, y: 36, size: 5.5, fill: "brand", content: "→ закончив", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 54, size: 4.8, fill: "muted", content: "когда он готовит", anchor: "middle" },
    { kind: "text", x: 115, y: 66, size: 5.5, fill: "brand", content: "→ готовя", bold: true, anchor: "middle" },
  ],

  // Escala de densidad: coloquial → neutro → académico → burocrático.
  registerDensityScaleColloquialToBureaucraticTable: [
    { kind: "rect", x: 14, y: 30, w: 32, h: 22, rx: 5, fill: "muted" },
    { kind: "text", x: 30, y: 44, size: 4.2, fill: "inkSoft", content: "coloquial", anchor: "middle" },
    { kind: "rect", x: 50, y: 30, w: 32, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 66, y: 44, size: 4.2, fill: "ink", content: "neutro", anchor: "middle" },
    { kind: "rect", x: 86, y: 30, w: 32, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 102, y: 44, size: 4, fill: "white", content: "académico", anchor: "middle" },
    { kind: "rect", x: 122, y: 30, w: 32, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 138, y: 44, size: 3.8, fill: "white", content: "burocrático", anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 5.5, fill: "inkSoft", content: "densidad de participios/gerundios ↑", anchor: "middle" },
  ],

  // который (oral) vs. participio (registro escrito formal) — repaso ampliado de b2-9.
  kotoryPreferredColloquialParticipleFormalContrastReview: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 46, y: 41, size: 5.5, fill: "white", content: "который", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 58, size: 5, fill: "muted", content: "oral", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 114, y: 41, size: 5, fill: "white", content: "participio", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 58, size: 5, fill: "muted", content: "escrito formal", anchor: "middle" },
  ],

  // Participio (adjetivo, concuerda) vs. gerundio (adverbio, invariable).
  participleAdjectivalVsGerundAdverbialFunctionContrastRule: [
    { kind: "rect", x: 20, y: 24, w: 55, h: 28, rx: 6, fill: "brand" },
    { kind: "text", x: 47, y: 38, size: 5.5, fill: "white", content: "читающий", bold: true, anchor: "middle" },
    { kind: "text", x: 47, y: 48, size: 4.5, fill: "accentLight", content: "adjetivo", anchor: "middle" },
    { kind: "rect", x: 85, y: 24, w: 55, h: 28, rx: 6, fill: "accent" },
    { kind: "text", x: 112, y: 38, size: 5.5, fill: "white", content: "читая", bold: true, anchor: "middle" },
    { kind: "text", x: 112, y: 48, size: 4.5, fill: "accentLight", content: "adverbio", anchor: "middle" },
  ],

  // Máximo un participio/gerundio por cláusula — evitar la cadena excesiva.
  oneParticipleGerundPerClauseStyleRule: [
    { kind: "circle", cx: 80, cy: 40, r: 24, fill: "brand" },
    { kind: "text", x: 80, y: 46, size: 12, fill: "white", content: "1", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 78, size: 6, fill: "inkSoft", content: "máximo por cláusula", anchor: "middle" },
    { kind: "text", x: 80, y: 92, size: 5, fill: "danger", content: "no calcar la sintaxis del español", anchor: "middle" },
  ],

  // канцелярский стиль: densidad participial extrema, solo en documentos oficiales.
  bureaucraticStyleExtremeParticipialDensityExample: [
    { kind: "rect", x: 14, y: 20, w: 132, h: 40, rx: 6, fill: "muted" },
    { kind: "text", x: 80, y: 34, size: 4.5, fill: "inkSoft", content: "Лицо, обратившееся", anchor: "middle" },
    { kind: "text", x: 80, y: 44, size: 4.5, fill: "inkSoft", content: "с заявлением...", anchor: "middle" },
    { kind: "text", x: 80, y: 55, size: 4, fill: "danger", content: "solo documentos oficiales", anchor: "middle" },
  ],

  // Participio y gerundio se parecen visualmente pero no son intercambiables.
  participleGerundVisualSimilarityWarningRule: [
    { kind: "text", x: 45, y: 40, size: 6, fill: "inkSoft", content: "читающий", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 54, size: 5, fill: "muted", content: "vs.", anchor: "middle" },
    { kind: "text", x: 45, y: 68, size: 6, fill: "inkSoft", content: "читая", bold: true, anchor: "middle" },
    { kind: "path", d: "M85 54 L120 54", stroke: "danger", strokeWidth: 2 },
    { kind: "text", x: 120, y: 40, size: 5.5, fill: "danger", content: "no son", bold: true, anchor: "middle" },
    { kind: "text", x: 120, y: 68, size: 5.5, fill: "danger", content: "intercambiables", bold: true, anchor: "middle" },
  ],

  // Antes de escribir, decidir el registro: conversación / carta / documento oficial.
  registerAppropriateChoiceDecisionRule: [
    { kind: "text", x: 45, y: 26, size: 5, fill: "muted", content: "conversación", anchor: "middle" },
    { kind: "text", x: 45, y: 38, size: 5.5, fill: "brand", content: "→ который", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 58, size: 5, fill: "muted", content: "carta/informe", anchor: "middle" },
    { kind: "text", x: 45, y: 70, size: 5.5, fill: "brand", content: "→ participio (1x)", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 42, size: 5, fill: "muted", content: "documento oficial", anchor: "middle" },
    { kind: "text", x: 118, y: 54, size: 5.5, fill: "brand", content: "→ densidad alta", bold: true, anchor: "middle" },
  ],

  // Equilibrio entre naturalidad y formalidad — el error opuesto al de b2-5.
  styleNaturalnessVsFormalityBalanceRule: [
    { kind: "circle", cx: 45, cy: 44, r: 22, fill: "muted" },
    { kind: "text", x: 45, y: 41, size: 5, fill: "inkSoft", content: "demasiado", anchor: "middle" },
    { kind: "text", x: 45, y: 51, size: 5, fill: "inkSoft", content: "coloquial", anchor: "middle" },
    { kind: "circle", cx: 80, cy: 44, r: 20, fill: "brand" },
    { kind: "text", x: 80, y: 48, size: 5.5, fill: "white", content: "equilibrio", bold: true, anchor: "middle" },
    { kind: "circle", cx: 115, cy: 44, r: 22, fill: "muted" },
    { kind: "text", x: 115, y: 41, size: 5, fill: "inkSoft", content: "demasiado", anchor: "middle" },
    { kind: "text", x: 115, y: 51, size: 5, fill: "inkSoft", content: "burocrático", anchor: "middle" },
  ],

  // Repaso: participio solo si который es sujeto de su oración (b1-26/b2-9).
  participleObligatorySubjectOnlyBridgeReviewB126B29: [
    { kind: "circle", cx: 45, cy: 44, r: 22, fill: "brand" },
    { kind: "text", x: 45, y: 41, size: 5, fill: "white", content: "который =", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 51, size: 5, fill: "white", content: "sujeto", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 44, size: 6, fill: "inkSoft", content: "✓", bold: true, anchor: "middle" },
    { kind: "circle", cx: 115, cy: 44, r: 22, fill: "muted" },
    { kind: "text", x: 115, y: 41, size: 5, fill: "inkSoft", content: "otros casos", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 51, size: 5, fill: "inkSoft", content: "(dat/instr/prep)", anchor: "middle" },
    { kind: "text", x: 80, y: 82, size: 5.5, fill: "danger", content: "solo который, sin alternativa", anchor: "middle" },
  ],

  // Cuando ambos son posibles: elección de estilo, no de gramática.
  participleVsKotoryBothPossibleStylisticChoiceRule: [
    { kind: "rect", x: 20, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 46, y: 41, size: 5.5, fill: "white", content: "который", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 58, size: 4.5, fill: "muted", content: "correcto", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 114, y: 41, size: 5, fill: "white", content: "participio", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 58, size: 4.5, fill: "muted", content: "también correcto", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 5.5, fill: "inkSoft", content: "elige según el estilo", anchor: "middle" },
  ],

  // Razón 1: evitar la tautología de repetir который varias veces.
  multipleKotoryClausesSentenceOverloadExample: [
    { kind: "text", x: 80, y: 26, size: 5.5, fill: "danger", content: "который... и который...", bold: true, anchor: "middle" },
    { kind: "path", d: "M40 38 L120 38", stroke: "muted", strokeWidth: 1.5 },
    { kind: "text", x: 80, y: 54, size: 5.5, fill: "brand", content: "который... и leyendo", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 5, fill: "brand", content: "(participio)", anchor: "middle" },
    { kind: "text", x: 80, y: 86, size: 5.5, fill: "inkSoft", content: "evita la tautología", anchor: "middle" },
  ],

  // Razón 2: compacidad — participio pegado al sustantivo vs. cláusula completa.
  participleCompactAdjacentPositionVsKotoryClauseRule: [
    { kind: "text", x: 45, y: 38, size: 5.5, fill: "brand", content: "растущая экономика", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 50, size: 4.5, fill: "muted", content: "compacto", anchor: "middle" },
    { kind: "text", x: 118, y: 38, size: 5, fill: "inkSoft", content: "экономика, которая", anchor: "middle" },
    { kind: "text", x: 118, y: 48, size: 5, fill: "inkSoft", content: "растёт", anchor: "middle" },
    { kind: "text", x: 118, y: 60, size: 4.5, fill: "muted", content: "más largo", anchor: "middle" },
  ],

  // Razón 3: который puede ser ambiguo con varios sustantivos candidatos.
  kotoryAmbiguousAttachmentMultipleAntecedentsWarning: [
    { kind: "text", x: 80, y: 30, size: 5, fill: "inkSoft", content: "Директор компании, которая...", anchor: "middle" },
    { kind: "text", x: 45, y: 50, size: 5.5, fill: "danger", content: "¿директор?", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 62, size: 6, fill: "danger", content: "?", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 50, size: 5.5, fill: "danger", content: "¿компания?", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 62, size: 6, fill: "danger", content: "?", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 84, size: 5.5, fill: "inkSoft", content: "ambigüedad de antecedente", anchor: "middle" },
  ],

  // El participio adyacente elimina la ambigüedad de antecedente.
  kotoryVsParticipleDecisionFlowchartRule: [
    { kind: "text", x: 80, y: 30, size: 5, fill: "inkSoft", content: "Директор,", anchor: "middle" },
    { kind: "rect", x: 30, y: 38, w: 100, h: 22, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 52, size: 5, fill: "white", content: "работающий в компании", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 5.5, fill: "brand", content: "✓ sin ambigüedad", bold: true, anchor: "middle" },
  ],

  // Participios coordinados: varias cualidades del mismo sujeto sin repetir который.
  participleEnumerationListCompactStyleExample: [
    { kind: "rect", x: 16, y: 30, w: 60, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 46, y: 44, size: 4.5, fill: "white", content: "сидящий у окна", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 44, size: 6, fill: "inkSoft", content: "+", anchor: "middle" },
    { kind: "rect", x: 84, y: 30, w: 60, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 114, y: 44, size: 4.5, fill: "white", content: "читающий книгу", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 5.5, fill: "inkSoft", content: "un solo sujeto, dos participios", anchor: "middle" },
  ],

  // который sigue siendo natural con una sola cláusula corta, sin riesgo de ambigüedad.
  kotoryPreferredWhenClarityOverCompactnessRule: [
    { kind: "rect", x: 20, y: 30, w: 120, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 80, y: 46, size: 5.5, fill: "white", content: "которая растёт", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 5.5, fill: "inkSoft", content: "natural, fácil de improvisar", anchor: "middle" },
  ],

  // Repaso: participio pasivo corto y agente instrumental (b1-20).
  passiveShortParticipleFormationBridgeReviewB120: [
    { kind: "rect", x: 20, y: 24, w: 55, h: 28, rx: 6, fill: "muted" },
    { kind: "text", x: 47, y: 38, size: 5.5, fill: "inkSoft", content: "написан", bold: true, anchor: "middle" },
    { kind: "text", x: 47, y: 48, size: 4.5, fill: "muted", content: "b1-20", anchor: "middle" },
    { kind: "rect", x: 85, y: 24, w: 55, h: 28, rx: 6, fill: "brand" },
    { kind: "text", x: 112, y: 38, size: 5, fill: "white", content: "автором", bold: true, anchor: "middle" },
    { kind: "text", x: 112, y: 48, size: 4.5, fill: "accentLight", content: "instrumental", anchor: "middle" },
  ],

  // El paradigma completo: был/(Ø)/будет + participio corto.
  passiveShortParticipleTenseParadigmWasWillBeTable: [
    { kind: "text", x: 30, y: 30, size: 5, fill: "muted", content: "pasado", anchor: "middle" },
    { kind: "text", x: 30, y: 42, size: 5.5, fill: "brand", content: "был подписан", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 30, size: 5, fill: "muted", content: "presente", anchor: "middle" },
    { kind: "text", x: 80, y: 42, size: 5.5, fill: "brand", content: "подписан", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 30, size: 5, fill: "muted", content: "futuro", anchor: "middle" },
    { kind: "text", x: 130, y: 42, size: 5.2, fill: "brand", content: "будет подписан", bold: true, anchor: "middle" },
    { kind: "path", d: "M14 54 L146 54", stroke: "muted", strokeWidth: 1.5 },
    { kind: "text", x: 80, y: 68, size: 5.5, fill: "inkSoft", content: "mismo copulativo que cualquier predicado", anchor: "middle" },
  ],

  // Por qué domina la pasiva en el registro oficial: foco en el hecho, no en el agente.
  formalRegisterPassivePreferenceOverActiveRule: [
    { kind: "rect", x: 18, y: 24, w: 58, h: 26, rx: 6, fill: "muted" },
    { kind: "text", x: 47, y: 36, size: 4.5, fill: "inkSoft", content: "Дума приняла", anchor: "middle" },
    { kind: "text", x: 47, y: 46, size: 4.5, fill: "inkSoft", content: "закон", anchor: "middle" },
    { kind: "rect", x: 84, y: 24, w: 58, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 113, y: 36, size: 4.5, fill: "white", content: "Закон принят", bold: true, anchor: "middle" },
    { kind: "text", x: 113, y: 46, size: 4.5, fill: "accentLight", content: "Думой", anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 5.5, fill: "inkSoft", content: "foco en el resultado, no en el agente", anchor: "middle" },
  ],

  // Avisos oficiales sin agente: lo importante es la norma.
  passiveWithoutAgentOfficialNoticeRule: [
    { kind: "rect", x: 30, y: 26, w: 100, h: 30, rx: 6, fill: "danger" },
    { kind: "text", x: 80, y: 44, size: 6.5, fill: "white", content: "Вход запрещён", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 5.5, fill: "inkSoft", content: "sin agente — irrelevante quién prohíbe", anchor: "middle" },
  ],

  // Fórmulas fijas de noticias/leyes: избран, принят единогласно, введён в действие.
  newsLegalNoticeFormulaicPassiveExamplesTable: [
    { kind: "rect", x: 20, y: 18, w: 120, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 80, y: 31, size: 5, fill: "white", content: "избран большинством голосов", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 42, w: 120, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 55, size: 5, fill: "white", content: "принят единогласно", bold: true, anchor: "middle" },
    { kind: "rect", x: 20, y: 66, w: 120, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 80, y: 79, size: 5, fill: "ink", content: "введён в действие", bold: true, anchor: "middle" },
  ],

  // Repaso: paralelo estructural con los adjetivos cortos (b2-8).
  shortAdjectiveShortParticipleParallelBridgeReviewB28: [
    { kind: "rect", x: 20, y: 26, w: 55, h: 26, rx: 6, fill: "muted" },
    { kind: "text", x: 47, y: 40, size: 5.5, fill: "inkSoft", content: "готов", bold: true, anchor: "middle" },
    { kind: "text", x: 47, y: 50, size: 4.2, fill: "muted", content: "adjetivo (b2-8)", anchor: "middle" },
    { kind: "rect", x: 85, y: 26, w: 55, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 112, y: 40, size: 5.5, fill: "white", content: "принят", bold: true, anchor: "middle" },
    { kind: "text", x: 112, y: 50, size: 4.2, fill: "accentLight", content: "participio", anchor: "middle" },
  ],

  // Repaso: forma larga (cualidad/descripción) vs. corta (estado resultante) — b1-20.
  longVsShortParticipleDescriptionVsResultBridgeReviewB120: [
    { kind: "rect", x: 20, y: 26, w: 55, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 47, y: 38, size: 4.5, fill: "white", content: "закрытый", bold: true, anchor: "middle" },
    { kind: "text", x: 47, y: 48, size: 4.2, fill: "accentLight", content: "descripción", anchor: "middle" },
    { kind: "rect", x: 85, y: 26, w: 55, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 112, y: 38, size: 5, fill: "white", content: "закрыт", bold: true, anchor: "middle" },
    { kind: "text", x: 112, y: 48, size: 4.2, fill: "accentLight", content: "resultado", anchor: "middle" },
  ],

  // Repaso: потому что vs. так как — el fronting rule ya visto en b1-1.
  causalConnectorsBridgeReviewB11PotomuChtoTakKak: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 41, size: 5, fill: "inkSoft", content: "потому что", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 58, size: 4.5, fill: "muted", content: "nunca al inicio", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 41, size: 5, fill: "white", content: "так как", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 58, size: 4.5, fill: "muted", content: "puede ir al inicio", anchor: "middle" },
  ],

  // поскольку: la tercera conjunción, la más formal de las tres.
  poskolkuMostFormalThirdCausalConnectorRule: [
    { kind: "rect", x: 30, y: 26, w: 100, h: 30, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 44, size: 6.5, fill: "white", content: "поскольку", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 5.5, fill: "inkSoft", content: "textos científicos y ensayos", anchor: "middle" },
  ],

  // Escala de formalidad: потому что → так как → поскольку.
  causalConnectorFormalityLadderTable: [
    { kind: "rect", x: 16, y: 34, w: 38, h: 20, rx: 5, fill: "muted" },
    { kind: "text", x: 35, y: 47, size: 4.5, fill: "inkSoft", content: "потому что", anchor: "middle" },
    { kind: "rect", x: 61, y: 26, w: 38, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 80, y: 39, size: 4.5, fill: "ink", content: "так как", anchor: "middle" },
    { kind: "rect", x: 106, y: 18, w: 38, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 125, y: 31, size: 4.2, fill: "white", content: "поскольку", anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 5.5, fill: "inkSoft", content: "coloquial → semi-formal → formal", anchor: "middle" },
  ],

  // La coma: en medio (antes de la conjunción) vs. encabezando (antes de la consecuencia).
  causalCommaPlacementFrontedVsMedialRule: [
    { kind: "text", x: 40, y: 30, size: 4.8, fill: "inkSoft", content: "X, потому что Y", anchor: "middle" },
    { kind: "text", x: 40, y: 42, size: 4.2, fill: "muted", content: "coma antes de la conj.", anchor: "middle" },
    { kind: "text", x: 118, y: 30, size: 4.8, fill: "inkSoft", content: "Так как Y, X", anchor: "middle" },
    { kind: "text", x: 118, y: 42, size: 4.2, fill: "muted", content: "coma antes de X", anchor: "middle" },
  ],

  // ведь como conector causal informal — recordatorio implícito.
  vedCausalReminderColloquialNuanceRule: [
    { kind: "circle", cx: 80, cy: 40, r: 24, fill: "brand" },
    { kind: "text", x: 80, y: 44, size: 8, fill: "white", content: "ведь", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 5.5, fill: "inkSoft", content: "recordatorio causal implícito", anchor: "middle" },
  ],

  // Vocabulario del razonamiento: причина, следствие, вывод.
  causalReasoningVocabularyTable: [
    { kind: "rect", x: 16, y: 20, w: 40, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 36, y: 33, size: 4.5, fill: "white", content: "причина", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 20, w: 40, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 33, size: 4.2, fill: "white", content: "следствие", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 20, w: 40, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 33, size: 4.5, fill: "ink", content: "вывод", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 5.5, fill: "inkSoft", content: "causa → consecuencia → conclusión", anchor: "middle" },
  ],

  // Adelanto de b2-16: construcciones causales aún más formales.
  formalCausalConstructionsPreviewBridgeB216: [
    { kind: "text", x: 80, y: 26, size: 4.5, fill: "inkSoft", content: "в связи с тем что", anchor: "middle" },
    { kind: "text", x: 80, y: 40, size: 4.5, fill: "inkSoft", content: "из-за того что", anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4.5, fill: "inkSoft", content: "благодаря тому что", anchor: "middle" },
    { kind: "text", x: 80, y: 74, size: 5, fill: "muted", content: "profundización en b2-16", anchor: "middle" },
  ],

  // Repaso: хотя vs. несмотря на то что — el contraste de registro ya visto en b1-1.
  concessiveBridgeReviewB11XotyaNesmotryaNaToChto: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 41, size: 5.5, fill: "inkSoft", content: "хотя", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 58, size: 4.2, fill: "muted", content: "neutro/coloquial", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 41, size: 4.5, fill: "white", content: "несмотря на то что", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 58, size: 4.2, fill: "muted", content: "formal/escrito", anchor: "middle" },
  ],

  // Sustantivo (acusativo) vs. oración completa: несмотря на / несмотря на то что.
  nesmotryaNaAccusativeVsNesmotryaNaToChtoClauseRule: [
    { kind: "rect", x: 16, y: 24, w: 60, h: 28, rx: 6, fill: "brand" },
    { kind: "text", x: 46, y: 38, size: 4.5, fill: "white", content: "несмотря на", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 47, size: 4, fill: "accentLight", content: "+ acusativo", anchor: "middle" },
    { kind: "text", x: 46, y: 56, size: 3.8, fill: "accentLight", content: "дождь", anchor: "middle" },
    { kind: "rect", x: 84, y: 24, w: 60, h: 28, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 38, size: 4, fill: "white", content: "несмотря на то что", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 47, size: 4, fill: "white", content: "+ oración", anchor: "middle" },
    { kind: "text", x: 114, y: 56, size: 3.8, fill: "white", content: "шёл дождь", anchor: "middle" },
  ],

  // вопреки/наперекор + dativo vs. несмотря на/невзирая на + acusativo.
  vaprekiDativeVsNesmotryaNaAccusativeContrastTable: [
    { kind: "rect", x: 16, y: 20, w: 60, h: 22, rx: 5, fill: "muted" },
    { kind: "text", x: 46, y: 34, size: 4.5, fill: "inkSoft", content: "несмотря на", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 42, size: 4, fill: "muted", content: "+ acusativo", anchor: "middle" },
    { kind: "rect", x: 84, y: 20, w: 60, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 114, y: 34, size: 4.5, fill: "white", content: "вопреки", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 42, size: 4, fill: "accentLight", content: "+ dativo", anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 4.2, fill: "inkSoft", content: "вопреки: en contra de una expectativa", anchor: "middle" },
  ],

  // La coma: en medio (antes de la conj.) vs. encabezando (antes de la consecuencia).
  concessiveCommaPlacementFrontedVsMedialRule: [
    { kind: "text", x: 40, y: 30, size: 4.8, fill: "inkSoft", content: "X, хотя Y", anchor: "middle" },
    { kind: "text", x: 40, y: 42, size: 4.2, fill: "muted", content: "coma antes de la conj.", anchor: "middle" },
    { kind: "text", x: 118, y: 30, size: 4.2, fill: "inkSoft", content: "Несмотря на то что Y, X", anchor: "middle" },
    { kind: "text", x: 118, y: 42, size: 4.2, fill: "muted", content: "coma antes de X", anchor: "middle" },
  ],

  // Expresiones concesivas reforzadas de registro formal/literario.
  advancedConcessiveExpressionsTable: [
    { kind: "rect", x: 12, y: 18, w: 42, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 33, y: 30, size: 3.8, fill: "white", content: "несмотря ни на что", bold: true, anchor: "middle" },
    { kind: "rect", x: 59, y: 18, w: 42, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 30, size: 3.8, fill: "white", content: "как бы то ни было", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 18, w: 42, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 127, y: 30, size: 3.8, fill: "ink", content: "при всём том", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 5, fill: "inkSoft", content: "registro formal / literario", anchor: "middle" },
  ],

  // даже если (hipotético) vs. хотя (hecho real).
  dazheEsliHypotheticalVsXotyaFactualConcessionRule: [
    { kind: "circle", cx: 46, cy: 42, r: 26, fill: "muted" },
    { kind: "text", x: 46, y: 40, size: 5, fill: "inkSoft", content: "хотя", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 50, size: 3.6, fill: "muted", content: "hecho real", anchor: "middle" },
    { kind: "circle", cx: 114, cy: 42, r: 26, fill: "accent" },
    { kind: "text", x: 114, y: 40, size: 4.5, fill: "white", content: "даже если", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 50, size: 3.6, fill: "accentLight", content: "hipótesis", anchor: "middle" },
  ],

  // Vocabulario conector: тем не менее, всё же, преодолеть, препятствие.
  concessiveConnectorVocabularyTable: [
    { kind: "rect", x: 16, y: 20, w: 40, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 36, y: 33, size: 4, fill: "white", content: "тем не менее", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 20, w: 40, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 33, size: 4.5, fill: "white", content: "всё же", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 20, w: 40, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 33, size: 4.2, fill: "ink", content: "преодолеть", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 5, fill: "inkSoft", content: "obstáculo → conexión → superación", anchor: "middle" },
  ],

  // Repaso: b2-6 (preposición+sustantivo) vs. la estructura completa de b2-16.
  causalPrepositionVsClauseStructuralSplitBridgeReviewB26B214: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 39, size: 4, fill: "inkSoft", content: "из-за + sust.", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 48, size: 3.8, fill: "muted", content: "b2-6", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 39, size: 3.8, fill: "white", content: "из-за того что + oración", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 48, size: 3.8, fill: "accentLight", content: "b2-16", anchor: "middle" },
  ],

  // Tabla de las 4 estructuras: forma de "то" según el caso regido.
  blagodarjaTomuChtoDativeVsIzZaTogoChtoGenitiveStructureTable: [
    { kind: "rect", x: 10, y: 16, w: 34, h: 18, rx: 4, fill: "brand" },
    { kind: "text", x: 27, y: 27, size: 3.5, fill: "white", content: "благодаря тому", bold: true, anchor: "middle" },
    { kind: "rect", x: 52, y: 16, w: 34, h: 18, rx: 4, fill: "accent" },
    { kind: "text", x: 69, y: 27, size: 3.5, fill: "white", content: "из-за того", bold: true, anchor: "middle" },
    { kind: "rect", x: 94, y: 16, w: 56, h: 18, rx: 4, fill: "accentLight" },
    { kind: "text", x: 122, y: 27, size: 3.5, fill: "ink", content: "в связи с тем", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 52, size: 4.2, fill: "inkSoft", content: "тому (dat) / того (gen) / тем (instr)", anchor: "middle" },
  ],

  // Escala de connotación: благодаря (+) / по причине-в связи с (neutro) / из-за (-).
  causalConnotationLadderPositiveNeutralNegativeTable: [
    { kind: "rect", x: 14, y: 24, w: 42, h: 22, rx: 5, fill: "brand" },
    { kind: "text", x: 35, y: 38, size: 4, fill: "white", content: "благодаря", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 24, w: 42, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 81, y: 38, size: 3.6, fill: "ink", content: "по причине", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 24, w: 42, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 127, y: 38, size: 4, fill: "white", content: "из-за", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 5, fill: "inkSoft", content: "positivo → neutro → negativo", anchor: "middle" },
  ],

  // El uso irónico de благодаря con una causa negativa.
  blagodarjaIronicNegativeCauseRule: [
    { kind: "circle", cx: 80, cy: 40, r: 24, fill: "accent" },
    { kind: "text", x: 80, y: 38, size: 5.5, fill: "white", content: "благодаря", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 48, size: 3.6, fill: "accentLight", content: "+ болезни?", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 5, fill: "inkSoft", content: "irónico salvo intención deliberada", anchor: "middle" },
  ],

  // Verbos causales sin conjunción.
  causalVerbsVyzvatPrivestiKObuslovitSpravotsirovatTable: [
    { kind: "rect", x: 10, y: 18, w: 34, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 27, y: 30, size: 3.8, fill: "inkSoft", content: "вызвать", bold: true, anchor: "middle" },
    { kind: "rect", x: 48, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 65, y: 30, size: 3.2, fill: "ink", content: "привести к", bold: true, anchor: "middle" },
    { kind: "rect", x: 86, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 103, y: 30, size: 3.2, fill: "white", content: "обусловить", bold: true, anchor: "middle" },
    { kind: "rect", x: 124, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 141, y: 30, size: 2.8, fill: "white", content: "спровоцировать", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4.5, fill: "inkSoft", content: "sin conjunción, registro analítico", anchor: "middle" },
  ],

  // La coma: en medio vs. al encabezar (misma lógica que b2-14/b2-15).
  causalClauseCommaPlacementMedialVsFrontedRule: [
    { kind: "text", x: 40, y: 30, size: 4.5, fill: "inkSoft", content: "X, благодаря Y", anchor: "middle" },
    { kind: "text", x: 40, y: 42, size: 4, fill: "muted", content: "coma antes de la prep.", anchor: "middle" },
    { kind: "text", x: 118, y: 30, size: 4, fill: "inkSoft", content: "Из-за того что Y, X", anchor: "middle" },
    { kind: "text", x: 118, y: 42, size: 4, fill: "muted", content: "coma antes de X", anchor: "middle" },
  ],

  // Vocabulario ampliado: связь, основание, по вине, побочный эффект.
  causalReasoningExtendedVocabularyTable: [
    { kind: "rect", x: 16, y: 20, w: 34, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 33, y: 33, size: 3.8, fill: "white", content: "связь", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 20, w: 34, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 73, y: 33, size: 3.4, fill: "white", content: "основание", bold: true, anchor: "middle" },
    { kind: "rect", x: 96, y: 20, w: 34, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 113, y: 33, size: 3.6, fill: "ink", content: "по вине", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4.5, fill: "inkSoft", content: "vocabulario ampliado de causa y motivo", anchor: "middle" },
  ],

  // Repaso b1-24: mismo sujeto → infinitivo, sujeto distinto → pasado.
  chtobySameSubjectInfinitiveDifferentSubjectPastBridgeReviewB124: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 39, size: 4, fill: "inkSoft", content: "mismo sujeto", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 48, size: 3.8, fill: "muted", content: "чтобы + infinitivo", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 39, size: 4, fill: "white", content: "sujeto distinto", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 48, size: 3.6, fill: "accentLight", content: "чтобы + pasado", anchor: "middle" },
  ],

  // чтобы como adjunto de finalidad (nuevo) vs. complemento de verbo de deseo (b1-24).
  chtobyPurposeAdverbialVsB124ReportedWishComplementRule: [
    { kind: "rect", x: 16, y: 20, w: 62, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 47, y: 32, size: 3.6, fill: "white", content: "хотеть, чтобы...", bold: true, anchor: "middle" },
    { kind: "text", x: 47, y: 41, size: 3.4, fill: "accentLight", content: "b1-24: complemento", anchor: "middle" },
    { kind: "rect", x: 84, y: 20, w: 62, h: 26, rx: 6, fill: "accentLight" },
    { kind: "text", x: 115, y: 32, size: 3.6, fill: "ink", content: "закрыл окно, чтобы...", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 41, size: 3.4, fill: "ink", content: "b2-17: finalidad", anchor: "middle" },
  ],

  // для того чтобы: variante formal/enfática, preferida al encabezar.
  dljaTogoChtobyFormalEmphasisFrontingRule: [
    { kind: "rect", x: 30, y: 26, w: 100, h: 30, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 42, size: 5.5, fill: "white", content: "для того чтобы", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 5, fill: "inkSoft", content: "encabeza la oración, registro escrito", anchor: "middle" },
  ],

  // так что: consecuencia sin forma verbal obligatoria.
  takChtoConsequenceNoObligatoryFormRule: [
    { kind: "circle", cx: 80, cy: 40, r: 24, fill: "accent" },
    { kind: "text", x: 80, y: 38, size: 6, fill: "white", content: "так что", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 48, size: 3.4, fill: "accentLight", content: "sin forma obligatoria", anchor: "middle" },
    { kind: "text", x: 80, y: 76, size: 4.5, fill: "inkSoft", content: "el verbo mantiene su forma normal", anchor: "middle" },
  ],

  // finalidad (chтобы, ¿para qué?) vs. consecuencia (так что, ¿con qué resultado?).
  purposeVsConsequenceSameSituationContrastTable: [
    { kind: "rect", x: 16, y: 24, w: 60, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 46, y: 36, size: 4, fill: "white", content: "чтобы", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 45, size: 3.6, fill: "accentLight", content: "¿para qué?", anchor: "middle" },
    { kind: "rect", x: 84, y: 24, w: 60, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 36, size: 4, fill: "white", content: "так что", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 45, size: 3.6, fill: "accentLight", content: "¿con qué resultado?", anchor: "middle" },
  ],

  // Registro formal: с целью, во избежание, в результате чего, вследствие этого.
  formalPurposeConsequenceRegisterVocabularyTable: [
    { kind: "rect", x: 12, y: 18, w: 40, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 32, y: 30, size: 3.6, fill: "white", content: "с целью", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 18, w: 44, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 30, size: 3.2, fill: "white", content: "во избежание", bold: true, anchor: "middle" },
    { kind: "rect", x: 108, y: 18, w: 40, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 128, y: 30, size: 3.2, fill: "ink", content: "вследствие", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4.5, fill: "inkSoft", content: "registro oficial / informes", anchor: "middle" },
  ],

  // Vocabulario de metas: цель, достичь, добиться, результат.
  goalAchievementVocabularyTable: [
    { kind: "rect", x: 16, y: 20, w: 34, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 33, y: 33, size: 4, fill: "white", content: "цель", bold: true, anchor: "middle" },
    { kind: "rect", x: 56, y: 20, w: 34, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 73, y: 33, size: 3.5, fill: "white", content: "достичь", bold: true, anchor: "middle" },
    { kind: "rect", x: 96, y: 20, w: 34, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 113, y: 33, size: 3.4, fill: "ink", content: "результат", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4.5, fill: "inkSoft", content: "objetivo → esfuerzo → resultado", anchor: "middle" },
  ],

  // Repaso b1-14: переносное значение (figurado) vs. буквальное значение (literal).
  motionVerbFigurativeBridgeReviewB114LiteralVsFigurativeMeaning: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 41, size: 4, fill: "inkSoft", content: "буквальное", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 50, size: 3.4, fill: "muted", content: "войти в дом", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 41, size: 4, fill: "white", content: "переносное", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 50, size: 3.4, fill: "accentLight", content: "войти в моду", anchor: "middle" },
  ],

  // дойти до + genitivo: alcanzar un extremo.
  doytiDoGenitiveReachingExtremeLimitTable: [
    { kind: "rect", x: 12, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 29, y: 30, size: 3.6, fill: "white", content: "сути", bold: true, anchor: "middle" },
    { kind: "rect", x: 50, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 67, y: 30, size: 3.6, fill: "white", content: "слёз", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 105, y: 30, size: 3.2, fill: "ink", content: "предела", bold: true, anchor: "middle" },
    { kind: "rect", x: 126, y: 18, w: 30, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 141, y: 30, size: 3, fill: "inkSoft", content: "абсурда", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4.5, fill: "inkSoft", content: "дойти до + genitivo", anchor: "middle" },
  ],

  // выйти из + genitivo: abandonar un estado.
  vyitiIzGenitiveAbandoningStateTable: [
    { kind: "rect", x: 16, y: 20, w: 40, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 36, y: 33, size: 3.6, fill: "white", content: "себя", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 20, w: 40, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 33, size: 3.2, fill: "white", content: "положения", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 20, w: 40, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 33, size: 3.4, fill: "ink", content: "строя", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4.2, fill: "inkSoft", content: "excepción: выйти замуж", anchor: "middle" },
  ],

  // перейти: tres estructuras según el matiz.
  pereytiThreeCaseStructuresVariationRule: [
    { kind: "text", x: 40, y: 26, size: 4, fill: "inkSoft", content: "перейти границы", anchor: "middle" },
    { kind: "text", x: 40, y: 36, size: 3.4, fill: "muted", content: "+ acusativo", anchor: "middle" },
    { kind: "text", x: 118, y: 26, size: 4, fill: "inkSoft", content: "перейти к делу", anchor: "middle" },
    { kind: "text", x: 118, y: 36, size: 3.4, fill: "muted", content: "+ к + dativo", anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 4, fill: "inkSoft", content: "перейти на «ты»: + на + acusativo", anchor: "middle" },
  ],

  // зайти в + acusativo: adentrarse sin salida.
  zaytiVAcusativeEnteringDeadEndRule: [
    { kind: "circle", cx: 80, cy: 40, r: 26, fill: "accent" },
    { kind: "text", x: 80, y: 38, size: 5, fill: "white", content: "зайти в", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 48, size: 3.4, fill: "accentLight", content: "тупик", anchor: "middle" },
    { kind: "text", x: 80, y: 78, size: 4.5, fill: "inkSoft", content: "sin salida clara", anchor: "middle" },
  ],

  // Patrón semántico: до-/вы-/пере-/за-.
  prefixSemanticPatternDoVyPereZaSummaryTable: [
    { kind: "rect", x: 12, y: 18, w: 34, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 29, y: 30, size: 4, fill: "white", content: "до-", bold: true, anchor: "middle" },
    { kind: "rect", x: 50, y: 18, w: 34, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 67, y: 30, size: 4, fill: "white", content: "вы-", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 18, w: 34, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 105, y: 30, size: 4, fill: "ink", content: "пере-", bold: true, anchor: "middle" },
    { kind: "rect", x: 126, y: 18, w: 30, h: 20, rx: 5, fill: "muted" },
    { kind: "text", x: 141, y: 30, size: 4, fill: "inkSoft", content: "за-", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "extremo / abandono / cruce / sin salida", anchor: "middle" },
  ],

  // Vocabulario ampliado y metalenguaje (переносное/буквальное значение).
  figurativeIdiomExtendedPracticeVocabularyTable: [
    { kind: "rect", x: 16, y: 20, w: 40, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 36, y: 33, size: 3.4, fill: "white", content: "дойти до слёз", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 20, w: 40, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 33, size: 3.4, fill: "white", content: "перейти на ты", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 20, w: 40, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 33, size: 3.4, fill: "ink", content: "выйти замуж", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4.2, fill: "inkSoft", content: "vocabulario idiomático ampliado", anchor: "middle" },
  ],

  // Repaso b1-14 (войти в моду) y el reparto до-/вы-/пере-/за- (b2-18) vs при-/у-/в-/по- (b2-19).
  figurativeMotionVerbPartTwoBridgeReviewB114B218PrefixSplit: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 39, size: 4, fill: "inkSoft", content: "до-/вы-/пере-/за-", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 48, size: 3.6, fill: "muted", content: "b2-18", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 39, size: 4, fill: "white", content: "при-/у-/в-/по-", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 48, size: 3.6, fill: "accentLight", content: "b2-19", anchor: "middle" },
  ],

  // прийти к + dativo: alcanzar un resultado mental.
  priytiKDativeReachingMentalResultTable: [
    { kind: "rect", x: 16, y: 20, w: 40, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 36, y: 33, size: 3.6, fill: "white", content: "выводу", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 20, w: 40, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 33, size: 3.2, fill: "white", content: "соглашению", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 20, w: 40, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 33, size: 3.6, fill: "ink", content: "власти", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4.5, fill: "inkSoft", content: "прийти к + dativo", anchor: "middle" },
  ],

  // прийти в себя: excepción de preposición dentro de la familia прийти.
  priytiVSebyaExceptionWithinPriytiKFamilyRule: [
    { kind: "circle", cx: 80, cy: 40, r: 26, fill: "accent" },
    { kind: "text", x: 80, y: 38, size: 5, fill: "white", content: "прийти в себя", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 48, size: 3.2, fill: "accentLight", content: "в + acusativo", anchor: "middle" },
    { kind: "text", x: 80, y: 78, size: 4.2, fill: "inkSoft", content: "excepción: no к + dativo", anchor: "middle" },
  ],

  // уйти от + genitivo: eludir algo.
  uytiOtGenitiveEvadingResponsibilityTable: [
    { kind: "rect", x: 16, y: 20, w: 40, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 36, y: 33, size: 3.6, fill: "white", content: "ответа", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 20, w: 40, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 33, size: 3.6, fill: "white", content: "темы", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 20, w: 40, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 33, size: 3, fill: "ink", content: "ответственности", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4.2, fill: "inkSoft", content: "excepción: уйти в отставку", anchor: "middle" },
  ],

  // войти в + acusativo: adoptar una condición.
  voytiVAcusativeAdoptingConditionTable: [
    { kind: "rect", x: 12, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 29, y: 30, size: 3.6, fill: "white", content: "моду", bold: true, anchor: "middle" },
    { kind: "rect", x: 50, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 67, y: 30, size: 3.4, fill: "white", content: "историю", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 105, y: 30, size: 2.8, fill: "ink", content: "курс дела", bold: true, anchor: "middle" },
    { kind: "rect", x: 126, y: 18, w: 30, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 141, y: 30, size: 2.8, fill: "inkSoft", content: "привычку", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4.5, fill: "inkSoft", content: "войти в + acusativo", anchor: "middle" },
  ],

  // пойти на + acusativo: aceptar un riesgo o sacrificio.
  poytiNaAcusativeAcceptingRiskSacrificeTable: [
    { kind: "rect", x: 12, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 29, y: 30, size: 3, fill: "white", content: "компромисс", bold: true, anchor: "middle" },
    { kind: "rect", x: 50, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 67, y: 30, size: 3.6, fill: "white", content: "риск", bold: true, anchor: "middle" },
    { kind: "rect", x: 88, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 105, y: 30, size: 3.2, fill: "ink", content: "уступки", bold: true, anchor: "middle" },
    { kind: "rect", x: 126, y: 18, w: 30, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 141, y: 30, size: 3.6, fill: "inkSoft", content: "всё", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4.5, fill: "inkSoft", content: "пойти на + acusativo", anchor: "middle" },
  ],

  // Patrón completo: до-/вы-/пере-/за- (b2-18) + при-/у-/в-/по- (b2-19).
  figurativePrefixPatternPriUVPoSummaryTable: [
    { kind: "rect", x: 10, y: 16, w: 34, h: 18, rx: 4, fill: "brand" },
    { kind: "text", x: 27, y: 27, size: 3.4, fill: "white", content: "при-", bold: true, anchor: "middle" },
    { kind: "rect", x: 48, y: 16, w: 34, h: 18, rx: 4, fill: "accent" },
    { kind: "text", x: 65, y: 27, size: 3.4, fill: "white", content: "у-", bold: true, anchor: "middle" },
    { kind: "rect", x: 86, y: 16, w: 34, h: 18, rx: 4, fill: "accentLight" },
    { kind: "text", x: 103, y: 27, size: 3.4, fill: "ink", content: "в-", bold: true, anchor: "middle" },
    { kind: "rect", x: 124, y: 16, w: 30, h: 18, rx: 4, fill: "muted" },
    { kind: "text", x: 139, y: 27, size: 3.2, fill: "inkSoft", content: "по-", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 52, size: 4, fill: "inkSoft", content: "resultado / evasión / adopción / riesgo", anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 3.6, fill: "muted", content: "(sistema completo junto con до-/вы-/пере-/за-)", anchor: "middle" },
  ],

  // Repaso: выйти замуж (b2-18, excepción) y бежать literal (a2-16).
  motionIdiomBridgeReviewB218VyitiZamuzhA216BezhatLiteral: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 39, size: 3.6, fill: "inkSoft", content: "выйти замуж", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 48, size: 3.2, fill: "muted", content: "b2-18: excepción", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 39, size: 3.8, fill: "white", content: "бежать", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 48, size: 3.2, fill: "accentLight", content: "a2-16: literal", anchor: "middle" },
  ],

  // сходить с ума: от + genitivo (emoción) vs. по + dativo (enamoramiento).
  skhoditSUmaLiteralVsHyperbolicRule: [
    { kind: "circle", cx: 80, cy: 40, r: 26, fill: "brand" },
    { kind: "text", x: 80, y: 36, size: 4.5, fill: "white", content: "сходить с ума", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 47, size: 3.2, fill: "accentLight", content: "от + gen / по + dat", anchor: "middle" },
    { kind: "text", x: 80, y: 78, size: 4.2, fill: "inkSoft", content: "emoción intensa / enamoramiento", anchor: "middle" },
  ],

  // вести себя: el reflexivo себя nunca se omite.
  vestiSebyaReflexiveNeverOmittedRule: [
    { kind: "rect", x: 30, y: 26, w: 100, h: 28, rx: 6, fill: "accent" },
    { kind: "text", x: 80, y: 40, size: 5.5, fill: "white", content: "вести себя", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 50, size: 3.6, fill: "accentLight", content: "+ adverbio (хорошо/плохо/как ребёнок)", anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 4, fill: "inkSoft", content: "себя es obligatorio", anchor: "middle" },
  ],

  // найти общий язык (с + instrumental): literal vs. figurado.
  naytiObshchiyYazykInstrumentalLiteralVsFigurativeRule: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 39, size: 3.4, fill: "inkSoft", content: "idioma compartido", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 48, size: 3.2, fill: "muted", content: "literal", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 39, size: 3.4, fill: "white", content: "entenderse con", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 48, size: 3.2, fill: "accentLight", content: "figurado, + instrumental", anchor: "middle" },
  ],

  // выйти замуж за (+ acc, mujer) vs. жениться на (+ prep, hombre).
  vyitiZamuzhZaVsZhenitsyaNaGenderCaseContrastTable: [
    { kind: "rect", x: 14, y: 22, w: 62, h: 26, rx: 6, fill: "brand" },
    { kind: "text", x: 45, y: 34, size: 3.6, fill: "white", content: "выйти замуж за", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 43, size: 3.2, fill: "accentLight", content: "mujer, + acusativo", anchor: "middle" },
    { kind: "rect", x: 84, y: 22, w: 62, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 115, y: 34, size: 3.8, fill: "white", content: "жениться на", bold: true, anchor: "middle" },
    { kind: "text", x: 115, y: 43, size: 3.2, fill: "accentLight", content: "hombre, + prepositivo", anchor: "middle" },
  ],

  // Vocabulario idiomático I: идти на поводу, идти в ногу, ходить вокруг да около, плыть по течению.
  movementIdiomVocabularyTableOne: [
    { kind: "rect", x: 10, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 27, y: 30, size: 2.8, fill: "white", content: "на поводу у", bold: true, anchor: "middle" },
    { kind: "rect", x: 48, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 65, y: 30, size: 2.6, fill: "white", content: "в ногу со временем", bold: true, anchor: "middle" },
    { kind: "rect", x: 86, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 103, y: 30, size: 2.4, fill: "ink", content: "вокруг да около", bold: true, anchor: "middle" },
    { kind: "rect", x: 124, y: 18, w: 30, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 139, y: 30, size: 2.6, fill: "inkSoft", content: "по течению", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "idiomatismos con идти/ходить/плыть", anchor: "middle" },
  ],

  // Vocabulario idiomático II: держать себя в руках, идти навстречу, бежать от проблем.
  movementIdiomVocabularyTableTwo: [
    { kind: "rect", x: 16, y: 20, w: 40, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 36, y: 33, size: 2.8, fill: "white", content: "в руках", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 20, w: 40, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 33, size: 3, fill: "white", content: "навстречу", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 20, w: 40, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 33, size: 2.8, fill: "ink", content: "от проблем", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4, fill: "inkSoft", content: "держать / идти / бежать", anchor: "middle" },
  ],

  // Repaso: бы + pasado (b2-1) y как бы то ни было (b2-15).
  byNiBridgeReviewB21B215PastTenseAndKakByToNiBylo: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 39, size: 4, fill: "inkSoft", content: "бы + pasado", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 48, size: 3.4, fill: "muted", content: "b2-1", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 39, size: 3.4, fill: "white", content: "как бы то ни было", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 48, size: 3.4, fill: "accentLight", content: "b2-15", anchor: "middle" },
  ],

  // кто/что/как/где/когда бы ни: familia de universalidad.
  interrogativeByNiUniversalityFamilyTable: [
    { kind: "rect", x: 8, y: 18, w: 28, h: 18, rx: 4, fill: "brand" },
    { kind: "text", x: 22, y: 29, size: 3.4, fill: "white", content: "кто", bold: true, anchor: "middle" },
    { kind: "rect", x: 40, y: 18, w: 28, h: 18, rx: 4, fill: "accent" },
    { kind: "text", x: 54, y: 29, size: 3.4, fill: "white", content: "что", bold: true, anchor: "middle" },
    { kind: "rect", x: 72, y: 18, w: 28, h: 18, rx: 4, fill: "accentLight" },
    { kind: "text", x: 86, y: 29, size: 3.4, fill: "ink", content: "как", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 18, w: 28, h: 18, rx: 4, fill: "muted" },
    { kind: "text", x: 118, y: 29, size: 3.4, fill: "inkSoft", content: "где", bold: true, anchor: "middle" },
    { kind: "rect", x: 136, y: 18, w: 20, h: 18, rx: 4, fill: "brand" },
    { kind: "text", x: 146, y: 29, size: 2.8, fill: "white", content: "когда", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 52, size: 4.2, fill: "inkSoft", content: "+ бы ни + pasado", anchor: "middle" },
  ],

  // El verbo siempre en pasado, sin importar el tiempo real (irrealis, repaso b2-1).
  byNiAlwaysPastIrrealisLikeB21Rule: [
    { kind: "circle", cx: 80, cy: 40, r: 26, fill: "accent" },
    { kind: "text", x: 80, y: 38, size: 4.5, fill: "white", content: "бы ни + pasado", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 48, size: 3.2, fill: "accentLight", content: "nunca futuro/presente", anchor: "middle" },
    { kind: "text", x: 80, y: 78, size: 4, fill: "inkSoft", content: "uso irrealis, no tiempo real", anchor: "middle" },
  ],

  // во что бы то ни стало: determinación absoluta.
  voChtoByToNiStaloAbsoluteDeterminationRule: [
    { kind: "rect", x: 22, y: 26, w: 116, h: 30, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 44, size: 5, fill: "white", content: "во что бы то ни стало", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 4.5, fill: "inkSoft", content: "cueste lo que cueste", anchor: "middle" },
  ],

  // как ни странно (sorpresa) vs. что ни говори (afirmación firme).
  kakNiStrannoVsChtoNiGovoriDiscourseContrastRule: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 39, size: 3.6, fill: "inkSoft", content: "как ни странно", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 48, size: 3.2, fill: "muted", content: "sorpresa", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 39, size: 3.6, fill: "white", content: "что ни говори", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 48, size: 3.2, fill: "accentLight", content: "afirmación firme", anchor: "middle" },
  ],

  // Patrón productivo (бы ни) vs. idiomatismo fijo (léxico de b2-5).
  productiveGrammarPatternVsFixedLexicalIdiomB25ContrastTable: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 46, y: 39, size: 3.6, fill: "white", content: "бы ни + interr.", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 48, size: 3.2, fill: "accentLight", content: "patrón productivo", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 114, y: 39, size: 3.4, fill: "inkSoft", content: "léxico de b2-5", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 48, size: 3.2, fill: "muted", content: "idiomatismo fijo", anchor: "middle" },
  ],

  // Ampliación: сколько/какой/чей бы ни.
  byNiExtendedPracticeVocabularyTable: [
    { kind: "rect", x: 14, y: 20, w: 40, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 34, y: 33, size: 3.4, fill: "white", content: "сколько", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 20, w: 40, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 33, size: 3.4, fill: "white", content: "какой", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 20, w: 38, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 125, y: 33, size: 3.4, fill: "ink", content: "чей", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4.2, fill: "inkSoft", content: "el mismo patrón, más interrogativos", anchor: "middle" },
  ],

  // Repaso: канцелярский стиль (b2-11) y participio pasivo corto (b2-13).
  scientificStyleBridgeReviewB111B213KancelyarskyAndShortParticiple: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 39, size: 3.4, fill: "inkSoft", content: "канцелярский стиль", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 48, size: 3.2, fill: "muted", content: "b2-11", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 39, size: 3.4, fill: "white", content: "participio corto", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 48, size: 3.2, fill: "accentLight", content: "b2-13", anchor: "middle" },
  ],

  // -ся (proceso, imperfectivo) vs. participio corto (resultado, perfectivo).
  syaReflexivePassiveHabitualVsShortParticiplePunctualRule: [
    { kind: "circle", cx: 46, cy: 40, r: 24, fill: "brand" },
    { kind: "text", x: 46, y: 38, size: 4.2, fill: "white", content: "исследуется", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 48, size: 3, fill: "accentLight", content: "proceso", anchor: "middle" },
    { kind: "circle", cx: 114, cy: 40, r: 24, fill: "accent" },
    { kind: "text", x: 114, y: 38, size: 4, fill: "white", content: "исследован", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 48, size: 3, fill: "accentLight", content: "resultado", anchor: "middle" },
  ],

  // Formas paralelas -ся / participio corto.
  syaVsShortParticipleExampleFormsTable: [
    { kind: "rect", x: 12, y: 18, w: 68, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 46, y: 30, size: 3.4, fill: "white", content: "анализируются", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 18, w: 64, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 116, y: 30, size: 3.4, fill: "ink", content: "проанализированы", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 52, size: 4, fill: "inkSoft", content: "-ся (proceso) vs. participio (resultado)", anchor: "middle" },
  ],

  // Sustantivos verbales: densidad y objetividad.
  otglagolnyeSushchestvitelnyeVerbalNounDensityRule: [
    { kind: "rect", x: 20, y: 24, w: 50, h: 26, rx: 6, fill: "muted" },
    { kind: "text", x: 45, y: 38, size: 3.6, fill: "inkSoft", content: "мы изучили", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 47, size: 3, fill: "muted", content: "verbo conjugado", anchor: "middle" },
    { kind: "rect", x: 82, y: 24, w: 58, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 111, y: 38, size: 3.6, fill: "white", content: "изучение", bold: true, anchor: "middle" },
    { kind: "text", x: 111, y: 47, size: 3, fill: "accentLight", content: "sustantivo verbal", anchor: "middle" },
  ],

  // Cancelarismos científicos: в соответствии с, на основании, в рамках.
  scientificKancelyarizmyVSootvetstviiNaOsnovaniiVRamkakhTable: [
    { kind: "rect", x: 8, y: 18, w: 46, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 31, y: 30, size: 3, fill: "white", content: "в соответствии с", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 18, w: 44, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 80, y: 30, size: 2.8, fill: "white", content: "на основании", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 18, w: 46, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 129, y: 30, size: 3.2, fill: "ink", content: "в рамках", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "bloques fijos del registro académico", anchor: "middle" },
  ],

  // Evitar «мы»: preferencia por pasiva/impersonal.
  avoidFirstPersonMyPassiveImpersonalPreferenceRule: [
    { kind: "text", x: 80, y: 26, size: 4.5, fill: "muted", content: "Мы проанализировали", anchor: "middle" },
    { kind: "text", x: 80, y: 40, size: 4, fill: "inkSoft", content: "↓", anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4.5, fill: "brand", bold: true, content: "Данные были проанализированы", anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 3.6, fill: "muted", content: "/ Данные анализируются", anchor: "middle" },
  ],

  // Vocabulario de investigación.
  scientificResearchVocabularyTable: [
    { kind: "rect", x: 16, y: 20, w: 40, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 36, y: 33, size: 3.4, fill: "white", content: "гипотеза", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 20, w: 40, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 33, size: 2.8, fill: "white", content: "закономерность", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 20, w: 40, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 33, size: 3.2, fill: "ink", content: "выборка", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4, fill: "inkSoft", content: "vocabulario de investigación científica", anchor: "middle" },
  ],

  // Repaso: registro hablado (b2-7) vs. escrito oficial; aviso de no mezclar b2-5.
  writtenCorrespondenceBridgeReviewB27SpokenVsB25ColloquialWarning: [
    { kind: "rect", x: 18, y: 26, w: 56, h: 24, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 39, size: 3.6, fill: "inkSoft", content: "registro hablado", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 48, size: 3.2, fill: "muted", content: "b2-7", anchor: "middle" },
    { kind: "rect", x: 86, y: 26, w: 56, h: 24, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 39, size: 3.4, fill: "white", content: "correspondencia oficial", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 48, size: 3.2, fill: "accentLight", content: "b2-23", anchor: "middle" },
  ],

  // Estructura fija: saludo -> introducción -> cuerpo -> cierre.
  formalLetterStructureTable: [
    { kind: "rect", x: 8, y: 20, w: 32, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 24, y: 33, size: 3, fill: "white", content: "saludo", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 20, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 61, y: 33, size: 2.6, fill: "white", content: "introducción", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 20, w: 32, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 98, y: 33, size: 3, fill: "ink", content: "cuerpo", bold: true, anchor: "middle" },
    { kind: "rect", x: 118, y: 20, w: 32, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 134, y: 33, size: 3, fill: "inkSoft", content: "cierre", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4, fill: "inkSoft", content: "orden fijo de la carta formal", anchor: "middle" },
  ],

  // Saludo con patronímico obligatorio.
  patronymicSaludoObligatoryRule: [
    { kind: "rect", x: 20, y: 26, w: 120, h: 30, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 44, size: 4.5, fill: "white", content: "Уважаемый Иван Петрович!", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 4, fill: "inkSoft", content: "nombre + patronímico obligatorio", anchor: "middle" },
  ],

  // Fórmulas de introducción.
  introductionFormulasTable: [
    { kind: "rect", x: 10, y: 18, w: 44, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 32, y: 30, size: 2.6, fill: "white", content: "Обращаюсь с просьбой", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 18, w: 44, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 80, y: 30, size: 2.4, fill: "white", content: "В ответ на письмо", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 18, w: 44, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 128, y: 30, size: 2.6, fill: "ink", content: "Настоящим сообщаю", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "fórmulas fijas de apertura", anchor: "middle" },
  ],

  // Solicitar, quejarse y agradecer.
  requestComplaintThanksFormulasTable: [
    { kind: "rect", x: 10, y: 18, w: 44, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 32, y: 30, size: 3, fill: "white", content: "Прошу вас", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 18, w: 44, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 80, y: 30, size: 2.4, fill: "white", content: "Выражаю недовольство", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 18, w: 44, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 128, y: 30, size: 2.4, fill: "ink", content: "Выражаю благодарность", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "solicitud / queja / agradecimiento", anchor: "middle" },
  ],

  // Cierre С уважением, + repaso del participio pasivo corto de b2-13.
  closingFormulaAndB213ShortParticipleBridgeRule: [
    { kind: "rect", x: 30, y: 22, w: 100, h: 24, rx: 6, fill: "brand" },
    { kind: "text", x: 80, y: 38, size: 5, fill: "white", content: "С уважением,", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 3.6, fill: "inkSoft", content: "удовлетворена / отказано (b2-13)", anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 3.4, fill: "muted", content: "participio pasivo corto en respuestas", anchor: "middle" },
  ],

  // Vocabulario de la correspondencia oficial.
  officialCorrespondenceVocabularyTable: [
    { kind: "rect", x: 16, y: 20, w: 40, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 36, y: 33, size: 3.4, fill: "white", content: "заявление", bold: true, anchor: "middle" },
    { kind: "rect", x: 60, y: 20, w: 40, h: 20, rx: 5, fill: "accent" },
    { kind: "text", x: 80, y: 33, size: 3.4, fill: "white", content: "справка", bold: true, anchor: "middle" },
    { kind: "rect", x: 104, y: 20, w: 40, h: 20, rx: 5, fill: "accentLight" },
    { kind: "text", x: 124, y: 33, size: 2.6, fill: "ink", content: "исходящий номер", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4, fill: "inkSoft", content: "vocabulario administrativo oficial", anchor: "middle" },
  ],

  // Repaso: literario (b2-4), atribución (b2-6), compacidad participial (b2-12).
  journalisticStyleBridgeReviewB124B26B212ThreeRegisterContrast: [
    { kind: "rect", x: 8, y: 24, w: 44, h: 22, rx: 5, fill: "muted" },
    { kind: "text", x: 30, y: 37, size: 3, fill: "inkSoft", content: "literario", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 45, size: 2.6, fill: "muted", content: "b2-4", anchor: "middle" },
    { kind: "rect", x: 58, y: 24, w: 44, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 80, y: 37, size: 2.8, fill: "ink", content: "atribución", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 45, size: 2.6, fill: "ink", content: "b2-6", anchor: "middle" },
    { kind: "rect", x: 108, y: 24, w: 44, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 130, y: 37, size: 2.8, fill: "white", content: "compacidad", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 45, size: 2.6, fill: "accentLight", content: "b2-12", anchor: "middle" },
  ],

  // Economía del titular: guion, sustantivo verbal, presente histórico.
  headlineEconomyGuionVerbalNounPresenteHistoricoRule: [
    { kind: "text", x: 80, y: 26, size: 5, fill: "inkSoft", content: "Закон — в силе", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 40, size: 3.6, fill: "muted", content: "быть → —", anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 3.6, fill: "inkSoft", content: "verbo → sustantivo verbal", anchor: "middle" },
    { kind: "text", x: 80, y: 72, size: 3.4, fill: "muted", content: "pasado → presente histórico", anchor: "middle" },
  ],

  // Fórmulas de atribución: по данным / по словам / как сообщает / по информации.
  attributionFormulasTable: [
    { kind: "rect", x: 8, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 25, y: 30, size: 2.8, fill: "white", content: "по данным", bold: true, anchor: "middle" },
    { kind: "rect", x: 46, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 63, y: 30, size: 2.8, fill: "white", content: "по словам", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 101, y: 30, size: 2.4, fill: "ink", content: "как сообщает", bold: true, anchor: "middle" },
    { kind: "rect", x: 122, y: 18, w: 34, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 139, y: 30, size: 2.4, fill: "inkSoft", content: "по информации", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "institución / persona / medio / fuente vaga", anchor: "middle" },
  ],

  // El лид: qué, quién, cuándo, dónde.
  ledFirstParagraphQueQuienCuandoDondeRule: [
    { kind: "circle", cx: 46, cy: 40, r: 20, fill: "brand" },
    { kind: "text", x: 46, y: 44, size: 4.5, fill: "white", content: "qué", bold: true, anchor: "middle" },
    { kind: "circle", cx: 90, cy: 40, r: 20, fill: "accent" },
    { kind: "text", x: 90, y: 44, size: 4, fill: "white", content: "quién", bold: true, anchor: "middle" },
    { kind: "circle", cx: 134, cy: 40, r: 20, fill: "accentLight" },
    { kind: "text", x: 134, y: 44, size: 3.6, fill: "ink", content: "cuándo/dónde", bold: true, anchor: "middle" },
  ],

  // Citas indirectas: repaso de b1-23 con coma obligatoria.
  indirectQuotesNewsCommaBridgeReviewB1Rule: [
    { kind: "text", x: 80, y: 32, size: 5, fill: "inkSoft", content: "заявил, что...", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 48, size: 4, fill: "muted", content: "coma obligatoria", anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 3.6, fill: "muted", content: "repaso de b1-23", anchor: "middle" },
  ],

  // Vocabulario por secciones: política, economía, sociedad, cultura.
  journalisticVocabularyBySectionTable: [
    { kind: "rect", x: 10, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 27, y: 30, size: 2.8, fill: "white", content: "política", bold: true, anchor: "middle" },
    { kind: "rect", x: 48, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 65, y: 30, size: 2.8, fill: "white", content: "economía", bold: true, anchor: "middle" },
    { kind: "rect", x: 86, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 103, y: 30, size: 2.6, fill: "ink", content: "sociedad", bold: true, anchor: "middle" },
    { kind: "rect", x: 124, y: 18, w: 30, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 139, y: 30, size: 2.6, fill: "inkSoft", content: "cultura", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "vocabulario especializado por sección", anchor: "middle" },
  ],

  // Verbos periodísticos: заявить, подчеркнуть, опровергнуть.
  journalisticVerbsZayavitPodcherknutOprovergnutTable: [
    { kind: "rect", x: 10, y: 18, w: 42, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 31, y: 30, size: 3, fill: "white", content: "заявить", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 18, w: 42, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 79, y: 30, size: 2.6, fill: "white", content: "подчеркнуть", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 18, w: 46, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 129, y: 30, size: 2.4, fill: "ink", content: "опровергнуть", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "verbos de declaración y desmentido", anchor: "middle" },
  ],

  // Repaso: b2-5 (coloquial), b2-11 (escala), b2-22 (impersonal/mы).
  registerTransformationBridgeReviewB25B211B222ThreeWayContrast: [
    { kind: "rect", x: 8, y: 24, w: 44, h: 22, rx: 5, fill: "muted" },
    { kind: "text", x: 30, y: 37, size: 2.8, fill: "inkSoft", content: "léxico coloquial", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 45, size: 2.6, fill: "muted", content: "b2-5", anchor: "middle" },
    { kind: "rect", x: 58, y: 24, w: 44, h: 22, rx: 5, fill: "accentLight" },
    { kind: "text", x: 80, y: 37, size: 2.8, fill: "ink", content: "escala de registro", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 45, size: 2.6, fill: "ink", content: "b2-11", anchor: "middle" },
    { kind: "rect", x: 108, y: 24, w: 44, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 130, y: 37, size: 2.8, fill: "white", content: "evitar «мы»", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 45, size: 2.6, fill: "accentLight", content: "b2-22", anchor: "middle" },
  ],

  // Pares léxicos fijos coloquial <-> formal.
  fixedLexicalPairsColloquialFormalTable: [
    { kind: "rect", x: 16, y: 20, w: 46, h: 20, rx: 5, fill: "muted" },
    { kind: "text", x: 39, y: 33, size: 3.4, fill: "inkSoft", content: "помочь", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 30, size: 5, fill: "muted", content: "↔", anchor: "middle" },
    { kind: "rect", x: 98, y: 20, w: 46, h: 20, rx: 5, fill: "brand" },
    { kind: "text", x: 121, y: 33, size: 2.6, fill: "white", content: "оказать помощь", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4, fill: "inkSoft", content: "pares léxicos fijos, en ambas direcciones", anchor: "middle" },
  ],

  // verbo -> sustantivo verbal (repaso b2-22).
  verbToVerbalNounTransformationBridgeReviewB222Rule: [
    { kind: "rect", x: 20, y: 24, w: 50, h: 26, rx: 6, fill: "muted" },
    { kind: "text", x: 45, y: 38, size: 3.6, fill: "inkSoft", content: "мы решили", bold: true, anchor: "middle" },
    { kind: "text", x: 45, y: 47, size: 2.8, fill: "muted", content: "verbo", anchor: "middle" },
    { kind: "rect", x: 82, y: 24, w: 58, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 111, y: 38, size: 3.4, fill: "white", content: "было найдено решение", bold: true, anchor: "middle" },
    { kind: "text", x: 111, y: 47, size: 2.6, fill: "accentLight", content: "sustantivo verbal, b2-22", anchor: "middle" },
  ],

  // который + verbo -> participio (repaso b2-9/b2-11).
  kotoryClauseToParticipleTransformationBridgeReviewB29B211Rule: [
    { kind: "rect", x: 16, y: 24, w: 60, h: 26, rx: 6, fill: "muted" },
    { kind: "text", x: 46, y: 36, size: 2.8, fill: "inkSoft", content: "который работает", bold: true, anchor: "middle" },
    { kind: "text", x: 46, y: 45, size: 2.6, fill: "muted", content: "b2-9", anchor: "middle" },
    { kind: "rect", x: 84, y: 24, w: 60, h: 26, rx: 6, fill: "accent" },
    { kind: "text", x: 114, y: 36, size: 3, fill: "white", content: "работающий", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 45, size: 2.6, fill: "accentLight", content: "b2-11", anchor: "middle" },
  ],

  // Conectores: ну/короче -> таким образом; но -> однако/тем не менее.
  discourseConnectorTransformationBridgeReviewB23B215Table: [
    { kind: "rect", x: 8, y: 18, w: 42, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 29, y: 30, size: 3, fill: "inkSoft", content: "ну/короче", bold: true, anchor: "middle" },
    { kind: "rect", x: 54, y: 18, w: 42, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 75, y: 30, size: 2.6, fill: "white", content: "таким образом", bold: true, anchor: "middle" },
    { kind: "rect", x: 100, y: 18, w: 20, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 110, y: 30, size: 3, fill: "inkSoft", content: "но", bold: true, anchor: "middle" },
    { kind: "rect", x: 124, y: 18, w: 30, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 139, y: 30, size: 2.2, fill: "white", content: "однако", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "repaso de b2-3 y b2-15", anchor: "middle" },
  ],

  // Verbos formales adicionales.
  additionalFormalRegisterVerbsTable: [
    { kind: "rect", x: 10, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 27, y: 30, size: 2.8, fill: "white", content: "предоставить", bold: true, anchor: "middle" },
    { kind: "rect", x: 48, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 65, y: 30, size: 2.8, fill: "white", content: "приобрести", bold: true, anchor: "middle" },
    { kind: "rect", x: 86, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 103, y: 30, size: 3, fill: "ink", content: "выяснить", bold: true, anchor: "middle" },
    { kind: "rect", x: 124, y: 18, w: 30, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 139, y: 30, size: 3, fill: "inkSoft", content: "желать", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "vocabulario formal adicional", anchor: "middle" },
  ],

  // Transformación de frase completa, todos los ejes combinados.
  fullSentenceTransformationPracticeTable: [
    { kind: "text", x: 80, y: 24, size: 3.6, fill: "muted", content: "Короче, у нас проблема.", anchor: "middle" },
    { kind: "text", x: 80, y: 38, size: 4, fill: "inkSoft", content: "↓", anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 3.8, fill: "brand", bold: true, content: "Таким образом, возникло затруднение.", anchor: "middle" },
    { kind: "text", x: 80, y: 70, size: 3.2, fill: "muted", content: "todos los ejes de registro combinados", anchor: "middle" },
  ],

  // Verbos de certeza (b2-3) -> adverbios de certeza (b2-26).
  epistemicCertaintyVsB23DebateVerbsBridgeReview: [
    { kind: "rect", x: 8, y: 24, w: 66, h: 22, rx: 5, fill: "muted" },
    { kind: "text", x: 41, y: 37, size: 2.8, fill: "inkSoft", content: "я уверен, что...", bold: true, anchor: "middle" },
    { kind: "text", x: 41, y: 45, size: 2.6, fill: "muted", content: "verbo, b2-3", anchor: "middle" },
    { kind: "text", x: 80, y: 35, size: 5, fill: "muted", content: "→", anchor: "middle" },
    { kind: "rect", x: 86, y: 24, w: 66, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 119, y: 37, size: 2.8, fill: "white", content: "несомненно", bold: true, anchor: "middle" },
    { kind: "text", x: 119, y: 45, size: 2.6, fill: "accentLight", content: "adverbio, b2-26", anchor: "middle" },
  ],

  // Escala de certeza epistémica.
  epistemicCertaintyScaleTable: [
    { kind: "rect", x: 6, y: 20, w: 28, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 20, y: 32, size: 2.2, fill: "white", content: "несомненно", bold: true, anchor: "middle" },
    { kind: "rect", x: 38, y: 20, w: 28, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 52, y: 32, size: 2.1, fill: "white", content: "скорее всего", bold: true, anchor: "middle" },
    { kind: "rect", x: 70, y: 20, w: 28, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 84, y: 32, size: 2.4, fill: "ink", content: "вероятно", bold: true, anchor: "middle" },
    { kind: "rect", x: 102, y: 20, w: 28, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 116, y: 32, size: 2.2, fill: "inkSoft", content: "вряд ли", bold: true, anchor: "middle" },
    { kind: "rect", x: 134, y: 20, w: 22, h: 20, rx: 4, fill: "muted", opacity: 0.6 },
    { kind: "text", x: 145, y: 32, size: 1.8, fill: "inkSoft", content: "ни в коем случае", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4, fill: "inkSoft", content: "de la certeza absoluta a la negación absoluta", anchor: "middle" },
  ],

  // Construcciones de opinión persuasiva.
  persuasiveOpinionConstructionsTable: [
    { kind: "rect", x: 10, y: 16, w: 140, h: 18, rx: 4, fill: "brand" },
    { kind: "text", x: 80, y: 28, size: 2.8, fill: "white", content: "Я убеждён(а), что...", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 40, w: 140, h: 18, rx: 4, fill: "accent" },
    { kind: "text", x: 80, y: 52, size: 2.8, fill: "white", content: "Я настаиваю на том, что...", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 64, w: 140, h: 18, rx: 4, fill: "accentLight" },
    { kind: "text", x: 80, y: 76, size: 2.6, fill: "ink", content: "Позволю себе заметить, что...", bold: true, anchor: "middle" },
  ],

  // Нельзя не + infinitivo, repaso extendido de b2-3.
  nelzyaNePlusInfinitiveBridgeReviewB23Rule: [
    { kind: "rect", x: 12, y: 24, w: 64, h: 24, rx: 5, fill: "muted" },
    { kind: "text", x: 44, y: 36, size: 2.6, fill: "inkSoft", content: "нельзя не согласиться", bold: true, anchor: "middle" },
    { kind: "text", x: 44, y: 45, size: 2.4, fill: "muted", content: "с тем, что... — b2-3", anchor: "middle" },
    { kind: "text", x: 80, y: 36, size: 5, fill: "muted", content: "→", anchor: "middle" },
    { kind: "rect", x: 84, y: 24, w: 64, h: 24, rx: 5, fill: "accent" },
    { kind: "text", x: 116, y: 36, size: 2.6, fill: "white", content: "нельзя не признать", bold: true, anchor: "middle" },
    { kind: "text", x: 116, y: 45, size: 2.4, fill: "accentLight", content: "что... — b2-26", anchor: "middle" },
  ],

  // Recursos retóricos de persuasión.
  rhetoricalDevicesPersuasionTable: [
    { kind: "rect", x: 8, y: 16, w: 44, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 30, y: 27, size: 2.2, fill: "white", content: "pregunta retórica", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 34, size: 1.9, fill: "accentLight", content: "Разве это не очевидно?", anchor: "middle" },
    { kind: "rect", x: 58, y: 16, w: 44, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 80, y: 27, size: 2.4, fill: "white", content: "gradación", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 34, size: 1.9, fill: "accentLight", content: "серьёзная → критическая", anchor: "middle" },
    { kind: "rect", x: 108, y: 16, w: 44, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 130, y: 27, size: 2.2, fill: "ink", content: "evidencia compartida", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 34, size: 1.9, fill: "inkSoft", content: "как известно...", anchor: "middle" },
  ],

  // Matización cortés antes de afirmar.
  courteousHedgingBeforeAssertionTable: [
    { kind: "text", x: 80, y: 22, size: 3.4, fill: "muted", content: "При всём уважении...", anchor: "middle" },
    { kind: "text", x: 80, y: 36, size: 4, fill: "inkSoft", content: "↓", anchor: "middle" },
    { kind: "text", x: 80, y: 52, size: 3.6, fill: "brand", bold: true, content: "я не могу согласиться", anchor: "middle" },
    { kind: "text", x: 80, y: 68, size: 3.2, fill: "muted", content: "matizar antes de afirmar aumenta la credibilidad", anchor: "middle" },
  ],

  // Vocabulario de persuasión.
  persuasionVocabularyTable: [
    { kind: "rect", x: 10, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 27, y: 30, size: 2.8, fill: "white", content: "убедить", bold: true, anchor: "middle" },
    { kind: "rect", x: 48, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 65, y: 30, size: 2.4, fill: "white", content: "апеллировать к", bold: true, anchor: "middle" },
    { kind: "rect", x: 86, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 103, y: 30, size: 2.2, fill: "ink", content: "внушать доверие", bold: true, anchor: "middle" },
    { kind: "rect", x: 124, y: 18, w: 30, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 139, y: 30, size: 2, fill: "inkSoft", content: "весомый аргумент", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "léxico clave de persuasión", anchor: "middle" },
  ],

  // Vocabulario ecológico.
  ecologyVocabularyTable: [
    { kind: "rect", x: 8, y: 18, w: 44, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 30, y: 27, size: 2, fill: "white", content: "окружающая среда", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 34, size: 1.8, fill: "accentLight", content: "medio ambiente", anchor: "middle" },
    { kind: "rect", x: 58, y: 18, w: 44, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 80, y: 27, size: 2, fill: "white", content: "глобальное потепление", anchor: "middle" },
    { kind: "text", x: 80, y: 34, size: 1.8, fill: "accentLight", content: "calentamiento global", anchor: "middle" },
    { kind: "rect", x: 108, y: 18, w: 44, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 130, y: 27, size: 2, fill: "ink", content: "углеродный след", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 34, size: 1.8, fill: "inkSoft", content: "huella de carbono", anchor: "middle" },
  ],

  // Vocabulario tecnológico.
  technologyVocabularyTable: [
    { kind: "rect", x: 8, y: 18, w: 44, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 30, y: 27, size: 1.9, fill: "white", content: "искусственный интеллект", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 34, size: 1.8, fill: "accentLight", content: "inteligencia artificial", anchor: "middle" },
    { kind: "rect", x: 58, y: 18, w: 44, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 80, y: 27, size: 2.2, fill: "white", content: "кибербезопасность", anchor: "middle" },
    { kind: "text", x: 80, y: 34, size: 1.8, fill: "accentLight", content: "ciberseguridad", anchor: "middle" },
    { kind: "rect", x: 108, y: 18, w: 44, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 130, y: 27, size: 2.2, fill: "ink", content: "утечка данных", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 34, size: 1.8, fill: "inkSoft", content: "fuga de datos", anchor: "middle" },
  ],

  // «Технологии»: plural obligatorio en sentido general.
  technologiiPluralOnlyGeneralSenseRule: [
    { kind: "rect", x: 20, y: 20, w: 60, h: 24, rx: 5, fill: "brand" },
    { kind: "text", x: 50, y: 34, size: 3, fill: "white", content: "Технологии важны", bold: true, anchor: "middle" },
    { kind: "text", x: 50, y: 41, size: 2.4, fill: "accentLight", content: "correcto: plural", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 56, h: 24, rx: 5, fill: "muted", opacity: 0.6 },
    { kind: "text", x: 116, y: 34, size: 2.6, fill: "inkSoft", content: "✗ Технология важна", bold: true, anchor: "middle" },
    { kind: "text", x: 116, y: 41, size: 2.4, fill: "inkSoft", content: "incorrecto en este sentido", anchor: "middle" },
  ],

  // выбросы vs. отходы; окружающая среда vs. природа.
  vybrosyOtkhodyPrirodaOkruzhayushchayaSredaContrastTable: [
    { kind: "rect", x: 10, y: 14, w: 60, h: 18, rx: 4, fill: "brand" },
    { kind: "text", x: 40, y: 25, size: 2.4, fill: "white", content: "выбросы", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 31, size: 1.8, fill: "accentLight", content: "emisiones al aire", anchor: "middle" },
    { kind: "rect", x: 84, y: 14, w: 60, h: 18, rx: 4, fill: "accent" },
    { kind: "text", x: 114, y: 25, size: 2.4, fill: "white", content: "отходы", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 31, size: 1.8, fill: "accentLight", content: "residuos sólidos", anchor: "middle" },
    { kind: "rect", x: 10, y: 42, w: 60, h: 18, rx: 4, fill: "accentLight" },
    { kind: "text", x: 40, y: 53, size: 2.2, fill: "ink", content: "окружающая среда", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 59, size: 1.8, fill: "inkSoft", content: "técnico/institucional", anchor: "middle" },
    { kind: "rect", x: 84, y: 42, w: 60, h: 18, rx: 4, fill: "muted" },
    { kind: "text", x: 114, y: 53, size: 2.6, fill: "inkSoft", content: "природа", bold: true, anchor: "middle" },
    { kind: "text", x: 114, y: 59, size: 1.8, fill: "inkSoft", content: "general, poético", anchor: "middle" },
  ],

  // Debate ecología/tecnología: repaso de b2-3 y b2-26.
  ecoTechDebateBridgeReviewB23B226StructuresTable: [
    { kind: "rect", x: 8, y: 20, w: 70, h: 24, rx: 5, fill: "muted" },
    { kind: "text", x: 43, y: 32, size: 2.4, fill: "inkSoft", content: "с одной стороны...", bold: true, anchor: "middle" },
    { kind: "text", x: 43, y: 40, size: 2.2, fill: "muted", content: "estructura de debate, b2-3", anchor: "middle" },
    { kind: "rect", x: 84, y: 20, w: 68, h: 24, rx: 5, fill: "accent" },
    { kind: "text", x: 118, y: 32, size: 2.4, fill: "white", content: "нельзя не признать", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 40, size: 2.2, fill: "accentLight", content: "persuasión, b2-26", anchor: "middle" },
  ],

  // Vocabulario de sociedad (b2-6) + tecnología combinados en una frase.
  societyPlusTechVocabularyCombinedSentenceExample: [
    { kind: "text", x: 80, y: 26, size: 2.8, fill: "muted", content: "Общество обеспокоено тем,", anchor: "middle" },
    { kind: "text", x: 80, y: 40, size: 2.8, fill: "brand", bold: true, content: "что цифровизация создаёт риски", anchor: "middle" },
    { kind: "text", x: 80, y: 58, size: 3.2, fill: "inkSoft", content: "sociedad (b2-6) + tecnología, en una frase", anchor: "middle" },
  ],

  // Pregunta retórica en el debate: ¿el fin justifica los medios?
  rhetoricalQuestionEndsMeansDebateExample: [
    { kind: "circle", cx: 80, cy: 34, r: 24, fill: "accentLight", opacity: 0.5 },
    { kind: "text", x: 80, y: 30, size: 3, fill: "ink", bold: true, content: "Возникает вопрос:", anchor: "middle" },
    { kind: "text", x: 80, y: 40, size: 2.6, fill: "ink", content: "оправдывает ли цель средства?", anchor: "middle" },
    { kind: "text", x: 80, y: 62, size: 3.2, fill: "muted", content: "pregunta retórica, repaso de b2-26", anchor: "middle" },
  ],

  // жанр/сюжет/режиссёр (b1-29) -> valoración crítica (b2-28).
  criticismVsB129BasicVocabularyBridgeReview: [
    { kind: "rect", x: 8, y: 24, w: 64, h: 22, rx: 5, fill: "muted" },
    { kind: "text", x: 40, y: 37, size: 2.8, fill: "inkSoft", content: "жанр, сюжет, режиссёр", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 45, size: 2.6, fill: "muted", content: "vocabulario, b1-29", anchor: "middle" },
    { kind: "text", x: 80, y: 36, size: 5, fill: "muted", content: "→", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 64, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 120, y: 37, size: 2.8, fill: "white", content: "впечатляющий", bold: true, anchor: "middle" },
    { kind: "text", x: 120, y: 45, size: 2.6, fill: "accentLight", content: "valoración, b2-28", anchor: "middle" },
  ],

  // Escala de adjetivos de valoración positiva.
  positiveValueAdjectivesScaleTable: [
    { kind: "rect", x: 4, y: 20, w: 30, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 19, y: 32, size: 2, fill: "white", content: "гениальный", bold: true, anchor: "middle" },
    { kind: "rect", x: 38, y: 20, w: 30, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 53, y: 32, size: 2, fill: "white", content: "выдающийся", bold: true, anchor: "middle" },
    { kind: "rect", x: 72, y: 20, w: 30, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 87, y: 32, size: 1.9, fill: "ink", content: "впечатляющий", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 20, w: 26, h: 20, rx: 4, fill: "accentLight", opacity: 0.7 },
    { kind: "text", x: 119, y: 32, size: 1.8, fill: "ink", content: "проникновенный", anchor: "middle" },
    { kind: "rect", x: 136, y: 20, w: 20, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 146, y: 32, size: 1.7, fill: "inkSoft", content: "самобытный", anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4, fill: "inkSoft", content: "escala de intensidad, del máximo elogio en adelante", anchor: "middle" },
  ],

  // Escala de adjetivos de valoración negativa.
  negativeValueAdjectivesScaleTable: [
    { kind: "rect", x: 4, y: 20, w: 30, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 19, y: 32, size: 1.9, fill: "inkSoft", content: "посредственный", anchor: "middle" },
    { kind: "rect", x: 38, y: 20, w: 30, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 53, y: 32, size: 2.2, fill: "inkSoft", content: "банальный", bold: true, anchor: "middle" },
    { kind: "rect", x: 72, y: 20, w: 30, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 87, y: 32, size: 2.2, fill: "inkSoft", content: "затянутый", bold: true, anchor: "middle" },
    { kind: "rect", x: 106, y: 20, w: 26, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 119, y: 32, size: 1.9, fill: "inkSoft", content: "поверхностный", anchor: "middle" },
    { kind: "rect", x: 136, y: 20, w: 20, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 146, y: 32, size: 1.6, fill: "inkSoft", content: "претенциозный", anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 4, fill: "inkSoft", content: "matices distintos del defecto", anchor: "middle" },
  ],

  // Verbos y expresiones de valoración.
  criticismVerbsExpressionsTable: [
    { kind: "rect", x: 8, y: 16, w: 68, h: 18, rx: 4, fill: "brand" },
    { kind: "text", x: 42, y: 27, size: 2.4, fill: "white", content: "тронуть до глубины души", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 16, w: 68, h: 18, rx: 4, fill: "muted" },
    { kind: "text", x: 118, y: 27, size: 2.4, fill: "inkSoft", content: "оставить равнодушным", bold: true, anchor: "middle" },
    { kind: "rect", x: 8, y: 40, w: 68, h: 18, rx: 4, fill: "accentLight" },
    { kind: "text", x: 42, y: 51, size: 2.4, fill: "ink", content: "заслуживать внимания", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 40, w: 68, h: 18, rx: 4, fill: "muted" },
    { kind: "text", x: 118, y: 51, size: 2.4, fill: "inkSoft", content: "разочаровать", bold: true, anchor: "middle" },
  ],

  // Construcciones fijas de la crítica cultural.
  criticalCommentaryFormulasTable: [
    { kind: "rect", x: 10, y: 12, w: 140, h: 16, rx: 4, fill: "brand" },
    { kind: "text", x: 80, y: 23, size: 2.4, fill: "white", content: "С художественной точки зрения...", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 32, w: 140, h: 16, rx: 4, fill: "accent" },
    { kind: "text", x: 80, y: 43, size: 2.4, fill: "white", content: "Автору удалось передать...", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 52, w: 140, h: 16, rx: 4, fill: "accentLight" },
    { kind: "text", x: 80, y: 63, size: 2.2, fill: "ink", content: "Оставляет двоякое впечатление", bold: true, anchor: "middle" },
  ],

  // b2-4 (técnica) vs. b2-28 (juicio de calidad).
  criticismVsB24LiteraryStyleAnalysisContrast: [
    { kind: "rect", x: 10, y: 24, w: 64, h: 24, rx: 5, fill: "muted" },
    { kind: "text", x: 42, y: 36, size: 2.6, fill: "inkSoft", content: "эпитет, метафора", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 45, size: 2.4, fill: "muted", content: "CÓMO — técnica, b2-4", anchor: "middle" },
    { kind: "text", x: 80, y: 36, size: 4, fill: "muted", content: "≠", anchor: "middle" },
    { kind: "rect", x: 86, y: 24, w: 64, h: 24, rx: 5, fill: "accent" },
    { kind: "text", x: 118, y: 36, size: 2.6, fill: "white", content: "впечатляющий", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 45, size: 2.4, fill: "accentLight", content: "SI es bueno, b2-28", anchor: "middle" },
  ],

  // Apoyo estructural: repaso de b2-3 y b2-26.
  criticismBridgeReviewB23B226DebatePersuasionStructures: [
    { kind: "rect", x: 8, y: 20, w: 70, h: 24, rx: 5, fill: "muted" },
    { kind: "text", x: 43, y: 32, size: 2.4, fill: "inkSoft", content: "с одной стороны...", bold: true, anchor: "middle" },
    { kind: "text", x: 43, y: 40, size: 2.2, fill: "muted", content: "estructura, b2-3", anchor: "middle" },
    { kind: "rect", x: 84, y: 20, w: 68, h: 24, rx: 5, fill: "accent" },
    { kind: "text", x: 118, y: 32, size: 2.4, fill: "white", content: "я убеждён, что...", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 40, size: 2.2, fill: "accentLight", content: "persuasión, b2-26", anchor: "middle" },
  ],

  // Subtexto (hoy) vs. connotación de palabra (b2-16).
  subtextVsB216ConnotationLadderBridgeReview: [
    { kind: "rect", x: 8, y: 24, w: 64, h: 22, rx: 5, fill: "muted" },
    { kind: "text", x: 40, y: 37, size: 2.4, fill: "inkSoft", content: "благодаря / из-за", bold: true, anchor: "middle" },
    { kind: "text", x: 40, y: 45, size: 2.2, fill: "muted", content: "connotación en la palabra, b2-16", anchor: "middle" },
    { kind: "text", x: 80, y: 36, size: 5, fill: "muted", content: "→", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 64, h: 22, rx: 5, fill: "accent" },
    { kind: "text", x: 120, y: 37, size: 2.6, fill: "white", content: "подтекст", bold: true, anchor: "middle" },
    { kind: "text", x: 120, y: 45, size: 2.2, fill: "accentLight", content: "oculto bajo el enunciado, b2-29", anchor: "middle" },
  ],

  // Partículas y expresiones de ironía verbal.
  ironyParticlesTable: [
    { kind: "rect", x: 6, y: 18, w: 36, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 24, y: 30, size: 2.4, fill: "white", content: "ну конечно", bold: true, anchor: "middle" },
    { kind: "rect", x: 46, y: 18, w: 30, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 61, y: 30, size: 2.6, fill: "white", content: "как же", bold: true, anchor: "middle" },
    { kind: "rect", x: 80, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 97, y: 30, size: 2.4, fill: "ink", content: "очень надо", bold: true, anchor: "middle" },
    { kind: "rect", x: 118, y: 18, w: 36, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 136, y: 30, size: 2, fill: "inkSoft", content: "ага, конечно", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "implican lo contrario del sentido literal", anchor: "middle" },
  ],

  // ну/же (b2-5, neutro) -> valor irónico (b2-29).
  ironyParticlesBridgeReviewB25DiscourseParticles: [
    { kind: "rect", x: 12, y: 24, w: 60, h: 24, rx: 5, fill: "muted" },
    { kind: "text", x: 42, y: 36, size: 3, fill: "inkSoft", content: "ну / же", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 45, size: 2.4, fill: "muted", content: "discurso neutro, b2-5", anchor: "middle" },
    { kind: "text", x: 80, y: 36, size: 5, fill: "muted", content: "→", anchor: "middle" },
    { kind: "rect", x: 88, y: 24, w: 60, h: 24, rx: 5, fill: "accent" },
    { kind: "text", x: 118, y: 36, size: 2.8, fill: "white", content: "ну конечно", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 45, size: 2.4, fill: "accentLight", content: "irónico, entonación", anchor: "middle" },
  ],

  // «Мягко говоря»: litotes.
  myagkoGovoryaLitotesRule: [
    { kind: "text", x: 80, y: 22, size: 3.2, fill: "muted", content: "Он повёл себя, мягко говоря,", anchor: "middle" },
    { kind: "text", x: 80, y: 36, size: 3.4, fill: "brand", bold: true, content: "некрасиво.", anchor: "middle" },
    { kind: "text", x: 80, y: 50, size: 3, fill: "inkSoft", content: "↓", anchor: "middle" },
    { kind: "text", x: 80, y: 66, size: 3, fill: "muted", content: "la realidad suele ser peor de lo dicho", anchor: "middle" },
  ],

  // как бы/якобы (distanciamiento) vs. как бы то ни было (concesiva fija).
  kakByYakobyDistancingVsKakByToNiByloContrast: [
    { kind: "rect", x: 10, y: 20, w: 64, h: 24, rx: 5, fill: "brand" },
    { kind: "text", x: 42, y: 32, size: 2.6, fill: "white", content: "как бы / якобы", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 40, size: 2.2, fill: "accentLight", content: "duda, distanciamiento", anchor: "middle" },
    { kind: "rect", x: 84, y: 20, w: 66, h: 24, rx: 5, fill: "muted" },
    { kind: "text", x: 117, y: 32, size: 2.2, fill: "inkSoft", content: "как бы то ни было", bold: true, anchor: "middle" },
    { kind: "text", x: 117, y: 40, size: 2.2, fill: "inkSoft", content: "concesiva fija, b2-15/21", anchor: "middle" },
  ],

  // Ирония vs. сарказм.
  sarcasmVsIronyIntensityContrast: [
    { kind: "rect", x: 12, y: 20, w: 60, h: 24, rx: 5, fill: "accentLight" },
    { kind: "text", x: 42, y: 32, size: 3, fill: "ink", content: "ирония", bold: true, anchor: "middle" },
    { kind: "text", x: 42, y: 40, size: 2.2, fill: "inkSoft", content: "con ноткой иронии, más suave", anchor: "middle" },
    { kind: "rect", x: 88, y: 20, w: 60, h: 24, rx: 5, fill: "brand" },
    { kind: "text", x: 118, y: 32, size: 2.8, fill: "white", content: "сарказм", bold: true, anchor: "middle" },
    { kind: "text", x: 118, y: 40, size: 2.2, fill: "accentLight", content: "intención hiriente", anchor: "middle" },
  ],

  // Vocabulario de emociones ocultas.
  hiddenEmotionsVocabularyTable: [
    { kind: "rect", x: 8, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 25, y: 30, size: 2, fill: "white", content: "задеть за живое", bold: true, anchor: "middle" },
    { kind: "rect", x: 46, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 63, y: 30, size: 1.9, fill: "white", content: "читать между строк", bold: true, anchor: "middle" },
    { kind: "rect", x: 84, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 101, y: 30, size: 2.6, fill: "ink", content: "намекать", bold: true, anchor: "middle" },
    { kind: "rect", x: 122, y: 18, w: 32, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 138, y: 30, size: 2.2, fill: "inkSoft", content: "притворяться", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "léxico de matices emocionales", anchor: "middle" },
  ],

  // Estructura del examen: cuatro destrezas.
  trkiFourSkillsStructureTable: [
    { kind: "rect", x: 6, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 23, y: 30, size: 2.6, fill: "white", content: "аудирование", bold: true, anchor: "middle" },
    { kind: "rect", x: 44, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 61, y: 30, size: 2.8, fill: "white", content: "чтение", bold: true, anchor: "middle" },
    { kind: "rect", x: 82, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 99, y: 30, size: 2.8, fill: "ink", content: "письмо", bold: true, anchor: "middle" },
    { kind: "rect", x: 120, y: 18, w: 36, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 138, y: 30, size: 2.6, fill: "inkSoft", content: "говорение", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "más лексика и грамматика", anchor: "middle" },
  ],

  // Fórmulas para la sección escrita (repaso de b2-3/b2-26).
  writtenSectionFormulasBridgeReviewTable: [
    { kind: "rect", x: 10, y: 14, w: 140, h: 16, rx: 4, fill: "brand" },
    { kind: "text", x: 80, y: 25, size: 2.4, fill: "white", content: "С одной стороны... с другой стороны...", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 34, w: 140, h: 16, rx: 4, fill: "accent" },
    { kind: "text", x: 80, y: 45, size: 2.4, fill: "white", content: "На мой взгляд, / Я убеждён(а), что...", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 54, w: 140, h: 16, rx: 4, fill: "accentLight" },
    { kind: "text", x: 80, y: 65, size: 2.2, fill: "ink", content: "Таким образом, можно сделать вывод...", bold: true, anchor: "middle" },
  ],

  // Fórmulas para la sección oral (repaso de b2-15/b2-26).
  oralSectionFormulasBridgeReviewTable: [
    { kind: "rect", x: 10, y: 14, w: 140, h: 16, rx: 4, fill: "brand" },
    { kind: "text", x: 80, y: 25, size: 2.2, fill: "white", content: "Дайте подумать...", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 34, w: 140, h: 16, rx: 4, fill: "accent" },
    { kind: "text", x: 80, y: 45, size: 2.1, fill: "white", content: "Возможно, я ошибаюсь, но...", bold: true, anchor: "middle" },
    { kind: "rect", x: 10, y: 54, w: 140, h: 16, rx: 4, fill: "accentLight" },
    { kind: "text", x: 80, y: 65, size: 2.1, fill: "ink", content: "Подводя итог, хочу сказать, что...", bold: true, anchor: "middle" },
  ],

  // Estrategias de lectura y audición.
  readingListeningStrategiesTable: [
    { kind: "circle", cx: 30, cy: 34, r: 22, fill: "brand", opacity: 0.85 },
    { kind: "text", x: 30, y: 31, size: 2.2, fill: "white", content: "leer preguntas", bold: true, anchor: "middle" },
    { kind: "text", x: 30, y: 39, size: 2, fill: "accentLight", content: "antes del texto", anchor: "middle" },
    { kind: "circle", cx: 80, cy: 34, r: 22, fill: "accent", opacity: 0.85 },
    { kind: "text", x: 80, y: 31, size: 2, fill: "white", content: "marcadores", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 39, size: 1.9, fill: "accentLight", content: "discursivos", anchor: "middle" },
    { kind: "circle", cx: 130, cy: 34, r: 22, fill: "accentLight", opacity: 0.85 },
    { kind: "text", x: 130, y: 31, size: 2.2, fill: "ink", content: "подтекст", bold: true, anchor: "middle" },
    { kind: "text", x: 130, y: 39, size: 1.9, fill: "inkSoft", content: "b2-29", anchor: "middle" },
  ],

  // Los siete bloques del curso B2.
  b2CourseSevenBlocksSummaryDiagram: [
    { kind: "rect", x: 4, y: 22, w: 20, h: 18, rx: 3, fill: "brand" },
    { kind: "text", x: 14, y: 33, size: 1.7, fill: "white", content: "1-2", bold: true, anchor: "middle" },
    { kind: "rect", x: 26, y: 22, w: 20, h: 18, rx: 3, fill: "accent" },
    { kind: "text", x: 36, y: 33, size: 1.7, fill: "white", content: "3-8", bold: true, anchor: "middle" },
    { kind: "rect", x: 48, y: 22, w: 20, h: 18, rx: 3, fill: "accentLight" },
    { kind: "text", x: 58, y: 33, size: 1.6, fill: "ink", content: "9-13", bold: true, anchor: "middle" },
    { kind: "rect", x: 70, y: 22, w: 20, h: 18, rx: 3, fill: "muted" },
    { kind: "text", x: 80, y: 33, size: 1.6, fill: "inkSoft", content: "14-17", bold: true, anchor: "middle" },
    { kind: "rect", x: 92, y: 22, w: 20, h: 18, rx: 3, fill: "brand" },
    { kind: "text", x: 102, y: 33, size: 1.6, fill: "white", content: "18-21", bold: true, anchor: "middle" },
    { kind: "rect", x: 114, y: 22, w: 20, h: 18, rx: 3, fill: "accent" },
    { kind: "text", x: 124, y: 33, size: 1.6, fill: "white", content: "22-25", bold: true, anchor: "middle" },
    { kind: "rect", x: 136, y: 22, w: 20, h: 18, rx: 3, fill: "accentLight" },
    { kind: "text", x: 146, y: 33, size: 1.6, fill: "ink", content: "26-29", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 56, size: 3.6, fill: "inkSoft", content: "siete bloques temáticos del curso B2", anchor: "middle" },
  ],

  // Estrategias prácticas del día del examen.
  examDayPracticalStrategiesTable: [
    { kind: "rect", x: 8, y: 18, w: 44, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 30, y: 30, size: 2.2, fill: "white", content: "распределить время", bold: true, anchor: "middle" },
    { kind: "rect", x: 58, y: 18, w: 44, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 80, y: 30, size: 2, fill: "white", content: "подготовиться заранее", anchor: "middle" },
    { kind: "rect", x: 108, y: 18, w: 44, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 130, y: 30, size: 2.4, fill: "ink", content: "апелляция", bold: true, anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "estrategias prácticas del día del examen", anchor: "middle" },
  ],

  // Vocabulario del examen.
  examMetaVocabularyTable: [
    { kind: "rect", x: 10, y: 18, w: 34, h: 20, rx: 4, fill: "brand" },
    { kind: "text", x: 27, y: 30, size: 2.2, fill: "white", content: "набрать баллы", bold: true, anchor: "middle" },
    { kind: "rect", x: 48, y: 18, w: 34, h: 20, rx: 4, fill: "accent" },
    { kind: "text", x: 65, y: 30, size: 2, fill: "white", content: "критерии оценки", anchor: "middle" },
    { kind: "rect", x: 86, y: 18, w: 34, h: 20, rx: 4, fill: "accentLight" },
    { kind: "text", x: 103, y: 30, size: 2.6, fill: "ink", content: "сертификат", bold: true, anchor: "middle" },
    { kind: "rect", x: 124, y: 18, w: 30, h: 20, rx: 4, fill: "muted" },
    { kind: "text", x: 139, y: 30, size: 2.2, fill: "inkSoft", content: "аргументировать", anchor: "middle" },
    { kind: "text", x: 80, y: 54, size: 4, fill: "inkSoft", content: "léxico clave del examen", anchor: "middle" },
  ],
};
