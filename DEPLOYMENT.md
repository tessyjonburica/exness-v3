# Deployment Notes

## Recommended Targets

- Frontend: Vercel
- API: Render, Fly.io, or Railway web service
- WebSocket: Render, Fly.io, or Railway web service
- Engine: Render, Fly.io, or Railway background worker
- Pooler: Render, Fly.io, or Railway background worker
- Postgres: Supabase, Neon, or Railway
- Redis: Upstash or Redis Cloud

## Required Environment Variables

### Shared

- `REDIS_URL`
- `JWT_SECRET`

### Web

- `VITE_API_URL`
- `VITE_WS_URL`

### API

- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `RUN_ENGINE`

### WebSocket

- `WS_PORT`
- `REDIS_URL`
- `RUN_POOLER`

### Engine

- `REDIS_URL`
- `BACKPACK_KLINES_URL`

### Pooler

- `REDIS_URL`
- `BACKPACK_WS_URL`
- `ENABLE_DEV_QUOTES`

## Deployment Order

1. Provision Postgres.
2. Provision Redis.
3. Set all service environment variables.
4. Run Prisma migrations against production Postgres.
5. Deploy API and confirm `GET /health`.
6. Deploy WebSocket and confirm `GET /health`.
7. If using dedicated workers, deploy Engine worker.
8. If using dedicated workers, deploy Pooler worker and confirm quotes are reaching Redis.
9. Deploy the Vercel frontend with `VITE_API_URL` and `VITE_WS_URL`.
10. Run smoke verification against the deployed stack.

## Service Notes

- API and WebSocket should be separate public services.
- Engine and Pooler should run as background workers, not public web apps.
- Render Free fallback: set `RUN_ENGINE=true` on the API service and `RUN_POOLER=true` on the WebSocket service, and keep each service at exactly one instance.
- `CORS_ORIGINS` should contain the deployed Vercel origin plus any approved preview domains.
- `VITE_WS_URL` should use `wss://` in production.
- `ENABLE_DEV_QUOTES` must stay `false` in production.

## Post-Deploy Checks

- API health endpoint returns `200`.
- WebSocket health endpoint returns `200`.
- Web app can sign up and sign in.
- Live prices appear on `/trade`.
- Opening and closing orders succeeds.
- Wallet deposit and withdrawal flows succeed.
- Redis receives price updates.
- PostgreSQL receives engine snapshots in the `EngineSnapshot` table.
