/**
 * One-time generator for PWA/app icons — renders the same matryoshka mark
 * used by MatryoshkaMark.tsx/BrandMark.tsx onto square canvases via `sharp`
 * (already a transitive dependency of Next.js's image optimizer, so this
 * adds zero new packages). Colors are the "Городецкая роспись" (Gorodets)
 * brand palette — see globals.css for the matching UI tokens.
 *
 * Produces:
 *   public/icons/icon-192.png, icon-512.png            — regular
 *   public/icons/icon-maskable-192.png, -512.png        — glyph shrunk to
 *     fit Android's ~80% "safe zone" so OS masking doesn't clip it
 *   public/apple-touch-icon.png (180x180, no alpha — iOS ignores/flattens
 *     transparency on touch icons, so this is composited onto a solid
 *     brand-color background instead of left transparent)
 *   src/app/favicon.ico is intentionally left alone here — Next 16 also
 *     honors src/app/icon.png (Metadata Files convention), so this script
 *     writes that too and it takes priority over the old placeholder .ico.
 *   resources/icon.png (1024x1024) and resources/splash.png (2732x2732) —
 *     source images for `npx capacitor-assets generate` (see MOBILE.md),
 *     which rasterizes these into every iOS/Android native size.
 *
 * Re-run any time MatryoshkaMark's shape or brand colors change:
 *   npx tsx scripts/generate-pwa-icons.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Icon canvas background: bold brand blue (not the site's cream page
// background) — a small home-screen icon needs to read clearly among
// other apps, and cream-on-cream would wash the doll out at 48px.
const CANVAS_BG = "#2d5f8a";
const DOLL_SKIN = "#fbe3c0";
const DOLL_SCARF = "#e0a934";
const DOLL_DRESS = "#fff8ec";
const DOLL_BAND_1 = "#d63b2f";
const DOLL_BAND_2 = "#e0a934";
const DOLL_APRON = "#2d5f8a";
const DOLL_FLOWER = "#d63b2f";

/** The matryoshka silhouette, in its own 100x140 viewBox — a plain-clipPath
 * body (six curve commands, not hand-tuned long path data) with flat color
 * bands layered inside it. Mirrors MatryoshkaMark.tsx's div-stack approach,
 * just as SVG so `sharp` can rasterize it at arbitrary sizes. */
function dollSvg(): string {
  return `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="body">
      <path d="M50 40 C64 40 72 42 76 54 C90 64 92 90 92 105 C92 128 74 138 50 138 C26 138 8 128 8 105 C8 90 10 64 24 54 C28 42 36 40 50 40 Z" />
    </clipPath>
  </defs>
  <circle cx="50" cy="32" r="20" fill="${DOLL_SKIN}" />
  <g clip-path="url(#body)">
    <rect x="0" y="0" width="100" height="140" fill="${DOLL_DRESS}" />
    <rect x="0" y="40" width="100" height="20" fill="${DOLL_SCARF}" />
    <rect x="0" y="72" width="100" height="14" fill="${DOLL_BAND_1}" />
    <rect x="0" y="98" width="100" height="14" fill="${DOLL_BAND_2}" />
    <ellipse cx="50" cy="132" rx="27" ry="24" fill="${DOLL_APRON}" />
    <circle cx="38" cy="114" r="6" fill="${DOLL_FLOWER}" />
    <circle cx="62" cy="114" r="6" fill="${DOLL_FLOWER}" />
    <circle cx="50" cy="128" r="6" fill="${DOLL_FLOWER}" />
  </g>
</svg>`;
}

function iconSvg(size: number, glyphScale: number, opaqueBackground: boolean): string {
  // The doll is taller than wide (100:140) — fit by height, center by width.
  const glyphHeight = size * glyphScale;
  const glyphWidth = glyphHeight * (100 / 140);
  const offsetX = (size - glyphWidth) / 2;
  const offsetY = (size - glyphHeight) / 2;
  const backgroundRect = opaqueBackground
    ? `<rect width="${size}" height="${size}" fill="${CANVAS_BG}" />`
    : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${CANVAS_BG}" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${backgroundRect}
  <svg x="${offsetX}" y="${offsetY}" width="${glyphWidth}" height="${glyphHeight}" viewBox="0 0 100 140">
    ${dollSvg().replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}
  </svg>
</svg>`;
}

/** Same brand background, doll small and centered — used as the source for
 * native app splash screens, which are always a square canvas that each
 * platform's tooling letterboxes/crops per device. */
function splashSvg(size: number): string {
  const glyphHeight = size * 0.22;
  const glyphWidth = glyphHeight * (100 / 140);
  const offsetX = (size - glyphWidth) / 2;
  const offsetY = (size - glyphHeight) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${CANVAS_BG}" />
  <svg x="${offsetX}" y="${offsetY}" width="${glyphWidth}" height="${glyphHeight}" viewBox="0 0 100 140">
    ${dollSvg().replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}
  </svg>
</svg>`;
}

async function renderPng(svg: string, outPath: string, size: number, opts?: { flatten?: boolean }) {
  let image = sharp(Buffer.from(svg)).resize(size, size);
  // iOS ignores/can visually smear alpha on apple-touch-icon — flatten to
  // a solid RGB image so there's no alpha channel to misbehave, even
  // though every pixel is already fully opaque here.
  if (opts?.flatten) image = image.flatten({ background: CANVAS_BG });
  await image.png().toFile(outPath);
  console.log(`  wrote ${outPath}`);
}

async function main() {
  const iconsDir = path.join(process.cwd(), "public", "icons");
  await mkdir(iconsDir, { recursive: true });

  for (const size of [192, 512]) {
    // Regular: doll fills most of the canvas, rounded-square background.
    await renderPng(iconSvg(size, 0.82, false), path.join(iconsDir, `icon-${size}.png`), size);
    // Maskable: smaller doll + edge-to-edge square background, so
    // Android's circular/squircle mask never clips it.
    await renderPng(iconSvg(size, 0.62, true), path.join(iconsDir, `icon-maskable-${size}.png`), size);
  }

  // apple-touch-icon: iOS flattens/ignores alpha and rounds the corners
  // itself, so a plain edge-to-edge square (no rx, no transparency) is the
  // correct source image — same 0.62 glyph scale as maskable for consistent
  // padding once iOS applies its own mask.
  await renderPng(iconSvg(180, 0.62, true), path.join(process.cwd(), "public", "apple-touch-icon.png"), 180, {
    flatten: true,
  });

  // Next 16 Metadata Files convention: src/app/icon.png overrides the
  // static favicon.ico automatically, no code changes needed.
  await renderPng(iconSvg(256, 0.82, false), path.join(process.cwd(), "src", "app", "icon.png"), 256);

  // Capacitor native asset sources (see MOBILE.md) — 1024x1024 icon,
  // edge-to-edge like the maskable/apple variants since iOS/Android both
  // apply their own platform-specific icon masking on top.
  const resourcesDir = path.join(process.cwd(), "resources");
  await mkdir(resourcesDir, { recursive: true });
  await renderPng(iconSvg(1024, 0.62, true), path.join(resourcesDir, "icon.png"), 1024, { flatten: true });
  await renderPng(splashSvg(2732), path.join(resourcesDir, "splash.png"), 2732, { flatten: true });

  console.log("✔ PWA + Capacitor icons generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
