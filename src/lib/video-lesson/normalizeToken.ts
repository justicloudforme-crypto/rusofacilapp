/** Strips punctuation and lowercases a Russian word so it can be matched against a glossary key. */
export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[^а-яёa-z0-9]+|[^а-яёa-z0-9]+$/gi, "");
}
