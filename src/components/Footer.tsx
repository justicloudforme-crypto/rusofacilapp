import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import MatryoshkaMark from "./MatryoshkaMark";

export default function Footer({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 py-8 text-sm text-foreground/60 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <MatryoshkaMark size={20} />
          <p className="font-serif font-bold text-foreground/80">RusoFácilapp.com</p>
        </div>
        <p>{dict.footer.tagline}</p>
        <div className="flex items-center gap-4">
          <Link href={`/${lang}/download`} className="tap hover:text-foreground/80 active:text-foreground/80">
            {dict.footer.appLink}
          </Link>
          <Link href={`/${lang}/terms`} className="tap hover:text-foreground/80 active:text-foreground/80">
            {dict.footer.termsLink}
          </Link>
          <Link href={`/${lang}/privacy`} className="tap hover:text-foreground/80 active:text-foreground/80">
            {dict.footer.privacyLink}
          </Link>
        </div>
        <p>© {new Date().getFullYear()} RusoFácilapp.com. {dict.footer.rights}</p>
      </div>
    </footer>
  );
}
