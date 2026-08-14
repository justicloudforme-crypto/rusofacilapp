import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  /* config options here */
};

// Run `ANALYZE=true npm run build` to get an interactive treemap of the
// client bundle at .next/analyze/client.html — the tool used to confirm
// the flashcards/idioms/slide-icons content was removed from the client
// bundle (see prisma/schema.prisma FlashcardCard/Idiom comments and
// SlidesTab.tsx). Off by default: it only changes the build when ANALYZE
// is set, so normal builds/deploys are unaffected.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

// `next typegen` (part of `npm run pretypecheck`) evaluates this config
// under NODE_ENV=production internally, same as a real build — so Serwist
// still emits its Turbopack-incompatibility warning there even though no
// actual dev server is running. Cosmetic only; silence it.
process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

// `npm run dev` uses Turbopack; Serwist's compiler is webpack-only and
// `withSerwistInit(...)` unconditionally attaches a `webpack` config
// function to nextConfig (its own `disable` option only skips emitting
// public/sw.js, not that attachment) — which Next 16 refuses to run under
// Turbopack. Rather than force the whole dev server onto webpack (losing
// Turbopack's fast refresh) just for a service worker nothing needs in
// dev, only wrap with Serwist for `next build`/`next start`
// (NODE_ENV=production, set automatically by the Next CLI) and skip it
// entirely otherwise.
const config =
  process.env.NODE_ENV === "production"
    ? withSerwistInit({ swSrc: "src/app/sw.ts", swDest: "public/sw.js" })(withBundleAnalyzer(nextConfig))
    : withBundleAnalyzer(nextConfig);

export default config;
