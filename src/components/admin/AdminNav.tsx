"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionaries";

export default function AdminNav({
  lang,
  dict,
  isOwner,
}: {
  lang: string;
  dict: Dictionary["admin"];
  isOwner: boolean;
}) {
  const pathname = usePathname();

  const items = [
    { href: `/${lang}/admin/lessons`, label: dict.nav.lessons },
    { href: `/${lang}/admin/exams`, label: dict.nav.exams },
    { href: `/${lang}/admin/stories`, label: dict.nav.stories },
    { href: `/${lang}/admin/video-lessons`, label: dict.nav.videoLessons },
    { href: `/${lang}/admin/media`, label: dict.nav.media },
    { href: `/${lang}/admin/glossary`, label: dict.nav.glossary },
    { href: `/${lang}/admin/flashcards`, label: dict.nav.flashcards },
    { href: `/${lang}/admin/idioms`, label: dict.nav.idioms },
    { href: `/${lang}/admin/subscriptions`, label: dict.nav.subscriptions },
    ...(isOwner ? [{ href: `/${lang}/admin/users`, label: dict.nav.users }] : []),
  ];

  return (
    <nav className="mt-4 flex flex-wrap gap-1 rounded-full border border-black/10 p-1 dark:border-white/10 sm:w-fit">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-foreground text-background"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
