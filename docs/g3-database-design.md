# G3 Inventory & Fares — Database Design and Architecture

Group: **G3 — Inventory & Fares**  
Branch: `g3Manas`  
Migrations: `db/migrations/0300_g3_inventory/` (Range 0300–0399)  

---

## 1. Scope & Objective

G3 owns the **segment-wise inventory** and **pricing engine** of Yatrio.
The primary technical breakthrough is solving the railway reservation problem where a seat is not locked for an entire train route, but dynamically sold across intermediate stop segments.

---

## 2. PostgreSQL 16 Objects & Syllabus Concepts

| Object / Migration | Type | Syllabus Concept Demonstrated | Purpose |
|---|---|---|---|
| `0301_g3_travel_classes.sql` | Table | DDL, check constraints | 1A, 2A, 3A, SL, CC, 2S master classes |
| `0302_g3_quotas.sql` | Table | Master lookup | GN, TQ, LD, SS booking quotas |
| `0303_g3_concession_rules.sql` | Table | Check constraints | Concession discount rules |
| `0304_g3_fare_slabs.sql` | Table | Composite unique keys, distance slabs | Distance brackets, base fare, per-km rates, ancillary fees |
| `0305_g3_train_consist.sql` | Table | Composite foreign keys | Train coach composition specifications |
| `0306_g3_coaches.sql` | Table | Foreign keys | Physical coach units (S1..S6, B1..B4, A1..A2) |
| `0307_g3_berths.sql` | Table | Check constraints | Berths (LB, MB, UB, SL, SU) per coach |
| `0308_g3_berth_allocations.sql` | Table & Extension | **Range Types (`int4range`), `btree_gist` Exclusion Constraints** | Rejects overlapping seat sales $[boarding\_seq, alighting\_seq)$ |
| `0309_g3_berth_generator_fn.sql` | PL/pgSQL Function | Algorithmic layout generation, procedural DML | Generates standard Indian Railway coach & berth layouts |
| `0310_g3_free_berths_fn.sql` | PL/pgSQL Function | **Anti-join (`NOT EXISTS`), Range Overlap (`&&`)** | Computes vacant berths for a given train, run date, and stop range |
| `0311_g3_calculate_fare_fn.sql` | PL/pgSQL Function | Distance calculation, mathematical modeling, conditional GST | Returns detailed breakdown: base, reservation, superfast, tatkal, concession, GST, total |
| `0312_g3_availability_grid_fn.sql` | PL/pgSQL Function | **Set-Returning Function (`RETURNS TABLE`), `generate_series`, `CROSS JOIN`** | Computes 6-date matrix of availability across classes |

---

## 3. The Core Innovation: Segment-Wise Berths with GiST Exclusion

In traditional basic reservation systems, one berth is sold once per train per date.
In Yatrio (G3), a berth is sold for a range of stops $[boarding\_seq, alighting\_seq)$:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE berth_allocations (
    allocation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    berth_id BIGINT NOT NULL REFERENCES berths(berth_id) ON DELETE CASCADE,
    run_date DATE NOT NULL,
    stops INT4RANGE NOT NULL,
    passenger_id BIGINT NULL,
    allocation_type VARCHAR(10) NOT NULL DEFAULT 'CNF',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    EXCLUDE USING gist (berth_id WITH =, run_date WITH =, stops WITH &&)
);
```

### Viva Demonstration
* Passenger A travels from Stop 1 to Stop 5: `int4range(1, 5, '[)')`
* Passenger B travels from Stop 5 to Stop 10: `int4range(5, 10, '[)')`
* **Result**: Because $[1, 5) \cap [5, 10) = \emptyset$, PostgreSQL accepts both reservations on the **exact same berth** (`S4-23`).
* Passenger C attempts to book Stop 3 to Stop 7 on the same berth: $[3, 7) \cap [1, 5) \neq \emptyset$.
* **Result**: PostgreSQL immediately raises an `exclusion_violation` exception. The reservation engine catches this and assigns another berth or places the passenger in RAC/WL.

---

## 4. API Endpoints Contract

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/travel-classes` | Lists all active railway classes |
| `GET` | `/api/v1/quotas` | Lists quotas (GN, TQ, LD, SS) |
| `GET` | `/api/v1/trains/{train_no}/availability?from=&to=&date=&quota=` | Returns 6-date $\times$ classes availability matrix |
| `GET` | `/api/v1/fare?train_no=&from=&to=&class_code=&quota=` | Granular fare calculation breakdown |
| `GET` | `/api/v1/trains/{train_no}/coaches` | List coaches attached to train |
| `GET` | `/api/v1/coaches/{coach_id}/layout?run_date=&from_seq=&to_seq=` | Coach schematic showing free/occupied berths |

---

## 5. Tests

* **SQL Tests**: [`db/tests/g3_inventory.sql`](file:///c:/Users/Lenovo%20Thinkpad%20T14/Desktop/dbm-k6-cie2/db/tests/g3_inventory.sql) (Verifies exclusion violation on overlap, adjacent non-overlapping ranges, `calculate_fare`, and `availability_grid`).
* **Backend Unit Tests**: [`backend/tests/inventory/test_inventory_router.py`](file:///c:/Users/Lenovo%20Thinkpad%20T14/Desktop/dbm-k6-cie2/backend/tests/inventory/test_inventory_router.py) (All 6 tests passing).
