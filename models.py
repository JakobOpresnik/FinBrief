from __future__ import annotations

from typing import Final

from pydantic import BaseModel


SLOVENIAN_MONTHS: Final[dict[int, str]] = {
    1: "januar",
    2: "februar",
    3: "marec",
    4: "april",
    5: "maj",
    6: "junij",
    7: "julij",
    8: "avgust",
    9: "september",
    10: "oktober",
    11: "november",
    12: "december",
}


class SalaryData(BaseModel):
    net_pay: float
    gross_pay: float
    month: int
    year: int
    month_name_slovenian: str
    deductions: dict[str, float] = {}
    bonuses: dict[str, float] = {}
    total_deductions: float = 0.0
    total_bonuses: float = 0.0
    custom_name: str | None = None


class AnomalyReport(BaseModel):
    has_anomalies: bool = False
    anomalies: list[str] = []


class AnalysisResult(BaseModel):
    salary_data: SalaryData
    anomaly_report: AnomalyReport
    summary: str
