# G2 Rail Network & Journey Planner

Group: G2 — Shambhavi, Sanskar  
Branch: `group/g2-network`  
Migrations: `db/migrations/0200_g2_network/` (range 0200–0299). G2 depends on no other group's tables; only the `pg_trgm` extension, which `0201` creates with `IF NOT EXISTS` (G1's `0000_platform` may create it first).

## Tables

| Table | Key | Purpose |
|---|---|---|
| `zones` | `zone_code` unique | Railway zones (loaded from the workbook's Stations sheet) |
| `stations` | `station_code` unique | One row per station; `zone_id` optional |
| `trains` | `train_no` unique | Train master with source and destination station |
| `train_stops` | `(train_id, seq)` | Timetable. `day_offset`, plus generated `arrival_minute` and `departure_minute` |
| `train_running_days` | `(train_id, weekday)` | ISO weekday (1 = Monday) the train leaves its origin; import makes every train daily |
| `staging_train_stops` | none | Raw text landing table for the CSV; truncated by the import |

Contract for G3, G4 and G6: `train_id`, `station_id`, and `train_stops.seq` with `day_offset`.

### Time model

`day_offset` is the number of days between the train's origin departure date and the day it **arrives** at the stop (origin = 0). `arrival_minute` / `departure_minute` are `GENERATED ALWAYS AS (...) STORED` minutes since 00:00 of the origin day, so time arithmetic is plain integer subtraction:

* ride time between stops = `to.arrival_minute - from.departure_minute`
* a halt that crosses midnight (arrive 23:50, leave 00:10) adds 1440 to the departure only.

## Import pipeline

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nrrms
# apply db/migrations/0200_g2_network/*.sql in filename order, then:
python db/import/load_train_details.py path/to/Train_details_22122017.csv
python db/import/load_zones.py path/to/Indian_Railway_Reservation_System.xlsx   # optional
python db/import/load_sample.py                                                 # CI fixture
```

1. `load_train_details.py` streams the Latin-1 CSV into `staging_train_stops` with `COPY`, all columns as text.
2. `SELECT import_train_details()` (migration `0208`) cleans it:
   `TRIM`/upper-casing, quote removal on train numbers, regex-guarded time and number casts, malformed rows skipped, `DISTINCT ON` for duplicates. It then fills `stations`, `trains`, `train_running_days` and `train_stops`, each with `ON CONFLICT DO NOTHING`, and truncates staging.
3. `day_offset` comes from window functions over each train ordered by `seq`: a new day starts when a stop's first time is earlier than the previous stop's departure, and a midnight-crossing halt is counted from the next stop on.
4. The CSV stores `00:00:00` for the origin arrival and the last departure; the import turns those into `NULL`.

Rerunning is a no-op (`db/tests/g2_import_idempotent.sql`).

## Journey search (SQL functions)

* `search_direct_journeys(from, to, date)` — trains with both stations in order, running on the origin run date `date − days elapsed when it leaves the boarding stop`.
* `search_connecting_journeys(from, to, date, limit)` — leg 1 `A → X` and leg 2 `X → B` on different trains; leg 2 leaves between 30 minutes and 6 hours after leg 1 arrives (it may run the next calendar day). The best leg 2 per `(train 1, train 2, X)` is kept and rows are ranked with `ROW_NUMBER() OVER (ORDER BY total_minutes, wait_minutes, …)`. Searching a station to itself returns nothing.

## Trigram index and EXPLAIN ANALYZE

`ix_stations_name_trgm` is a `GIN (name gin_trgm_ops)` index, so `ILIKE '%kanp%'` does not scan the whole table. `db/import/g2_explain_demo.sql` pads `stations` to 8,151 rows, runs `EXPLAIN ANALYZE` without and with the index, and rolls back. Result on PostgreSQL 16 (local Docker):

| | Plan | Execution time |
|---|---|---|
| Before | `Seq Scan on stations`, 8,155 rows removed by filter | 8.4 ms |
| After | `Bitmap Index Scan on ix_stations_name_trgm` | 0.07 ms |

The "after" run sets `enable_seqscan = off`, because with 8k small rows the planner may still prefer a scan; the index matters as the table and query volume grow.

## Backend (`backend/app/modules/network/`)

Routers call SQL through parameterised queries only (`sql.py`). Errors use `{"detail": "...", "code": "..."}`.

| Endpoint | Notes |
|---|---|
| `GET /api/v1/stations?q=&page=&page_size=` | Name/code fragment search, exact code ranked first, then prefix, then similarity |
| `GET /api/v1/journeys?from=&to=&date=&limit=` | `direct[]` and `connecting[]`; `400 SAME_STATION`, `404 STATION_NOT_FOUND`, `422` on bad input |
| `GET /api/v1/trains/{train_no}/timetable` | Stops with `day_offset`, running days; `404 TRAIN_NOT_FOUND` |

## Frontend (`frontend/src/features/network/`)

Journey search page with station autocomplete (accessible combobox), date, a Direct / One change tab pair showing total time and the wait at the interchange, and a train timetable page. Search state lives in the URL (`/?from=HWH&to=LKO&date=2026-11-02`), so results can be shared.

## Tests

| Layer | Command |
|---|---|
| SQL | `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g2_network.sql` and `db/tests/g2_import_idempotent.sql` (after `load_sample.py`) |
| Backend | `pytest backend/tests/network` (mocked router tests always run; integration tests need the migrated database with the sample import and are skipped otherwise) |
| Frontend | `cd frontend && npm run lint && npm test && npm run build` |

## Assumptions to confirm

* `Train_details_22122017.csv` and the workbook were not available while building this, so the loader reads the 12-column layout by position and the fixture `db/seeds/g2_train_details_sample.csv` follows it. Run the real file once and check the station and train counts (expected about 8,151 and 11,113).
* `load_zones.py` guesses the Stations sheet layout (a "code" column and a "zone" column); check it against the real workbook.
