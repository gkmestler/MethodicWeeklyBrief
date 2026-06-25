"""Optional email delivery of the rendered brief from the Mac mini via Gmail SMTP.

Off by default (config.toml [email].enabled = false). Uses a Gmail App Password,
not the account password.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from generator.config import Config

log = logging.getLogger("methodic.emailer")


def send_brief(cfg: Config, week_of: str, body_markdown: str) -> None:
    e = cfg.email
    if not e.enabled:
        return
    if not (e.smtp_user and e.smtp_app_password and e.email_to):
        log.warning("Email enabled but SMTP_USER / SMTP_APP_PASSWORD / EMAIL_TO not set; skipping.")
        return

    msg = EmailMessage()
    msg["Subject"] = f"{e.subject_prefix} — week of {week_of}"
    msg["From"] = e.smtp_user
    msg["To"] = e.email_to
    msg.set_content(body_markdown or "(empty brief)")

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(e.smtp_user, e.smtp_app_password)
            server.send_message(msg)
        log.info("Emailed brief to %s", e.email_to)
    except Exception as exc:  # noqa: BLE001 - email failure must not fail the run
        log.warning("Email send failed: %s", exc)
