/**
 * Пересев локальной `dev.db` КОНТЕНТОМ с прода: `Story` и `Exam`.
 * Дополняет `prisma/pull-bank-from-prod.ts`, который переносит банк
 * (`WordGamePuzzle` + `FlashcardCard`) и рассказов с экзаменами не касается.
 *
 * Прод — ТОЛЬКО НА ЧТЕНИЕ. Боевое соединение открывается отдельным
 * клиентом, и на нём выполняются только `findMany`. Ни одного `create`,
 * `update`, `delete` или `$executeRaw` по этому клиенту в файле нет.
 *
 * ЗАЧЕМ. Долг 54 (PROGRESS.md 7.12, заведён 7.130): у рассказов на проде
 * и локально по 325 строк, все 325 заголовков совпадают, а `id` — только
 * 10. `id` рассказа — это адрес страницы (`/es|ru/stories/<id>`), поэтому
 * 315 из 325 адресов локальная копия строит не теми, и сравнивать её
 * вывод с продовым нельзя вовсе.
 *
 * ПОЧЕМУ СОПОСТАВЛЕНИЕ ПО ЗАГОЛОВКУ, А НЕ ПО `id`. По `id` сходится 10 из
 * 325 — этого мало, чтобы что-то перенести. Заголовок же взаимно
 * однозначен с обеих сторон, и скрипт это ПРОВЕРЯЕТ, а не предполагает:
 * при дубле заголовка или при непарном заголовке он отказывается писать.
 *
 * ЧТО ПЕРЕЕЗЖАЕТ ВМЕСТЕ С `id`. На `Story.id` ссылаются три места, и ни
 * одно из них не внешний ключ, то есть база о них не знает и каскадом не
 * починит:
 *   • `AudioAsset(contentType = "story").contentId` — озвучка. Без
 *     переноса локальная копия немеет на 315 рассказах из 325.
 *   • `StoryReadingProgress.storyId` — прогресс чтения.
 *   • `GrammarCheckResult(entityType = "Story").entityId` — кэш проверок
 *     грамматики; без переноса он протухает и стоит новых вызовов LLM.
 *
 * ЭКЗАМЕНЫ. Таблица `Exam` — это ПЕРЕОПРЕДЕЛЕНИЕ, которое пишет админка,
 * а не источник экзаменов: `getExamContent()` (src/lib/exams/content.ts)
 * сначала смотрит в неё, а при промахе берёт `src/lib/exams/content.json`
 * — файл в репозитории, одинаковый локально и на проде, 12 экзаменов.
 * Поэтому «на проде 12, локально 0» — это утверждение о том, что видит
 * читатель, а не о строках: строк `Exam` на проде столько же, сколько
 * локально. Скрипт переносит их сколько бы их ни было и печатает число.
 *
 *   npm run db:pull-content-from-prod              # показать, ничего не писать
 *   npm run db:pull-content-from-prod -- --apply   # записать в ЛОКАЛЬНУЮ dev.db
 *   npm run db:pull-content-from-prod:plant        # позитивный контроль сверки
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ (`--plant`) обязателен по правилу 4.1: сверка,
 * умеющая сказать «сошлось всё», обязана сначала показать, что умеет
 * сказать «не сошлось». Флаг портит В ПАМЯТИ снимок прода — переименовывает
 * один рассказ, сдвигает платность у другого и вычёркивает третий, — и
 * прогон обязан отчитаться ровно о трёх расхождениях и ОТКАЗАТЬСЯ писать.
 *
 * ОГРАНИЧЕНИЕ ЛОКАЛЬНОГО ФАЙЛА (долг 60): пока поднят `next dev` или
 * `next start` на том же `dev.db`, писать в него вторым процессом нельзя —
 * libSQL не откатывает транзакцию после отказа по блокировке, и все
 * последующие записи молча теряются. Остановите сервер перед `--apply`.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";

const APPLY = process.argv.includes("--apply");
const PLANT = process.argv.includes("--plant");

type StoryRow = Awaited<ReturnType<PrismaClient["story"]["findMany"]>>[number];

/** Расхождение, найденное сверкой. Печатается поимённо, а не числом. */
type Divergence = { kind: string; detail: string };

