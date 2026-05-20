# ws

This service fans Redis price updates out to browser WebSocket clients.

Run from the repository root:

```bash
pnpm --filter ws dev
```

Production start:

```bash
pnpm --filter ws start
```

Health check:

- `GET /health`
