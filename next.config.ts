import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  // Next.js's dev server blocks cross-origin requests for its own JS
  // chunks/HMR websocket by default (a DNS-rebinding protection) — only
  // "localhost" is allowed out of the box. That silently 403s every JS
  // chunk (React never hydrates, so nothing client-side works — including
  // MobileMenu's tap handler) for anyone testing over the LAN via the dev
  // machine's IP instead of localhost, e.g. a phone hitting the "Network:"
  // URL `next dev` prints (see MOBILE.md's mobile-testing instructions).
  // Add the dev machine's LAN IP here if it changes (`ipconfig getifaddr
  // en0` on macOS) — the error Next.js logs to the terminal when it blocks
  // a request always names the exact origin to add. "0.0.0.0" is separate
  // from the LAN IP above — it's the origin an in-editor browser preview
  // (e.g. VS Code's Simple Browser/webview) presents when proxying
  // localhost, hit the same 403-all-chunks failure mode from here too.
  allowedDevOrigins: ["192.168.1.69", "0.0.0.0"],
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
    ? withSerwistInit({
        swSrc: "src/app/sw.ts",
        swDest: "public/sw.js",
        // public/offline.html isn't reachable through Next's own link graph
        // (it's a static file, not a route), so it needs to be added to the
        // precache list by hand — sw.ts's `fallbacks` config is what
        // actually serves it when a navigation fails offline. Bump the
        // revision string if the file's content ever changes, so existing
        // installs pick up the update.
        additionalPrecacheEntries: [{ url: "/offline.html", revision: "1" }],
      })(withBundleAnalyzer(nextConfig))
    : withBundleAnalyzer(nextConfig);

export default config;
