"""
RusoFásil — Vocabulary bot (rusofasil_vocabulary_bot)
========================================================

Bot que enseña vocabulario ruso mediante una mini-trivia diaria (poll con
opciones) publicada en el grupo, más una versión bajo demanda por comando
en chat privado.

La base de palabras vive en data/vocabulary.json (mismo formato usado en
history_bot y en BajaBot): lista de objetos {question, options,
correct_option_id, explanation}. Para ampliarla, añade nuevas palabras al
archivo — no hace falta tocar el código.

Configura el token en bots/.env bajo VOCABULARY_BOT_TOKEN. Antes de
arrancar, completa GROUP_CHAT_ID abajo con el id del grupo de RusoFásil.

Para ejecutar:
    pip install -r ../requirements.txt
    python bot.py
"""

import asyncio
import json
import logging
import os
import random
from datetime import time
from pathlib import Path

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatType, ParseMode
from aiogram.filters import Command
from aiogram.types import Message
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv

# =============================================================================
# CONFIG
# =============================================================================

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
BOT_TOKEN = os.environ["VOCABULARY_BOT_TOKEN"]

# id del grupo de RusoFásil donde se publica la palabra del día (número
# negativo, para supergrupos empieza con -100...). Complétalo antes de
# arrancar el bot: sin esto, el job programado fallará al enviar el poll.
GROUP_CHAT_ID = -1003668895078

# Hora diaria de publicación (hora del servidor donde corre el bot)
POST_TIME = time(hour=10, minute=0)

DATA_FILE = Path(__file__).resolve().parent / "data" / "vocabulary.json"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vocabulary_bot")

router = Router()


# =============================================================================
# BANCO DE PALABRAS
# =============================================================================


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


class QuestionDeck:
    """Reparte palabras del banco en orden aleatorio sin repetir hasta agotar el mazo."""

    def __init__(self, questions: list[dict]):
        self._bank = questions
        self._queue: list[dict] = []

    def draw(self) -> dict:
        if not self._queue:
            self._queue = self._bank.copy()
            random.shuffle(self._queue)
        return self._queue.pop()


vocabulary_deck = QuestionDeck(load_questions(DATA_FILE))


async def send_vocabulary_quiz(bot: Bot, chat_id: int):
    question = vocabulary_deck.draw()
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


# =============================================================================
# HANDLERS
# =============================================================================


@router.message(Command("start"), F.chat.type == ChatType.PRIVATE)
async def start_handler(message: Message):
    await message.answer(
        "¡Hola! Soy el bot de vocabulario de RusoFásil 📖🇷🇺\n"
        "Cada día publico una palabra nueva en el grupo. "
        "Aquí en privado, usa /palabra para practicar una palabra al azar cuando quieras."
    )


@router.message(Command("palabra"), F.chat.type == ChatType.PRIVATE)
async def send_random_word(message: Message, bot: Bot):
    await send_vocabulary_quiz(bot, message.chat.id)


# =============================================================================
# MAIN
# =============================================================================


async def main():
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)

    scheduler = AsyncIOScheduler()
    if GROUP_CHAT_ID:
        scheduler.add_job(
            send_vocabulary_quiz,
            CronTrigger(hour=POST_TIME.hour, minute=POST_TIME.minute),
            args=[bot, GROUP_CHAT_ID],
            id="daily_vocabulary_quiz",
            misfire_grace_time=3600,
        )
        scheduler.start()
    else:
        logger.warning("GROUP_CHAT_ID no configurado: la palabra diaria en grupo está desactivada.")

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
