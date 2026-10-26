# RailYatri

**Railway reservation and management system.** Search trains between any two stations (including journeys with one change), pay from an in-app wallet, get an e-ticket with a QR code, and get refunds automatically when you cancel.

RailYatri is a six-group college project in one monorepo. PostgreSQL 16 holds the schema and the business rules, FastAPI is a thin API on top, and React + Vite is the UI.

| | |
|---|---|
| Database | PostgreSQL 16 (Docker Compose for local development) |
| Backend | FastAPI, Python 3.12, psycopg 3 with parameterised SQL |
| Frontend | React, Vite, TypeScript, TanStack Query |
| Plan | [Implementation plan (PDF)](docs/Railway%20Reservation%20System%20Implementation%20Plan.pdf) |

## What works today

Every module in the implementation plan is built, merged and tested together on one database.

| Group | Module | State | Docs |
|---|---|---|---|
| G1 | Accounts and access | **Done** | [db/migrations/0100_g1_accounts](db/migrations/0100_g1_accounts) |
| G2 | Rail network and journey planner | **Done** | [docs/g2-database-design.md](docs/g2-database-design.md) |
| G3 | Inventory and fares | **Done** | [docs/g3-database-design.md](docs/g3-database-design.md) |
| G4 | Reservation engine | **Done** | [docs/g4-database-design.md](docs/g4-database-design.md) |
| G5 | Wallet and ticketing | **Done** | [docs/g5-database-design.md](docs/g5-database-design.md) |
| G6 | Operations and analytics | **Done** | [docs/g6-database-design.md](docs/g6-database-design.md) |

### G1: accounts and access
- Sign-up, login (bcrypt + JWT), token refresh, profile, and up to ten saved co-travellers. Roles are `passenger`, `staff` and `admin`; sign-up only ever creates passengers.
- **Row-level security**: the API connects as the `nrrms_app` role, and PostgreSQL itself hides other users' accounts, bookings, wallets and saved passengers (policy `user_id = app_user_id()`). Staff, admins and background jobs can see all rows; the `nrrms_report` role is read-only and cannot read password hashes.
- `CREATE DOMAIN` types `mobile_no`, `pincode` and `email_addr` (citext) reused by every group.
- `fn_audit()` trigger stores only the columns that changed, as JSONB, and never a password hash; users, reservations, wallets and train runs are audited.
- UI: sign-up, login and profile pages, saved-passenger manager, and a menu that follows the signed-in role.

### G2: rail network and journey planner
- Imports the master timetable (186,124 stop rows) through a staging table into `stations`, `trains`, `train_stops` and `train_running_days`; rerunning the import changes nothing.
- Works out which day of the journey each stop falls on with window functions, and stores arrival and departure as generated minute columns, so time arithmetic is plain subtraction.
- Direct trains and **one-change journeys**: the second train must leave 30 minutes to 6 hours after the first arrives, ranked by total time.
- Station autocomplete backed by a trigram GIN index (an `EXPLAIN ANALYZE` comparison is in the G2 doc).
- UI: journey search with Direct and One change tabs, and a train timetable page.

### G3: inventory and fares
- **Segment-wise berths**: a berth freed at an intermediate station is resold for the rest of the route, enforced at the database level by a PostgreSQL `btree_gist` exclusion constraint on `berth_allocations` (`stops INT4RANGE`).
- Automated coach and berth generator from `train_consist` (Sleeper 72 berths, 3A 64 berths, 2A 48 berths); `python db/import/generate_inventory.py` runs it for every train.
- `calculate_fare(...)` returns base fare, reservation fee, superfast charge, tatkal surcharge, concession discounts, and AC GST.
- `availability_grid(...)` set-returning function generating 6-day date matrices cross-joined with active train classes.
- UI: interactive availability matrix in search cards, fare breakup modal, and coach layout berth schematic.

