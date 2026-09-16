/**
 * ИСПАНСКИЙ ТЕКСТ УСЛОВИЙ И ПОЛИТИКИ — ОРФОГРАФИЯ И ТИПОГРАФИКА
 * (заход 7.202, часть 4).
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Владелец прочитал `/es/terms` на телефоне 16.09.2026 и назвал четыре
 * места. Три из них в репозитории были, одно — нет:
 *
 *   * «vocabulario, idioms, ejercicios» — английское слово в испанском
 *     перечне (`modismos`);
 *   * «cámbiala contraseña de inmediato» — слипшееся «cambia la»;
 *   * прямые кавычки `'Términos'`, `'Servicio'`, `'nosotros'`,
 *     `'el operador'`, `'tal cual'` — в испанском тексте кавычки «…»;
 *   * «tu pais» — в репозитории **0 вхождений**: слово `país` встречается
 *     четыре раза и все четыре с ударением. Эта находка опровергнута
 *     числом, а не мнением.
 *
 * Полный прогон того же текста (13 322 знака, 80 строк) нашёл шестую
 * пару прямых кавычек, которую владелец не называл: `'matryoshka_calm'`
 * в разделе 2 Политики.
 *
 * ====================================================================
 * ЧТО ЭТОТ СТОРОЖ ЕСТЬ И ЧЕМ ОН НЕ ЯВЛЯЕТСЯ
 * ====================================================================
 *
 * Он НЕ проверка правописания. Словаря испанского в проекте нет, заводить
 * его ради двух документов дорого и нечестно: «0 ошибок» от прибора,
 * который знает тридцать слов, значит ровно «ни одного из этих тридцати».
 * Поэтому правила названы прямо:
 *
 *   1. ТИПОГРАФИКА — общая и полная: в испанском тексте обоих документов
 *      прямых кавычек (`'…'`, `"…"`) нет ни одной. Это правило ловит
 *      любую будущую пару, а не перечисленные пять.
 *   2. АНГЛИЙСКИЕ СЛОВА — по списку: слова, у которых есть испанское
 *      соответствие и которые уже попадали в этот текст или стоят рядом
 *      по смыслу. Имена собственные (Stripe, Premium, OXXO…) в список не
 *      входят и входить не должны.
 *   3. ПРОПУЩЕННЫЕ УДАРЕНИЯ И СЛИПШИЕСЯ СЛОВА — по списку известных форм.
 *      Это сторож регрессии: он держит то, что уже было найдено глазами, и
 *      честно не обещает найти новое.
 *
 * Русский текст этих документов не судится вовсе: решение владельца
 * 16.09.2026 — в этом заходе его не трогать.
 *
 * Запуск:
 *   npx tsx scripts/check-legal-es-text.ts
 *   npx tsx scripts/check-legal-es-text.ts --plant
 */
import { TERMS_CONTENT, PRIVACY_CONTENT, type LegalDocument } from "../src/lib/legal/content";

interface Line {
  where: string;
  text: string;
}

function linesOf(doc: LegalDocument, name: string): Line[] {
  const out: Line[] = [
    { where: `${name}.title`, text: doc.title },
    { where: `${name}.lastUpdatedLabel`, text: doc.lastUpdatedLabel },
    { where: `${name}.intro`, text: doc.intro },
  ];
  doc.sections.forEach((section, i) => {
    out.push({ where: `${name}.раздел ${i + 1}.заголовок`, text: section.heading });
    section.paragraphs.forEach((paragraph, j) => {
      out.push({
        where: `${name}.раздел ${i + 1}.абзац ${j + 1}`,
        text: typeof paragraph === "string" ? paragraph : paragraph.text,
      });
    });
  });
  return out;
}

export function spanishLines(): Line[] {
  return [
    ...linesOf(TERMS_CONTENT.es, "Условия /es"),
    ...linesOf(PRIVACY_CONTENT.es, "Политика /es"),
  ];
}

/** Слова, у которых есть испанское соответствие. Имён собственных здесь
 *  нет и быть не может: «Premium», «Stripe», «OXXO» — названия. */
const ENGLISH_WITH_SPANISH_TWIN: [RegExp, string][] = [
  [/\bidioms?\b/gi, "modismos"],
  [/\bterms\b/gi, "Términos"],
  [/\bprivacy\b/gi, "privacidad"],
  [/\bpassword\b/gi, "contraseña"],
  [/\baccount\b/gi, "cuenta"],
  [/\bsettings\b/gi, "ajustes"],
  [/\bstreak\b/gi, "racha"],
  [/\bvoucher\b/gi, "vale"],
  [/\brefunds?\b/gi, "reembolsos"],
  [/\bbilling\b/gi, "facturación"],
  [/\bcheckout\b/gi, "página de pago"],
  [/\bsubscriptions?\b/gi, "suscripción"],
  [/\blifetime\b/gi, "de por vida"],
];

/** Формы, найденные глазами, — и те, что стоят с ними в одном ряду. */
const MISSPELLED: [RegExp, string][] = [
  [/cámbiala\s+contraseña/g, "cambia la contraseña"],
  [/\bpais\b/g, "país"],
  [/\bdias?\b/g, "día / días"],
  [/\baqui\b/g, "aquí"],
  [/\basi\b/g, "así"],
  [/\bsegun\b/g, "según"],
  [/\btambien\b/g, "también"],
  [/\bningun\b/g, "ningún"],
  [/\balgun\b/g, "algún"],
  [/\bmexico\b/g, "México"],
  [/\belectronico\b/g, "electrónico"],
  [/\binformacion\b/g, "información"],
  [/\bsuscripcion\b/g, "suscripción"],
  [/\bcancelacion\b/g, "cancelación"],
  [/\beliminacion\b/g, "eliminación"],
  [/\bproteccion\b/g, "protección"],
  [/\bpagina\b/g, "página"],
  [/\bultima\b/g, "última"],
  [/\bnumero\b/g, "número"],
  [/\bmovil\b/g, "móvil"],
  [/\bautomatic[oa]\b/g, "automático / automática"],
  [/\btecnic[oa]s?\b/g, "técnico / técnica"],
  [/\ba\s+traves\b/g, "a través"],
];

