// В РЕЛИЗНОМ пакете нет ни адреса чужой домашней сети, ни отключённой
// защиты транспорта.
//
// ЧЕМ ЭТО ОПЛАЧЕНО (долг 109, замер 09.09.2026). До правки
// `capacitor.config.ts` по умолчанию подставлял `http://192.168.1.69:3000` —
// адрес ноутбука разработчика, — а `usesCleartextTraffic="true"` стоял в
// `src/main/AndroidManifest.xml`, то есть во всех вариантах сборки.
// Считалось, что это «отладочное». Собранный релизный артефакт сказал
// обратное: `app-release-unsigned.apk` нёс внутри
// `assets/capacitor.config.json` со строкой
// `"url": "http://192.168.1.69:3000"`, `"cleartext": true`, а в
// скомпилированном манифесте — `usesCleartextTraffic=true`. Магазинный
// пакет, собранный «как есть», не открылся бы НИ У КОГО и был бы отбит
// pre-launch report'ом Play Console.
//
// ПОЧЕМУ ПРОВЕРЯЕТСЯ АРТЕФАКТ, А НЕ ИСХОДНИК. Ровно этот слепой класс дал
// долг 107: `check:native-permissions` читал наш манифест, а Play Console
// спрашивает про ЗАГРУЖЕННЫЙ пакет, и первая же настоящая сборка нашла
// девять разрешений, которых нет ни в одном нашем файле. Здесь то же
// самое: `server.url` попадает в пакет не из `capacitor.config.ts`
// напрямую, а через `cap sync`, который пишет
// `android/app/src/main/assets/capacitor.config.json` (файл в
// .gitignore — прочитать его в репозитории нечем), а
// `usesCleartextTraffic` — через слияние манифестов всех наборов
// исходников и всех библиотек. Судить об этом по исходнику значит
// повторить долг 107.
//
// ДВА СЛОЯ, И ОНИ НЕ РАВНОЗНАЧНЫ:
//
//   слой пакета (главный)  — `--xmltree=<файл> --config=<файл>`
//        `aapt2 dump xmltree --file AndroidManifest.xml <apk>` и
//        `unzip -p <apk> assets/capacitor.config.json`. Гоняется там, где
//        есть Android SDK и собранный релизный APK, — то есть в
//        `.github/workflows/android-debug.yml`.
//
//   слой исходника (страховка) — без флагов
//        Читает `capacitor.config.ts` и `android/app/src/*/AndroidManifest.xml`:
//        молчаливый адрес обязан быть HTTPS и не частной сетью, а
//        `usesCleartextTraffic` не имеет права стоять НИ В ОДНОМ наборе
//        исходников, кроме `debug`. Требует нуля инструментов, поэтому
//        стоит в `npm run verify` и в `ci.yml`.
//
// Слой исходника НЕ заменяет слой пакета: он не видит ни `cap sync`, ни
// слияние манифестов библиотек. Он ловит правку, которая вернёт всё
// назад, за 20 миллисекунд вместо шести минут сборки.
//
//   node scripts/check-native-release-safety.mjs                        # слой исходника
//   node scripts/check-native-release-safety.mjs --xmltree=… --config=… # слой пакета
//   node scripts/check-native-release-safety.mjs --plant                # позитивный контроль
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CAPACITOR = "capacitor.config.ts";
const MAIN_MANIFEST = "android/app/src/main/AndroidManifest.xml";
const DEBUG_MANIFEST = "android/app/src/debug/AndroidManifest.xml";

/** Набор исходников, которому МОЖНО нести `usesCleartextTraffic`: его нет
 *  в релизном варианте по устройству AGP. Все остальные наборы — нельзя. */
const CLEARTEXT_ALLOWED_SOURCE_SET = "debug";

/** Частная сеть или сам хост. Тот же список, что в `capacitor.config.ts`,
 *  и он объявлен там ВТОРОЙ РАЗ намеренно: сторож обязан судить о пакете,
 *  ничего не импортируя из проверяемого файла — иначе подменённое правило
 *  в проверяемом файле подменит и приговор. */
