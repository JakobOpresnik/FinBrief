from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True)
class Config:
    # Gmail (IMAP)
    gmail_address: str
    gmail_app_password: str
    gmail_sender_filter: str
    gmail_subject_keyword: str

    # PDF
    pdf_password: str | None

    # Storage
    save_base_path: str
    employee_name: str
    employee_surname: str
    filename_pattern: str

    # LLM (llama.cpp)
    llm_model_path: str
    llm_gpu_layers: int

    # ntfy.sh
    ntfy_topic: str

    # State
    state_file_path: str

    @classmethod
    def load(cls, env_path: str | None = None) -> Config:
        load_dotenv(env_path or Path(__file__).parent / ".env", override=True)

        return cls(
            gmail_address=_require("GMAIL_ADDRESS"),
            gmail_app_password=_require("GMAIL_APP_PASSWORD"),
            gmail_sender_filter=_require("GMAIL_SENDER_FILTER"),
            gmail_subject_keyword=os.getenv("GMAIL_SUBJECT_KEYWORD", "Plača za mesec"),
            pdf_password=os.getenv("PDF_PASSWORD") or None,
            save_base_path=os.getenv("SAVE_BASE_PATH", r"C:\Acex\zaposlitev\placa"),
            employee_name=_require("EMPLOYEE_NAME"),
            employee_surname=_require("EMPLOYEE_SURNAME"),
            filename_pattern=os.getenv("FILENAME_PATTERN", "{name}_{surname}_placilna_lista_{month}_{year}"),
            llm_model_path=_require("LLM_MODEL_PATH"),
            llm_gpu_layers=int(os.getenv("LLM_GPU_LAYERS", "-1")),
            ntfy_topic=_require("NTFY_TOPIC"),
            state_file_path=os.getenv("STATE_FILE_PATH", "processed_emails.json"),
        )
