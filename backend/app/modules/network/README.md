# G2: Rail network and journey planner

Direct trains and one-change connections between any two of 8,151 stations on a date. Design notes, the import pipeline and the `EXPLAIN ANALYZE` comparison are in [docs/g2-database-design.md](../../../../docs/g2-database-design.md).

## Members and the SQL each one explains

| Member | Builds | SQL object |
|---|---|---|
| M1 Frontend | Journey search with station autocomplete; Direct and One change tabs with total time and interchange wait; timetable page | Trigram GIN index on `stations.name`, `EXPLAIN ANALYZE` before and after (`0207`, `db/import/g2_explain_demo.sql`) |
| M2 Backend | `GET /stations?q=`, `GET /journeys`, `GET /trains/{no}/timetable`; input validation | `search_connecting_journeys()`: legs meet at a common station, leg 2 leaves 30 min to 6 h after leg 1 arrives, ranked with `ROW_NUMBER()` (`0210`) |
| M3 Database | `zones`, `stations`, `trains`, `train_stops`, `train_running_days`; the CSV import | `import_train_details()`: 186,124 rows normalised to 8,151 stations, `day_offset` from a window over `LAG(departure)`, `GENERATED ALWAYS AS (...) STORED` minute columns (`0204`, `0208`) |

## Endpoints (`/api/v1`)

| Endpoint | Notes |
|---|---|
| `GET /stations?q=&page=&page_size=` | Autocomplete by code or name |
| `GET /journeys?from=&to=&date=` | `direct` and `connecting` lists |
| `GET /trains/{train_no}/timetable` | Stops with day offsets and running days |

## Tables and migrations (`0200`-`0299`)

`0201` zones, `0202` stations, `0203` trains, `0204` train_stops, `0205` train_running_days, `0206` staging_train_stops, `0207` trigram index, `0208` `import_train_details()`, `0209` `search_direct_journeys()`, `0210` `search_connecting_journeys()`.

Loaders: `db/import/load_train_details.py CSV` (the full timetable), `db/import/load_sample.py` (the 1,899-row CI sample), `db/import/load_zones.py WORKBOOK.xlsx` (zones from the Stations sheet).

## Tests

- `db/tests/g2_network.sql`, `db/tests/g2_import_idempotent.sql`.
- `backend/tests/network/`: router, loaders, and integration against the sample timetable.
