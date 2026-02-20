"""
SQLite database for CrystalBall settings.
Stores provider credentials and app configuration.
"""
from __future__ import annotations
import aiosqlite
import json
import os

DB_PATH = os.environ.get("DB_PATH", "crystalball.db")


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        await db.commit()


async def get_setting(key: str) -> str | None:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT value FROM settings WHERE key = ?", (key,)) as cur:
            row = await cur.fetchone()
            return row[0] if row else None


async def set_setting(key: str, value: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, value)
        )
        await db.commit()


async def get_all_settings() -> dict[str, str]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT key, value FROM settings") as cur:
            rows = await cur.fetchall()
            return {r[0]: r[1] for r in rows}


async def get_provider_config(provider: str) -> dict:
    raw = await get_setting(f"provider.{provider}")
    return json.loads(raw) if raw else {}


async def set_provider_config(provider: str, config: dict):
    await set_setting(f"provider.{provider}", json.dumps(config))


async def get_active_provider() -> str | None:
    return await get_setting("active_provider")


async def set_active_provider(provider: str):
    await set_setting("active_provider", provider)
