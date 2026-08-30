import { expect, test, type Page } from "@playwright/test";

/**
 * The claim this file exists to prove: **a practice recording never leaves
 * the device.**
 *
 * Owner's decision, 30.08.2026 — a recording is made, listened to and
 * compared with the model in one session on one phone, and paying a cloud
 * bill to keep it was buying nothing. The upload route and the object
 * write are gone from the code (src/lib/voice-storage.ts says what is
 * left, and why), but "gone from the code" is an argument, not a
 * measurement. This is the measurement: the whole cycle runs with a fake
 * microphone, and a single request to our API or to a storage host while
 * recording or playing fails the run.
 *
 * A zero without a positive control is not a result (PROGRESS.md 4.1), so
 * "the network guard catches an upload" below re-introduces exactly the
 * request that was removed, at the same point in the same flow, and
 * requires the guard to fail on it. If that test stops failing to detect
 * it, the guard has stopped guarding and every "0 requests" above it is
 * worthless.
 *
 * The lesson used is /es/courses/a1/1: level 1 of every level is free, so
 * the read-aloud block renders for an anonymous visitor and the test needs
 * no account, no subscription and no seeded data.
 */

const LESSON = "/es/courses/a1/1";
/** From src/dictionaries/es.json — lesson.readAloud. Matched as text on
 * purpose: if a label changes, this test should be updated with it, not
 * silently match a different button. */
// The buttons carry an emoji before the word ("🎙️ Grabar", "↻ Grabar de
// nuevo"), so these anchor on the end of the accessible name rather than
// matching it whole — and "Grabar$" therefore cannot pick up the
// re-record button by accident.
const RECORD = /Grabar$/;
const STOP = /Detener$/;
const RE_RECORD = /Grabar de nuevo$/;
const SAVED_LABEL = "Tu grabación guardada en este dispositivo:";

/**
 * A microphone made of an oscillator.
 *
 * `getUserMedia` is replaced; **nothing downstream of it is**. MediaRecorder
 * is the browser's own, so is the encoder, the Blob, IndexedDB and the
 * <audio> element that plays the result — which is the point: the format
 * the recorder chooses (WebM/Opus in Chromium, MP4/AAC in WebKit) is real,
 * and so is whether the clip decodes.
 *
 * Chromium's --use-fake-device-for-media-capture would do the same job in
 * Chromium alone. This works in WebKit too, and the iOS-shaped run below
 * is the one that matters most, so both projects use the same fake rather
 * than two different ones.
 */
async function prepare(page: Page, testInfo: { project: { name: string } }) {
  await installFakeMicrophone(page);
  if (testInfo.project.name === "voice-ios-shape") await shapeLikeIos(page);
}

async function installFakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    const make = () => {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.frequency.value = 220;
      const dest = ctx.createMediaStreamDestination();
      osc.connect(dest);
      osc.start();
      return dest.stream;
    };
    const devices = navigator.mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: Object.assign(devices, { getUserMedia: async () => make() }),
    });
  });
}

/**
 * The "iOS shape" half of the run, applied only in the voice-ios-shape
 * project: WebKit with `MediaRecorder.isTypeSupported` answering false for
 * every WebM type. Playwright's WebKit claims WebM support that real iOS
 * Safari has never had (measured, PROGRESS.md 7.47), so without this the
 * WebKit run would record WebM and never exercise the format an iPhone
 * actually produces. With it, the recorder falls through to audio/mp4.
 *
 * This makes the run iOS-SHAPED. It is not an iPhone, and the spec says so
 * where it asserts, so that a pass here is not mistaken for debt 22 being
 * closed.
 */
async function shapeLikeIos(page: Page) {
  await page.addInitScript(() => {
    const real = MediaRecorder.isTypeSupported.bind(MediaRecorder);
    MediaRecorder.isTypeSupported = (type: string) => (/webm/i.test(type) ? false : real(type));
  });
}

/** Every request the page makes, from the moment it is armed. */
function watchRequests(page: Page) {
  const seen: string[] = [];
  let armed = false;
  page.on("request", (request) => {
    if (armed) seen.push(request.url());
  });
  return {
    arm: () => {
      armed = true;
      seen.length = 0;
    },
    disarm: () => {
      armed = false;
    },
    /**
     * Only what would mean a recording left the device: a call to our own
     * API, or any request to an object store. Static assets and RSC
     * payloads are the framework's business and are not what the owner's
     * decision was about.
     */
    offenders: () =>
      seen.filter(
        (url) =>
          /\/api\//.test(new URL(url).pathname) ||
          /blob\.vercel-storage\.com|vercel-storage\.com|blob\.core\.windows\.net|s3[.-]/.test(url)
      ),
    all: () => [...seen],
  };
}

/** What the browser's own database holds for this page's practice items. */
async function storedRecordings(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ key: string; mimeType: string; bytes: number; durationMs: number }[]>(
        (resolve, reject) => {
          const open = indexedDB.open("rusofacil-voice");
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains("recordings")) return resolve([]);
            const req = db.transaction("recordings", "readonly").objectStore("recordings").getAll();
            req.onerror = () => reject(req.error);
            req.onsuccess = () =>
              resolve(
                req.result.map((r: Record<string, unknown>) => ({
                  key: String(r.key),
                  mimeType: String(r.mimeType),
                  bytes: Number(r.bytes),
                  durationMs: Number(r.durationMs),
                }))
              );
          };
        }
      )
  );
}

/** Records one clip in the first read-aloud item on the page. */
async function recordOnce(page: Page) {

  await page.getByRole("button", { name: RECORD }).first().click();
  const stop = page.getByRole("button", { name: STOP }).first();
  await expect(stop).toBeVisible();
  // Long enough for the encoder to emit a frame on both engines; the
  // clip's own length is not what is being measured.
  await page.waitForTimeout(1200);
  await stop.click();

}

