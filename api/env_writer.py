from __future__ import annotations

import os
import tempfile
from pathlib import Path

ENV_PATH: Path = Path(__file__).parent.parent / ".env"

MASKED_VALUE: str = "••••••••"
SENSITIVE_KEYS: set[str] = {"GMAIL_APP_PASSWORD", "PDF_PASSWORD"}


def read_env() -> dict[str, str]:
    values: dict[str, str] = {}
    if not ENV_PATH.exists():
        return values
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip()
    return values


def write_env(updates: dict[str, str]) -> None:
    lines: list[str] = []
    seen_keys: set[str] = set()

    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            stripped: str = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                key: str = stripped.partition("=")[0].strip()
                if key in updates:
                    # Skip masked values — preserve original
                    if updates[key] == MASKED_VALUE:
                        lines.append(line)
                    else:
                        lines.append(f"{key}={updates[key]}")
                    seen_keys.add(key)
                else:
                    lines.append(line)
            else:
                lines.append(line)

    # Add any new keys not already in the file
    for key, value in updates.items():
        if key not in seen_keys and value != MASKED_VALUE:
            lines.append(f"{key}={value}")

    content: str = "\n".join(lines) + "\n"

    # Atomic write
    dir_name: str = str(ENV_PATH.parent)
    fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp_path, str(ENV_PATH))
    except BaseException:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def get_masked_env() -> tuple[dict[str, str], list[str]]:
    values: dict[str, str] = read_env()
    # No masking — this is a local desktop app, passwords are visible to the user
    return values, []
