// iOS-ПОЛОВИНА ПРАВКИ ДОЛГА 109 (долг 110). Послабление транспорта —
// исключение для отладки, а не правило для всех вариантов сборки.
//
// ЧТО БЫЛО. `ios/App/App/Info.plist` нёс
// `NSAppTransportSecurity → NSAllowsArbitraryLoads = true` — послабление
// не под один локальный адрес, а под ЛЮБОЙ незашифрованный. Файл в
// Xcode-проекте был ОДИН на обе конфигурации (`INFOPLIST_FILE = App/Info.plist`
// и в `Debug`, и в `Release`), то есть в магазинный пакет послабление
// уехало бы ровно так же, как на Android уезжал адрес домашней сети
// (7.158 часть 1, замерено на артефакте). Поймало бы это не наша
// проверка, а ревью Apple.
//
// ЧТО СТАЛО. Развилка та же, что на Android, и держится тем же —
// УСТРОЙСТВОМ СБОРКИ, а не договорённостью:
//
//   Release → App/Info.plist        — послабления нет вовсе
//   Debug   → App/Info-Debug.plist  — то же самое плюс один блок ATS
//
// Второй файл — не «ещё одна копия, которая разойдётся»: он обязан быть
// побайтово равен первому после вырезания блока между маркерами
// `ATS-DEBUG-ONLY`. Это правило и есть третья проверка ниже; без него
// пять литералов витринного имени и строка назначения микрофона жили бы
// в двух экземплярах без единой точки.
//
// ЧЕГО ЭТА ПРОВЕРКА НЕ ДЕЛАЕТ И НЕ МОЖЕТ. Она читает ИСХОДНИКИ, а не
// `.ipa`: Xcode на машине нет, собрать пакет нечем (то же ограничение,
// что у 7.154, 7.157 и 7.158). У Android-половины слой пакета есть
// (`check:native-release-safety`, `check:apk-facts`, `check:fgs-types`) —
// здесь его нет, и это записано долгом, а не спрятано. Первая настоящая
// сборка на Mac обязана перепроверить, что `INFOPLIST_FILE` действительно
// развёл конфигурации: `project.pbxproj` здесь разбирается регулярными
// выражениями, а не Xcode.
//
//   node scripts/check-ios-release-safety.mjs          # гейт
//   node scripts/check-ios-release-safety.mjs --plant  # позитивный контроль
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RELEASE_PLIST = "ios/App/App/Info.plist";
const DEBUG_PLIST = "ios/App/App/Info-Debug.plist";
const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";
const CAPACITOR = "capacitor.config.ts";

const MARK_START = "<!-- ATS-DEBUG-ONLY:start -->";
const MARK_END = "<!-- ATS-DEBUG-ONLY:end -->";

const ATS_KEY = "NSAppTransportSecurity";
const ARBITRARY = "NSAllowsArbitraryLoads";

/** Тот же список, что в `capacitor.config.ts` и в
 *  `check-native-release-safety.mjs`. Объявлен здесь третий раз намеренно:
 *  сторож обязан судить, ничего не импортируя из проверяемого файла. */
