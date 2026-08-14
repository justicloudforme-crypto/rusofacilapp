"use client";

import { useEffect, useState } from "react";
import { flashcardCategories, flashcardLevels, type FlashcardCategory, type FlashcardLevel } from "@/lib/flashcards";

export interface FlashcardAdminDict {
  categoryFilterLabel: string;
  levelFilterLabel: string;
  levelAllLabel: string;
  russianHeader: string;
  translationHeader: string;
  levelHeader: string;
  newButton: string;
  editButton: string;
  deleteButton: string;
  cancelButton: string;
  emptyState: string;
  categoryLabel: string;
  levelLabel: string;
  emojiLabel: string;
  russianLabel: string;
  transcriptionLabel: string;
  translationEsLabel: string;
  exampleRuLabel: string;
  exampleEsLabel: string;
  synonymsLabel: string;
  antonymsLabel: string;
  wordPlaceholder: string;
  translationPlaceholder: string;
  addRelationLabel: string;
  removeRelationLabel: string;
  saveButton: string;
  savedNotice: string;
  russianRequired: string;
  translationEsRequired: string;
  genericError: string;
}

interface WordRelation {
  word: string;
  translation: string;
}

interface FlashcardRow {
  id: string;
  category: FlashcardCategory;
  level: FlashcardLevel;
  emoji: string;
  russian: string;
  transcription: string;
  translationEs: string;
  exampleRu: string;
  exampleEs: string;
  synonyms: WordRelation[];
  antonyms: WordRelation[];
}

function emptyForm(category: FlashcardCategory) {
  return {
    id: null as string | null,
    category,
    level: "A1" as FlashcardLevel,
    emoji: "",
    russian: "",
    transcription: "",
    translationEs: "",
    exampleRu: "",
    exampleEs: "",
    synonyms: [] as WordRelation[],
    antonyms: [] as WordRelation[],
  };
}

export default function FlashcardAdminApp({ dict }: { dict: FlashcardAdminDict }) {
  const [categoryFilter, setCategoryFilter] = useState<FlashcardCategory>(flashcardCategories[0]);
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const [cards, setCards] = useState<FlashcardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ReturnType<typeof emptyForm> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function load() {
    setLoading(true);
    fetch(`/api/flashcards?category=${encodeURIComponent(categoryFilter)}`)
      .then((res) => (res.ok ? res.json() : { cards: [] }))
      .then((body: { cards?: FlashcardRow[] }) => {
        setCards(body.cards ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  const visibleCards = levelFilter === "all" ? cards : cards.filter((c) => c.level === levelFilter);

  function startEdit(row: FlashcardRow) {
    setSaved(false);
    setError(null);
    setForm({ ...row });
  }

  function startNew() {
    setSaved(false);
    setError(null);
    setForm(emptyForm(categoryFilter));
  }

  function updateRelation(kind: "synonyms" | "antonyms", index: number, field: "word" | "translation", value: string) {
    if (!form) return;
    const list = form[kind].map((r, i) => (i === index ? { ...r, [field]: value } : r));
    setForm({ ...form, [kind]: list });
  }

  function addRelation(kind: "synonyms" | "antonyms") {
    if (!form) return;
    setForm({ ...form, [kind]: [...form[kind], { word: "", translation: "" }] });
  }

  function removeRelation(kind: "synonyms" | "antonyms", index: number) {
    if (!form) return;
    setForm({ ...form, [kind]: form[kind].filter((_, i) => i !== index) });
  }

  async function save() {
    if (!form) return;
    setError(null);
    if (!form.russian.trim()) return setError(dict.russianRequired);
    if (!form.translationEs.trim()) return setError(dict.translationEsRequired);

    const res = await fetch("/api/admin/flashcards/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      setError(dict.genericError);
      return;
    }

    setSaved(true);
    setForm(null);
    load();
  }

  async function remove(id: string) {
    await fetch("/api/admin/flashcards/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-foreground/70">{dict.categoryFilterLabel}</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as FlashcardCategory)}
            className="rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
          >
            {flashcardCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-foreground/70">{dict.levelFilterLabel}</span>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as FlashcardLevel | "all")}
            className="rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
          >
            <option value="all">{dict.levelAllLabel}</option>
            {flashcardLevels.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </label>
        {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400">{dict.savedNotice}</p>}
        <button
          type="button"
          onClick={startNew}
          className="ml-auto rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
        >
          + {dict.newButton}
        </button>
      </div>

      {form && (
        <div className="mt-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.categoryLabel}</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as FlashcardCategory })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              >
                {flashcardCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.levelLabel}</span>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value as FlashcardLevel })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              >
                {flashcardLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.emojiLabel}</span>
              <input
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.russianLabel}</span>
              <input
                value={form.russian}
                onChange={(e) => setForm({ ...form, russian: e.target.value })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.transcriptionLabel}</span>
              <input
                value={form.transcription}
                onChange={(e) => setForm({ ...form, transcription: e.target.value })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.translationEsLabel}</span>
              <input
                value={form.translationEs}
                onChange={(e) => setForm({ ...form, translationEs: e.target.value })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.exampleRuLabel}</span>
              <textarea
                value={form.exampleRu}
                onChange={(e) => setForm({ ...form, exampleRu: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.exampleEsLabel}</span>
              <textarea
                value={form.exampleEs}
                onChange={(e) => setForm({ ...form, exampleEs: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>

            {(["synonyms", "antonyms"] as const).map((kind) => (
              <div key={kind} className="sm:col-span-2">
                <span className="mb-1 block text-sm text-foreground/70">
                  {kind === "synonyms" ? dict.synonymsLabel : dict.antonymsLabel}
                </span>
                <div className="flex flex-col gap-2">
                  {form[kind].map((rel, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={rel.word}
                        onChange={(e) => updateRelation(kind, i, "word", e.target.value)}
                        placeholder={dict.wordPlaceholder}
                        className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
                      />
                      <input
                        value={rel.translation}
                        onChange={(e) => updateRelation(kind, i, "translation", e.target.value)}
                        placeholder={dict.translationPlaceholder}
                        className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
                      />
                      <button
                        type="button"
                        onClick={() => removeRelation(kind, i)}
                        aria-label={dict.removeRelationLabel}
                        className="flex-shrink-0 rounded-lg border border-black/10 px-2.5 text-foreground/50 hover:border-red-300 hover:text-red-600 dark:border-white/15"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addRelation(kind)}
                    className="w-fit text-sm font-medium text-foreground/70 hover:text-foreground"
                  >
                    + {dict.addRelationLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={save}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
            >
              {dict.saveButton}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
            >
              {dict.cancelButton}
            </button>
          </div>
        </div>
      )}

      {!loading && visibleCards.length === 0 && <p className="mt-6 text-sm text-foreground/60">{dict.emptyState}</p>}

      {visibleCards.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50 dark:border-white/10">
                <th className="px-4 py-2">{dict.russianHeader}</th>
                <th className="px-4 py-2">{dict.translationHeader}</th>
                <th className="px-4 py-2">{dict.levelHeader}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleCards.map((row) => (
                <tr key={row.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5">
                    {row.emoji} {row.russian}
                  </td>
                  <td className="px-4 py-2.5 text-foreground/70">{row.translationEs}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium">{row.level}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="font-medium text-foreground/80 hover:text-foreground"
                      >
                        {dict.editButton}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(row.id)}
                        className="font-medium text-red-600 hover:text-red-500 dark:text-red-400"
                      >
                        {dict.deleteButton}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
