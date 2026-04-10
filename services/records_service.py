from __future__ import annotations

import os
from typing import TypeAlias

from config import Config
from models import SalaryData
from pdf_processor import build_save_path
from state import (
    AppState,
    get_salary_history,
    is_empty,
    load_state,
    remove_salary_records,
    save_state,
)

RecordTuple: TypeAlias = tuple[int, SalaryData, str]


def get_records(config: Config) -> list[RecordTuple]:
    """Return all records as (index, data, pdf_path) tuples."""
    state: AppState = load_state(config.state_file_path)
    history: list[SalaryData] = get_salary_history(state)
    return [(i, s, build_save_path(config, s)) for i, s in enumerate(history)]


def delete_record(config: Config, index: int) -> bool:
    """Delete a single record and its PDF. Returns True if the state file was fully wiped."""
    state: AppState = load_state(config.state_file_path)
    history: list[SalaryData] = get_salary_history(state)

    if index < 0 or index >= len(history):
        raise IndexError(f"Record index {index} out of range")

    path: str = build_save_path(config, history[index])
    if os.path.exists(path):
        os.remove(path)

    remove_salary_records(state, [index])
    return _persist_or_wipe(state, config)


def bulk_delete_records(config: Config, indices: list[int], delete_files: bool) -> bool:
    """Delete multiple records. Returns True if the state file was fully wiped."""
    state: AppState = load_state(config.state_file_path)
    history: list[SalaryData] = get_salary_history(state)

    if delete_files:
        for idx in indices:
            if 0 <= idx < len(history):
                path: str = build_save_path(config, history[idx])
                if os.path.exists(path):
                    os.remove(path)

    remove_salary_records(state, indices)
    return _persist_or_wipe(state, config)


def rename_record(config: Config, index: int, name: str) -> None:
    """Set or clear the custom label on a record."""
    state: AppState = load_state(config.state_file_path)
    history = state.get("salary_history", [])

    if index < 0 or index >= len(history):
        raise IndexError(f"Record index {index} out of range")

    history[index]["custom_name"] = name if name else None
    save_state(state, config.state_file_path)


def _persist_or_wipe(state: AppState, config: Config) -> bool:
    """Save state if records remain; delete the state file if empty. Returns True if wiped."""
    if is_empty(state):
        if os.path.exists(config.state_file_path):
            os.remove(config.state_file_path)
        return True
    save_state(state, config.state_file_path)
    return False
