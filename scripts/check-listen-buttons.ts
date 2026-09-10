/**
 * Кнопка «слушать» ВНЕ рассказов: у каждой обязана быть оплаченная запись.
 *
 * ЗАЧЕМ. Правило владельца: звучит только оплаченная записанная озвучка;
 * голоса, сгенерированного на лету, — в том числе браузерного
 * `speechSynthesis` — не должно быть нигде, включая бесплатный доступ.
 * 7.160/7.161 нашли и закрыли этот класс у РАССКАЗОВ и оставили долг 117:
 * «карточки, идиомы, уроки и глоссарий на тот же класс дыры не
 * проверялись». 7.162 часть 2 закрыла долг тремя поверхностями, но
 * поверхностей больше; замер 7.163 нашёл 1008 кнопок, у которых записи не
 * было, а клип на этот самый текст уже был оплачен.
 *
 * ПРАВИЛО, которое держит этот сторож, — асимметричное, как у
 * `check:silent-listen` и `check:mark-truth`:
 *
 *   если продукт рисует орган управления «слушать», для него ОБЯЗАН
 *   находиться настоящий файл; обратное правилом не является.
 *
 * Поверхностей ВОСЕМНАДЦАТЬ, и восемнадцатая появилась в 7.166: тап по
 * слову ВНУТРИ рассказа. Это не кнопка на странице, а орган, который
 * открывается касанием слова, поэтому 7.163 его и не переписал; кнопка
 * там ровно такая же и до 7.166 звучала браузерным голосом у всех, в том
 * числе у анонима на двух бесплатных рассказах (долг 123).
 *
 * Число «без записи» не обязано быть нулём: после 7.166 их 2426, и ни
 * одна не дефект кода. Разложение (PROGRESS.md 7.166): 3 — «груша»,
 * «расцветать», «яблоня» со `song-katyusha`, отложены до 26.09
 * заморозкой; 683 — омографы, которым изолированный клип дал бы чужое
 * ударение; 1740 — 696 словоформ, чей клип аудит не принял ни с первого
 * раза, ни после пересинтеза, и они лежат у владельца на прослушивании
 * (`~/rusofacil-listen/7.166/на-слух/`). Поэтому гейт сравнивает с
 * ЗАКРЕПЛЁННЫМ ЧИСЛОМ (BASELINE ниже, приём `check:brand`): стало
 * больше — падение; стало меньше — тоже падение, чтобы число в
 * PROGRESS.md не расходилось с продуктом молча.
 *
 * ВНИМАНИЕ: числа BASELINE сняты ПОСЛЕ трёх записей 7.166 (27 строк по
 * долгу 126, правка `pickClip` по долгу 125 и 12 052 строки банка слов по
 * долгу 123). Поверхность «рассказы: тап по слову» считается кодом
 * `src/lib/story-word-pick.ts`, поэтому без слитой правки её число
 * разойдётся целиком.
 *
 * Запускать:
 *   npx tsx scripts/check-listen-buttons.ts          # перепись по базе
 *   npx tsx scripts/check-listen-buttons.ts --plant  # позитивный контроль, без базы
 *   npx tsx scripts/check-listen-buttons.ts --census # перепись без гейта
 *
 * `--plant` базы не трогает вовсе и стоит в `verify`/CI: базе CI неоткуда
 * взять 120 уроков и 275 медиа (та же причина, по которой в CI стоит
 * только подсадка `check:silent-listen` — долг 119).
 */
import { isEntryPoint } from "@/lib/entry-point";
import { pickClip, textAudioKey } from "@/lib/lessons/audioKeys";
import { pickReusableClips, type ReusableClipRow } from "@/lib/audio-reuse-pick";
import { sanitizeTextForTTS } from "@/lib/speech";
import { pickWordClip, isHomograph } from "@/lib/story-word-pick";
import { splitStoryParagraphs, buildStoryQueue } from "@/lib/stories";

const PLANT = process.argv.includes("--plant");
const CENSUS_ONLY = process.argv.includes("--census");
/** Форма ДО правки 7.163: только позиционный ключ, у медиа карты нет вовсе.
 * Нужна, чтобы «до» и «после» были сняты ОДНИМ инструментом, а не двумя
 * разными скриптами (PROGRESS.md 4.1). Всегда без гейта. */
