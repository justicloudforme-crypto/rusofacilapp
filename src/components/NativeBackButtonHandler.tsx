"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Registering ANY 'backButton' listener disables Capacitor's default
 * Android back-button behavior entirely (per @capacitor/app's own docs),
 * so once mounted this component is responsible for the whole back-button
 * contract, not just adding to it: go back through the WebView's own
 * history when there is any, otherwise exit — the same two-step behavior
 * every native Android app is expected to have, which this WebView shell
 * doesn't get for free the way a normal browser tab does. No-op on iOS
 * (no hardware back button) and on web.
 */
export default function NativeBackButtonHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        void App.exitApp();
      }
    });

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  return null;
}
