import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
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
  const staff = Boolean(user && isStaff(user.role));

  const navLinks = [
    { href: `/${lang}`, label: dict.nav.home },
    { href: `/${lang}/courses`, label: dict.nav.courses },
    { href: `/${lang}/stories`, label: dict.nav.stories },
    { href: `/${lang}/media`, label: dict.nav.media },
    { href: `/${lang}/vocabulary`, label: dict.nav.vocabulary },
    ...(staff ? [{ href: `/${lang}/admin`, label: dict.admin.title }] : []),
  ];
  const ctaHref = user ? `/${lang}/profile` : `/${lang}/login`;
  const ctaLabel = user ? user.email : dict.nav.cta;

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-background/80 pt-safe backdrop-blur dark:border-white/10">
      <div className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href={`/${lang}`} className="text-lg font-semibold tracking-tight">
          RusoFácil
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground/70">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher current={lang} />
          <Link
            href={ctaHref}
            className="hidden rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 sm:inline-block"
          >
            {ctaLabel}
          </Link>
          <MobileMenu
            links={navLinks}
            ctaHref={ctaHref}
            ctaLabel={ctaLabel}
            openLabel={dict.nav.openMenu}
            closeLabel={dict.nav.closeMenu}
          />
        </div>
      </div>
    </header>
  );
}
