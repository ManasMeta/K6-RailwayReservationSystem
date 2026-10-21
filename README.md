# Yatrio

**Railway reservation and management system.** Search trains between any two stations (including journeys with one change), pay from an in-app wallet, get an e-ticket with a QR code, and get refunds automatically when you cancel.

Yatrio is a six-group college project in one monorepo. PostgreSQL 16 holds the schema and the business rules, FastAPI is a thin API on top, and React + Vite is the UI.

| | |
|---|---|
| Database | PostgreSQL 16 (Docker Compose for local development) |
| Backend | FastAPI, Python 3.12, psycopg 3 with parameterised SQL |
| Frontend | React, Vite, TypeScript, TanStack Query |
| Plan | [Implementation plan (PDF)](docs/Railway%20Reservation%20System%20Implementation%20Plan.pdf) |

## What works today

| Group | Module | State | Docs |
|---|---|---|---|
| G1 | Accounts and access | Not merged yet | |
| G2 | Rail network and journey planner | **Done** | [docs/g2-database-design.md](docs/g2-database-design.md) |
| G3 | Inventory and fares | Not merged yet | |
| G4 | Reservation engine | Not merged yet | |
| G5 | Wallet and ticketing | **Done** | [docs/g5-database-design.md](docs/g5-database-design.md) |
| G6 | Operations and analytics | Not merged yet | |

### G2: rail network and journey planner
- Imports the master timetable (186,124 stop rows) through a staging table into `stations`, `trains`, `train_stops` and `train_running_days`; rerunning the import changes nothing.
- Works out which day of the journey each stop falls on with window functions, and stores arrival and departure as generated minute columns, so time arithmetic is plain subtraction.
- Direct trains and **one-change journeys**: the second train must leave 30 minutes to 6 hours after the first arrives, ranked by total time.
- Station autocomplete backed by a trigram GIN index (an `EXPLAIN ANALYZE` comparison is in the G2 doc).
- UI: journey search with Direct and One change tabs, and a train timetable page.

### G5: wallet and ticketing
- A **double-entry ledger**: every top-up, payment and refund is a balanced ledger transaction, checked by a deferred constraint trigger at commit.
- Simulated UPI top-ups with an `Idempotency-Key`, so a retried request never credits twice.
- `pay_reservation()` locks the wallet row, checks the balance and confirms the reservation in one transaction; a retry returns the original payment.
- Refunds by hours before departure (90% at 48h or more, 75% from 12h, 50% from 4h, none below; tiers live in the `refund_rules` table), capped at what was paid, and in full when the railway cancels a run.
- Statement with a running balance, e-ticket page with QR code, and PDF download.

### Still to come
Accounts and login (G1), segment-wise berth inventory and fares (G3), the reservation engine with Tatkal and RAC/WL (G4), and staff operations and analytics (G6).

G5 depends on G1's `users` and G4's `reservations`, `cancellations` and `confirm_reservation()`. Until those merge, G5's migrations only apply where those objects exist, and `db/tests/support/g5_contract_stubs.sql` provides stand-ins for local trials. The assumed columns are listed in the G5 doc. Wallet, payment and ticket routes return `401` until G1's authentication provides the signed-in user.

## Run it locally

You need Docker, Python 3.12, Node 20 or newer, and `psql` (or use `docker exec` as below).

```bash
git clone https://github.com/ManasMeta/K6-RailwayReservationSystem.git
cd K6-RailwayReservationSystem

# 1. database
docker compose up -d db
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nrrms

# 2. G2 schema and the sample timetable
for f in db/migrations/0200_g2_network/*.sql; do
  docker exec -i nrrms-postgres psql -U postgres -d nrrms -v ON_ERROR_STOP=1 < "$f"
done
pip install -r backend/requirements.txt
python db/import/load_sample.py

# 3. G5 schema (stand-ins for the G1 and G4 tables, for a local trial only)
docker exec -i nrrms-postgres psql -U postgres -d nrrms < db/tests/support/g5_contract_stubs.sql
for f in db/migrations/0500_g5_wallet/*.sql; do
  docker exec -i nrrms-postgres psql -U postgres -d nrrms -v ON_ERROR_STOP=1 < "$f"
done

# 4. backend and frontend
uvicorn app.main:app --app-dir backend --reload     # API docs at http://localhost:8000/docs
cd frontend && npm ci && npm run dev                 # app at http://localhost:5173
```

Load the real timetable with `python db/import/load_train_details.py Train_details_22122017.csv`.

Try the search at `http://localhost:5173/?from=HWH&to=LKO&date=2026-11-02` (the sample has one change at Kanpur).

## API

Everything is under `/api/v1`; errors are `{"detail": "...", "code": "..."}`. Full contract at `/docs`.

| Endpoint | Group | Purpose |
|---|---|---|
| `GET /stations?q=` | G2 | Station autocomplete |
| `GET /journeys?from=&to=&date=` | G2 | Direct and one-change journeys |
| `GET /trains/{no}/timetable` | G2 | Stops, days and running days |
| `GET /wallet`, `POST /wallet/topups` | G5 | Balance, simulated top-up |
| `GET /wallet/transactions` | G5 | Statement with running balance |
| `GET /reservations/{pnr}/payment`, `POST /reservations/{pnr}/pay` | G5 | Fare quote, pay from wallet |
| `GET /refunds` | G5 | Refund history |
| `GET /tickets/{pnr}`, `.pdf`, `/qr.png` | G5 | E-ticket details, PDF, QR image |

## Repository layout

```
db/
  migrations/      plain SQL in filename order, one folder per group
                   0200_g2_network/  0500_g5_wallet/  (ranges reserved: G1 0100, G3 0300, G4 0400, G6 0600)
  import/          CSV and workbook loaders
  seeds/           small fixtures
  tests/           SQL assertion scripts (support/ holds stand-ins for other groups' tables)
backend/app/
  core/            config, database connection, auth dependency
  modules/         network/ (G2), wallet/ (G5)
backend/tests/     pytest
frontend/src/
  features/        network/ (G2), wallet/ (G5): one folder per group
docs/              plan and per-group design notes
```

## Tests

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g2_network.sql         # after load_sample.py
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g2_import_idempotent.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g5_wallet.sql
cd backend && pytest tests -q                                                # integration tests skip if the database is not ready
cd frontend && npm run lint && npm test && npm run build
```

## Team

| Group | Members |
|---|---|
| G2 Rail network | Shambhavi, Sanskar |
| G5 Wallet and ticketing | Mangesh (frontend), Aditya (backend), Aditya Patil (database) |

The other groups are listed in the implementation plan.

## Working agreements
- A group writes only inside its own folders. Shared folders change by pull request.
- A migration number belongs to its group's range, and a foreign key points only to a lower range.
- A merged migration is never edited; fixes go in a new file.
- Money is `NUMERIC(10,2)`, never a float. Backend SQL is parameterised; string-built SQL fails review.
- Branches: member branch, then `group/<name>`, then `develop`, then `main`. Commit messages follow Conventional Commits, for example `feat(g5): add refund rules`.