### G4: reservation engine
- Booking holds berths for ten minutes as `PENDING_PAYMENT`; `book_tickets()` gives each passenger a confirmed berth, then RAC, then a waiting-list number, catching `exclusion_violation` when two sales race. Twenty parallel requests for one berth sell it once.
- Booking window (60 days) and Tatkal opening hours are enforced by a trigger; fares are worked out per passenger with the right concession.
- `cancel_passenger()` frees the range and promotes RAC to confirmed and the waiting list to RAC. Expired holds are released every minute by a background job.
- UI: booking flow with hold timer and Tatkal countdown, My journeys, and cancel some or all passengers. The READ COMMITTED vs REPEATABLE READ demonstration is in the G4 doc.

### G5: wallet and ticketing
- A **double-entry ledger**: every top-up, payment and refund is a balanced ledger transaction, checked by a deferred constraint trigger at commit.
- Simulated UPI top-ups with an `Idempotency-Key`, so a retried request never credits twice.
- `pay_reservation()` locks the wallet row, checks the balance and confirms the reservation in one transaction; a retry returns the original payment.
- Refunds by hours before departure (90% at 48h or more, 75% from 12h, 50% from 4h, none below; tiers live in the `refund_rules` table), capped at what was paid, and in full when the railway cancels a run.
- Statement with a running balance, e-ticket page with QR code, and PDF download.

### G6: operations and analytics
- Staff console: run board, delay entry, cancel a whole run (every passenger is cancelled with a full refund by one trigger), and the final chart via `prepare_chart()`, a PL/pgSQL cursor that gives freed berths to RAC then waiting-list passengers in booking order.
- Public PNR status page (`v_pnr_status`, with passenger names masked).
- Admin dashboard: occupancy, revenue by day and class (`GROUPING SETS`, refreshed with `REFRESH MATERIALIZED VIEW CONCURRENTLY`), waiting-list conversion and busiest segments.
- Scheduled jobs prepare charts at the cut-off and refresh the views.

### Signing in
`POST /auth/signup` creates a passenger account; staff and admin roles are granted in the `user_roles` table. `POST /auth/login` returns a JWT that the frontend sends as `Authorization: Bearer ...`. Set `JWT_SECRET` in `.env`; there is no default, so the backend refuses to issue tokens without it. Wallet, payment, ticket, reservation and saved-passenger routes need a token, `/ops/*` needs staff or admin, and `/reports/*` needs admin.

Passengers pay through the wallet (`POST /reservations/{pnr}/pay`), which confirms the reservation in the database. `POST /reservations/{pnr}/confirm` is a staff and admin override.

## Database Architecture & Complete ER Model

RailYatri's database contains **32 tables and 2 materialized views in 3NF**, organized across 6 groups. Foreign keys strictly follow a monotonic hierarchy from higher-numbered groups to lower-numbered groups:
$$\text{G1 (Accounts)} \leftarrow \text{G2 (Network)} \leftarrow \text{G3 (Inventory)} \leftarrow \text{G4 (Reservations)} \leftarrow \text{G5 (Wallet)} \leftarrow \text{G6 (Operations)}$$

| Group | Module | Owned Tables & Views | Key Syllabus Concept |
|---|---|---|---|
| **G1** | Accounts & Access | `users`, `roles`, `user_roles`, `saved_passengers`, `audit_log` | DDL, domains, RLS, audit triggers |
| **G2** | Rail Network | `zones`, `stations`, `trains`, `train_stops`, `train_running_days`, `staging_train_stops` | Trigram GIN index, window functions, generated columns |
| **G3** | Inventory & Fares | `travel_classes`, `quotas`, `concession_rules`, `fare_slabs`, `train_consist`, `coaches`, `berths`, `berth_allocations` | `int4range` range types, `btree_gist` exclusion constraints, set-returning functions |
| **G4** | Reservation Engine | `reservations`, `reservation_passengers`, `cancellations` | Advisory locks (`pg_advisory_xact_lock`), stored procedures, RAC/WL queues |
| **G5** | Wallet & Ticketing | `wallets`, `ledger_txns`, `ledger_entries`, `topups`, `payments`, `refund_rules`, `refunds`, `e_tickets`, `v_wallet_statement` | Double-entry ledger, deferred constraint triggers, row locking (`FOR UPDATE`) |
| **G6** | Operations & Analytics | `train_runs`, `run_events`, `charts`, `chart_entries`, `v_pnr_status`, `mv_occupancy`, `mv_revenue` | PL/pgSQL cursors, materialized views, `GROUPING SETS` |