export function isPrivateHost(host) {
  if (host === "localhost" || host.endsWith(".local")) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/** Приговор по СОБРАННОМУ релизному пакету. Единственное место, где
 *  принимается решение слоя пакета; возвращает список расхождений. */
export function judgeArtifact({ xmltree, config }) {
  const bad = [];

  // `aapt2 dump xmltree` печатает атрибут строкой вида
  //   A: http://schemas.android.com/apk/res/android:usesCleartextTraffic(0x010104ec)=true
  // Значение бывает и числовым (`(type 0x12)0xffffffff` — это true).
  const cleartextLines = [...xmltree.matchAll(/^.*:usesCleartextTraffic\([^)]*\)=(.+)$/gm)].map((m) =>
    m[1].trim(),
  );
  for (const raw of cleartextLines) {
    const on = raw === "true" || /0xffffffff/.test(raw);
    if (on) {
      bad.push(
        `в скомпилированном манифесте релизного пакета android:usesCleartextTraffic=${raw} — ` +
          "незашифрованный трафик разрешён; Play Console флажит это в pre-launch report",
      );
    }
  }

  // `android:debuggable` в релизном пакете — отдельная беда того же
  // семейства: Play Console такой пакет прямо отклоняет на загрузке.
  for (const m of xmltree.matchAll(/^.*:debuggable\([^)]*\)=(.+)$/gm)) {
    const raw = m[1].trim();
    if (raw === "true" || /0xffffffff/.test(raw)) {
      bad.push(`в релизном пакете android:debuggable=${raw} — Play Console отклоняет такой пакет на загрузке`);
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(config);
  } catch {
    bad.push("assets/capacitor.config.json из пакета не разбирается как JSON");
    return bad;
  }
  const server = parsed.server ?? {};
  const url = server.url;
  if (typeof url !== "string" || url.length === 0) {
    // Пустой server.url — это Capacitor, грузящий локальный webDir. Для
    // нашей оболочки это не норма (см. capacitor.config.ts), но и не
    // небезопасно; отдельным правилом здесь не судим.
  } else {
    let u = null;
    try {
      u = new URL(url);
    } catch {
      bad.push(`server.url внутри пакета не разбирается как адрес: ${url}`);
    }
    if (u) {
      if (u.protocol !== "https:") {
        bad.push(`server.url внутри релизного пакета — не HTTPS: ${url}`);
      }
      if (isPrivateHost(u.hostname)) {
        bad.push(
          `server.url внутри релизного пакета указывает в частную сеть: ${url} — ` +
            "приложение не откроется ни у одного скачавшего",
        );
      }
    }
  }
  if (server.cleartext === true) {
    bad.push("server.cleartext=true внутри релизного пакета");
  }
  return bad;
}

/** Приговор по ИСХОДНИКАМ. Страховка, а не замена слою пакета. */
export function judgeSources({ capacitorTs, manifests }) {
  const bad = [];

  // Молчаливое значение адреса: то, что подставится, если НИ ОДНОЙ
  // переменной окружения не задано. Читается как литерал — сторож не
  // исполняет проверяемый файл намеренно.
  const m = capacitorTs.match(/const PRODUCTION_URL\s*=\s*"([^"]+)"/);
  if (!m) {
    bad.push(
      `${CAPACITOR}: не найден литерал PRODUCTION_URL — молчаливый адрес сервера прочитать нечем`,
    );
  } else {
    const fallback = m[1];
    let u = null;
    try {
      u = new URL(fallback);
    } catch {
      bad.push(`${CAPACITOR}: PRODUCTION_URL не разбирается как адрес: ${fallback}`);
    }
    if (u) {
      if (u.protocol !== "https:") bad.push(`${CAPACITOR}: молчаливый адрес не HTTPS: ${fallback}`);
      if (isPrivateHost(u.hostname)) {
        bad.push(`${CAPACITOR}: молчаливый адрес указывает в частную сеть: ${fallback}`);
      }
    }
  }

  // Явный режим обязан оставаться явным: без второй переменной небезопасный
  // адрес обязан БРОСАТЬ, а не подставляться молча.
  if (!/CAPACITOR_LIVE_RELOAD/.test(capacitorTs)) {
    bad.push(
      `${CAPACITOR}: нет упоминания CAPACITOR_LIVE_RELOAD — небезопасный CAPACITOR_SERVER_URL ` +
        "проходит без явного согласия",
    );
  } else if (!/\bthrow\b/.test(capacitorTs)) {
    bad.push(`${CAPACITOR}: CAPACITOR_LIVE_RELOAD упомянут, но ни одного throw — правило не гейт`);
  }

  for (const [sourceSet, text] of manifests) {
    if (!/usesCleartextTraffic\s*=\s*"true"/.test(text)) continue;
    if (sourceSet === CLEARTEXT_ALLOWED_SOURCE_SET) continue;
    bad.push(
      `android/app/src/${sourceSet}/AndroidManifest.xml: usesCleartextTraffic="true" в наборе ` +
        `«${sourceSet}» — он попадает и в релизный вариант; место этой строки только в наборе ` +
        `«${CLEARTEXT_ALLOWED_SOURCE_SET}»`,
    );
  }
  return bad;
}