/**
 * Сверка снимка прода с локальной копией. Отдельная функция ровно затем,
 * чтобы `--plant` мог прогнать её по испорченному снимку и доказать, что
 * она не слепая.
 */
function compareStories(prod: StoryRow[], local: StoryRow[]): Divergence[] {
  const out: Divergence[] = [];
  const byTitleProd = new Map<string, StoryRow[]>();
  for (const s of prod) {
    const list = byTitleProd.get(s.title) ?? [];
    list.push(s);
    byTitleProd.set(s.title, list);
  }
  for (const [title, list] of byTitleProd) {
    if (list.length > 1) out.push({ kind: "дубль заголовка на проде", detail: `${title} × ${list.length}` });
  }
  const byTitleLocal = new Map<string, StoryRow>();
  for (const s of local) {
    if (byTitleLocal.has(s.title)) out.push({ kind: "дубль заголовка локально", detail: s.title });
    byTitleLocal.set(s.title, s);
  }
  for (const s of prod) {
    if (!byTitleLocal.has(s.title)) out.push({ kind: "нет локально", detail: s.title });
  }
  for (const s of local) {
    if (!byTitleProd.has(s.title)) out.push({ kind: "нет на проде", detail: s.title });
  }
  for (const p of prod) {
    const l = byTitleLocal.get(p.title);
    if (!l) continue;
    if (p.id !== l.id) out.push({ kind: "разный id", detail: `${p.title}: прод ${p.id} ≠ лок ${l.id}` });
    if (p.level !== l.level) out.push({ kind: "разный уровень", detail: `${p.title}: ${p.level} ≠ ${l.level}` });
    if (p.isPremium !== l.isPremium || p.premiumOnly !== l.premiumOnly) {
      out.push({
        kind: "разная платность",
        detail: `${p.title}: прод isPremium=${p.isPremium}/premiumOnly=${p.premiumOnly}, лок ${l.isPremium}/${l.premiumOnly}`,
      });
    }
    if (p.text.length !== l.text.length) out.push({ kind: "разная длина текста", detail: `${p.title}: ${p.text.length} ≠ ${l.text.length}` });
    // `topic` намеренно НЕ сводится — см. TOPIC_NOTE ниже: на проде колонка
    // nullable и пуста во всех строках, локально она NOT NULL DEFAULT 'other'.
    // Расхождение названо отдельным числом, а не спрятано в общем счёте.
    if ((p.audioUrl ?? "") !== (l.audioUrl ?? "")) out.push({ kind: "разный audioUrl", detail: p.title });
    if ((p.fullAudioUrl ?? "") !== (l.fullAudioUrl ?? "")) out.push({ kind: "разный fullAudioUrl", detail: p.title });
  }
  return out;
}

/** Портит снимок прода В ПАМЯТИ — три заведомых расхождения. */
function plantDivergences(prod: StoryRow[]): StoryRow[] {
  const copy = prod.map((s) => ({ ...s }));
  copy[0].title = `${copy[0].title} (ПОДСАДКА)`;
  copy[1].isPremium = !copy[1].isPremium;
  copy.splice(2, 1);
  return copy;
}

