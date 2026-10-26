# Frontend

React + Vite + TypeScript, TanStack Query for server data, Tailwind for the booking flow and plain CSS elsewhere. The look follows [Design.md](../Design.md): monochrome ink on white, pill-shaped controls, one blue accent.

```bash
npm ci
npm run dev      # http://localhost:5173, /api is proxied to http://localhost:8000
npm run lint && npm test && npm run build
```
In Docker the built app is served by nginx on http://localhost:8080 (`Dockerfile`, `nginx.conf`).

## One folder per group under `src/features/`

| Folder | Group | Pages and components | Route |
|---|---|---|---|
| `accounts/` | G1 | Sign in, sign up, profile, saved passengers; `RequireAuth` / `RequireRole` guards; `session.ts` reads the role from the token | `/accounts` |
| `network/` | G2 | Journey search with station autocomplete, Direct and One change tabs, train timetable | `/`, `/trains/:trainNo` |
| `inventory/` | G3 | Six-day availability grid, fare breakup modal, coach seat map (rendered inside search results) | — |
| `reservations/` | G4 | Booking flow with quota choice, saved passengers and hold timer; Tatkal countdown; My journeys; cancel dialog | `/book`, `/my-journeys` |
| `wallet/` | G5 | Wallet and statement, simulated UPI top-up, pay from wallet, e-ticket with QR and PDF, refunds | `/wallet`, `/reservations/:pnr/pay`, `/tickets/:pnr`, `/refunds` |
| `operations/` | G6 | Public PNR status; staff console (run board, delays, cancel a run, charts); admin analytics with Recharts | `/pnr-status`, `/operations` |

Routes and the role-aware menu live in `src/App.tsx`. `src/api/client.ts` (axios with the bearer-token interceptor) belongs to G1; each feature has its own `api.ts` on top of it. Never put secrets or API keys in frontend code.

Screenshots of every page are in the [main README](../README.md#a-walk-through-the-app).
