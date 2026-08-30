import type { Page } from "@playwright/test";

/**
 * The recording bench for e2e/voice-recording-local.spec.ts.
 *
 * **Test code only.** Nothing here has a counterpart in the application —
 * the product never learns it is being measured, and none of this ships.
 *
 * Two modes, because the browsers do not agree on what exists:
 *
 * - **"real"** — replace only the microphone. `MediaRecorder`, the encoder,
 *   the Blob, IndexedDB and the <audio> element are the browser's own, so
 *   the format it picks and whether the clip decodes are real. This is the
 *   whole-path run and Chromium does it.
 *
 * - **"substituted"** — replace the microphone AND `MediaRecorder`. For
 *   WebKit, which in Playwright's **Linux** build has no `MediaRecorder`
 *   at all: `typeof MediaRecorder === "undefined"`, so VoiceRecorder
 *   correctly renders "your browser cannot record audio" and no buttons,
 *   and the spec times out clicking a button that is deliberately not
 *   there. That is what turned CI red on 30.08.2026 — not the microphone,
 *   which works in WebKit (measured: a live MediaStream with one audio
 *   track), and not Chromium's --use-fake-device flags, which this bench
 *   has never used for anything.
 *
 *   In this mode WebKit still measures the application's own logic — which
 *   format it asks for, that it stores the format the recorder REPORTS
 *   rather than the one it asked for, that the clip survives a reload,
 *   that nothing goes to the network, and that a device which refuses to
 *   store still plays the clip back. What it cannot measure is a real
 *   encoder, and that stays Chromium's job.
 */
export type RecorderMode = "real" | "substituted";

export interface HarnessOptions {
  mode: RecorderMode;
  /**
   * Answer `isTypeSupported` with false for every WebM type — what real
   * iOS Safari does, and what Playwright's WebKit does NOT do on its own
   * (it claims WebM support iOS has never had; measured in PROGRESS.md
   * 7.47). With WebM off the table the app's own picker has to fall
   * through to audio/mp4, the format an iPhone actually produces.
   */
  refuseWebm: boolean;
}

/** What the substituted recorder reports as its own type.
 *
 * Deliberately NOT the type the app asked for. The rule this whole feature
 * turns on (7.47) is "store the format the recorder reports, never the one
 * you assumed", and a bench that echoes the requested type back cannot
 * tell a correct implementation from the broken one. A recorder that is
 * asked for WebM and answers "audio/wav" makes the difference visible:
 * `audio/wav` in IndexedDB means the app read `recorder.mimeType`.
 *
 * WAV also decodes in every engine with no codec involved, so playback in
 * the substituted run turns on the app handing over the right bytes and
 * the right label, and never on which codecs a CI image happens to ship.
 */
export const SUBSTITUTED_MIME = "audio/wav";

/** Readable from the page as `window.__voiceHarness`. */
export interface VoiceHarnessReport {
  mode: RecorderMode;
  /** The mimeType the app handed to the MediaRecorder constructor — the
   * output of its own format picker, and the thing the iOS-shaped run is
   * really about. */
  requestedMimeType: string | null;
  /** What the browser told us it has, recorded before anything replaced
   * it, so a failing run says which engine it was on. */
  nativeMediaRecorder: string;
  nativeGetUserMedia: string;
  startedCount: number;
  stoppedCount: number;
}

declare global {
  interface Window {
    __voiceHarness?: VoiceHarnessReport;
  }
}

/**
 * Installs the bench. Runs before any page script, in every navigation of
 * this page, so a reload keeps it.
 */
