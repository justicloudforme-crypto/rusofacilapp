// Is there a defect at the seams of a story's concatenated narration?
//
// Why this exists — 30.08.2026. The owner reported crackle and noise at the
// paragraph seams of the glued story audio. "It crackles" is not a
// measurement, and the pipeline that produces those files
// (prisma/concat-story-audio.ts) splices MPEG bitstreams with `-c copy`,
// which is a construction that CAN go wrong in five separate ways. This
// script measures all five, so the next report of the same kind is answered
// with numbers on the first pass instead of a fresh investigation.
//
// It works entirely from `public/audio/stories/<storyId>/<p>-<s>.mp3`, the
// local generation cache, and rebuilds the concatenation the same way the
// pipeline does. That rebuild is not an approximation: the Blob key is
// content-addressed (`full.<sha256[0:16]>.mp3`), so `--hashes` proves the
// rebuilt bytes are the bytes production serves. Nothing here calls the
// narration API, uploads, or writes to a database — see the golden rule in
// CLAUDE.md.
//
// The five questions, one number each:
//
//   1. parameters   do the fragments agree on bitrate / sample rate /
//                   channel mode? A stream copy across a change produces a
//                   stream the decoder cannot follow.
//   2. frames       does the output hold exactly the fragments' frames
//                   (plus the muxer's own header frame)? Duplicated or
//                   dropped frames show up here as arithmetic, because
//                   these fragments are CBR.
//   3. reservoir    is main_data_begin non-zero in the FIRST frame after a
//                   splice? That frame's audio then lives in bytes that
//                   belong to the PREVIOUS fragment, and the decoder
//                   reconstructs it from the wrong audio. This is the
//                   classic reason mp3 files cannot be byte-joined.
//   4. step         max |x[n] - x[n-1]| in ±80 ms around the seam, on the
//                   decoded waveform — a click.
//   5. dc           the DC offset either side of the seam; a step between
//                   them is a thump.
//
// A seam is only "bad" relative to the same recording elsewhere, so every
// join is compared against RANDOM windows of the same size drawn from the
// same file, at least half a second away from any seam. Speech is full of
// large steps (every /t/ and /k/ is one); a fixed threshold either flags
// them all or finds nothing.
//
//   node scripts/check-story-audio-joins.mjs                 # every story
//   node scripts/check-story-audio-joins.mjs --story=<id>,<id>
//   node scripts/check-story-audio-joins.mjs --control       # see below
//   node scripts/check-story-audio-joins.mjs --hashes        # rebuild == what production serves
//
// --control is mandatory before believing a clean run (PROGRESS.md 4.1).
// It plants four cases and requires the right verdict on each:
//   a clean tone                                  -> must report nothing
//   the same tone with one sample displaced       -> must be found
//   real narration cut at its loudest sample and
//     butt-joined                                 -> must be found
//   that same spot in the same clip, uncut        -> must report nothing
// The third is the one that matters: it is a seam of exactly the kind this
// script claims to detect, made out of the same audio it is run on. The
// fourth exists because the third alone would also pass if the measurement
// simply fired on loud speech.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const ROOT = arg("root", "public/audio/stories");
const ONLY = arg("story", null);
const LIMIT = Number(arg("limit", "0")) || Infinity;
const RUN_CONTROL = argv.includes("--control");
const CHECK_HASHES = argv.includes("--hashes");
const JSON_OUT = arg("json", null);

const SR = 24000;
const WINDOW = Math.round(0.08 * SR);

/** ffmpeg, from PATH or from the copy pip's imageio-ffmpeg ships — the same
 * two places src/lib/video-lesson/youtubeCaptions.ts looks, duplicated here
 * because that module is `server-only` and this is a plain script. */
function resolveFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    /* fall through */
  }
  try {
    return execFileSync("python3", ["-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"])
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- mp3 frames

const BITRATES_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1];
const BITRATES_V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1];
const RATES = { 3: [44100, 48000, 32000, -1], 2: [22050, 24000, 16000, -1], 0: [11025, 12000, 8000, -1] };