const BEFORE = process.argv.includes("--before");

/** Поверхность → сколько кнопок «слушать» она рисует и для скольких из них
 * находится файл. Имена — те же, что в таблице раздела 7.163. */
type Bucket = { buttons: number; withClip: number; samplesWithout: string[] };

function resolve(map: Record<string, string> | undefined, positionKey: string | null, text: string) {
  if (BEFORE) return positionKey && map ? map[positionKey] : undefined;
  return pickClip(map, positionKey, text);
}

function bump(buckets: Map<string, Bucket>, name: string, resolved: string | undefined, sample: string) {
  const b = buckets.get(name) ?? { buttons: 0, withClip: 0, samplesWithout: [] };
  b.buttons++;
  if (resolved) b.withClip++;
  else if (b.samplesWithout.length < 5) b.samplesWithout.push(sample);
  buckets.set(name, b);
}

/**
 * Закреплённые числа переписи по боевой базе на 10.09.2026, ПОСЛЕ трёх
 * записей захода 7.166 (долги 126, 125 и 123). Ключ — поверхность,
 * значение — [кнопок, с записью]. Прошлые числа этой таблицы — в
 * PROGRESS.md 7.164 и 7.165.
 *
 * Вне рассказов без записи осталось **3**: «груша», «расцветать»,
 * «яблоня» со `song-katyusha` — их запись попала бы в серверный HTML
 * замороженной страницы, поэтому она после 26.09.
 *
 * У тапа по слову без записи **2423** места, и ни одно не дефект кода:
 * **683** — омографы (клип изолированного слова дал бы им чужое
 * ударение; правило в `story-word-pick.ts`), **1740** — 696 словоформ,
 * чей клип аудит не принял ни с первого раза, ни после пересинтеза; они
 * лежат владельцу на слух в `~/rusofacil-listen/7.166/на-слух/`.
 */
const BASELINE: Record<string, [number, number]> = {
  "урок: слайды": [679, 679],
  "урок: словарь": [1930, 1930],
  "урок: произношение": [720, 720],
  "урок: грамматика": [737, 737],
  "урок: чтение вслух": [991, 991],
  "урок: алфавит": [33, 33],
  "урок: упражнение (аудирование)": [250, 250],
  "урок: упражнение (диктант)": [232, 232],
  "урок: упражнение (чтение)": [119, 119],
  "медиа: ключевая лексика": [1312, 1309],
  "глоссарий: термин": [119, 119],
  "глоссарий: пример": [240, 240],
  "карточки: слово": [5771, 5771],
  "карточки: пример": [5771, 5771],
  "идиомы: фраза": [771, 771],
  "идиомы: пример": [771, 771],
  "экзамены: упражнения": [148, 148],
  // Тап по слову ВНУТРИ рассказа — не отдельная кнопка на странице, а
  // орган управления, который открывается по касанию слова: у каждого
  // тапаемого слова в окошке перевода есть своя кнопка «слушать». До
  // захода 7.166 все они до единой звучали браузерным голосом (долг 123).
  "рассказы: тап по слову": [56642, 54219],
};

