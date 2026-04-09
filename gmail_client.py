from __future__ import annotations

import email
import email.policy
import imaplib
import logging
from email.message import EmailMessage

from config import Config

logger: logging.Logger = logging.getLogger(__name__)


def connect(config: Config) -> imaplib.IMAP4_SSL:
    imap: imaplib.IMAP4_SSL = imaplib.IMAP4_SSL("imap.gmail.com")
    imap.login(config.gmail_address, config.gmail_app_password)
    logger.info("Connected to Gmail via IMAP")
    return imap


def search_salary_emails(imap: imaplib.IMAP4_SSL, config: Config) -> list[bytes]:
    imap.select("INBOX")

    # Search by sender only (ASCII-safe), then filter by subject in Python
    query: str = f'(FROM "{config.gmail_sender_filter}")'
    logger.info("Searching IMAP by sender: %s", config.gmail_sender_filter)

    _status, data = imap.search(None, query)
    all_ids: list[bytes] = data[0].split() if data[0] else []
    logger.info("Found %d emails from sender", len(all_ids))

    # Filter by subject keyword (supports non-ASCII like "Plača")
    matched: list[bytes] = []
    keyword: str = config.gmail_subject_keyword.lower()
    for msg_id in all_ids:
        _status, header_data = imap.fetch(msg_id, "(BODY[HEADER.FIELDS (SUBJECT)])")
        raw_header: bytes = header_data[0][1]
        subject: str = email.message_from_bytes(raw_header, policy=email.policy.default).get("Subject", "")
        if keyword in subject.lower():
            matched.append(msg_id)

    logger.info("Found %d emails matching subject keyword '%s'", len(matched), config.gmail_subject_keyword)
    return matched


def fetch_message(imap: imaplib.IMAP4_SSL, msg_id: bytes) -> EmailMessage:
    _status, data = imap.fetch(msg_id, "(RFC822)")
    raw_email: bytes = data[0][1]
    msg: EmailMessage = email.message_from_bytes(raw_email, policy=email.policy.default)
    return msg


def get_message_id(msg: EmailMessage) -> str:
    return msg.get("Message-ID", "") or msg.get("Date", "")


def download_pdf_attachments(msg: EmailMessage) -> list[tuple[str, bytes]]:
    attachments: list[tuple[str, bytes]] = []

    for part in msg.walk():
        content_type: str = part.get_content_type() or ""
        filename: str = part.get_filename() or ""
        disposition: str = str(part.get("Content-Disposition") or "")

        # Log all parts for debugging
        if filename or "attachment" in disposition:
            logger.debug("Part: type=%s, filename=%s, disposition=%s", content_type, filename, disposition)

        # Match by MIME type OR by .pdf extension in filename
        is_pdf: bool = (
            content_type == "application/pdf"
            or content_type == "application/octet-stream" and filename.lower().endswith(".pdf")
            or filename.lower().endswith(".pdf")
        )

        if is_pdf and filename:
            pdf_bytes: bytes | None = part.get_payload(decode=True)
            if pdf_bytes:
                attachments.append((filename, pdf_bytes))
                logger.info("Downloaded attachment: %s (%d bytes)", filename, len(pdf_bytes))

    if not attachments:
        # Log all parts to help debug
        for part in msg.walk():
            ct: str = part.get_content_type() or ""
            fn: str = part.get_filename() or ""
            if not part.is_multipart():
                logger.debug("Email part: type=%s, filename=%s", ct, fn)

    return attachments
