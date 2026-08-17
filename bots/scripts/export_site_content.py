"""
RusoFásil — exportación única del contenido del sitio a bots/data/
======================================================================

Lee, en modo SOLO LECTURA, el contenido real del sitio y lo vuelca a JSON
dentro de bots/data/ para que los bots funcionen completamente offline,
sin depender de que `next dev` (ni ningún servidor) esté corriendo:

  - dev.db (SQLite, en la raíz del proyecto) -> tablas FlashcardCard,
    GlossaryTerm e Idiom, abiertas con el URI `file:...?mode=ro` (el modo
    read-only del propio SQLite: la conexión no puede escribir aunque el
    código lo intentara).
  - src/lib/lessons/content.json -> ejercicios multiple-choice reales de
    las 120 lecciones (A1-B2), con el nivel derivado del prefijo de la
    lección (p. ej. "a1-3" -> "A1").

No se modifica ni un solo archivo del sitio. Corre una vez (o cada vez que
quieras refrescar el snapshot, p. ej. tras añadir tarjetas nuevas desde
/admin):

    cd bots
    source .venv/bin/activate
    python scripts/export_site_content.py
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = PROJECT_ROOT / "dev.db"
CONTENT_FILE = PROJECT_ROOT / "src" / "lib" / "lessons" / "content.json"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "data"

LEVELS = ["a1", "a2", "b1", "b2"]


def _parse_json_field(raw: str | None) -> list:
    if not raw:
        return []
    return json.loads(raw)


def export_flashcards(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT id, category, level, emoji, russian, transcription, translationEs, "
        "exampleRu, exampleEs, synonyms, antonyms FROM FlashcardCard"
    ).fetchall()

    cards = []
    for row in rows:
        cards.append(
            {
                "id": row["id"],
                "category": row["category"],
                "level": row["level"],
                "emoji": row["emoji"],
                "russian": row["russian"],
                "transcription": row["transcription"],
                "translationEs": row["translationEs"],
                "exampleRu": row["exampleRu"],
                "exampleEs": row["exampleEs"],
                "synonyms": _parse_json_field(row["synonyms"]),
                "antonyms": _parse_json_field(row["antonyms"]),
            }
        )
    return cards


def export_glossary(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT id, term, definition, russianEquivalent, transcription, category, "
        "russianComparison, examples, relatedLessons FROM GlossaryTerm"
    ).fetchall()

    terms = []
    for row in rows:
        terms.append(
            {
                "id": row["id"],
                "term": row["term"],
                "definition": row["definition"],
                "russianEquivalent": row["russianEquivalent"],
                "transcription": row["transcription"],
                "category": row["category"],
                "russianComparison": row["russianComparison"],
                "examples": _parse_json_field(row["examples"]),
                "relatedLessons": _parse_json_field(row["relatedLessons"]),
            }
        )
    return terms


def export_idioms(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT id, category, phrase, literalTranslation, spanishEquivalent, "
        "explanation, contextExampleRu, contextExampleEs FROM Idiom"
    ).fetchall()

    return [
        {
            "id": row["id"],
            "category": row["category"],
            "phrase": row["phrase"],
            "literalTranslation": row["literalTranslation"],
            "spanishEquivalent": row["spanishEquivalent"],
            "explanation": row["explanation"],
            "contextExampleRu": row["contextExampleRu"],
            "contextExampleEs": row["contextExampleEs"],
        }
        for row in rows
    ]


def export_exam_questions() -> list[dict]:
    content = json.loads(CONTENT_FILE.read_text(encoding="utf-8"))

    questions = []
    seen_prompts: set[str] = set()
    for lesson_slug, lesson in content.items():
        level_prefix = lesson_slug.split("-")[0]
        if level_prefix not in LEVELS:
            continue
        level = level_prefix.upper()

        for exercise in lesson.get("exercises", []):
            if exercise.get("type") != "multiple-choice":
                continue
            prompt = exercise["prompt"]
            if prompt in seen_prompts:
                continue  # el mismo ejercicio puede repetirse en más de una lección
            seen_prompts.add(prompt)

            questions.append(
                {
                    "question": prompt,
                    "options": exercise["options"],
                    "correct_option_id": exercise["correctIndex"],
                    "level": level,
                }
            )
    return questions


def write_json(path: Path, data: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"No se encontró la base de datos en {DB_PATH}")

    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        flashcards = export_flashcards(conn)
        glossary = export_glossary(conn)
        idioms = export_idioms(conn)
    finally:
        conn.close()

    exam_questions = export_exam_questions()

    write_json(OUTPUT_DIR / "vocabulary.json", flashcards)
    write_json(OUTPUT_DIR / "glossary.json", glossary)
    write_json(OUTPUT_DIR / "idioms.json", idioms)
    write_json(OUTPUT_DIR / "exam_questions.json", exam_questions)

    print(f"vocabulary.json: {len(flashcards)} tarjetas")
    print(f"glossary.json: {len(glossary)} términos")
    print(f"idioms.json: {len(idioms)} modismos")
    print(f"exam_questions.json: {len(exam_questions)} preguntas ({', '.join(LEVELS)})")
    print(f"\nListo. Snapshot escrito en {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
