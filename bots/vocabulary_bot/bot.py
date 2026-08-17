"""
RusoFásil — Vocabulary bot (rusofasil_vocabulary_bot)
========================================================

Bot que enseña vocabulario y gramática rusa mediante dos mini-trivias
diarias (poll con opciones) publicadas en el grupo, más versiones bajo
demanda por comando en chat privado:

  - /palabra   -> pregunta de traducción, generada a partir del banco
                  completo de tarjetas del sitio.
  - /gramatica -> pregunta sobre un término del glosario gramatical del
                  sitio, con la comparación con el español que el sitio ya
                  redacta para cada término.

Las preguntas se generan al vuelo a partir de bots/data/vocabulary.json y
bots/data/glossary.json — un snapshot local del contenido real del sitio,
escrito una vez por scripts/export_site_content.py (ver bots/common/
local_content.py). El bot no hace ninguna llamada de red ni necesita el
sitio corriendo; si el snapshot no existe, local_content lanza un error
claro pidiendo correr el script de exportación primero.

Configura el token en bots/.env bajo VOCABULARY_BOT_TOKEN. Antes de
arrancar, completa GROUP_CHAT_ID abajo con el id del grupo de RusoFásil.

Para ejecutar:
    pip install -r ../requirements.txt
    python bot.py
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import sys
from datetime import time
from pathlib import Path

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatType, ParseMode
from aiogram.filters import Command
from aiogram.types import Message
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common import local_content  # noqa: E402
from common.quiz import build_multiple_choice  # noqa: E402
from common.scheduler import start_daily_jobs  # noqa: E402

# =============================================================================
# CONFIG
# =============================================================================

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
BOT_TOKEN = os.environ["VOCABULARY_BOT_TOKEN"]

# id del grupo de RusoFásil donde se publican la palabra y la gramática del
# día (número negativo, para supergrupos empieza con -100...). Complétalo
# antes de arrancar el bot: sin esto, los jobs programados fallarán al
# enviar el poll.
GROUP_CHAT_ID = -1003668895078

# Horas diarias de publicación (hora del servidor donde corre el bot)
WORD_POST_TIME = time(hour=10, minute=0)
GRAMMAR_POST_TIME = time(hour=18, minute=0)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vocabulary_bot")

router = Router()


# =============================================================================
# PREGUNTAS
# =============================================================================


def build_word_question(cards: list[dict]) -> dict | None:
    if len(cards) < 4:
        return None
    card = random.choice(cards)

    # Distractores del mismo nivel y categoría cuando hay suficientes, para
    # que las opciones falsas sean plausibles (no un contraste absurdo entre
    # una palabra de cocina A1 y un término abstracto C1).
    same_bucket = [c for c in cards if c["level"] == card["level"] and c["category"] == card["category"]]
    pool_source = same_bucket if len(same_bucket) >= 4 else cards
    distractor_pool = [c["translationEs"] for c in pool_source if c["id"] != card["id"]]

    example = f" Ejemplo: {card['exampleRu']} — {card['exampleEs']}" if card.get("exampleRu") else ""
    explanation = f"Se pronuncia: {card['transcription']}.{example}"

    return build_multiple_choice(
        question=f"¿Cómo se traduce la palabra rusa '{card['russian']}'?",
        correct=card["translationEs"],
        distractor_pool=distractor_pool,
        explanation=explanation,
    )


def build_grammar_question(terms: list[dict]) -> dict | None:
    if len(terms) < 4:
        return None
    term = random.choice(terms)

    same_category = [t for t in terms if t["category"] == term["category"]]
    pool_source = same_category if len(same_category) >= 4 else terms
    distractor_pool = [t["definition"] for t in pool_source if t["id"] != term["id"]]

    explanation = term.get("russianComparison") or f"Equivalente en ruso: {term['russianEquivalent']}."

    return build_multiple_choice(
        question=f"¿Qué significa '{term['term']}' en la gramática rusa?",
        correct=term["definition"],
        distractor_pool=distractor_pool,
        explanation=explanation,
    )


def get_word_question() -> dict:
    question = build_word_question(local_content.get_flashcards())
    if question is None:
        raise RuntimeError("No se pudo armar una pregunta de vocabulario: el banco tiene menos de 4 tarjetas.")
    return question


def get_grammar_question() -> dict:
    question = build_grammar_question(local_content.get_glossary())
    if question is None:
        raise RuntimeError("No se pudo armar una pregunta de gramática: el glosario tiene menos de 4 términos.")
    return question


async def send_word_quiz(bot: Bot, chat_id: int):
    question = get_word_question()
    is_group_post = chat_id == GROUP_CHAT_ID
    await bot.send_poll(
        chat_id=chat_id,
        question=f"📖 Palabra del día: {question['question']}",
        options=question["options"],
        type="quiz",
        correct_option_id=question["correct_option_id"],
        explanation=question.get("explanation"),
        is_anonymous=is_group_post,
    )


async def send_grammar_quiz(bot: Bot, chat_id: int):
    question = get_grammar_question()
    is_group_post = chat_id == GROUP_CHAT_ID
    await bot.send_poll(
        chat_id=chat_id,
        question=f"🧠 Gramática del día: {question['question']}",
        options=question["options"],
        type="quiz",
        correct_option_id=question["correct_option_id"],
        explanation=question.get("explanation"),
        is_anonymous=is_group_post,
    )


# =============================================================================
# HANDLERS
# =============================================================================


@router.message(Command("start"), F.chat.type == ChatType.PRIVATE)
async def start_handler(message: Message):
    await message.answer(
        "¡Hola! Soy el bot de vocabulario y gramática de RusoFásil 📖🇷🇺\n"
        "Cada día publico una palabra y un punto de gramática en el grupo.\n"
        "Aquí en privado: /palabra para una palabra al azar, /gramatica para un punto de gramática."
    )


@router.message(Command("palabra"), F.chat.type == ChatType.PRIVATE)
async def send_random_word(message: Message, bot: Bot):
    await send_word_quiz(bot, message.chat.id)


@router.message(Command("gramatica"), F.chat.type == ChatType.PRIVATE)
async def send_random_grammar(message: Message, bot: Bot):
    await send_grammar_quiz(bot, message.chat.id)


# =============================================================================
# MAIN
# =============================================================================


async def main():
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)

    if GROUP_CHAT_ID:
        start_daily_jobs([
            ("daily_word_quiz", WORD_POST_TIME, send_word_quiz, [bot, GROUP_CHAT_ID]),
            ("daily_grammar_quiz", GRAMMAR_POST_TIME, send_grammar_quiz, [bot, GROUP_CHAT_ID]),
        ])
    else:
        logger.warning("GROUP_CHAT_ID no configurado: las publicaciones diarias en grupo están desactivadas.")

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