function readManifests() {
  const out = [];
  for (const [set, file] of [
    ["main", MAIN_MANIFEST],
    ["debug", DEBUG_MANIFEST],
    ["release", "android/app/src/release/AndroidManifest.xml"],
  ]) {
    if (existsSync(file)) out.push([set, readFileSync(file, "utf-8")]);
  }
  return out;
}

/** Заведомо здоровый релизный пакет — строится из НАШИХ исходников, а не
 *  записан литералом: иначе контроль перестал бы следить за проектом. Ни
 *  APK, ни Android SDK ему не нужны, поэтому `--plant` гоняется и на
 *  ноутбуке, и в CI. */
function healthyArtifact(capacitorTs) {
  const url = capacitorTs.match(/const PRODUCTION_URL\s*=\s*"([^"]+)"/)?.[1] ?? "https://rusofacilapp.com";
  const xmltree = [
    "N: android=http://schemas.android.com/apk/res/android",
    "  E: manifest (line=2)",
    "    A: package=\"com.rusofacilapp.app\" (Raw: \"com.rusofacilapp.app\")",
    "    E: application (line=18)",
    "      A: http://schemas.android.com/apk/res/android:label(0x01010001)=@0x7f120000",
    "      A: http://schemas.android.com/apk/res/android:allowBackup(0x01010280)=true",
    "      A: http://schemas.android.com/apk/res/android:supportsRtl(0x010103af)=true",
  ].join("\n");
  const config = JSON.stringify(
    {
      appId: "com.rusofacilapp.app",
      appName: "RusoFácil",
      webDir: "capacitor-shell",
      server: { url, cleartext: false, allowNavigation: [new URL(url).hostname], errorPath: "error.html" },
    },
    null,
    "\t",
  );
  return { xmltree, config };
}