/** Walks the MPEG Layer III frames of a buffer. Deliberately minimal: it
 * only reads what the five questions above need. */
export function walkFrames(buf) {
  const frames = [];
  const id3Mid = [];
  let i = 0;
  if (buf.length > 10 && buf.toString("latin1", 0, 3) === "ID3") {
    i = 10 + (((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f));
  }
  const id3Header = i;
  while (i < buf.length - 4) {
    if (buf.toString("latin1", i, i + 3) === "ID3") {
      id3Mid.push(i);
      i += 10 + (((buf[i + 6] & 0x7f) << 21) | ((buf[i + 7] & 0x7f) << 14) | ((buf[i + 8] & 0x7f) << 7) | (buf[i + 9] & 0x7f));
      continue;
    }
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) {
      i += 1;
      continue;
    }
    const version = (buf[i + 1] >> 3) & 0x03;
    const layer = (buf[i + 1] >> 1) & 0x03;
    if (layer !== 1 || version === 1) {
      i += 1;
      continue;
    }
    const bitrate = (version === 3 ? BITRATES_V1L3 : BITRATES_V2L3)[(buf[i + 2] >> 4) & 0x0f];
    const sampleRate = RATES[version][(buf[i + 2] >> 2) & 0x03];
    if (bitrate <= 0 || sampleRate <= 0) {
      i += 1;
      continue;
    }
    const padding = (buf[i + 2] >> 1) & 0x01;
    const channelMode = (buf[i + 3] >> 6) & 0x03;
    const samplesPerFrame = version === 3 ? 1152 : 576;
    const length = Math.floor(((samplesPerFrame / 8) * bitrate * 1000) / sampleRate) + padding;
    if (length < 24 || i + length > buf.length) break;
    // main_data_begin is the first field of the side info, which starts
    // after the header plus the 2 CRC bytes present when the protection bit
    // is CLEAR. 9 bits on MPEG-1, 8 on MPEG-2/2.5.
    const si = i + 4 + ((buf[i + 1] & 0x01) === 0 ? 2 : 0);
    const mainDataBegin = version === 3 ? (buf[si] << 1) | (buf[si + 1] >> 7) : buf[si];
    const tag = buf.toString("latin1", i + 4, Math.min(i + 44, buf.length));
    frames.push({
      offset: i,
      length,
      bitrate,
      sampleRate,
      channelMode,
      samplesPerFrame,
      mainDataBegin,
      isXing: tag.includes("Xing") || tag.includes("Info") || tag.includes("VBRI"),
    });
    i += length;
  }
  return { id3Header, id3Mid, frames };
}

// ---------------------------------------------------------------- waveform

function decode(ffmpeg, file) {
  const out = execFileSync(ffmpeg, ["-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", String(SR), "-"], {
    maxBuffer: 1 << 29,
  });
  const n = out.length >> 1;
  const pcm = new Float32Array(n);
  for (let k = 0; k < n; k++) pcm[k] = out.readInt16LE(k * 2) / 32768;
  return pcm;
}

function windowStats(x, a, b) {
  let peak = 0;
  let step = 0;
  let sum = 0;
  let n = 0;
  for (let i = Math.max(1, a); i < Math.min(x.length, b); i++) {
    const v = Math.abs(x[i]);
    if (v > peak) peak = v;
    const d = Math.abs(x[i] - x[i - 1]);
    if (d > step) step = d;
    sum += x[i];
    n++;
  }
  return { peak, step, dc: n ? sum / n : 0 };
}

// ---------------------------------------------------------------- rebuild

/** Fragment order is buildStoryQueue()'s order: paragraph then sentence,
 * both NUMERIC — a string sort puts "10-0" before "9-0" and would measure
 * seams that do not exist. */
export function orderedKeys(dir) {
  return readdirSync(dir)
    .filter((f) => /^\d+-\d+\.mp3$/.test(f))
    .map((f) => f.slice(0, -4))
    .sort((a, b) => {
      const [ap, as] = a.split("-").map(Number);
      const [bp, bs] = b.split("-").map(Number);
      return ap - bp || as - bs;
    });
}

