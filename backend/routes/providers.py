"""Providers CRUD API — manage data/ai provider credentials from the UI."""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any
from db import (
    get_all_providers, get_provider, save_provider, delete_provider,
    get_active_provider_id, set_active_provider_id,
)
from routes.deps import invalidate_provider_cache

router = APIRouter(prefix="/providers", tags=["providers"])

SUPPORTED_TYPES = {"alpaca", "hoodwink"}


class ProviderBody(BaseModel):
    type: str
    name: str
    config: dict[str, Any] = {}


class ActivateBody(BaseModel):
    role: str = "data"  # "data" | "ai"


def _mask(provider: dict) -> dict:
    """Mask sensitive fields for API responses."""
    p = dict(provider)
    if p.get("secret_key"):
        p["secret_key"] = "••••" + str(p["secret_key"])[-4:]
    if p.get("api_key"):
        p["api_key"] = "••••" + str(p["api_key"])[-4:]
    return p


@router.get("")
async def list_providers():
    providers = await get_all_providers()
    active_data = await get_active_provider_id("data")
    return {
        "providers": [_mask(p) for p in providers],
        "active": {"data": active_data},
    }


@router.post("")
async def create_provider(body: ProviderBody):
    if body.type not in SUPPORTED_TYPES:
        raise HTTPException(400, f"Unsupported type. Supported: {sorted(SUPPORTED_TYPES)}")
    pid = await save_provider(None, body.type, body.name, body.config)
    invalidate_provider_cache()
    return {"id": pid, "ok": True}


@router.get("/{provider_id}")
async def get_provider_detail(provider_id: str):
    p = await get_provider(provider_id)
    if not p:
        raise HTTPException(404, "Provider not found")
    return _mask(p)


@router.put("/{provider_id}")
async def update_provider(provider_id: str, body: ProviderBody):
    existing = await get_provider(provider_id)
    if not existing:
        raise HTTPException(404, "Provider not found")

    # Don't overwrite masked secrets
    config = dict(body.config)
    for secret_field in ("secret_key", "api_key"):
        if config.get(secret_field, "").startswith("••••"):
            config[secret_field] = existing.get(secret_field, "")

    await save_provider(provider_id, body.type, body.name, config)
    invalidate_provider_cache()
    return {"ok": True}


@router.delete("/{provider_id}")
async def remove_provider(provider_id: str):
    existing = await get_provider(provider_id)
    if not existing:
        raise HTTPException(404, "Provider not found")
    await delete_provider(provider_id)
    invalidate_provider_cache()
    return {"ok": True}


@router.put("/{provider_id}/activate")
async def activate_provider(provider_id: str, body: ActivateBody):
    p = await get_provider(provider_id)
    if not p:
        raise HTTPException(404, "Provider not found")
    await set_active_provider_id(body.role, provider_id)
    invalidate_provider_cache()
    return {"ok": True, "active": {body.role: provider_id}}
