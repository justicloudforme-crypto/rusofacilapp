import { describe, expect, it } from "vitest";
import { TELEGRAM_INVITE_URL } from "@/components/TelegramFloatButton";
import { buildIntroSlides, introSlidesForApp } from "./content";
import { introStatsFrom } from "./stats";

// Заход 7.243 (аудит 7.241, Р10): колода введения в приложении — без
// Telegram. Позитивный контроль: в веб-колоде Telegram есть, иначе
// «ноль в приложении» ничего не значит.
describe("introSlidesForApp", () => {
  for (const lang of ["es", "ru"] as const) {
    const web = buildIntroSlides(introStatsFrom(null), lang);
    const app = introSlidesForApp(web);
    const text = (slides: typeof web) => JSON.stringify(slides);

    it(`${lang}: в вебе Telegram есть (контроль), в приложении — 0`, () => {
      expect(text(web)).toContain("Telegram");
      expect(text(web)).toContain(TELEGRAM_INVITE_URL);
      expect(text(app)).not.toContain("Telegram");
      expect(text(app)).not.toContain(TELEGRAM_INVITE_URL);
    });

    it(`${lang}: число слайдов и прочие ссылки те же, фраза после Telegram осталась`, () => {
      expect(app).toHaveLength(web.length);
      const last = app[app.length - 1];
      expect(last.links?.length).toBe((web[web.length - 1].links?.length ?? 0) - 1);
      expect(last.body.join(" ")).toMatch(lang === "es" ? /elige tu nivel y empieza/ : /выберите уровень и начинайте/);
      const untouched = web.filter((s) => !JSON.stringify(s).includes("Telegram"));
      for (const s of untouched) expect(app.find((a) => a.id === s.id)).toEqual(s);
    });
  }
});
