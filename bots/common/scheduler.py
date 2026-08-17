"""
RusoFásil — helper compartido para programar publicaciones diarias en el grupo
=================================================================================

Centraliza el patrón que vocabulary_bot y history_bot ya usaban por separado
(AsyncIOScheduler + CronTrigger + misfire_grace_time=1h), para que cada bot
con una o más publicaciones diarias no tenga que repetirlo.
"""

import logging
from datetime import time as time_of_day
from typing import Awaitable, Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger("scheduler")

DailyJob = tuple[str, time_of_day, Callable[..., Awaitable[None]], list]


def start_daily_jobs(jobs: list[DailyJob]) -> AsyncIOScheduler:
    """jobs: lista de (job_id, hora_del_dia, func_async, args). Crea, registra
    y arranca el scheduler; lo devuelve para que el llamador lo mantenga vivo
    (basta con no dejarlo salir de scope mientras el bot corre)."""
    scheduler = AsyncIOScheduler()
    for job_id, at, func, args in jobs:
        scheduler.add_job(
            func,
            CronTrigger(hour=at.hour, minute=at.minute),
            args=args,
            id=job_id,
            misfire_grace_time=3600,
        )
        logger.info("Job '%s' programado para las %02d:%02d.", job_id, at.hour, at.minute)
    scheduler.start()
    return scheduler
