"""
RusoFásil — acceso al snapshot local del contenido del sitio
=================================================================

vocabulary_bot y testing_bot ya no hacen ninguna llamada de red: leen una
sola vez, al importar este módulo, los 4 JSON que
bots/scripts/export_site_content.py generó en bots/data/ a partir de
dev.db y content.json. Esto es intencional — el contenido del sitio no
cambia mientras los bots corren, así que no hace falta ni caché con TTL ni
lógica de reintento; sólo una carga en memoria.

Si falta algún archivo, es un error de configuración (el desarrollador no
corrió el script de exportación todavía), no un fallo transitorio — por
eso se lanza un RuntimeError explícito en vez de degradar en silencio.
"""

from __future__ import annotations

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load(filename: str) -> list[dict]:
    path = DATA_DIR / filename
    if not path.exists():
        raise RuntimeError(
            f"No se encontró {path}. Corre primero:\n"
            f"    cd bots && python scripts/export_site_content.py"
        )
    with path.open(encoding="utf-8") as f:
        return json.load(f)


_flashcards = _load("vocabulary.json")
_glossary = _load("glossary.json")
_idioms = _load("idioms.json")
_exam_questions = _load("exam_questions.json")


def get_flashcards(level: str | None = None, category: str | None = None) -> list[dict]:
    cards = _flashcards
    if level:
        cards = [c for c in cards if c["level"] == level]
    if category:
        cards = [c for c in cards if c["category"] == category]
    return cards


def get_glossary(category: str | None = None, level: str | None = None) -> list[dict]:
    terms = _glossary
    if category:
        terms = [t for t in terms if t["category"] == category]
    if level:
        prefix = f"{level.lower()}-"
        terms = [t for t in terms if any(rl.startswith(prefix) for rl in t["relatedLessons"])]
    return terms


def get_idioms(category: str | None = None) -> list[dict]:
    idioms = _idioms
    if category:
        idioms = [i for i in idioms if i["category"] == category]
    return idioms


def get_exam_questions(level: str | None = None) -> list[dict]:
    questions = _exam_questions
    if level:
        questions = [q for q in questions if q["level"] == level]
    return questions
