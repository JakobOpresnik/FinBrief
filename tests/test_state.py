from __future__ import annotations

import pytest

from models import SalaryData
from state import (
    get_salary_history,
    is_empty,
    is_processed,
    load_state,
    mark_processed,
    remove_salary_records,
    save_state,
)


def _sample_salary(**kwargs) -> SalaryData:
    defaults = dict(
        net_pay=1200.0,
        gross_pay=1600.0,
        month=1,
        year=2025,
        month_name_slovenian="januar",
    )
    defaults.update(kwargs)
    return SalaryData(**defaults)


def test_load_missing_file():
    state = load_state("/nonexistent/path/state.json")
    assert state == {"processed_ids": [], "salary_history": []}


def test_load_corrupt_json(tmp_path):
    bad_file = tmp_path / "state.json"
    bad_file.write_text("not valid json {{ broken", encoding="utf-8")
    state = load_state(str(bad_file))
    assert state == {"processed_ids": [], "salary_history": []}


def test_save_and_reload(tmp_path):
    state_file = str(tmp_path / "state.json")
    state = {"processed_ids": ["abc123"], "salary_history": []}
    save_state(state, state_file)
    reloaded = load_state(state_file)
    assert reloaded == state


def test_mark_and_check_processed():
    state = {"processed_ids": [], "salary_history": []}
    assert not is_processed(state, "email-1")
    mark_processed(state, "email-1")
    assert is_processed(state, "email-1")


def test_mark_processed_duplicate_ignored():
    state = {"processed_ids": [], "salary_history": []}
    mark_processed(state, "email-1")
    mark_processed(state, "email-1")
    assert state["processed_ids"].count("email-1") == 1


def test_mark_processed_stores_salary_data():
    state = {"processed_ids": [], "salary_history": []}
    salary = _sample_salary()
    mark_processed(state, "email-1", salary_data=salary)
    history = get_salary_history(state)
    assert len(history) == 1
    assert history[0].net_pay == 1200.0
    assert history[0].month_name_slovenian == "januar"


def test_remove_salary_records():
    state = {
        "processed_ids": ["a", "b", "c"],
        "salary_history": [{"net_pay": 1.0, "gross_pay": 2.0, "month": 1, "year": 2025, "month_name_slovenian": "januar"},
                           {"net_pay": 2.0, "gross_pay": 3.0, "month": 2, "year": 2025, "month_name_slovenian": "februar"},
                           {"net_pay": 3.0, "gross_pay": 4.0, "month": 3, "year": 2025, "month_name_slovenian": "marec"}],
    }
    remove_salary_records(state, [1])
    assert len(state["salary_history"]) == 2
    assert len(state["processed_ids"]) == 2
    assert state["processed_ids"] == ["a", "c"]


def test_remove_multiple_records_in_order():
    state = {
        "processed_ids": ["a", "b", "c"],
        "salary_history": [{"net_pay": 1.0, "gross_pay": 2.0, "month": 1, "year": 2025, "month_name_slovenian": "januar"},
                           {"net_pay": 2.0, "gross_pay": 3.0, "month": 2, "year": 2025, "month_name_slovenian": "februar"},
                           {"net_pay": 3.0, "gross_pay": 4.0, "month": 3, "year": 2025, "month_name_slovenian": "marec"}],
    }
    remove_salary_records(state, [0, 2])
    assert len(state["salary_history"]) == 1
    assert state["processed_ids"] == ["b"]


def test_is_empty_true():
    assert is_empty({"processed_ids": [], "salary_history": []})


def test_is_empty_false_with_id():
    assert not is_empty({"processed_ids": ["x"], "salary_history": []})


def test_is_empty_false_with_history():
    assert not is_empty({"processed_ids": [], "salary_history": [{"net_pay": 1.0}]})
