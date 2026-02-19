# 🔮 CrystalBall

> **Free, open-source quantitative trading platform. Self-hosted. Bring your own data.**

CrystalBall is a professional-grade trading dashboard you run on your own machine. No subscriptions. No data sharing. Connect your own Alpaca account for live market data and paper trading, configure Discord for alerts, and get a Bloomberg-style multi-widget workspace — all in a browser.

---

## ✨ Features

### 📊 Widgets
| Widget | Description |
|--------|-------------|
| **Order Flow** | Bubble chart visualizing buy/sell pressure at each price level |
| **Open Interest** | Bar chart of OI by strike for any options chain |
| **3D Open Interest** | Surface plot — strike vs expiry vs OI |
| **GEX (Gamma Exposure)** | Dealer gamma exposure by strike; shows key flip levels |
| **DEX (Delta Exposure)** | Net delta exposure across the options chain |
| **Chart** | Candlestick chart with VWAP, Volume Profile, RSI, and footprint overlay |
| **News Feed** | Real-time market news via Alpaca News API |
| **Bloomberg TV** | Embedded Bloomberg live stream |
| **AI Assistant** | Chat with OpenAI GPT-4 or Claude about the market |
| **Market Report** | Auto-generated daily bias report for SPY/QQQ |

### 🧩 Dashboard
- Drag-and-drop widget layout (powered by React Grid Layout)
- Save/load custom layouts
- Multiple ticker support — set symbol per widget
- Dark theme by default, light theme available

### 🔌 Providers
- **Alpaca** — market data (WebSocket + REST) + paper trading execution
- **Discord** — push notifications for alerts and reports

### 🤖 AI / Reports
- Daily pre-market report: SPY/QQQ bias, key levels, GEX/DEX summary
- Delivered to Discord and viewable in dashboard
- Powered by OpenAI GPT-4 or Anthropic Claude (your key, your cost)

---

## 🖼️ Screenshots

> Coming soon — first stable build in progress.

<!-- 
![Dashboard](docs/screenshots/dashboard.png)
![GEX Chart](docs/screenshots/gex.png)
![Order Flow](docs/screenshots/orderflow.png)
-->

---

## 🚀 Quick Start (Docker)

**Prerequisites:** Docker Desktop, an [Alpaca](https://alpaca.markets) account (free paper trading tier works)

### 1. Clone

```bash
git clone https://github.com/superagenta110y/crystalball.git
cd crystalball
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Alpaca (required for market data)
ALPACA_API_KEY=your_key_here
ALPACA_SECRET_KEY=your_secret_here
ALPACA_BASE_URL=https://paper-api.alpaca.markets   # or live

# AI Assistant (optional — pick one or both)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Discord (optional — for notifications)
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CHANNEL_ID=your_channel_id
```

### 3. Run

```bash
docker compose up
```

Open **http://localhost:3000** in your browser.

That's it. No database setup, no cloud accounts. SQLite handles persistence locally.

---

## 🗂️ Project Structure

```
crystalball/
├── docker-compose.yml
├── .env.example
├── frontend/                  # Next.js 14 app
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   ├── components/
│   │   │   ├── widgets/       # One file per widget
│   │   │   ├── layout/        # Dashboard shell, sidebar
│   │   │   └── ui/            # Shared UI primitives
│   │   ├── lib/
│   │   │   ├── providers/     # Alpaca WS client, etc.
│   │   │   ├── store/         # Zustand state
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   └── utils/         # Helpers
│   │   └── types/             # TypeScript types
│   └── Dockerfile
└── backend/                   # Python FastAPI
    ├── main.py
    ├── routes/                # REST + WS endpoints
    ├── services/              # Business logic
    │   ├── alpaca.py          # Alpaca integration
    │   ├── options.py         # Greeks, GEX, DEX math
    │   ├── reports.py         # AI report generation
    │   └── discord_bot.py     # Discord notifications
    ├── models/                # SQLite models (SQLModel)
    ├── core/                  # Config, DB, auth
    └── Dockerfile
```

---

## 🔌 Provider Setup

### Alpaca (Market Data + Execution)

1. Sign up at [alpaca.markets](https://alpaca.markets) — free paper trading account
2. Generate API keys in the dashboard
3. Set `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` in `.env`
4. For live trading, change `ALPACA_BASE_URL` to `https://api.alpaca.markets`

**Free tier includes:** Real-time IEX data, paper trading, options data (with subscription)

### Discord (Notifications)

1. Create a bot at [discord.com/developers](https://discord.com/developers/applications)
2. Enable **Message Content Intent** under Bot settings
3. Invite the bot to your server with `Send Messages` permission
4. Set `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID` in `.env`

### AI Assistant

- **OpenAI:** Get a key at [platform.openai.com](https://platform.openai.com), set `OPENAI_API_KEY`
- **Anthropic Claude:** Get a key at [console.anthropic.com](https://console.anthropic.com), set `ANTHROPIC_API_KEY`

If neither key is set, the AI assistant widget will show a configuration prompt.

---

## 🏗️ Development

### Frontend

```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Full stack (without Docker)

Run both in separate terminals. The frontend proxies `/api` to `http://localhost:8000`.

---

## 🗺️ Roadmap

- [x] Project scaffold
- [ ] Alpaca WebSocket data feed
- [ ] Order Flow widget (live)
- [ ] Options chain OI/GEX/DEX calculations
- [ ] Chart widget with VWAP + Volume Profile
- [ ] AI daily report (SPY/QQQ)
- [ ] Drag-drop layout persistence
- [ ] Mobile responsive layout
- [ ] Alert engine (price/GEX triggers → Discord)
- [ ] Backtesting module

---

## 🤝 Contributing

PRs welcome. Open an issue first for big changes.

```bash
git checkout -b feature/your-feature
# make changes
git commit -m "feat: your feature"
git push origin feature/your-feature
```

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

*Built by traders, for traders. No cloud required.*
