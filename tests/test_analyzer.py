from __future__ import annotations

import pytest

from models import SalaryData
from ai_analyzer import _validate_and_fix, detect_anomalies


def _salary(**kwargs) -> SalaryData:
    defaults = dict(
        net_pay=1200.0,
        gross_pay=1600.0,
        month=1,
        year=2025,
        month_name_slovenian="januar",
        deductions={},
        bonuses={},
        total_deductions=0.0,
        total_bonuses=0.0,
    )
    defaults.update(kwargs)
    return SalaryData(**defaults)


class TestValidateAndFix:
    def test_swapped_net_gross_corrected(self):
        data = _salary(net_pay=1600.0, gross_pay=1200.0)
        fixed = _validate_and_fix(data)
        assert fixed.net_pay == 1200.0
        assert fixed.gross_pay == 1600.0

    def test_correct_net_gross_unchanged(self):
        data = _salary(net_pay=1200.0, gross_pay=1600.0)
        fixed = _validate_and_fix(data)
        assert fixed.net_pay == 1200.0
        assert fixed.gross_pay == 1600.0

    def test_subtotal_stripped_from_bonuses(self):
        data = _salary(
            bonuses={"Prevoz": 50.0, "Skupaj pribitki": 50.0},
            total_bonuses=50.0,
        )
        fixed = _validate_and_fix(data)
        assert "Skupaj pribitki" not in fixed.bonuses
        assert "Prevoz" in fixed.bonuses

    def test_subtotal_stripped_from_deductions(self):
        data = _salary(
            deductions={"Dohodnina": 200.0, "Skupaj prispevki delavca": 200.0},
            total_deductions=200.0,
        )
        fixed = _validate_and_fix(data)
        assert "Skupaj prispevki delavca" not in fixed.deductions
        assert "Dohodnina" in fixed.deductions

    def test_bonus_total_recalculated_after_strip(self):
        data = _salary(
            bonuses={"Prevoz": 50.0, "Prehrana": 80.0},
            total_bonuses=0.0,  # wrong — should be recalculated
        )
        fixed = _validate_and_fix(data)
        assert fixed.total_bonuses == 130.0

    def test_deduction_total_recalculated_after_strip(self):
        data = _salary(
            deductions={"Dohodnina": 200.0, "Pokojnina": 150.0},
            total_deductions=0.0,  # wrong
        )
        fixed = _validate_and_fix(data)
        assert fixed.total_deductions == 350.0


class TestDetectAnomalies:
    def test_no_history_returns_first_record_note(self):
        report = detect_anomalies(_salary(), history=[])
        assert not report.has_anomalies
        assert any("First" in a for a in report.anomalies)

    def test_net_pay_deviation_above_threshold_flagged(self):
        history = [_salary(net_pay=1000.0) for _ in range(3)]
        current = _salary(net_pay=1200.0)  # 20% above average
        report = detect_anomalies(current, history)
        assert report.has_anomalies
        assert any("Net pay" in a for a in report.anomalies)

    def test_net_pay_deviation_within_threshold_not_flagged(self):
        history = [_salary(net_pay=1000.0) for _ in range(3)]
        current = _salary(net_pay=1050.0)  # 5% — within 10% threshold
        report = detect_anomalies(current, history)
        assert not any("Net pay" in a for a in report.anomalies)

    def test_gross_pay_deviation_flagged(self):
        history = [_salary(gross_pay=1600.0) for _ in range(3)]
        current = _salary(gross_pay=1900.0)  # ~19% above average
        report = detect_anomalies(current, history)
        assert report.has_anomalies
        assert any("Gross pay" in a for a in report.anomalies)

    def test_new_deduction_category_flagged(self):
        history = [_salary(deductions={"Dohodnina": 200.0}) for _ in range(3)]
        current = _salary(deductions={"Dohodnina": 200.0, "Nova postavka": 50.0})
        report = detect_anomalies(current, history)
        assert report.has_anomalies
        assert any("Nova postavka" in a for a in report.anomalies)

    def test_deduction_spike_flagged(self):
        history = [_salary(deductions={"Dohodnina": 100.0}) for _ in range(3)]
        current = _salary(deductions={"Dohodnina": 200.0})  # 100% spike — above 50% threshold
        report = detect_anomalies(current, history)
        assert report.has_anomalies
        assert any("Dohodnina" in a for a in report.anomalies)

    def test_deduction_below_spike_threshold_not_flagged(self):
        history = [_salary(deductions={"Dohodnina": 100.0}) for _ in range(3)]
        current = _salary(deductions={"Dohodnina": 140.0})  # 40% — below 50% threshold
        report = detect_anomalies(current, history)
        assert not any("Dohodnina" in a for a in report.anomalies)

    def test_no_anomalies_for_stable_values(self):
        history = [_salary(net_pay=1200.0, gross_pay=1600.0) for _ in range(3)]
        current = _salary(net_pay=1210.0, gross_pay=1610.0)
        report = detect_anomalies(current, history)
        assert not report.has_anomalies
