# Database

Everything that makes RailYatri correct lives here: the schema, the business rules (functions, triggers, constraints, row-level security), the loaders that fill it, and the SQL tests that prove it. PostgreSQL 16.

## Migrations

Plain SQL files under `migrations/`, applied in filename order by `migrate.py`. Each group owns a number range, and a foreign key may only point to a lower range.

| Folder | Range | Owner | What it adds |
|---|---|---|---|
| `0000_platform/` | 0000–0099 | G1 (shared) | Extensions: `citext`, `pg_trgm`, `btree_gist` |
| `0100_g1_accounts/` | 0100–0199 | G1 | Users, roles, saved passengers, domains, app roles and `app_user_id()` / `app_user_role()`, RLS, `fn_audit()` |
| `0200_g2_network/` | 0200–0299 | G2 | Zones, stations, trains, stops, running days, import function, journey search |
| `0300_g3_inventory/` | 0300–0399 | G3 | Classes, quotas, concessions, fare slabs, coaches, berths, `berth_allocations` exclusion constraint, fares, availability |
| `0400_g4_reservations/` | 0400–0499 | G4 | Reservations, passengers, cancellations, `book_tickets()`, `cancel_passenger()`, booking window trigger, `booking_rules` |
| `0500_g5_wallet/` | 0500–0599 | G5 | Wallets, double-entry ledger, top-ups, payments, refund rules, refunds, e-tickets, `pay_reservation()` |
| `0600_g6_operations/` | 0600–0699 | G6 | Train runs, run events, charts, `v_pnr_status`, `prepare_chart()`, `mv_occupancy`, `mv_revenue` |

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nrrms
python db/migrate.py check     # numbering, duplicates and group ranges only; touches nothing
python db/migrate.py up        # apply what is new; a second run changes nothing
```

Applied versions are recorded in `schema_migrations`. A merged migration is never edited: a fix is a new file in the group's range.

## Roles

| Role | Login | Used by | Can do |
|---|---|---|---|
| `postgres` | yes | migrations, imports, seeds | everything; bypasses row-level security |
| `nrrms_app` | no (group) | the API and worker, through `nrrms_api` | read and write under row-level security |
| `nrrms_api` | yes | the backend's `DATABASE_URL` | member of `nrrms_app`; made by `create_login_role.py` |
| `nrrms_report` | no (group) | reporting | read-only, cannot read password hashes |

```bash
APP_DB_USER=nrrms_api APP_DB_PASSWORD=choose-one python db/create_login_role.py   # idempotent
```

## Loading data

| Script | Group | What it does |
|---|---|---|
| `import/load_sample.py` | G2 | The 1,899-row sample timetable (86 stations, 475 trains) used by CI and local development |
| `import/load_train_details.py CSV` | G2 | The full `Train_details_22122017.csv`: 186,124 stop rows into 8,151 stations through `staging_train_stops` |
| `import/load_zones.py XLSX` | G2 | Railway zones from the workbook's Stations sheet |
| `import/g2_explain_demo.sql` | G2 | `EXPLAIN ANALYZE` of station search before and after the trigram index |
| `import/generate_inventory.py` | G3 | Coaches and berths for every train from `train_consist` (SL 72, 3A 64, 2A 48 berths) |
| `import/load_workbook.py XLSX` | G3 | Classes, quotas, concessions and fare slabs from `Lookup_Tables` and `Fare_Matrix` |
| `import/load_pnr_master.py XLSX` | G4 | Demo reservations from the `PNR_Master` sheet, booked through `book_tickets()` |

Every loader is safe to rerun. Load the timetable before generating inventory.

## Demo data (local only)

| Seed | What it adds |
|---|---|
| `seeds/g1_demo_users.sql` | `alice`, `bob`, `carol` (passengers), `staff`, `admin` at `@yatrio.test`, password `yatrio-demo-1`. Safe to rerun. |
| `seeds/g6_demo_data.sql` | Wallet money, bookings through the real `book_tickets()` and `pay_reservation()`, past, delayed and scheduled runs, charts. Dates are relative to today. Run once. |

Never load the seeds into a shared or production database: the passwords are public.

## Tests

`tests/` holds one or more SQL scripts per group. Each runs in a transaction that is rolled back, so the database is left as it was. What each one proves is in [tests/README.md](tests/README.md).

```bash
for f in db/tests/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

## Design notes

[G2](../docs/g2-database-design.md) · [G3](../docs/g3-database-design.md) · [G4](../docs/g4-database-design.md) · [G5](../docs/g5-database-design.md) · [G6](../docs/g6-database-design.md) · G1 is documented in [backend/app/modules/accounts/README.md](../backend/app/modules/accounts/README.md). The full ER diagram is in the [main README](../README.md#six-groups-one-database).
