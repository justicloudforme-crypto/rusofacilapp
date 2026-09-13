// Какая иконка стоит у СОБРАННОГО приложения — ответ по пакету, а не по исходникам.
//
// ПОЧЕМУ ЭТОТ ФАЙЛ ОТДЕЛЬНЫЙ ОТ `check-app-icons.mjs`. Тот читает
// репозиторий и гоняется в CI на каждом PR. Этот читает APK, которого в
// CI нет и не будет: ключа подписи там нет, сборка Android там не
// делается. Разница между слоями в этом проекте оплачена трижды — 7.158
// (адрес домашней сети внутри релизного пакета), 7.179 (сторож запрещал
// ровно тот файл, который читает Gradle) и 7.190 (дефолтная иконка
// Capacitor, которую не видел ни один сторож). Поэтому пакет
// спрашивается отдельно и руками, а не выводится из исходников.
//
// ГЛАВНОЕ УСТРОЙСТВО: ПАКЕТ ЧИТАЕТСЯ ИЗ ZIP, А НЕ С ДИСКА.
//
// Замер 7.190 распаковал APK на диск и сообщил, что одной иконки
// запуска в пакете нет — `mipmap-mdpi/ic_launcher_round.png`, «выкинута
// сжатием ресурсов». Это неверно, и неверен был прибор. `aapt2` даёт
// ресурсам короткие имена, различающиеся РЕГИСТРОМ: в том же APK лежат
// и `res/zR.png`, и `res/zr.png`. Файловая система macOS регистр в
// именах не различает, и при распаковке второй файл молча затёр первый:
// из 520 записей `res/` на диск легло 469, в 24 группах имена
// схлопнулись. `res/zR.png` — это и есть круглая иконка mdpi (48×48
// RGBA); затёрший её `res/zr.png` — чужая картинка 162×162 RGB, поэтому
// сличение по пикселям и не сошлось.
//
// Отсюда правило, ради которого файл и написан: содержимое пакета
// читается ПОТОКОМ ИЗ АРХИВА. Ничего не распаковывается на диск вовсе —
// тогда регистр имён не имеет значения ни на одной платформе.
//
// ЧТО ПРОВЕРЯЕТСЯ:
//
//   1. `aapt2 dump badging` — чем приложение объявляет свою иконку;
//   2. `aapt2 dump resources` — на какой файл в пакете смотрит КАЖДАЯ
//      плотность каждой из четырёх иконок (24 записи);
//   3. пиксельное сличение каждой с репозиторием. Побайтово они не
//      совпадут никогда: `aapt` перепаковывает PNG при сборке, а часть
//      файлов ещё и переводит в ПАЛИТРУ (`colorType 3`) — из 24 иконок
//      этого пакета так ужаты 10. Сравниваются не сырые RGBA, а
//      СВЕДЁННЫЕ на непрозрачный фон: у полностью прозрачного пикселя
//      цвет не определён вовсе, и палитра кладёт туда что угодно
//      (замер: расхождение до 138 на канал при полном совпадении
//      картинки). Сведение убирает ровно эту неопределённость и ничего
//      больше — совпадение требуется ТОЧНОЕ, до нуля;
//   4. углы `ic_launcher_foreground` не равны `#3730a3` / `#d97706` —
//      дефолту Capacitor, который стоял в пакете до долга 177.
//
//   node scripts/check-apk-icons.mjs --apk=<файл> [--sdk=<build-tools>]
//   node scripts/check-apk-icons.mjs --apk=<файл> --plant
//
// `--plant` — позитивный контроль на НАСТОЯЩЕМ пакете: в копию APK
// подсаживается заведомо неверная иконка, и проверка обязана её поймать.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";

import { decode, encode } from "./store-assets/png-io.mjs";

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const ANDROID_RES = "android/app/src/main/res";
const NAMES = ["ic_launcher", "ic_launcher_round", "ic_launcher_foreground", "ic_launcher_background"];
const DENSITIES = ["ldpi", "mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];
const CAPACITOR_DEFAULT_CORNERS = ["#3730a3", "#d97706"];

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  }),
);

