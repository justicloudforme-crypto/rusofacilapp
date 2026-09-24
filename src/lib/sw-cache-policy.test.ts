import { describe, expect, it } from "vitest";
import {
  AUDIO_CACHE_NAME,
  AUDIO_HOST_SUFFIX,
  CACHE_BUDGETS,
  CACHE_BUDGET_BY_KEY,
  isAudioClipUrl,
  isOfflineContentPath,
  looksClosedForThisVisitor,
} from "./sw-cache-policy";

/**
 * ДОЛГ 77 — ПОЧЕМУ МАРШРУТ КЛИПОВ НЕ СРАБАТЫВАЛ, ПРОВЕРЕНО ПРАВИЛОМ.
 *
 * `RegExpRoute` у `serwist` отказывается применять регулярку к ЧУЖОМУ
 * адресу, если совпадение начинается не с нулевого символа. Именно это и
 * происходило: маршрут `static-audio-assets` описан как `\.(mp3|wav|ogg)$`,
 * а клипы лежат на `*.public.blob.vercel-storage.com`, где совпадение —
 * в конце строки. Замер 7.143 на живом проде: 40 запрошенных клипов, 40
 * ответов 200, 0 записей в `static-audio-assets` и 32 в общем
 * `cross-origin`.
 *
 * Первый случай ниже воспроизводит ровно это условие: та самая регулярка
 * на том самом адресе совпадает НЕ с нулевого символа, а новое правило
 * отвечает «да» независимо от места совпадения.
 */
const REAL_CLIP = `https://abcd1234.public.blob.vercel-storage.com/stories/repka/0-0.mp3`;

describe("долг 77: клип озвучки узнаётся на чужом источнике", () => {
  it("воспроизводит условие отказа: совпадение регулярки начинается НЕ с нулевого символа", () => {
    const serwistLikeRegExp = /\.(?:mp3|wav|ogg)$/i;
    const match = serwistLikeRegExp.exec(REAL_CLIP);
    expect(match, "регулярка обязана совпасть — иначе случай воспроизведён не тот").not.toBeNull();
    // Ровно то условие, по которому serwist отказывался применять маршрут.
    expect(match!.index).toBeGreaterThan(0);
  });

  it("новое правило узнаёт настоящий боевой клип", () => {
    expect(isAudioClipUrl(new URL(REAL_CLIP))).toBe(true);
  });

  it("узнаёт все четыре расширения, которыми озвучка бывает", () => {
    for (const ext of ["mp3", "wav", "ogg", "m4a"]) {
      expect(isAudioClipUrl(new URL(`https://x.public.blob.vercel-storage.com/a/b.${ext}`)), ext).toBe(true);
    }
  });

  it("локальный кеш генерации `/audio/…` — тоже клип", () => {
    expect(isAudioClipUrl(new URL("http://localhost:3000/audio/stories/repka/0-0.mp3"))).toBe(true);
  });

  it("КОНТРОЛЬ: не-звук с того же источника клипом не считается", () => {
    expect(isAudioClipUrl(new URL("https://x.public.blob.vercel-storage.com/a/b.png"))).toBe(false);
  });

  it("КОНТРОЛЬ: чужой хост, лишь СОДЕРЖАЩИЙ наш суффикс, клипом не считается", () => {
    // `endsWith`, а не `includes`: подстроку содержит и подставной адрес.
    expect(isAudioClipUrl(new URL("https://evil.public.blob.vercel-storage.com.attacker.tld/a/b.mp3"))).toBe(false);
  });

  it("КОНТРОЛЬ: звук со стороннего сайта не наш и в наш кеш не кладётся", () => {
    expect(isAudioClipUrl(new URL("https://example.com/a/b.mp3"))).toBe(false);
  });

  it("суффикс хоста начинается с точки — иначе правило ловило бы подстроку", () => {
    expect(AUDIO_HOST_SUFFIX.startsWith(".")).toBe(true);
  });
});

