from __future__ import annotations

import io
import os

import pdfplumber
import pikepdf

from config import Config
from models import SLOVENIAN_MONTHS, SalaryData


class PDFDecryptionError(Exception):
    pass


class PDFTextExtractionError(Exception):
    pass


def decrypt_pdf(pdf_bytes: bytes, password: str) -> bytes:
    try:
        reader = pikepdf.open(io.BytesIO(pdf_bytes), password=password)
        output = io.BytesIO()
        reader.save(output)
        reader.close()
        return output.getvalue()
    except pikepdf.PasswordError as exc:
        raise PDFDecryptionError(f"Wrong PDF password: {exc}") from exc
    except pikepdf.PdfError as exc:
        raise PDFDecryptionError(f"Corrupt or unreadable PDF: {exc}") from exc


def extract_text(decrypted_pdf_bytes: bytes) -> str:
    pages_text: list[str] = []
    with pdfplumber.open(io.BytesIO(decrypted_pdf_bytes)) as pdf:
        for page in pdf.pages:
            text: str | None = page.extract_text(layout=True)
            if text:
                pages_text.append(text)

    full_text: str = "\n".join(pages_text).strip()
    if not full_text:
        raise PDFTextExtractionError("No text could be extracted from the PDF")
    return full_text


def build_save_path(config: Config, salary_data: SalaryData) -> str:
    month_name: str = salary_data.month_name_slovenian.lower()
    if not month_name:
        month_name = SLOVENIAN_MONTHS.get(salary_data.month, f"{salary_data.month:02d}")

    filename: str = config.filename_pattern.format(
        name=config.employee_name,
        surname=config.employee_surname,
        month=month_name,
        year=salary_data.year,
        month_num=f"{salary_data.month:02d}",
    ) + ".pdf"
    year_dir: str = os.path.join(config.save_base_path, str(salary_data.year))
    return os.path.join(year_dir, filename)


def save_pdf(pdf_bytes: bytes, config: Config, salary_data: SalaryData) -> str:
    file_path: str = build_save_path(config, salary_data)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)
    return file_path
