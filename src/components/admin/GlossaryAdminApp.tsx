"use client";

import { useEffect, useState } from "react";
import { glossaryCategories, type GlossaryCategory, type GlossaryExample } from "@/lib/glossary";

export interface GlossaryAdminDict {
  termHeader: string;
  russianHeader: string;
  categoryHeader: string;
  newButton: string;
  editButton: string;
  deleteButton: string;
  cancelButton: string;
  emptyState: string;
  termLabel: string;
  definitionLabel: string;
  russianEquivalentLabel: string;
  transcriptionLabel: string;
  russianComparisonLabel: string;
  categoryLabel: string;
  examplesLabel: string;
  exampleEsPlaceholder: string;
  exampleRuPlaceholder: string;
  addExampleLabel: string;
  removeExampleLabel: string;
  saveButton: string;
  savedNotice: string;
  termRequired: string;
  definitionRequired: string;
  russianEquivalentRequired: string;
  genericError: string;
}

interface GlossaryTermRow {
  id: string;
  slug: string;
  term: string;
  definition: string;
  russianEquivalent: string;
  transcription: string | null;
  category: GlossaryCategory;
  russianComparison: string | null;
  examples: GlossaryExample[];
}

const emptyForm = {
  id: null as string | null,
  term: "",
  definition: "",
  russianEquivalent: "",
  transcription: "",
  category: glossaryCategories[0] as GlossaryCategory,
  russianComparison: "",
  examples: [] as GlossaryExample[],
};

export default function GlossaryAdminApp({ dict }: { dict: GlossaryAdminDict }) {
  const [terms, setTerms] = useState<GlossaryTermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/glossary")
      .then((res) => (res.ok ? res.json() : { terms: [] }))
      .then((body: { terms?: GlossaryTermRow[] }) => {
        setTerms(body.terms ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  function startEdit(row: GlossaryTermRow) {
    setSaved(false);
    setError(null);
    setForm({
      id: row.id,
      term: row.term,
      definition: row.definition,
      russianEquivalent: row.russianEquivalent,
      transcription: row.transcription ?? "",
      category: row.category,
      russianComparison: row.russianComparison ?? "",
      examples: row.examples,
    });
  }

  function updateExample(index: number, field: "es" | "ru", value: string) {
    if (!form) return;
    const examples = form.examples.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex));
    setForm({ ...form, examples });
  }

  function addExample() {
    if (!form) return;
    setForm({ ...form, examples: [...form.examples, { es: "", ru: "" }] });
  }

  function removeExample(index: number) {
    if (!form) return;
    setForm({ ...form, examples: form.examples.filter((_, i) => i !== index) });
  }

  function startNew() {
    setSaved(false);
    setError(null);
    setForm(emptyForm);
  }

  async function save() {
    if (!form) return;
    setError(null);
    if (!form.term.trim()) return setError(dict.termRequired);
    if (!form.definition.trim()) return setError(dict.definitionRequired);
    if (!form.russianEquivalent.trim()) return setError(dict.russianEquivalentRequired);

    const res = await fetch("/api/admin/glossary/save", {
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
    await fetch("/api/admin/glossary/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
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
        <div className="mt-4 rounded-xl border border-black/10 p-4 dark:border-white/30">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.termLabel}</span>
              <input
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-foreground/70">{dict.russianEquivalentLabel}</span>
              <input
                value={form.russianEquivalent}
                onChange={(e) => setForm({ ...form, russianEquivalent: e.target.value })}
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
              <span className="mb-1 block text-foreground/70">{dict.categoryLabel}</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as GlossaryCategory })}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              >
                {glossaryCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-foreground/70">{dict.definitionLabel}</span>
              <textarea
                value={form.definition}
                onChange={(e) => setForm({ ...form, definition: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-foreground/70">{dict.russianComparisonLabel}</span>
              <textarea
                value={form.russianComparison}
                onChange={(e) => setForm({ ...form, russianComparison: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 outline-none focus:border-foreground/40 dark:border-white/15"
              />
            </label>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-sm text-foreground/70">{dict.examplesLabel}</span>
              <div className="flex flex-col gap-2">
                {form.examples.map((example, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={example.es}
                      onChange={(e) => updateExample(i, "es", e.target.value)}
                      placeholder={dict.exampleEsPlaceholder}
                      className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
                    />
                    <input
                      value={example.ru}
                      onChange={(e) => updateExample(i, "ru", e.target.value)}
                      placeholder={dict.exampleRuPlaceholder}
                      className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
                    />
                    <button
                      type="button"
                      onClick={() => removeExample(i)}
                      aria-label={dict.removeExampleLabel}
                      className="flex-shrink-0 rounded-lg border border-black/10 px-2.5 text-foreground/50 hover:border-red-300 hover:text-red-600 dark:border-white/15"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addExample}
                  className="w-fit text-sm font-medium text-foreground/70 hover:text-foreground"
                >
                  + {dict.addExampleLabel}
                </button>
              </div>
            </div>
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

      {!loading && terms.length === 0 && (
        <p className="mt-6 text-sm text-foreground/60">{dict.emptyState}</p>
      )}

      {terms.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50 dark:border-white/30">
                <th className="px-4 py-2">{dict.termHeader}</th>
                <th className="px-4 py-2">{dict.russianHeader}</th>
                <th className="px-4 py-2">{dict.categoryHeader}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {terms.map((row) => (
                <tr key={row.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5">{row.term}</td>
                  <td className="px-4 py-2.5 text-foreground/70">{row.russianEquivalent}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium">
                      {row.category}
                    </span>
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
