/**
 * Заход 7.170, часть 2 (долг 132): WAV → mp3 параметрами БАНКА.
 *
 * ЗАЧЕМ. 7.168 записал вырезки омографов в WAV: на ноутбуке не было ни
 * одного кодировщика mp3. Параметры берутся не из головы, а у самого
 * банка (`ffprobe` по любому mp3 `contentType='word'`): mp3, 128 kbps,
 * 24 000 Гц, моно. Перекодировка — не новый голос: исходный звук тот же
 * самый, владельцем уже прослушанный.
 *
 * ДОПУСК ПО ДЛИТЕЛЬНОСТИ. Кодировщик mp3 не укорачивает и не может
 * совпасть знак в знак: он добавляет свою задержку и добивает хвост до
 * границы кадра. Кадр MPEG-2 Layer III на 24 000 Гц — 576 отсчётов,
 * то есть ровно 24 мс. Поэтому правило одностороннее:
 *
 *     0 мс ≤ (длительность mp3 − длительность WAV) ≤ 96 мс (4 кадра)
 *
 * Односторонность — и есть то, чем ловится обрезанный файл: укоротить
 * исходник на 100 мс значит увести разницу в минус, и проверка краснеет.
 * Двусторонний допуск «±100 мс» этого не поймал бы вовсе.
 *
 *   npx tsx prisma/run-7170/encode-mp3.ts --in=<папка> --out=<папка> [--plant]
 *
 * `--plant` перед кодированием укорачивает КОПИЮ исходника на 100 мс и
 * ждёт, что проверка длительности назовёт это отказом.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const IN = process.argv.find((a) => a.startsWith("--in="))?.slice(5);
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
const PLANT = process.argv.includes("--plant");
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

/** Параметры банка — сняты `ffprobe` с mp3 самого банка, не выдуманы. */
export const BANK = { codec: "mp3", sampleRate: 24000, channels: 1, bitRate: 128000 } as const;
/** Кадр MPEG-2 Layer III на 24 кГц — 576 отсчётов = 24 мс. */
const FRAME_MS = 24;
export const TOLERANCE_MS = { min: 0, max: 4 * FRAME_MS };

export function probe(file: string): { duration: number; codec: string; sampleRate: number; channels: number; bitRate: number } {
  const out = execFileSync(
    FFPROBE,
    ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name,sample_rate,channels,bit_rate", "-show_entries", "format=duration", "-of", "json", file],
    { encoding: "utf-8" },
  );
  const j = JSON.parse(out) as { streams: Record<string, string>[]; format: Record<string, string> };
  const s = j.streams[0] ?? {};
  return {
    duration: Number(j.format.duration),
    codec: String(s.codec_name ?? ""),
    sampleRate: Number(s.sample_rate ?? 0),
    channels: Number(s.channels ?? 0),
    bitRate: Number(s.bit_rate ?? 0),
  };
}

function encode(src: string, dst: string) {
  execFileSync(FFMPEG, [
    "-v", "error", "-y", "-i", src,
    "-c:a", "libmp3lame", "-b:a", "128k", "-ar", String(BANK.sampleRate), "-ac", String(BANK.channels),
    dst,
  ]);
}

function main(): number {
  if (!IN || !OUT) {
    console.error("нужны --in=<папка> и --out=<папка>");
    return 2;
  }
  mkdirSync(OUT, { recursive: true });
  const files = readdirSync(IN).filter((f) => f.toLowerCase().endsWith(".wav")).sort();
  let worstDelta = -Infinity;
  let worstFile = "";
  let bestDelta = Infinity;
  const bad: string[] = [];
  const rows: { file: string; wav: number; mp3: number; deltaMs: number; bytesWav: number; bytesMp3: number }[] = [];

  for (const f of files) {
    let src = join(IN, f);
    if (PLANT) {
      // Подсадка: копия исходника, укороченная ровно на 100 мс.
      const cut = join(OUT, `__plant__${f}`);
      execFileSync(FFMPEG, ["-v", "error", "-y", "-i", src, "-af", "atrim=start=0.1", "-c:a", "pcm_s16le", cut]);
      src = cut;
    }
    const dst = join(OUT, f.replace(/\.wav$/i, ".mp3"));
    encode(src, dst);
    // Сверяется всегда с ПОДЛИННЫМ исходником: подсадка обязана дать минус.
    const wav = probe(join(IN, f));
    const mp3 = probe(dst);
    const deltaMs = (mp3.duration - wav.duration) * 1000;
    rows.push({ file: f, wav: wav.duration, mp3: mp3.duration, deltaMs, bytesWav: statSync(join(IN, f)).size, bytesMp3: statSync(dst).size });
    if (deltaMs > worstDelta) { worstDelta = deltaMs; worstFile = f; }
    if (deltaMs < bestDelta) bestDelta = deltaMs;
    if (mp3.codec !== BANK.codec || mp3.sampleRate !== BANK.sampleRate || mp3.channels !== BANK.channels) {
      bad.push(`${f}: формат ${mp3.codec}/${mp3.sampleRate}/${mp3.channels} ≠ банку`);
    }
    if (deltaMs < TOLERANCE_MS.min || deltaMs > TOLERANCE_MS.max) {
      bad.push(`${f}: длительность разошлась на ${deltaMs.toFixed(1)} мс (допуск ${TOLERANCE_MS.min}…${TOLERANCE_MS.max} мс)`);
    }
  }

  const totalWav = rows.reduce((a, r) => a + r.bytesWav, 0);
  const totalMp3 = rows.reduce((a, r) => a + r.bytesMp3, 0);
  console.log(`файлов перекодировано: ${rows.length}`);
  console.log(`параметры банка: ${BANK.codec}, ${BANK.bitRate / 1000} kbps, ${BANK.sampleRate} Гц, моно`);
  console.log(`допуск по длительности: ${TOLERANCE_MS.min}…${TOLERANCE_MS.max} мс (односторонний, 4 кадра по 24 мс)`);
  console.log(`разница mp3 − WAV: минимум ${bestDelta.toFixed(1)} мс, максимум ${worstDelta.toFixed(1)} мс (${worstFile})`);
  console.log(`объём: WAV ${(totalWav / 1048576).toFixed(2)} МБ → mp3 ${(totalMp3 / 1048576).toFixed(2)} МБ`);
  if (bad.length) {
    console.log(`ОТКАЗОВ: ${bad.length}`);
    for (const b of bad.slice(0, 10)) console.log(`  ${b}`);
    if (bad.length > 10) console.log(`  … и ещё ${bad.length - 10}`);
  } else {
    console.log("отказов 0");
  }
  writeFileSync(join(OUT, "durations.json"), JSON.stringify(rows, null, 2), "utf-8");
  if (PLANT) {
    console.log(bad.length === files.length
      ? `[плант] поймано ${bad.length} из ${files.length} — односторонний допуск видит обрезку 100 мс`
      : `[плант] ПРОВАЛ: поймано ${bad.length} из ${files.length}`);
    return bad.length === files.length ? 0 : 1;
  }
  return bad.length === 0 ? 0 : 1;
}

process.exit(main());