/**
 * The clip really decodes — the difference between a working player and
 * the native control's own error text in the phone's language (7.47).
 *
 * `load()` is called explicitly, and that is a finding rather than a
 * convenience: WebKit on an iPhone profile leaves a `<audio controls>`
 * element at readyState 0 until something asks it to load, so a check that
 * only read readyState would call a perfectly good clip broken on exactly
 * the platform the original report came from. A student tapping play is
 * what does this in real life.
 */
async function expectPlayable(page: Page) {
  const audio = page.locator("audio").first();
  await expect(audio).toBeVisible({ timeout: 15_000 });
  await expect(audio).toHaveAttribute("src", /^blob:/);
  await audio.evaluate((el: HTMLAudioElement) => el.load());
  // Poll on readyState, not on "no error yet": an element that has not
  // started loading also has error === null, and the first version of this
  // helper passed on exactly that — in Chromium, where decoding happened
  // to finish first. WebKit, which loads lazily, is what exposed it.
  await expect
    .poll(
      async () =>
        audio.evaluate((el: HTMLAudioElement) => (el.error ? `error ${el.error.code}` : el.readyState)),
      { timeout: 15_000, message: "the player never decoded the recording" }
    )
    .toBeGreaterThanOrEqual(1);
}

test.describe("voice practice recordings stay on the device", () => {
  test("record, play, reload, still there — and not one request out", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    const net = watchRequests(page);

    await page.goto(LESSON, { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: RECORD }).first()).toBeVisible();

    net.arm();
    await recordOnce(page);
    await expectPlayable(page);
    net.disarm();

    expect(
      net.offenders(),
      "a recording reached the network while being recorded or played back"
    ).toEqual([]);

    // Written to the device, once, under this item's key. Polled, because
    // the write is deliberately fire-and-forget: the student sees their
    // player the moment the clip exists, not when the disk agrees.
    await expect.poll(async () => (await storedRecordings(page)).length, { timeout: 10_000 }).toBe(1);
    const stored = await storedRecordings(page);
    expect(stored[0].bytes).toBeGreaterThan(0);
    expect(stored[0].mimeType, "the recorder's own format has to be carried, not assumed").toMatch(
      /^audio\//
    );
    if (testInfo.project.name === "voice-ios-shape") {
      // With WebM refused, the branch real iOS Safari takes is the one
      // that ran — and the clip above already played back from it.
      expect(stored[0].mimeType, "iOS-shaped run must produce the iOS format").toMatch(/^audio\/mp4/);
    }

    // The half that a Blob URL alone cannot do: survive a reload.
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(SAVED_LABEL).first()).toBeVisible({ timeout: 15_000 });

    net.arm();
    await expectPlayable(page);
    net.disarm();
    expect(net.offenders(), "playing a restored recording reached the network").toEqual([]);

    // One recording per phrase: re-recording the same item replaces it.
    net.arm();
    await page.getByRole("button", { name: RE_RECORD }).first().click();
    await recordOnce(page);
    await expectPlayable(page);
    net.disarm();
    expect(net.offenders()).toEqual([]);
    await expect
      .poll(async () => (await storedRecordings(page)).length, { timeout: 10_000 })
      .toBe(1);
  });

  /**
   * The positive control. It puts the removed upload back — the same POST
   * to the same path, fired from the same moment in the flow (the instant
   * the recorded clip becomes an object URL) — and requires the guard to
   * see it. Without this, "0 requests" above is a claim about a detector
   * nobody has tested.
   */
  test("control: the network guard catches an upload put back", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.addInitScript(() => {
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (obj: Blob | MediaSource) => {
        if (obj instanceof Blob && obj.type.startsWith("audio/")) {
          // Exactly what VoiceRecorder used to do here.
          const form = new FormData();
          form.append("level", "a1");
          form.append("lesson", "1");
          form.append("itemKey", "control");
          form.append("file", obj, "recording.webm");
          void fetch("/api/voice-submissions", { method: "POST", body: form }).catch(() => {});
        }
        return create(obj);
      };
    });
    const net = watchRequests(page);

    await page.goto(LESSON, { waitUntil: "networkidle" });
    net.arm();
    await recordOnce(page);
    await expect(page.locator("audio").first()).toBeVisible({ timeout: 15_000 });
    // Give the planted request time to actually be issued — a guard that
    // only passes because the test finished first proves nothing.
    await page.waitForTimeout(1500);
    net.disarm();

    const caught = net.offenders();
    expect(caught.some((url) => url.includes("/api/voice-submissions"))).toBe(true);
  });

  /**
   * A device that will not store anything must still let the student
   * record, hear themselves and compare — that is the entire feature. Only
   * the "still here tomorrow" half is lost, and the sentence saying so
   * comes from the dictionary, in the visitor's own language.
   */
  test("a refusal to store is soft: the clip still plays, and says so", async ({ page }, testInfo) => {
    await prepare(page, testInfo);
    await page.addInitScript(() => {
      // The shape both failures take from the caller's side: on some
      // browsers indexedDB.open throws outright, on others the transaction
      // aborts with QuotaExceededError. Either way the recorder must not
      // lose the clip over it.
      Object.defineProperty(window, "indexedDB", {
        configurable: true,
        get() {
          throw new DOMException("storage is blocked", "InvalidStateError");
        },
      });
    });

    await page.goto(LESSON, { waitUntil: "networkidle" });
    await recordOnce(page);
    await expectPlayable(page);
    await expect(
      page.getByText("no puede guardarla en el dispositivo", { exact: false }).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
