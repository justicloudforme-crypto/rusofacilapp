/**
 * «COGER» → «AGARRAR» В ОТВЕТАХ ВНЕШНЕГО ПЕРЕВОДЧИКА (решение владельца
 * 27.11.2026, вариант (б), заход 7.320).
 *
 * ПОЧЕМУ. Ученики — в Мексике, там «coger» — грубое слово (правило 3.16,
 * заход 7.317). Своё содержимое от него вычищено, но тап по слову, которого
 * нет в карточках, уроках и своём банке, берёт перевод у MyMemory, а тот на
 * «взяла / возьму / возьми / беру» отдаёт «cogió», «Lo cojo.», «Coge»
 * (находка 7.319 на живом сайте).
 *
 * ГДЕ СТОИТ. На ВЫХОДЕ, в двух местах — и оба нужны:
 *   1) `/api/dictionary/translate` — свежий ответ MyMemory до отдачи;
 *   2) карточка слова в `StoryText` — на показе, и для ответа сети, и для
 *      слова из памяти вкладки. Ответ адреса лежит на грани Vercel до 7 дней,
 *      в браузере сутки, в кеше воркера `apis` и в `sessionStorage` — всё, что
 *      туда легло ДО этого захода, проходит через фильтр на показе.
 * Сторож — `npm run check:no-coger` (раздел «фильтр переводчика», с подменой).
 *
 * ЧТО МЕНЯЕТ. Только ЦЕЛОЕ слово: форма «coger» (все времена, наклонения,
 * повелительное, причастие, деепричастие, voseo) — на ту же форму
 * «agarrar»; местоимения в конце сохраняются, ударение ставится по правилам
 * («cógelo» → «agárralo», «cogerlo» → «agarrarlo», «cogiéndolo» →
 * «agarrándolo»). Регистр — как у исходного слова («Coge» → «Agarra»,
 * «COGE» → «AGARRA»).
 *
 * ЧЕГО НЕ ТРОГАЕТ. recoger, escoger, encoger(se), acoger, sobrecoger — слово
 * начинается не с «co»; cojear/cojeó/cojera, cognitivo, cogote, cogollo —
 * не формы «coger» и в таблице их нет. Прилагательное «cojo/coja» («хромой»)
 * по написанию совпадает с формами глагола; различить его можно только по
 * исходному русскому слову — для «хром…» эти четыре написания не меняются.
 */

const CLITICS = ["los", "las", "les", "nos", "me", "te", "se", "lo", "la", "le", "os"] as const;

/** Пары «форма coger → форма agarrar». Порядок важен: при совпадении без
 *  ударений побеждает строка выше (обычное «coge» раньше voseo «cogé»). */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  // неличные формы
  ["coger", "agarrar"],
  ["cogiendo", "agarrando"],
  ["cogido", "agarrado"],
  ["cogida", "agarrada"],
  ["cogidos", "agarrados"],
  ["cogidas", "agarradas"],
  // настоящее изъявительного
  ["cojo", "agarro"],
  ["coges", "agarras"],
  ["coge", "agarra"],
  ["cogemos", "agarramos"],
  ["cogéis", "agarráis"],
  ["cogen", "agarran"],
  // простое прошедшее
  ["cogí", "agarré"],
  ["cogiste", "agarraste"],
  ["cogió", "agarró"],
  ["cogimos", "agarramos"],
  ["cogisteis", "agarrasteis"],
  ["cogieron", "agarraron"],
  // имперфект
  ["cogía", "agarraba"],
  ["cogías", "agarrabas"],
  ["cogíamos", "agarrábamos"],
  ["cogíais", "agarrabais"],
  ["cogían", "agarraban"],
  // будущее
  ["cogeré", "agarraré"],
  ["cogerás", "agarrarás"],
  ["cogerá", "agarrará"],
  ["cogeremos", "agarraremos"],
  ["cogeréis", "agarraréis"],
  ["cogerán", "agarrarán"],
  // условное
  ["cogería", "agarraría"],
  ["cogerías", "agarrarías"],
  ["cogeríamos", "agarraríamos"],
  ["cogeríais", "agarraríais"],
  ["cogerían", "agarrarían"],
  // настоящее сослагательного (и повелительное usted / ustedes / nosotros)
  ["coja", "agarre"],
  ["cojas", "agarres"],
  ["cojamos", "agarremos"],
  ["cojáis", "agarréis"],
  ["cojan", "agarren"],
  // имперфект сослагательного, оба ряда
  ["cogiera", "agarrara"],
  ["cogieras", "agarraras"],
  ["cogiéramos", "agarráramos"],
  ["cogierais", "agarrarais"],
  ["cogieran", "agarraran"],
  ["cogiese", "agarrase"],
  ["cogieses", "agarrases"],
  ["cogiésemos", "agarrásemos"],
  ["cogieseis", "agarraseis"],
  ["cogiesen", "agarrasen"],
  // будущее сослагательного (книжное)
  ["cogiere", "agarrare"],
  ["cogieres", "agarrares"],
  ["cogiéremos", "agarráremos"],
  ["cogiereis", "agarrareis"],
  ["cogieren", "agarraren"],
  // повелительное vosotros и voseo
  ["coged", "agarrad"],
  ["cogé", "agarrá"],
  ["cogés", "agarrás"],
];

/** Формы, к которым пишутся местоимения слитно. */
const CLITIC_HOSTS = new Set(["coger", "cogiendo", "coge", "cogé", "coged", "coja", "cojamos", "cojan"]);

