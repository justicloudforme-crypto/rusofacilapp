"""
Sincroniza las bases de datos de vocabulary_bot y testing_bot con el
programa real del sitio (src/lib/lessons/content.json).

  - vocabulary_bot/data/vocabulary.json <- todas las palabras únicas del
    vocabulario de las 120 lecciones (A1-B2), con 3 distractores aleatorios
    tomados de otras traducciones reales del curso.
  - testing_bot/data/questions.json <- 5 ejercicios multiple-choice reales
    por nivel (A1, A2, B1, B2), en orden de dificultad creciente.

history_bot NO se toca: su banco de preguntas (historia y cultura rusa) es
contenido propio del bot, no forma parte del programa de lecciones del
sitio.

Uso (cada vez que se agreguen o cambien lecciones en content.json):
    cd bots
    source .venv/bin/activate
    python scripts/sync_from_curriculum.py

Después de correrlo, reinicia testing_bot y vocabulary_bot para que
carguen los datos actualizados.
"""

import json
import random
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONTENT_FILE = PROJECT_ROOT / "src" / "lib" / "lessons" / "content.json"
BOTS_DIR = PROJECT_ROOT / "bots"

PER_LEVEL_TEST_QUESTIONS = 5
LEVELS = ["a1", "a2", "b1", "b2"]

random.seed(42)  # salida reproducible entre corridas, mientras content.json no cambie


def build_vocabulary_bank(content: dict) -> list[dict]:
    seen_words: dict[str, dict] = {}
    for lesson in content.values():
        for item in lesson.get("vocabulary", []):
            word = item["word"].strip()
            seen_words.setdefault(word, item)

    all_translations = list({item["translation"] for item in seen_words.values()})

    questions = []
    for word, item in seen_words.items():
        correct_translation = item["translation"]
        pool = [t for t in all_translations if t != correct_translation]
        distractors = random.sample(pool, 3)
        options = [correct_translation] + distractors
        random.shuffle(options)

        questions.append(
            {
                "question": f"¿Cómo se traduce la palabra rusa '{word}'?",
                "options": options,
                "correct_option_id": options.index(correct_translation),
                "explanation": f"Se pronuncia: {item['transcription']}.",
            }
        )
    return questions


def build_test_bank(content: dict) -> list[dict]:
    by_level: dict[str, list[dict]] = {level: [] for level in LEVELS}
    for key, lesson in content.items():
        level = key.split("-")[0]
        if level not in by_level:
            continue
        for ex in lesson.get("exercises", []):
            if ex.get("type") == "multiple-choice":
                by_level[level].append(ex)

    questions = []
    for level in LEVELS:
        available = by_level[level]
        chosen = random.sample(available, min(PER_LEVEL_TEST_QUESTIONS, len(available)))
        for ex in chosen:
            questions.append(
                {
                    "question": ex["prompt"],
                    "options": ex["options"],
                    "correct_option_id": ex["correctIndex"],
                }
            )
    return questions


def validate(questions: list[dict], label: str) -> None:
    texts = [q["question"] for q in questions]
    assert len(texts) == len(set(texts)), f"{label}: preguntas duplicadas"
    for q in questions:
        assert 0 <= q["correct_option_id"] < len(q["options"]), f"{label}: {q['question']}"
        assert len(q["options"]) == len(set(q["options"])), f"{label}: opciones duplicadas en {q['question']}"


def write_json(path: Path, data: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    content = json.loads(CONTENT_FILE.read_text(encoding="utf-8"))

    vocabulary = build_vocabulary_bank(content)
    validate(vocabulary, "vocabulary_bot")
    write_json(BOTS_DIR / "vocabulary_bot" / "data" / "vocabulary.json", vocabulary)
    print(f"vocabulary_bot: {len(vocabulary)} palabras sincronizadas desde el programa real.")

    test_questions = build_test_bank(content)
    validate(test_questions, "testing_bot")
    write_json(BOTS_DIR / "testing_bot" / "data" / "questions.json", test_questions)
    print(f"testing_bot: {len(test_questions)} preguntas sincronizadas ({PER_LEVEL_TEST_QUESTIONS} por nivel A1-B2).")

    print("\nListo. Reinicia testing_bot y vocabulary_bot para aplicar los cambios.")


if __name__ == "__main__":
    main()