/** Позитивный контроль резолвера, без сети и без базы. */
function plant(): number {
  const cases: { name: string; ok: boolean }[] = [];

  const map = { "vocab-0": "/paid/by-position.mp3", [textAudioKey("пять")]: "/paid/by-text.mp3" };

  // 1. Позиция главнее текста — иначе правка текста в админке рвала бы
  //    связь с уже оплаченным клипом (комментарий в audioKeys.ts).
  cases.push({
    name: "позиционный ключ выигрывает у текстового",
    ok: pickClip({ ...map, [textAudioKey("шесть")]: "/paid/by-text.mp3" }, "vocab-0", "шесть") === "/paid/by-position.mp3",
  });
  // 2. Промах по позиции — берётся текст.
  cases.push({
    name: "промах по позиции: подхватывается текстовый ключ",
    ok: pickClip(map, "vocab-9", "пять") === "/paid/by-text.mp3",
  });
  // 3. Позиционного ключа нет вовсе (примеры на слайдах).
  cases.push({
    name: "ключа нет вовсе (слайды): текстовый ключ работает",
    ok: pickClip(map, null, "пять") === "/paid/by-text.mp3",
  });
  // 4. Отрицательный контроль: чужого текста быть не должно.
  cases.push({
    name: "отрицательный контроль: незнакомый текст не звучит чужим клипом",
    ok: pickClip(map, "vocab-9", "семь") === undefined,
  });
  // 5. Отрицательный контроль: пустая карта ничего не выдумывает.
  cases.push({ name: "отрицательный контроль: пустая карта", ok: pickClip({}, "vocab-0", "пять") === undefined });
  // 6. Отрицательный контроль: совпадение ПОБУКВЕННОЕ.
  cases.push({
    name: "отрицательный контроль: «Пять?» — это не «пять»",
    ok: pickClip(map, null, "Пять?") === undefined,
  });
  // 7. Подсадка формы «до 7.163»: старое выражение audioMap[key] слайдам
  //    не даёт ничего — именно это и было дырой на 679 кнопок.
  const before = (m: Record<string, string>, key: string | null) => (key ? m[key] : undefined);
  cases.push({
    name: "подсадка формы «до 7.163»: слайды остаются без клипа",
    ok: before(map, null) === undefined,
  });

  // 8-10. Порядок выбора чужого клипа по тексту. В 7.164 слайд `a2-15`
  //    перешёл с клипа урока на новый клип глоссария: сортировка
  //    `pickReusableClips` идёт по `contentType`, где `glossary` раньше
  //    `lesson`, а СВОЕГО клипа у того текста не было. Класс закрывается
  //    не заклинанием «увода быть не может», а тремя подсадками.
  const rows: ReusableClipRow[] = [
    { contentType: "lesson", contentId: "a1-14", itemKey: "exercise-0", text: "Я иду в школу.", audioUrl: "/paid/lesson-a1-14.mp3" },
    { contentType: "glossary", contentId: "gloss-1", itemKey: "example-0", text: "Я иду в школу.", audioUrl: "/paid/glossary.mp3" },
    { contentType: "lesson", contentId: "a2-15", itemKey: "slide-text-abc", text: "Я иду в школу.", audioUrl: "/paid/lesson-a2-15.mp3" },
  ];
  cases.push({
    name: "подсадка: СВОЙ урок главнее чужого типа, идущего раньше по алфавиту",
    ok: pickReusableClips(rows, "a2-15")["Я иду в школу."] === "/paid/lesson-a2-15.mp3",
  });
  cases.push({
    name: "подсадка: своего клипа нет — порядок детерминирован (contentType, contentId, itemKey)",
    ok: pickReusableClips(rows, "b1-1")["Я иду в школу."] === "/paid/glossary.mp3",
  });
  cases.push({
    name: "подсадка: рассказ не подхватывается никогда (чужой голос каста)",
    ok:
      pickReusableClips(
        [{ contentType: "story", contentId: "s1", itemKey: "seg-0", text: "Только рассказ.", audioUrl: "/paid/story.mp3" }],
        undefined,
      )["Только рассказ."] === undefined,
  });

  // 11-13. Долг 125: текст с кавычками. Клип лежит под ОЧИЩЕННЫМ текстом
  //    (санитайзер снимает «» перед синтезом), а кнопка спрашивает сырым.
  //    Третья ступень `pickClip` это закрывает, но не имеет права
  //    подменять уже работающие связи.
  const quoted = "Ты когда-нибудь читал «Войну и мир»?";
  const cleanMap = { [textAudioKey(sanitizeTextForTTS(quoted))]: "/paid/cleaned.mp3" };
  cases.push({
    name: "подсадка (долг 125): кнопка с кавычками находит клип по очищенному тексту",
    ok: pickClip(cleanMap, null, quoted) === "/paid/cleaned.mp3",
  });
  cases.push({
    name: "отрицательный контроль: очищенный ключ НЕ подменяет сырой",
    ok:
      pickClip({ ...cleanMap, [textAudioKey(quoted)]: "/paid/raw.mp3" }, null, quoted) === "/paid/raw.mp3",
  });
  cases.push({
    name: "отрицательный контроль: очистка не склеивает разные тексты",
    ok: pickClip(cleanMap, null, "Ты когда-нибудь читал «Анну Каренину»?") === undefined,
  });

  // 14-17. Долг 123: тап по слову внутри рассказа.
  const wordRows: ReusableClipRow[] = [
    { contentType: "word", contentId: "репка", itemKey: "word", text: "репка", audioUrl: "/paid/word.mp3" },
    { contentType: "flashcard", contentId: "c1", itemKey: "word", text: "репка", audioUrl: "/paid/card.mp3" },
    { contentType: "story", contentId: "s1", itemKey: "seg-0", text: "репка", audioUrl: "/paid/story.mp3" },
  ];
  cases.push({
    name: "подсадка (долг 123): свой клип слова главнее клипа карточки",
    ok: pickWordClip(wordRows, "Репка") === "/paid/word.mp3",
  });
  cases.push({
    name: "подсадка (долг 123): своего клипа нет — играет уже оплаченный клип того же текста",
    ok: pickWordClip(wordRows.filter((r) => r.contentType !== "word"), "репка") === "/paid/card.mp3",
  });
  cases.push({
    name: "отрицательный контроль: рассказ тапу не отдаётся (каст из пяти голосов)",
    ok: pickWordClip([wordRows[2]], "репка") === null,
  });
  cases.push({
    name: "отрицательный контроль: омограф не озвучивается изолированным клипом",
    ok:
      pickWordClip(
        [{ contentType: "word", contentId: "замок", itemKey: "word", text: "замок", audioUrl: "/paid/zamok.mp3" }],
        "замок",
      ) === null,
  });
  cases.push({
    name: "отрицательный контроль: ё и е не склеиваются",
    ok:
      pickWordClip(
        [{ contentType: "word", contentId: "все", itemKey: "word", text: "все", audioUrl: "/paid/vse.mp3" }],
        "всё",
      ) === null,
  });
  // Банк слов не имеет права менять клипы кнопок ВНЕ рассказов.
  cases.push({
    name: "подсадка: банк слов не подменяет клип кнопки урока",
    ok:
      pickReusableClips([
        { contentType: "lesson", contentId: "a1-1", itemKey: "vocab-0", text: "репка", audioUrl: "/paid/lesson.mp3" },
        { contentType: "word", contentId: "репка", itemKey: "word", text: "репка", audioUrl: "/paid/word.mp3" },
      ])["репка"] === "/paid/lesson.mp3",
  });

  let caught = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) caught++;
  }
  console.log(`[check:listen-buttons --plant] пройдено ${caught} из ${cases.length}`);
  return caught === cases.length ? 0 : 1;
}