export async function installVoiceHarness(page: Page, options: HarnessOptions): Promise<void> {
  // Reproducing the CI failure on a machine whose WebKit DOES have
  // MediaRecorder. macOS WebKit has it, Playwright's Linux WebKit does
  // not, and that difference cost a red CI run that could not be
  // reproduced locally at all. With this set, the substituted projects see
  // the CI environment exactly: `typeof MediaRecorder === "undefined"`
  // before the bench installs its own.
  //
  //   VOICE_SIMULATE_NO_MEDIA_RECORDER=1 npx playwright test voice-recording-local
  //
  // Never set in CI — there it is the truth rather than a simulation.
  if (process.env.VOICE_SIMULATE_NO_MEDIA_RECORDER && options.mode === "substituted") {
    await page.addInitScript(() => {
      Reflect.deleteProperty(globalThis, "MediaRecorder");
    });
  }
  await page.addInitScript(
    ({ mode, refuseWebm, substitutedMime }) => {
      const report: VoiceHarnessReport = {
        mode,
        requestedMimeType: null,
        nativeMediaRecorder: typeof (globalThis as { MediaRecorder?: unknown }).MediaRecorder,
        nativeGetUserMedia: typeof navigator.mediaDevices?.getUserMedia,
        startedCount: 0,
        stoppedCount: 0,
      };
      window.__voiceHarness = report;

      // ---- the microphone, in every mode ----------------------------------
      //
      // An oscillator through a MediaStreamDestination. Engine-independent
      // on purpose: it needs no launch flag, no capture device and no
      // permission prompt, and it behaves identically in Chromium and
      // WebKit (measured — a live MediaStream with one audio track in
      // both). Only getUserMedia is replaced; what happens to the stream
      // afterwards is the browser's business.
      const openFakeMicrophone = () => {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.frequency.value = 220;
        const destination = ctx.createMediaStreamDestination();
        osc.connect(destination);
        osc.start();
        return destination.stream;
      };
      const devices = navigator.mediaDevices ?? ({} as MediaDevices);
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: Object.assign(devices, { getUserMedia: async () => openFakeMicrophone() }),
      });

      // ---- the recorder ---------------------------------------------------
      if (mode === "real") {
        if (refuseWebm) {
          const real = MediaRecorder.isTypeSupported.bind(MediaRecorder);
          MediaRecorder.isTypeSupported = (type: string) => (/webm/i.test(type) ? false : real(type));
        }
        return;
      }

      /** A real, decodable 16-bit PCM WAV — built here rather than pasted
       * in as base64 so the bench carries no binary blob, and so what the
       * player receives is genuine audio rather than a placeholder that
       * happens to have the right MIME type. */
      const makeWav = (seconds: number, sampleRate: number) => {
        const frames = Math.floor(seconds * sampleRate);
        const buffer = new ArrayBuffer(44 + frames * 2);
        const view = new DataView(buffer);
        const ascii = (offset: number, text: string) => {
          for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
        };
        ascii(0, "RIFF");
        view.setUint32(4, 36 + frames * 2, true);
        ascii(8, "WAVE");
        ascii(12, "fmt ");
        view.setUint32(16, 16, true); // PCM header size
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        ascii(36, "data");
        view.setUint32(40, frames * 2, true);
        for (let i = 0; i < frames; i++) {
          const sample = Math.sin((2 * Math.PI * 220 * i) / sampleRate);
          view.setInt16(44 + i * 2, Math.round(sample * 0x3fff), true);
        }
        return buffer;
      };

      type Listener = ((event: unknown) => void) | null;

      class SubstitutedMediaRecorder {
        static isTypeSupported(type: string): boolean {
          // Exactly what iOS Safari answers when refuseWebm is on: MP4
          // yes, WebM never. Otherwise everything the app may ask for.
          if (refuseWebm && /webm/i.test(type)) return false;
          return /^audio\/(webm|mp4|ogg|wav)/i.test(type);
        }

        readonly stream: MediaStream;
        readonly mimeType = substitutedMime;
        state: "inactive" | "recording" | "paused" = "inactive";
        ondataavailable: Listener = null;
        onstop: Listener = null;
        onstart: Listener = null;
        onerror: Listener = null;

        constructor(stream: MediaStream, options?: { mimeType?: string }) {
          this.stream = stream;
          // The output of the app's own picker. The iOS-shaped run asserts
          // on this: with WebM refused it must be audio/mp4.
          report.requestedMimeType = options?.mimeType ?? "";
        }

        start() {
          this.state = "recording";
          report.startedCount += 1;
          setTimeout(() => this.onstart?.(new Event("start")), 0);
        }

        stop() {
          if (this.state === "inactive") return;
          this.state = "inactive";
          report.stoppedCount += 1;
          setTimeout(() => {
            const data = new Blob([makeWav(0.4, 8000)], { type: substitutedMime });
            this.ondataavailable?.({ data } as unknown as Event);
            this.onstop?.(new Event("stop"));
          }, 30);
        }

        pause() {
          this.state = "paused";
        }
        resume() {
          this.state = "recording";
        }
        requestData() {}
        addEventListener() {}
        removeEventListener() {}
        dispatchEvent() {
          return true;
        }
      }

      Object.defineProperty(globalThis, "MediaRecorder", {
        configurable: true,
        writable: true,
        value: SubstitutedMediaRecorder,
      });
    },
    { mode: options.mode, refuseWebm: options.refuseWebm, substitutedMime: SUBSTITUTED_MIME }
  );
}

/** What the bench and the engine saw. Read after a navigation. */
export async function harnessReport(page: Page): Promise<VoiceHarnessReport> {
  const report = await page.evaluate(() => window.__voiceHarness ?? null);
  if (!report) throw new Error("the voice harness did not install — its init script never ran");
  return report;
}

/**
 * Which bench each Playwright project gets. Explicit and exhaustive: a new
 * project running this spec has to be given a mode here, rather than
 * silently inheriting one and quietly measuring less than it looks like.
 */
export const HARNESS_BY_PROJECT: Record<string, HarnessOptions> = {
  // The whole path with a real encoder.
  chromium: { mode: "real", refuseWebm: false },
  // WebKit, iPhone profile: application logic, substituted recorder.
  "mobile-iphone": { mode: "substituted", refuseWebm: false },
  // The same, with WebM refused the way real iOS refuses it.
  "voice-ios-shape": { mode: "substituted", refuseWebm: true },
};

export function harnessFor(projectName: string): HarnessOptions {
  const options = HARNESS_BY_PROJECT[projectName];
  if (!options) {
    throw new Error(
      `project "${projectName}" runs the voice spec but has no entry in HARNESS_BY_PROJECT — ` +
        "decide whether it gets a real or a substituted recorder, do not let it default"
    );
  }
  return options;
}