function aapt2(sdkHint) {
  const roots = [sdkHint, process.env.ANDROID_HOME, path.join(process.env.HOME ?? "", "Library/Android/sdk")].filter(
    Boolean,
  );
  for (const root of roots) {
    const direct = path.join(root, "aapt2");
    if (existsSync(direct)) return direct;
    const bt = path.join(root, "build-tools");
    if (!existsSync(bt)) continue;
    for (const v of readdirSync(bt).sort().reverse()) {
      const p = path.join(bt, v, "aapt2");
      if (existsSync(p)) return p;
    }
  }
  throw new Error("aapt2 не найден: укажите --sdk=<каталог build-tools или SDK>");
}

/* ------------------------------------------------------------------ *
 * Чтение zip без распаковки на диск.                                  *
 * Своё, а не `unzip`, ровно по причине из шапки: любой путь через      *
 * файловую систему macOS схлопывает имена, различающиеся регистром.    *
 * ------------------------------------------------------------------ */
export function zipEntries(buf) {
  // Конец центрального каталога ищется с хвоста: комментария у APK нет,
  // но 64 КБ запаса стоят дешевле, чем ошибка на пакете с комментарием.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("это не zip: конец центрального каталога не найден");
  let count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  if (off === 0xffffffff || count === 0xffff) throw new Error("zip64 не поддерживается");

  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("повреждён центральный каталог");
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf-8", off + 46, off + 46 + nameLen);
    entries.set(name, { method, compSize, localOff });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function zipRead(buf, entries, name) {
  const e = entries.get(name);
  if (!e) throw new Error(`в пакете нет записи ${name}`);
  const lo = e.localOff;
  if (buf.readUInt32LE(lo) !== 0x04034b50) throw new Error(`повреждён локальный заголовок ${name}`);
  const start = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28);
  const raw = buf.subarray(start, start + e.compSize);
  if (e.method === 0) return Buffer.from(raw);
  if (e.method === 8) return zlib.inflateRawSync(raw);
  throw new Error(`${name}: неизвестный метод сжатия ${e.method}`);
}

/** Серый, на который сводятся обе картинки перед сличением. Значение
 *  безразлично — важно лишь, что оно ОДНО и то же для обеих. */
const FLATTEN_ON = [128, 128, 128];

/** Хеш того, что видит глаз: RGB после сведения альфы на общий фон. */
function visibleHash(png) {
  const img = decode(png);
  const out = Buffer.alloc(img.width * img.height * 3);
  for (let i = 0; i < img.width * img.height; i++) {
    const s = i * 4;
    const a = img.data[s + 3] / 255;
    for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.round(img.data[s + k] * a + FLATTEN_ON[k] * (1 - a));
  }
  return createHash("sha256").update(`${img.width}x${img.height}:`).update(out).digest("hex");
}

const hex = (px) => "#" + [px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, "0")).join("");

/** Карта «числовой идентификатор → тип/имя» из таблицы ресурсов пакета. */
export function resourceNames(tool, apk) {
  const dump = execFileSync(tool, ["dump", "resources", apk], { maxBuffer: 1 << 28 }).toString("utf-8");
  const map = new Map();
  for (const m of dump.matchAll(/^\s*resource (0x[0-9a-f]+) (\S+)/gm)) map.set(m[1], m[2]);
  return map;
}

/** Карта «mipmap/имя (плотность) → путь внутри пакета», из таблицы ресурсов. */
export function resourceMap(tool, apk) {
  const dump = execFileSync(tool, ["dump", "resources", apk], { maxBuffer: 1 << 28 }).toString("utf-8");
  const map = new Map();
  let current = null;
  for (const line of dump.split("\n")) {
    const res = line.match(/^\s*resource 0x[0-9a-f]+ mipmap\/(\S+)/);
    if (res) {
      current = res[1];
      continue;
    }
    if (/^\s*resource /.test(line)) {
      current = null;
      continue;
    }
    if (!current) continue;
    const file = line.match(/^\s*\((\S+?)\)\s+\(file\)\s+(res\/\S+)/);
    if (file) map.set(`${current}/${file[1].replace(/-v\d+$/, "")}`, file[2]);
  }
  return map;
}