export function judge(lines: Line[]): string[] {
  const problems: string[] = [];
  for (const { where, text } of lines) {
    // 1. Типографика — общее правило, а не список.
    const quoted = text.match(/'[^']*'|"[^"]*"/g);
    if (quoted) {
      problems.push(
        `${where}: прямые кавычки ${quoted.map((q) => `«${q}»`).join(", ")} — ` +
          `в испанском тексте кавычки «…»`,
      );
    }
    // 2. Английские слова.
    for (const [re, twin] of ENGLISH_WITH_SPANISH_TWIN) {
      const hits = text.match(re);
      if (hits) problems.push(`${where}: английское «${hits[0]}» вместо «${twin}»`);
    }
    // 3. Пропущенные ударения и слипшиеся слова.
    for (const [re, right] of MISSPELLED) {
      const hits = text.match(re);
      if (hits) problems.push(`${where}: «${hits[0]}» вместо «${right}»`);
    }
  }
  return problems;
}

function main(): number {
  const plant = process.argv.includes("--plant");
  const lines = spanishLines();

  if (plant) {
    let ok = judge(lines).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровый текст (отрицательный контроль)`);

    // Положительный контроль на НАСТОЯЩИХ строках: ровно те, что стояли в
    // `main` 4884a6e и которые владелец прочитал на телефоне. Не выдумка
    // сторожа — цитата.
    const real: [string, string][] = [
      [
        "настоящая строка Условий до правки (раздел 1, абзац 1)",
        "RusoFácilapp es una plataforma de aprendizaje del idioma ruso dirigida a hablantes de " +
          "español, con lecciones estructuradas (niveles A1 a B2), historias de lectura, vocabulario, " +
          "idioms, ejercicios de pronunciación y una biblioteca de video y audio.",
      ],
      [
        "настоящая строка Условий до правки (раздел 2, абзац 2)",
        "Debes proporcionar información veraz al registrarte. Si detectas un uso no autorizado de tu " +
          "cuenta, cámbiala contraseña de inmediato desde tu perfil o usa la opción de recuperación de " +
          "contraseña.",
      ],
      [
        "настоящая строка Условий до правки (вступление)",
        "Estos Términos de Servicio ('Términos') regulan el uso de RusoFácilapp.com y de la aplicación " +
          "asociada (el 'Servicio'), operado por Vasilii Petrov ('nosotros', 'el operador').",
      ],
      [
        "настоящая строка Политики до правки (раздел 2, абзац 1)",
        "Datos de cuenta: correo electrónico, nombre (opcional), un identificador de avatar (una cadena " +
          "de texto como 'matryoshka_calm' — nunca subes ni almacenamos ninguna foto tuya).",
      ],
      ["выдуманная строка с «tu pais» — форма, которой в репозитории 0", "El precio depende de tu pais."],
      ["английское слово вместо испанского", "Puedes cancelar tu subscription cuando quieras."],
      ["прямые двойные кавычки", 'El Servicio se ofrece "tal cual".'],
    ];

    let caught = 0;
    for (const [name, text] of real) {
      const found = judge([{ where: "подсадка", text }]);
      const hit = found.length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}${hit ? ` (${found[0]})` : ""}`);
    }

    // Контроль контроля: строка, которая ПРАВИЛЬНА и похожа на подсадку.
    // Без него «поймано 7 из 7» не отличается от «ловит всё подряд».
    const innocent = [
      "El Servicio se ofrece «tal cual».",
      "Estos Términos se rigen por las leyes de México, sin perjuicio de los derechos que la " +
        "legislación de protección al consumidor de tu país de residencia pueda otorgarte.",
      "Ofrecemos dos planes de suscripción —mensual y anual— y un plan Premium de pago único.",
    ];
    const falsePositives = judge(innocent.map((text, i) => ({ where: `здоровая строка ${i + 1}`, text })));
    console.log(
      `  ${falsePositives.length === 0 ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — ${innocent.length} правильные строки, ` +
        `похожие на подсадки (контроль контроля)`,
    );
    for (const p of falsePositives) console.log(`      · ${p}`);

    ok &&= caught === real.length && falsePositives.length === 0;
    console.log(
      ok
        ? `check:legal-es-text --plant — ${caught} из ${real.length} подсадок (из них 4 — настоящие строки ` +
            `до правки), 1 из 1 отрицательный контроль, ${innocent.length} из ${innocent.length} контроль контроля`
        : `check:legal-es-text --plant — FAILED (${caught} из ${real.length}, ложных ${falsePositives.length})`,
    );
    return ok ? 0 : 1;
  }

  const problems = judge(lines);
  if (problems.length) {
    console.error("ИСПАНСКИЙ ТЕКСТ УСЛОВИЙ И ПОЛИТИКИ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    `check:legal-es-text — ${lines.length} строк испанского текста Условий и Политики: прямых кавычек 0, ` +
      `английских слов с испанским соответствием 0, известных форм без ударения и слипшихся слов 0. ` +
      `Правила названы списком и спеллчекером не притворяются. Контроль — --plant.`,
  );
  return 0;
}

process.exitCode = main();
