"""
RusoFásil — Notifier bot (rusofasil_alert_bot)
=================================================

Bot para avisar a la comunidad de RusoFásil sobre novedades: lecciones
nuevas, actualizaciones del sitio, anuncios generales, etc.

Funcionamiento:
  - Cualquier usuario que le escriba /start al bot en privado queda
    suscrito a las notificaciones (puede darse de baja con /baja).
  - Solo los administradores configurados en ADMIN_IDS pueden usar
    /anunciar <texto> (en chat privado con el bot) para difundir un
    mensaje: se publica en el grupo de RusoFásil y se envía por DM a
    cada suscriptor.

La lista de suscriptores se guarda en data/subscribers.json para que
sobreviva a reinicios del bot.

Configura el token en bots/.env bajo NOTIFIER_BOT_TOKEN. Antes de arrancar,
completa ADMIN_IDS (tus user id de Telegram) y GROUP_CHAT_ID abajo.

Para ejecutar:
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
from aiogram.exceptions import TelegramForbiddenError
from aiogram.filters import Command, CommandObject
from aiogram.types import Message
from dotenv import load_dotenv

# =============================================================================
# CONFIG
# =============================================================================

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
BOT_TOKEN = os.environ["NOTIFIER_BOT_TOKEN"]

# Telegram user id de quienes pueden enviar anuncios con /anunciar
ADMIN_IDS: list[int] = [7290127856]

# id del grupo de RusoFásil donde también se publican los anuncios (además
# de enviarlos por DM a cada suscriptor). Déjalo en 0 para desactivar la
# publicación en grupo y avisar solo por DM.
GROUP_CHAT_ID = -1003668895078

SUBSCRIBERS_FILE = Path(__file__).resolve().parent / "data" / "subscribers.json"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("notifier_bot")

router = Router()


# =============================================================================
# SUSCRIPTORES (persistidos en disco)
# =============================================================================


def load_subscribers() -> set[int]:
    if not SUBSCRIBERS_FILE.exists():
        return set()
    with SUBSCRIBERS_FILE.open(encoding="utf-8") as f:
        return set(json.load(f))


def save_subscribers(subscribers: set[int]) -> None:
    SUBSCRIBERS_FILE.parent.mkdir(exist_ok=True)
    with SUBSCRIBERS_FILE.open("w", encoding="utf-8") as f:
        json.dump(sorted(subscribers), f)


subscribers: set[int] = load_subscribers()


# =============================================================================
# HANDLERS
# =============================================================================


@router.message(Command("start"), F.chat.type == ChatType.PRIVATE)
async def start_handler(message: Message):
    is_new = message.from_user.id not in subscribers
    subscribers.add(message.from_user.id)
    save_subscribers(subscribers)

    if is_new:
        await message.answer(
            "¡Hola! Soy el bot de notificaciones de RusoFásil 🔔\n"
            "Te avisaré aquí cuando haya lecciones nuevas o novedades del sitio.\n"
            "Si en algún momento quieres dejar de recibir avisos, usa /baja."
        )
    else:
        await message.answer("Ya estabas suscrito/a a las notificaciones de RusoFásil 🔔")


@router.message(Command("baja"), F.chat.type == ChatType.PRIVATE)
async def unsubscribe_handler(message: Message):
    if message.from_user.id in subscribers:
        subscribers.discard(message.from_user.id)
        save_subscribers(subscribers)
        await message.answer("Listo, ya no recibirás notificaciones de RusoFásil. Puedes volver con /start cuando quieras.")
    else:
        await message.answer("No estabas suscrito/a a las notificaciones.")


@router.message(Command("anunciar"), F.chat.type == ChatType.PRIVATE)
async def announce_handler(message: Message, command: CommandObject, bot: Bot):
    if message.from_user.id not in ADMIN_IDS:
        return

    text = command.args
    if not text:
        await message.answer("Uso: /anunciar <texto del anuncio>")
        return

    announcement = f"📢 <b>RusoFásil</b>\n\n{text}"

    sent, failed = 0, 0
    for user_id in list(subscribers):
        try:
            await bot.send_message(user_id, announcement)
            sent += 1
        except TelegramForbiddenError:
            # El usuario bloqueó al bot: lo quitamos de la lista de suscriptores
            subscribers.discard(user_id)
            failed += 1

    if failed:
        save_subscribers(subscribers)

    if GROUP_CHAT_ID:
        await bot.send_message(GROUP_CHAT_ID, announcement)

    await message.answer(
        f"Anuncio enviado a {sent} suscriptor(es)"
        f"{f', {failed} ya no disponibles (removidos)' if failed else ''}"
        f"{' y publicado en el grupo' if GROUP_CHAT_ID else ''}."
    )


@router.message(Command("suscriptores"), F.chat.type == ChatType.PRIVATE)
async def subscriber_count_handler(message: Message):
    if message.from_user.id not in ADMIN_IDS:
        return
    await message.answer(f"Suscriptores actuales: {len(subscribers)}")


# =============================================================================
# MAIN
# =============================================================================


async def main():
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)

    if not ADMIN_IDS:
        logger.warning("ADMIN_IDS vacío: nadie podrá usar /anunciar hasta que lo configures.")

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
