# Group 4: Reservation Engine (NRRMS)

## 1. Overview & Core Mission
The Reservation Engine is responsible for the transactional booking lifecycle in Yatrio NRRMS. It guarantees atomic seat allocation, prevents double-booking under extreme concurrency using PostgreSQL advisory locks and exclusion constraints, manages 10-minute payment holds, enforces Advance Reservation Period (ARP) & Tatkal window rules, and handles cancellations with cascading seat promotions (RAC $\to$ CNF and WL $\to$ RAC).

---

## 2. Member Responsibilities & Database Objects Owned

| Member | Role | Database Object Owned | Syllabus Concepts Covered | Key Deliverable |
| :--- | :--- | :--- | :--- | :--- |
| **Member 1** | Frontend | `is_booking_open()` BEFORE INSERT Trigger | DDL, Triggers, Date/Time Arithmetic, Conditional Validation | Booking flow, 10-min hold timer, Tatkal countdown |
| **Member 2** | Backend | `pg_advisory_xact_lock()` | Transactions, Isolation Levels, Explicit Locking, Concurrency Control | `/api/v1/reservations` API, 20-thread concurrency test, Hold expiry worker |
| **Member 3** | Database | `book_tickets()` Procedure & `cancel_passenger()` Function | Stored Procedures, Exception Handling (`exclusion_violation`), Cascading Updates, RLS | Tables `reservations`, `reservation_passengers`, `cancellations`, RLS policies |

---

## 3. Database Schema & Migration Range (`0400` – `0499`)

### Migration Files
1. `0400_g4_reservations_table.sql`: Creates `pnr_seq` sequence and `reservations` table (10-digit PNR).
2. `0401_g4_reservation_passengers_cancellations.sql`: Creates `reservation_passengers` and `cancellations` tables, alters `berth_allocations` to add `passenger_id`.
3. `0402_g4_rls_reservations.sql`: Row-Level Security (RLS) policies enforcing passenger data isolation (`app.user_id`).
4. `0403_g4_is_booking_open_trigger.sql`: `is_booking_open()` trigger enforcing 60-day ARP and Tatkal opening windows.
5. `0404_g4_book_tickets_proc.sql`: `book_tickets()` procedure allocating preferred berths, catching `exclusion_violation`, and cascading to RAC / WL.
6. `0405_g4_cancel_passenger_func.sql`: `cancel_passenger()` function freeing segment allocations and promoting RAC $\to$ CNF and WL $\to$ RAC.
7. `0406_g4_confirm_reservation_func.sql`: `confirm_reservation()` function called upon successful payment (G5 contract).
8. `0407_g4_expire_holds_func.sql`: `release_expired_holds()` function freeing holds exceeding 10 minutes.

---

## 4. Concurrency & High-Traffic Architecture
When multiple passengers book the last available berth simultaneously:
1. **Advisory Transactional Locking:** `pg_advisory_xact_lock(hashtext(train_no || ':' || run_date || ':' || class_code))` serializes concurrent transactions booking the same train run and class.
2. **Exclusion Constraint Safety Net:** `berth_allocations` enforces `EXCLUDE USING gist (berth_id WITH =, run_date WITH =, stops WITH &&)`.
3. **Graceful Degradation:** If another transaction takes the desired berth, `book_tickets()` catches `exclusion_violation`, attempts the next berth, falls back to RAC (up to limit), and finally places excess demand in Waiting List (WL).

---

## 5. API Contract (`/api/v1/reservations`)

- `POST /api/v1/reservations`
  - Body: `train_no`, `run_date`, `from_station_code`, `to_station_code`, `class_code`, `quota_code`, `passengers`
  - Response: 201 Created with 10-digit PNR, `status: 'PENDING_PAYMENT'`, and assigned berths.
- `GET /api/v1/reservations`
  - Query: `page`, `page_size`, `status`
  - Response: Paginated list of user's bookings.
- `GET /api/v1/reservations/{pnr}`
  - Response: Complete journey, passenger status (`CNF`, `RAC`, `WL`), and hold expiration time.
- `POST /api/v1/reservations/{pnr}/cancel`
  - Body: `passenger_ids`, `reason`
  - Response: Updated status, refund credited, and cancellation charge deducted.
- `POST /api/v1/reservations/{pnr}/confirm`
  - Marks hold as `CONFIRMED` upon payment capture.

---

## 6. Viva Checklist
- [x] Run `python db/migrate.py check` to verify migration sequence.
- [x] Run `test_0400_reservations.sql` in psql to demonstrate `book_tickets()`, `cancel_passenger()`, and trigger assertions.
- [x] Run `pytest backend/tests/reservations/test_concurrency.py` to demonstrate 20 parallel threads contending for 1 berth.
