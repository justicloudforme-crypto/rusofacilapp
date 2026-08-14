import type { Dictionary } from "@/i18n/dictionaries";

export default function Footer({ dict }: { dict: Dictionary }) {
  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-6 py-8 text-sm text-foreground/60 sm:flex-row sm:justify-between">
        <p>RusoFácil — {dict.footer.tagline}</p>
        <p>© {new Date().getFullYear()} RusoFácil. {dict.footer.rights}</p>
      </div>
    </footer>
  );
}
