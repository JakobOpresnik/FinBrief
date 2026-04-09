from __future__ import annotations

from pydantic import BaseModel


class SalaryRecord(BaseModel):
    index: int
    net_pay: float
    gross_pay: float
    take_home: float
    month: int
    year: int
    month_name_slovenian: str
    deductions: dict[str, float]
    bonuses: dict[str, float]
    total_deductions: float
    total_bonuses: float
    has_pdf: bool = False
    custom_name: str | None = None


class PipelineStatus(BaseModel):
    running: bool
    last_run: str | None = None
    last_result: str | None = None
    started_at: str | None = None


class ScheduleConfig(BaseModel):
    enabled: bool = False
    day_of_month: int = 15
    hour: int = 9
    minute: int = 0


class SettingsResponse(BaseModel):
    values: dict[str, str]
    masked_keys: list[str]


class SettingsUpdate(BaseModel):
    values: dict[str, str]
