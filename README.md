# NRRMS — National Railway Reservation and Management System

Six group modules in one monorepo: PostgreSQL 16 holds the schema and business rules, FastAPI is a thin API layer, React + Vite (TypeScript) is the UI. The implementation plan is in [docs/](docs/Railway%20Reservation%20System%20Implementation%20Plan.pdf).

## Module status

| Group | Module | State on `main` |
|---|---|---|
| G1 | Accounts and access | Not merged yet (`users`, JWT, row-level security) |
| G2 | Rail network and journey planner | Done: schema, CSV import, direct and one-change search, API, UI. See [docs/g2-database-design.md](docs/g2-database-design.md) |
| G3 | Inventory and fares | Not merged yet |
| G4 | Reservation engine | Not merged yet |
| G5 | Wallet and ticketing | Done: ledger, top-ups, payment, refunds, e-ticket PDF/QR, API, UI. See [docs/g5-database-design.md](docs/g5-database-design.md) |
| G6 | Operations and analytics | Not merged yet |

G5 depends on G1's `users` and G4's `reservations`, `cancellations` and `confirm_reservation()`. Until those merge, the G5 migrations only apply where those objects exist; `db/tests/support/g5_contract_stubs.sql` provides stand-ins for testing. The assumed columns are listed in [docs/g5-database-design.md](docs/g5-database-design.md). Payment, refund and ticket routes return `401` until G1's authentication sets `request.state.user_id`.

## Stack
- PostgreSQL 16 (Docker Compose for local development)
- FastAPI, Python 3.12
- React + Vite, TypeScript, TanStack Query

## Quick start

```bash
docker compose up -d db
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nrrms

# G2: network schema and sample timetable
for f in db/migrations/0200_g2_network/*.sql; do docker exec -i nrrms-postgres psql -U postgres -d nrrms -v ON_ERROR_STOP=1 < "$f"; done
python db/import/load_sample.py

# G5 (needs G1/G4 objects, or the stand-ins for a local trial)
docker exec -i nrrms-postgres psql -U postgres -d nrrms < db/tests/support/g5_contract_stubs.sql
for f in db/migrations/0500_g5_wallet/*.sql; do docker exec -i nrrms-postgres psql -U postgres -d nrrms -v ON_ERROR_STOP=1 < "$f"; done

pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload          # http://localhost:8000/docs
cd frontend && npm ci && npm run dev                      # http://localhost:5173
```

The real timetable is loaded with `python db/import/load_train_details.py Train_details_22122017.csv`; see the G2 doc.

## Tests

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g2_network.sql      # after load_sample.py
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g5_wallet.sql
cd backend && pytest tests -q
cd frontend && npm run lint && npm test && npm run build
```

## Rules that keep merges clean
- A group writes only inside its own folders; migration numbers are reserved by range (G2 0200–0299, G5 0500–0599).
- A merged migration is never edited; fixes go in a new file.
- Money is `NUMERIC(10,2)`, never float. Backend SQL uses parameterised queries only.
