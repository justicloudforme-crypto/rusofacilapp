import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isOfflineShellMarkup } from "./sw-cache-policy";

/**
 * КАРКАС «SIN CONEXIÓN» — НЕ СТРАНИЦА (заход 7.255, долг 365). Воркер не
 * кладёт в кеш страниц ответ, который узнан как каркас; здесь — что узнаётся
 * и что нет. Каркас — НАСТОЯЩИЙ файл: переименуют признак в нём — пример
 * упадёт раньше, чем копии разделов снова начнут затираться.
 */
describe("isOfflineShellMarkup", () => {
  it("настоящий каркас public/offline.html узнаётся", () => {
    expect(isOfflineShellMarkup(readFileSync("public/offline.html", "utf8"))).toBe(true);
  });

  it("страница сайта — не каркас", () => {
    const page = '<!DOCTYPE html><html lang="es"><head><title>Curso de ruso online — Niveles A1 a B2 | RusoFácilapp</title></head><body class="min-h-dvh"><main>Cursos</main></body></html>';
    expect(isOfflineShellMarkup(page)).toBe(false);
  });

  it("имя признака в скрипте страницы — не каркас (так его читает OfflineSaveCopy)", () => {
    const page = '<html><body><script>if(document.body.dataset.offlineShell==="1"){}; var s = \'data-offline-shell="1"\';</script></body></html>';
    expect(isOfflineShellMarkup(page)).toBe(false);
  });

  it("копия, помеченная каркасом при показе, — в разметке кеша признака нет", () => {
    expect(isOfflineShellMarkup('<html><body data-offline-copy="1"><main>Cursos</main></body></html>')).toBe(false);
  });
});
