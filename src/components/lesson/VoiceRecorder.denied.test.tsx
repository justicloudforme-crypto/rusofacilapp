/**
 * ОТКАЗ В МИКРОФОНЕ ВНУТРИ ПРИЛОЖЕНИЯ — долг 112 (заход 7.287).
 *
 * Замер на эмуляторе (Android 16, оболочка 1.0.16, урок A1-1): при
 * первом «Grabar» система показывает окно разрешения; после двух
 * «Don't allow» Android окно больше не показывает (флаг USER_FIXED), и
 * ученик видел «Revisa los permisos del navegador» — браузера в
 * приложении нет, искать нечего. Теперь в оболочке — путь в настройках
 * телефона, в браузере — прежний текст.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import es from "@/dictionaries/es.json";

const native = { value: false };
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => native.value } }));

import VoiceRecorder from "./VoiceRecorder";

const p = es.lesson.pronunciation;
const dict = {
  recordLabel: p.recordLabel,
  stopLabel: p.stopLabel,
  retryLabel: p.retryLabel,
  permissionDenied: p.permissionDenied,
  permissionDeniedApp: p.permissionDeniedApp,
  unsupported: p.recordingNotSupported,
  recordingFailed: p.recordingFailed,
  playbackFailed: p.playbackFailed,
  yourRecording: p.yourRecording,
  storageUnavailable: p.storageUnavailable,
  storageFull: p.storageFull,
  savedRecordingLabel: p.savedRecordingLabel,
  deleteRecordingLabel: p.deleteRecordingLabel,
};

const ORIGINAL_MEDIA = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
const ORIGINAL_RECORDER = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;

beforeEach(() => {
  // Отказ — ровно то, что WebView отдаёт странице, когда Android
  // разрешение не выдал: `NotAllowedError` из getUserMedia.
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")) },
  });
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = class {};
});

afterEach(() => {
  cleanup();
  if (ORIGINAL_MEDIA) Object.defineProperty(navigator, "mediaDevices", ORIGINAL_MEDIA);
  else delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = ORIGINAL_RECORDER;
});

async function denyOnce() {
  render(<VoiceRecorder dict={dict} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(p.recordLabel) }));
  });
}

describe("VoiceRecorder: отказ в микрофоне (долг 112)", () => {
  it("в приложении говорит, где включить микрофон, и не отсылает к браузеру", async () => {
    native.value = true;
    await denyOnce();
    expect(screen.getByText(p.permissionDeniedApp)).toBeTruthy();
    expect(screen.queryByText(p.permissionDenied)).toBeNull();
    expect(p.permissionDeniedApp).not.toMatch(/navegador/i);
    expect(p.permissionDeniedApp).toMatch(/ajustes del teléfono/i);
  });

  it("в браузере — прежний текст про разрешения браузера", async () => {
    native.value = false;
    await denyOnce();
    expect(screen.getByText(p.permissionDenied)).toBeTruthy();
    expect(screen.queryByText(p.permissionDeniedApp)).toBeNull();
  });

  it("русский словарь тоже различает приложение и браузер", async () => {
    const ru = (await import("@/dictionaries/ru.json")).default.lesson;
    for (const block of [ru.pronunciation, ru.readAloud]) {
      expect(block.permissionDeniedApp).toMatch(/настройках телефона/);
      expect(block.permissionDeniedApp).not.toMatch(/браузер/);
    }
  });
});