async function main() {
  const prodUrl = process.env.TURSO_DATABASE_URL;
  if (!prodUrl) {
    console.error(
      "\nНЕТ КЛЮЧА: не задан TURSO_DATABASE_URL. Пересевать нечем — эталон живёт на проде.\n" +
        "  Команда не «пропускается»: без ключа у неё нет источника.",
    );
    process.exitCode = 1;
    return;
  }
  const localUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  if (localUrl.startsWith("libsql://") || localUrl.startsWith("https://")) {
    console.error(`\nОТКАЗ: DATABASE_URL указывает на удалённую базу (${localUrl.split("?")[0]}). Пишем только в локальный файл.`);
    process.exitCode = 1;
    return;
  }

  const prod = new PrismaClient({
    adapter: new PrismaLibSql({ url: prodUrl, authToken: process.env.TURSO_AUTH_TOKEN }),
  });
  const local = new PrismaClient({ adapter: new PrismaLibSql({ url: localUrl }) });

  try {
    // --- Прод, только чтение ---------------------------------------
    let prodStories = await prod.story.findMany();
    const prodExams = await prod.exam.findMany();
    console.log(`Прод (только чтение): Story ${prodStories.length}, Exam ${prodExams.length}.`);

    const localStories = await local.story.findMany();
    const localExams = await local.exam.findMany();
    console.log(`Локально: Story ${localStories.length}, Exam ${localExams.length}.`);

    if (PLANT) {
      prodStories = plantDivergences(prodStories);
      console.log("\n--plant: снимок прода испорчен в памяти тремя способами (переименование, платность, вычеркнутая строка).");
    }

    // --- Сверка -----------------------------------------------------
    const diffs = compareStories(prodStories, localStories);
    console.log(`\nРАСХОЖДЕНИЙ ПО РАССКАЗАМ: ${diffs.length}`);
    const byKind = new Map<string, number>();
    for (const d of diffs) byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + 1);
    for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) console.log(`  ${kind}: ${n}`);
    for (const d of diffs.filter((x) => x.kind !== "разный id").slice(0, 40)) console.log(`    ${d.kind} — ${d.detail}`);

    if (PLANT) {
      const planted = diffs.filter((d) => d.kind !== "разный id").length;
      console.log(
        `\nКОНТРОЛЬ: подсаженных расхождений найдено ${planted} (ожидается не меньше 3), писать отказываюсь.`,
      );
      process.exitCode = planted >= 3 ? 0 : 1;
      return;
    }

    // Сопоставление по заголовку обязано быть взаимно однозначным —
    // иначе перенос ссылок не определён, и писать нельзя.
    const blocking = diffs.filter(
      (d) => d.kind.startsWith("дубль") || d.kind === "нет локально" || d.kind === "нет на проде",
    );
    if (blocking.length > 0) {
      console.error(
        `\nОТКАЗ: сопоставление по заголовку не взаимно однозначно (${blocking.length} случаев). ` +
          "Перенос ссылок на id не определён — разбирать поимённо, а не писать.",
      );
      process.exitCode = 1;
      return;
    }

    const localByTitle = new Map(localStories.map((s) => [s.title, s]));
    const remap = new Map<string, string>(); // локальный id -> продовый id
    for (const p of prodStories) {
      const l = localByTitle.get(p.title)!;
      if (l.id !== p.id) remap.set(l.id, p.id);
    }
    console.log(`\nid к переносу: ${remap.size} из ${prodStories.length} (совпадают уже ${prodStories.length - remap.size}).`);

    const localIds = new Set(localStories.map((s) => s.id));
    const audio = await local.audioAsset.findMany({ where: { contentType: "story" }, select: { id: true, contentId: true } });
    const reading = await local.storyReadingProgress.findMany({ select: { id: true, storyId: true } });
    const grammar = await local.grammarCheckResult.findMany({ where: { entityType: "Story" }, select: { id: true, entityId: true } });
    const audioToMove = audio.filter((a) => remap.has(a.contentId));
    const readingToMove = reading.filter((r) => remap.has(r.storyId));
    const grammarToMove = grammar.filter((g) => remap.has(g.entityId));
    const audioOrphan = audio.filter((a) => !localIds.has(a.contentId));
    console.log(
      `Ссылки на id рассказа: AudioAsset ${audioToMove.length} из ${audio.length}, ` +
        `StoryReadingProgress ${readingToMove.length} из ${reading.length}, ` +
        `GrammarCheckResult ${grammarToMove.length} из ${grammar.length}. ` +
        `Озвучки, чей рассказ и сейчас не найден локально: ${audioOrphan.length}.`,
    );

    // Глоссарий: сопоставление по `slug`, а не по `id` — см. комментарий
    // у записи ниже. Считается ДО ветки `--apply`, чтобы сухой прогон
    // называл те же числа, которыми потом отчитается запись.
    const prodGlossary = await prod.glossaryTerm.findMany();
    const localGlossary = await local.glossaryTerm.findMany({ select: { id: true, slug: true } });
    const localGlossBySlug = new Map(localGlossary.map((t) => [t.slug, t]));
    const glossaryBijective =
      prodGlossary.length === localGlossary.length &&
      localGlossBySlug.size === localGlossary.length &&
      new Set(prodGlossary.map((t) => t.slug)).size === prodGlossary.length &&
      prodGlossary.every((t) => localGlossBySlug.has(t.slug));
    const glossaryRemap = new Map<string, string>();
    if (glossaryBijective) {
      for (const p of prodGlossary) {
        const l = localGlossBySlug.get(p.slug)!;
        if (l.id !== p.id) glossaryRemap.set(l.id, p.id);
      }
    }
    console.log(
      `Глоссарий: прод ${prodGlossary.length}, лок ${localGlossary.length}; ` +
        `сопоставление по slug ${glossaryBijective ? "взаимно однозначно" : "НЕ взаимно однозначно — трогать нельзя"}; ` +
        `id к переносу ${glossaryRemap.size}.`,
    );

    const examsToWrite = prodExams.length;
    console.log(`Экзамены к записи: ${examsToWrite} (таблица Exam — переопределение админки; 12 экзаменов сайт берёт из src/lib/exams/content.json).`);

    if (!APPLY) {
      console.log(
        "\n--dry-run (по умолчанию): в локальную базу ничего не записано.\n" +
          "  Записать: npm run db:pull-content-from-prod -- --apply",
      );
      return;
    }

    // --- Запись, только в локальный файл ----------------------------
    // Порядок: сначала ссылки переезжают на будущие id, потом сами строки.
    // Обратный порядок оставил бы окно, в котором ссылка указывает в пустоту,
    // а прерванный прогон было бы не отличить от исправного.
    // Двухшаговый перенос через временный префикс: без него перенос
    // A -> B при живом B (10 совпавших id) нарушил бы @@unique.
    const TMP = "tmpseed:";
    for (const [from, to] of remap) {
      await local.audioAsset.updateMany({ where: { contentType: "story", contentId: from }, data: { contentId: TMP + to } });
      await local.storyReadingProgress.updateMany({ where: { storyId: from }, data: { storyId: TMP + to } });
      await local.grammarCheckResult.updateMany({ where: { entityType: "Story", entityId: from }, data: { entityId: TMP + to } });
    }
    for (const [, to] of remap) {
      await local.audioAsset.updateMany({ where: { contentType: "story", contentId: TMP + to }, data: { contentId: to } });
      await local.storyReadingProgress.updateMany({ where: { storyId: TMP + to }, data: { storyId: to } });
      await local.grammarCheckResult.updateMany({ where: { entityType: "Story", entityId: TMP + to }, data: { entityId: to } });
    }
    console.log("Ссылки перенесены.");

    // TOPIC_NOTE. `Story.topic` объявлен в схеме как `String @default("other")`,
    // то есть NOT NULL, и локальная таблица (её строит `prisma db push`)
    // именно такая. На ПРОДЕ та же колонка nullable и пуста во ВСЕХ строках:
    // её добавил `ensure-schema-sync.ts`, а он делает голый
    // `ALTER TABLE … ADD COLUMN` без NOT NULL и без DEFAULT (7.8). Записать
    // сюда NULL нельзя, не сломав локальную схему, поэтому единственное поле,
    // которое пересев НЕ сводит, — это `topic`, и его число печатается вслух.
    const nullTopics = prodStories.filter((s) => s.topic == null).length;
    await local.story.deleteMany({});
    for (const s of prodStories) {
      await local.story.create({ data: { ...s, topic: s.topic ?? "other" } });
    }
    console.log(
      `Рассказы записаны: ${await local.story.count()}. ` +
        `topic НЕ сведён у ${nullTopics} строк (на проде NULL, локально 'other') — колонка на проде nullable, в схеме NOT NULL.`,
    );

    await local.exam.deleteMany({});
    if (prodExams.length > 0) await local.exam.createMany({ data: prodExams });
    console.log(`Экзамены записаны: ${await local.exam.count()}.`);

    // --- Глоссарий: тот же класс расхождения, что у рассказов ---------
    // Найдено замером 08.09.2026: терминов по 119 с обеих сторон, все 119
    // `slug` совпадают, а `id` — только 45. Адреса страниц глоссария
    // строятся по `slug`, поэтому URL этим НЕ ломались; ломались джойны
    // озвучки — `AudioAsset(contentType = "glossary").contentId` держит
    // именно `id`, и 138 локальных клипов не находили своего термина.
    // Сопоставление по `slug` (он `@unique`), проверка взаимной
    // однозначности — как у рассказов.
    if (glossaryBijective) {
      for (const [from, to] of glossaryRemap) {
        await local.audioAsset.updateMany({ where: { contentType: "glossary", contentId: from }, data: { contentId: TMP + to } });
        await local.grammarCheckResult.updateMany({ where: { entityType: "GlossaryTerm", entityId: from }, data: { entityId: TMP + to } });
      }
      for (const [, to] of glossaryRemap) {
        await local.audioAsset.updateMany({ where: { contentType: "glossary", contentId: TMP + to }, data: { contentId: to } });
        await local.grammarCheckResult.updateMany({ where: { entityType: "GlossaryTerm", entityId: TMP + to }, data: { entityId: to } });
      }
      await local.glossaryTerm.deleteMany({});
      for (const t of prodGlossary) await local.glossaryTerm.create({ data: t });
      const gIds = new Set((await local.glossaryTerm.findMany({ select: { id: true } })).map((t) => t.id));
      const gAudio = await local.audioAsset.findMany({ where: { contentType: "glossary" }, select: { contentId: true } });
      console.log(
        `Термины записаны: ${gIds.size}, id перенесено ${glossaryRemap.size}. ` +
          `Озвучек глоссария, не нашедших термина: ${gAudio.filter((a) => !gIds.has(a.contentId)).length} из ${gAudio.length}.`,
      );
    } else {
      console.log("Глоссарий НЕ тронут: сопоставление по slug не взаимно однозначно.");
    }

    // --- Сверка ПОСЛЕ записи ---------------------------------------
    const after = await local.story.findMany();
    const afterDiffs = compareStories(prodStories, after);
    console.log(`\nПОСЛЕ ЗАПИСИ расхождений по рассказам: ${afterDiffs.length}`);
    for (const d of afterDiffs.slice(0, 20)) console.log(`  ${d.kind} — ${d.detail}`);
    const afterIds = new Set(after.map((s) => s.id));
    const audioAfter = await local.audioAsset.findMany({ where: { contentType: "story" }, select: { contentId: true } });
    const lost = audioAfter.filter((a) => !afterIds.has(a.contentId)).length;
    console.log(`Озвучек, не нашедших своего рассказа после записи: ${lost} из ${audioAfter.length}.`);
    if (afterDiffs.length > 0 || lost > 0) process.exitCode = 1;
  } finally {
    await prod.$disconnect();
    await local.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
