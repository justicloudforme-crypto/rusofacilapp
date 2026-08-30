"use client";

import { usePathname } from "next/navigation";
import { uiStrings, type UiStrings } from "./ui-strings";

/**
 * The locale of the page this component is rendering on, read from the URL.
 *
 * Same technique GlossaryTermCardBody already used for its "Aparece en"
 * link: every route on this site is `/{lang}/…`, so the first path segment
 * is the locale, and reading it here means a deeply nested client component
 * gets localized strings without threading `lang` through five parents.
 */
export function useUiStrings(): UiStrings {
  const pathname = usePathname();
  return uiStrings(pathname.split("/")[1] || "es");
}
