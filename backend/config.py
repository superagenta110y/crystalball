"""
CrystalBall backend configuration.
Reads from environment variables / .env file.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Provider ─────────────────────────────────────────────────────────────
    provider: str = "alpaca"  # "alpaca" | "hoodwink"

    # ── Alpaca ────────────────────────────────────────────────────────────────
    alpaca_api_key: str = ""
    alpaca_secret_key: str = ""
    alpaca_paper: bool = True

    @property
    def alpaca_base_url(self) -> str:
        return (
            "https://paper-api.alpaca.markets"
            if self.alpaca_paper
            else "https://api.alpaca.markets"
        )

    alpaca_data_url: str = "https://data.alpaca.markets"

    # ── Hoodwink ──────────────────────────────────────────────────────────────
    hoodwink_url: str = "http://127.0.0.1:7878"
    hoodwink_api_key: str = "changeme"

    # ── App ───────────────────────────────────────────────────────────────────
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
