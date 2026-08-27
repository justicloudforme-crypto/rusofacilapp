import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Next.js Metadata Route convention — served automatically at /robots.txt,
// same pattern as manifest.ts. Lives outside `[lang]` so it isn't subject to
// locale-prefix redirecting (see proxy.ts's matcher, which excludes this
// path by extension).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/*/admin",
          "/account",
          "/*/account",
          "/profile",
          "/*/profile",
          "/login",
          "/*/login",
          "/register",
          "/*/register",
          "/forgot-password",
          "/*/forgot-password",
          "/reset-password",
          "/*/reset-password",
          "/confirm-delete-account",
          "/*/confirm-delete-account",
          "/groups",
          "/*/groups",
          "/styleguide",
          "/*/styleguide",
          "/video-lesson-demo",
          "/*/video-lesson-demo",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
