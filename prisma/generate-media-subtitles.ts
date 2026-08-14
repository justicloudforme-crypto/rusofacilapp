/**
 * Backfills timestamped, bilingual (ru/es) subtitles for every media
 * catalog item ("Медиа" / canciones y videos) that doesn't have them yet,
 * using its YouTube Russian captions + Claude — same pipeline as the admin
 * "Generar subtítulos para todos los videos" button
 * (src/lib/media/generateAllSubtitles.ts), just runnable from the CLI for
 * bulk/unattended runs without sitting through a browser request.
 *
 * SETUP
 * 1. Get an API key at https://console.anthropic.com/settings/keys.
 * 2. Add it to .env:  ANTHROPIC_API_KEY="sk-ant-..."
 * 3. Run:             npm run generate:media-subtitles
 *
 * Without a key, the script prints these instructions and exits without
 * making any network calls — same "demo mode" degradation as the other
 * optional integrations in this app (Stripe, OpenAI TTS).
 *
 * USAGE
 *   npm run generate:media-subtitles            # only items missing subtitles
 *   npm run generate:media-subtitles -- --force # regenerate every item's subtitles
 *
 * Each item costs a request against your Anthropic account (plus a YouTube
 * captions fetch) — review current pricing before running against a large
 * catalog.
 */
import "dotenv/config";
import { generateMissingMediaSubtitles } from "../src/lib/media/generateAllSubtitles";

function parseArgs(argv: string[]) {
  return { force: argv.includes("--force") };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      [
        "ANTHROPIC_API_KEY is not set — nothing to do.",
        "",
        "To generate media subtitles:",
        "  1. Get an API key at https://console.anthropic.com/settings/keys",
        '  2. Add it to .env:  ANTHROPIC_API_KEY="sk-ant-..."',
        "  3. Run again:       npm run generate:media-subtitles",
      ].join("\n"),
    );
    return;
  }

  const { force } = parseArgs(process.argv.slice(2));
  const results = await generateMissingMediaSubtitles({ force });

  if (results.length === 0) {
    console.log("Every media item already has subtitles. Pass --force to regenerate all of them.");
    return;
  }

  for (const result of results) {
    if (result.status === "generated") {
      console.log(`✔ ${result.title} (${result.id})`);
    } else {
      console.log(`✘ ${result.title} (${result.id}) — ${result.error}`);
    }
  }

  const ok = results.filter((r) => r.status === "generated").length;
  const failed = results.length - ok;
  console.log(`\n✔ Subtítulos generados para ${ok} elemento(s)${failed ? `, ${failed} fallaron` : ""}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
