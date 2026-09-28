// ТАРИФ В ПРИЛОЖЕНИИ — ТОЛЬКО МОСТ ПОКУПКИ; НИ ОДНОЙ ССЫЛКИ НА МАГАЗИН
// ПРИЛОЖЕНИЙ НА ПУТИ ПОКУПКИ (заход 7.244).
//
// ОТКУДА. 29.09.2026 владелец снял на POCO (1.0.12, после выката #439):
// «Un mes 8,49 $» → «Activando…» → вместо окна Google системное
// «Запрошенное приложение не найдено» от RuStore → «No se pudo completar».
// Разбор 7.244: страница на пути покупки не открывает НИЧЕГО, кроме моста
// `Purchases.purchasePackage` (тариф → `buy` → `purchasePackage` →
// `api.purchasePackage`), и 7.243 этого не менял; магазин приложений
// открывался уже по ту сторону моста (PROGRESS 7.244). Этот сторож держит
// страничную половину, чтобы так было и дальше:
//
//   1. на пути покупки (панель тарифов, кнопка и окно замка, мост
//      RevenueCat, модуль «покупка идёт», значок) — ни `market://`, ни
//      `intent://`, ни `play.google.com/store/apps`, ни `details?id=`, ни
//      `window.open`, ни присваивания адреса, ни открытия адреса плагином;
//   2. тариф нажимает `buy(pkg)`, а `buy` зовёт `purchasePackage(pkg)`;
//   3. `purchasePackage` зовёт мост `api.purchasePackage(`;
//   4. во всём `src/` — ни одного `market://` и `intent://`, а
//      `play.google.com/store/apps` — только в `related_applications`
//      манифеста (`pwa-manifest.ts`: это не ссылка, её не нажать).
//      Ссылка «управлять подпиской» (`store/account/subscriptions`) —
//      своя кнопка у ДЕЙСТВУЮЩЕЙ подписки, не покупка;
//   5. отказ магазина не немой: событие Sentry «NativeStorePurchaseFailed»
//      и код «RC-BUY-…» под «No se pudo completar» — чтобы по фото экрана
//      было видно, что ответил Google.
//
// Живая половина — `e2e/purchase-no-store-link.spec.ts` (настоящий мост
// Capacitor, четыре экрана с тарифами, контроль браузера).
//
//   node scripts/check-purchase-no-store-link.mjs [--plant]
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PATH_FILES = {
  panel: "src/components/native/NativePurchasePanel.tsx",
  buyButton: "src/components/native/NativeBuyButton.tsx",
  lockedLink: "src/components/native/NativeLockedLink.tsx",
  lockedModal: "src/components/native/NativeLockedModal.tsx",
  paywall: "src/contexts/PaywallContext.tsx",
  client: "src/lib/revenuecat-client.ts",
  activation: "src/lib/access-activation.ts",
  status: "src/components/native/ActivationAwareStatus.tsx",
};

/** Единственное поимённое исключение правила 4. */
const MANIFEST = "src/lib/pwa-manifest.ts";

const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const STORE = /market:\/\/|intent:\/\/|play\.google\.com\/store\/apps|details\?id=/;
const EXIT = /window\.open\s*\(|location\.(href|assign|replace)\s*[=(]|\blocation\s*=|\bopenUrl\s*\(|Browser\.open|AppLauncher/;

function srcFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|mjs|js)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
    }
  };
  walk("src");
  return out;
}

/** Тело функции/колбэка от `start` до парной закрывающей скобки. */
function bodyFrom(src, start) {
  const open = src.indexOf("{", start);
  if (start < 0 || open < 0) return "";
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return "";
}

