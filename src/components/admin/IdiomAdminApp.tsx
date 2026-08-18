"use client";

import { useEffect, useMemo, useState } from "react";
import { idiomCategories, idiomLevels, type IdiomCategory } from "@/lib/idioms";
import type { StoryLevel } from "@/lib/stories";

export interface IdiomAdminDict {
  categoryFilterLabel: string;
  categoryAllLabel: string;
  categoryDailyLabel: string;
  categoryProverbsLabel: string;
  categoryLiteraryLabel: string;
  levelFilterLabel: string;
  levelAllLabel: string;
  searchPlaceholder: string;
  phraseHeader: string;
  categoryHeader: string;
  levelHeader: string;
  newButton: string;
  editButton: string;
  deleteButton: string;
  cancelButton: string;
  emptyState: string;
  categoryLabel: string;
  levelLabel: string;
  phraseLabel: string;
  literalTranslationLabel: string;
  spanishEquivalentLabel: string;
  explanationLabel: string;
  contextExampleRuLabel: string;
  contextExampleEsLabel: string;
  saveButton: string;
  savedNotice: string;
  phraseRequired: string;
  spanishEquivalentRequired: string;
  genericError: string;
}

interface IdiomRow {
  id: string;
  category: IdiomCategory;
  level: StoryLevel;
  phrase: string;
  literalTranslation: string;
  spanishEquivalent: string;
  explanation: string;
  contextExampleRu: string;
  contextExampleEs: string;
}

const emptyForm = {
  id: null as string | null,
  category: idiomCategories[0] as IdiomCategory,
  level: "A2" as StoryLevel,
  phrase: "",
  literalTranslation: "",
  spanishEquivalent: "",
  explanation: "",
  contextExampleRu: "",
  contextExampleEs: "",
};

export default function IdiomAdminApp({ dict }: { dict: IdiomAdminDict }) {
  const [idioms, setIdioms] = useState<IdiomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<IdiomCategory | "all">("all");
  const [levelFilter, setLevelFilter] = useState<StoryLevel | "all">("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/idioms")
      .then((res) => (res.ok ? res.json() : { idioms: [] }))
      .then((body: { idioms?: IdiomRow[] }) => {
        setIdioms(body.idioms ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const categoryTabs: { value: IdiomCategory | "all"; label: string }[] = [
    { value: "all", label: dict.categoryAllLabel },
    { value: "daily", label: dict.categoryDailyLabel },
    { value: "proverbs", label: dict.categoryProverbsLabel },
    { value: "literary", label: dict.categoryLiteraryLabel },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return idioms.filter((idiom) => {
      if (categoryFilter !== "all" && idiom.category !== categoryFilter) return false;
      if (levelFilter !== "all" && idiom.level !== levelFilter) return false;
      if (!query) return true;
      return idiom.phrase.toLowerCase().includes(query) || idiom.spanishEquivalent.toLowerCase().includes(query);
    });
  }, [idioms, categoryFilter, levelFilter, search]);

  function startEdit(row: IdiomRow) {
    setSaved(false);
    setError(null);
    setForm({ ...row });
  }

  function startNew() {
    setSaved(false);
    setError(null);
    setForm(emptyForm);
  }

  async function save() {
    if (!form) return;
    setError(null);
    if (!form.phrase.trim()) return setError(dict.phraseRequired);
    if (!form.spanishEquivalent.trim()) return setError(dict.spanishEquivalentRequired);

    const res = await fetch("/api/admin/idioms/save", {
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
    await fetch("/api/admin/idioms/delete", {
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
            onChange={(e) => setCategoryFilter(e.target.value as IdiomCategory | "all")}
            className="rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
          >
            {categoryTabs.map((tab) => (
              <option key={tab.value} value={tab.value}>
                {tab.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-foreground/70">{dict.levelFilterLabel}</span>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as StoryLevel | "all")}
            className="rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
          >
            <option value="all">{dict.levelAllLabel}</option>
            {idiomLevels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={dict.searchPlaceholder}
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
        />
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
                onChange={(e) => setForm({ ...form, category: e.target.value as IdiomCategory })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              >
                {idiomCategories.map((c) => (
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
                onChange={(e) => setForm({ ...form, level: e.target.value as StoryLevel })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              >
                {idiomLevels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.phraseLabel}</span>
              <input
                value={form.phrase}
                onChange={(e) => setForm({ ...form, phrase: e.target.value })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-foreground/70">{dict.literalTranslationLabel}</span>
              <input
                value={form.literalTranslation}
                onChange={(e) => setForm({ ...form, literalTranslation: e.target.value })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-foreground/70">{dict.spanishEquivalentLabel}</span>
              <input
                value={form.spanishEquivalent}
                onChange={(e) => setForm({ ...form, spanishEquivalent: e.target.value })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-foreground/70">{dict.explanationLabel}</span>
              <textarea
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.contextExampleRuLabel}</span>
              <textarea
                value={form.contextExampleRu}
                onChange={(e) => setForm({ ...form, contextExampleRu: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.contextExampleEsLabel}</span>
              <textarea
                value={form.contextExampleEs}
                onChange={(e) => setForm({ ...form, contextExampleEs: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
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

      {!loading && filtered.length === 0 && <p className="mt-6 text-sm text-foreground/60">{dict.emptyState}</p>}

      {filtered.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50 dark:border-white/10">
                <th className="px-4 py-2">{dict.phraseHeader}</th>
                <th className="px-4 py-2">{dict.categoryHeader}</th>
                <th className="px-4 py-2">{dict.levelHeader}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5">«{row.phrase}»</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium">{row.category}</span>
                  </td>
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
