from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from api.schemas import ScheduleConfig

logger: logging.Logger = logging.getLogger(__name__)

SCHEDULE_PATH: Path = Path(__file__).parent.parent / "schedule.json"
JOB_ID: str = "finbrief_pipeline"

_scheduler: BackgroundScheduler | None = None


def _run_pipeline_job() -> None:
    from main import run_pipeline
    try:
        run_pipeline()
    except Exception:
        logger.exception("Scheduled pipeline run failed")


def get_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler()
        _scheduler.start()
    return _scheduler


def load_schedule() -> ScheduleConfig:
    if not SCHEDULE_PATH.exists():
        return ScheduleConfig()
    try:
        data: dict = json.loads(SCHEDULE_PATH.read_text(encoding="utf-8"))
        return ScheduleConfig.model_validate(data)
    except (json.JSONDecodeError, Exception):
        return ScheduleConfig()


def save_schedule(config: ScheduleConfig) -> None:
    SCHEDULE_PATH.write_text(
        json.dumps(config.model_dump(), indent=2),
        encoding="utf-8",
    )


def apply_schedule(config: ScheduleConfig) -> None:
    scheduler: BackgroundScheduler = get_scheduler()

    if scheduler.get_job(JOB_ID):
        scheduler.remove_job(JOB_ID)

    if config.enabled:
        trigger: CronTrigger = CronTrigger(
            day=config.day_of_month,
            hour=config.hour,
            minute=config.minute,
        )
        scheduler.add_job(
            _run_pipeline_job,
            trigger=trigger,
            id=JOB_ID,
            replace_existing=True,
        )
        logger.info(
            "Scheduled pipeline: day=%d, time=%02d:%02d",
            config.day_of_month,
            config.hour,
            config.minute,
        )
    else:
        logger.info("Pipeline schedule disabled")


def init_scheduler() -> None:
    config: ScheduleConfig = load_schedule()
    if config.enabled:
        apply_schedule(config)


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
