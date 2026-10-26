# G4: Reservation engine

A reservation gives every passenger a confirmed berth, an RAC place or a waiting-list number, or changes nothing, even when twenty people book the last berth at once.

## Tables (migrations 0400-0409)

| Table | Purpose |
|---|---|
| `reservations` | one row per booking; 10-digit `pnr` from `pnr_seq`; `status` is `PENDING_PAYMENT`, `CONFIRMED`, `PARTIALLY_CANCELLED`, `CANCELLED` or `EXPIRED`; `hold_expires_at` is ten minutes after booking; `departure_at` is the boarding stop's departure in Indian Standard Time |
| `reservation_passengers` | one row per passenger with `current_status` (`CNF`, `RAC`, `WL`, `CANCELLED`, `EXPIRED`), berth, RAC or WL number and fare |
| `cancellations` | one row per cancelled passenger: `refund_amount`, `cancellation_charge`, `full_refund` |
| `berth_allocations.passenger_id` | added by `0401`; G4 writes allocations only inside `book_tickets()` and `cancel_passenger()` |

## SQL objects and what each demonstrates

| Object | Concept |
|---|---|
| `is_booking_open()` BEFORE INSERT trigger | the 60-day advance window; Tatkal opens the day before travel at 10:00 for AC and 11:00 for non-AC classes (Indian time) |
| `book_tickets(reservation_id)` procedure | per passenger: the preferred berth type first, then any free berth, catching `exclusion_violation` to try the next; then RAC (up to 20), then the waiting list. Fare per passenger from G3's `calculate_fare()` with the right concession |
| `cancel_passenger(passenger_id, reason, full_refund)` | frees the berth range, promotes the first RAC passenger to CNF and the first WL passenger to RAC, writes the cancellation and returns the refund the wallet actually received |
| `confirm_reservation(pnr)` | moves `PENDING_PAYMENT` to `CONFIRMED`; G5's `pay_reservation()` calls it |
| `release_expired_holds()` | frees the berths of holds past ten minutes; run every minute by `app/jobs/hold_expiry.py` |
| `pg_advisory_xact_lock` in `reservations/service.py` | bookings for one train, date and class queue up instead of racing for the same berths |
| row-level security (`0402`, tightened in `0409`) | a passenger sees only their own bookings; staff, admins and jobs see all |

## How a booking runs

1. `POST /api/v1/reservations` resolves the boarding and alighting stop numbers from G2's timetable.
2. It takes the advisory lock for (train, date, class).
3. It inserts the reservation (the trigger checks the booking window) and the passengers, then calls `book_tickets()`.
4. The booking is `PENDING_PAYMENT` for ten minutes. Paying from the wallet (`POST /reservations/{pnr}/pay`, G5) confirms it. Otherwise `release_expired_holds()` frees the berths.

The segment-wise idea is G3's exclusion constraint on `berth_allocations`: a berth freed at an intermediate stop is resold for the rest of the route (`db/tests/test_0400_reservations.sql`, test 3). The 20-parallel-requests test is `backend/tests/reservations/test_concurrency.py`.

## Isolation levels: two sessions

Session B sells stops [1,3) of a berth and commits while session A is already running. Measured on PostgreSQL 16 (the script is in this document's source, `docs/g4-isolation-demo.py`):

| Session A runs at | A's first count | A's count after B commits | A then tries to sell stops [2,4) |
|---|---|---|---|
| READ COMMITTED | 0 | **1** (each statement sees the latest commits) | rejected, `exclusion_violation` (23P01) |
| REPEATABLE READ | 0 | **0** (A keeps its snapshot) | rejected, `exclusion_violation` (23P01) |

Why it matters: a check-then-insert in Python would sell the berth twice under either level, because A's `SELECT` cannot see what B is about to do. The exclusion constraint is enforced on the index, outside the snapshot, so it refuses the double sale at both levels. The advisory lock then keeps the common case fast: bookings queue instead of failing with exclusion errors and retrying.

## Configurable booking window (0410)

`booking_rules` holds one row: `advance_days` (60), `tatkal_ac_opens_at` (10:00) and `tatkal_non_ac_opens_at` (11:00), all IST. `is_booking_open()` reads it on every insert, so a change applies to the next booking without a deploy. Row-level security lets everyone read it and only an admin (or a background job) update it; there is no INSERT or DELETE policy, so the single row can never be added to or removed through the API. `GET /reservations/booking-rules` serves it to the Tatkal countdown, and `PUT /reservations/booking-rules` (admin) changes it. `db/tests/g4_booking_rules.sql` proves both the window and the policy.

## Demo reservations from the workbook

`db/import/load_pnr_master.py` turns the workbook's `PNR_Master` sheet into reservations through the real engine (`book_tickets()`, then `pay_reservation()` and `cancel_passenger()` with `--pay`), one savepoint per PNR, skipping PNRs already loaded:

```bash
python db/import/load_pnr_master.py Indian_Railway_Reservation_System.xlsx --user alice@yatrio.test --pay --rebase-dates
```

The workbook is not in the repository, so the sheet layout is an assumption (a header row naming the PNR, train, date, from, to and class columns; see the script's docstring). Check it against the real file. Trains or stations missing from the database are reported and skipped. `db/seeds/g6_demo_data.sql` remains the demo data that works with the CI sample timetable alone.
