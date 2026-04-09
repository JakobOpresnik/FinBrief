from __future__ import annotations

import os
from collections import deque

from fastapi import APIRouter, Query

router: APIRouter = APIRouter()

LOG_FILE: str = "finbrief.log"


@router.get("/logs")
def get_logs(lines: int = Query(default=100, ge=1, le=1000)) -> dict[str, str]:
    if not os.path.exists(LOG_FILE):
        return {"logs": ""}

    with open(LOG_FILE, "r", encoding="utf-8") as f:
        last_lines: deque[str] = deque(f, maxlen=lines)

    return {"logs": "".join(last_lines)}
