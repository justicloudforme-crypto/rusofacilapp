// Predefined avatar catalog. Deliberately just string IDs — the server
// (User.avatarId) never stores or serves an image, only ever one of these
// strings. Rendering happens entirely client-side via
// avatars/MatryoshkaAvatar.tsx, which maps an id to a character + face
// expression drawn with plain CSS shapes (same technique as
// MatryoshkaMark.tsx's brand mark) — there is no image file, upload, or CDN
// involved anywhere in this feature.
//
// Six characters, each `${character}_${expression}`. matryoshka keeps its
// original 8 expressions (existing users' avatarId values must stay valid);
// the five added later ship with 3 each, which is plenty of choice without
// the "identical dolls" clutter the original 8-across grid had.
export const CHARACTERS = ["matryoshka", "snowman", "bear", "bogatyr", "fox", "girl"] as const;
export type Character = (typeof CHARACTERS)[number];

export const AVATAR_IDS = [
  "matryoshka_calm",
  "matryoshka_happy",
  "matryoshka_wink",
  "matryoshka_surprised",
  "matryoshka_sleepy",
  "matryoshka_proud",
  "matryoshka_thinking",
  "matryoshka_laughing",
  "snowman_calm",
  "snowman_happy",
  "snowman_wink",
  "bear_calm",
  "bear_happy",
  "bear_wink",
  "bogatyr_calm",
  "bogatyr_happy",
  "bogatyr_proud",
  "fox_calm",
  "fox_happy",
  "fox_wink",
  "girl_calm",
  "girl_happy",
  "girl_wink",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const DEFAULT_AVATAR_ID: AvatarId = "matryoshka_calm";

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}

export function characterOf(id: AvatarId): Character {
  return id.slice(0, id.lastIndexOf("_")) as Character;
}

export function avatarIdsForCharacter(character: Character): AvatarId[] {
  return AVATAR_IDS.filter((id) => characterOf(id) === character);
}
