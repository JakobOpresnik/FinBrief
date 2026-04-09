from __future__ import annotations

import logging

import requests

from config import Config
from models import AnalysisResult

logger: logging.Logger = logging.getLogger(__name__)


def send_notification(title: str, message: str, config: Config) -> bool:
    response: requests.Response = requests.post(
        "https://ntfy.sh/",
        json={
            "topic": config.ntfy_topic,
            "title": title,
            "message": message,
            "tags": ["moneybag"],
        },
        timeout=15,
    )

    if response.ok:
        logger.info("ntfy notification sent successfully")
        return True

    logger.error("ntfy error %d: %s", response.status_code, response.text)
    return False


def format_notification(result: AnalysisResult, saved_path: str) -> tuple[str, str]:
    sd = result.salary_data
    title: str = f"Plačilna lista — {sd.month_name_slovenian.capitalize()} {sd.year}"

    take_home: float = sd.net_pay + sd.total_bonuses
    lines: list[str] = [
        f"Your take-home pay: €{take_home:,.2f}",
        f"Net: €{sd.net_pay:,.2f} + Bonuses: €{sd.total_bonuses:,.2f}",
        f"Gross: €{sd.gross_pay:,.2f}",
        f"Document saved to: {saved_path}",
    ]

    if result.anomaly_report.has_anomalies:
        for anomaly in result.anomaly_report.anomalies:
            lines.append(f"⚠ {anomaly}")

    return title, "\n".join(lines)


def notify(result: AnalysisResult, saved_path: str, config: Config) -> bool:
    title, message = format_notification(result, saved_path)
    return send_notification(title, message, config)
