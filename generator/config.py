"""Configuration loading for the Methodic brief generator.

Secrets come from config/.env (gitignored). Non-secret toggles come from
config/config.toml (safe to commit). Everything is read once at startup.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

try:
    import tomllib  # Python 3.11+
except ModuleNotFoundError:  # pragma: no cover - fallback for 3.10
    import tomli as tomllib  # type: ignore

# Repo root is one level up from this file's directory (generator/).
REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = REPO_ROOT / "config"
ENV_PATH = CONFIG_DIR / ".env"
TOML_PATH = CONFIG_DIR / "config.toml"


@dataclass
class EmailConfig:
    enabled: bool = False
    subject_prefix: str = "Methodic Monday Brief"
    smtp_user: str | None = None
    smtp_app_password: str | None = None
    email_to: str | None = None


@dataclass
class Config:
    # Secrets
    anthropic_api_key: str
    supabase_url: str
    supabase_service_role_key: str

    # Model
    model: str = "claude-opus-4-8"
    max_tokens: int = 16000
    max_web_searches: int = 12

    # Buy box
    buy_box_low: float = 3.0
    buy_box_high: float = 4.0

    # Run
    timezone: str = "America/New_York"
    save_local_copy: bool = True

    email: EmailConfig = field(default_factory=EmailConfig)


def _require(name: str, value: str | None) -> str:
    if not value:
        raise SystemExit(
            f"Missing required secret {name}. Copy config/.env.example to "
            f"config/.env and fill it in."
        )
    return value


def load_config() -> Config:
    load_dotenv(ENV_PATH)

    toml: dict = {}
    if TOML_PATH.exists():
        with open(TOML_PATH, "rb") as fh:
            toml = tomllib.load(fh)

    model = toml.get("model", {})
    buy_box = toml.get("buy_box", {})
    run = toml.get("run", {})
    email = toml.get("email", {})

    cfg = Config(
        anthropic_api_key=_require("ANTHROPIC_API_KEY", os.getenv("ANTHROPIC_API_KEY")),
        supabase_url=_require("SUPABASE_URL", os.getenv("SUPABASE_URL")),
        supabase_service_role_key=_require(
            "SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        ),
        model=model.get("name", "claude-opus-4-8"),
        max_tokens=int(model.get("max_tokens", 16000)),
        max_web_searches=int(model.get("max_web_searches", 12)),
        buy_box_low=float(buy_box.get("low", 3.0)),
        buy_box_high=float(buy_box.get("high", 4.0)),
        timezone=run.get("timezone", "America/New_York"),
        save_local_copy=bool(run.get("save_local_copy", True)),
        email=EmailConfig(
            enabled=bool(email.get("enabled", False)),
            subject_prefix=email.get("subject_prefix", "Methodic Monday Brief"),
            smtp_user=os.getenv("SMTP_USER"),
            smtp_app_password=os.getenv("SMTP_APP_PASSWORD"),
            email_to=os.getenv("EMAIL_TO"),
        ),
    )
    return cfg