export function judge(files) {
  const bad = [];
  for (const [key, path] of Object.entries(PATH_FILES)) {
    const s = strip(files[path] ?? "");
    if (!s) bad.push(`${path}: файла нет — сторож и код разошлись`);
    const store = s.match(STORE);
    if (store) bad.push(`${path}: на пути покупки ссылка на магазин приложений «${store[0]}» (правило 1)`);
    const exit = s.match(EXIT);
    if (exit) bad.push(`${path}: на пути покупки уход со страницы «${exit[0]}» (правило 1)`);
    void key;
  }

  const panel = strip(files[PATH_FILES.panel] ?? "");
  const option = /<button[^>]*onClick=\{\(\) => void buy\(pkg\)\}[^>]*data-testid="native-purchase-option"/.test(panel);
  if (!option) bad.push(`${PATH_FILES.panel}: тариф (native-purchase-option) не нажимает buy(pkg) (правило 2)`);
  const buy = bodyFrom(panel, panel.indexOf("const buy = useCallback("));
  if (!/await purchasePackage\(pkg\)/.test(buy)) bad.push(`${PATH_FILES.panel}: buy не зовёт purchasePackage(pkg) — тариф не доходит до моста (правило 2)`);
  if (!/beginPurchase\(\);/.test(buy)) bad.push(`${PATH_FILES.panel}: buy не публикует «покупка идёт» (Ж.1) до моста`);
  // Правило 5: отказ магазина не немой — событие Sentry и код на экране.
  if (!/Sentry\.captureMessage\(`NativeStorePurchaseFailed: \$\{outcome\.code\}`/.test(buy) || !/setStage\(\{ kind: "failed", code \}\)/.test(buy)) {
    bad.push(`${PATH_FILES.panel}: отказ магазина снова немой — нет события Sentry или кода на экране (правило 5)`);
  }

  const client = strip(files[PATH_FILES.client] ?? "");
  const pp = bodyFrom(client, client.indexOf("export async function purchasePackage("));
  if (!/await api\.purchasePackage\(\{ aPackage: pkg \}\)/.test(pp)) bad.push(`${PATH_FILES.client}: purchasePackage не зовёт мост api.purchasePackage (правило 3)`);

  for (const [path, src] of Object.entries(files)) {
    if (!path.startsWith("src/")) continue;
    const s = strip(src);
    const scheme = s.match(/market:\/\/|intent:\/\//);
    if (scheme) bad.push(`${path}: «${scheme[0]}» в коде сайта (правило 4)`);
    if (path !== MANIFEST && /play\.google\.com\/store\/apps/.test(s)) bad.push(`${path}: ссылка на страницу приложения в Google Play вне манифеста (правило 4)`);
  }
  return bad;
}

function readAll() {
  const out = {};
  for (const p of new Set([...Object.values(PATH_FILES), ...srcFiles()])) out[p] = readFileSync(p, "utf8");
  return out;
}

function main() {
  const files = readAll();
  const bad = judge(files);
  if (!process.argv.includes("--plant")) {
    if (bad.length) {
      console.error("check:purchase-no-store-link — ОТКАЗ:");
      for (const b of bad) console.error(`  ${b}`);
      return 1;
    }
    console.log(`check:purchase-no-store-link — тариф ведёт только в мост покупки; на пути покупки (${Object.keys(PATH_FILES).length} файлов) ссылок на магазины и уходов со страницы 0; market:// и intent:// в src — 0. Контроль — --plant.`);
    return 0;
  }
  let ok = bad.length === 0;
  console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие исходники`);
  const edit = (path, from, to) => {
    const next = (files[path] ?? "").replace(from, to);
    return next === files[path] ? null : { ...files, [path]: next };
  };
  const P = PATH_FILES;
  const cases = [
    ["отказ магазина уводит на market://", edit(P.panel, 'setStage({ kind: "failed" });', 'window.location.href = "market://details?id=com.rusofacilapp.app"; setStage({ kind: "failed" });'), "правило 1"],
    ["отказ магазина открывает страницу приложения в Google Play", edit(P.panel, 'setStage({ kind: "failed" });', 'window.open("https://play.google.com/store/apps/details?id=com.rusofacilapp.app"); setStage({ kind: "failed" });'), "правило 1"],
    ["тариф стал ссылкой вместо моста", edit(P.panel, "onClick={() => void buy(pkg)}", "onClick={() => { location.href = `https://play.google.com/store/apps/details?id=com.rusofacilapp.app`; }}"), "правило 2"],
    ["вызов моста убран из buy", edit(P.panel, "const outcome = await purchasePackage(pkg);", 'const outcome = { kind: "error", message: "" } as const;'), "правило 2"],
    ["мост убран из purchasePackage", edit(P.client, "await api.purchasePackage({ aPackage: pkg })", "await Promise.reject(new Error(\"no bridge\"))"), "правило 3"],
    ["кнопка замка открывает intent://", edit(P.buyButton, "onClick={() => openPaywall(reason, kind)}", 'onClick={() => window.open("intent://details?id=com.rusofacilapp.app#Intent;scheme=market;end")}'), "правило 1"],
    ["окно замка со ссылкой на Google Play", edit(P.paywall, "return (", 'const store = "https://play.google.com/store/apps/details?id=com.rusofacilapp.app";\n  return ('), "правило 1"],
    ["market:// вне пути покупки (подвал)", edit("src/components/Footer.tsx", "return (", 'const m = "market://details?id=com.rusofacilapp.app";\n  return ('), "правило 4"],
    ["Ж.1 убран: «покупка идёт» не публикуется", edit(P.panel, "      beginPurchase();\n", ""), "Ж.1"],
    ["отказ магазина снова без кода", edit(P.panel, 'setStage({ kind: "failed", code });', 'setStage({ kind: "failed" });'), "правило 5"],
  ];
  let caught = 0;
  for (const [name, patched, expect] of cases) {
    if (!patched) {
      console.log(`  НЕ ПРИМЕНИЛАСЬ — ${name}`);
      ok = false;
      continue;
    }
    const hit = judge(patched).some((m) => m.includes(expect));
    if (hit) caught++;
    console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
  }
  // Отрицательный контроль: ссылка «управлять подпиской» (своя кнопка) — не нарушение.
  const manage = edit("src/app/[lang]/profile/page.tsx", "href={playSubscriptionCenterUrl()}", 'href="https://play.google.com/store/account/subscriptions"');
  const manageOk = manage !== null && judge(manage).length === 0;
  console.log(`  ${manageOk ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — ссылка «управлять подпиской» на своей кнопке`);
  ok &&= caught === cases.length && manageOk;
  console.log(ok ? `check:purchase-no-store-link --plant — ${caught} из ${cases.length} подсадок, 1 из 1 отрицательный контроль` : "check:purchase-no-store-link --plant — FAILED");
  return ok ? 0 : 1;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
