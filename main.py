from __future__ import annotations

import logging
import sys
from email.message import EmailMessage

from config import Config
from gmail_client import (
    connect,
    download_pdf_attachments,
    fetch_message,
    get_message_id,
    search_salary_emails,
)
from ai_analyzer import analyze
from models import AnalysisResult, SalaryData
from pdf_processor import (
    PDFDecryptionError,
    PDFTextExtractionError,
    decrypt_pdf,
    extract_text,
    is_pdf_encrypted,
    save_pdf,
)
from state import get_salary_history, is_processed, load_state, mark_processed, save_state
from notifier import notify

logger: logging.Logger = logging.getLogger("finbrief")


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("finbrief.log", encoding="utf-8"),
        ],
    )


def run_pipeline() -> None:
    config: Config = Config.load()
    state: dict = load_state(config.state_file_path)

    logger.info("Connecting to Gmail via IMAP...")
    imap = connect(config)

    logger.info("Searching for salary emails...")
    msg_ids: list[bytes] = search_salary_emails(imap, config)

    if not msg_ids:
        logger.info("No salary emails found.")
        imap.logout()
        return

    new_count: int = 0
    for msg_id in msg_ids:
        msg: EmailMessage = fetch_message(imap, msg_id)
        unique_id: str = get_message_id(msg)

        if is_processed(state, unique_id):
            continue

        new_count += 1
        logger.info("Processing email: %s", msg.get("Subject", "unknown"))

        attachments: list[tuple[str, bytes]] = download_pdf_attachments(msg)

        if not attachments:
            logger.warning("Email has no PDF attachments — skipping (will retry next run)")
            continue

        for filename, pdf_bytes in attachments:
            logger.info("Processing attachment: %s", filename)

            if is_pdf_encrypted(pdf_bytes):
                if not config.pdf_password:
                    logger.warning("PDF %s is encrypted but no PDF_PASSWORD is set — skipping", filename)
                    continue
                try:
                    decrypted: bytes = decrypt_pdf(pdf_bytes, config.pdf_password)
                except PDFDecryptionError:
                    logger.exception("Failed to decrypt %s — skipping", filename)
                    continue
            else:
                decrypted = pdf_bytes

            try:
                text: str = extract_text(decrypted)
            except PDFTextExtractionError:
                logger.exception("Failed to extract text from %s — skipping", filename)
                continue

            try:
                history: list[SalaryData] = get_salary_history(state)
                result: AnalysisResult = analyze(text, config, history)
            except Exception:
                logger.exception("AI analysis failed for %s — saving PDF without analysis", filename)
                mark_processed(state, unique_id)
                save_state(state, config.state_file_path)
                continue

            saved_path: str = save_pdf(pdf_bytes, config, result.salary_data)
            logger.info("Saved PDF to: %s", saved_path)

            try:
                notify(result, saved_path, config)
            except Exception:
                logger.exception("Notification failed — PDF was saved successfully")

            mark_processed(state, unique_id, result.salary_data, raw_text=text)
            save_state(state, config.state_file_path)
            logger.info("Summary: %s", result.summary)

    imap.logout()

    if new_count == 0:
        logger.info("No new salary emails to process.")
    else:
        logger.info("Done — processed %d new %s.", new_count, "email" if new_count == 1 else "emails")


def main() -> None:
    setup_logging()
    try:
        run_pipeline()
    except ValueError as exc:
        logger.error("Configuration error: %s", exc)
        sys.exit(1)
    except Exception:
        logger.exception("Unexpected error")
        sys.exit(3)


if __name__ == "__main__":
    main()
