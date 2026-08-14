import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

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

export default withBundleAnalyzer(nextConfig);