export function scan({ apk, sdk }) {
  const failures = [];
  const notes = [];
  const tool = aapt2(sdk);
  const buf = readFileSync(apk);
  const entries = zipEntries(buf);

  const badging = execFileSync(tool, ["dump", "badging", apk], { maxBuffer: 1 << 26 }).toString("utf-8");
  const declared = badging.match(/application:.*icon='([^']+)'/)?.[1] ?? null;
  notes.push(`пакет объявляет иконку: ${declared ?? "НИЧЕГО"}`);
  if (!declared) failures.push("в `dump badging` нет строки application: icon=…");

  // Адаптивная иконка — это XML со ссылками на два слоя; именно они и
  // попадают на экран, а не `ic_launcher.png`.
  if (declared && declared.endsWith(".xml")) {
    // Внутри пакета XML лежит ДВОИЧНЫМ (AXML) — искать в нём подстроку
    // бесполезно, имена ресурсов там ссылками на таблицу строк. Разбор
    // делает сам aapt2; первая редакция этого файла искала подстроку и
    // отрапортовала «слоёв нет» на пакете, где они есть.
    const tree = execFileSync(tool, ["dump", "xmltree", "--file", declared, apk], {
      maxBuffer: 1 << 24,
    }).toString("utf-8");
    // В дереве стоят ЧИСЛОВЫЕ идентификаторы (`@0x7f0d0001`), а не имена:
    // имена живут в таблице ресурсов. Поэтому дерево читается вместе с
    // ней, а не «поиском подстроки» — первая редакция искала подстроку и
    // сказала «слоёв нет» о пакете, где оба слоя на месте.
    const byId = resourceNames(tool, apk);
    const used = [...tree.matchAll(/@0x([0-9a-f]{8})/g)].map((m) => byId.get(`0x${m[1]}`) ?? `0x${m[1]}`);
    for (const layer of ["ic_launcher_background", "ic_launcher_foreground"]) {
      if (!used.some((u) => u.endsWith(`/${layer}`))) {
        failures.push(`${declared}: слой ${layer} в объявленной иконке не упомянут`);
      }
    }
    notes.push(`слои объявленной иконки: ${used.join(", ")}`);
    if (/E: inset/i.test(tree)) {
      failures.push(`${declared}: в пакете у слоёв остался inset — под круглой маской это открывает прозрачную кромку`);
    }
  }

  const map = resourceMap(tool, apk);
  let matched = 0;
  let checked = 0;
  for (const name of NAMES) {
    for (const d of DENSITIES) {
      checked++;
      const inPkg = map.get(`${name}/${d}`);
      const repo = path.join(ANDROID_RES, `mipmap-${d}`, `${name}.png`);
      if (!inPkg) {
        failures.push(`${name} (${d}): в таблице ресурсов пакета такой плотности нет`);
        continue;
      }
      let bytes;
      try {
        bytes = zipRead(buf, entries, inPkg);
      } catch (e) {
        failures.push(`${name} (${d}) → ${inPkg}: ${e.message}`);
        continue;
      }
      // Сличение ПО ВИДИМЫМ ПИКСЕЛЯМ (см. шапку): байты не совпадут
      // никогда, а у прозрачных пикселей не определён и цвет.
      const a = visibleHash(bytes);
      const b = visibleHash(readFileSync(repo));
      if (a === b) matched++;
      else failures.push(`${name} (${d}) → ${inPkg}: пиксели не совпали с ${repo}`);

      if (name === "ic_launcher_foreground") {
        const img = decode(bytes);
        const at = (x, y) => {
          const s = (y * img.width + x) * 4;
          return [img.data[s], img.data[s + 1], img.data[s + 2], img.data[s + 3]];
        };
        for (const px of [at(0, 0), at(img.width - 1, 0), at(0, img.height - 1), at(img.width - 1, img.height - 1)]) {
          if (px[3] !== 0 && CAPACITOR_DEFAULT_CORNERS.includes(hex(px))) {
            failures.push(`${name} (${d}) → ${inPkg}: в углу ${hex(px)} — дефолт Capacitor (долг 177)`);
          }
        }
      }
    }
  }
  notes.push(`иконок запуска в пакете: сличено ${checked}, совпало по пикселям ${matched}`);
  notes.push(`записей res/ в архиве: ${[...entries.keys()].filter((n) => n.startsWith("res/")).length} (читались из zip, на диск не распаковывались)`);

  return { failures, notes, checked, matched };
}