async function census(): Promise<Map<string, Bucket>> {
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const db = new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });
  // Тот же отбор, что у продукта (`clipsByText`), но без `server-only`:
  // правило выбора живёт в одном месте — `pickReusableClips`.
  const clipsByText = async (texts: readonly string[], preferContentId?: string) => {
    const wanted = [...new Set(texts.filter((t) => t))];
    if (wanted.length === 0) return {} as Record<string, string>;
    const rows = (await db.audioAsset.findMany({
      where: { text: { in: wanted }, NOT: { contentType: "story" } },
      select: { contentType: true, contentId: true, itemKey: true, text: true, audioUrl: true },
    })) as ReusableClipRow[];
    return pickReusableClips(rows, preferContentId);
  };
  const buckets = new Map<string, Bucket>();

  const lessonAudio = await db.audioAsset.findMany({
    where: { contentType: "lesson" },
    select: { contentId: true, itemKey: true, text: true, audioUrl: true },
  });
  const perLesson = new Map<string, Record<string, string>>();
  for (const row of lessonAudio) {
    const map = perLesson.get(row.contentId) ?? {};
    map[row.itemKey] = row.audioUrl;
    map[textAudioKey(row.text)] = row.audioUrl;
    perLesson.set(row.contentId, map);
  }

  const lessons = await db.lesson.findMany({ select: { level: true, lessonSlug: true, contentJson: true } });
  for (const row of lessons) {
    let content: Record<string, unknown>;
    try {
      content = JSON.parse(row.contentJson) as Record<string, unknown>;
    } catch {
      continue;
    }
    const contentId = `${row.level}-${row.lessonSlug}`;
    const base = perLesson.get(contentId) ?? {};
    // Ровно то, что делает `/api/lesson-audio`: свои строки, затем
    // переиспользование уже оплаченного клипа по тексту.
    const spoken: string[] = [];
    const collect = (t?: string) => {
      if (t) spoken.push(t);
    };
    const vocabulary = (content.vocabulary ?? []) as { word?: string }[];
    const grammar = (content.grammar ?? {}) as { examples?: { russian?: string }[] };
    const readingPractice = (content.readingPractice ?? {}) as { items?: { text?: string }[] };
    const alphabet = (content.alphabet ?? []) as { name?: string }[];
    const exercises = (content.exercises ?? []) as { type: string; audioText?: string; text?: string }[];
    const slides = (content.slides ?? []) as { audioExamples?: { text?: string }[] }[];
    vocabulary.forEach((v) => collect(v?.word));
    (grammar.examples ?? []).forEach((e) => collect(e?.russian));
    (readingPractice.items ?? []).forEach((i) => collect(i?.text));
    alphabet.forEach((a) => collect(a?.name));
    exercises.forEach((e) => collect(e.audioText ?? e.text));
    slides.forEach((s) => (s.audioExamples ?? []).forEach((e) => collect(e?.text)));

    const map = { ...base };
    // Зеркало `/api/lesson-audio`: спрашиваем и сырой текст, и очищенный —
    // `AudioAsset.text` хранится очищенным (долг 125).
    const unresolved = spoken.filter(
      (t) => map[textAudioKey(t)] === undefined && map[textAudioKey(sanitizeTextForTTS(t))] === undefined,
    );
    const wanted = [...new Set(unresolved.flatMap((t) => [t, sanitizeTextForTTS(t)]))];
    for (const [text, url] of Object.entries(await clipsByText(wanted, contentId))) {
      map[textAudioKey(text)] = url;
    }

    vocabulary.forEach((v, i) => {
      if (!v?.word) return;
      bump(buckets, "урок: словарь", resolve(map, `vocab-${i}`, v.word), `${contentId} ${v.word}`);
      if (i < 6) bump(buckets, "урок: произношение", resolve(map, `vocab-${i}`, v.word), `${contentId} ${v.word}`);
    });
    (grammar.examples ?? []).forEach((e, i) => {
      if (!e?.russian) return;
      bump(buckets, "урок: грамматика", resolve(map, `grammar-example-${i}`, e.russian), `${contentId} ${e.russian}`);
    });
    (readingPractice.items ?? []).forEach((it, i) => {
      if (!it?.text) return;
      bump(buckets, "урок: чтение вслух", resolve(map, `reading-${i}`, it.text), `${contentId} ${it.text}`);
    });
    alphabet.forEach((a, i) => {
      if (!a?.name) return;
      bump(buckets, "урок: алфавит", resolve(map, `alphabet-${i}`, a.name), `${contentId} ${a.name}`);
    });
    exercises.forEach((ex, i) => {
      if (ex.type === "listening" && ex.audioText) {
        bump(buckets, "урок: упражнение (аудирование)", resolve(map, `exercise-listening-${i}`, ex.audioText), contentId);
      } else if (ex.type === "listening-transcription" && ex.audioText) {
        bump(
          buckets,
          "урок: упражнение (диктант)",
          resolve(map, `exercise-listening-transcription-${i}`, ex.audioText),
          contentId,
        );
      } else if (ex.type === "reading-comprehension" && ex.text) {
        bump(buckets, "урок: упражнение (чтение)", resolve(map, `exercise-reading-${i}`, ex.text), contentId);
      }
    });
    slides.forEach((s) =>
      (s.audioExamples ?? []).forEach((e) => {
        if (!e?.text) return;
        bump(buckets, "урок: слайды", resolve(map, null, e.text), `${contentId} ${e.text}`);
      }),
    );
  }

  // Медиа: своей озвучки нет вовсе, только переиспользование.
  const mediaRaw = (await import("@/lib/media/mediaData.json")).default as Record<
    string,
    { vocabulary?: { word: string }[] }
  >;
  const media = Object.entries(mediaRaw).map(([id, item]) => ({ id, vocabulary: item.vocabulary ?? [] }));
  const mediaWords = media.flatMap((item) => item.vocabulary.map((v) => v.word));
  const mediaClips = await clipsByText(mediaWords);
  for (const item of media) {
    for (const v of item.vocabulary) {
      bump(buckets, "медиа: ключевая лексика", BEFORE ? undefined : mediaClips[v.word], `${item.id} ${v.word}`);
    }
  }

  // Глоссарий.
  const terms = await db.glossaryTerm.findMany({ select: { id: true, term: true, examples: true } });
  const glossaryAudio = await db.audioAsset.findMany({
    where: { contentType: "glossary" },
    select: { contentId: true, itemKey: true, audioUrl: true },
  });
  const glossaryHave = new Map(glossaryAudio.map((r) => [`${r.contentId}|${r.itemKey}`, r.audioUrl]));
  for (const t of terms) {
    bump(buckets, "глоссарий: термин", glossaryHave.get(`${t.id}|term`), t.term);
    let examples: { ru?: string }[] = [];
    try {
      examples = JSON.parse(t.examples ?? "[]") as { ru?: string }[];
    } catch {
      examples = [];
    }
    examples.forEach((e, i) => {
      if (!e?.ru) return;
      bump(buckets, "глоссарий: пример", glossaryHave.get(`${t.id}|example-${i}`), `${t.term} #${i}`);
    });
  }

  // Карточки и идиомы — там ключ позиционный и своей формы у него нет.
  const cardAudio = await db.audioAsset.findMany({
    where: { contentType: "flashcard" },
    select: { contentId: true, itemKey: true, audioUrl: true },
  });
  const cardHave = new Map(cardAudio.map((r) => [`${r.contentId}|${r.itemKey}`, r.audioUrl]));
  const cards = await db.flashcardCard.findMany({ select: { id: true, russian: true, exampleRu: true } });
  for (const c of cards) {
    bump(buckets, "карточки: слово", cardHave.get(`${c.id}|word`), c.russian);
    if (c.exampleRu && c.exampleRu.trim()) {
      bump(buckets, "карточки: пример", cardHave.get(`${c.id}|example`), c.russian);
    }
  }

  const idiomAudio = await db.audioAsset.findMany({
    where: { contentType: "idiom" },
    select: { contentId: true, itemKey: true, audioUrl: true },
  });
  const idiomHave = new Map(idiomAudio.map((r) => [`${r.contentId}|${r.itemKey}`, r.audioUrl]));
  const idioms = await db.idiom.findMany({ select: { id: true, phrase: true, contextExampleRu: true } });
  for (const i of idioms) {
    bump(buckets, "идиомы: фраза", idiomHave.get(`${i.id}|phrase`), i.phrase);
    if (i.contextExampleRu && i.contextExampleRu.trim()) {
      bump(buckets, "идиомы: пример", idiomHave.get(`${i.id}|context`), i.phrase);
    }
  }

  // Экзамены — контент статический, ключ позиционный.
  const examAudio = await db.audioAsset.findMany({
    where: { contentType: "exam" },
    select: { contentId: true, itemKey: true, audioUrl: true },
  });
  const examHave = new Map(examAudio.map((r) => [`${r.contentId}|${r.itemKey}`, r.audioUrl]));
  const examContent = (await import("@/lib/exams/content.json")).default as Record<
    string,
    { level?: string; slug?: string; skillAreas?: { exercises?: { type: string; audioText?: string; text?: string }[] }[] }
  >;
  for (const [slug, exam] of Object.entries(examContent)) {
    const level = exam.level ?? slug.split("-")[0];
    const contentId = `${level}-${exam.slug ?? slug}`;
    (exam.skillAreas ?? []).forEach((area, ai) =>
      (area.exercises ?? []).forEach((ex, ei) => {
        let kind: string | null = null;
        if (ex.type === "listening" && ex.audioText) kind = "listening";
        else if (ex.type === "listening-transcription" && ex.audioText) kind = "listening-transcription";
        else if (ex.type === "reading-comprehension" && ex.text) kind = "reading";
        if (!kind) return;
        bump(
          buckets,
          "экзамены: упражнения",
          examHave.get(`${contentId}|area-${ai}-ex-${ei}-${kind}`),
          `${contentId} area-${ai}-ex-${ei}`,
        );
      }),
    );
  }

  // Тап по слову внутри рассказа. Токенизация — та же, что в
  // StoryText.tsx (её регулярное выражение повторено здесь дословно), а
  // правило выбора клипа берётся из общего `pickWordClip`, а не пишется
  // заново.
  const WORD_SPLIT_REGEX = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
  const CYRILLIC_WORD_REGEX = /^[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*$/u;
  const wordBank = (await db.audioAsset.findMany({
    where: { voice: "onyx", NOT: { contentType: "story" } },
    select: { contentType: true, contentId: true, itemKey: true, text: true, audioUrl: true },
  })) as ReusableClipRow[];
  const bankByText = new Map<string, ReusableClipRow[]>();
  for (const row of wordBank) {
    if (!row.text) continue;
    for (const key of new Set([row.text, row.text.toLowerCase()])) {
      const list = bankByText.get(key) ?? [];
      list.push(row);
      bankByText.set(key, list);
    }
  }
  const wordClipCache = new Map<string, string | null>();
  const clipForWord = (word: string) => {
    const cacheKey = word.toLowerCase();
    const cached = wordClipCache.get(cacheKey);
    if (cached !== undefined) return cached ?? undefined;
    const rows = [
      ...new Set([...(bankByText.get(word) ?? []), ...(bankByText.get(cacheKey) ?? [])]),
    ];
    const url = pickWordClip(rows, word);
    wordClipCache.set(cacheKey, url);
    return url ?? undefined;
  };
  const stories = await db.story.findMany({ select: { id: true, text: true } });
  for (const story of stories) {
    for (const item of buildStoryQueue(splitStoryParagraphs(story.text))) {
      for (const token of item.text.split(WORD_SPLIT_REGEX).filter((t) => t.length > 0)) {
        if (!CYRILLIC_WORD_REGEX.test(token)) continue;
        bump(buckets, "рассказы: тап по слову", clipForWord(token), `${story.id} ${token}${isHomograph(token) ? " (омограф)" : ""}`);
      }
    }
  }

  return buckets;
}

