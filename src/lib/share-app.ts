/**
 * «COMPARTIR» — ПОДЕЛИТЬСЯ ПРИЛОЖЕНИЕМ (заход 7.266).
 *
 * Одна функция на все места кнопки. Куда ведёт ссылка:
 *   * в приложении и в браузере Android-телефона — страница приложения в
 *     Play с меткой `referrer=utm_source=share`;
 *   * в браузере компьютера и iPhone — сайт `/es` с `utm_source=share`.
 * Метка в ссылке — единственный след. Событий в аналитику и журнал кнопка
 * не шлёт: это был бы новый сбор данных.
 *
 * Чем делится, по порядку:
 *   1. плагин оболочки `RfShare` (системное окно «Поделиться» Android) —
 *      есть с оболочки 1.0.15 (versionCode 16); в WebView `navigator.share`
 *      обычно нет;
 *   2. `navigator.share` браузера, где он есть;
 *   3. иначе ссылка копируется, и кнопка говорит «скопировано».
 * В оболочке 1.0.14 плагина нет — там сработает 3 (или 2), не сбой.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { PLAY_STORE_URL } from "@/lib/pwa-manifest";

// Адрес страницы приложения записан один раз — в `pwa-manifest.ts`
// (правило 4 сторожа `check:purchase-no-store-link`); здесь только метка.
export const PLAY_SHARE_URL = `${PLAY_STORE_URL}&referrer=utm_source%3Dshare`;
export const SITE_SHARE_URL = "https://rusofacilapp.com/es?utm_source=share";

interface RfSharePlugin {
  share(options: { text: string; title: string }): Promise<void>;
}

const RfShare = registerPlugin<RfSharePlugin>("RfShare");

export type ShareOutcome = "native" | "shared" | "copied" | "cancelled" | "failed";

/** Какую ссылку давать. Чистая функция — её проверяет юнит. */
export function shareUrlFor(input: { native: boolean; userAgent: string }): string {
  if (input.native) return PLAY_SHARE_URL;
  return /Android/i.test(input.userAgent) ? PLAY_SHARE_URL : SITE_SHARE_URL;
}

/** Текст сообщения + ссылка в конце, одной строкой для любого мессенджера. */
export function shareMessage(text: string, url: string): string {
  return `${text} ${url}`;
}

function nativeShareAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("RfShare");
  } catch {
    return false;
  }
}

export async function shareApp(options: { text: string; title: string; native: boolean }): Promise<ShareOutcome> {
  const url = shareUrlFor({ native: options.native, userAgent: navigator.userAgent });
  const message = shareMessage(options.text, url);

  if (nativeShareAvailable()) {
    try {
      await RfShare.share({ text: message, title: options.title });
      return "native";
    } catch {
      // упало окно оболочки — ниже есть ещё два способа
    }
  }

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: options.title, text: options.text, url });
      return "shared";
    } catch (error) {
      // Человек закрыл окно — это его решение, а не сбой; копировать молча не надо.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }

  try {
    await navigator.clipboard.writeText(message);
    return "copied";
  } catch {
    return "failed";
  }
}
