import { describe, expect, it } from "vitest";
import { anchorTargets, dropSection, normalizeUrl, urlFamily } from "./link-graph";

const ORIGIN = "https://rusofacilapp.com";
const FROM = `${ORIGIN}/es/stories`;

describe("normalizeUrl", () => {
  it("делает абсолютным относительный путь", () => {
    expect(normalizeUrl("/es/terms", FROM, ORIGIN)).toBe(`${ORIGIN}/es/terms`);
  });

  it("отбрасывает якорь и строку запроса — это тот же документ", () => {
    expect(normalizeUrl("/es/pricing?checkout=oxxo_pending#top", FROM, ORIGIN)).toBe(`${ORIGIN}/es/pricing`);
  });

  it("снимает хвостовой слэш, но не превращает корень в пустоту", () => {
    expect(normalizeUrl("/es/media/", FROM, ORIGIN)).toBe(`${ORIGIN}/es/media`);
    expect(normalizeUrl("/", FROM, ORIGIN)).toBe(`${ORIGIN}/`);
  });

  it("не пускает в граф чужой хост и не-HTTP схемы", () => {
    expect(normalizeUrl("https://youtube.com/watch", FROM, ORIGIN)).toBeNull();
    expect(normalizeUrl("mailto:hola@rusofacilapp.com", FROM, ORIGIN)).toBeNull();
    expect(normalizeUrl("tel:+52", FROM, ORIGIN)).toBeNull();
    // Дубль хоста www сведён к апексу редиректом на границе (7.113), но
    // ребром графа он всё равно не является: origin другой.
    expect(normalizeUrl("https://www.rusofacilapp.com/es", FROM, ORIGIN)).toBeNull();
  });

  it("не падает на мусоре вместо адреса", () => {
    expect(normalizeUrl("http://[", FROM, ORIGIN)).toBeNull();
  });
});

describe("dropSection", () => {
  const inner = '<section data-testid="story-link-index"><ul><li><a href="/es/stories/one">Один</a></li></ul></section>';
  const page = `<main><a href="/es/stories/card">Карточка</a>${inner}</main><footer><a href="/es/terms">Términos</a></footer>`;

  it("вырезает названную секцию целиком", () => {
    const cut = dropSection(page, "story-link-index");
    expect(cut).not.toContain("/es/stories/one");
    expect(cut).toContain("/es/stories/card");
    expect(cut).toContain("/es/terms");
  });

  it("считает вложенные section, а не первый закрывающий тег", () => {
    const nested =
      '<section data-testid="media-link-index"><section class="group"><a href="/es/media/inner">В</a></section>' +
      '<a href="/es/media/outer">С</a></section><a href="/es/media">Каталог</a>';
    const cut = dropSection(nested, "media-link-index");
    expect(cut).not.toContain("/es/media/inner");
    expect(cut).not.toContain("/es/media/outer");
    expect(cut).toContain('href="/es/media"');
  });

  it("оставляет документ как есть, если секции в нём нет", () => {
    expect(dropSection(page, "free-puzzle-index")).toBe(page);
  });

  it("позитивный контроль: наивная регулярка на этих же данных ошибается", () => {
    // Без него «вырезано верно» держалось бы на том, что тест написан по
    // тому же коду. Наивный вариант режет до ПЕРВОГО </section> и оставляет
    // ссылку, которую обязан был убрать.
    const nested =
      '<section data-testid="media-link-index"><section class="g"><a href="/es/media/inner">В</a></section>' +
      '<a href="/es/media/outer">С</a></section>';
    const naive = nested.replace(/<section[^>]*data-testid="media-link-index"[\s\S]*?<\/section>/, "");
    expect(naive).toContain("/es/media/outer");
    expect(dropSection(nested, "media-link-index")).not.toContain("/es/media/outer");
  });
});