/** Написания, совпадающие с прилагательным «хромой». */
const LAME_SPELLINGS = new Set(["cojo", "coja", "cojos", "cojas"]);

function stripAccents(s: string): string {
  return s.replace(/[áéíóú]/g, (c) => "aeiou"["áéíóú".indexOf(c)]);
}

const EXACT = new Map<string, string>(PAIRS);
const PLAIN = new Map<string, readonly [string, string]>();
for (const pair of PAIRS) {
  const key = stripAccents(pair[0]);
  if (!PLAIN.has(key)) PLAIN.set(key, pair);
}

/** Гласные-ядра слова: [начало, конец) каждого слога по гласным. */
function nuclei(word: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const isVowel = (c: string) => "aeiouáéíóúü".includes(c);
  const isStrong = (c: string) => "aeoáéóíú".includes(c);
  let i = 0;
  while (i < word.length) {
    if (!isVowel(word[i])) {
      i++;
      continue;
    }
    let j = i + 1;
    // Две гласные — один слог, если хотя бы одна из них слабая без ударения.
    while (j < word.length && isVowel(word[j]) && !(isStrong(word[j - 1]) && isStrong(word[j]))) j++;
    out.push([i, j]);
    i = j;
  }
  return out;
}

/** Номер ударного слога (с нуля) — по знаку ударения или по общему правилу. */
function stressedNucleus(word: string): number {
  const ns = nuclei(word);
  const marked = ns.findIndex(([a, b]) => /[áéíóú]/.test(word.slice(a, b)));
  if (marked >= 0) return marked;
  if (ns.length < 2) return 0;
  return /[aeiouns]$/.test(word) ? ns.length - 2 : ns.length - 1;
}

/** Поставить знак ударения на гласную слога (сильную, если их две). */
function markNucleus(word: string, [a, b]: [number, number]): string {
  const part = word.slice(a, b);
  if (/[áéíóú]/.test(part)) return word;
  let at = a;
  for (let k = a; k < b; k++) if ("aeo".includes(word[k])) at = k;
  const acute = "áéíóú"["aeiou".indexOf(word[at])];
  return acute ? word.slice(0, at) + acute + word.slice(at + 1) : word;
}

/** Основа agarrar + местоимения, с ударением по правилам. */
function attach(base: string, clitics: string[]): string {
  let host = base;
  // agarremos + nos/se → agarrémonos, agarrémoselo; agarrad + os → agarraos.
  if (host.endsWith("mos") && (clitics[0] === "nos" || clitics[0] === "se")) host = host.slice(0, -1);
  if (host.endsWith("d") && clitics[0] === "os") host = host.slice(0, -1);
  const stress = stressedNucleus(base);
  const joined = host + clitics.join("");
  const total = nuclei(joined).length;
  // Ударение ушло дальше второго слога от конца — пишется знак.
  if (total - stress >= 3) return markNucleus(joined, nuclei(joined)[stress]);
  return joined;
}

/** Разбить слово (без ударений) на «форма + 0..2 местоимения». */
function splitClitics(plain: string): { host: readonly [string, string]; clitics: string[] } | null {
  const tryHost = (rest: string, clitics: string[]) => {
    // cogeos: «d» перед os выпала (раньше общего случая — иначе «coge» + os).
    if (clitics[0] === "os" && rest === "coge") return { host: ["coged", "agarrad"] as const, clitics };
    const pair = PLAIN.get(rest);
    if (pair && CLITIC_HOSTS.has(pair[0])) return { host: pair, clitics };
    // cojámonos / cojámoselo: «s» перед nos/se выпала.
    if (clitics[0] === "nos" || clitics[0] === "se") {
      const withS = PLAIN.get(`${rest}s`);
      if (withS && withS[0] === "cojamos") return { host: withS, clitics };
    }
    return null;
  };
  for (const c1 of CLITICS) {
    if (!plain.endsWith(c1)) continue;
    const rest1 = plain.slice(0, -c1.length);
    const one = tryHost(rest1, [c1]);
    if (one) return one;
    for (const c0 of CLITICS) {
      if (!rest1.endsWith(c0)) continue;
      const two = tryHost(rest1.slice(0, -c0.length), [c0, c1]);
      if (two) return two;
    }
  }
  return null;
}

function matchCase(original: string, replacement: string): string {
  if (original.length > 1 && original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] !== original[0].toLowerCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

/** Замена одного слова; `null` — слово не форма «coger». */
export function agarrarFor(word: string, opts: { lame?: boolean } = {}): string | null {
  const lower = word.toLowerCase();
  if (!lower.startsWith("co") && !lower.startsWith("có")) return null;
  if (opts.lame && LAME_SPELLINGS.has(lower)) return null;
  const exact = EXACT.get(lower);
  if (exact) return matchCase(word, exact);
  const plain = stripAccents(lower);
  const pair = PLAIN.get(plain);
  if (pair) return matchCase(word, pair[1]);
  const split = splitClitics(plain);
  if (split) return matchCase(word, attach(split.host[1], split.clitics));
  return null;
}

/**
 * Текст перевода без «coger»: каждая форма — на ту же форму «agarrar».
 * `russian` — исходное слово тапа: для «хром…» не трогаются cojo/coja.
 */
export function replaceCoger(text: string, opts: { russian?: string } = {}): string {
  if (!text || !/c[oó][gj]/.test(text.toLowerCase())) return text;
  const lame = typeof opts.russian === "string" && /^(?:хром|охром)/i.test(opts.russian.trim());
  return text.replace(/\p{L}+/gu, (word) => agarrarFor(word, { lame }) ?? word);
}
