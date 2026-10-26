# G6: Operations and analytics

**Group G6:** Ketaki (32209), Pavitra (32216), Aarshia (32218)

Staff run the railway (delays, cancellations, final charts) and admins see how full and how profitable each train is. Design notes are in [docs/g6-database-design.md](../../../../docs/g6-database-design.md) and [db/migrations/0600_g6_operations/README.md](../../../../db/migrations/0600_g6_operations/README.md).

## Members and the SQL each one explains

| Member | Builds | SQL object |
|---|---|---|
| M1 Frontend | Public PNR status page; staff console (run board, delay entry, cancel a run, coach-wise chart); admin dashboard with Recharts | `mv_revenue` with `GROUP BY GROUPING SETS ((day), (class), (day, class), ())` and `REFRESH MATERIALIZED VIEW CONCURRENTLY` (`0621`, `0623`) |
| M2 Backend | `GET /pnr/{pnr}`; staff `/ops/runs`, `/delay`, `/cancel`, `/chart`; admin `/reports/*`; jobs for chart preparation and view refresh | `prepare_chart(run_id)`: PL/pgSQL explicit cursor over RAC/WL passengers in booking order, filling freed berths, writing `chart_entries`, locking the run (`0620`) |
| M3 Database | `train_runs`, `run_events`, `charts`, `chart_entries`, `v_pnr_status`, `mv_occupancy` | `v_pnr_status` (six-table join, `0605`) and the trigger that cancels a `CANCELLED` run's reservations through G4's `cancel_passenger()` so G5 refunds in full (`0606`) |

## Endpoints (`/api/v1`)

| Endpoint | Who |
|---|---|
| `GET /pnr/{pnr}` | anyone (names masked) |
| `GET /ops/runs?run_date=&page=&page_size=`, `GET /ops/runs/{id}` | staff, admin |
| `POST /ops/runs/{id}/delay`, `POST /ops/runs/{id}/cancel` | staff, admin |
| `POST /ops/runs/{id}/chart`, `GET /ops/runs/{id}/chart` | staff, admin |
| `GET /reports/revenue`, `/occupancy`, `/wl-conversion`, `/busiest-segments`; `POST /reports/refresh` | admin |

## Background jobs

`app/jobs/run_operations.py --loop --every 15` prepares charts at the cut-off and refreshes `mv_occupancy` and `mv_revenue` (the compose `worker` service runs it next to `app/jobs/hold_expiry.py`).

## Tables and migrations (`0600`-`0699`)

`0601`-`0604` tables, `0605` `v_pnr_status`, `0606` run-cancel trigger, `0607` `mv_occupancy`, `0619` chart columns, `0620` `prepare_chart()`, `0621` `mv_revenue`, `0622` audit, `0623` refresh functions; `0624`/`0625` are platform grant fixes (see G1).

## Tests

- `db/tests/g6_operations.sql`, `db/tests/g6_prepare_chart.sql`.
- `backend/tests/operations/`: access by role, runs, actions, chart, PNR, reports, jobs.
