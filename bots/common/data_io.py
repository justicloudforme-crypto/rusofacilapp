"""
RusoFásil — validación/carga compartida de bancos de preguntas de opción
múltiple guardados en JSON (formato {question, options, correct_option_id,
explanation?}).

vocabulary_bot, testing_bot y history_bot definían cada uno su propia copia
de esta función; se centraliza aquí para no repetirla tres veces.
"""

import json
from pathlib import Path


def load_question_bank_dir(directory: Path) -> list[dict]:
    """Carga y concatena todos los bancos *.json de un directorio (cada uno
    validado individualmente por load_question_bank), y además verifica que
    ninguna pregunta se repita ENTRE archivos distintos — la validación por
    archivo no puede detectar eso por sí sola."""
    all_questions: list[dict] = []
    seen_question_to_file: dict[str, str] = {}

    for path in sorted(directory.glob("*.json")):
        questions = load_question_bank(path)
        for q in questions:
            existing_file = seen_question_to_file.get(q["question"])
            if existing_file:
                raise ValueError(
                    f"Pregunta duplicada entre archivos: {q['question']!r} "
                    f"aparece tanto en {existing_file} como en {path.name}"
                )
            seen_question_to_file[q["question"]] = path.name
        all_questions.extend(questions)

    return all_questions


def load_question_bank(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        questions: list[dict] = json.load(f)

    seen: set[str] = set()
    for i, q in enumerate(questions):
        where = f"{path.name}, запись #{i + 1}"
        if q["question"] in seen:
            raise ValueError(f"Дубликат вопроса в {where}: {q['question']!r}")
        seen.add(q["question"])
        if not (0 <= q["correct_option_id"] < len(q["options"])):
            raise ValueError(f"correct_option_id вне диапазона options в {where}")
        if len(q["options"]) != len(set(q["options"])):
            raise ValueError(f"Повторяющиеся варианты ответа в {where}")

    return questions
