/**
 * ОКНО ОЦЕНКИ И «COMPARTIR» — ПРАВИЛА, КОТОРЫЕ НЕЛЬЗЯ НАРУШИТЬ МОЛЧА (7.266).
 *
 * Окно оценки Google Play: правила Google запрещают просить «5 звёзд»,
 * ставить свой вопрос «¿Te gusta la app?» перед окном и пускать к оценке
 * только довольных (review gating), давать награду за отзыв и вешать
 * вызов на кнопку. Нарушение не видно ни в одном тесте экрана — только
 * в отказе Play. Поэтому правила здесь:
 *
 *   R1 текстов-просьб об оценке нет нигде в словарях и копиях;
 *   R2 вызов плагина `RfReview.request` ровно один — внутри
 *      `maybeAskForReview` и после `shouldAskForReview`;
 *   R3 `maybeAskForReview` зовут только места успеха: закрытие
 *      поздравления урока и конец звука рассказа (не ошибка, не покупка,
 *      не кнопка);
 *   R4 поведение порогов: не в первую сессию, не чаще раза в 30 дней,
 *      не сутки после покупки, не без сети, не меньше 3 успехов;
 *   R5 только в приложении: обе функции начинаются с проверки плагина;
 *   R6 «Compartir»: ссылки ровно те, что заданы владельцем, в текстах нет
 *      названий платёжных систем и цен (долг 196), модуль ничего не шлёт
 *      (никакого нового сбора данных);
 *   R7 текст сообщения говорит правду: первый урок каждого уровня бесплатный
 *      (`isFreeTrialLesson` → урок "1").
 *
 *   npx tsx scripts/check-review-share.ts           # 0 нарушений или выход 1
 *   npx tsx scripts/check-review-share.ts --plant   # подсадка на каждое правило
 */
import { readFileSync } from "node:fs";
import { isEntryPoint } from "@/lib/entry-point";
import { shouldAskForReview, type ReviewState } from "@/lib/app-review";
import { isFreeTrialLesson } from "@/lib/courses";
import { PLAY_SHARE_URL } from "@/lib/share-app";

const FILES = {
  review: "src/lib/app-review.ts",
  share: "src/lib/share-app.ts",
  button: "src/components/share/ShareAppButton.tsx",
  lesson: "src/components/lesson/ExercisesTab.tsx",
  story: "src/components/stories/StoryText.tsx",
  es: "src/dictionaries/es.json",
  ru: "src/dictionaries/ru.json",
  copy: "src/lib/native-access-copy.ts",
} as const;

type Snapshot = Record<keyof typeof FILES, string>;
type Ask = typeof shouldAskForReview;

const PLAY = "https://play.google.com/store/apps/details?id=com.rusofacilapp.app&referrer=utm_source%3Dshare";
const SITE = "https://rusofacilapp.com/es?utm_source=share";

const BEGGING =
  /5 estrellas|cinco estrellas|5 зв[её]зд|пять зв[её]зд|¿te gusta (la|nuestra) app|нравится (ли )?(вам )?приложение|rese[ñn]a positiva|buena rese[ñn]a|valóranos|calif[ií]canos|оцените нас|хороший отзыв/i;
const PAYMENT_WORDS = /Google Play|Play Store|Stripe|OXXO|PayPal|Mercado ?Pago|RevenueCat|tarjeta|precio|MXN|pesos|\$|рубл|карт[аоуы]|цен[аы]/i;

function read(): Snapshot {
  const out = {} as Snapshot;
  for (const [key, path] of Object.entries(FILES)) out[key as keyof Snapshot] = readFileSync(path, "utf8");
  return out;
}

