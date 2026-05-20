# TradeX - Cryptocurrency Trading Platform

A full-stack real-time cryptocurrency trading platform with live price feeds, candlestick charts, and order management.

## What This Does

TradeX simulates a live crypto trading experience where users can:

- View real-time BTC, ETH, and SOL prices via WebSocket
- Place LONG/SHORT trades with up to 100x leverage
- Monitor positions with live P&L updates
- View interactive candlestick charts across multiple timeframes
- Manage trading history and balance

## Architecture

![Architecture](apps/web/src/assets/architecture.png)

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL >= 15
- Redis >= 7

Optional:

- Docker Desktop, if you want local infra via `docker compose`

### Install

```bash
git clone https://github.com/shashank-poola/exness-v3.git
cd exness-v3
pnpm install
```

### Environment

```bash
cp .env.example .env
```

Required variables:

- `DATABASE_URL`
- `REDIS_URL`
- `PORT`
- `WS_PORT`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `VITE_API_URL`
- `VITE_WS_URL`

Optional runtime variables:

- `BACKPACK_WS_URL`
- `BACKPACK_KLINES_URL`
- `ENABLE_DEV_QUOTES`

### Start Infrastructure

If you have Docker:

```bash
pnpm infra:up
```

The repo defaults expect:

- Postgres on `localhost:5432` with `postgres/12345`
- Redis on `localhost:6379`

### Database Setup

```bash
pnpm doctor
pnpm setup:core
```

### Run The Stack

Development:

```bash
pnpm dev:core
```

Production-like local start:

```bash
pnpm build
pnpm start:core
```

### URLs

- Frontend: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3000](http://localhost:3000)
- WebSocket: `ws://localhost:8080`

## Services

- `apps/web`: Vite + React frontend
- `apps/api`: Express API
- `apps/ws`: WebSocket broadcast server
- `apps/pooler`: Market price ingestion service
- `apps/engine`: Trading engine and PostgreSQL-backed runtime snapshotting
- `packages/db`: Prisma schema and client
- `packages/redis`: Shared Redis clients

## Helpful Commands

- `pnpm infra:up` starts Postgres and Redis
- `pnpm doctor` verifies env vars plus Postgres and Redis reachability
- `pnpm setup:core` generates Prisma client and applies migrations
- `pnpm dev:core` runs the full stack in development
- `pnpm start:core` runs the full stack with production-style start scripts
- `pnpm preflight:trade` verifies the local trading runtime before opening the web app or running smoke tests
- `pnpm smoke:trade` runs the authenticated web trading smoke test
- `pnpm verify:trade` runs the runtime preflight first, then the smoke test
- `pnpm lint` runs monorepo lint checks
- `pnpm build` runs the configured workspace build tasks

## Trading Runtime Checks

Use these checks when you want a quick signal that the local trading stack is healthy.

### Services That Must Be Running

For `pnpm preflight:trade` and `pnpm verify:trade`, start the local stack first:

```bash
pnpm dev:core
```

At minimum, these services must be available:

- Redis on `localhost:6379`
- API on `http://localhost:3000`
- WebSocket server on `ws://localhost:8080`
- Pooler publishing live quotes into Redis
- Web app on `http://localhost:5173` for the smoke test

### Commands

```bash
pnpm preflight:trade
pnpm smoke:trade
pnpm verify:trade
```

### What The Checks Mean

- `pnpm preflight:trade` checks Redis connectivity, the latest quote snapshot, the `ws:price:update` Pub/Sub channel, the WebSocket quote feed, and API health.
- `pnpm smoke:trade` checks the authenticated browser flow on the web app, including `/trade`, live prices, opening positions, closing a position, and balance/history updates.
- `pnpm verify:trade` is the safest one-command workflow before local QA because it fails fast if the runtime is not healthy enough for the browser smoke test.

### Failure Guidance

- If `preflight:trade` fails, one or more backend runtime services are not healthy enough for the trading UI.
- If `smoke:trade` fails after preflight passes, the issue is more likely in the web route, browser flow, or an application-level regression.
- These checks do not start services for you, so they stay safe for partial local workflows where you intentionally are not running the full stack.

## License

MIT

## Deployment

Deployment notes live in [DEPLOYMENT.md](./DEPLOYMENT.md).
