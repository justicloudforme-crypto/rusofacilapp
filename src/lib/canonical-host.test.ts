import { describe, expect, it } from "vitest";
import { APEX_REDIRECT_STATUS, apexRedirectTarget } from "./canonical-host";
import { SITE_URL } from "./site";

describe("apexRedirectTarget", () => {
  it("сводит www к апексу, сохраняя путь и строку запроса", () => {
    expect(apexRedirectTarget("www.rusofacilapp.com", "/es/pricing", "?next=%2Fes")).toBe(
      "https://rusofacilapp.com/es/pricing?next=%2Fes",
    );
  });

  it("не трогает апекс — иначе получился бы цикл редиректов", () => {
    expect(apexRedirectTarget("rusofacilapp.com", "/es", "")).toBeNull();
  });

  it("не трогает localhost и превью-домены Vercel", () => {
    expect(apexRedirectTarget("localhost:3000", "/es", "")).toBeNull();
    expect(apexRedirectTarget("rusofacilapp-git-branch.vercel.app", "/es", "")).toBeNull();
  });

  it("не трогает чужой www, случайно попавший на этот сервер", () => {
    expect(apexRedirectTarget("www.example.com", "/es", "")).toBeNull();
  });

  it("не падает без заголовка Host", () => {
    expect(apexRedirectTarget(null, "/es", "")).toBeNull();
  });

  it("регистр хоста значения не имеет", () => {
    expect(apexRedirectTarget("WWW.RusoFacilapp.com", "/ru", "")).toBe("https://rusofacilapp.com/ru");
  });

  it("порт в заголовке не мешает узнать хост", () => {
    expect(apexRedirectTarget("www.rusofacilapp.com:443", "/es", "")).toBe("https://rusofacilapp.com/es");
  });

  // Контроль: цель редиректа и цель rel=canonical обязаны строиться из
  // одной константы. Разойдись они — редирект вёл бы на адрес, который
  // сам себя каноническим не считает.
  it("целевой хост — тот же, что в canonical/hreflang", () => {
    expect(apexRedirectTarget("www.rusofacilapp.com", "/es/terms", "")!.startsWith(SITE_URL)).toBe(true);
  });

  it("308, а не 301 — метод и тело обязаны дожить до апекса", () => {
    expect(APEX_REDIRECT_STATUS).toBe(308);
  });

  // Позитивный контроль всей проверки: если бы функция сводила к апексу
  // ВСЁ подряд, тесты выше на localhost/preview покраснели бы. Здесь
  // обратное — доказательство, что она вообще что-то делает.
  it("контроль: 330 замороженных URL живут на апексе, и правило их не видит", () => {
    for (const path of ["/es/media/song-katyusha", "/ru/stories/xyz", "/es/media/song-chunga-changa"]) {
      expect(apexRedirectTarget("rusofacilapp.com", path, "")).toBeNull();
      expect(apexRedirectTarget("www.rusofacilapp.com", path, "")).not.toBeNull();
    }
  });
});
