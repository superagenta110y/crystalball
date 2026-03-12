# CrystalBall Rust Backend (migration scaffold)

This is the Rust rewrite target for CrystalBall backend.

## Goals
- Single compiled binary for desktop embedding (`.exe`, `.app`, etc.)
- Serve bundled frontend assets + API + WebSocket from one entrypoint
- Preserve API/WebSocket endpoint compatibility with current Python backend
- Use **SQLite** for config/provider DB
- Use **LMDB** for cache (history/screener/orderflow snapshots)

## Current status
- Axum server scaffold with endpoint parity routes
- `/api/*` and `/ws/*` routing shape in place (including `/api/ws/*` mirror)
- SQLite and LMDB initialization bootstrapped
- Handlers are placeholders and need logic ported from `../backend`

## Porting order
1. Providers + market endpoints (`/api/market/*`)
2. Caches (history/screener) in LMDB
3. WebSocket loops (`quotes`, `screener`, `orderflow`)
4. Analytics endpoints (GEX/DEX/OI)
5. Providers/settings CRUD parity
6. AI routes

## Notes
- `cargo` was not available in this environment at scaffold time, so compile/test here is pending.
- Keep Python backend as reference until parity tests pass.
