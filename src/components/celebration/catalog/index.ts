import type { ComponentType } from "react";

// Single source of truth for every pre-made celebration scenario — win
// (CelebrationModal) and fail (EncouragementModal) alike.
//
// This is a CATALOG, not a generator: every entry below is a real,
// hand-built component living under a theme folder next to this file
// (characters/, music/, home/, patterns/, seasons/, fail/ — add a new
// theme folder freely as the catalog grows, `fail/` itself can grow its
// own theme subfolders the same way once it outgrows a flat list). Nothing
// here is computed or procedurally assembled at random — the two modals
// just pick an id from this list and ScenarioStage.tsx loads that one
// component. Scaling to hundreds of scenarios means adding hundreds of
// small files here, not writing a generator.
//
// `load` is a dynamic import, not a static one — ScenarioStage wraps it in
// next/dynamic so the JS for a scenario is only fetched the first time it's
// actually chosen. That's what keeps this scalable: the catalog's size on
// disk has no relationship to what any one visitor's browser downloads.
//
// To add a new scenario:
//   1. Create the component under the right theme folder (or a new one),
//      following the story-beat comment convention at the top of any
//      existing file — name each animation phase and its rough timing so
//      the CSS keyframes it references stay readable on their own.
//   2. Add one entry below with a unique id, its outcome, and its category.
// CelebrationModal, EncouragementModal, ScenarioStage, and every existing
// scenario are completely untouched by that change.

export type ScenarioId =
  // Win — everyday
  | "matryoshka"
  | "samovar"
  | "winter"
  | "khokhloma"
  | "accordion"
  | "kalinka"
  | "shawl"
  | "pancakes"
  | "stove-fire"
  | "izba"
  | "nalichniki"
  | "samovar-overflow-joy"
  | "accordion-victory-wheeze"
  | "snowman-disco"
  | "spoons-virtuoso"
  | "bear-ice-skating"
  | "snowman-snow-angel"
  | "matryoshka-florist"
  | "bear-hairdresser"
  | "accordion-conductor"
  | "bear-gusli"
  | "matryoshka-yoga"
  | "bear-ushanka-victory-toss"
  | "bear-ice-fishing"
  | "rabbit-carrot-victory"
  | "matryoshka-sparkler"
  | "bear-valenki-dance"
  | "matryoshka-shawl-twirl"
  | "snowman-sledding"
  | "bear-bakes-karavai"
  | "matryoshka-ribbon-dance"
  | "snowman-icicle-xylophone"
  | "bear-banya-broom"
  | "matryoshka-paints-egg"
  | "snowman-snowball-juggle"
  | "bear-honey-jar-victory"
  | "matryoshka-birch-branch-dance"
  | "rabbit-snowball-toss"
  | "bear-snow-fort"
  | "snowman-ice-skating-duo"
  | "matryoshka-painted-fan"
  | "samovar-boil-tea"
  | "matryoshka-pancake-flip"
  | "bear-balalaika-fireside"
  | "matryoshka-valenki-tap-dance"
  | "garmoshka-stretch-tune"
  | "matryoshka-steady-rock"
  | "banya-steam-refresh"
  | "medved-wave-greet"
  | "medved-snow-catch"
  | "matryoshka-defrost-glow"
  | "matryoshka-warmup-dance"
  | "matryoshka-pancake-boomerang"
  | "bear-berry-gather"
  | "balalaika-serenade-strum"
  | "bear-honey-happy-eat"
  | "bear-snowball-hit"
  | "samovar-cozy-steam"
  | "matryoshka-nest-open"
  | "bear-active-march"
  | "balalaika-music-swirl"
  | "matryoshka-pancake-stack-neat"
  | "hare-hat-bouquet"
  | "matryoshka-carpet-flight"
  // Win — streak
  | "balalaika-party"
  | "bear-smoking-balalaika"
  | "matryoshka-juggler"
  | "samovar-confetti-fountain"
  | "snowman-conga-line"
  | "troika-bells-jingle"
  | "khokhloma-spinning-top"
  | "matryoshka-kokoshnik-sparkle"
  | "matryoshka-firebird-feather"
  | "khokhloma-bowl-stack"
  | "karusel-ice-spin"
  | "character-choir-sing"
  | "matryoshka-pike-wish-grant"
  // Win — milestone
  | "bear"
  | "matryoshka-kazachok-parade"
  | "bear-barista"
  | "ushanka-helicopter"
  | "balalaika-rock-star"
  | "troika-sled"
  | "izba-fireworks"
  | "samovar-steam-genie"
  | "bear-bell-ringer"
  | "bear-sled-gift-delivery"
  | "troika-snow-spray"
  | "bear-snowball-grow-giant"
  // Fail — everyday
  | "bear-tosses-ushanka"
  | "matryoshka-balalaika-string-snap"
  | "snowman-knitting-sad"
  | "samovar-cools-down"
  | "sleepy-bear-naps"
  | "samovar-cries-puff"
  | "ushanka-hides"
  | "snowball-letters"
  | "accordion-hiccups"
  | "matryoshka-lost-inside"
  | "bear-drops-pelmeni"
  | "matryoshka-layers-fan"
  | "bear-honey-barrel-stuck"
  | "accordion-deflate"
  | "snowman-melts-blush"
  | "snowman-hat-blown-away"
  | "spoons-fumble"
  | "balalaika-out-of-tune"
  | "matryoshka-dizzy-spin"
  | "bear-fish-slips-away"
  | "nalichniki-crack"
  | "gusli-string-snap"
  | "bear-valenki-slip"
  | "matryoshka-shawl-tangle"
  | "snowman-sledding-crash"
  | "bear-karavai-burnt"
  | "matryoshka-ribbon-tangle"
  | "snowman-icicle-crack"
  | "bear-banya-broom-drop"
  | "snowman-snowball-juggle-drop"
  | "matryoshka-kokoshnik-tilt"
  | "bear-honey-jar-spill"
  | "matryoshka-birch-branch-wilt"
  | "rabbit-snowball-backfire"
  | "bear-snow-fort-collapse"
  | "snowman-ice-skate-spill"
  | "matryoshka-fan-snap"
  | "samovar-lid-rattle"
  | "pancake-splat"
  | "bear-balalaika-string-snap"
  | "bear-valenki-snow-trip"
  | "garmoshka-jam-clank"
  | "matryoshka-topple-over"
  | "banya-fog-slip"
  | "medved-barrel-trip"
  | "karusel-halt-spin"
  | "medved-bucket-splash"
  | "matryoshka-ice-shatter"
  | "bear-shiver-smoke"
  | "pancake-face-splat"
  | "bear-vacuum-oops"
  | "balalaika-run-away"
  | "bear-honey-head-stuck"
  | "bear-wind-boomerang"
  | "samovar-rocket-spin"
  | "matryoshka-spook-spin"
  | "character-choir-freeze"
  | "bear-sleep-faceplant"
  | "balalaika-rocket-oops"
  | "domovoy-pancake-prank"
  | "hare-hat-fail-boot"
  | "carpet-unroll-dump"
  | "pike-splash-escape"
  | "bear-snowball-flatten";

