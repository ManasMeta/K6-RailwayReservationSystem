# SQL tests

Each script runs in a transaction that is rolled back, so the database is left as it was. They run on the fully migrated database with the CI sample timetable (`load_sample.py`) and generated coaches (`generate_inventory.py`); each builds its own data through the real functions.

| Script | Group | What it proves |
|---|---|---|
| `g1_accounts.sql` | G1 | domains reject bad values; sign-up and login functions; row-level security as the `nrrms_app` role (a user sees only their own rows, staff see all, anonymous sees nothing); the reporting role cannot read password hashes or write; `fn_audit()` stores only changed columns |
| `g2_network.sql`, `g2_import_idempotent.sql` | G2 | network schema, journey search, import reruns are no-ops |
| `g3_inventory.sql` | G3 | segment-wise berth exclusion constraint, `free_berths()`, `calculate_fare()`, `availability_grid()` |
| `test_0400_reservations.sql` | G4 | PNR sequence, `book_tickets()`, segment reuse of one berth, RAC/WL promotion on cancel, hold expiry, booking window and Tatkal rules, pay then cancel then refund agree |
| `g5_wallet.sql` | G5 | refund tiers, `pay_reservation()` (replay, failures leave no trace), the cancellation refund trigger, running-balance statement |
| `g6_operations.sql`, `g6_prepare_chart.sql` | G6 | `train_runs` constraints, `v_pnr_status`, cancelling a run refunds everyone in full, `mv_occupancy`, `prepare_chart()` |

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/<script>.sql
for f in db/tests/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```
