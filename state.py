from __future__ import annotations

import json
import os
import tempfile
from typing import Any

from models import SalaryData


def load_state(state_file: str) -> dict[str, Any]:
    if not os.path.exists(state_file):
        return {"processed_ids": [], "salary_history": []}
    try:
        with open(state_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {"processed_ids": [], "salary_history": []}


def save_state(state: dict[str, Any], state_file: str) -> None:
    dir_name: str = os.path.dirname(os.path.abspath(state_file))
    fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, state_file)
    except BaseException:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def is_processed(state: dict[str, Any], email_id: str) -> bool:
    return email_id in state["processed_ids"]


def mark_processed(
    state: dict[str, Any],
    email_id: str,
    salary_data: SalaryData | None = None,
    raw_text: str | None = None,
) -> None:
    if email_id not in state["processed_ids"]:
        state["processed_ids"].append(email_id)
    if salary_data is not None:
        entry: dict[str, Any] = salary_data.model_dump()
        if raw_text is not None:
            entry["_raw_text"] = raw_text
        state["salary_history"].append(entry)


def get_salary_history(state: dict[str, Any]) -> list[SalaryData]:
    return [SalaryData.model_validate(entry) for entry in state.get("salary_history", [])]


def remove_salary_records(state: dict[str, Any], indices: list[int]) -> None:
    history: list[dict] = state.get("salary_history", [])
    processed_ids: list[str] = state.get("processed_ids", [])
    for idx in sorted(indices, reverse=True):
        if 0 <= idx < len(history):
            history.pop(idx)
        if 0 <= idx < len(processed_ids):
            processed_ids.pop(idx)
    state["salary_history"] = history
    state["processed_ids"] = processed_ids


def is_empty(state: dict[str, Any]) -> bool:
    return len(state.get("salary_history", [])) == 0 and len(state.get("processed_ids", [])) == 0
