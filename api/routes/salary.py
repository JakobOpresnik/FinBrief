from __future__ import annotations

import os
import subprocess
import threading

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from api.schemas import SalaryRecord
from config import Config
from models import SalaryData
from pdf_processor import build_save_path, decrypt_pdf, is_pdf_encrypted, PDFDecryptionError
from state import get_salary_history, is_empty, load_state, remove_salary_records, save_state

router: APIRouter = APIRouter()


def _get_records() -> list[tuple[int, SalaryData, str]]:
    config: Config = Config.load()
    state = load_state(config.state_file_path)
    history: list[SalaryData] = get_salary_history(state)

    result: list[tuple[int, SalaryData, str]] = []
    for i, s in enumerate(history):
        path: str = build_save_path(config, s)
        result.append((i, s, path))
    return result


@router.get("/salary-history")
def get_salary_history_route() -> list[SalaryRecord]:
    records: list[SalaryRecord] = []
    for i, s, path in _get_records():
        records.append(SalaryRecord(
            index=i,
            net_pay=s.net_pay,
            gross_pay=s.gross_pay,
            take_home=s.net_pay + s.total_bonuses,
            month=s.month,
            year=s.year,
            month_name_slovenian=s.month_name_slovenian,
            deductions=s.deductions,
            bonuses=s.bonuses,
            total_deductions=s.total_deductions,
            total_bonuses=s.total_bonuses,
            has_pdf=os.path.exists(path),
            custom_name=s.custom_name,
        ))

    records.reverse()
    return records


@router.get("/salary/{index}/raw")
def get_salary_raw(index: int) -> dict:
    config: Config = Config.load()
    state = load_state(config.state_file_path)
    history: list[dict] = state.get("salary_history", [])
    processed_ids: list[str] = state.get("processed_ids", [])

    if index < 0 or index >= len(history):
        raise HTTPException(status_code=404, detail="Record not found")

    return {
        "index": index,
        "email_id": processed_ids[index] if index < len(processed_ids) else None,
        "salary_data": history[index],
    }


class PdfUnlockRequest(BaseModel):
    password: str | None = None


class DeleteRequest(BaseModel):
    indices: list[int]
    delete_files: bool = False


@router.delete("/salary/{index}")
def delete_salary_record(index: int) -> dict[str, str]:
    config: Config = Config.load()
    state = load_state(config.state_file_path)
    history = get_salary_history(state)

    if index < 0 or index >= len(history):
        raise HTTPException(status_code=404, detail="Record not found")

    path: str = build_save_path(config, history[index])
    if os.path.exists(path):
        os.remove(path)

    remove_salary_records(state, [index])
    if is_empty(state):
        if os.path.exists(config.state_file_path):
            os.remove(config.state_file_path)
        from api.routes.pipeline import reset_status
        reset_status()
    else:
        save_state(state, config.state_file_path)
    return {"status": "deleted"}


@router.post("/salary/bulk-delete")
def bulk_delete_salary_records(body: DeleteRequest) -> dict[str, str]:
    config: Config = Config.load()
    state = load_state(config.state_file_path)
    history = get_salary_history(state)

    if body.delete_files:
        for idx in body.indices:
            if 0 <= idx < len(history):
                path: str = build_save_path(config, history[idx])
                if os.path.exists(path):
                    os.remove(path)

    remove_salary_records(state, body.indices)
    if is_empty(state):
        if os.path.exists(config.state_file_path):
            os.remove(config.state_file_path)
        from api.routes.pipeline import reset_status
        reset_status()
    else:
        save_state(state, config.state_file_path)
    n = len(body.indices)
    return {"status": f"deleted {n} {'record' if n == 1 else 'records'}"}


class RenameRequest(BaseModel):
    name: str


@router.put("/salary/{index}/name")
def rename_salary_record(index: int, body: RenameRequest) -> dict[str, str]:
    config: Config = Config.load()
    state = load_state(config.state_file_path)
    history: list[dict] = state.get("salary_history", [])
    if index < 0 or index >= len(history):
        raise HTTPException(status_code=404, detail="Record not found")
    name = body.name.strip()
    history[index]["custom_name"] = name if name else None
    save_state(state, config.state_file_path)
    return {"status": "renamed"}


@router.get("/salary/{index}/pdf/encrypted")
def check_pdf_encrypted(index: int) -> dict[str, bool]:
    all_records = _get_records()
    if index < 0 or index >= len(all_records):
        raise HTTPException(status_code=404, detail="Record not found")

    _, _, path = all_records[index]

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"PDF not found at {path}")

    with open(path, "rb") as f:
        raw_bytes: bytes = f.read()

    return {"encrypted": is_pdf_encrypted(raw_bytes)}


@router.post("/salary/{index}/pdf")
def get_salary_pdf(index: int, body: PdfUnlockRequest) -> Response:
    all_records = _get_records()
    if index < 0 or index >= len(all_records):
        raise HTTPException(status_code=404, detail="Record not found")

    _, _, path = all_records[index]

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"PDF not found at {path}")

    with open(path, "rb") as f:
        raw_bytes: bytes = f.read()

    if is_pdf_encrypted(raw_bytes):
        if not body.password:
            raise HTTPException(status_code=403, detail="Password required")
        try:
            pdf_bytes: bytes = decrypt_pdf(raw_bytes, body.password)
        except PDFDecryptionError:
            raise HTTPException(status_code=403, detail="Wrong password")
    else:
        pdf_bytes = raw_bytes

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{os.path.basename(path)}"'},
    )


class SaveAsRequest(BaseModel):
    password: str | None = None


def _show_save_dialog(default_name: str) -> str | None:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    file_path: str = filedialog.asksaveasfilename(
        defaultextension=".pdf",
        filetypes=[("PDF files", "*.pdf")],
        initialfile=default_name,
        title="Save salary report as",
    )
    root.destroy()
    return file_path or None


@router.post("/salary/{index}/save-as")
def save_pdf_as(index: int, body: SaveAsRequest) -> dict[str, str | None]:
    config: Config = Config.load()
    all_records = _get_records()
    if index < 0 or index >= len(all_records):
        raise HTTPException(status_code=404, detail="Record not found")

    _, salary, path = all_records[index]

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="PDF not found")

    with open(path, "rb") as f:
        raw_bytes: bytes = f.read()

    if is_pdf_encrypted(raw_bytes):
        if not body.password:
            raise HTTPException(status_code=403, detail="Password required")
        try:
            decrypted: bytes = decrypt_pdf(raw_bytes, body.password)
        except PDFDecryptionError:
            raise HTTPException(status_code=403, detail="Wrong password")
    else:
        decrypted = raw_bytes

    default_name: str = os.path.basename(path)
    save_path: str | None = _show_save_dialog(default_name)

    if not save_path:
        return {"status": "cancelled", "path": None}

    with open(save_path, "wb") as f:
        f.write(decrypted)

    return {"status": "saved", "path": save_path}


class OpenFileRequest(BaseModel):
    path: str


@router.post("/open-file")
def open_file(body: OpenFileRequest) -> dict[str, str]:
    if not os.path.exists(body.path):
        raise HTTPException(status_code=404, detail="File not found")
    os.startfile(body.path)
    return {"status": "opened"}
