# Frontend

React + Vite + TypeScript, TanStack Query for server data.

```bash
npm ci
npm run dev      # http://localhost:5173, /api is proxied to http://localhost:8000
npm run lint && npm test && npm run build
```

One folder per group under `src/features/`:

| Folder | Group | Pages |
|---|---|---|
| `network/` | G2 | Journey search (Direct / One change), train timetable |
| `wallet/` | G5 | Wallet and statement, simulated UPI top-up, pay from wallet, e-ticket with QR and PDF, refunds |

Routes live in `src/App.tsx`. `src/api/client.ts` (axios + bearer token) belongs to G1. Never put secrets or API keys in frontend code.
