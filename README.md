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

## Database Architecture & Complete ER Model

Yatrio's database contains **32 tables and 2 materialized views in 3NF**, organized across 6 groups. Foreign keys strictly follow a monotonic hierarchy from higher-numbered groups to lower-numbered groups:
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
