"""
RusoFásil — envío de preguntas de prueba al grupo
====================================================

Script de un solo uso para verificar en la práctica (randomización de
opciones, botones, formato) los tres bots que publican en el canal de
RusoFásil: history_bot, vocabulary_bot y testing_bot.

history_bot y vocabulary_bot envían UNA pregunta usando exactamente la
misma función que usa su publicación diaria real (send_history_quiz,
send_word_quiz) — pólls nativos de Telegram. testing_bot ya no publica
preguntas en el canal (su test es un diálogo con estado, no puede vivir
como poll); en su lugar publica el mismo anuncio diario real
(send_test_announcement) con el botón que lleva al chat privado del bot
vía deep link (t.me/<bot>?start=test) — para probar el test en sí, hay que
tocar ese botón y completarlo en privado con el bot corriendo de verdad
(python testing_bot/bot.py).

Uso:
    cd bots && .venv/bin/python3 scripts/send_test_questions.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aiogram import Bot  # noqa: E402
from aiogram.client.default import DefaultBotProperties  # noqa: E402
from aiogram.enums import ParseMode  # noqa: E402

from history_bot.bot import BOT_TOKEN as HISTORY_TOKEN, GROUP_CHAT_ID, send_history_quiz  # noqa: E402
from vocabulary_bot.bot import BOT_TOKEN as VOCAB_TOKEN, send_word_quiz  # noqa: E402
from testing_bot.bot import BOT_TOKEN as TESTING_TOKEN, send_test_announcement  # noqa: E402


async def main() -> None:
    if not GROUP_CHAT_ID:
        print("GROUP_CHAT_ID no está configurado — no hay grupo al cual enviar.")
        return

    print(f"Enviando preguntas de prueba al grupo {GROUP_CHAT_ID}...\n")

    history_bot = Bot(HISTORY_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    try:
        await send_history_quiz(history_bot, GROUP_CHAT_ID)
        print("✓ history_bot   — poll de historia enviado (anónimo, como en la publicación diaria real)")
    finally:
        await history_bot.session.close()

    vocab_bot = Bot(VOCAB_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    try:
        await send_word_quiz(vocab_bot, GROUP_CHAT_ID)
        print("✓ vocabulary_bot — poll de palabra del día enviado")
    finally:
        await vocab_bot.session.close()

    testing_bot_instance = Bot(TESTING_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    try:
        await send_test_announcement(testing_bot_instance, GROUP_CHAT_ID)
        print("✓ testing_bot   — anuncio con botón de deep link enviado (real, igual que el post diario)")
    finally:
        await testing_bot_instance.session.close()

    print("\nListo. Revisa el canal en Telegram: randomización de opciones, formato, botón del anuncio "
          "y que el botón de comentarios aparezca bajo los pólls (requiere grupo de discusión enlazado "
          "al canal — configuración de Telegram, no del bot).")


if __name__ == "__main__":
    asyncio.run(main())