async function main(): Promise<number> {
  if (PLANT) return plant();

  const buckets = await census();
  if (buckets.size === 0) {
    console.error(
      "проверять нечего: в этой базе нет ни уроков, ни карточек, ни глоссария. " +
        "«Без записи 0» на пустом множестве результатом не считается (PROGRESS.md 4.1).",
    );
    return 1;
  }

  console.log(`[check:listen-buttons] кнопки «слушать» вне рассказов${BEFORE ? " — ФОРМА ДО 7.163" : ""}:`);
  let totalButtons = 0;
  let totalWith = 0;
  const drift: string[] = [];
  for (const name of Object.keys(BASELINE)) {
    const b = buckets.get(name) ?? { buttons: 0, withClip: 0, samplesWithout: [] };
    totalButtons += b.buttons;
    totalWith += b.withClip;
    const [wantButtons, wantWith] = BASELINE[name];
    const mark = b.buttons === wantButtons && b.withClip === wantWith ? " " : "≠";
    console.log(
      `${mark} ${name.padEnd(34)} кнопок ${String(b.buttons).padStart(5)}  с записью ${String(b.withClip).padStart(5)}  без ${String(b.buttons - b.withClip).padStart(5)}   (закреплено ${wantButtons}/${wantWith})`,
    );
    if (mark === "≠") drift.push(`${name}: ${b.buttons}/${b.withClip} против закреплённых ${wantButtons}/${wantWith}`);
    if (b.samplesWithout.length) console.log(`    без записи, например: ${b.samplesWithout.join(" · ")}`);
  }
  const unknown = [...buckets.keys()].filter((k) => !(k in BASELINE));
  console.log(`\nвсего кнопок ${totalButtons}, с записью ${totalWith}, без записи ${totalButtons - totalWith}`);

  if (CENSUS_ONLY || BEFORE) return 0;
  if (unknown.length) {
    console.error(`новая поверхность без закреплённого числа: ${unknown.join(", ")}`);
    return 1;
  }
  if (drift.length) {
    console.error("\nЧИСЛА РАЗОШЛИСЬ С ЗАКРЕПЛЁННЫМИ (PROGRESS.md 7.163):");
    for (const d of drift) console.error(`  ${d}`);
    return 1;
  }
  console.log("расхождений с закреплёнными числами 0 (контроль — --plant).");
  return 0;
}

// Только когда этот файл — точка входа процесса: импорт его запускать не
// должен (см. src/lib/entry-point.ts и инцидент 29.08.2026).
if (isEntryPoint(import.meta.url)) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
