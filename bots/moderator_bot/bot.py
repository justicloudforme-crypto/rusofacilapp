"""
RusoFásil — Moderator bot
=========================

Bot de moderación para el grupo de RusoFásil, en aiogram 3.x. Hace dos cosas:

  1. Da la bienvenida a cada nuevo miembro que se une al grupo.
  2. Filtra spam automáticamente: exceso de enlaces, palabras típicas de
     spam/estafas y flood (mandar muchos mensajes en poco tiempo). Los
     mensajes detectados se borran y el autor recibe una advertencia; tras
     acumular varias advertencias, se le expulsa (ban) del grupo.

El bot necesita ser administrador del grupo con permisos para borrar
mensajes y restringir/expulsar usuarios.

Configura el token en bots/.env (ver bots/.env.example) bajo la variable
MODERATOR_BOT_TOKEN. Para ejecutar:
    pip install -r ../requirements.txt
    python bot.py
"""

import asyncio
import logging
import re
from collections import defaultdict, deque
from datetime import datetime, timedelta
from pathlib import Path

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatMemberStatus, ChatType, ParseMode
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command
from aiogram.types import ChatPermissions, Message
from dotenv import load_dotenv

import os

# =============================================================================
# CONFIG
# =============================================================================

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
BOT_TOKEN = os.environ["MODERATOR_BOT_TOKEN"]

# Cuántas advertencias puede acumular un usuario antes de ser expulsado
WARN_LIMIT = 3

# Control de flood: más de FLOOD_MAX_MESSAGES mensajes en FLOOD_WINDOW_SECONDS
# se considera flood y el usuario es silenciado temporalmente.
FLOOD_MAX_MESSAGES = 6
FLOOD_WINDOW_SECONDS = 10
FLOOD_MUTE_MINUTES = 10

# Un mensaje con MAX_LINKS enlaces o más se considera spam
MAX_LINKS = 2

# Palabras/frases típicas de spam o estafas (insensible a mayúsculas/acentos simples)
SPAM_KEYWORDS = [
    "ganancia garantizada",
    "gana dinero rápido",
    "inversión segura",
    "trabajo desde casa",
    "haz clic aquí",
    "criptomoneda gratis",
    "regalo gratis",
    "solo por hoy",
    "duplica tu dinero",
]

WELCOME_TEXT = (
    "¡Bienvenido/a a RusoFásil, {mention}! 🇷🇺\n\n"
    "Aquí aprendemos ruso juntos. Antes de empezar:\n"
    "• Preséntate si quieres — nadie muerde 🙂\n"
    "• Nada de spam, publicidad o enlaces no solicitados.\n"
    "• Respeta a los demás miembros del grupo.\n\n"
    "¡Disfruta tu paso por aquí!"
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("moderator_bot")

router = Router()

# =============================================================================
# ESTADO EN MEMORIA
# =============================================================================

# user_id -> número de advertencias acumuladas
warnings: dict[int, int] = defaultdict(int)

# user_id -> marcas de tiempo de sus últimos mensajes (para detectar flood)
message_times: dict[int, deque] = defaultdict(lambda: deque(maxlen=FLOOD_MAX_MESSAGES))

URL_PATTERN = re.compile(r"(https?://|www\.|t\.me/|@\w+\.\w)", re.IGNORECASE)


async def is_admin(bot: Bot, chat_id: int, user_id: int) -> bool:
    try:
        member = await bot.get_chat_member(chat_id, user_id)
    except TelegramBadRequest:
        return False
    return member.status in {ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.CREATOR}


def count_links(message: Message) -> int:
    count = 0
    for entity in message.entities or []:
        if entity.type in {"url", "text_link", "mention"}:
            count += 1
    if message.text:
        count += len(URL_PATTERN.findall(message.text))
    return count


def contains_spam_keywords(text: str) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in SPAM_KEYWORDS)


async def punish(message: Message, bot: Bot, reason: str) -> None:
    user_id = message.from_user.id
    try:
        await message.delete()
    except TelegramBadRequest:
        pass

    warnings[user_id] += 1
    count = warnings[user_id]

    if count >= WARN_LIMIT:
        try:
            await bot.ban_chat_member(chat_id=message.chat.id, user_id=user_id)
            await message.chat.send_message(
                f"🚫 {message.from_user.full_name} fue expulsado del grupo "
                f"tras acumular {WARN_LIMIT} advertencias ({reason})."
            )
        except TelegramBadRequest as e:
            logger.warning("No se pudo expulsar a %s: %s", user_id, e)
        warnings.pop(user_id, None)
    else:
        await message.chat.send_message(
            f"⚠️ {message.from_user.full_name}, tu mensaje fue eliminado ({reason}). "
            f"Advertencia {count}/{WARN_LIMIT}."
        )


# =============================================================================
# HANDLERS
# =============================================================================


@router.message(F.new_chat_members)
async def welcome_new_members(message: Message):
    for new_member in message.new_chat_members:
        if new_member.is_bot:
            continue
        mention = new_member.mention_html()
        await message.answer(WELCOME_TEXT.format(mention=mention))


@router.message(Command("warnings"), F.chat.type.in_({ChatType.GROUP, ChatType.SUPERGROUP}))
async def check_warnings(message: Message, bot: Bot):
    if not await is_admin(bot, message.chat.id, message.from_user.id):
        return
    if not message.reply_to_message:
        await message.reply("Responde con /warnings al mensaje de la persona que quieres consultar.")
        return
    target = message.reply_to_message.from_user
    count = warnings.get(target.id, 0)
    await message.reply(f"{target.full_name} tiene {count}/{WARN_LIMIT} advertencias.")


@router.message(F.chat.type.in_({ChatType.GROUP, ChatType.SUPERGROUP}), F.text)
async def moderate_message(message: Message, bot: Bot):
    if message.from_user.is_bot:
        return
    if await is_admin(bot, message.chat.id, message.from_user.id):
        return

    # 1. Flood: registrar la marca de tiempo y ver cuántos mensajes hay en la ventana
    now = datetime.now()
    times = message_times[message.from_user.id]
    times.append(now)
    if len(times) == FLOOD_MAX_MESSAGES and (now - times[0]) <= timedelta(seconds=FLOOD_WINDOW_SECONDS):
        try:
            await bot.restrict_chat_member(
                chat_id=message.chat.id,
                user_id=message.from_user.id,
                permissions=ChatPermissions(can_send_messages=False),
                until_date=now + timedelta(minutes=FLOOD_MUTE_MINUTES),
            )
            await message.chat.send_message(
                f"🔇 {message.from_user.full_name} fue silenciado {FLOOD_MUTE_MINUTES} minutos por flood."
            )
        except TelegramBadRequest as e:
            logger.warning("No se pudo silenciar a %s: %s", message.from_user.id, e)
        times.clear()
        return

    # 2. Exceso de enlaces
    if count_links(message) >= MAX_LINKS:
        await punish(message, bot, "demasiados enlaces")
        return

    # 3. Palabras típicas de spam/estafa
    if contains_spam_keywords(message.text):
        await punish(message, bot, "contenido de spam")
        return


# =============================================================================
# MAIN
# =============================================================================


async def main():
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