```mermaid
erDiagram
    %% ==========================================
    %% G1: ACCOUNTS & ACCESS
    %% ==========================================
    users {
        bigint user_id PK
        citext email UK
        text password_hash
        text full_name
        varchar mobile_no
        varchar pincode
        boolean is_active
        timestamptz created_at
    }

    roles {
        int role_id PK
        varchar role_name UK
    }

    user_roles {
        bigint user_id PK,FK
        int role_id PK,FK
        timestamptz granted_at
    }

    saved_passengers {
        bigint passenger_id PK
        bigint user_id FK
        text full_name
        int age
        varchar gender
        varchar berth_preference
        varchar id_type
        varchar id_number
        timestamptz created_at
    }

    audit_log {
        bigint log_id PK
        varchar table_name
        bigint record_id
        varchar action
        bigint changed_by FK
        jsonb old_values
        jsonb new_values
        timestamptz changed_at
    }

    %% ==========================================
    %% G2: RAIL NETWORK
    %% ==========================================
    zones {
        int zone_id PK
        varchar zone_code UK
        text zone_name
    }

    stations {
        int station_id PK
        varchar station_code UK
        text name
        int zone_id FK
        timestamptz created_at
    }

    trains {
        int train_id PK
        varchar train_no UK
        text train_name
        int source_station_id FK
        int dest_station_id FK
        timestamptz created_at
    }

    train_stops {
        int train_id PK,FK
        int seq PK
        int station_id FK
        time arrival
        time departure
        int day_offset
        numeric distance_km
        int arrival_minute
        int departure_minute
    }

    train_running_days {
        int train_id PK,FK
        int weekday PK
    }

    %% ==========================================
    %% G3: INVENTORY & FARES
    %% ==========================================
    travel_classes {
        varchar class_code PK
        varchar name
        numeric base_multiplier
        boolean has_ac
        timestamptz created_at
    }

    quotas {
        varchar quota_code PK
        varchar name
        timestamptz created_at
    }

    concession_rules {
        int rule_id PK
        varchar concession_code UK
        text description
        numeric discount_pct
        int min_age
        int max_age
        varchar gender
        timestamptz created_at
    }

    fare_slabs {
        int slab_id PK
        varchar class_code FK
        int min_km
        int max_km
        numeric base_fare
        numeric per_km_rate
        numeric reservation_fee
        numeric superfast_charge
        numeric tatkal_pct
        timestamptz created_at
    }

    train_consist {
        bigint consist_id PK
        bigint train_id FK
        varchar class_code FK
        int coach_count
        int seq_start
        timestamptz created_at
    }

    coaches {
        bigint coach_id PK
        bigint train_id FK
        varchar coach_code
        varchar class_code FK
        int total_berths
        timestamptz created_at
    }

    berths {
        bigint berth_id PK
        bigint coach_id FK
        int berth_number
        varchar berth_type
        timestamptz created_at
    }

    berth_allocations {
        bigint allocation_id PK
        bigint berth_id FK
        date run_date
        int4range stops
        bigint passenger_id FK
        varchar allocation_type
        timestamptz created_at
    }

    %% ==========================================
    %% G4: RESERVATION ENGINE
    %% ==========================================
    reservations {
        varchar pnr PK
        bigint user_id FK
        bigint train_id FK
        date run_date
        bigint from_station_id FK
        bigint to_station_id FK
        varchar class_code FK
        varchar quota_code FK
        numeric total_fare
        varchar status
        timestamptz hold_expires_at
        timestamptz departure_at
        timestamptz created_at
    }

    reservation_passengers {
        bigint passenger_id PK
        varchar pnr FK
        text full_name
        int age
        varchar gender
        varchar berth_preference
        int concession_rule_id FK
        varchar current_status
        bigint berth_id FK
        bigint coach_id FK
        int berth_no
        int rac_number
        int wl_number
        numeric fare
    }

    cancellations {
        bigint cancellation_id PK
        varchar pnr FK
        bigint passenger_id FK
        numeric fare_amount
        timestamptz cancelled_at
        boolean full_refund
        text reason
    }

    %% ==========================================
    %% G5: WALLET & TICKETING
    %% ==========================================
    wallets {
        bigint wallet_id PK
        bigint user_id UK,FK
        numeric balance
        timestamptz updated_at
    }

    ledger_txns {
        bigint ledger_txn_id PK
        varchar txn_type
        varchar idempotency_key UK
        varchar reference_id UK
        timestamptz posted_at
    }

    ledger_entries {
        bigint entry_id PK
        bigint ledger_txn_id FK
        bigint wallet_id FK
        varchar account_type
        varchar entry_side
        numeric amount
    }

    topups {
        bigint topup_id PK
        bigint wallet_id FK
        bigint ledger_txn_id FK
        numeric amount
        varchar idempotency_key UK
        varchar status
        timestamptz created_at
    }

    payments {
        bigint payment_id PK
        bigint wallet_id FK
        varchar pnr FK
        bigint ledger_txn_id FK
        numeric amount
        timestamptz created_at
    }

    refund_rules {
        int rule_id PK
        int min_hours
        int max_hours
        numeric refund_pct
    }

    refunds {
        bigint refund_id PK
        bigint wallet_id FK
        varchar pnr FK
        bigint cancellation_id FK
        bigint ledger_txn_id FK
        numeric refund_amount
        boolean full_refund
        timestamptz created_at
    }

    e_tickets {
        bigint ticket_id PK
        varchar pnr UK,FK
        varchar ticket_no UK
        timestamptz issued_at
        text qr_code_data
        text pdf_url
    }

    %% ==========================================
    %% G6: OPERATIONS & ANALYTICS
    %% ==========================================
    train_runs {
        bigint run_id PK
        bigint train_id FK
        date run_date
        varchar status
        int delay_minutes
        boolean chart_prepared
        timestamptz created_at
    }

    run_events {
        bigint event_id PK
        bigint run_id FK
        varchar event_type
        bigint station_id FK
        int delay_minutes
        text notes
        bigint recorded_by FK
        timestamptz recorded_at
    }

    charts {
        bigint chart_id PK
        bigint run_id UK,FK
        timestamptz prepared_at
        bigint prepared_by FK
        int final_vacant_berths
    }

    chart_entries {
        bigint entry_id PK
        bigint chart_id FK
        bigint passenger_id FK
        varchar coach_code
        int berth_no
        varchar berth_type
        varchar quota_code
    }

    %% ==========================================
    %% RELATIONSHIPS
    %% ==========================================
    users ||--o{ user_roles : "has"
    roles ||--o{ user_roles : "assigned"
    users ||--o{ saved_passengers : "saves"
    users ||--o{ audit_log : "performs"
    users ||--|| wallets : "owns"
    users ||--o{ reservations : "books"

    zones ||--o{ stations : "contains"
    stations ||--o{ trains : "source"
    stations ||--o{ trains : "dest"
    trains ||--|{ train_stops : "halts at"
    stations ||--o{ train_stops : "stop station"
    trains ||--|{ train_running_days : "runs on"

    trains ||--o{ train_consist : "configured with"
    travel_classes ||--o{ train_consist : "class"
    travel_classes ||--o{ fare_slabs : "rates"
    trains ||--o{ coaches : "consists of"
    travel_classes ||--o{ coaches : "class"
    coaches ||--|{ berths : "contains"
    berths ||--o{ berth_allocations : "allocated for range"

    trains ||--o{ reservations : "journey train"
    stations ||--o{ reservations : "from"
    stations ||--o{ reservations : "to"
    travel_classes ||--o{ reservations : "class"
    quotas ||--o{ reservations : "quota"
    reservations ||--|{ reservation_passengers : "includes"
    concession_rules ||--o{ reservation_passengers : "applies"
    berths ||--o{ reservation_passengers : "assigned"
    reservations ||--o{ cancellations : "cancels"
    reservation_passengers ||--o{ cancellations : "cancelled"
    reservation_passengers ||--o| berth_allocations : "holds range"

    wallets ||--o{ topups : "credits"
    wallets ||--o{ payments : "debits"
    wallets ||--o{ refunds : "credits"
    ledger_txns ||--|{ ledger_entries : "contains"
    wallets ||--o{ ledger_entries : "account"
    ledger_txns ||--o| topups : "records"
    ledger_txns ||--o| payments : "records"
    ledger_txns ||--o| refunds : "records"
    reservations ||--o| payments : "paid by"
    reservations ||--o| refunds : "refunded from"
    cancellations ||--o| refunds : "triggers"
    reservations ||--o| e_tickets : "issues"

    trains ||--o{ train_runs : "instances"
    train_runs ||--o{ run_events : "logs"
    stations ||--o{ run_events : "at station"
    users ||--o{ run_events : "staff operator"
    train_runs ||--o| charts : "produces"
    users ||--o{ charts : "prepared by"
    charts ||--|{ chart_entries : "lists"
    reservation_passengers ||--o| chart_entries : "manifested"
```

