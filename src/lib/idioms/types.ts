export type IdiomCategory = "daily" | "proverbs" | "literary";

export const idiomCategories: IdiomCategory[] = ["daily", "proverbs", "literary"];

export interface Idiom {
  id: string;
  phrase: string;
  literalTranslation: string;
  spanishEquivalent: string;
  explanation: string;
  contextExampleRu: string;
  contextExampleEs: string;
  category: IdiomCategory;
}
