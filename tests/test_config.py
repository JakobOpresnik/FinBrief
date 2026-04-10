from __future__ import annotations

import os
from unittest.mock import patch

import pytest


_BASE_ENV = {
    "GMAIL_ADDRESS": "test@gmail.com",
    "GMAIL_APP_PASSWORD": "xxxx xxxx xxxx xxxx",
    "GMAIL_SENDER_FILTER": "payroll@example.com",
    "EMPLOYEE_NAME": "John",
    "EMPLOYEE_SURNAME": "Doe",
    "LLM_MODEL_PATH": "models/test.gguf",
    "NTFY_TOPIC": "test-topic",
}

# Prevent load_dotenv from picking up the real .env during tests
_NO_ENV_FILE = "/nonexistent/.env"


def test_missing_gmail_address_raises():
    env = {k: v for k, v in _BASE_ENV.items() if k != "GMAIL_ADDRESS"}
    with patch.dict(os.environ, env, clear=True):
        from config import Config
        with pytest.raises(ValueError, match="GMAIL_ADDRESS"):
            Config.load(env_path=_NO_ENV_FILE)


def test_missing_employee_name_raises():
    env = {k: v for k, v in _BASE_ENV.items() if k != "EMPLOYEE_NAME"}
    with patch.dict(os.environ, env, clear=True):
        from config import Config
        with pytest.raises(ValueError, match="EMPLOYEE_NAME"):
            Config.load(env_path=_NO_ENV_FILE)


def test_optional_vars_use_defaults():
    with patch.dict(os.environ, _BASE_ENV, clear=True):
        from config import Config
        config = Config.load(env_path=_NO_ENV_FILE)

    assert config.gmail_subject_keyword == "Plača za mesec"
    assert config.pdf_password is None
    assert config.llm_gpu_layers == -1
    assert config.state_file_path == "processed_emails.json"


def test_pdf_password_none_when_blank():
    env = {**_BASE_ENV, "PDF_PASSWORD": ""}
    with patch.dict(os.environ, env, clear=True):
        from config import Config
        config = Config.load(env_path=_NO_ENV_FILE)

    assert config.pdf_password is None


def test_pdf_password_set_when_provided():
    env = {**_BASE_ENV, "PDF_PASSWORD": "secret123"}
    with patch.dict(os.environ, env, clear=True):
        from config import Config
        config = Config.load(env_path=_NO_ENV_FILE)

    assert config.pdf_password == "secret123"


def test_llm_gpu_layers_parsed_as_int():
    env = {**_BASE_ENV, "LLM_GPU_LAYERS": "32"}
    with patch.dict(os.environ, env, clear=True):
        from config import Config
        config = Config.load(env_path=_NO_ENV_FILE)

    assert config.llm_gpu_layers == 32