/**
 * ДОЛГИ 75 И 76 — ТАБЛИЦА БЮДЖЕТОВ ЕСТЬ И ОНА ПОЛНАЯ.
 *
 * Сами числа проверяет живая проба `e2e/sw-cache-budget.spec.ts`: она
 * считает, сколько записей и правда лежит в каждом кеше после обычного
 * пользования. Здесь — форма таблицы, без которой проба не знала бы, с чем
 * сверять.
 */
describe("долги 75 и 76: бюджет объявлен у каждого кеша", () => {
  it("шесть кешей, и у каждого свой ключ (шестой — содержание, заход 7.229)", () => {
    // «section» добавлен 25.09.2026 (7.230, строка 309): корни разделов
    // получили свой кеш — без него вкладки каркаса без сети вели в пустоту.
    expect(CACHE_BUDGETS.map((b) => b.key)).toEqual([
      "html",
      "content",
      "section",
      "rsc",
      "rscPrefetch",
      "others",
      "audio",
    ]);
  });

  it("у документов свой счёт, отдельный от статики (долг 76)", () => {
    expect(CACHE_BUDGET_BY_KEY.html.key).not.toBe(CACHE_BUDGET_BY_KEY.others.key);
    expect(CACHE_BUDGET_BY_KEY.html.maxEntries).toBeGreaterThanOrEqual(12);
  });

  it("предзагрузка объявлена шире прежних 32 (долг 75: было измерено 139)", () => {
    expect(CACHE_BUDGET_BY_KEY.rscPrefetch.maxEntries).toBeGreaterThan(32);
  });

  it("клипы живут дольше часа — прежний общий кеш давал ровно 3600 секунд (долг 77)", () => {
    expect(CACHE_BUDGET_BY_KEY.audio.maxAgeSeconds).toBeGreaterThan(3600);
    expect(CACHE_BUDGET_BY_KEY.audio.maxEntries).toBeGreaterThan(32);
  });

  it("у каждой строки написано, ЗАЧЕМ именно столько", () => {
    for (const budget of CACHE_BUDGETS) {
      expect(budget.why.length, budget.key).toBeGreaterThan(40);
      expect(budget.maxEntries, budget.key).toBeGreaterThan(0);
      expect(budget.maxAgeSeconds, budget.key).toBeGreaterThan(0);
    }
  });

  it("кеш клипов не метится отпечатком сборки — клип от выката не меняется", () => {
    expect(AUDIO_CACHE_NAME).toBe("rf-audio");
  });
});

/**
 * ОФЛАЙН-2 (заход 7.229): ЧТО ЧИТАЕТСЯ БЕЗ СЕТИ И ЧТО НА ТЕЛЕФОНЕ НЕ
 * ОСТАЁТСЯ.
 *
 * Оба правила проверяются С ДВУХ СТОРОН — «попало» и «не попало». Список
 * без второй половины означал бы «берём всё подряд», а признак
 * закрытости без второй половины — «не кладём ничего».
 */
describe("офлайн-2: перечень страниц, которые читают без сети", () => {
  it("урок, рассказ, словарь тем и карточки — считаются содержанием", () => {
    for (const path of [
      "/ru/courses/a1/2",
      "/es/courses/b2/17",
      "/ru/stories/cmt07mslt0000bance9fb6rkw",
      "/es/vocabulary",
      "/es/vocabulary/comida",
    ]) {
      expect(isOfflineContentPath(path), path).toBe(true);
    }
  });

  it("игры, экзамены, поиск, кабинет и каталоги — НЕ содержание (решение владельца, 7.227)", () => {
    for (const path of [
      "/ru/word-games",
      "/ru/word-games/CROSSWORD/A1/1",
      "/ru/profile",
      "/ru/admin/lessons",
      "/ru/courses",
      "/ru/courses/a1",
      "/ru/stories",
      "/ru/glossary/padezh",
      "/ru/pricing",
      "/api/health",
      "/offline.html",
    ]) {
      expect(isOfflineContentPath(path), path).toBe(false);
    }
  });

  it("чужая локаль в первом сегменте не проходит — правило про НАШИ адреса", () => {
    expect(isOfflineContentPath("/fr/courses/a1/2")).toBe(false);
    expect(isOfflineContentPath("/courses/a1/2")).toBe(false);
  });
});

