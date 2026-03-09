"""Settings API — configure providers from the UI (legacy shim routes)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
from db import get_provider_config, set_provider_config, get_active_provider, set_active_provider, get_setting, set_setting
from routes.deps import invalidate_provider_cache

router = APIRouter(prefix="/settings", tags=["settings"])


class AlpacaConfig(BaseModel):
    api_key: str
    secret_key: str
    paper: bool = True
    data_url: str = "https://data.alpaca.markets"


class HoodwinkConfig(BaseModel):
    url: str = "http://127.0.0.1:7878"
    api_key: str = "changeme"


class ActiveProviderBody(BaseModel):
    provider: str  # "alpaca" | "hoodwink"


class UIThemeBody(BaseModel):
    mode: str = "dark"
    accent: str = "#00d4aa"
    bull: str = "#00d4aa"
    bear: str = "#ff4d6d"


@router.get("")
async def get_settings():
    alpaca = await get_provider_config("alpaca")
    hoodwink = await get_provider_config("hoodwink")
    active = await get_active_provider() or "alpaca"
    # Mask secrets
    if alpaca.get("secret_key"):
        alpaca["secret_key"] = "••••••••" + alpaca["secret_key"][-4:]
    if hoodwink.get("api_key"):
        hoodwink["api_key"] = "••••••••" + hoodwink["api_key"][-4:]
    return {"active_provider": active, "alpaca": alpaca, "hoodwink": hoodwink}


@router.put("/alpaca")
async def save_alpaca(cfg: AlpacaConfig):
    # Don't overwrite secret if masked placeholder sent
    existing = await get_provider_config("alpaca")
    secret = cfg.secret_key
    if secret.startswith("••••••••"):
        secret = existing.get("secret_key", "")
    await set_provider_config("alpaca", {
        "api_key": cfg.api_key,
        "secret_key": secret,
        "paper": cfg.paper,
        "data_url": cfg.data_url,
    })
    invalidate_provider_cache()
    return {"ok": True}


@router.put("/hoodwink")
async def save_hoodwink(cfg: HoodwinkConfig):
    existing = await get_provider_config("hoodwink")
    api_key = cfg.api_key
    if api_key.startswith("••••••••"):
        api_key = existing.get("api_key", "")
    await set_provider_config("hoodwink", {"url": cfg.url, "api_key": api_key})
    invalidate_provider_cache()
    return {"ok": True}


@router.put("/active-provider")
async def update_active_provider(body: ActiveProviderBody):
    if body.provider not in ("alpaca", "hoodwink"):
        raise HTTPException(400, "Invalid provider")
    await set_active_provider(body.provider)
    invalidate_provider_cache()
    return {"ok": True, "active_provider": body.provider}


@router.get("/ui-theme")
async def get_ui_theme():
    raw = await get_setting("ui_theme")
    if not raw:
        return {"mode": "dark", "accent": "#00d4aa", "bull": "#00d4aa", "bear": "#ff4d6d"}
    try:
        return json.loads(raw)
    except Exception:
        return {"mode": "dark", "accent": "#00d4aa", "bull": "#00d4aa", "bear": "#ff4d6d"}


@router.put("/ui-theme")
async def put_ui_theme(body: UIThemeBody):
    payload = {"mode": body.mode, "accent": body.accent, "bull": body.bull, "bear": body.bear}
    await set_setting("ui_theme", json.dumps(payload))
    return {"ok": True, "theme": payload}