function concatCopy(ffmpeg, dir, keys, out) {
  const list = path.join(path.dirname(out), path.basename(out) + ".txt");
  writeFileSync(list, keys.map((k) => `file '${path.resolve(dir, k + ".mp3").replace(/'/g, "'\\''")}'`).join("\n"));
  execFileSync(ffmpeg, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out]);
  return out;
}

/** Sample index of each seam. Exact, not estimated: the fragments are CBR,
 * so the output's frames are the fragments' frames in order, and the only
 * unknown — how many samples the decoder drops at the head — falls out of
 * `frames × samplesPerFrame − decoded length`. Getting this wrong by that
 * one amount (1105 samples, 46 ms) puts every measurement outside its own
 * window, which is how the first version of this reported every seam clean
 * for the wrong reason. */
function seamSamples(fullFrames, clipFrameCounts, decodedLength) {
  const spf = fullFrames.frames[0].samplesPerFrame;
  const headSkip = fullFrames.frames.length * spf - decodedLength;
  const leading = fullFrames.frames.findIndex((f) => !f.isXing);
  const out = [];
  let acc = leading;
  for (let i = 0; i < clipFrameCounts.length; i++) {
    if (i > 0) out.push({ frame: acc, sample: acc * spf - headSkip });
    acc += clipFrameCounts[i];
  }
  return { seams: out, headSkip, spf };
}

export function auditStory(ffmpeg, tmp, storyDir, storyId) {
  const keys = orderedKeys(storyDir);
  if (keys.length < 2) return null;
  const clipFiles = keys.map((k) => path.resolve(storyDir, k + ".mp3"));
  const clipWalks = clipFiles.map((f) => walkFrames(readFileSync(f)));
  const full = concatCopy(ffmpeg, storyDir, keys, path.join(tmp, "full.mp3"));
  const fullBuf = readFileSync(full);
  const fullWalk = walkFrames(fullBuf);
  const x = decode(ffmpeg, full);

  const params = new Set();
  for (const w of clipWalks) for (const f of w.frames) params.add(`${f.bitrate}k/${f.sampleRate}/${f.channelMode}`);
  const expectedFrames = clipWalks.reduce((a, w) => a + w.frames.length, 0);
  const { seams, headSkip } = seamSamples(fullWalk, clipWalks.map((w) => w.frames.length), x.length);

  const joins = seams.map((s, i) => {
    const st = windowStats(x, s.sample - WINDOW, s.sample + WINDOW);
    const before = windowStats(x, s.sample - WINDOW, s.sample);
    const after = windowStats(x, s.sample, s.sample + WINDOW);
    return {
      index: i + 1,
      key: keys[i + 1],
      seconds: s.sample / SR,
      step: st.step,
      peak: st.peak,
      dcStep: Math.abs(after.dc - before.dc),
      mainDataBegin: fullWalk.frames[s.frame]?.mainDataBegin ?? null,
    };
  });

  // Controls from inside the same file: one random window per seam.
  let seed = 1013904223 ^ storyId.length;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const random = [];
  let guard = 0;
  while (random.length < joins.length && guard++ < joins.length * 60) {
    const c = Math.round(rnd() * Math.max(1, x.length - 2 * WINDOW)) + WINDOW;
    if (seams.some((s) => Math.abs(s.sample - c) < 0.5 * SR)) continue;
    random.push(windowStats(x, c - WINDOW, c + WINDOW));
  }

  return {
    storyId,
    clips: keys.length,
    seconds: x.length / SR,
    headSkipSamples: headSkip,
    params: [...params],
    frames: fullWalk.frames.length,
    expectedFrames,
    extraFrames: fullWalk.frames.length - expectedFrames,
    id3TagsMidStream: fullWalk.id3Mid.length,
    reservoirRefsAtSeams: joins.filter((j) => j.mainDataBegin > 0).length,
    joins,
    randomSteps: random.map((r) => r.step),
    sha256: createHash("sha256").update(fullBuf).digest("hex").slice(0, 16),
  };
}

