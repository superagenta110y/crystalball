"""
SQLite database for CrystalBall settings.
Stores provider credentials and app configuration.
"""
from __future__ import annotations
import aiosqlite
import json
import uuid
import os

DB_PATH = os.environ.get("DB_PATH", "crystalball.db")


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS providers (
                id         TEXT PRIMARY KEY,
                type       TEXT NOT NULL,
                name       TEXT NOT NULL,
                config     TEXT NOT NULL DEFAULT '{}',
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        await db.commit()


# ── Generic key/value ─────────────────────────────────────────

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


# ── Active provider per role ──────────────────────────────────
# Roles: "data" (market data / trading), "ai" (LLM)

async def get_active_provider_id(role: str = "data") -> str | None:
    return await get_setting(f"active_provider_{role}")


async def set_active_provider_id(role: str, provider_id: str):
    await set_setting(f"active_provider_{role}", provider_id)


# Legacy aliases used by existing routes/deps.py
async def get_active_provider() -> str | None:
    """Return the type (e.g. 'alpaca') of the active data provider."""
    pid = await get_active_provider_id("data")
    if not pid:
        return None
    p = await get_provider(pid)
    return p["type"] if p else None


async def set_active_provider(provider_type: str):
    """Set active data provider by type (legacy: selects first matching)."""
    all_p = await get_all_providers()
    match = next((p for p in all_p if p["type"] == provider_type), None)
    if match:
        await set_active_provider_id("data", match["id"])


# ── Provider CRUD ─────────────────────────────────────────────

async def get_all_providers() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT id, type, name, config, created_at FROM providers ORDER BY created_at"
        ) as cur:
            rows = await cur.fetchall()
            return [
                {"id": r[0], "type": r[1], "name": r[2],
                 **json.loads(r[3]), "created_at": r[4]}
                for r in rows
            ]


async def get_provider(provider_id: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT id, type, name, config FROM providers WHERE id = ?", (provider_id,)
        ) as cur:
            row = await cur.fetchone()
            if not row:
                return None
            return {"id": row[0], "type": row[1], "name": row[2], **json.loads(row[3])}


async def save_provider(provider_id: str | None, type_: str, name: str, config: dict) -> str:
    pid = provider_id or str(uuid.uuid4())
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO providers (id, type, name, config)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET type=excluded.type, name=excluded.name, config=excluded.config""",
            (pid, type_, name, json.dumps(config))
        )
        await db.commit()
    return pid


async def delete_provider(provider_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM providers WHERE id = ?", (provider_id,))
        await db.commit()


# ── Config helpers (used by deps.py) ─────────────────────────

async def get_active_provider_config(role: str = "data") -> tuple[str, dict]:
    """Returns (type, config) for the active provider of the given role."""
    pid = await get_active_provider_id(role)
    if pid:
        p = await get_provider(pid)
        if p:
            t = p.pop("type")
            p.pop("id", None); p.pop("name", None); p.pop("created_at", None)
            return t, p
    # No provider configured
    return "", {}


# ── Legacy shims (kept for existing routes/settings.py) ──────

async def get_provider_config(provider_type: str) -> dict:
    """Return config of first provider matching type."""
    all_p = await get_all_providers()
    p = next((x for x in all_p if x["type"] == provider_type), None)
    if not p:
        return {}
    return {k: v for k, v in p.items() if k not in ("id", "type", "name", "created_at")}


async def set_provider_config(provider_type: str, config: dict):
    all_p = await get_all_providers()
    existing = next((x for x in all_p if x["type"] == provider_type), None)
    if existing:
        pid = existing["id"]
        name = existing["name"]
    else:
        pid = None
        name = provider_type.capitalize()
    await save_provider(pid, provider_type, name, config)
