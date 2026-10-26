# G3: Inventory and fares

Which berth is free between which two stops, and the price of any segment in any class and quota. Design notes are in [docs/g3-database-design.md](../../../../docs/g3-database-design.md).

## Members and the SQL each one explains

| Member | Builds | SQL object |
|---|---|---|
| M1 Frontend | Availability grid (6 dates x classes, AVL/RAC/WL for the segment), fare breakup modal, coach layout of free berths | `availability_grid(train, from, to, start_date)`: `generate_series` of dates `CROSS JOIN` classes (`0312`, `0313`) |
| M2 Backend | `GET /trains/{no}/availability`, `/fare`, `/coaches/{id}/layout` | `calculate_fare(...) RETURNS TABLE (base, reservation_fee, superfast, tatkal, concession, gst, total)`: slab by distance, concession % from `concession_rules` (`0311`) |
| M3 Database | `travel_classes`, `quotas`, `concession_rules`, `fare_slabs`, `train_consist`, `coaches`, `berths`, `berth_allocations`; workbook loader; berth generator | The exclusion constraint on `berth_allocations` (`EXCLUDE USING gist (berth_id WITH =, run_date WITH =, stops WITH &&)`) and `free_berths(...)` with `NOT EXISTS` (`0308`, `0310`) |

## Endpoints (`/api/v1`)

| Endpoint | Notes |
|---|---|
| `GET /travel-classes`, `GET /quotas` | Lookups |
| `GET /trains/{train_no}/availability?from=&to=&date=&days=&quota=` | Availability grid |
| `GET /fare?train_no=&from=&to=&class_code=&quota=&concession=` | Fare breakup |
| `GET /trains/{train_no}/coaches`, `GET /coaches/{coach_id}/layout?run_date=&from_seq=&to_seq=` | Coaches and free berths for a segment |

## Tables and migrations (`0300`-`0399`)

`0301`-`0304` lookups (seeded with standard values), `0305` train_consist, `0306` coaches, `0307` berths, `0308` berth_allocations, `0309` `generate_train_consist_coaches()`, `0310` `free_berths()`, `0311` `calculate_fare()`, `0312`/`0313` `availability_grid()`.

Loaders: `db/import/generate_inventory.py` (coaches and berths for every train), `db/import/load_workbook.py WORKBOOK.xlsx` (classes, quotas, concessions and fare slabs from the `Lookup_Tables` and `Fare_Matrix` sheets; reruns change nothing).

## Tests

- `db/tests/g3_inventory.sql`: overlap refused, adjacent ranges share a berth, `calculate_fare()`, `availability_grid()`.
- `backend/tests/inventory/`: router, and the workbook loader (`test_workbook_loader.py`).
