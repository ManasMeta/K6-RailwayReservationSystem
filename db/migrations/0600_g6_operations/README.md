# G6 Operations & Analytics — Database Module

**Author:** G6-DB (G6 Member 3)  
**Module:** Operations and Analytics  
**Migration Range:** `0600_g6_operations/` (`0601`–`0699`)

---

## 1. Tables Owned

| Table | Migration File | Description | Primary Key & Constraints |
|---|---|---|---|
| `train_runs` | `0601_g6_train_runs.sql` | Operational state of a train on a given date | `run_id` (IDENTITY), `UNIQUE (train_id, run_date)`, `CHECK (status IN ('SCHEDULED', 'DELAYED', 'CANCELLED', 'DEPARTED'))` |
| `run_events` | `0602_g6_run_events.sql` | Event log for delays, cancellations, chart prep | `event_id` (IDENTITY), index on `(run_id, recorded_at)` |
| `charts` | `0603_g6_charts.sql` | Final chart record per run | `chart_id` (IDENTITY), `UNIQUE (run_id)` |
| `chart_entries` | `0604_g6_chart_entries.sql` | Final passenger berth assignments on chart | `entry_id` (IDENTITY), `UNIQUE (chart_id, passenger_id)` |

---

## 2. Views, Triggers & Materialized Views Owned

### `v_pnr_status` (`0605_g6_v_pnr_status.sql`)
* **Type:** Multi-table Join View (6 tables: `reservations`, `reservation_passengers`, `trains`, `stations` origin, `stations` dest, `train_runs`)
* **Purpose:** Single query interface for the public/passenger PNR status page.
* **Viva Concept:** Join optimization, `LEFT JOIN` handling when operational runs aren't created yet.

### `trg_train_runs_cancel` / `fn_cancel_run_reservations()` (`0606_g6_run_cancel_trigger.sql`)
* **Type:** `AFTER UPDATE OF status` Trigger & PL/pgSQL Function
* **Condition:** `WHEN (NEW.status = 'CANCELLED' AND OLD.status IS DISTINCT FROM 'CANCELLED')`
* **Purpose:** Cascades train cancellations to cancel each active passenger via `cancel_passenger()`, automatically initiating G5 wallet refunds and logging a `CANCEL` event in `run_events`.
* **Viva Concept:** Atomic declarative integrity, preventing partial refund failures.

### `mv_occupancy` (`0607_g6_mv_occupancy.sql`)
* **Type:** Materialized View with Unique Index (`uq_mv_occupancy` on `(run_id, class_code)`)
* **Purpose:** Pre-computes occupancy percentages for analytics dashboard.
* **Viva Concept:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` without locking read queries.

---

## 3. Seed & Test Files

* **Seed:** `db/seeds/g6_demo_data.sql` (16 bookings made through `book_tickets()` and `pay_reservation()`, 15 runs, delays, charts) after `db/seeds/g1_demo_users.sql`. Load order: all migrations, `load_sample.py`, `generate_inventory.py`, g1_demo_users, g6_demo_data.
* **Test Suite:** `db/tests/g6_operations.sql` and `g6_prepare_chart.sql` build their own booking, then verify unique constraints, check constraints, view output, cancel trigger cascading, and failure cases inside a transactional rollback.
