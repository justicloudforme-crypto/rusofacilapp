import type { FlashcardCategory } from "./types";

// One emoji per category tile on the /vocabulary category grid — plain code,
// not translated content (an emoji reads the same in ES and RU), so it lives
// here instead of the dictionaries.
export const flashcardCategoryIcons: Record<FlashcardCategory, string> = {
  food: "🍽️",
  shopping: "🛍️",
  city: "🚇",
  work: "💼",
  family: "👨‍👩‍👧",
  health: "🩺",
  feelings: "❤️",
  motionVerbs: "🏃",
  greetings: "👋",
  technology: "💻",
  travel: "✈️",
  weather: "⛅",
  clothing: "👕",
  art: "🎨",
  society: "📰",
  abstract: "💭",
  connectors: "🔗",
  science: "🔬",
  politics: "🏛️",
  psychology: "🧠",
  synonymsAntonyms: "↔️",
};
