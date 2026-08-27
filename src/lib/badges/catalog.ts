import type { Locale } from "@/i18n/config";

export type BadgeCategory = "streak" | "exam" | "case" | "vocab";

export interface BadgeDef {
  id: string;
  category: BadgeCategory;
  icon: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
}

// Bilingual title/description live here, not in src/dictionaries/*.json —
// same pattern as src/lib/legal/content.ts. This is structured content
// tied one-to-one with a badge's id/icon/condition (see index.ts), not
// generic interface chrome, so keeping it in one file avoids bloating the
// UI dictionaries with ~20 entries that are meaningless without their
// matching catalog row next to them.
export const BADGE_CATALOG: BadgeDef[] = [
  // --- Streak badges ---------------------------------------------------
  {
    id: "streak-3",
    category: "streak",
    // Streak badges progress through the metaphor of one path (sprout →
    // flame → star → crown) rather than 4 copies of the same 🔥, which
    // made them visually indistinguishable in a locked/earned grid.
    icon: "🌱",
    title: { es: "Primeros pasos", ru: "Первые шаги" },
    description: {
      es: "3 días seguidos de práctica.",
      ru: "3 дня подряд занятий.",
    },
  },
  {
    id: "streak-7",
    category: "streak",
    icon: "🔥",
    title: { es: "Semana completa", ru: "Целая неделя" },
    description: {
      es: "7 días seguidos de práctica.",
      ru: "7 дней подряд занятий.",
    },
  },
  {
    id: "streak-30",
    category: "streak",
    // Not ⭐ — that's already the "premium content" marker on story cards
    // (PremiumBadge icon="⭐"); 🌟 (glowing star) reads as a different
    // shape/color at badge-tile size instead of colliding with that.
    icon: "🌟",
    title: { es: "Un mes de constancia", ru: "Месяц упорства" },
    description: {
      es: "30 días seguidos de práctica.",
      ru: "30 дней подряд занятий.",
    },
  },
  {
    id: "streak-100",
    category: "streak",
    // Not 👑 — that's already the premium/subscription crown everywhere
    // else in the app (PremiumBadge, pricing, /profile subscription tab);
    // reusing it here would make it look like a paid-tier marker.
    icon: "💎",
    title: { es: "Cien días", ru: "Сто дней" },
    description: {
      es: "100 días seguidos de práctica.",
      ru: "100 дней подряд занятий.",
    },
  },

  // --- Exam milestone badges -------------------------------------------
  {
    id: "first-exam",
    category: "exam",
    icon: "📝",
    title: { es: "Primer examen", ru: "Первый экзамен" },
    description: {
      es: "Aprobaste tu primer examen.",
      ru: "Сдал(а) первый экзамен.",
    },
  },
  {
    id: "perfect-score",
    category: "exam",
    icon: "💯",
    title: { es: "Puntuación perfecta", ru: "Идеальный результат" },
    description: {
      es: "100% en un examen.",
      ru: "100% на экзамене.",
    },
  },
  {
    id: "graduate-a1",
    category: "exam",
    icon: "🎓",
    title: { es: "Graduado A1", ru: "Выпускник A1" },
    description: {
      es: "Aprobaste los 3 exámenes del nivel A1.",
      ru: "Сдал(а) все 3 экзамена уровня A1.",
    },
  },
  {
    id: "graduate-a2",
    category: "exam",
    icon: "🎓",
    title: { es: "Graduado A2", ru: "Выпускник A2" },
    description: {
      es: "Aprobaste los 3 exámenes del nivel A2.",
      ru: "Сдал(а) все 3 экзамена уровня A2.",
    },
  },
  {
    id: "graduate-b1",
    category: "exam",
    icon: "🎓",
    title: { es: "Graduado B1", ru: "Выпускник B1" },
    description: {
      es: "Aprobaste los 3 exámenes del nivel B1.",
      ru: "Сдал(а) все 3 экзамена уровня B1.",
    },
  },
  {
    id: "graduate-b2",
    category: "exam",
    icon: "🎓",
    title: { es: "Graduado B2", ru: "Выпускник B2" },
    description: {
      es: "Aprobaste los 3 exámenes del nivel B2.",
      ru: "Сдал(а) все 3 экзамена уровня B2.",
    },
  },

  // --- Case/grammar mastery badges -------------------------------------
  // Each fires on a 100% score in any exam skill area whose id contains
  // the matching keyword — see CASE_BADGE_KEYWORDS in index.ts. Skill area
  // ids come from src/lib/exams/content.json (e.g. "genitive-block",
  // "dative-adjectives-pronouns", "prepositional-location").
  {
    id: "genitive-master",
    category: "case",
    icon: "🏆",
    title: { es: "Maestro del genitivo", ru: "Мастер родительного падежа" },
    description: {
      es: "100% en un bloque de caso genitivo.",
      ru: "100% в блоке родительного падежа.",
    },
  },
  {
    id: "dative-master",
    category: "case",
    icon: "🏆",
    title: { es: "Maestro del dativo", ru: "Мастер дательного падежа" },
    description: {
      es: "100% en un bloque de caso dativo.",
      ru: "100% в блоке дательного падежа.",
    },
  },
  {
    id: "accusative-master",
    category: "case",
    icon: "🏆",
    title: { es: "Maestro del acusativo", ru: "Мастер винительного падежа" },
    description: {
      es: "100% en un bloque de caso acusativo.",
      ru: "100% в блоке винительного падежа.",
    },
  },
  {
    id: "instrumental-master",
    category: "case",
    icon: "🏆",
    title: { es: "Maestro del instrumental", ru: "Мастер творительного падежа" },
    description: {
      es: "100% en un bloque de caso instrumental.",
      ru: "100% в блоке творительного падежа.",
    },
  },
  {
    id: "prepositional-master",
    category: "case",
    icon: "🏆",
    title: { es: "Maestro del preposicional", ru: "Мастер предложного падежа" },
    description: {
      es: "100% en un bloque de caso preposicional.",
      ru: "100% в блоке предложного падежа.",
    },
  },
  {
    id: "motion-verbs-master",
    category: "case",
    icon: "🚶",
    title: { es: "Maestro de los verbos de movimiento", ru: "Мастер глаголов движения" },
    description: {
      es: "100% en un bloque de verbos de movimiento.",
      ru: "100% в блоке глаголов движения.",
    },
  },
  {
    id: "aspect-master",
    category: "case",
    icon: "⏳",
    title: { es: "Maestro del aspecto verbal", ru: "Мастер вида глагола" },
    description: {
      es: "100% en un bloque de aspecto verbal.",
      ru: "100% в блоке вида глагола.",
    },
  },
  {
    id: "participle-master",
    category: "case",
    icon: "📜",
    title: { es: "Maestro de los participios", ru: "Мастер причастий" },
    description: {
      es: "100% en un bloque de participios.",
      ru: "100% в блоке причастий.",
    },
  },

  // --- Vocabulary size badges -------------------------------------------
  {
    id: "vocab-50",
    category: "vocab",
    icon: "📚",
    title: { es: "50 palabras", ru: "50 слов" },
    description: {
      es: "50 tarjetas marcadas como conocidas.",
      ru: "50 карточек отмечены как выученные.",
    },
  },
  {
    id: "vocab-200",
    category: "vocab",
    icon: "📚",
    title: { es: "200 palabras", ru: "200 слов" },
    description: {
      es: "200 tarjetas marcadas como conocidas.",
      ru: "200 карточек отмечены как выученные.",
    },
  },
  {
    id: "vocab-500",
    category: "vocab",
    icon: "📚",
    title: { es: "500 palabras", ru: "500 слов" },
    description: {
      es: "500 tarjetas marcadas como conocidas.",
      ru: "500 карточек отмечены как выученные.",
    },
  },
];

export function getBadgeDef(badgeId: string): BadgeDef | undefined {
  return BADGE_CATALOG.find((b) => b.id === badgeId);
}
