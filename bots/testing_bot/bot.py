"""
RusoFásil — Testing bot (quiz de nivel)
========================================

Bot que aplica un test de nivel de ruso en aiogram 3.x. Las preguntas se
cargan de data/questions.json, extraídas directamente de los ejercicios
multiple-choice reales del programa del sitio (src/lib/lessons/content.json),
5 por cada nivel A1-B2, en orden de dificultad creciente. Al terminar, el
porcentaje de aciertos determina el nivel del usuario (A1/A2/B1/B2), según
el estándar MCER usado también en el resto del sitio.

El usuario responde una pregunta a la vez mediante botones inline; el
progreso se guarda en memoria mientras dura la sesión (FSM).

Configura el token en bots/.env bajo TESTING_BOT_TOKEN. Para ejecutar:
    pip install -r ../requirements.txt
    python bot.py
"""

import asyncio
import json
import logging
import os
from pathlib import Path

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatType, ParseMode
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from dotenv import load_dotenv

# =============================================================================
# CONFIG
# =============================================================================

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
BOT_TOKEN = os.environ["TESTING_BOT_TOKEN"]

DATA_FILE = Path(__file__).resolve().parent / "data" / "questions.json"


def load_questions(path: Path) -> list[dict]:
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


QUESTIONS = load_questions(DATA_FILE)

# Umbrales de porcentaje -> nivel MCER. Se recorren de mayor a menor.
LEVEL_THRESHOLDS = [
    (75, "B2", "Intermedio alto: entiendes textos complejos y matices del idioma."),
    (50, "B1", "Intermedio: te manejas en conversaciones cotidianas y temas conocidos."),
    (25, "A2", "Elemental: conoces frases y vocabulario básico de uso frecuente."),
    (0, "A1", "Principiante: estás dando tus primeros pasos con el ruso."),
]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("testing_bot")

router = Router()


class TestState(StatesGroup):
    in_progress = State()


def level_for_score(percentage: float) -> tuple[str, str]:
    for threshold, level, description in LEVEL_THRESHOLDS:
        if percentage >= threshold:
            return level, description
    return LEVEL_THRESHOLDS[-1][1], LEVEL_THRESHOLDS[-1][2]


def build_question_keyboard(index: int, options: list[str]) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=option, callback_data=f"answer:{index}:{i}")]
        for i, option in enumerate(options)
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def send_question(message: Message, state: FSMContext, index: int):
    question = QUESTIONS[index]
    await message.answer(
        f"Pregunta {index + 1}/{len(QUESTIONS)}\n\n{question['question']}",
        reply_markup=build_question_keyboard(index, question["options"]),
    )


@router.message(Command("start", "test", "nivel"), F.chat.type == ChatType.PRIVATE)
async def start_test(message: Message, state: FSMContext):
    await state.set_state(TestState.in_progress)
    await state.update_data(current_index=0, correct_count=0)
    await message.answer(
        f"¡Bienvenido/a al test de nivel de RusoFásil! 📝\n"
        f"Son {len(QUESTIONS)} preguntas de dificultad variada. "
        f"Responde con honestidad — es solo para ubicar tu nivel actual."
    )
    await send_question(message, state, 0)


@router.callback_query(TestState.in_progress, F.data.startswith("answer:"))
async def handle_answer(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    current_index = data["current_index"]

    _, question_index_str, chosen_id_str = callback.data.split(":")
    question_index, chosen_id = int(question_index_str), int(chosen_id_str)

    # Ignora respuestas a preguntas ya superadas (doble clic, mensajes viejos)
    if question_index != current_index:
        await callback.answer()
        return

    question = QUESTIONS[current_index]
    correct = chosen_id == question["correct_option_id"]
    correct_count = data["correct_count"] + (1 if correct else 0)

    feedback = "✅ ¡Correcto!" if correct else f"❌ Incorrecto. Era: {question['options'][question['correct_option_id']]}"
    if callback.message:
        await callback.message.edit_text(f"{question['question']}\n\n{feedback}")
    await callback.answer()

    next_index = current_index + 1
    if next_index >= len(QUESTIONS):
        percentage = round(correct_count / len(QUESTIONS) * 100)
        level, description = level_for_score(percentage)
        await callback.message.answer(
            f"🎓 Test terminado.\n\n"
            f"Aciertos: {correct_count}/{len(QUESTIONS)} ({percentage}%)\n"
            f"Tu nivel estimado es: <b>{level}</b>\n{description}"
        )
        await state.clear()
        return

    await state.update_data(current_index=next_index, correct_count=correct_count)
    await send_question(callback.message, state, next_index)


# =============================================================================
# MAIN
# =============================================================================


async def main():
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(router)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
