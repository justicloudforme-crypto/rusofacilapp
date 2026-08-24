import type { Dictionary } from "@/i18n/dictionaries";
import type { AvatarId, Character } from "@/lib/avatars";

// Shared between every place that needs a human-readable label for an
// avatar id or character (profile picker, group member lists, public
// profile pages) so the 23-entry mapping lives in exactly one place.
export function getAvatarLabels(dict: Dictionary): Record<AvatarId, string> {
  return {
    matryoshka_calm: dict.profile.avatarCalm,
    matryoshka_happy: dict.profile.avatarHappy,
    matryoshka_wink: dict.profile.avatarWink,
    matryoshka_surprised: dict.profile.avatarSurprised,
    matryoshka_sleepy: dict.profile.avatarSleepy,
    matryoshka_proud: dict.profile.avatarProud,
    matryoshka_thinking: dict.profile.avatarThinking,
    matryoshka_laughing: dict.profile.avatarLaughing,
    snowman_calm: dict.profile.avatarSnowmanCalm,
    snowman_happy: dict.profile.avatarSnowmanHappy,
    snowman_wink: dict.profile.avatarSnowmanWink,
    bear_calm: dict.profile.avatarBearCalm,
    bear_happy: dict.profile.avatarBearHappy,
    bear_wink: dict.profile.avatarBearWink,
    bogatyr_calm: dict.profile.avatarBogatyrCalm,
    bogatyr_happy: dict.profile.avatarBogatyrHappy,
    bogatyr_proud: dict.profile.avatarBogatyrProud,
    fox_calm: dict.profile.avatarFoxCalm,
    fox_happy: dict.profile.avatarFoxHappy,
    fox_wink: dict.profile.avatarFoxWink,
    girl_calm: dict.profile.avatarGirlCalm,
    girl_happy: dict.profile.avatarGirlHappy,
    girl_wink: dict.profile.avatarGirlWink,
  };
}

export function getCharacterLabels(dict: Dictionary): Record<Character, string> {
  return {
    matryoshka: dict.profile.avatarCharacterMatryoshka,
    snowman: dict.profile.avatarCharacterSnowman,
    bear: dict.profile.avatarCharacterBear,
    bogatyr: dict.profile.avatarCharacterBogatyr,
    fox: dict.profile.avatarCharacterFox,
    girl: dict.profile.avatarCharacterGirl,
  };
}
