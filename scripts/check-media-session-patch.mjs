/**
 * ШТОРКА НЕ ВРЁТ ПОСЛЕ УХОДА И НЕ БЕРЁТ ЧУЖУЮ ШКАЛУ — СТОРОЖ ЗАХОДА 7.248
 * (Ж.2 аудита 7.241 и долг 342).
 *
 * Замер на эмуляторе 28.09.2026, 1.0.12 + прод, `dumpsys media_session`:
 *   * живая «Репка» (полная дорожка 89 с) → без сети копия → «▶»: новая
 *     сессия копии стартует с позиции 27 565 мс — позиции ЖИВОЙ страницы;
 *   * после ухода из копии: 8 сессий приложения, все `active=true`, три
 *     `PLAYING`, уведомлений 0 — HyperOS рисует «играет» по таким сессиям;
 *   * текст уведомления «Cuento popular ruso - » (долг 342).
 *
 * Места, каждое из которых порознь возвращает болезнь:
 *   1) служба плагина при уходе освобождает сессию (`setActive(false)`,
 *      `release()`) — заплатка `scripts/patch-media-session.mjs` лежит
 *      в `node_modules` (плагин собирается оттуда);
 *   2) разделитель « - » — только при непустом `album`;
 *   3) заплатка накладывается сама после установки (`postinstall`);
 *   4) копия без сети (`public/offline.html`, `armStoryPlayer`) обнуляет
 *      длительность и позицию плагина при открытии и при уходе.
 *
 * Сторож слепнет честно: нет файла плагина или функции копии — это
 * нарушение, а не «чисто».
 *
 *   node scripts/check-media-session-patch.mjs          # гейт
 *   node scripts/check-media-session-patch.mjs --plant  # контроль подсадками
 */
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PATCHES, SERVICE, applyPatches } from "./patch-media-session.mjs";

const PLANT = process.argv.slice(2).includes("--plant");
const SHELL = "public/offline.html";
const PKG = "package.json";

function read() {
  return {
    service: existsSync(SERVICE) ? readFileSync(SERVICE, "utf8") : "",
    shell: readFileSync(SHELL, "utf8"),
    pkg: readFileSync(PKG, "utf8"),
  };
}

/** Тело именованной функции — по имени и скобкам, а не по строкам. */
function fnBody(code, name) {
  const js = code.indexOf(`function ${name}(`);
  const at = js !== -1 ? js : code.indexOf(`void ${name}(`);
  if (at === -1) return "";
  let depth = 0;
  for (let i = code.indexOf("{", at); i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}" && --depth === 0) return code.slice(at, i + 1);
  }
  return "";
}

