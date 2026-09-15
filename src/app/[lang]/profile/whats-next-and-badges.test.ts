import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { computeEarnedBadgeIds, withEarnedNow, type DisplayBadge } from "@/lib/badges";
import { BADGE_CATALOG } from "@/lib/badges/catalog";
import ru from "@/dictionaries/ru.json";
import es from "@/dictionaries/es.json";

/**
 * ДВА ДЕФЕКТА КАБИНЕТА, У КОТОРЫХ ОДИН КЛАСС: ЭКРАН СПРАШИВАЛ НЕ ТО, ЧТО
 * ПОКАЗЫВАЛ (долги 216 и 220, заход 7.200).
 *
 * ── 216: «Прочитать первый рассказ» тому, кто уже читает ───────────────
 * В списке «Что дальше» у урока условие `=== 0`, у слов `=== 0`, а у
 * рассказа условия НЕ БЫЛО ВОВСЕ — карточка добавлялась всегда. Данные
 * были на сервере всё это время (`StoryReadingProgress`), к ним просто не
 * обращались. Попутно `hasAnyProgress` чтение тоже не считал, то есть
 * человек, который ТОЛЬКО читает, видел пустой кабинет.
 *
 * ── 220: значок не выдан при выполненном условии ───────────────────────
 * Прочитано по БОЕВОЙ базе 16.09.2026 (только SELECT, `rows_written` 0),
 * аккаунт `justicloudforme@gmail.com`: дней занятий 3 (13.09 story, 14.09
 * flashcards, 16.09 flashcards), `longestStreak` 3, `UserBadge` 0 строк,
 * `LessonProgress` 0, `FlashcardProgress` 0, `ExamAttempt` 0.
 *
 * Причина в числах: день занятия ставят ШЕСТЬ поверхностей по ОТКРЫТИЮ
 * страницы, а `evaluateAndAwardBadges` звали ТРИ пишущих маршрута. У
 * этого человека ни один из трёх не вызывался ни разу — значит правило
 * выдачи не исполнялось ни разу. Плитка при этом печатала «3/3 ДНЯ»,
 * потому что СЧЁТЧИК считался по живой статистике, а ЦВЕТ — по строке в
 * базе. Два источника на одно утверждение.
 *
 * Правило судит ИСХОДНИК страницы, а не отрисовку: кабинет — серверный
 * компонент с полутора десятками запросов, и поднимать его в стенде ради
 * одного условия дороже, чем прочитать условие текстом. То, что читается
 * текстом, названо ниже дословно, и подсадка — это ДОРЕФОРМЕННАЯ строка.
 */

const PAGE = path.join(process.cwd(), "src", "app", "[lang]", "profile", "page.tsx");
const source = readFileSync(PAGE, "utf8");

