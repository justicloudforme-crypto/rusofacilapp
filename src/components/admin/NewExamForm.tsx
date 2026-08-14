"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LevelSlug } from "@/lib/courses";

export default function NewExamForm({
  lang,
  levelSlugs,
  dict,
}: {
  lang: string;
  levelSlugs: readonly LevelSlug[];
  dict: {
    newExamHeading: string;
    newExamHelp: string;
    level: string;
    examSlugLabel: string;
    examSlugPlaceholder: string;
    createButton: string;
    invalidExamSlug: string;
  };
}) {
  const router = useRouter();
  const [level, setLevel] = useState<LevelSlug>(levelSlugs[0]);
  const [examSlug, setExamSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = examSlug.trim();
    if (!new RegExp(`^${level}-exam-[1-9][0-9]*$`).test(trimmed)) {
      setError(dict.invalidExamSlug);
      return;
    }
    setError(null);
    router.push(`/${lang}/admin/exams/${level}/${trimmed}`);
  }

  return (
    <div className="mt-8 rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
      <h3 className="font-medium">{dict.newExamHeading}</h3>
      <p className="mt-1 text-sm text-foreground/60">{dict.newExamHelp}</p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{dict.level}</span>
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value as LevelSlug)}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          >
            {levelSlugs.map((slug) => (
              <option key={slug} value={slug}>
                {slug.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{dict.examSlugLabel}</span>
          <input
            type="text"
            value={examSlug}
            onChange={(event) => setExamSlug(event.target.value)}
            placeholder={dict.examSlugPlaceholder}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
        >
          {dict.createButton}
        </button>
      </form>
      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
