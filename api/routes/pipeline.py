from __future__ import annotations

import threading
from datetime import datetime
from typing import TypedDict

from fastapi import APIRouter, HTTPException

from api.schemas import PipelineStatus

router: APIRouter = APIRouter()


class _PipelineStatus(TypedDict):
    running: bool
    last_run: str | None
    last_result: str | None
    started_at: str | None


_cancel_event: threading.Event = threading.Event()
_status: _PipelineStatus = {
    "running": False,
    "last_run": None,
    "last_result": None,
    "started_at": None,
}
_thread: threading.Thread | None = None


def _run_in_background() -> None:
    from main import setup_logging, run_pipeline

    _cancel_event.clear()
    try:
        setup_logging()
        run_pipeline(cancel_event=_cancel_event)
        if not _cancel_event.is_set():
            _status["last_result"] = "Pipeline completed successfully"
    except Exception as exc:
        if not _cancel_event.is_set():
            _status["last_result"] = f"Pipeline failed: {exc}"
    finally:
        _status["running"] = False
        _status["last_run"] = datetime.now().isoformat(timespec="seconds")


@router.post("/run-pipeline")
def trigger_pipeline() -> dict[str, str]:
    global _thread
    if _status["running"]:
        raise HTTPException(status_code=409, detail="Pipeline is already running")

    _status["running"] = True
    _status["started_at"] = datetime.now().isoformat(timespec="seconds")
    _thread = threading.Thread(target=_run_in_background, daemon=True)
    _thread.start()
    return {"status": "started"}


@router.post("/cancel-pipeline")
def cancel_pipeline() -> dict[str, str]:
    if not _status["running"] or _thread is None or not _thread.is_alive():
        raise HTTPException(status_code=409, detail="No pipeline is running")

    _cancel_event.set()
    _status["running"] = False
    _status["last_run"] = datetime.now().isoformat(timespec="seconds")
    _status["last_result"] = "Pipeline cancelled by user"
    return {"status": "cancelled"}


@router.delete("/logs")
def clear_logs() -> dict[str, str]:
    import os
    log_file: str = "finbrief.log"
    if os.path.exists(log_file):
        with open(log_file, "w", encoding="utf-8") as f:
            f.truncate(0)
    return {"status": "cleared"}


def reset_status() -> None:
    """Reset pipeline display state. Called when all records are deleted."""
    if not _status["running"]:
        _status["last_run"] = None
        _status["last_result"] = None
        _status["started_at"] = None


@router.post("/quit")
def quit_app() -> dict[str, str]:
    import os
    import threading
    threading.Thread(target=lambda: os._exit(0), daemon=True).start()
    return {"status": "quitting"}


@router.get("/pipeline-status")
def get_pipeline_status() -> PipelineStatus:
    return PipelineStatus(
        running=bool(_status["running"]),
        last_run=_status["last_run"],
        last_result=_status["last_result"],
        started_at=_status.get("started_at"),
    )