// ---------------------------------------------------------------- verdict

const quantile = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

/** A seam is reported only when it is worse than the recording it sits in.
 * The bar is the 99th percentile of the random windows across the whole run
 * — i.e. a seam has to be more abrupt than 99% of ordinary speech in the
 * same corpus — and never below an absolute floor, so a very quiet story
 * cannot lower the bar for everyone. */
function verdict(results) {
  const randomAll = results.flatMap((r) => r.randomSteps);
  const bar = Math.max(0.25, quantile(randomAll, 0.99));
  const findings = [];
  for (const r of results) {
    if (r.params.length > 1) findings.push(`${r.storyId}: fragments disagree on encoding — ${r.params.join(", ")}`);
    if (r.extraFrames < 0 || r.extraFrames > 1)
      findings.push(`${r.storyId}: ${r.frames} frames against ${r.expectedFrames} in the fragments (expected +1 for the muxer's header frame)`);
    if (r.id3TagsMidStream > 0) findings.push(`${r.storyId}: ${r.id3TagsMidStream} ID3 tag(s) inside the stream`);
    if (r.reservoirRefsAtSeams > 0)
      findings.push(`${r.storyId}: ${r.reservoirRefsAtSeams} seam(s) whose first frame reads the previous fragment's bit reservoir`);
    for (const j of r.joins) {
      if (j.step > bar) findings.push(`${r.storyId}: seam ${j.index} (${j.key}) at ${j.seconds.toFixed(2)}s — step ${j.step.toFixed(3)} over the ${bar.toFixed(3)} bar`);
      if (j.dcStep > 0.01) findings.push(`${r.storyId}: seam ${j.index} at ${j.seconds.toFixed(2)}s — DC step ${j.dcStep.toFixed(4)}`);
    }
  }
  return { bar, randomAll, findings };
}

// ---------------------------------------------------------------- control

function writeWav(pcm, file) {
  const data = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++)
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32768))), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
  return file;
}

function runControl(ffmpeg, tmp, sampleClip) {
  console.log("\n=== positive control: the measurement must find a seam that is really there ===");
  const n = 6 * SR;
  const tone = new Float32Array(n);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < n; i++) tone[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / SR) + 0.01 * rnd();

  const at = 3 * SR;
  const stepOf = (x, c) => windowStats(x, c - WINDOW, c + WINDOW).step;
  const cleanStep = stepOf(tone, at);

  const planted = Float32Array.from(tone);
  planted[at] = Math.max(-1, Math.min(1, planted[at] + 0.25));
  const plantedStep = stepOf(planted, at);

  const real = decode(ffmpeg, sampleClip);
  // Cut at the loudest sample, not at an arbitrary second. A splice made in
  // a pause is not a splice this script needs to find — the real seams are
  // all in near-silence, which is precisely why they measure clean — so a
  // control cut in a pause would "fail" while proving nothing. Cutting at a
  // vowel peak is the artefact the owner described: two unrelated waveforms
  // butt-joined at full amplitude.
  let cut = Math.round(1.2 * SR);
  let loudest = 0;
  for (let i = SR; i < real.length - SR; i++) {
    const v = Math.abs(real[i]);
    if (v > loudest) {
      loudest = v;
      cut = i;
    }
  }
  const drop = Math.round(0.37 * SR);
  const spliced = new Float32Array(real.length - drop);
  spliced.set(real.subarray(0, cut), 0);
  spliced.set(real.subarray(cut + drop), cut);
  const splicedStep = stepOf(spliced, cut);
  const intactStep = stepOf(real, cut);
  writeWav(spliced, path.join(tmp, "control-spliced.wav"));

  const bar = 0.25;
  const checks = [
    ["a clean tone reports nothing", cleanStep <= bar, `step ${cleanStep.toFixed(4)} ≤ ${bar}`],
    ["one displaced sample is found", plantedStep > bar, `step ${plantedStep.toFixed(4)} > ${bar}`],
    [
      "real narration cut at its loudest sample is found",
      splicedStep > bar,
      `step ${splicedStep.toFixed(4)} > ${bar} (cut at ${(cut / SR).toFixed(2)}s, |x|=${loudest.toFixed(3)})`,
    ],
    ["the same spot, uncut, reports nothing", intactStep <= bar, `step ${intactStep.toFixed(4)} ≤ ${bar}`],
  ];
  let ok = true;
  for (const [label, pass, detail] of checks) {
    console.log(`  ${pass ? "ok    " : "FAILED"} ${label} — ${detail}`);
    ok &&= pass;
  }
  return ok;
}

