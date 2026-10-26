# Backend

FastAPI on Python 3.12, psycopg 3 with parameterised SQL. The API is deliberately thin: the rules live in PostgreSQL functions, triggers and constraints, and each route calls them.

## Run

From the repository root, after the database is migrated (see [db/README.md](../db/README.md)):
```bash
python -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt     # Windows: backend\.venv\Scripts\pip

export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nrrms
export JWT_SECRET=any-long-random-string-for-local-use        # no default: tokens are refused without it
uvicorn app.main:app --app-dir backend --reload
```
Open http://localhost:8000/docs for the full, clickable API contract. Every route is under `/api/v1`, errors are `{"detail": "...", "code": "..."}`, and list endpoints take `page` and `page_size`.

| Setting | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/nrrms` | Connect as `nrrms_api` to run under row-level security, as in Docker |
| `JWT_SECRET` | none | Signs login tokens; at least 32 random characters |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token lifetime |

## Layout

```
app/
  main.py          mounts every module's router under /api/v1
  core/            config.py, auth.py (bcrypt, JWT, get_current_user, require_role()),
                   database.py (sets app.user_id and app.user_role for each request, so RLS knows the caller)
  jobs/            hold_expiry.py (every minute), run_operations.py (charts at cut-off, view refresh)
  modules/         one package per group: router.py, service.py, schemas.py, sql.py, README.md
tests/             pytest, one folder or file set per module
```

## Modules

Each module README lists its members, the SQL object each member explains, and its endpoints.

| Module | Group | README |
|---|---|---|
| `modules/accounts/` | G1 · Accounts and access | [README](app/modules/accounts/README.md) |
| `modules/network/` | G2 · Rail network and journey planner | [README](app/modules/network/README.md) |
| `modules/inventory/` | G3 · Inventory and fares | [README](app/modules/inventory/README.md) |
| `modules/reservations/` | G4 · Reservation engine | [README](app/modules/reservations/README.md) |
| `modules/wallet/` | G5 · Wallet and ticketing | [README](app/modules/wallet/README.md), endpoint errors below |
| `modules/operations/` | G6 · Operations and analytics | [README](app/modules/operations/README.md) |

## Authentication

`POST /auth/login` returns a JWT; send it as `Authorization: Bearer ...`. `get_current_user` reads it, and `require_role(["staff", "admin"])` guards `/ops/*` (staff, admin) and `/reports/*` (admin). For every request, `core/database.py` sets `app.user_id` and `app.user_role` with `set_config(..., true)`, which lasts only for that transaction, and PostgreSQL's row-level security policies read them.

## Background jobs

```bash
python -m app.jobs.hold_expiry                               # release unpaid holds after 10 minutes
python -m app.jobs.run_operations --loop --every 15          # prepare charts at the cut-off, refresh report views
```
Run them from `backend/`. Docker Compose runs both in the `worker` service.

## G5 wallet and ticketing: endpoints and errors

| Endpoint | Notes |
|---|---|
| `GET /api/v1/wallet` | Balance (creates the wallet on first use) |
| `POST /api/v1/wallet/topups` | Simulated UPI top-up. `Idempotency-Key` header (body `idempotency_key` still accepted); a retry replays the first result, a reused key with another amount is `409` |
| `GET /api/v1/wallet/transactions?page=&page_size=` | Statement, newest first, with `balance_after` (running balance from `v_wallet_statement`). `limit`/`offset` still work for older clients |
| `GET /api/v1/reservations/{pnr}/payment` | Fare, status and balance before paying; `404 RESERVATION_NOT_FOUND` |
| `POST /api/v1/reservations/{pnr}/pay` | Pays from the wallet through `pay_reservation()`; `402 INSUFFICIENT_FUNDS`, `404 RESERVATION_NOT_FOUND`, `409 RESERVATION_NOT_PAYABLE`; a retry returns the original payment (`replayed: true`) |
| `GET /api/v1/refunds?page=&page_size=` | Refund history |
| `GET /api/v1/tickets/{pnr}` · `.pdf` · `/qr.png` | E-ticket details, PDF (reportlab) and QR image (qrcode). Another user's PNR is `404 TICKET_NOT_FOUND` |

These routes return 401 without a signed-in user. The ticket PDF shows the PNR, ticket number, fare paid, issue time and QR.

## Tests

```bash
cd backend && ruff check . && pytest tests -q
python scripts/smoke_test.py http://127.0.0.1:8000     # from the repo root, against a running API
```
Mocked router tests always run. The integration tests run against the migrated PostgreSQL database (`DATABASE_URL`) and are skipped when it is not reachable.