export type ScenarioOutcome = "win" | "fail";

// "everyday" scenarios are the pool a modal randomizes across for routine
// moments (a lesson pass, a wrong answer, a mini-game round). "streak" and
// "milestone" are held back from that pool — reserved for a flow to opt
// into explicitly by id (a correct-answer streak, a level-up/exam/badge),
// so they still read as special rather than blending into the everyday
// rotation. Fail scenarios currently only use "everyday" — there's no
// concept of a fail-streak or fail-milestone yet, but the type allows one
// the moment a flow needs it.
export type ScenarioCategory = "everyday" | "streak" | "milestone";

export interface ScenarioEntry {
  id: ScenarioId;
  outcome: ScenarioOutcome;
  category: ScenarioCategory;
  load: () => Promise<{ default: ComponentType }>;
}

export const SCENARIOS: ScenarioEntry[] = [
  // ---- win / everyday ----
  { id: "matryoshka", outcome: "win", category: "everyday", load: () => import("./characters/Matryoshka") },
  { id: "samovar", outcome: "win", category: "everyday", load: () => import("./home/Samovar") },
  { id: "winter", outcome: "win", category: "everyday", load: () => import("./seasons/Winter") },
  { id: "khokhloma", outcome: "win", category: "everyday", load: () => import("./patterns/Khokhloma") },
  { id: "accordion", outcome: "win", category: "everyday", load: () => import("./music/Accordion") },
  { id: "kalinka", outcome: "win", category: "everyday", load: () => import("./music/Kalinka") },
  { id: "shawl", outcome: "win", category: "everyday", load: () => import("./patterns/Shawl") },
  { id: "pancakes", outcome: "win", category: "everyday", load: () => import("./home/Pancakes") },
  { id: "stove-fire", outcome: "win", category: "everyday", load: () => import("./home/StoveFire") },
  { id: "izba", outcome: "win", category: "everyday", load: () => import("./home/Izba") },
  { id: "nalichniki", outcome: "win", category: "everyday", load: () => import("./patterns/Nalichniki") },
  { id: "samovar-overflow-joy", outcome: "win", category: "everyday", load: () => import("./home/SamovarOverflowJoy") },
  { id: "accordion-victory-wheeze", outcome: "win", category: "everyday", load: () => import("./music/AccordionVictoryWheeze") },
  { id: "snowman-disco", outcome: "win", category: "everyday", load: () => import("./seasons/SnowmanDisco") },
  { id: "spoons-virtuoso", outcome: "win", category: "everyday", load: () => import("./music/SpoonsVirtuoso") },
  { id: "bear-ice-skating", outcome: "win", category: "everyday", load: () => import("./characters/BearIceSkating") },
  { id: "snowman-snow-angel", outcome: "win", category: "everyday", load: () => import("./seasons/SnowmanSnowAngel") },
  { id: "matryoshka-florist", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaFlorist") },
  { id: "bear-hairdresser", outcome: "win", category: "everyday", load: () => import("./characters/BearHairdresser") },
  { id: "accordion-conductor", outcome: "win", category: "everyday", load: () => import("./music/AccordionConductor") },
  { id: "bear-gusli", outcome: "win", category: "everyday", load: () => import("./music/BearGusli") },
  { id: "matryoshka-yoga", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaYoga") },
  { id: "bear-ushanka-victory-toss", outcome: "win", category: "everyday", load: () => import("./characters/BearUshankaVictoryToss") },
  { id: "bear-ice-fishing", outcome: "win", category: "everyday", load: () => import("./characters/BearIceFishing") },
  { id: "rabbit-carrot-victory", outcome: "win", category: "everyday", load: () => import("./seasons/RabbitCarrotVictory") },
  { id: "matryoshka-sparkler", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaSparkler") },
  { id: "bear-valenki-dance", outcome: "win", category: "everyday", load: () => import("./characters/BearValenkiDance") },
  { id: "matryoshka-shawl-twirl", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaShawlTwirl") },
  { id: "snowman-sledding", outcome: "win", category: "everyday", load: () => import("./seasons/SnowmanSledding") },
  { id: "bear-bakes-karavai", outcome: "win", category: "everyday", load: () => import("./home/BearBakesKaravai") },
  { id: "matryoshka-ribbon-dance", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaRibbonDance") },
  { id: "snowman-icicle-xylophone", outcome: "win", category: "everyday", load: () => import("./seasons/SnowmanIcicleXylophone") },
  { id: "bear-banya-broom", outcome: "win", category: "everyday", load: () => import("./characters/BearBanyaBroom") },
  { id: "matryoshka-paints-egg", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaPaintsEgg") },
  { id: "snowman-snowball-juggle", outcome: "win", category: "everyday", load: () => import("./seasons/SnowmanSnowballJuggle") },
  { id: "bear-honey-jar-victory", outcome: "win", category: "everyday", load: () => import("./characters/BearHoneyJarVictory") },
  { id: "matryoshka-birch-branch-dance", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaBirchBranchDance") },
  { id: "rabbit-snowball-toss", outcome: "win", category: "everyday", load: () => import("./seasons/RabbitSnowballToss") },
  { id: "bear-snow-fort", outcome: "win", category: "everyday", load: () => import("./seasons/BearSnowFort") },
  { id: "snowman-ice-skating-duo", outcome: "win", category: "everyday", load: () => import("./seasons/SnowmanIceSkatingDuo") },
  { id: "matryoshka-painted-fan", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaPaintedFan") },
  { id: "samovar-boil-tea", outcome: "win", category: "everyday", load: () => import("./home/SamovarBoilTea") },
  { id: "matryoshka-pancake-flip", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaPancakeFlip") },
  { id: "bear-balalaika-fireside", outcome: "win", category: "everyday", load: () => import("./characters/BearBalalaikaFireside") },
  { id: "matryoshka-valenki-tap-dance", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaValenkiTapDance") },
  { id: "garmoshka-stretch-tune", outcome: "win", category: "everyday", load: () => import("./music/GarmoshkaStretchTune") },
  { id: "matryoshka-steady-rock", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaSteadyRock") },
  { id: "banya-steam-refresh", outcome: "win", category: "everyday", load: () => import("./home/BanyaSteamRefresh") },
  { id: "medved-wave-greet", outcome: "win", category: "everyday", load: () => import("./characters/MedvedWaveGreet") },
  { id: "medved-snow-catch", outcome: "win", category: "everyday", load: () => import("./characters/MedvedSnowCatch") },
  { id: "matryoshka-defrost-glow", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaDefrostGlow") },
  { id: "matryoshka-warmup-dance", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaWarmupDance") },
  { id: "matryoshka-pancake-boomerang", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaPancakeBoomerang") },
  { id: "bear-berry-gather", outcome: "win", category: "everyday", load: () => import("./characters/BearBerryGather") },
  { id: "balalaika-serenade-strum", outcome: "win", category: "everyday", load: () => import("./music/BalalaikaSerenadeStrum") },
  { id: "bear-honey-happy-eat", outcome: "win", category: "everyday", load: () => import("./characters/BearHoneyHappyEat") },
  { id: "bear-snowball-hit", outcome: "win", category: "everyday", load: () => import("./seasons/BearSnowballHit") },
  { id: "samovar-cozy-steam", outcome: "win", category: "everyday", load: () => import("./home/SamovarCozySteam") },
  { id: "matryoshka-nest-open", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaNestOpen") },
  { id: "bear-active-march", outcome: "win", category: "everyday", load: () => import("./characters/BearActiveMarch") },
  { id: "balalaika-music-swirl", outcome: "win", category: "everyday", load: () => import("./music/BalalaikaMusicSwirl") },
  { id: "matryoshka-pancake-stack-neat", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaPancakeStackNeat") },
  { id: "hare-hat-bouquet", outcome: "win", category: "everyday", load: () => import("./characters/HareHatBouquet") },
  { id: "matryoshka-carpet-flight", outcome: "win", category: "everyday", load: () => import("./characters/MatryoshkaCarpetFlight") },

  // ---- win / streak (a correct-answer run — see RecallApp/FillBlankApp) ----
  { id: "balalaika-party", outcome: "win", category: "streak", load: () => import("./music/BalalaikaParty") },
  { id: "bear-smoking-balalaika", outcome: "win", category: "streak", load: () => import("./music/BearSmokingBalalaika") },
  { id: "matryoshka-juggler", outcome: "win", category: "streak", load: () => import("./characters/MatryoshkaJuggler") },
  { id: "samovar-confetti-fountain", outcome: "win", category: "streak", load: () => import("./home/SamovarConfettiFountain") },
  { id: "snowman-conga-line", outcome: "win", category: "streak", load: () => import("./seasons/SnowmanCongaLine") },
  { id: "troika-bells-jingle", outcome: "win", category: "streak", load: () => import("./characters/TroikaBellsJingle") },
  { id: "khokhloma-spinning-top", outcome: "win", category: "streak", load: () => import("./patterns/KhokhlomaSpinningTop") },
  { id: "matryoshka-kokoshnik-sparkle", outcome: "win", category: "streak", load: () => import("./characters/MatryoshkaKokoshnikSparkle") },
  { id: "matryoshka-firebird-feather", outcome: "win", category: "streak", load: () => import("./characters/MatryoshkaFirebirdFeather") },
  { id: "khokhloma-bowl-stack", outcome: "win", category: "streak", load: () => import("./patterns/KhokhlomaBowlStack") },
  { id: "karusel-ice-spin", outcome: "win", category: "streak", load: () => import("./characters/KaruselIceSpin") },
  { id: "character-choir-sing", outcome: "win", category: "streak", load: () => import("./characters/CharacterChoirSing") },
  { id: "matryoshka-pike-wish-grant", outcome: "win", category: "streak", load: () => import("./characters/MatryoshkaPikeWishGrant") },

  // ---- win / milestone (level-up, exam pass, badge — bigger than routine) ----
  { id: "bear", outcome: "win", category: "milestone", load: () => import("./characters/Bear") },
  { id: "matryoshka-kazachok-parade", outcome: "win", category: "milestone", load: () => import("./characters/MatryoshkaKazachokParade") },
  { id: "bear-barista", outcome: "win", category: "milestone", load: () => import("./home/BearBarista") },
  { id: "ushanka-helicopter", outcome: "win", category: "milestone", load: () => import("./characters/UshankaHelicopter") },
  { id: "balalaika-rock-star", outcome: "win", category: "milestone", load: () => import("./music/BalalaikaRockStar") },
  { id: "troika-sled", outcome: "win", category: "milestone", load: () => import("./characters/TroikaSled") },
  { id: "izba-fireworks", outcome: "win", category: "milestone", load: () => import("./home/IzbaFireworks") },
  { id: "samovar-steam-genie", outcome: "win", category: "milestone", load: () => import("./home/SamovarSteamGenie") },
  { id: "bear-bell-ringer", outcome: "win", category: "milestone", load: () => import("./characters/BearBellRinger") },
  { id: "bear-sled-gift-delivery", outcome: "win", category: "milestone", load: () => import("./characters/BearSledGiftDelivery") },
  { id: "troika-snow-spray", outcome: "win", category: "milestone", load: () => import("./characters/TroikaSnowSpray") },
  { id: "bear-snowball-grow-giant", outcome: "win", category: "milestone", load: () => import("./seasons/BearSnowballGrowGiant") },

  // ---- fail / everyday ----
  { id: "bear-tosses-ushanka", outcome: "fail", category: "everyday", load: () => import("./fail/BearTossesUshanka") },
  { id: "matryoshka-balalaika-string-snap", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaBalalaikaStringSnap") },
  { id: "snowman-knitting-sad", outcome: "fail", category: "everyday", load: () => import("./fail/SnowmanKnittingSad") },
  { id: "samovar-cools-down", outcome: "fail", category: "everyday", load: () => import("./fail/SamovarCoolsDown") },
  { id: "sleepy-bear-naps", outcome: "fail", category: "everyday", load: () => import("./fail/SleepyBearNaps") },
  { id: "samovar-cries-puff", outcome: "fail", category: "everyday", load: () => import("./fail/SamovarCriesPuff") },
  { id: "ushanka-hides", outcome: "fail", category: "everyday", load: () => import("./fail/UshankaHides") },
  { id: "snowball-letters", outcome: "fail", category: "everyday", load: () => import("./fail/SnowballLetters") },
  { id: "accordion-hiccups", outcome: "fail", category: "everyday", load: () => import("./fail/AccordionHiccups") },
  { id: "matryoshka-lost-inside", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaLostInside") },
  { id: "bear-drops-pelmeni", outcome: "fail", category: "everyday", load: () => import("./fail/BearDropsPelmeni") },
  { id: "matryoshka-layers-fan", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaLayersFan") },
  { id: "bear-honey-barrel-stuck", outcome: "fail", category: "everyday", load: () => import("./fail/BearHoneyBarrelStuck") },
  { id: "accordion-deflate", outcome: "fail", category: "everyday", load: () => import("./fail/AccordionDeflate") },
  { id: "snowman-melts-blush", outcome: "fail", category: "everyday", load: () => import("./fail/SnowmanMeltsBlush") },
  { id: "snowman-hat-blown-away", outcome: "fail", category: "everyday", load: () => import("./fail/SnowmanHatBlownAway") },
  { id: "spoons-fumble", outcome: "fail", category: "everyday", load: () => import("./fail/SpoonsFumble") },
  { id: "balalaika-out-of-tune", outcome: "fail", category: "everyday", load: () => import("./fail/BalalaikaOutOfTune") },
  { id: "matryoshka-dizzy-spin", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaDizzySpin") },
  { id: "bear-fish-slips-away", outcome: "fail", category: "everyday", load: () => import("./fail/BearFishSlipsAway") },
  { id: "nalichniki-crack", outcome: "fail", category: "everyday", load: () => import("./fail/NalichnikiCrack") },
  { id: "gusli-string-snap", outcome: "fail", category: "everyday", load: () => import("./fail/GusliStringSnap") },
  { id: "bear-valenki-slip", outcome: "fail", category: "everyday", load: () => import("./fail/BearValenkiSlip") },
  { id: "matryoshka-shawl-tangle", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaShawlTangle") },
  { id: "snowman-sledding-crash", outcome: "fail", category: "everyday", load: () => import("./fail/SnowmanSleddingCrash") },
  { id: "bear-karavai-burnt", outcome: "fail", category: "everyday", load: () => import("./fail/BearKaravaiBurnt") },
  { id: "matryoshka-ribbon-tangle", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaRibbonTangle") },
  { id: "snowman-icicle-crack", outcome: "fail", category: "everyday", load: () => import("./fail/SnowmanIcicleCrack") },
  { id: "bear-banya-broom-drop", outcome: "fail", category: "everyday", load: () => import("./fail/BearBanyaBroomDrop") },
  { id: "snowman-snowball-juggle-drop", outcome: "fail", category: "everyday", load: () => import("./fail/SnowmanSnowballJuggleDrop") },
  { id: "matryoshka-kokoshnik-tilt", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaKokoshnikTilt") },
  { id: "bear-honey-jar-spill", outcome: "fail", category: "everyday", load: () => import("./fail/BearHoneyJarSpill") },
  { id: "matryoshka-birch-branch-wilt", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaBirchBranchWilt") },
  { id: "rabbit-snowball-backfire", outcome: "fail", category: "everyday", load: () => import("./fail/RabbitSnowballBackfire") },
  { id: "bear-snow-fort-collapse", outcome: "fail", category: "everyday", load: () => import("./fail/BearSnowFortCollapse") },
  { id: "snowman-ice-skate-spill", outcome: "fail", category: "everyday", load: () => import("./fail/SnowmanIceSkateSpill") },
  { id: "matryoshka-fan-snap", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaFanSnap") },
  { id: "samovar-lid-rattle", outcome: "fail", category: "everyday", load: () => import("./fail/SamovarLidRattle") },
  { id: "pancake-splat", outcome: "fail", category: "everyday", load: () => import("./fail/PancakeSplat") },
  { id: "bear-balalaika-string-snap", outcome: "fail", category: "everyday", load: () => import("./fail/BearBalalaikaStringSnap") },
  { id: "bear-valenki-snow-trip", outcome: "fail", category: "everyday", load: () => import("./fail/BearValenkiSnowTrip") },
  { id: "garmoshka-jam-clank", outcome: "fail", category: "everyday", load: () => import("./fail/GarmoshkaJamClank") },
  { id: "matryoshka-topple-over", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaToppleOver") },
  { id: "banya-fog-slip", outcome: "fail", category: "everyday", load: () => import("./fail/BanyaFogSlip") },
  { id: "medved-barrel-trip", outcome: "fail", category: "everyday", load: () => import("./fail/MedvedBarrelTrip") },
  { id: "karusel-halt-spin", outcome: "fail", category: "everyday", load: () => import("./fail/KaruselHaltSpin") },
  { id: "medved-bucket-splash", outcome: "fail", category: "everyday", load: () => import("./fail/MedvedBucketSplash") },
  { id: "matryoshka-ice-shatter", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaIceShatter") },
  { id: "bear-shiver-smoke", outcome: "fail", category: "everyday", load: () => import("./fail/BearShiverSmoke") },
  { id: "pancake-face-splat", outcome: "fail", category: "everyday", load: () => import("./fail/PancakeFaceSplat") },
  { id: "bear-vacuum-oops", outcome: "fail", category: "everyday", load: () => import("./fail/BearVacuumOops") },
  { id: "balalaika-run-away", outcome: "fail", category: "everyday", load: () => import("./fail/BalalaikaRunAway") },
  { id: "bear-honey-head-stuck", outcome: "fail", category: "everyday", load: () => import("./fail/BearHoneyHeadStuck") },
  { id: "bear-wind-boomerang", outcome: "fail", category: "everyday", load: () => import("./fail/BearWindBoomerang") },
  { id: "samovar-rocket-spin", outcome: "fail", category: "everyday", load: () => import("./fail/SamovarRocketSpin") },
  { id: "matryoshka-spook-spin", outcome: "fail", category: "everyday", load: () => import("./fail/MatryoshkaSpookSpin") },
  { id: "character-choir-freeze", outcome: "fail", category: "everyday", load: () => import("./fail/CharacterChoirFreeze") },
  { id: "bear-sleep-faceplant", outcome: "fail", category: "everyday", load: () => import("./fail/BearSleepFaceplant") },
  { id: "balalaika-rocket-oops", outcome: "fail", category: "everyday", load: () => import("./fail/BalalaikaRocketOops") },
  { id: "domovoy-pancake-prank", outcome: "fail", category: "everyday", load: () => import("./fail/DomovoyPancakePrank") },
  { id: "hare-hat-fail-boot", outcome: "fail", category: "everyday", load: () => import("./fail/HareHatFailBoot") },
  { id: "carpet-unroll-dump", outcome: "fail", category: "everyday", load: () => import("./fail/CarpetUnrollDump") },
  { id: "pike-splash-escape", outcome: "fail", category: "everyday", load: () => import("./fail/PikeSplashEscape") },
  { id: "bear-snowball-flatten", outcome: "fail", category: "everyday", load: () => import("./fail/BearSnowballFlatten") },
];

export function scenarioIdsFor(outcome: ScenarioOutcome, category: ScenarioCategory): ScenarioId[] {
  return SCENARIOS.filter((s) => s.outcome === outcome && s.category === category).map((s) => s.id);
}
