import type { CapacitorConfig } from "@capacitor/cli";

// RusoFásil runs server components, API routes, a DB, cookie auth, and
// Stripe — it cannot be statically exported (`output: "export"` would break
// all of that). Capacitor instead wraps a REMOTE URL in a native WebView
// (a standard, documented Capacitor mode, not a workaround): the app is a
// thin native shell that loads the real Next.js server, same as opening it
// in a browser tab but with native chrome (splash screen, status bar) and
// access to native APIs.
//
// `server.url` below points at a LAN dev URL by default so a phone/tablet
// on the same Wi-Fi (or a simulator) can reach the developer's `next dev`
// server directly — `localhost` inside a simulator/device means the
// device itself, not the host machine, so a real IP is required. Before
// building for a store release, set CAPACITOR_SERVER_URL to the deployed
// production HTTPS URL (see MOBILE.md) and drop `cleartext`.
const devServerUrl = process.env.CAPACITOR_SERVER_URL ?? "http://192.168.1.69:3000";

const config: CapacitorConfig = {
  appId: "com.rusofasil.app",
  appName: "RusoFásil",
  // Required by the Capacitor CLI schema (and `cap doctor`, which errors
  // on a missing index.html) even though nothing here is ever actually
  // served — server.url below is what really loads. Points at a tiny
  // placeholder dir rather than Next's public/, so `cap sync` doesn't
  // copy the whole public/ tree (audio, icons, etc.) into ios//android/
  // for no reason.
  webDir: "capacitor-shell",
  server: {
    url: devServerUrl,
    cleartext: devServerUrl.startsWith("http://"),
  },
  plugins: {
    // Keep the native splash (resources/splash.png, brand gradient) up
    // until the remote page has actually painted, instead of Capacitor's
    // default ~500ms timer — a slow LAN/dev-server load would otherwise
    // flash to a blank WebView before content arrives. The page itself
    // must call SplashScreen.hide() once ready if this is set to false;
    // autoHide keeps it simple for now since there's no native entry code
    // in this remote-URL setup to call that from.
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#3730a3",
      androidSplashResourceName: "splash",
    },
    // Style.Light = dark text/icons, for a light background — matches the
    // site's default light theme (Navbar's bg-background/80 sits under the
    // status bar). Style naming is inverted from what it sounds like: see
    // @capacitor/status-bar's Style enum doc comments.
    StatusBar: {
      style: "LIGHT",
    },
  },
};

export default config;
