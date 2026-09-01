import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import MatryoshkaMark from "./MatryoshkaMark";

export default function Footer({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  return (
    <footer className="border-t border-black/10 dark:border-white/30">
      {/* flex-wrap on BOTH rows, and it has to be both. The link row below
          grew to six items (428px of intrinsic width) while staying a
          non-wrapping `flex`; centred inside a 320px column that made it
          overhang by 54px on each side — clipped on the left, sticking out
          on the right, and the whole document scrolling sideways with it.
          The outer row overflowed for its own reason at >=sm, where all
          four groups sit side by side: 847px of content in a 720px column
          at 768px wide. Measured at 320/375/610/768 in
          scripts/check-layout-geometry.mjs, which now fails the build if
          any document scrolls horizontally again. Not overflow-hidden:
          that hides the links instead of fitting them. */}
      {/* `justify-between` is gone, and that is the whole tablet fix.
          Four items in a WRAPPING row are justified line by line, so between
          768 and 1024 the first line held the brand and the tagline alone
          and pushed them to opposite edges: measured at 768/es the brand
          ended at x=166 and the tagline ran 495→744, i.e. it sat hard
          against the right edge, one line above a left-aligned link row —
          which is what reads as the tagline sitting on top of the links.
          In `/ru` the same line ran 380→744 against 690px of links below it.
          Centring every line instead keeps the wrapped lines stacked and
          grouped, at every width, and it is the SAME rule for all of them.

          The change is style-only: not one string, link, href or element of
          content changes, so the 165 pages of the frozen experiment get the
          same footer they had, and both of its groups get the identical
          change — this footer is one component with no reference to
          isFrozenPage / isFrozenStory / isPilotMedia anywhere in it or above
          it. */}
      <div className="mx-auto flex max-w-5xl flex-col flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6 py-8 text-sm text-foreground/60 sm:flex-row">
        {/* The brand and the line that says what the brand is stay one
            unit. Split across a wrapping row they were the two ends of it. */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-2">
            <MatryoshkaMark size={20} />
            <span className="font-serif font-bold text-foreground/80">RusoFácilapp.com</span>
          </span>
          <span>{dict.footer.tagline}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href={`/${lang}/download`} className="tap hover:text-foreground/80 active:text-foreground/80">
            {dict.footer.appLink}
          </Link>
          {/* The navbar's own Glosario entry (added alongside this) lives
              inside the Practicar dropdown, whose panel only renders once
              opened — so it gives a human a path but a crawler nothing.
              This footer link is the crawlable one: the footer is server-
              rendered on every page, which is what takes /glossary from
              6 inbound pages to the whole site. */}
          <Link href={`/${lang}/glossary`} className="tap hover:text-foreground/80 active:text-foreground/80">
            {dict.nav.glossary}
          </Link>
          {/* Same reasoning as the glossary link above, and the same
              measured problem: the 23 per-theme vocabulary pages hang off
              /vocabulary, whose own category picker is client-rendered
              inside VocabularyApp and so invisible to a crawler. This
              server-rendered footer link is what gives them an inbound
              path from every page of the site. */}
          <Link href={`/${lang}/vocabulary`} className="tap hover:text-foreground/80 active:text-foreground/80">
            {dict.footer.vocabularyLink}
          </Link>
          <Link href={`/${lang}/sobre-nosotros`} className="tap hover:text-foreground/80 active:text-foreground/80">
            {dict.nav.about}
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
