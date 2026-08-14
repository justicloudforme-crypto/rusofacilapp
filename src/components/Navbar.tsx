import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";

export default async function Navbar({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-background/80 backdrop-blur dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href={`/${lang}`} className="text-lg font-semibold tracking-tight">
          RusoFácil
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          <Link href={`/${lang}`} className="hover:text-foreground/70">
            {dict.nav.home}
          </Link>
          <Link href={`/${lang}/courses`} className="hover:text-foreground/70">
            {dict.nav.courses}
          </Link>
          <Link href={`/${lang}/stories`} className="hover:text-foreground/70">
            {dict.nav.stories}
          </Link>
          <Link href={`/${lang}/media`} className="hover:text-foreground/70">
            {dict.nav.media}
          </Link>
          <Link href={`/${lang}/vocabulary`} className="hover:text-foreground/70">
            {dict.nav.vocabulary}
          </Link>
          {user && isStaff(user.role) && (
            <Link href={`/${lang}/admin`} className="hover:text-foreground/70">
              {dict.admin.title}
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher current={lang} />
          <Link
            href={user ? `/${lang}/profile` : `/${lang}/login`}
            className="hidden rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 sm:inline-block"
          >
            {user ? user.email : dict.nav.cta}
          </Link>
        </div>
      </div>
    </header>
  );
}
