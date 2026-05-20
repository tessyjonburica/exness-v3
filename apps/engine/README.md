# engine

This worker consumes Redis stream events, executes trade state changes, and snapshots runtime state to PostgreSQL.

Run from the repository root:

```bash
pnpm --filter engine dev
```

Production start:

```bash
pnpm --filter engine start
```

Required environment:

- `REDIS_URL`
- `BACKPACK_KLINES_URL`
