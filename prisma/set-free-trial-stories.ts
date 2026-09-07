/**
 * Sets which stories are free (Story.isPremium = false) vs. behind the
 * subscription paywall, for the freemium trial (see FREEMIUM.md).
 *
 * Before 2026-08-23, ~276 of the 325 stories were isPremium=false (an
 * older, much more generous free/premium split). That state is still sitting
 * in the DB even though src/proxy.ts stopped honoring it when the whole
 * /stories section got hard-gated behind a subscription. Now that the
 * section gate is gone in favor of Story.isPremium's own page-level check
 * (see src/app/[lang]/stories/[id]/page.tsx), leaving that old data as-is
 * would make ~276 stories free again — the opposite of "1-2 stories to
 * taste the product." This script narrows it down to a small, deliberate
 * free sample: everything the CURATED_FREE_STORIES set doesn't name gets
 * isPremium=true; the two curated titles get isPremium=false.
 *
 * Safe to re-run — idempotent, matches by (title, author) like
 * seed-stories.ts.
 *
 *   npm run db:set-free-trial-stories
 *   npm run db:set-free-trial-stories -- --dry-run
 *
 * `--dry-run` writes nothing and prints the exact rows a real run would
 * touch: every `Story.isPremium` flip by (id, title, author, level, старое
 * значение → новое), and — рядом с ними — сколько строк `AudioAsset`
 * висит на каждом из этих рассказов, потому что смысл этой правки не в
 * колонке, а в том, чью озвучку слышит человек без подписки. Ни одна
 * строка `AudioAsset` этим скриптом НЕ трогается ни в каком режиме: он
 * их только считает и печатает. Проверять раскатку надо обходом живого
 * прода, а не этим выводом — вывод говорит, что скрипт СОБИРАЕТСЯ
 * сделать, а не что увидел анонимный читатель.
 */
import "dotenv/config";
import { db } from "../src/lib/db";

// Two short, appealing, beginner-level (A1) folk tales — easy enough that
// a brand-new visitor can actually read the whole thing and feel the
// product working, not just see a locked wall of text.
//
// Почему здесь «Снегурочка», а не «Теремок» (замена 07.09.2026).
// Витрина — единственная озвучка, которую человек без подписки слышит
// вообще: обход всех 325 страниц прода анонимно даёт mp3 ровно у этих
// двух рассказов и ни у одного другого (323 из 325 отдают пейволл и ноль
// адресов). То есть по этим двум начитками судят обо всех 325.
// «Теремок» для этой роли — худший выбор из шестидесяти пяти A1: он
// многоголосый, голос меняется ШЕСТЬ раз на 28 клипах (включая абзац
// женскими голосами внутри мужской начитки), и он же единственный из
// двух несёт клипы, где характерным голосом читается авторская речь.
// «Снегурочка» — та же полка (русская народная сказка, A1, 795 знаков
// против 779 у «Репки», 12 клипов, склейка на месте), но голос ОДИН
// (`onyx`) на все 12 клипов и дефектных клипов ноль по каждому из трёх
// проверенных признаков.
//
// Ни одного файла эта замена не трогает: озвучка у «Снегурочки» уже
// сгенерирована и лежит в том же Blob-сторе, меняется только
// `Story.isPremium` — то есть КОМУ страница отдаёт уже существующие
// адреса. Перегенерации и перекодирования здесь нет и быть не может.
import { isEntryPoint } from "../src/lib/entry-point";
const CURATED_FREE_STORIES: { title: string; author: string }[] = [
  { title: "Репка", author: "Русская народная сказка" },
  { title: "Снегурочка", author: "Русская народная сказка" },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const freeSet = new Set(CURATED_FREE_STORIES.map((s) => `${s.title}::${s.author}`));

  const all = await db.story.findMany({
    select: { id: true, title: true, author: true, level: true, isPremium: true },
  });

  let madeFree = 0;
  let madePremium = 0;
  let missing = 0;

  for (const key of freeSet) {
    const [title, author] = key.split("::");
    if (!all.some((s) => s.title === title && s.author === author)) {
      console.warn(`⚠ Curated free story not found in DB: "${title}" by ${author}`);
      missing++;
    }
  }

  const planned: { story: (typeof all)[number]; to: boolean }[] = [];
  for (const story of all) {
    const shouldBeFree = freeSet.has(`${story.title}::${story.author}`);
    if (shouldBeFree && story.isPremium) {
      planned.push({ story, to: false });
      madeFree++;
    } else if (!shouldBeFree && !story.isPremium) {
      planned.push({ story, to: true });
      madePremium++;
    }
  }

  if (planned.length > 0) {
    // Сколько клипов висит на каждом задетом рассказе — одним запросом,
    // не по строке на рассказ.
    const audio = await db.audioAsset.groupBy({
      by: ["contentId"],
      where: { contentType: "story", contentId: { in: planned.map((p) => p.story.id) } },
      _count: { _all: true },
    });
    const clipsById = new Map(audio.map((a) => [a.contentId, a._count._all]));

    console.log(`${dryRun ? "DRY-RUN — записи не будет." : "Запись."} Строк Story.isPremium к правке: ${planned.length}`);
    for (const { story, to } of planned) {
      console.log(
        `  ${story.id}  «${story.title}» / ${story.author} (${story.level})  isPremium ${story.isPremium ? "true" : "false"} → ${to ? "true" : "false"}  ` +
          `[${to ? "звук уходит за пейволл" : "звук открывается"}: audioAssetRows=${clipsById.get(story.id) ?? 0}]`
      );
    }
  } else {
    console.log(`${dryRun ? "DRY-RUN — " : ""}правок нет: база уже совпадает с CURATED_FREE_STORIES.`);
  }

  if (dryRun) {
    console.log(
      `✔ DRY-RUN: было бы ${madeFree} открыто, ${madePremium} закрыто${missing ? `, ${missing} curated title(s) not found` : ""}. Ничего не записано.`
    );
    return;
  }

  for (const { story, to } of planned) {
    await db.story.update({ where: { id: story.id }, data: { isPremium: to } });
  }

  console.log(
    `✔ Free-trial stories set: ${madeFree} made free, ${madePremium} made premium${missing ? `, ${missing} curated title(s) not found` : ""}.`
  );
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