/** Тело функции по заголовку — счётом фигурных скобок. */
function body(text: string, header: string): string | null {
  const at = text.indexOf(header);
  if (at === -1) return null;
  let i = text.indexOf("{", text.indexOf(")", at));
  if (i === -1) return null;
  const start = i;
  let depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function judgeBehaviour(ask: Ask): string[] {
  const H = 3_600_000;
  const D = 24 * H;
  const now = Date.UTC(2026, 9, 14, 12);
  const ready: ReviewState = { firstSuccessAt: now - 2 * D, successes: 3, lastAskedAt: null };
  const cases: Array<[string, Parameters<Ask>[0], boolean]> = [
    ["третий успех на второй день — просим", { state: ready, now, lastPurchaseAt: null, online: true }, true],
    ["первая сессия", { state: { ...ready, firstSuccessAt: now - H, successes: 9 }, now, lastPurchaseAt: null, online: true }, false],
    ["два успеха", { state: { ...ready, successes: 2 }, now, lastPurchaseAt: null, online: true }, false],
    ["просили 29 дней назад", { state: { ...ready, lastAskedAt: now - 29 * D }, now, lastPurchaseAt: null, online: true }, false],
    ["покупка 2 часа назад", { state: ready, now, lastPurchaseAt: now - 2 * H, online: true }, false],
    ["без сети", { state: ready, now, lastPurchaseAt: null, online: false }, false],
  ];
  const problems: string[] = [];
  for (const [name, input, want] of cases) {
    if (ask(input) !== want) problems.push(`R4 ${name}: ${!want ? "просим, а нельзя" : "не просим, а пора"}`);
  }
  if (cases.length === 0) problems.push("R4 случаев 0 — выборка пуста");
  return problems;
}

export function judge(s: Snapshot, ask: Ask = shouldAskForReview): string[] {
  const problems: string[] = [];

  // R1
  for (const key of ["es", "ru", "copy", "review", "button", "lesson", "story"] as const) {
    // В коде судится текст без комментариев: запрет, процитированный в
    // комментарии, — не просьба на экране.
    const text = key === "es" || key === "ru" ? s[key] : s[key].replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const hit = BEGGING.exec(text);
    if (hit) problems.push(`R1 ${FILES[key]}: просьба об оценке «${hit[0]}»`);
  }

  // R2
  const calls = s.review.match(/RfReview\.request\(/g)?.length ?? 0;
  const maybe = body(s.review, "export async function maybeAskForReview(");
  if (calls !== 1 || !maybe || !/RfReview\.request\(/.test(maybe)) {
    problems.push(`R2 ${FILES.review}: вызов окна не один (${calls}) или вне maybeAskForReview`);
  } else if (maybe.indexOf("shouldAskForReview(") === -1 || maybe.indexOf("shouldAskForReview(") > maybe.indexOf("RfReview.request(")) {
    problems.push(`R2 ${FILES.review}: окно зовётся без проверки shouldAskForReview`);
  }

  // R3
  const lessonCalls = s.lesson.match(/maybeAskForReview\(/g)?.length ?? 0;
  const close = body(s.lesson, "function closeCelebration(");
  if (lessonCalls !== 1 || !close || !/maybeAskForReview\(/.test(close)) {
    problems.push(`R3 ${FILES.lesson}: окно оценки зовётся не только из закрытия поздравления`);
  }
  if (/<EncouragementModal(?:(?!\/>)[\s\S])*maybeAskForReview/.test(s.lesson)) problems.push(`R3 ${FILES.lesson}: окно после провала`);
  const onerror = body(s.story, "audio.onerror = (");
  if (onerror && /maybeAskForReview/.test(onerror)) problems.push(`R3 ${FILES.story}: окно оценки после ошибки звука`);
  const storyCalls = s.story.match(/maybeAskForReview\(/g)?.length ?? 0;
  if (storyCalls !== 2) problems.push(`R3 ${FILES.story}: ждали 2 вызова (конец звука), есть ${storyCalls}`);
  if (/maybeAskForReview|RfReview/.test(s.button) || /onClick=\{[^}]*maybeAskForReview/.test(s.lesson + s.story)) {
    problems.push("R3 окно оценки повешено на кнопку");
  }

  // R4
  problems.push(...judgeBehaviour(ask));

  // R5
  for (const name of ["export async function maybeAskForReview(", "export function recordAppSuccess("]) {
    const b = body(s.review, name);
    if (!b || !/^\{\s*if \(!reviewPluginAvailable\(\)\) return/.test(b)) {
      problems.push(`R5 ${FILES.review}: ${name.replace(/^export (async )?function /, "")} не начинается с проверки плагина — сработает в браузере`);
    }
  }

  // R6
  if (!s.share.includes("`${PLAY_STORE_URL}&referrer=utm_source%3Dshare`") || PLAY_SHARE_URL !== PLAY) problems.push(`R6 ${FILES.share}: ссылка Play не та, что задана`);
  if (!s.share.includes(`"${SITE}"`)) problems.push(`R6 ${FILES.share}: ссылка сайта не та, что задана`);
  if (/fetch\(|sendBeacon|Sentry|gtag|analytics|posthog/i.test(s.share + s.button)) {
    problems.push("R6 «Compartir» что-то отправляет — это новый сбор данных");
  }
  for (const lang of ["es", "ru"] as const) {
    const share = (JSON.parse(s[lang]) as { share?: Record<string, string> }).share;
    if (!share) {
      problems.push(`R6 ${FILES[lang]}: раздела share нет`);
      continue;
    }
    for (const [k, v] of Object.entries(share)) {
      const hit = PAYMENT_WORDS.exec(v);
      if (hit) problems.push(`R6 ${FILES[lang]} share.${k}: «${hit[0]}» — в тексте «поделиться» платёжных слов быть не должно`);
    }
    // R7
    const message = share.message ?? "";
    const free = lang === "es" ? /primera lección de cada nivel es gratis/i : /первый урок каждого уровня бесплатн/i;
    if (!free.test(message)) problems.push(`R7 ${FILES[lang]} share.message: нет «первый урок каждого уровня бесплатный»`);
  }
  if (!isFreeTrialLesson("A1", "1") || isFreeTrialLesson("A1", "2")) {
    problems.push("R7 правило бесплатного урока изменилось — текст «первый урок каждого уровня» больше не правда");
  }
  return problems;
}

function main(): number {
  const snapshot = read();
  if (!process.argv.includes("--plant")) {
    const problems = judge(snapshot);
    if (problems.length) {
      console.error(`check:review-share — НАРУШЕНИЙ ${problems.length}:`);
      for (const p of problems) console.error(`  ${p}`);
      return 1;
    }
    console.log(
      "check:review-share — 7 правил, 0 нарушений: окно оценки без своего вопроса и без просьб о звёздах, " +
        "один вызов после проверки порогов, только после успеха и только в приложении; «Compartir» — ссылки владельца, без платёжных слов и без отправки данных.",
    );
    return 0;
  }

  let ok = judge(snapshot).length === 0;
  console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — текущие исходники`);
  const plant = (key: keyof Snapshot, from: string | RegExp, to: string): Snapshot => {
    const next = { ...snapshot, [key]: snapshot[key].replace(from, to) };
    if (next[key] === snapshot[key]) throw new Error(`подсадка не приложилась: ${FILES[key]} ${String(from)}`);
    return next;
  };
  const plants: Array<[string, Snapshot, Ask?]> = [
    ["R1 свой вопрос перед окном", plant("es", '"heading": "Comparte RusoFácil"', '"heading": "¿Te gusta la app? Danos 5 estrellas"')],
    ["R2 окно без проверки порогов", plant("review", "if (!shouldAskForReview({ state, now, lastPurchaseAt, online })) return false;", "")],
    ["R3 окно после провала урока", plant("lesson", "onClose={() => setJustFailed(false)}", "onClose={() => { setJustFailed(false); void maybeAskForReview(); }}")],
    ["R3 окно после ошибки звука", plant("story", "audio.onerror = () => {", "audio.onerror = () => {\n      void maybeAskForReview();")],
    ["R4 нет 30 дней", snapshot, (i) => shouldAskForReview({ ...i, state: { ...i.state, lastAskedAt: null } })],
    ["R4 просим и после покупки", snapshot, (i) => shouldAskForReview({ ...i, lastPurchaseAt: null })],
    ["R5 считает и в браузере", plant("review", /export function recordAppSuccess\(now: number = Date.now\(\)\): void \{\n  if \(!reviewPluginAvailable\(\)\) return;/, "export function recordAppSuccess(now: number = Date.now()): void {")],
    ["R6 «Google Play» в тексте", plant("ru", "Первый урок каждого уровня бесплатный.", "Первый урок каждого уровня бесплатный. Скачайте в Google Play.")],
    ["R6 ссылка без метки", plant("share", "&referrer=utm_source%3Dshare", "")],
    ["R6 кнопка шлёт событие", plant("button", "setOutcome(result);", 'setOutcome(result);\n    void fetch("/api/track", { method: "POST" });')],
    ["R7 обещание бесплатного урока пропало", plant("es", "La primera lección de cada nivel es gratis.", "Pruébala.")],
  ];
  for (const [name, snap, ask] of plants) {
    const found = judge(snap, ask);
    if (found.length === 0) ok = false;
    console.log(`  ${found.length ? "поймано" : "ПРОПУЩЕНО"} — ${name}${found.length ? ` (${found[0]})` : ""}`);
  }
  console.log(ok ? `check:review-share --plant — ${plants.length} из ${plants.length} подсадок, 1 из 1 отрицательного контроля` : "check:review-share --plant — FAILED");
  return ok ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) process.exit(main());