function plant() {
  console.log("check:native-release-safety --plant");
  const capacitorTs = readFileSync(CAPACITOR, "utf-8");
  const manifests = readManifests();
  const healthy = healthyArtifact(capacitorTs);

  const CLEARTEXT_LINE =
    "      A: http://schemas.android.com/apk/res/android:usesCleartextTraffic(0x010104ec)=true";
  const DEBUGGABLE_LINE =
    "      A: http://schemas.android.com/apk/res/android:debuggable(0x0101000f)=true";

  const plants = [
    // Первые пять — ровно то, что 09.09.2026 лежало в собранном
    // app-release-unsigned.apk, разобранное по одному.
    [
      "cleartext в скомпилированном манифесте релизного пакета",
      () => judgeArtifact({ xmltree: `${healthy.xmltree}\n${CLEARTEXT_LINE}`, config: healthy.config }),
    ],
    [
      "cleartext записан числом, а не словом true",
      () =>
        judgeArtifact({
          xmltree: `${healthy.xmltree}\n      A: http://schemas.android.com/apk/res/android:usesCleartextTraffic(0x010104ec)=(type 0x12)0xffffffff`,
          config: healthy.config,
        }),
    ],
    [
      "релизный пакет собран отладочным (debuggable)",
      () => judgeArtifact({ xmltree: `${healthy.xmltree}\n${DEBUGGABLE_LINE}`, config: healthy.config }),
    ],
    [
      "адрес ноутбука внутри релизного пакета (http + частная сеть)",
      () =>
        judgeArtifact({
          xmltree: healthy.xmltree,
          config: healthy.config.replace(/"url": "[^"]+"/, '"url": "http://192.168.1.69:3000"'),
        }),
    ],
    [
      "адрес частной сети, но уже по HTTPS — http:// одного мало",
      () =>
        judgeArtifact({
          xmltree: healthy.xmltree,
          config: healthy.config.replace(/"url": "[^"]+"/, '"url": "https://10.0.0.7:3000"'),
        }),
    ],
    [
      "localhost внутри релизного пакета",
      () =>
        judgeArtifact({
          xmltree: healthy.xmltree,
          config: healthy.config.replace(/"url": "[^"]+"/, '"url": "https://localhost:3000"'),
        }),
    ],
    [
      "боевой домен, но по http://",
      () =>
        judgeArtifact({
          xmltree: healthy.xmltree,
          config: healthy.config.replace(/"url": "https:/, '"url": "http:'),
        }),
    ],
    [
      "server.cleartext=true при исправном адресе",
      () =>
        judgeArtifact({
          xmltree: healthy.xmltree,
          config: healthy.config.replace(/"cleartext": false/, '"cleartext": true'),
        }),
    ],
    // Слой исходника — три подсадки, каждая возвращает ровно ту правку,
    // которую этот заход снял.
    [
      "исходник: молчаливый адрес снова стал адресом ноутбука",
      () =>
        judgeSources({
          capacitorTs: capacitorTs.replace(
            /const PRODUCTION_URL\s*=\s*"[^"]+"/,
            'const PRODUCTION_URL = "http://192.168.1.69:3000"',
          ),
          manifests,
        }),
    ],
    [
      "исходник: cleartext вернули в набор main",
      () =>
        judgeSources({
          capacitorTs,
          manifests: manifests.map(([set, text]) =>
            set === "main" ? [set, `${text}\n<application android:usesCleartextTraffic="true" />`] : [set, text],
          ),
        }),
    ],
    [
      "исходник: явный режим перестал быть явным (throw убран)",
      () => judgeSources({ capacitorTs: capacitorTs.replace(/\bthrow\b/g, "return"), manifests }),
    ],
  ];

  let caught = 0;
  for (const [name, run] of plants) {
    const bad = run();
    const hit = bad.length > 0;
    console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${name}${hit ? ` → ${bad[0]}` : ""}`);
    if (hit) caught += 1;
  }

  // Отрицательный контроль, обе половины: здоровый пакет и настоящие
  // исходники обязаны молчать. Без него «поймано 11 из 11» означало бы
  // просто вечно красную проверку.
  const cleanArtifact = judgeArtifact(healthy);
  const cleanSources = judgeSources({ capacitorTs, manifests });
  const quiet = cleanArtifact.length === 0 && cleanSources.length === 0;
  console.log(
    `  ${quiet ? "отрицательный контроль: здоровый пакет и настоящие исходники — молчание" : `ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН: ${[...cleanArtifact, ...cleanSources].join("; ")}`}`,
  );
  console.log(`  поймано ${caught} из ${plants.length}`);
  return caught === plants.length && quiet;
}

function main() {
  if (process.argv.includes("--plant")) {
    process.exit(plant() ? 0 : 1);
  }

  const xmltreeArg = process.argv.find((a) => a.startsWith("--xmltree="));
  const configArg = process.argv.find((a) => a.startsWith("--config="));

  if (xmltreeArg || configArg) {
    if (!xmltreeArg || !configArg) {
      console.error("слой пакета требует ОБА флага: --xmltree=<файл> и --config=<файл>");
      process.exit(1);
    }
    const xmltree = readFileSync(xmltreeArg.slice("--xmltree=".length), "utf-8");
    const config = readFileSync(configArg.slice("--config=".length), "utf-8");
    const bad = judgeArtifact({ xmltree, config });
    const url = (() => {
      try {
        return JSON.parse(config).server?.url ?? "(нет)";
      } catch {
        return "(не разобрался)";
      }
    })();
    console.log(`релизный пакет: server.url ${url}`);
    if (bad.length === 0) {
      console.log(
        "check:native-release-safety (слой пакета) — cleartext нет, debuggable нет, " +
          "адрес HTTPS и не частная сеть; расхождений 0.",
      );
      process.exit(0);
    }
    for (const line of bad) console.error(`РАСХОЖДЕНИЕ: ${line}`);
    process.exit(1);
  }

  const capacitorTs = readFileSync(CAPACITOR, "utf-8");
  const manifests = readManifests();
  const bad = judgeSources({ capacitorTs, manifests });
  if (bad.length === 0) {
    console.log(
      `check:native-release-safety (слой исходника) — прочитано манифестов ${manifests.length} ` +
        `(${manifests.map(([s]) => s).join(", ")}); молчаливый адрес HTTPS и не частный, ` +
        `небезопасный требует CAPACITOR_LIVE_RELOAD=1, cleartext только в наборе «${CLEARTEXT_ALLOWED_SOURCE_SET}». ` +
        "Слой пакета — в .github/workflows/android-debug.yml.",
    );
    process.exit(0);
  }
  for (const line of bad) console.error(`РАСХОЖДЕНИЕ: ${line}`);
  process.exit(1);
}

// Ничего при импорте: этот файл читает `src/lib/entry-point.test.ts`.
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) main();
