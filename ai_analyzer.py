from __future__ import annotations

import json
import logging
from pathlib import Path
from statistics import mean
from typing import Final

from llama_cpp import Llama

from config import Config
from models import AnalysisResult, AnomalyReport, SalaryData

logger: logging.Logger = logging.getLogger(__name__)

_model: Llama | None = None

EXTRACTION_PROMPT: Final[str] = (Path(__file__).parent / "prompts" / "salary_extraction.txt").read_text(encoding="utf-8")


def _get_model(config: Config) -> Llama:
    global _model
    if _model is None:
        logger.info("Loading model from %s...", config.llm_model_path)
        _model = Llama(
            model_path=config.llm_model_path,
            n_ctx=4096,
            n_gpu_layers=config.llm_gpu_layers,
            verbose=False,
        )
        logger.info("Model loaded")
    return _model


def _validate_and_fix(data: SalaryData) -> SalaryData:
    """Fix common extraction errors."""
    fixes: dict = data.model_dump()

    # Strip subtotal rows that the model may have accidentally included as line items
    _subtotal_keys = {"skupaj pribitki", "skupaj dodatki", "skupaj prispevki delavca", "skupaj odbitki"}
    fixes["bonuses"] = {k: v for k, v in data.bonuses.items() if k.lower() not in _subtotal_keys}
    fixes["deductions"] = {k: v for k, v in data.deductions.items() if k.lower() not in _subtotal_keys}

    # Recalculate totals from individual items
    if fixes["bonuses"]:
        fixes["total_bonuses"] = round(sum(fixes["bonuses"].values()), 2)
    if fixes["deductions"]:
        fixes["total_deductions"] = round(sum(fixes["deductions"].values()), 2)

    # If net > gross, they're probably swapped
    if fixes["net_pay"] > fixes["gross_pay"] and fixes["gross_pay"] > 0:
        fixes["net_pay"], fixes["gross_pay"] = fixes["gross_pay"], fixes["net_pay"]
        logger.warning("Swapped net/gross — model had them reversed")

    return SalaryData.model_validate(fixes)


def extract_salary_data(text: str, config: Config) -> SalaryData:
    model: Llama = _get_model(config)
    prompt: str = EXTRACTION_PROMPT + text + "\n---"

    response: dict = model.create_chat_completion(  # type: ignore[assignment]
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.0,
    )

    content: str | None = response["choices"][0]["message"]["content"]
    if content is None:
        raise ValueError("No content in model response")
    salary_data: SalaryData = SalaryData.model_validate(json.loads(content))
    salary_data = _validate_and_fix(salary_data)

    logger.info(
        "Extracted salary data: %s %d — Neto: %.2f, Bruto: %.2f",
        salary_data.month_name_slovenian,
        salary_data.year,
        salary_data.net_pay,
        salary_data.gross_pay,
    )
    return salary_data


def detect_anomalies(
    current: SalaryData,
    history: list[SalaryData],
) -> AnomalyReport:
    anomalies: list[str] = []

    if len(history) < 1:
        return AnomalyReport(has_anomalies=False, anomalies=["First salary record — no comparison available."])

    recent: list[SalaryData] = history[-3:]

    # Net pay deviation
    avg_net: float = mean(s.net_pay for s in recent)
    if avg_net > 0:
        net_deviation: float = abs(current.net_pay - avg_net) / avg_net
        if net_deviation > 0.10:
            direction: str = "above" if current.net_pay > avg_net else "below"
            anomalies.append(
                f"Net pay €{current.net_pay:.2f} is {net_deviation:.0%} {direction} "
                f"the recent average of €{avg_net:.2f}"
            )

    # Gross pay deviation
    avg_gross: float = mean(s.gross_pay for s in recent)
    if avg_gross > 0:
        gross_deviation: float = abs(current.gross_pay - avg_gross) / avg_gross
        if gross_deviation > 0.10:
            direction = "above" if current.gross_pay > avg_gross else "below"
            anomalies.append(
                f"Gross pay €{current.gross_pay:.2f} is {gross_deviation:.0%} {direction} "
                f"the recent average of €{avg_gross:.2f}"
            )

    # New deduction categories
    historical_deduction_keys: set[str] = set()
    for s in history:
        historical_deduction_keys.update(s.deductions.keys())
    new_deductions: set[str] = set(current.deductions.keys()) - historical_deduction_keys
    for key in new_deductions:
        anomalies.append(f"New deduction category: '{key}' (€{current.deductions[key]:.2f})")

    # Individual deduction spikes
    for key, amount in current.deductions.items():
        historical_amounts: list[float] = [
            s.deductions[key] for s in recent if key in s.deductions
        ]
        if historical_amounts:
            avg_deduction: float = mean(historical_amounts)
            if avg_deduction > 0 and amount > avg_deduction * 1.5:
                anomalies.append(
                    f"Deduction '{key}' is €{amount:.2f}, "
                    f"50%+ above recent average of €{avg_deduction:.2f}"
                )

    return AnomalyReport(has_anomalies=len(anomalies) > 0, anomalies=anomalies)


def build_summary(salary_data: SalaryData, anomaly_report: AnomalyReport) -> str:
    take_home: float = salary_data.net_pay + salary_data.total_bonuses
    summary: str = (
        f"Plačilna lista {salary_data.month_name_slovenian} {salary_data.year}: "
        f"Take-home €{take_home:,.2f} (Neto €{salary_data.net_pay:,.2f} + Dodatki €{salary_data.total_bonuses:,.2f}), "
        f"Bruto €{salary_data.gross_pay:,.2f}."
    )
    if anomaly_report.has_anomalies:
        summary += f" ⚠ {len(anomaly_report.anomalies)} anomaly(ies) detected."
    return summary


def analyze(
    text: str,
    config: Config,
    history: list[SalaryData],
) -> AnalysisResult:
    salary_data: SalaryData = extract_salary_data(text, config)
    anomaly_report: AnomalyReport = detect_anomalies(salary_data, history)
    summary: str = build_summary(salary_data, anomaly_report)

    return AnalysisResult(
        salary_data=salary_data,
        anomaly_report=anomaly_report,
        summary=summary,
    )