## Run it locally

You need Docker, Python 3.12 and Node 20 or newer.

### Everything in containers
```bash
cp .env.example .env     # then set JWT_SECRET, APP_DB_PASSWORD and POSTGRES_PASSWORD
docker compose up --build
```
The `migrate` service applies every migration and creates the restricted `nrrms_api` login; the API (port 8000) connects as that login, so row-level security applies. The `worker` runs the background jobs, and the UI is on http://localhost:8080. To load the sample timetable into that database:
```bash
docker compose run --rm -e DATABASE_URL=postgresql://postgres:$POSTGRES_PASSWORD@db:5432/nrrms migrate \
  sh -c "python db/import/load_sample.py && python db/import/generate_inventory.py"
```

### For development
```bash
docker compose up -d db
python -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt    # Windows: backend\.venv\Scripts\pip

export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nrrms
export JWT_SECRET=any-long-random-string-for-local-use

python db/migrate.py up                    # all groups, in order; a rerun changes nothing
python db/import/load_sample.py            # 1,899-row sample: 86 stations, 475 trains (or load_train_details.py CSV for the full file)
python db/import/generate_inventory.py     # coaches and berths
psql "$DATABASE_URL" -f db/seeds/g1_demo_users.sql   # optional demo accounts, see below
psql "$DATABASE_URL" -f db/seeds/g6_demo_data.sql    # optional demo bookings, runs and charts

uvicorn app.main:app --app-dir backend --reload      # API docs at http://localhost:8000/docs
cd frontend && npm ci && npm run dev                 # http://localhost:5173
```

