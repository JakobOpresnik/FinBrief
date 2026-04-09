from __future__ import annotations

import json
import logging
from statistics import mean

from llama_cpp import Llama

from config import Config
from models import AnalysisResult, AnomalyReport, SalaryData

logger: logging.Logger = logging.getLogger(__name__)

_model: Llama | None = None

EXTRACTION_PROMPT: str = """\
You are an expert Slovenian payroll document parser. Extract salary data from the payslip text below.

== BONUSES (pribitki / dodatki) — CRITICAL RULES ==
The payslip has a clearly delimited bonuses section. It ends with a subtotal line such as:
  "Skupaj pribitki" or "Skupaj dodatki" followed by the total amount.

You MUST:
1. Find the "Skupaj pribitki" subtotal line and read its amount — that is total_bonuses.
2. Only include in "bonuses" the individual line items that appear ABOVE that subtotal line.
   Typical items are "Povračilo stroškov do uredbe vlade – prevoz" (transport) and
   "Povračilo stroškov do uredbe vlade – prehrana" (meals), but extract whatever IS there.
3. CRITICAL: Do NOT include the subtotal line itself ("Skupaj pribitki" / "Skupaj dodatki") as an
   entry in the bonuses object. It is only used to set total_bonuses.
4. VERIFY: the sum of all bonuses values must equal total_bonuses exactly. If it does not, recheck
   your extracted items — you likely included the subtotal line as an item by mistake.
5. NEVER add any bonus that is not in that section. Do NOT include "Regres", "Dodatek za delovno dobo",
   or any other item unless it is literally listed in the pribitki section of this specific document.
6. If the pribitki section is absent or the total is 0, set bonuses to {} and total_bonuses to 0.0.

== DEDUCTIONS (odbitki / prispevki delojemalca) — CRITICAL RULES ==
The payslip has a clearly delimited deductions section. It typically ends with a subtotal such as:
  "Skupaj prispevki delavca" or "Skupaj odbitki" followed by the total.

You MUST:
1. Find that subtotal line — that is total_deductions.
2. Only include in "deductions" the individual line items that appear in that section and add up to it.
   Do NOT include the subtotal line itself (e.g. "Skupaj prispevki delavca") as a separate entry.
3. Do NOT include employer contributions or any amounts outside the employee deductions section.

== FIELD RECOGNITION GUIDE ==
- BRUTO PLAČA / Bruto znesek = gross_pay
- NETO PLAČA / Neto znesek / Za izplačilo = net_pay (must be LESS than gross_pay)
- Akontacija dohodnine / Dohodnina = income tax deduction
- Prispevek za pokojninsko in invalidsko zavarovanje = pension contribution
- Prispevek za zdravstveno zavarovanje = health insurance contribution
- Prispevek za zaposlovanje = employment contribution
- Prispevek za starševsko varstvo = parental protection contribution
- Prispevek za dolgotrajno oskrbo = long-term care contribution

Return ONLY a JSON object with these exact fields:
- net_pay: float
- gross_pay: float
- month: int — from the pay PERIOD, not the issue date
- year: int
- month_name_slovenian: string — lowercase (januar, februar, marec, april, maj, junij, julij, avgust, september, oktober, november, december)
- deductions: object — keys are item names, values are amounts
- bonuses: object — keys are item names, values are amounts
- total_deductions: float — must equal sum of deductions values
- total_bonuses: float — must equal sum of bonuses values (verify against "Skupaj pribitki")

General rules:
- All amounts must be floats, never strings
- ONLY include what is literally written in the document — do NOT infer or fabricate
- If a value cannot be read with certainty, use 0.0

Payslip text:
---
"""


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
