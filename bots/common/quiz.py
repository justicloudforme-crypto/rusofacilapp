"""
RusoFásil — utilidades compartidas para armar preguntas de opción múltiple
=============================================================================

Los límites de longitud son los que impone la Bot API de Telegram para
send_poll (pregunta <=300 caracteres, cada opción <=100, explicación <=200):
si se los supera, Telegram rechaza el poll entero. Truncar aquí evita que un
texto largo tomado del sitio (p. ej. una definición de gramática) tumbe
silenciosamente una publicación diaria.
"""

from __future__ import annotations

import random

MAX_QUESTION_LENGTH = 300
MAX_OPTION_LENGTH = 100
MAX_EXPLANATION_LENGTH = 200


def truncate(text: str, limit: int) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def pick_distractors(correct: str, pool: list[str], count: int = 3) -> list[str] | None:
    """Trunca y desduplica un pool de opciones incorrectas candidatas.
    Devuelve None si no se juntan `count` opciones únicas distintas de `correct`."""
    truncated_correct = truncate(correct, MAX_OPTION_LENGTH)
    seen = {truncated_correct}
    chosen: list[str] = []

    shuffled = pool.copy()
    random.shuffle(shuffled)
    for raw in shuffled:
        candidate = truncate(raw, MAX_OPTION_LENGTH)
        if candidate not in seen:
            seen.add(candidate)
            chosen.append(candidate)
        if len(chosen) == count:
            break

    if len(chosen) < count:
        return None
    return chosen


def build_multiple_choice(question: str, correct: str, distractor_pool: list[str], explanation: str) -> dict | None:
    distractors = pick_distractors(correct, distractor_pool)
    if distractors is None:
        return None

    options = [truncate(correct, MAX_OPTION_LENGTH)] + distractors
    random.shuffle(options)

    return {
        "question": truncate(question, MAX_QUESTION_LENGTH),
        "options": options,
        "correct_option_id": options.index(truncate(correct, MAX_OPTION_LENGTH)),
        "explanation": truncate(explanation, MAX_EXPLANATION_LENGTH) if explanation else None,
    }
