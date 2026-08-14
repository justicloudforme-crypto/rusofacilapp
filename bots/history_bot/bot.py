"""
RusoFásil — History bot (rusofasil_history_bot)
=================================================

Bot que enseña historia y cultura rusa a través de una mini-trivia diaria
(poll con opciones) publicada en el grupo, más una versión bajo demanda por
comando en chat privado.

La base de preguntas vive en data/history.json (mismo formato usado en
BajaBot): lista de objetos {question, options, correct_option_id,
explanation}. Para ampliarla, añade nuevos objetos al archivo — no hace
falta tocar el código.

Configura el token en bots/.env bajo HISTORY_BOT_TOKEN. Antes de arrancar,
completa GROUP_CHAT_ID abajo con el id del grupo de RusoFásil (usa
@userinfobot reenviando un mensaje del grupo, o getUpdates).

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
BOT_TOKEN = os.environ["HISTORY_BOT_TOKEN"]

# id del grupo de RusoFásil donde se publica la trivia diaria (número
# negativo, para supergrupos empieza con -100...). Complétalo antes de
# arrancar el bot: sin esto, el job programado fallará al enviar el poll.
GROUP_CHAT_ID = -1003668895078

# Hora diaria de publicación (hora del servidor donde corre el bot)
POST_TIME = time(hour=12, minute=0)

DATA_FILE = Path(__file__).resolve().parent / "data" / "history.json"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("history_bot")

router = Router()


# =============================================================================
# BANCO DE PREGUNTAS
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
    """Reparte preguntas del banco en orden aleatorio sin repetir hasta agotar el mazo."""

    def __init__(self, questions: list[dict]):
        self._bank = questions
        self._queue: list[dict] = []

    def draw(self) -> dict:
        if not self._queue:
            self._queue = self._bank.copy()
            random.shuffle(self._queue)
        return self._queue.pop()


history_deck = QuestionDeck(load_questions(DATA_FILE))


async def send_history_quiz(bot: Bot, chat_id: int):
    question = history_deck.draw()
    # Anónimo en el grupo (quiz público, sin exponer quién acertó/falló);
    # no anónimo en privado, donde el único participante es el propio usuario.
    is_group_post = chat_id == GROUP_CHAT_ID
    await bot.send_poll(
        chat_id=chat_id,
        question=f"📜 Historia y cultura rusa: {question['question']}",
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
        "¡Hola! Soy el bot de historia y cultura de RusoFásil 📜🇷🇺\n"
        "Cada día publico una mini-trivia en el grupo. "
        "Aquí en privado, usa /dato para recibir una pregunta al azar cuando quieras."
    )


@router.message(Command("dato"), F.chat.type == ChatType.PRIVATE)
async def send_random_fact(message: Message, bot: Bot):
    await send_history_quiz(bot, message.chat.id)


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
            send_history_quiz,
            CronTrigger(hour=POST_TIME.hour, minute=POST_TIME.minute),
            args=[bot, GROUP_CHAT_ID],
            id="daily_history_quiz",
            misfire_grace_time=3600,
        )
        scheduler.start()
    else:
        logger.warning("GROUP_CHAT_ID no configurado: la trivia diaria en grupo está desactivada.")

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
