/**
 * ПОЛЯ ОКНА — ЦВЕТА СТРАНИЦЫ, А НЕ СЕРОЙ ТЕМЫ — СТОРОЖ ЗАХОДА 7.248
 * (Р18 аудита 7.241: «белая полоса слева в альбомной ориентации»).
 *
 * Замер на эмуляторе 28.09.2026 (1.0.12, 2712×1220 в альбомной): слева
 * полоса 144 px цвета `#fafafa`, такие же поля сверху и снизу, страница —
 * `#fff8ec`. Переменные `--android-inset-*` при этом нули: поля даёт не
 * страница, а `SystemBars` Capacitor — он отодвигает WebView от выреза и
 * системных полос отступом РОДИТЕЛЯ, а в отступе виден фон окна темы
 * `Theme.AppCompat.DayNight.NoActionBar` (`#fafafa`).
 *
 * Правила:
 *   1) у темы приложения `AppTheme.NoActionBar` фон окна —
 *      `@color/pageBackground`;
 *   2) `pageBackground` — ровно цвет страницы: токен `color.neutral.50`
 *      в `tokens.json` и `--background` каркаса `public/offline.html`.
 *
 *   node scripts/check-window-background.mjs          # гейт
 *   node scripts/check-window-background.mjs --plant  # контроль подсадками
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const FILES = {
  styles: "android/app/src/main/res/values/styles.xml",
  colors: "android/app/src/main/res/values/colors.xml",
  tokens: "tokens.json",
  shell: "public/offline.html",
};
const read = () => Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, readFileSync(p, "utf8")]));
const noXmlComments = (xml) => xml.replace(/<!--[\s\S]*?-->/g, " ");

export function violationsIn(src) {
  const bad = [];
  const styles = noXmlComments(src.styles);
  const theme = /<style name="AppTheme\.NoActionBar"[^>]*>([\s\S]*?)<\/style>/.exec(styles);
  if (!theme) bad.push(`${FILES.styles}: темы AppTheme.NoActionBar нет — сторож ослеп`);
  else if (!/<item name="android:windowBackground">@color\/pageBackground<\/item>/.test(theme[1])) {
    bad.push(`${FILES.styles}: у AppTheme.NoActionBar фон окна не @color/pageBackground — в альбомной слева снова серая полоса (Р18)`);
  }
  const color = /<color name="pageBackground">(#[0-9a-fA-F]{6})<\/color>/.exec(noXmlComments(src.colors));
  if (!color) {
    bad.push(`${FILES.colors}: цвета pageBackground нет (Р18)`);
    return bad;
  }
  const want = color[1].toLowerCase();
  let token = "";
  try {
    token = String(JSON.parse(src.tokens)?.color?.neutral?.["50"] ?? "").toLowerCase();
  } catch {
    bad.push(`${FILES.tokens} не разбирается`);
  }
  if (!token) bad.push(`${FILES.tokens}: токена color.neutral.50 нет — сличать не с чем`);
  else if (token !== want) bad.push(`pageBackground ${want} ≠ токен страницы color.neutral.50 ${token} — поля окна другого цвета, чем страница (Р18)`);
  const shellBg = /--background:\s*(#[0-9a-fA-F]{6})/.exec(src.shell);
  if (!shellBg) bad.push(`${FILES.shell}: --background не найден — сличать не с чем`);
  else if (shellBg[1].toLowerCase() !== want) bad.push(`pageBackground ${want} ≠ фон каркаса без сети ${shellBg[1]} (Р18)`);
  return bad;
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
  cases.push({ name: "пустой вход — сторож краснеет, а не молчит", ok: violationsIn({ styles: "", colors: "", tokens: "{}", shell: "" }).length >= 2 });
  planted("styles", '        <item name="android:windowBackground">@color/pageBackground</item>\n', "", "подсадка: тема без фона окна (как на 1.0.12) — поймано", "фон окна не");
  planted("styles", "@color/pageBackground</item>", "@color/splashBackground</item>", "подсадка: фон окна — синий заставки — поймано", "фон окна не");
  planted("colors", '<color name="pageBackground">#fff8ec</color>', '<color name="pageBackground">#fafafa</color>', "подсадка: pageBackground серый — поймано", "≠ токен");
  planted("colors", '<color name="pageBackground">#fff8ec</color>', "", "подсадка: цвета нет — поймано", "цвета pageBackground нет");
  planted(
    "styles",
    '        <item name="android:windowBackground">@color/pageBackground</item>\n',
    "        <!-- <item name=\"android:windowBackground\">@color/pageBackground</item> -->\n",
    "подсадка: строка закомментирована — поймано",
    "фон окна не",
  );

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:window-background --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violationsIn(read());
  if (bad.length) {
    console.error("ПОЛЯ ОКНА СНОВА НЕ ЦВЕТА СТРАНИЦЫ (Р18):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("[check:window-background] фон окна = @color/pageBackground = color.neutral.50 = фон каркаса (контроль — --plant).");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
