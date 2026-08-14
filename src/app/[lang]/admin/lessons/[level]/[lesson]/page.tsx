import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isLevelSlug, isLessonSlug } from "@/lib/courses";
import { db } from "@/lib/db";
import { staticContentFor } from "@/lib/lessons/content";
import LessonEditor from "@/components/admin/LessonEditor";

const GENERIC_TEMPLATE = {
  // Opcional: enlace de YouTube o a un archivo de video directo, se muestra
  // arriba de la lección. Déjalo fuera del objeto (o vacío) para no mostrar nada.
  videoUrl: "",
  grammar: {
    title: "Título de la lección",
    paragraphs: ["Primer párrafo de la explicación gramatical, en español."],
    // Opcional: frases rusas de ejemplo, cada una con botón de audio 🔊.
    examples: [{ russian: "Пример.", translation: "Ejemplo." }],
  },
  // Opcional, solo para lecciones de alfabeto: lista de letras con
  // transcripción, tipo (vowel/consonant/sign) y explicación de pronunciación.
  // alphabet: [{ letter: "А а", name: "а", transcription: "a", type: "vowel", pronunciation: "..." }],
  // Opcional: bloque "Práctica de lectura" con palabras/frases y audio.
  readingPractice: {
    title: "Práctica de lectura",
    items: [{ text: "слово", translation: "palabra" }],
  },
  vocabulary: [{ word: "слово", transcription: "slóva", translation: "palabra" }],
  exercises: [
    {
      id: "cambia-este-id-mc-1",
      type: "multiple-choice",
      prompt: "Pregunta de ejemplo",
      options: ["opción A", "opción B", "opción C", "opción D"],
      correctIndex: 0,
    },
    {
      id: "cambia-este-id-fill-1",
      type: "fill-blank",
      before: "текс",
      after: "",
      answers: ["т"],
    },
    {
      id: "cambia-este-id-matching-1",
      type: "matching",
      pairs: [
        { left: "да", right: "sí" },
        { left: "нет", right: "no" },
      ],
    },
    {
      id: "cambia-este-id-reorder-1",
      type: "word-reorder",
      prompt: "Ordena las palabras",
      words: ["Это", "дом"],
      translation: "Это дом. — Esto es una casa.",
    },
    {
      id: "cambia-este-id-listen-1",
      type: "listening",
      audioText: "да",
      prompt: "Escucha y elige la palabra correcta.",
      options: ["да", "нет", "он", "она"],
      correctIndex: 0,
    },
    {
      id: "cambia-este-id-reading-1",
      type: "reading-comprehension",
      text: "Это дом.",
      questions: [
        {
          prompt: "¿Qué significa 'дом'?",
          options: ["gato", "casa", "agua", "escuela"],
          correctIndex: 1,
        },
      ],
    },
  ],
};

export default async function AdminLessonEditorPage({
  params,
}: PageProps<"/[lang]/admin/lessons/[level]/[lesson]">) {
  const { lang, level, lesson } = await params;
  if (!isLocale(lang) || !isLevelSlug(level) || !isLessonSlug(level, lesson)) notFound();

  const dict = await getDictionary(lang);
  const levelDict = dict.courses.levels[level];
  const index = Number(lesson) - 1;
  const title = levelDict.lessons[index] ?? `${level} · ${lesson}`;

  const customRow = await db.lesson.findUnique({
    where: { level_lessonSlug: { level, lessonSlug: lesson } },
  });
  const staticContent = staticContentFor(level, lesson);

  const initialValue = customRow
    ? JSON.stringify(JSON.parse(customRow.contentJson), null, 2)
    : staticContent
      ? JSON.stringify(staticContent, null, 2)
      : "";
  const templateValue = JSON.stringify(staticContent ?? GENERIC_TEMPLATE, null, 2);

  return (
    <LessonEditor
      lang={lang}
      level={level}
      lessonSlug={lesson}
      lessonTitle={title}
      hasCustomVersion={Boolean(customRow)}
      initialValue={initialValue}
      templateValue={templateValue}
      dict={dict.admin.lessons}
    />
  );
}
