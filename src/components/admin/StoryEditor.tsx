"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { storyLevels, type StoryLevel } from "@/lib/stories";

type StoriesDict = Dictionary["admin"]["stories"];

const ERROR_MESSAGE_KEYS: Record<string, keyof StoriesDict> = {
  title_required: "titleRequired",
  author_required: "authorRequired",
  text_required: "textRequired",
  invalid_level: "invalidLevel",
};

export default function StoryEditor({
  lang,
  dict,
  story,
  initialSavedNotice = false,
}: {
  lang: string;
  dict: StoriesDict;
  story: {
    id: string | null;
    title: string;
    author: string;
    level: StoryLevel;
    text: string;
    description: string;
    translationEs: string;
    audioUrl: string;
    isPremium: boolean;
  };
  /** True right after redirecting here from a successful create — the
   * "saved" confirmation would otherwise flash and vanish, since creating
   * a story navigates from /stories/new to /stories/[id] (a different
   * route/page component), which remounts this editor with fresh state
   * before anyone can see the message. */
  initialSavedNotice?: boolean;
}) {
  const router = useRouter();
  const [id, setId] = useState(story.id);
  const [title, setTitle] = useState(story.title);
  const [author, setAuthor] = useState(story.author);
  const [level, setLevel] = useState<StoryLevel>(story.level);
  const [text, setText] = useState(story.text);
  const [description, setDescription] = useState(story.description);
  const [translationEs, setTranslationEs] = useState(story.translationEs);
  const [audioUrl, setAudioUrl] = useState(story.audioUrl);
  const [isPremium, setIsPremium] = useState(story.isPremium);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string } | { kind: "saved" }
  >(initialSavedNotice ? { kind: "saved" } : { kind: "idle" });

  async function handleSave() {
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/admin/stories/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title,
          author,
          level,
          text,
          description,
          translationEs,
          audioUrl,
          isPremium,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const messageKey = ERROR_MESSAGE_KEYS[data.error];
        setStatus({ kind: "error", message: messageKey ? dict[messageKey] : dict.genericError });
        return;
      }
      if (!id) {
        setId(data.id);
        router.replace(`/${lang}/admin/stories/${data.id}?created=1`);
      } else {
        setStatus({ kind: "saved" });
        router.refresh();
      }
    } catch {
      setStatus({ kind: "error", message: dict.genericError });
    }
  }

  return (
    <div>
      <Link
        href={`/${lang}/admin/stories`}
        className="text-sm font-medium text-foreground/60 hover:text-foreground"
      >
        ← {dict.backToList}
      </Link>

      <h2 className="mt-4 font-medium">{id ? dict.editTitleLabel : dict.newTitle}</h2>

      <div className="mt-6 flex flex-col gap-5">
        <div>
          <label htmlFor="story-title" className="text-sm font-medium">
            {dict.titleLabel}
          </label>
          <input
            id="story-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="story-author" className="text-sm font-medium">
              {dict.authorLabel}
            </label>
            <input
              id="story-author"
              type="text"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder={dict.authorPlaceholder}
              className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
            />
          </div>

          <div>
            <label htmlFor="story-level" className="text-sm font-medium">
              {dict.levelLabel}
            </label>
            <select
              id="story-level"
              value={level}
              onChange={(event) => setLevel(event.target.value as StoryLevel)}
              className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
            >
              {storyLevels.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="story-audio-url" className="text-sm font-medium">
            {dict.audioUrlLabel}
          </label>
          <input
            id="story-audio-url"
            type="url"
            value={audioUrl}
            onChange={(event) => setAudioUrl(event.target.value)}
            placeholder="https://..."
            className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          />
        </div>

        <div>
          <label htmlFor="story-description" className="text-sm font-medium">
            {dict.descriptionLabel}
          </label>
          <p className="mt-1 text-xs text-foreground/50">{dict.descriptionHelp}</p>
          <textarea
            id="story-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 text-sm leading-6 outline-none focus:border-foreground/50 dark:border-white/20"
          />
        </div>

        <div>
          <label htmlFor="story-text" className="text-sm font-medium">
            {dict.textLabel}
          </label>
          <p className="mt-1 text-xs text-foreground/50">{dict.textHelp}</p>
          <textarea
            id="story-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={16}
            className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 text-sm leading-6 outline-none focus:border-foreground/50 dark:border-white/20"
          />
        </div>

        <div>
          <label htmlFor="story-translation" className="text-sm font-medium">
            {dict.translationLabel}
          </label>
          <p className="mt-1 text-xs text-foreground/50">{dict.translationHelp}</p>
          <textarea
            id="story-translation"
            value={translationEs}
            onChange={(event) => setTranslationEs(event.target.value)}
            rows={16}
            className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 text-sm leading-6 outline-none focus:border-foreground/50 dark:border-white/20"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/15 p-3 dark:border-white/20">
          <input
            type="checkbox"
            checked={isPremium}
            onChange={(event) => setIsPremium(event.target.checked)}
            className="sr-only"
          />
          <span
            aria-hidden="true"
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              isPremium ? "bg-foreground" : "bg-foreground/20"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-background transition-transform ${
                isPremium ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </span>
          <span>
            <span className="text-sm font-medium">{dict.premiumLabel}</span>
            <span className="mt-0.5 block text-xs text-foreground/50">{dict.premiumHelp}</span>
          </span>
        </label>
      </div>

      {status.kind === "error" && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {status.message}
        </p>
      )}
      {status.kind === "saved" && (
        <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          {dict.savedNotice}
        </p>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={status.kind === "saving"}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-50"
        >
          {dict.saveButton}
        </button>
      </div>
    </div>
  );
}
