# Yatrio National Railway Reservation and Management System (NRRMS)

Welcome to the **Yatrio NRRMS Monorepo**. This project implements a modern railway reservation and fleet management system built with React + Vite, FastAPI, and PostgreSQL 16.

This repository is divided across 6 functional engineering groups:
- **Group 1**: Accounts & Access (`0100`)
- **Group 2**: Rail Network & Journey Planner (`0200`)
- **Group 3**: Inventory & Fares (`0300`)
- **Group 4**: **Reservation Engine (`0400`)** *(Implemented)*
- **Group 5**: Wallet & Ticketing (`0500`)
- **Group 6**: Operations & Analytics (`0600`)

---

## Group 4: Reservation Engine Overview

Group 4 is responsible for high-concurrency booking, seat allocation across intermediate segments, atomic advisory locks, 10-minute payment holds, Advance Reservation Period (ARP) & Tatkal window triggers, and cascading passenger cancellation.

### Key Architecture Components
1. **Database Migrations (`db/migrations/0400_g4_reservations/`):**
   - `0400_g4_reservations_table.sql`: 10-digit PNR sequence generator and `reservations` table.
   - `0401_g4_reservation_passengers_cancellations.sql`: `reservation_passengers`, `cancellations`, and `berth_allocations.passenger_id` foreign key.
   - `0402_g4_rls_reservations.sql`: Row-Level Security (RLS) policies for user isolation.
   - `0403_g4_is_booking_open_trigger.sql`: `is_booking_open()` BEFORE INSERT trigger enforcing 60-day ARP and Tatkal opening hours (10:00 AC, 11:00 non-AC).
   - `0404_g4_book_tickets_proc.sql`: `book_tickets()` procedure with `exclusion_violation` fallback, RAC, and WL cascade.
   - `0405_g4_cancel_passenger_func.sql`: `cancel_passenger()` function freeing segment allocations and promoting RAC $\to$ CNF and WL $\to$ RAC.
   - `0406_g4_confirm_reservation_func.sql`: `confirm_reservation()` payment confirmation hook.
   - `0407_g4_expire_holds_func.sql`: `release_expired_holds()` hold expiry cleanup.
2. **Backend (`backend/app/modules/reservations/`):**
   - Concurrency locking with `pg_advisory_xact_lock(hashtext(train_no || ':' || run_date || ':' || class_code))`.
   - Parameterized queries (`%s` placeholders exclusively in psycopg 3).
   - REST API endpoints under `/api/v1/reservations`.
   - Background hold expiry worker (`backend/app/jobs/hold_expiry.py`).
3. **Frontend (`frontend/src/features/reservations/`):**
   - Interactive booking flow with quota selection and saved passengers quick-add.
   - Live animated 10-minute hold countdown timer (`HoldCountdownTimer.tsx`).
   - Real-time Tatkal opening countdown (`TatkalCountdown.tsx`).
   - "My Journeys" booking manager with passenger-level cancellation modal (`CancelModal.tsx`).
   - TanStack Query hooks and Axios JWT client interceptors.

---

## Local Development & Testing

### 1. Database Migrations
```bash
# Verify migration numbering and group ranges
python db/migrate.py check

# Apply migrations to PostgreSQL 16
python db/migrate.py up

# Run SQL assertions
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/test_0400_reservations.sql
```

### 2. Backend API
```bash
cd backend
pip install -r requirements.txt
ruff check backend
pytest tests/reservations -v
uvicorn app.main:app --reload --port 8000
```
API Documentation is available at `http://localhost:8000/docs`.

### 3. Frontend Web Application
```bash
cd frontend
npm install
npm run lint
npm run test
npm run dev
```
Frontend development server runs at `http://localhost:5173`.
