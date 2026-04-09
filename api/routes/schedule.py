from __future__ import annotations

from fastapi import APIRouter

from api.schemas import ScheduleConfig
from api.scheduler import apply_schedule, load_schedule, save_schedule

router: APIRouter = APIRouter()


@router.get("/schedule")
def get_schedule() -> ScheduleConfig:
    return load_schedule()


@router.put("/schedule")
def update_schedule(body: ScheduleConfig) -> dict[str, str]:
    save_schedule(body)
    apply_schedule(body)
    return {"status": "saved"}
