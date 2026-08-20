import type { FlashcardCategory } from "./types";

// Background tint for the emoji badge on each /vocabulary category tile —
// picked per category (not hashed) so the color has some thematic logic
// (weather = sky blue, health = red, nature-adjacent = green, etc.)
// instead of an arbitrary assignment. Kept as a light tint (/15 opacity) so
// it reads on both the light and dark theme without a separate dark variant.
export const flashcardCategoryIconColors: Record<FlashcardCategory, string> = {
  food: "bg-orange-500/15",
  shopping: "bg-pink-500/15",
  city: "bg-slate-500/15",
  work: "bg-blue-500/15",
  family: "bg-rose-500/15",
  health: "bg-red-500/15",
  feelings: "bg-fuchsia-500/15",
  motionVerbs: "bg-lime-500/15",
  greetings: "bg-yellow-500/15",
  technology: "bg-indigo-500/15",
  travel: "bg-cyan-500/15",
  weather: "bg-sky-500/15",
  clothing: "bg-purple-500/15",
  art: "bg-violet-500/15",
  society: "bg-stone-500/15",
  abstract: "bg-teal-500/15",
  connectors: "bg-emerald-500/15",
  science: "bg-green-500/15",
  politics: "bg-amber-500/15",
  psychology: "bg-fuchsia-500/15",
  synonymsAntonyms: "bg-neutral-500/15",
  sport: "bg-lime-500/15",
  law: "bg-amber-500/15",
};