function report(r) {
  for (const n of r.notes) console.log(`  ${n}`);
  for (const f of r.failures) console.log(`  ПРОВАЛ: ${f}`);
  const ok = r.failures.length === 0;
  console.log(ok ? `[check:apk-icons] PASS — ${r.matched} из ${r.checked}` : `[check:apk-icons] FAIL — ${r.failures.length}`);
  return ok;
}

/**
 * Позитивный контроль на НАСТОЯЩЕМ пакете: в копию APK подсаживается
 * заведомо неверная иконка. Перепаковка делается `zip`, потому что нам
 * важно не то, установится ли такой APK, а то, поймает ли его проверка.
 */
function plantControls({ apk, sdk }) {
  const dir = mkdtempSync(path.join(tmpdir(), "apk-icons-"));
  const copy = path.join(dir, "planted.apk");
  copyFileSync(apk, copy);

  const tool = aapt2(sdk);
  const map = resourceMap(tool, copy);
  // Портим передний слой самой крупной плотности — ровно тот файл,
  // который и попадает на экран телефона.
  const target = map.get("ic_launcher_foreground/xxxhdpi");
  if (!target) throw new Error("в пакете не найден ic_launcher_foreground (xxxhdpi)");

  const buf = readFileSync(copy);
  const img = decode(zipRead(buf, zipEntries(buf), target));
  const data = Buffer.alloc(img.width * img.height * 4);
  for (let i = 0; i < img.width * img.height; i++) {
    data[i * 4] = 0x37;
    data[i * 4 + 1] = 0x30;
    data[i * 4 + 2] = 0xa3;
    data[i * 4 + 3] = 0xff;
  }
  const stage = path.join(dir, path.dirname(target));
  execFileSync("mkdir", ["-p", stage]);
  writeFileSync(path.join(dir, target), encode({ width: img.width, height: img.height, data }));
  execFileSync("zip", ["-q", copy, target], { cwd: dir });

  const r = scan({ apk: copy, sdk });
  const caughtPixels = r.failures.some((m) => m.includes("ic_launcher_foreground (xxxhdpi)") && m.includes("пиксели"));
  const caughtDefault = r.failures.some((m) => m.includes("ic_launcher_foreground (xxxhdpi)") && m.includes("#3730a3"));
  console.log(`  ${caughtPixels ? "поймано" : "ПРОПУЩЕНО"} — подсаженная иконка разошлась с репозиторием по пикселям`);
  console.log(`  ${caughtDefault ? "поймано" : "ПРОПУЩЕНО"} — подсаженная иконка опознана как дефолт Capacitor`);
  const cleanAgain = scan({ apk, sdk }).failures.length === 0;
  console.log(`  ${cleanAgain ? "чисто" : "ВСЁ ЕЩЁ ГРЯЗНО"} — исходный пакет`);
  rmSync(dir, { recursive: true, force: true });

  const ok = caughtPixels && caughtDefault && cleanAgain;
  console.log(ok ? "check:apk-icons --plant — 3 из 3" : "check:apk-icons --plant — FAILED");
  return ok;
}

if (IS_ENTRY_POINT) {
  const apk = args.get("apk");
  if (!apk) {
    console.error("нужен --apk=<файл>");
    process.exit(2);
  }
  const opts = { apk, sdk: args.get("sdk") };
  const ok = args.has("plant") ? plantControls(opts) : report(scan(opts));
  process.exitCode = ok ? 0 : 1;
}
