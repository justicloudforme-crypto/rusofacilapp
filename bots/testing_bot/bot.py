"""
RusoFásil — Testing bot (quiz de nivel)
========================================

Bot que aplica un test de nivel de ruso adaptativo en aiogram 3.x.

Publica diariamente (ANNOUNCE_TIME) un anuncio en el canal de RusoFásil con
un botón inline que abre un deep link (t.me/<bot>?start=test) al chat
privado del bot — el test en sí es un diálogo con estado (FSM) y no puede
vivir como poll nativo del canal, así que solo corre en privado.

Algoritmo (CAT simplificado — computer-adaptive testing):
  1. Empieza en el nivel medio (A2).
  2. Cada respuesta correcta sube un nivel (tope B2); cada respuesta
     incorrecta baja un nivel (piso A1). Así el test no obliga a un
     principiante a aguantar preguntas B2 hasta el final, ni le regala
     preguntas A1 a alguien que ya domina B1.
  3. Se hacen NUM_QUESTIONS preguntas (no un banco fijo).
  4. El nivel final es el promedio (redondeado) de los últimos 3 niveles
     visitados — suaviza el ruido de una sola respuesta al azar — y se
     corrige un escalón hacia abajo si las últimas 2 respuestas fueron
     incorrectas (señal de que ese nivel todavía no está consolidado).

Cada pregunta se arma al vuelo mezclando tres fuentes del snapshot local
del sitio (bots/data/, ver bots/common/local_content.py): vocabulario,
gramática y ejercicios reales de examen de las lecciones — las tres
filtradas al nivel que el algoritmo pide en ese momento. El bot no hace
ninguna llamada de red; si el snapshot no existe, local_content lanza un
error claro pidiendo correr scripts/export_site_content.py primero.

El resultado de cada test (usuario, nivel, aciertos) se guarda en
data/results.json para tener un registro cuando aparezcan alumnos reales
— el proceso de la pregunta en sí sigue viviendo sólo en memoria (FSM),
no hace falta sobrevivir a un reinicio del bot a mitad de un test de menos
de un minuto.

Configura el token en bots/.env bajo TESTING_BOT_TOKEN. Para ejecutar:
    pip install -r ../requirements.txt
    python bot.py
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import sys
from datetime import datetime, time, timezone
from pathlib import Path

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatType, ParseMode
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common import local_content  # noqa: E402
from common.quiz import build_multiple_choice  # noqa: E402
from common.scheduler import start_daily_jobs  # noqa: E402

# =============================================================================
# CONFIG
# =============================================================================

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
BOT_TOKEN = os.environ["TESTING_BOT_TOKEN"]

# id del canal de RusoFásil donde se publica el anuncio diario invitando a
# hacer el test (el test en sí sigue corriendo solo en privado — es un
# diálogo con estado, no se puede hacer como poll nativo del canal).
GROUP_CHAT_ID = -1003668895078

# Hora diaria de publicación del anuncio (hora del servidor donde corre el bot)
ANNOUNCE_TIME = time(hour=15, minute=0)

LEVELS = ["A1", "A2", "B1", "B2"]
START_LEVEL_INDEX = 1  # A2
NUM_QUESTIONS = 9

# Pesos de las tres fuentes de preguntas en cada paso del test.
QUESTION_SOURCE_WEIGHTS = {"word": 0.35, "grammar": 0.30, "exam": 0.35}

LEVEL_DESCRIPTIONS = {
    "A1": "Principiante: estás dando tus primeros pasos con el ruso.",
    "A2": "Elemental: conoces frases y vocabulario básico de uso frecuente.",
    "B1": "Intermedio: te manejas en conversaciones cotidianas y temas conocidos.",
    "B2": "Intermedio alto: entiendes textos complejos y matices del idioma.",
}

RESULTS_FILE = Path(__file__).resolve().parent / "data" / "results.json"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("testing_bot")

router = Router()


class TestState(StatesGroup):
    in_progress = State()


# =============================================================================
# PREGUNTAS ADAPTATIVAS DESDE EL SNAPSHOT LOCAL
# =============================================================================


def build_word_question(cards: list[dict]) -> dict | None:
    if len(cards) < 4:
        return None
    card = random.choice(cards)
    distractor_pool = [c["translationEs"] for c in cards if c["id"] != card["id"]]
    return build_multiple_choice(
        question=f"¿Cómo se traduce la palabra rusa '{card['russian']}'?",
        correct=card["translationEs"],
        distractor_pool=distractor_pool,
        explanation=f"Se pronuncia: {card['transcription']}.",
    )


def build_grammar_question(terms: list[dict]) -> dict | None:
    if len(terms) < 4:
        return None
    term = random.choice(terms)
    distractor_pool = [t["definition"] for t in terms if t["id"] != term["id"]]
    explanation = term.get("russianComparison") or f"Equivalente en ruso: {term['russianEquivalent']}."
    return build_multiple_choice(
        question=f"¿Qué significa '{term['term']}' en la gramática rusa?",
        correct=term["definition"],
        distractor_pool=distractor_pool,
        explanation=explanation,
    )


def build_exam_question(exam_questions: list[dict]) -> dict | None:
    if not exam_questions:
        return None
    q = random.choice(exam_questions)
    return {
        "question": q["question"],
        "options": q["options"],
        "correct_option_id": q["correct_option_id"],
        "explanation": None,
    }


def get_question_for_level(level: str) -> dict:
    """Arma una pregunta para el nivel dado, mezclando vocabulario, gramática
    y ejercicios de examen según QUESTION_SOURCE_WEIGHTS. Si la fuente elegida
    no tiene suficiente material para ese nivel, prueba las otras dos antes
    de rendirse."""
    builders = {
        "word": lambda: build_word_question(local_content.get_flashcards(level=level)),
        "grammar": lambda: build_grammar_question(local_content.get_glossary(level=level.lower())),
        "exam": lambda: build_exam_question(local_content.get_exam_questions(level=level)),
    }

    sources = list(builders.keys())
    weights = [QUESTION_SOURCE_WEIGHTS[s] for s in sources]
    # random.choices pondera la primera fuente a intentar; si falla, se
    # prueban las otras dos en orden aleatorio antes de rendirse.
    first_choice = random.choices(sources, weights=weights, k=1)[0]
    remaining = [s for s in sources if s != first_choice]
    random.shuffle(remaining)
    order = [first_choice] + remaining

    for source in order:
        question = builders[source]()
        if question:
            return question

    raise RuntimeError(
        f"No hay preguntas disponibles para el nivel {level} en ninguna de las tres fuentes "
        f"(vocabulario/gramática/examen). Revisa que scripts/export_site_content.py se haya "
        f"corrido correctamente."
    )


# =============================================================================
# RESULTADOS (persistidos en disco)
# =============================================================================


def save_result(user_id: int, full_name: str, level: str, correct_count: int, total: int) -> None:
    RESULTS_FILE.parent.mkdir(exist_ok=True)
    results: list[dict] = []
    if RESULTS_FILE.exists():
        with RESULTS_FILE.open(encoding="utf-8") as f:
            results = json.load(f)

    results.append(
        {
            "user_id": user_id,
            "full_name": full_name,
            "level": level,
            "correct_count": correct_count,
            "total": total,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    with RESULTS_FILE.open("w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)


# =============================================================================
# ANUNCIO EN EL CANAL (el test en sí solo corre en privado)
# =============================================================================

_bot_username_cache: str | None = None


async def get_bot_username(bot: Bot) -> str:
    global _bot_username_cache
    if _bot_username_cache is None:
        me = await bot.get_me()
        _bot_username_cache = me.username
    return _bot_username_cache


async def send_test_announcement(bot: Bot, chat_id: int) -> None:
    """Publica en el canal un anuncio con un botón que lleva al chat privado
    del bot (deep link ?start=test) — el test adaptativo es un diálogo con
    estado (FSM), así que no puede vivir como poll nativo del canal."""
    username = await get_bot_username(bot)
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📝 Hacer el test de nivel", url=f"https://t.me/{username}?start=test")]
        ]
    )
    await bot.send_message(
        chat_id,
        "📝 <b>¿Cuál es tu nivel real de ruso?</b>\n\n"
        f"Responde {NUM_QUESTIONS} preguntas que se adaptan a tus respuestas y descubre en "
        "un par de minutos si estás en A1, A2, B1 o B2. Toca el botón para hacerlo en privado "
        "con el bot.",
        reply_markup=keyboard,
    )


# =============================================================================
# FLUJO DEL TEST
# =============================================================================


def build_question_keyboard(step: int, options: list[str]) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=option, callback_data=f"answer:{step}:{i}")]
        for i, option in enumerate(options)
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def send_step_question(message: Message, state: FSMContext, step: int, level_index: int):
    try:
        question = get_question_for_level(LEVELS[level_index])
    except RuntimeError:
        logger.exception("No se pudo armar la pregunta %s/%s (nivel %s)", step + 1, NUM_QUESTIONS, LEVELS[level_index])
        await state.clear()
        await message.answer(
            "⚠️ No pude generar la siguiente pregunta (falta contenido para este nivel). "
            "El test se canceló — probá de nuevo con /start en un momento."
        )
        return
    await state.update_data(current_question=question)
    await message.answer(
        f"Pregunta {step + 1}/{NUM_QUESTIONS} (nivel {LEVELS[level_index]})\n\n{question['question']}",
        reply_markup=build_question_keyboard(step, question["options"]),
    )


def estimate_final_level(level_index_history: list[int], last_two_correct: list[bool]) -> str:
    window = level_index_history[-3:]
    final_index = round(sum(window) / len(window))
    final_index = max(0, min(final_index, len(LEVELS) - 1))

    if len(last_two_correct) == 2 and not any(last_two_correct):
        final_index = max(0, final_index - 1)

    return LEVELS[final_index]


async def begin_test(message: Message, state: FSMContext, *, greet: bool) -> None:
    """Arranca (o reinicia) el test desde cero — usado por /start, /reset y el
    botón "Repetir test" al final, así los tres caminos quedan idénticos."""
    await state.set_state(TestState.in_progress)
    await state.update_data(
        step=0,
        level_index=START_LEVEL_INDEX,
        correct_count=0,
        level_index_history=[],
        last_two_correct=[],
    )
    if greet:
        await message.answer(
            f"¡Bienvenido/a al test de nivel de RusoFásil! 📝\n"
            f"Son {NUM_QUESTIONS} preguntas que se adaptan a tus respuestas — "
            f"empezamos por un nivel intermedio y ajustamos según aciertes o no. "
            f"Responde con honestidad — es solo para ubicar tu nivel actual."
        )
    data = await state.get_data()
    await send_step_question(message, state, data["step"], data["level_index"])


@router.message(Command("start", "test", "nivel"), F.chat.type == ChatType.PRIVATE)
async def start_test(message: Message, state: FSMContext):
    await begin_test(message, state, greet=True)


@router.message(Command("reset"), F.chat.type == ChatType.PRIVATE)
async def reset_test(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("🔄 Progreso reiniciado.")
    await begin_test(message, state, greet=False)


@router.callback_query(TestState.in_progress, F.data.startswith("answer:"))
async def handle_answer(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    step = data["step"]

    _, answered_step_str, chosen_id_str = callback.data.split(":")
    answered_step, chosen_id = int(answered_step_str), int(chosen_id_str)

    # Ignora respuestas a preguntas ya superadas (doble clic, mensajes viejos)
    if answered_step != step:
        await callback.answer()
        return

    question = data["current_question"]
    correct = chosen_id == question["correct_option_id"]
    correct_count = data["correct_count"] + (1 if correct else 0)

    level_index = data["level_index"]
    level_index_history = data["level_index_history"] + [level_index]
    last_two_correct = (data["last_two_correct"] + [correct])[-2:]

    feedback_text = question["options"][question["correct_option_id"]]
    feedback = "✅ ¡Correcto!" if correct else f"❌ Incorrecto. Era: {feedback_text}"
    if callback.message:
        await callback.message.edit_text(f"{question['question']}\n\n{feedback}")
    await callback.answer()

    next_step = step + 1
    if next_step >= NUM_QUESTIONS:
        level = estimate_final_level(level_index_history, last_two_correct)
        percentage = round(correct_count / NUM_QUESTIONS * 100)
        save_result(
            user_id=callback.from_user.id,
            full_name=callback.from_user.full_name,
            level=level,
            correct_count=correct_count,
            total=NUM_QUESTIONS,
        )
        restart_keyboard = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="🔄 Repetir test", callback_data="restart_test")]]
        )
        await callback.message.answer(
            f"🎓 Test terminado.\n\n"
            f"Aciertos: {correct_count}/{NUM_QUESTIONS} ({percentage}%)\n"
            f"Tu nivel estimado es: <b>{level}</b>\n{LEVEL_DESCRIPTIONS[level]}\n\n"
            f"Puedes revisar los cursos y lecciones de nivel {level} en RusoFásil "
            f"para seguir practicando exactamente donde te toca.",
            reply_markup=restart_keyboard,
        )
        await state.clear()
        return

    # Sube un nivel si acertó (tope B2), baja uno si falló (piso A1)
    next_level_index = min(level_index + 1, len(LEVELS) - 1) if correct else max(level_index - 1, 0)

    await state.update_data(
        step=next_step,
        level_index=next_level_index,
        correct_count=correct_count,
        level_index_history=level_index_history,
        last_two_correct=last_two_correct,
    )
    await send_step_question(callback.message, state, next_step, next_level_index)


@router.callback_query(F.data == "restart_test")
async def restart_test(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    if callback.message:
        await begin_test(callback.message, state, greet=False)


@router.callback_query(StateFilter(None), F.data.startswith("answer:"))
async def handle_stale_answer(callback: CallbackQuery):
    """Botones de una sesión de test ya terminada/reiniciada (el estado se
    perdió: reinicio del bot, /reset a mitad de camino, etc.) — sin este
    handler, tocar un botón viejo no hacía nada visible (el spinner de
    Telegram giraba para siempre porque nadie llamaba a callback.answer())."""
    await callback.answer(
        "Este test ya terminó o se reinició. Envía /start para empezar uno nuevo.",
        show_alert=True,
    )


# =============================================================================
# MAIN
# =============================================================================


async def main():
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(router)

    await bot.set_my_commands([
        BotCommand(command="start", description="Empezar el test de nivel"),
        BotCommand(command="reset", description="Reiniciar el progreso del test"),
    ])

    if GROUP_CHAT_ID:
        start_daily_jobs([
            ("daily_test_announcement", ANNOUNCE_TIME, send_test_announcement, [bot, GROUP_CHAT_ID]),
        ])
    else:
        logger.warning("GROUP_CHAT_ID no configurado: el anuncio diario del test en canal está desactivado.")

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