// ---------------------------------------------------------------- main

async function main() {
  const ffmpeg = resolveFfmpeg();
  if (!ffmpeg) {
    console.error("No ffmpeg binary (checked PATH and imageio_ffmpeg) — nothing to measure.");
    process.exitCode = 1;
    return;
  }
  let stories;
  try {
    stories = readdirSync(ROOT).filter((d) => statSync(path.join(ROOT, d)).isDirectory());
  } catch {
    console.error(`No local narration cache at ${ROOT}. This script reads public/audio/stories, which is gitignored — run it on a machine that has it.`);
    process.exitCode = 1;
    return;
  }
  if (ONLY) {
    const wanted = new Set(ONLY.split(",").filter(Boolean));
    stories = stories.filter((s) => wanted.has(s));
  }
  stories = stories.slice(0, LIMIT);

  const tmp = mkdtempSync(path.join(tmpdir(), "story-joins-"));
  const results = [];
  for (const [i, storyId] of stories.entries()) {
    const r = auditStory(ffmpeg, tmp, path.join(ROOT, storyId), storyId);
    if (r) results.push(r);
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${stories.length} stories`);
  }

  const { bar, randomAll, findings } = verdict(results);
  const joinSteps = results.flatMap((r) => r.joins.map((j) => j.step));
  console.log(`\nstories ${results.length}, seams ${joinSteps.length}`);
  console.log(
    `  step at a seam        p50 ${quantile(joinSteps, 0.5).toFixed(4)}  p90 ${quantile(joinSteps, 0.9).toFixed(4)}  p99 ${quantile(joinSteps, 0.99).toFixed(4)}  max ${Math.max(0, ...joinSteps).toFixed(4)}`
  );
  console.log(
    `  step in a random window p50 ${quantile(randomAll, 0.5).toFixed(4)}  p90 ${quantile(randomAll, 0.9).toFixed(4)}  p99 ${quantile(randomAll, 0.99).toFixed(4)}  max ${Math.max(0, ...randomAll).toFixed(4)}`
  );
  console.log(`  bar for a finding: ${bar.toFixed(4)}`);
  console.log(`  encodings seen: ${[...new Set(results.flatMap((r) => r.params))].join(", ")}`);
  console.log(`  seams reading the previous fragment's reservoir: ${results.reduce((a, r) => a + r.reservoirRefsAtSeams, 0)}`);

  if (CHECK_HASHES) {
    console.log("\n--hashes: rebuilt bytes against the content-addressed name production serves");
    console.log("  compare each sha256 below with the `full.<hash>.mp3` in that story's Story.fullAudioUrl");
    results.forEach((r) => console.log(`  ${r.storyId} ${r.sha256}`));
  }

  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(results));

  let controlOk = true;
  if (RUN_CONTROL) {
    const sample = path.join(ROOT, results[0]?.storyId ?? "", `${orderedKeys(path.join(ROOT, results[0]?.storyId ?? "."))[0]}.mp3`);
    controlOk = runControl(ffmpeg, tmp, sample);
  } else {
    console.log("\n  (no --control: this run has NOT shown it can detect a seam defect — see PROGRESS.md 4.1)");
  }

  console.log(`\nseams with problems: ${findings.length}`);
  findings.slice(0, 40).forEach((f) => console.log(`  ${f}`));
  process.exitCode = findings.length || !controlOk ? 1 : 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
