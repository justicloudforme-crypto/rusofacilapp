// Predefined matryoshka avatar catalog. Deliberately just string IDs — the
// server (User.avatarId) never stores or serves an image, only ever one of
// these strings. Rendering happens entirely client-side via
// MatryoshkaAvatar.tsx, which maps an id to a face expression drawn with
// plain CSS shapes (same technique as MatryoshkaMark.tsx's brand mark) —
// there is no image file, upload, or CDN involved anywhere in this feature.
export const AVATAR_IDS = [
  "matryoshka_calm",
  "matryoshka_happy",
  "matryoshka_wink",
  "matryoshka_surprised",
  "matryoshka_sleepy",
  "matryoshka_proud",
  "matryoshka_thinking",
  "matryoshka_laughing",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const DEFAULT_AVATAR_ID: AvatarId = "matryoshka_calm";

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}
