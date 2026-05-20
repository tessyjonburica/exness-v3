# pooler

This worker subscribes to Backpack market data and publishes normalized quotes into Redis.

Run from the repository root:

```bash
pnpm --filter pooler dev
```

Production start:

```bash
pnpm --filter pooler start
```

Required environment:

- `REDIS_URL`
- `BACKPACK_WS_URL`
- `ENABLE_DEV_QUOTES`
