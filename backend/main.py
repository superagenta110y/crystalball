"""CrystalBall backend — FastAPI entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings
from routes import market, analytics, orders, account, reports, ws

settings = get_settings()

app = FastAPI(
    title="CrystalBall API",
    description="Open-source quantitative trading platform backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routes
app.include_router(market.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(account.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

# WebSocket
app.include_router(ws.router)


@app.get("/api/status")
async def status():
    return {
        "status": "ok",
        "provider": settings.provider,
        "version": "0.1.0",
    }
