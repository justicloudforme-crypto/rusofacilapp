"""
RusoFásil — randomiza la posición de la respuesta correcta en un banco de
preguntas de opción múltiple
================================================================================

Escribir un banco de preguntas a mano con la respuesta correcta siempre en
options[0] es mucho más rápido y menos propenso a errores de transcripción
que ir intercalando manualmente la posición en cada pregunta. Este script
hace ese trabajo de forma FIABLE al final: para cada pregunta, baraja de
verdad (random.shuffle) el orden de las opciones y recalcula
correct_option_id — la única forma de garantizar ausencia de patrón a
escala de cientos de preguntas, en lugar de "a ojo".

Uso:
    python scripts/randomize_options.py <archivo_o_directorio> [...]

Ejemplos:
    python scripts/randomize_options.py history_bot/data/questions/
    python scripts/randomize_options.py history_bot/data/questions/kievan_rus.json

Con un directorio, procesa todos los *.json que contenga. Sobrescribe los
archivos en el sitio, conservando el resto de campos de cada pregunta
(question, explanation) sin tocar.
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path


def randomize_file(path: Path) -> None:
    with path.open(encoding="utf-8") as f:
        questions: list[dict] = json.load(f)

    for q in questions:
        correct_text = q["options"][q["correct_option_id"]]
        random.shuffle(q["options"])
        q["correct_option_id"] = q["options"].index(correct_text)

    path.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{path}: {len(questions)} preguntas randomizadas.")


def collect_files(targets: list[str]) -> list[Path]:
    files: list[Path] = []
    for target in targets:
        path = Path(target)
        if path.is_dir():
            files.extend(sorted(path.glob("*.json")))
        elif path.is_file():
            files.append(path)
        else:
            raise SystemExit(f"No existe: {path}")
    return files


def report_distribution(files: list[Path]) -> None:
    from collections import Counter

    counts: Counter = Counter()
    total = 0
    for path in files:
        with path.open(encoding="utf-8") as f:
            questions = json.load(f)
        for q in questions:
            counts[q["correct_option_id"]] += 1
            total += 1

    print(f"\nDistribución de correct_option_id sobre {total} preguntas:")
    for position in sorted(counts):
        pct = counts[position] / total * 100
        print(f"  posición {position}: {counts[position]} ({pct:.1f}%)")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Uso: python randomize_options.py <archivo_o_directorio> [...]")

    files = collect_files(sys.argv[1:])
    for path in files:
        randomize_file(path)
    report_distribution(files)


if __name__ == "__main__":
    main()
