/**
 * One-time generator for PWA/app icons — renders the same sparkle glyph +
 * brand gradient used by BrandMark.tsx (src/components/lesson/BrandMark.tsx)
 * onto square canvases via `sharp` (already a transitive dependency of
 * Next.js's image optimizer, so this adds zero new packages).
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
 *
 * Re-run any time BrandMark's glyph or brand colors change:
 *   npx tsx scripts/generate-pwa-icons.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BRAND_START = "#3730a3";
const BRAND_END = "#d97706";
// Same path as BrandMark.tsx's sparkle glyph, in its native 24x24 viewBox.
const SPARKLE_PATH =
  "M12 3 C13 8 15 10 21 12 C15 14 13 16 12 21 C11 16 9 14 3 12 C9 10 11 8 12 3 Z";

function iconSvg(size: number, glyphScale: number, opaqueBackground: boolean): string {
  const glyphSize = size * glyphScale;
  const offset = (size - glyphSize) / 2;
  const backgroundRect = opaqueBackground
    ? `<rect width="${size}" height="${size}" fill="url(#bg)" />`
    : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND_START}" />
      <stop offset="100%" stop-color="${BRAND_END}" />
    </linearGradient>
  </defs>
  ${backgroundRect}
  <svg x="${offset}" y="${offset}" width="${glyphSize}" height="${glyphSize}" viewBox="0 0 24 24">
    <path d="${SPARKLE_PATH}" fill="#ffffff" />
  </svg>
</svg>`;
}

async function renderPng(svg: string, outPath: string, size: number, opts?: { flatten?: boolean }) {
  let image = sharp(Buffer.from(svg)).resize(size, size);
  // iOS ignores/ can visually smear alpha on apple-touch-icon — flatten to
  // a solid RGB image so there's no alpha channel to misbehave, even
  // though every pixel is already fully opaque here.
  if (opts?.flatten) image = image.flatten({ background: BRAND_START });
  await image.png().toFile(outPath);
  console.log(`  wrote ${outPath}`);
}

async function main() {
  const iconsDir = path.join(process.cwd(), "public", "icons");
  await mkdir(iconsDir, { recursive: true });

  for (const size of [192, 512]) {
    // Regular: glyph fills most of the canvas, rounded-square background.
    await renderPng(iconSvg(size, 0.72, false), path.join(iconsDir, `icon-${size}.png`), size);
    // Maskable: smaller glyph + edge-to-edge square background, so
    // Android's circular/squircle mask never clips the sparkle.
    await renderPng(iconSvg(size, 0.5, true), path.join(iconsDir, `icon-maskable-${size}.png`), size);
  }

  // apple-touch-icon: iOS flattens/ignores alpha and rounds the corners
  // itself, so a plain edge-to-edge square (no rx, no transparency) is the
  // correct source image — same 0.6 glyph scale as maskable for consistent
  // padding once iOS applies its own mask.
  await renderPng(iconSvg(180, 0.6, true), path.join(process.cwd(), "public", "apple-touch-icon.png"), 180, {
    flatten: true,
  });

  // Next 16 Metadata Files convention: src/app/icon.png overrides the
  // static favicon.ico automatically, no code changes needed.
  await renderPng(iconSvg(256, 0.72, false), path.join(process.cwd(), "src", "app", "icon.png"), 256);

  console.log("✔ PWA icons generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