Demo accounts (password `yatrio-demo-1`, local use only): `alice@yatrio.test`, `bob@yatrio.test`, `carol@yatrio.test` (passengers), `staff@yatrio.test`, `admin@yatrio.test`.

To run the API under row-level security as in production, create the restricted login and point `DATABASE_URL` at it:
```bash
APP_DB_USER=nrrms_api APP_DB_PASSWORD=choose-one python db/create_login_role.py
export DATABASE_URL=postgresql://nrrms_api:choose-one@localhost:5432/nrrms
```

## API

Everything is under `/api/v1`; errors are `{"detail": "...", "code": "..."}`. Full contract at `/docs`.

| Endpoint | Group | Who | Purpose |
|---|---|---|---|
| `POST /auth/signup`, `/auth/login`, `/auth/refresh` | G1 | anyone / signed in | Create account, sign in, renew token |
| `GET /me`, `PATCH /me` | G1 | signed in | Profile |
| `GET /me/passengers`, `POST /me/passengers`, `DELETE /me/passengers/{id}` | G1 | signed in | Saved passengers (up to 10) |
| `GET /stations?q=` | G2 | anyone | Station autocomplete |
| `GET /journeys?from=&to=&date=` | G2 | anyone | Direct and one-change journeys |
| `GET /trains/{no}/timetable` | G2 | anyone | Stops, days and running days |
| `GET /trains/{no}/availability`, `/fare`, `/trains/{no}/coaches`, `/coaches/{id}/layout` | G3 | anyone | Availability grid, fare breakup, free berths |
| `POST /reservations`, `GET /reservations`, `GET /reservations/{pnr}` | G4 | signed in | Hold berths, list, details |
| `POST /reservations/{pnr}/cancel` | G4 | owner | Cancel passengers, promote RAC and WL |
| `POST /reservations/{pnr}/confirm`, `/reservations/admin/release-expired-holds` | G4 | staff, admin | Overrides |
| `GET /wallet`, `POST /wallet/topups`, `GET /wallet/transactions` | G5 | signed in | Balance, simulated top-up, statement |
| `GET /reservations/{pnr}/payment`, `POST /reservations/{pnr}/pay` | G5 | owner | Fare quote, pay from wallet |
| `GET /refunds`, `GET /tickets/{pnr}`, `.pdf`, `/qr.png` | G5 | owner | Refunds, e-ticket |
| `GET /pnr/{pnr}` | G6 | anyone | Public PNR status (names masked) |
| `GET /ops/runs`, `POST /ops/runs/{id}/delay`, `/cancel`, `/chart`, `GET /ops/runs/{id}/chart` | G6 | staff, admin | Run board, delays, cancel a run, final chart |
| `GET /reports/revenue`, `/occupancy`, `/wl-conversion`, `/busiest-segments`, `POST /reports/refresh` | G6 | admin | Analytics |