describe("anchorTargets", () => {
  it("читает href в кавычках, в апострофах и без них, и не зависит от регистра имени", () => {
    const html = `<a href="/es/a">a</a><a HREF='/es/b'>b</a><a href=/es/c>c</a>`;
    expect(anchorTargets(html, FROM, ORIGIN).sort()).toEqual([`${ORIGIN}/es/a`, `${ORIGIN}/es/b`, `${ORIGIN}/es/c`]);
  });

  it("не считает ссылкой <link rel=alternate> — грабли 7.104", () => {
    // +1 ребро на каждую страницу, и все величины графа уезжают согласованно,
    // то есть правдоподобно.
    const html = `<link rel="alternate" hrefLang="ru" href="/ru/stories" /><a href="/es/terms">T</a>`;
    expect(anchorTargets(html, FROM, ORIGIN)).toEqual([`${ORIGIN}/es/terms`]);
  });

  it("считает одну цель один раз, сколько бы ссылок на неё ни стояло", () => {
    const html = `<a href="/es/media">1</a><a href="/es/media">2</a><a href="/es/media/">3</a>`;
    expect(anchorTargets(html, FROM, ORIGIN)).toEqual([`${ORIGIN}/es/media`]);
  });

  it("даёт одно и то же число на повторном вызове", () => {
    const html = Array.from({ length: 40 }, (_, i) => `<a href="/es/p${i}">${i}</a>`).join("");
    expect(anchorTargets(html, FROM, ORIGIN)).toHaveLength(40);
    expect(anchorTargets(html, FROM, ORIGIN)).toHaveLength(40);
  });

  it("грабли 7.114 живут в `.test()`, а не в `exec` — показано, а не заявлено", () => {
    // Честная запись того, что проверка выше НЕ ловит. Подсадка «сделать
    // регулярку общей» оставляет все 16 тестов зелёными, и это свойство
    // формы кода: `while (re.exec(...))` доходит до null и сам обнуляет
    // lastIndex. Теряет совпадения другая форма — `.test()` по одному
    // кандидату, — и вот она, на тех же данных.
    const shared = /<a\b[^>]*?\shref/gi;
    const anchors = Array.from({ length: 40 }, (_, i) => `<a href="/es/p${i}">${i}</a>`);
    const kept = anchors.filter((a) => shared.test(a));
    expect(kept.length).toBe(20);
    const fresh = anchors.filter((a) => /<a\b[^>]*?\shref/i.test(a));
    expect(fresh.length).toBe(40);
  });

  it("вырезает секции до разбора, а не после", () => {
    const html = '<a href="/es/keep">k</a><section data-testid="free-puzzle-index"><a href="/es/drop">d</a></section>';
    expect(anchorTargets(html, FROM, ORIGIN, ["free-puzzle-index"])).toEqual([`${ORIGIN}/es/keep`]);
  });
});

describe("urlFamily", () => {
  it("различает хаб и карточку — прямой контроль на ошибку 7.94", () => {
    expect(urlFamily(`${ORIGIN}/es/stories`, ORIGIN)).toBe("каталог");
    expect(urlFamily(`${ORIGIN}/es/stories/cmsxtq113000bqwncxxdynsed`, ORIGIN)).toBe("рассказ");
    expect(urlFamily(`${ORIGIN}/es/media`, ORIGIN)).toBe("каталог");
    expect(urlFamily(`${ORIGIN}/es/media/song-katyusha`, ORIGIN)).toBe("медиа");
  });

  it("узнаёт остальные семейства карты сайта", () => {
    expect(urlFamily(`${ORIGIN}/es/courses/a1/1`, ORIGIN)).toBe("урок");
    expect(urlFamily(`${ORIGIN}/es/vocabulary/salud`, ORIGIN)).toBe("категория словаря");
    expect(urlFamily(`${ORIGIN}/es/word-games/WORD_SEARCH/A1/1`, ORIGIN)).toBe("пазл");
    expect(urlFamily(`${ORIGIN}/es/alfabeto-cirilico`, ORIGIN)).toBe("статика/лендинги");
    expect(urlFamily(`${ORIGIN}/es`, ORIGIN)).toBe("корень локали");
    expect(urlFamily(`${ORIGIN}/`, ORIGIN)).toBe("корень");
  });
});