describe("офлайн-2: закрытое этому посетителю на телефоне не остаётся", () => {
  /** Ровно та подпись, которую печатает `paywallJsonLd` (src/lib/site.ts). */
  const CLOSED = `<script type="application/ld+json">{"@context":"https://schema.org","isAccessibleForFree":false,"hasPart":{"cssSelector":".paywall-lock"}}</script>`;
  const OPEN = `<script type="application/ld+json">{"@context":"https://schema.org","isAccessibleForFree":true}</script>`;

  it("страница, у которой закрытая часть не отдана, — закрыта", () => {
    expect(looksClosedForThisVisitor(`<html><body>${CLOSED}</body></html>`)).toBe(true);
  });

  it("страница подписчика — открыта, и её копия класться обязана", () => {
    expect(looksClosedForThisVisitor(`<html><body>${OPEN}</body></html>`)).toBe(false);
  });

  it("страница без подписи вовсе (каталог, словарь тем) — не закрыта", () => {
    expect(looksClosedForThisVisitor("<html><body><h1>Vocabulario</h1></body></html>")).toBe(false);
  });
});

describe("офлайн-2: потолок кеша содержания назван числом", () => {
  it("свой кеш есть, и он не делит потолок с общим кешем документов", () => {
    const content = CACHE_BUDGET_BY_KEY.content;
    expect(content).toBeDefined();
    // Тридцать шесть, а не сорок: 25.09.2026 (7.230) у корней разделов
    // появился свой кеш, каталоги оказались тяжелее материала, и счёт
    // сохранённого на устройстве пересчитан — см. `why`.
    expect(content.maxEntries).toBe(36);
    // Тридцать суток, а не сутки: читать сохранённое человек собирается
    // НЕ в тот же день, когда открыл.
    expect(content.maxAgeSeconds).toBe(30 * 24 * 60 * 60);
    expect(content.maxAgeSeconds).toBeGreaterThan(CACHE_BUDGET_BY_KEY.html.maxAgeSeconds);
  });

  it("числа замера названы в объяснении потолка, а не забыты", () => {
    // 240 068 байт — урок `/ru/courses/a1/2`, 236 308 — рассказ; оба
    // сняты на собранной сборке 23.09.2026.
    expect(CACHE_BUDGET_BY_KEY.content.why).toMatch(/240 068/);
    expect(CACHE_BUDGET_BY_KEY.content.why).toMatch(/236 308/);
    // Перемер 25.09.2026 (7.230) — и он в объяснении тоже назван.
    expect(CACHE_BUDGET_BY_KEY.content.why).toMatch(/252 585/);
  });

  it("у каждого объявленного кеша своя строка бюджета — их семь", () => {
    expect(CACHE_BUDGETS).toHaveLength(7);
    expect(new Set(CACHE_BUDGETS.map((b) => b.key)).size).toBe(7);
  });

  /**
   * ЗАХОД 7.230 (ОФЛАЙН-2б, строка 309). Корни разделов — это три из
   * пяти вкладок каркаса, и до этого захода им не полагалось кеша
   * вовсе: обычный `html` живёт сутки и вытесняется первым же обходом.
   */
  it("корни разделов: свой потолок, свой срок и число, объяснённое замером", () => {
    const section = CACHE_BUDGET_BY_KEY.section;
    expect(section.maxEntries).toBe(4);
    expect(section.maxAgeSeconds).toBe(30 * 24 * 60 * 60);
    expect(section.why).toMatch(/два раздела × две локали/);
    // Материалу разделы не мешают: счёт у них отдельный и потолок свой.
    expect(section.maxEntries).toBeLessThan(CACHE_BUDGET_BY_KEY.content.maxEntries);
  });
});
