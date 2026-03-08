from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

from db import get_active_provider_id, get_provider, get_all_providers

router = APIRouter(prefix="/ai", tags=["ai"])

AI_TYPES = {"openai", "gemini", "claude"}


class ChatBody(BaseModel):
    message: str
    symbol: str = "SPY"
    history: list[dict] = []


async def _resolve_ai_provider() -> dict | None:
    active_ai_id = await get_active_provider_id("ai")
    if active_ai_id:
        p = await get_provider(active_ai_id)
        if p and p.get("type") in AI_TYPES:
            return p

    providers = await get_all_providers()
    for p in providers:
        if p.get("type") in AI_TYPES and p.get("api_key"):
            return p
    return None


def _build_prompt(symbol: str, history: list[dict], message: str) -> str:
    lines = [
        f"You are a trading assistant for symbol {symbol}. Be concise and practical.",
        "If uncertain, say so.",
        "",
        "Recent conversation:",
    ]
    for h in history[-6:]:
        role = h.get("role", "user")
        content = str(h.get("content", ""))
        lines.append(f"{role}: {content}")
    lines.append("")
    lines.append(f"user: {message}")
    return "\n".join(lines)


async def _chat_openai(api_key: str, prompt: str) -> str:
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a concise options trading assistant."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
    }
    async with httpx.AsyncClient(timeout=40.0) as c:
        r = await c.post("https://api.openai.com/v1/chat/completions", headers=headers, json=body)
        if r.status_code >= 400:
            raise HTTPException(502, f"OpenAI error: {r.text[:200]}")
        data = r.json()
        return data["choices"][0]["message"]["content"].strip()


async def _chat_gemini(api_key: str, prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    async with httpx.AsyncClient(timeout=40.0) as c:
        r = await c.post(url, json=body)
        if r.status_code >= 400:
            raise HTTPException(502, f"Gemini error: {r.text[:200]}")
        data = r.json()
        cands = data.get("candidates", [])
        if not cands:
            return "No response from Gemini."
        parts = cands[0].get("content", {}).get("parts", [])
        return "\n".join(str(p.get("text", "")).strip() for p in parts if p.get("text")) or "No response from Gemini."


async def _chat_claude(api_key: str, prompt: str) -> str:
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": "claude-3-5-sonnet-latest",
        "max_tokens": 500,
        "temperature": 0.3,
        "messages": [{"role": "user", "content": prompt}],
    }
    async with httpx.AsyncClient(timeout=40.0) as c:
        r = await c.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
        if r.status_code >= 400:
            raise HTTPException(502, f"Claude error: {r.text[:200]}")
        data = r.json()
        content = data.get("content", [])
        texts = [x.get("text", "") for x in content if x.get("type") == "text"]
        return "\n".join(t.strip() for t in texts if t.strip()) or "No response from Claude."


@router.get("/status")
async def ai_status():
    p = await _resolve_ai_provider()
    if not p:
        return {"configured": False}
    return {"configured": True, "provider": p.get("type")}


@router.post("/chat")
async def chat(body: ChatBody):
    p = await _resolve_ai_provider()
    if not p:
        raise HTTPException(400, "NO_AI_PROVIDER")

    prompt = _build_prompt(body.symbol, body.history, body.message)
    api_key = str(p.get("api_key") or "")
    if not api_key:
        raise HTTPException(400, "NO_AI_PROVIDER")

    ptype = p.get("type")
    if ptype == "openai":
        reply = await _chat_openai(api_key, prompt)
    elif ptype == "gemini":
        reply = await _chat_gemini(api_key, prompt)
    elif ptype == "claude":
        reply = await _chat_claude(api_key, prompt)
    else:
        raise HTTPException(400, "NO_AI_PROVIDER")

    return {"reply": reply, "provider": ptype}