export function violationsIn(src) {
  const bad = [];
  if (!src.service.trim()) {
    bad.push(`${SERVICE} не найден — сторож ослеп (плагин не установлен или переехал)`);
  } else {
    const destroy = fnBody(src.service, "destroy");
    if (!destroy) bad.push("в MediaSessionService нет destroy() — плагин изменился, заплатку надо пересобрать");
    else {
      if (!/mediaSession\.setActive\(false\)/.test(destroy) || !/mediaSession\.release\(\)/.test(destroy)) {
        bad.push("служба плагина при уходе не освобождает сессию (setActive(false) + release()) — после ухода «играет» висит активной (Ж.2б)");
      }
    }
    if (/setContentText\(artist \+ " - " \+ album\)/.test(src.service)) {
      bad.push("текст уведомления снова склеивает artist + \" - \" + album без проверки — висящий « - » (долг 342)");
    }
    if (!/album\.isEmpty\(\)/.test(src.service)) {
      bad.push("разделитель « - » не зависит от пустого album (долг 342)");
    }
  }
  let postinstall = "";
  try {
    postinstall = JSON.parse(src.pkg).scripts?.postinstall ?? "";
  } catch {
    bad.push("package.json не разбирается");
  }
  if (!/node scripts\/patch-media-session\.mjs/.test(postinstall)) {
    bad.push("postinstall не накладывает заплатку плагина — на CI и при сборке AAB плагин соберётся без неё");
  }
  const player = fnBody(src.shell, "armStoryPlayer");
  if (!player) {
    bad.push(`${SHELL}: armStoryPlayer не найден — сторож ослеп`);
  } else {
    const forget = fnBody(player, "forgetPosition");
    if (!forget || !/setPositionState\(\{\s*duration:\s*0,\s*position:\s*0/.test(forget)) {
      bad.push(`${SHELL}: копия не обнуляет длительность и позицию плагина — шторка стартует с чужой позиции (Ж.2а)`);
    }
    const stop = fnBody(player, "stopAll");
    if (!/forgetPosition\(\)/.test(stop)) bad.push(`${SHELL}: уход из копии не обнуляет шкалу плагина (Ж.2а)`);
    const arm = player.slice(player.indexOf("if (ms) {"));
    if (!/forgetPosition\(\);\s*\n\s*quiet\(ms\.setPlaybackState\(\{ playbackState: "none" \}\)\)/.test(arm)) {
      bad.push(`${SHELL}: открытие копии не обнуляет шкалу, оставленную живой страницей (Ж.2а)`);
    }
  }
  return bad;
}

/** Заплатка сама по себе: на исходном тексте плагина ложится, на
 *  исправленном — ничего не меняет. Исходный текст восстанавливается из
 *  исправленного обратной заменой — то есть ровно тот, что приносит npm. */
function patchSelfTest(patchedService) {
  let pristine = patchedService;
  for (const p of PATCHES) pristine = pristine.replace(p.to, p.from);
  const first = applyPatches(pristine);
  const second = applyPatches(first.text);
  return {
    pristineDiffers: pristine !== patchedService,
    applied: first.report.every((r) => r.state === "наложена"),
    idempotent: second.text === first.text && second.report.every((r) => r.state === "уже стоит"),
    same: first.text === patchedService,
  };
}

function plant() {
  const raw = read();
  const cases = [];
  const planted = (file, from, to, name, expect) => {
    const mutated = { ...raw, [file]: raw[file].replace(from, to) };
    if (mutated[file] === raw[file]) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violationsIn(mutated).some((f) => f.includes(expect)) });
  };
  cases.push({ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violationsIn(raw).length === 0 });
  cases.push({ name: "пустой вход (нет плагина, нет каркаса) — сторож краснеет, а не молчит", ok: violationsIn({ service: "", shell: "", pkg: "{}" }).length >= 3 });
  planted("service", "mediaSession.release();", "", "подсадка: служба не освобождает сессию — поймано", "не освобождает");
  planted("service", 'setContentText(album.isEmpty() ? artist : artist + " - " + album)', 'setContentText(artist + " - " + album)', "подсадка: « - » как на 1.0.12 — поймано", "висящий");
  planted("pkg", " && node scripts/patch-media-session.mjs", "", "подсадка: postinstall без заплатки — поймано", "postinstall");
  planted("shell", "setPositionState({ duration: 0, position: 0, playbackRate: 1 })", "setPositionState({})", "подсадка: копия зовёт setPositionState без полей (старое не стирается) — поймано", "не обнуляет длительность");
  planted("shell", "            forgetPosition();\n            if (ms) quiet(ms.setPlaybackState", "            if (ms) quiet(ms.setPlaybackState", "подсадка: уход без обнуления — поймано", "уход из копии");
  planted("shell", "            forgetPosition();\n            quiet(ms.setPlaybackState", "            quiet(ms.setPlaybackState", "подсадка: открытие копии без обнуления (как на 1.0.12) — поймано", "открытие копии");
  if (raw.service) {
    const t = patchSelfTest(raw.service);
    cases.push({ name: "заплатка: исходный текст плагина отличается от исправленного", ok: t.pristineDiffers });
    cases.push({ name: "заплатка: на исходном тексте ложатся обе правки", ok: t.applied });
    cases.push({ name: "заплатка: повторный запуск ничего не меняет", ok: t.idempotent });
    cases.push({ name: "заплатка: результат побайтово равен файлу в node_modules", ok: t.same });
    const drift = applyPatches(raw.service.replace("public void destroy() {", "public void destroyAll() {").replace(PATCHES[0].to, "x"));
    cases.push({ name: "заплатка: плагин без якоря — отчёт «ЯКОРЯ НЕТ», а не молчание", ok: drift.report.some((r) => r.state === "ЯКОРЯ НЕТ") });
  } else cases.push({ name: "плагин в node_modules есть", ok: false });

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:media-session-patch --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violationsIn(read());
  if (bad.length) {
    console.error("ШТОРКА СНОВА ВРЁТ (Ж.2 / долг 342):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(
    "[check:media-session-patch] служба плагина освобождает сессию, « - » только при album, заплатка в postinstall, копия обнуляет шкалу при открытии и уходе (контроль — --plant).",
  );
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