## Repository layout

```
db/
  migrations/      plain SQL in filename order, one folder per group
                   0000_platform/ 0100_g1_accounts/ 0200_g2_network/ 0300_g3_inventory/
                   0400_g4_reservations/ 0500_g5_wallet/ 0600_g6_operations/
  import/          CSV loaders (G2) and the coach/berth generator (G3)
  seeds/           demo accounts and demo bookings (local use only)
  tests/           SQL assertion scripts, one or more per group
  migrate.py       the migration runner; create_login_role.py makes the restricted API login
backend/app/
  core/            config, database connection (sets the caller's id and role), JWT auth, require_role()
  jobs/            hold expiry, chart preparation, view refresh
  modules/         accounts/ network/ inventory/ reservations/ wallet/ operations/
backend/tests/     pytest, one folder per module
frontend/src/
  api/             axios client with the bearer-token interceptor
  features/        accounts/ network/ inventory/ reservations/ wallet/ operations/
scripts/           smoke_test.py: end-to-end check against a running API
docs/              plan and per-group design notes
.github/           CI, CD, CODEOWNERS, pull request template
```

## Tests

```bash
# database: migrate, import, then every SQL script
for f in db/tests/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done

# backend (needs the migrated database; integration tests skip if it is not reachable)
cd backend && ruff check . && pytest tests -q

# API end to end against a running server
python scripts/smoke_test.py http://127.0.0.1:8000

# frontend
cd frontend && npm run lint && npm test && npm run build
```

## CI/CD
`.github/workflows/ci.yml` runs on every pull request to `main`, `develop` or `group/**`: migration numbering and ranges, all migrations on a fresh PostgreSQL 16 (and a rerun that must change nothing), the sample import, every SQL script, `ruff` and `pytest`, an API smoke test as the restricted `nrrms_app` role, frontend lint, tests and build, and both Docker builds.

`.github/workflows/cd.yml` deploys after CI passes: a push to `develop` goes to staging and a push to `main` to production. Migrations run first, then the backend (Render deploy hook) and the frontend (Vercel). Secrets (`DATABASE_URL`, `APP_DB_PASSWORD`, `RENDER_DEPLOY_HOOK`, `VERCEL_TOKEN`) live in the GitHub Environments, never in the repository.

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
