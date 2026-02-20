"""CrystalBall backend — FastAPI entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings
from routes import market, analytics, orders, account, reports, ws, settings as settings_router, news, providers as providers_router
from db import init_db

settings = get_settings()

app = FastAPI(
    title="CrystalBall API",
    description="Open-source quantitative trading platform backend",
    version="0.1.0",
)

# CORS: allow localhost, 127.x, and all RFC-1918 LAN addresses
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await init_db()

# REST routes
app.include_router(market.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(account.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(providers_router.router, prefix="/api")
app.include_router(news.router, prefix="/api")

# WebSocket
app.include_router(ws.router)


@app.get("/api/status")
async def status():
    from db import get_active_provider
    provider = await get_active_provider() or settings.provider
    return {"status": "ok", "provider": provider, "version": "0.1.0"}
