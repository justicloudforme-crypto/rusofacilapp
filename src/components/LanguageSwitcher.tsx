"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeFlags, localeNames, type Locale } from "@/i18n/config";

function withLocale(pathname: string, locale: Locale): string {
  const segments = pathname.split("/");
  segments[1] = locale;
  return segments.join("/") || "/";
}

export default function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white/60 p-1 dark:border-white/15 dark:bg-white/5">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={withLocale(pathname, locale)}
          aria-current={locale === current}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition-colors ${
            locale === current
              ? "bg-foreground text-background"
              : "text-foreground/70 hover:text-foreground"
          }`}
        >
          <span aria-hidden>{localeFlags[locale]}</span>
          <span className="hidden sm:inline">{localeNames[locale]}</span>
        </Link>
      ))}
    </div>
  );
}
