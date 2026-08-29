/**
 * One-off seed: writes the manual embed-status override for
 * song-ty-uydyosh ("Ты уйдёшь — Комиссар") into MediaOverride, so the
 * production admin panel's "Verificar enlaces de YouTube" can no longer
 * silently flip it back to "ok" (the YouTube Data API doesn't detect this
 * video's real embed failure — see checkEmbeds.ts and
 * rusofasil_media_content_policy memory). Mirrors the row already seeded
 * locally in dev.db.
 *
 * Usage (credentials are one-off, never persisted to a file):
 *   PROD_TURSO_DATABASE_URL="libsql://..." PROD_TURSO_AUTH_TOKEN="..." \
 *     npx tsx prisma/seed-ty-uydyosh-override.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { isEntryPoint } from "../src/lib/entry-point";
const url = process.env.PROD_TURSO_DATABASE_URL ?? "";
const authToken = process.env.PROD_TURSO_AUTH_TOKEN ?? "";
// Argument validation exits the process, so it must not run on import
// either — see src/lib/entry-point.ts.
if (isEntryPoint(import.meta.url) && (!url || !authToken)) {
  console.error("Set PROD_TURSO_DATABASE_URL and PROD_TURSO_AUTH_TOKEN.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken }) });

async function main() {
  const row = await db.mediaOverride.upsert({
    where: { mediaId: "song-ty-uydyosh" },
    create: {
      mediaId: "song-ty-uydyosh",
      manualOverride: true,
      embedStatus: "blocked",
      lastCheckedAt: "2026-08-17",
      sourceNoteAppend:
        "Protegido manualmente: reporte directo del usuario (captura de Video unavailable en vivo) contradice a la YouTube Data API, que devuelve embeddable=true para este video (falso negativo confirmado).",
    },
    update: { manualOverride: true, embedStatus: "blocked" },
  });
  console.log("Production MediaOverride row:", row);
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