function isPrivateHost(host) {
  if (host === "localhost" || host.endsWith(".local")) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/** XML-комментарии выкусываются ДО поиска: объяснение, ПОЧЕМУ послабления
 *  здесь больше нет, называет `NSAppTransportSecurity` по имени, и считать
 *  это объявлением значило бы запретить объяснять правку. Тот же приём, что
 *  у `stripComments` в `check-native-permissions.mjs`. */
export function stripXmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

/** Вырезает блок между маркерами вместе с ними, ведущим отступом строки и
 *  одним переводом строки после. Отступ обязателен: без него в остатке
 *  оставался бы осиротевший таб, и побайтовое сличение врало бы. */
export function stripAtsBlock(text) {
  let i = text.indexOf(MARK_START);
  const j = text.indexOf(MARK_END);
  if (i === -1 || j === -1) return { ok: false, rest: text };
  while (i > 0 && (text[i - 1] === "\t" || text[i - 1] === " ")) i -= 1;
  const end = j + MARK_END.length;
  const after = text.slice(end).startsWith("\n") ? end + 1 : end;
  return { ok: true, rest: text.slice(0, i) + text.slice(after) };
}

/** Настройки сборки по конфигурациям цели. Разбирается ровно то, что
 *  нужно: имя конфигурации, `INFOPLIST_FILE` и наличие базового
 *  `.xcconfig`. */
export function parsePbxproj(text) {
  const configs = [];
  for (const m of text.matchAll(/isa = XCBuildConfiguration;([\s\S]*?)name = (\w+);/g)) {
    const body = m[1];
    configs.push({
      name: m[2],
      infoPlist: body.match(/INFOPLIST_FILE = ([^;]+);/)?.[1]?.trim().replace(/^"|"$/g, "") ?? null,
      baseConfig: /baseConfigurationReference = [^;]*debug\.xcconfig/.test(body),
    });
  }
  return configs;
}

/** Единственное место, где принимается решение. */
export function compare(src) {
  const bad = [];

  // 1. В релизном plist послабления нет вовсе.
  if (src.release === null) bad.push(`${RELEASE_PLIST} — файла нет`);
  else {
    const releaseCode = stripXmlComments(src.release);
    if (releaseCode.includes(ATS_KEY) || releaseCode.includes(ARBITRARY)) {
      bad.push(
        `${RELEASE_PLIST} несёт ${ATS_KEY}/${ARBITRARY} — послабление транспорта уедет в магазинный пакет.\n` +
          `      Место такому блоку одно: ${DEBUG_PLIST}, между маркерами ATS-DEBUG-ONLY.`,
      );
    }
    const httpHit = releaseCode.match(/http:\/\/(?!www\.apple\.com|schemas\.)[^<"\s]+/);
    if (httpHit) bad.push(`${RELEASE_PLIST} несёт незашифрованный адрес ${httpHit[0]}`);
  }

  // 2. Отладочный plist существует и послабление в нём ЕСТЬ.
  if (src.debug === null) {
    bad.push(`${DEBUG_PLIST} — файла нет: развилка не построена, обе конфигурации читали бы один plist`);
  } else if (!stripXmlComments(src.debug).includes(ARBITRARY)) {
    bad.push(
      `${DEBUG_PLIST} не несёт ${ARBITRARY} — живой перезапуск по http:// с ноутбука не заработает вовсе.\n` +
        `      iOS блокирует незашифрованный трафик на уровне системы, флаг server.cleartext этого не отменяет.`,
    );
  }

  // 3. Два plist расходятся ТОЛЬКО блоком ATS.
  if (src.release !== null && src.debug !== null) {
    const stripped = stripAtsBlock(src.debug);
    if (!stripped.ok) {
      bad.push(
        `${DEBUG_PLIST}: не найдены маркеры ${MARK_START} … ${MARK_END} — сличить два файла нечем, ` +
          `и любая правка одного из них разойдётся с другим молча`,
      );
    } else if (stripped.rest !== src.release) {
      bad.push(
        `${DEBUG_PLIST} после вырезания блока ATS не совпадает с ${RELEASE_PLIST} побайтово.\n` +
          `      Витринное имя, строка назначения микрофона и версии живут в обоих файлах; ` +
          `разойдясь, они дадут два разных приложения из одного проекта.`,
      );
    }
  }

  // 4. Конфигурации Xcode читают РАЗНЫЕ plist.
  if (src.pbxproj === null) bad.push(`${PBXPROJ} — файла нет`);
  else {
    const withPlist = src.pbxproj.filter((c) => c.infoPlist !== null);
    if (withPlist.length === 0) bad.push(`${PBXPROJ}: INFOPLIST_FILE не задан ни в одной конфигурации`);
    for (const c of withPlist) {
      const want = c.name === "Debug" ? "App/Info-Debug.plist" : "App/Info.plist";
      if (c.infoPlist !== want) {
        bad.push(
          `${PBXPROJ}: конфигурация ${c.name} читает ${c.infoPlist}, а обязана ${want}.\n` +
            `      Развилка держится именно этой строкой — одинаковые значения возвращают долг 110 целиком.`,
        );
      }
    }
    for (const c of src.pbxproj) {
      if (c.name === "Release" && c.baseConfig) {
        bad.push(`${PBXPROJ}: к конфигурации Release подключён debug.xcconfig — отладочные настройки уедут в релиз`);
      }
    }
  }

  // 5. Молчаливый адрес — боевой HTTPS (общая половина с Android).
  if (src.capacitor === null) bad.push(`${CAPACITOR} — файла нет`);
  else {
    const url = src.capacitor.match(/const PRODUCTION_URL = "([^"]+)"/)?.[1] ?? null;
    if (url === null) bad.push(`${CAPACITOR}: PRODUCTION_URL не найден`);
    else {
      let parsed = null;
      try {
        parsed = new URL(url);
      } catch {
        bad.push(`${CAPACITOR}: PRODUCTION_URL не разбирается как адрес: ${url}`);
      }
      if (parsed) {
        if (parsed.protocol !== "https:") bad.push(`${CAPACITOR}: PRODUCTION_URL не HTTPS: ${url}`);
        if (isPrivateHost(parsed.hostname)) bad.push(`${CAPACITOR}: PRODUCTION_URL — адрес частной сети: ${url}`);
      }
    }
  }

  return bad;
}

const read = (f) => (existsSync(f) ? readFileSync(f, "utf-8") : null);

function readSources() {
  const pbx = read(PBXPROJ);
  return {
    release: read(RELEASE_PLIST),
    debug: read(DEBUG_PLIST),
    pbxproj: pbx === null ? null : parsePbxproj(pbx),
    capacitor: read(CAPACITOR),
  };
}

function main() {
  const src = readSources();

  if (process.argv.includes("--plant")) {
    console.log("check:ios-release-safety --plant");
    const pbxRaw = read(PBXPROJ) ?? "";
    const plants = [
      [
        "ровно долг 110: послабление ATS вернулось в релизный plist",
        { ...src, release: (src.release ?? "").replace("</dict>\n</plist>", `\t<key>${ATS_KEY}</key>\n\t<dict>\n\t\t<key>${ARBITRARY}</key>\n\t\t<true/>\n\t</dict>\n</dict>\n</plist>`) },
      ],
      [
        "отладочного plist нет — обе конфигурации читают один файл",
        { ...src, debug: null },
      ],
      [
        "послабление пропало из отладочного plist — живой перезапуск мёртв",
        // Именно `<key>…</key>`, а не первое вхождение слова: слово стоит
        // и в объяснении правки, скопированном из `Info.plist`, и подмена
        // там сломала бы побайтовое сличение вместо правила 2.
        { ...src, debug: (src.debug ?? "").replace(`<key>${ARBITRARY}</key>`, "<key>NSAllowsLocalNetworking</key>") },
      ],
      [
        // Значение подсадки — незаполненный шаблон, а НЕ опечатка имени:
        // опечатку запрещает `check:brand`, и она уронила бы `verify` из
        // самого текста этого файла (поймано им же 09.09.2026, как и
        // раньше в `check-apk-facts.mjs`). Смысл подсадки тот же: два
        // plist разошлись витринным именем.
        "два plist разошлись витринным именем",
        {
          ...src,
          debug: (src.debug ?? "").replace(
            "<key>CFBundleName</key>\n\t<string>",
            "<key>CFBundleName</key>\n\t<string>$(PRODUCT_NAME)</string>\n\t<string>",
          ),
        },
      ],
      [
        "маркеры вырезания стёрты — сличать нечем",
        { ...src, debug: (src.debug ?? "").replace(MARK_START, "<!-- было -->") },
      ],
      [
        "конфигурация Debug вернулась на общий Info.plist",
        { ...src, pbxproj: parsePbxproj(pbxRaw.replace("INFOPLIST_FILE = App/Info-Debug.plist;", "INFOPLIST_FILE = App/Info.plist;")) },
      ],
      [
        "к Release подключён debug.xcconfig",
        {
          ...src,
          pbxproj: (src.pbxproj ?? []).map((c) => (c.name === "Release" ? { ...c, baseConfig: true } : c)),
        },
      ],
      [
        "молчаливый адрес снова из домашней сети",
        { ...src, capacitor: (src.capacitor ?? "").replace(/const PRODUCTION_URL = "[^"]+"/, 'const PRODUCTION_URL = "http://192.168.1.69:3000"') },
      ],
    ];
    // Подсадка засчитывается, только если она добавила жалобу, которой на
    // ЧИСТЫХ исходниках нет. Иначе одна застарелая краснота засчитала бы
    // за пойманное всё подряд — ровно это и случилось на первом прогоне
    // этого файла 09.09.2026.
    const cleanBad = compare(src);
    const cleanSet = new Set(cleanBad);
    let caught = 0;
    for (const [name, mutated] of plants) {
      const fresh = compare(mutated).filter((b) => !cleanSet.has(b));
      const hit = fresh.length > 0;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${name}${hit ? ` → ${fresh[0].split("\n")[0]}` : ""}`);
      if (hit) caught += 1;
    }
    const quiet = cleanBad.length === 0;
    console.log(
      `  ${quiet ? "отрицательный контроль: настоящие исходники — молчание" : `ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН: ${cleanBad.join("; ")}`}`,
    );
    console.log(`  поймано ${caught} из ${plants.length}`);
    process.exit(caught === plants.length && quiet ? 0 : 1);
  }

  const bad = compare(src);
  const configs = (src.pbxproj ?? []).filter((c) => c.infoPlist !== null);
  for (const c of configs) console.log(`Xcode: конфигурация ${c.name} → ${c.infoPlist}`);
  console.log(`${RELEASE_PLIST}: ${ATS_KEY} ${src.release?.includes(ATS_KEY) ? "ЕСТЬ" : "нет"}`);
  console.log(`${DEBUG_PLIST}: ${ARBITRARY} ${src.debug?.includes(ARBITRARY) ? "есть" : "НЕТ"}`);

  if (bad.length === 0) {
    console.log(
      "check:ios-release-safety — послабление транспорта живёт только в отладочном plist, " +
        "два файла расходятся ровно одним блоком, конфигурации разведены, молчаливый адрес — боевой HTTPS; расхождений 0.\n" +
        "  ЧИТАЕТ ИСХОДНИКИ, А НЕ .ipa: слоя пакета у iOS нет — Xcode на машине нет (долг 110 в этой части остаётся).",
    );
    process.exit(0);
  }
  for (const line of bad) console.error(`РАСХОЖДЕНИЕ: ${line}`);
  process.exit(1);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) main();