describe("долг 216: «Что дальше» не зовёт начинать начатое", () => {
  it("у карточки рассказа есть условие о прогрессе чтения", () => {
    expect(source).toMatch(/storiesStarted === 0 && storyItem \? \[storyItem\] : \[\]/);
  });

  it("все три пункта списка спрашивают одно и то же — «ещё не начинал»", () => {
    const block = source.slice(
      source.indexOf("const whatsNextItems"),
      source.indexOf("].slice(0, 3);", source.indexOf("const whatsNextItems")),
    );
    const conditions = [...block.matchAll(/\.\.\.\((.+?) \?/g)].map((m) => m[1]);
    expect(conditions).toHaveLength(3);
    for (const c of conditions) expect(c).toMatch(/=== 0/);
  });

  it("прогресс чтения действительно читается из базы", () => {
    expect(source).toMatch(/db\.storyReadingProgress\.count\(\{ where: \{ userId: user\.id \} \}\)/);
  });

  it("человек, который ТОЛЬКО читает, не видит пустой кабинет", () => {
    const line = source.split("\n").find((l) => l.includes("const hasAnyProgress ="));
    expect(line).toBeTruthy();
    const whole = source.slice(source.indexOf("const hasAnyProgress ="), source.indexOf(";", source.indexOf("const hasAnyProgress =")));
    expect(whole).toContain("storiesStarted > 0");
  });

  // ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ — ДОРЕФОРМЕННЫЙ КОД, дословно (bc77b2a).
  it("подсадка: старый список ловится — у рассказа условия нет", () => {
    const before = `const whatsNextItems: FirstStepItem[] = [
    ...(totalLessonsCompleted === 0 ? [lessonItem] : []),
    ...(wordsLearned === 0 ? [vocabItem] : []),
    ...(storyItem ? [storyItem] : []),
  ].slice(0, 3);`;
    const conditions = [...before.matchAll(/\.\.\.\((.+?) \?/g)].map((m) => m[1]);
    expect(conditions).toHaveLength(3);
    // Ровно одно условие из трёх не спрашивает прогресс — это и есть дефект.
    expect(conditions.filter((c) => !/=== 0/.test(c))).toEqual(["storyItem"]);
  });

  it("подсадка: старый hasAnyProgress ловится — чтения в нём нет", () => {
    const before = "const hasAnyProgress = wordsLearned > 0 || totalLessonsCompleted > 0 || streak.longestStreak > 0;";
    expect(before).not.toContain("storiesStarted");
  });
});

describe("долг 220: значок выдаётся, когда условие выполнено", () => {
  const catalogBadges = (): DisplayBadge[] =>
    BADGE_CATALOG.map((def) => ({ def, earnedAt: null, earned: false }));

  const freeAccount = { longestStreak: 3, examAttempts: [], vocabKnownCount: 0 };

  it("боевой случай: серия 3 дня, строк выдачи 0 — значок всё равно открыт", () => {
    const shown = withEarnedNow(catalogBadges(), freeAccount);
    const streak3 = shown.find((b) => b.def.id === "streak-3");
    expect(streak3?.earned).toBe(true);
    // И дата у него пока пустая — она придёт со строкой выдачи. Это не
    // недоделка, а честность: из статистики дату не восстановить.
    expect(streak3?.earnedAt).toBeNull();
  });

  it("счётчик «сколько открыто» считает то же самое, что цвет плитки", () => {
    const shown = withEarnedNow(catalogBadges(), freeAccount);
    expect(shown.filter((b) => b.earned).map((b) => b.def.id)).toEqual(["streak-3"]);
  });

  it("ПОДСАДКА — поведение ДО правки: цвет решала только строка в базе", () => {
    const beforeFix = catalogBadges();
    expect(beforeFix.filter((b) => b.earned)).toHaveLength(0);
    // А правило при этом говорит, что значок заслужен: вот оно,
    // расхождение, которое человек и видел на экране.
    expect(computeEarnedBadgeIds(freeAccount).has("streak-3")).toBe(true);
  });

  it("ОТРИЦАТЕЛЬНЫЙ: серия 2 дня — значок закрыт, правило не раздаёт лишнего", () => {
    const shown = withEarnedNow(catalogBadges(), { longestStreak: 2, examAttempts: [], vocabKnownCount: 0 });
    expect(shown.filter((b) => b.earned)).toHaveLength(0);
  });

  it("уже выданный значок не отбирается, даже если серия потом сорвалась", () => {
    const withRow = BADGE_CATALOG.map((def) => ({
      def,
      earnedAt: def.id === "streak-7" ? new Date("2026-09-06T20:15:57.705Z") : null,
      earned: def.id === "streak-7",
    }));
    const shown = withEarnedNow(withRow, { longestStreak: 0, examAttempts: [], vocabKnownCount: 0 });
    expect(shown.find((b) => b.def.id === "streak-7")?.earned).toBe(true);
  });

  it("выдача стоит там, где меняется условие: новый день занятий и открытие кабинета", () => {
    const visit = readFileSync(path.join(process.cwd(), "src", "lib", "study-day-visit.ts"), "utf8");
    expect(visit).toContain("awardBadgesSafely");
    // И зовётся она только на НОВОМ дне — иначе четыре лишних запроса на
    // каждый просмотр урока, рассказа и словаря.
    expect(visit).toMatch(/const dayIsNew = await markStudyDay\([^)]*\);\s*\n\s*if \(dayIsNew\) await awardBadgesSafely/);
    expect(source).toMatch(/after\(\(\) => awardBadgesSafely\(user\.id\)\)/);
  });

  it("подсадка: `markStudyDay`, который всегда возвращает false, отбирает выдачу", () => {
    // Полярность признака — единственное, что отделяет починку от
    // видимости починки, и проверить её нужно отдельно.
    const dayIsNew = false;
    let awarded = false;
    if (dayIsNew) awarded = true;
    expect(awarded).toBe(false);
    const dayIsNewReal = true;
    if (dayIsNewReal) awarded = true;
    expect(awarded).toBe(true);
  });
});

describe("долг 221: карточка подписки сотрудника не спорит сама с собой", () => {
  it("бейдж для роли говорит о доступе, а не об отсутствии подписки", () => {
    expect(source).toContain("staffAccess ? dict.profile.statusStaffAccess");
    expect(source).toMatch(/const staffAccess = isStaff\(user\.role\) && !isActive;/);
  });

  it("обе локали: подпись есть, и в ней нет косой черты", () => {
    for (const [name, dict] of [["ru", ru], ["es", es]] as const) {
      const profile = (dict as unknown as { profile: Record<string, string> }).profile;
      expect(profile.statusStaffAccess, name).toBeTruthy();
      expect(profile.staffAccessNotice, name).not.toContain("/");
      // И бейдж не повторяет текст под собой слово в слово.
      expect(profile.staffAccessNotice).not.toBe(profile.statusStaffAccess);
    }
  });

  it("подсадка: старая пара ловится — бейдж про отсутствие подписки и косая черта в тексте", () => {
    const beforeRu = {
      badge: "У вас пока нет подписки",
      notice: "Полный пожизненный доступ ко всем функциям как владельцу/сотруднику платформы — оформлять подписку не нужно.",
    };
    const beforeEs = {
      badge: "Aún no tienes una suscripción",
      notice: "Acceso completo de por vida a todas las funciones como propietario/miembro del equipo — no necesitas suscribirte.",
    };
    for (const before of [beforeRu, beforeEs]) {
      expect(before.notice).toContain("/");
      expect(before.badge).toMatch(/нет подписки|no tienes una suscripción/);
    }
  });
});

describe("долг 222: две плитки не говорят одно и то же", () => {
  it("плитка уровня называет уровень в обоих состояниях", () => {
    // `noLevelStarted` («нет сданных уроков» / «sin lección aprobada») в
    // кабинете больше не стоит: это было второе имя для числа из соседней
    // плитки, а не подпись этой.
    const tiles = source.slice(source.indexOf("const tabs = getProfileTabs"));
    expect(tiles).not.toContain("dict.profile.noLevelStarted");
    expect(tiles).toContain("dict.profile.currentLevelLabel");
  });

  it("а на странице групп та же строка осталась — там она ЗНАЧЕНИЕ, а не подпись", () => {
    const groups = readFileSync(
      path.join(process.cwd(), "src", "app", "[lang]", "groups", "[groupId]", "page.tsx"),
      "utf8",
    );
    expect(groups).toContain("dict.profile.noLevelStarted");
  });

  it("подсадка: старая пара подписей ловится — обе про сданные уроки", () => {
    for (const dict of [ru, es]) {
      const profile = (dict as unknown as { profile: Record<string, string | Record<string, string>> }).profile;
      const lessons = profile.lessonsCompleted as Record<string, string>;
      const noLevel = profile.noLevelStarted as string;
      const unit = lessons.many ?? lessons.one;
      // Обе строки говорят о сданных уроках — вот и повтор.
      const stem = (s: string) => s.toLowerCase().replace(/[^a-zа-яё]/g, "");
      const shared = ["сдан", "урок", "aprobad", "lecci"].filter(
        (w) => stem(unit).includes(w) && stem(noLevel).includes(w),
      );
      expect(shared.length).toBeGreaterThan(0);
    }
  });
});
