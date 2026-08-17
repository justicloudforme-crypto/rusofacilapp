"""
RusoFásil — History bot (rusofasil_history_bot)
=================================================

Bot que enseña historia y cultura rusa a través de una mini-trivia diaria
(poll con opciones) publicada en el grupo, más una versión bajo demanda por
comando en chat privado.

La base de preguntas vive repartida por tema en data/questions/*.json
(kievan_rus, tsardom_empire, late_empire, soviet_era, culture_literature,
science_technology, geography_nature) — mismo formato de objeto en todos:
{question, options, correct_option_id, explanation}. Para ampliarla, añade
objetos al archivo del tema correspondiente (o crea uno nuevo) — no hace
falta tocar el código. Todo el contenido cubre historia rusa hasta 1991
inclusive; nada de la Rusia contemporánea de los últimos ~20 años.

Configura el token en bots/.env bajo HISTORY_BOT_TOKEN. Antes de arrancar,
completa GROUP_CHAT_ID abajo con el id del grupo de RusoFásil (usa
@userinfobot reenviando un mensaje del grupo, o getUpdates).

Para ejecutar:
    pip install -r ../requirements.txt
    python bot.py
"""

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
from common.data_io import load_question_bank_dir  # noqa: E402
from common.quiz import MAX_EXPLANATION_LENGTH, MAX_OPTION_LENGTH, MAX_QUESTION_LENGTH, truncate  # noqa: E402
from common.scheduler import start_daily_jobs  # noqa: E402

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

DATA_DIR = Path(__file__).resolve().parent / "data" / "questions"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("history_bot")

router = Router()


# =============================================================================
# BANCO DE PREGUNTAS
# =============================================================================


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


history_deck = QuestionDeck(load_question_bank_dir(DATA_DIR))


async def send_history_quiz(bot: Bot, chat_id: int):
    question = history_deck.draw()
    # Anónimo en el grupo (quiz público, sin exponer quién acertó/falló);
    # no anónimo en privado, donde el único participante es el propio usuario.
    is_group_post = chat_id == GROUP_CHAT_ID
    # El banco se escribió priorizando riqueza histórica sobre los límites de
    # la Bot API (question <=300, cada option <=100, explanation <=200); se
    # trunca acá en vez de recortar a mano las 1004 preguntas — mismo criterio
    # que build_multiple_choice() en común/quiz.py.
    explanation = question.get("explanation")
    await bot.send_poll(
        chat_id=chat_id,
        question=truncate(f"📜 Historia y cultura rusa: {question['question']}", MAX_QUESTION_LENGTH),
        options=[truncate(option, MAX_OPTION_LENGTH) for option in question["options"]],
        type="quiz",
        correct_option_id=question["correct_option_id"],
        explanation=truncate(explanation, MAX_EXPLANATION_LENGTH) if explanation else None,
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

    if GROUP_CHAT_ID:
        start_daily_jobs([
            ("daily_history_quiz", POST_TIME, send_history_quiz, [bot, GROUP_CHAT_ID]),
        ])
    else:
        logger.warning("GROUP_CHAT_ID no configurado: la trivia diaria en grupo está desactivada.")

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
