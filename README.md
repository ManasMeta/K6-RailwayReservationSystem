<p align="center">
  <img src="docs/brand/banner.jpg" alt="RailYatri: search a train, hold a berth, pay from a wallet, carry a QR ticket. 35 tables, 73 migrations, 8,151 stations, 0 double-sold berths." width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PostgreSQL-16-141414?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 16">
  <img src="https://img.shields.io/badge/FastAPI-Python%203.12-141414?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI on Python 3.12">
  <img src="https://img.shields.io/badge/React-Vite%20%2B%20TypeScript-141414?style=flat-square&logo=react&logoColor=white" alt="React, Vite and TypeScript">
  <img src="https://img.shields.io/badge/schema-35%20tables%20%C2%B7%203NF-0066ff?style=flat-square" alt="35 tables in 3NF">
  <img src="https://img.shields.io/badge/tests-163%20pytest%20%C2%B7%2070%20vitest%20%C2%B7%2010%20SQL-0066ff?style=flat-square" alt="163 pytest, 70 vitest and 10 SQL test scripts">
  <img src="https://img.shields.io/badge/team-6%20groups%20%C2%B7%2017%20students-707070?style=flat-square" alt="6 groups, 17 students">
</p>

<p align="center">
  <a href="#1000-am-tatkal-opens">The problem</a> ·
  <a href="#what-railyatri-does">What it does</a> ·
  <a href="#a-walk-through-the-app">Screens</a> ·
  <a href="#how-a-ticket-travels">How it works</a> ·
  <a href="#six-groups-one-database">Database</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#working-in-this-repo">Contributing</a> ·
  <a href="#the-team">Team</a>
</p>

---

## 10:00 am, Tatkal opens

It is the day before a Howrah to New Delhi Rajdhani leaves. At 10:00 sharp the AC Tatkal quota opens, and a few hundred people press **Book** on the same handful of berths within the same second.

Every one of them is asking the database a hard question:

- **Is this berth really free?** Not just today, but for *my* stretch of the route. A berth someone leaves at Kanpur is free again from Kanpur to Delhi.
- **What if two of us get it at once?** It has to be sold exactly once. Not "almost always once".
- **What if my payment retries?** The bank times out, the app sends the request again. I must be charged once.
- **What if I cancel?** I want my refund, and the person on the waiting list wants my berth, in the right order.
- **What if the railway cancels the train?** Everyone gets their money back, in full, without anyone running a script.

**RailYatri** is a railway reservation system built to answer those questions inside PostgreSQL itself, where the rules cannot be skipped by a buggy client or a forgotten `if`. FastAPI is a thin layer on top, and React is the face.

It was built by six groups of students, each owning one module of the same database, merged into one monorepo, and tested together.

## What RailYatri does

| | For passengers | Under the hood |
|---|---|---|
| **Find** | Search between any two of 8,151 stations, direct or with one change, with station autocomplete | Trigram GIN index, window functions over 186,124 timetable rows |
| **Choose** | A six-day seat grid per class, a fare breakup, and a live coach map | `availability_grid()`, `calculate_fare()`, segment-wise berth ranges |
| **Book** | Hold berths for ten minutes; confirmed, RAC or waiting list, decided instantly | `book_tickets()` with an exclusion constraint and advisory locks |
| **Pay** | Pay from an in-app wallet topped up by (simulated) UPI | A double-entry ledger checked at commit, idempotent top-ups |
| **Travel** | An e-ticket with a QR code and a PDF; public PNR status | `v_pnr_status` with passenger names masked |
| **Cancel** | Cancel some or all passengers; refund lands in the wallet | Tiered `refund_amount()`, RAC and waiting-list promotion |
| **Run the railway** | Staff log delays, cancel runs and prepare charts; admins see revenue and occupancy | PL/pgSQL cursor in `prepare_chart()`, materialized views with `GROUPING SETS` |

### Four promises

- **A berth is sold once.** Twenty parallel requests for the last berth sell it to exactly one of them. The guarantee is an `EXCLUDE USING gist` constraint on `(berth, date, stop range)`, not application code.
- **Money always balances.** Every top-up, payment and refund is a ledger transaction whose entries sum to zero, checked by a deferred constraint trigger when the transaction commits.
- **You only see your own data.** The API connects as a restricted role, and PostgreSQL row-level security hides other people's bookings, wallets and saved passengers, even if the API forgets a `WHERE`.
- **Reruns change nothing.** Every migration and every import is idempotent, and CI proves it by running them twice.

## A walk through the app

Every image below is a screenshot of the running app against the demo database (`db/seeds/`), organised by the group that built it.

### G1 · Accounts and access

<table>
<tr>
<td width="50%"><img src="docs/screenshots/01-g1-sign-in.jpg" alt="Sign in to RailYatri"><br><b>Sign in.</b> bcrypt passwords and a JWT. The menu follows the signed-in role: passenger, staff or admin.</td>
<td width="50%"><img src="docs/screenshots/02-g1-sign-up.jpg" alt="Create an account"><br><b>Sign up.</b> Email, mobile and pincode are checked by PostgreSQL <code>DOMAIN</code> types, not just the form.</td>
</tr>
<tr>
<td><img src="docs/screenshots/03-g1-account.jpg" alt="Account dashboard"><br><b>Your account.</b> Profile, role and saved-passenger count at a glance.</td>
<td><img src="docs/screenshots/04-g1-saved-passengers.jpg" alt="Saved passengers"><br><b>Saved passengers.</b> Up to ten travel companions, one tap to add at booking time. Row-level security keeps them yours.</td>
</tr>
</table>

### G2 · Rail network and journey planner

<table>
<tr>
<td width="50%"><img src="docs/screenshots/05-g2-autocomplete.jpg" alt="Station autocomplete for 'new'"><br><b>Station autocomplete.</b> Type "new" and get New Delhi, New Bongaigaon, New Jalpaiguri, from a trigram index over 8,151 stations.</td>
<td width="50%"><img src="docs/screenshots/06-g2-results-direct.jpg" alt="Direct trains Howrah to New Delhi"><br><b>Direct trains.</b> Departure, arrival, duration and the <b>+1</b> day marker, all computed from generated minute columns.</td>
</tr>
<tr>
<td><img src="docs/screenshots/07-g2-results-one-change.jpg" alt="One-change journeys from Chennai to New Delhi"><br><b>One change.</b> Chennai to New Delhi via Nagpur or Vijayawada. The second train leaves 30 minutes to 6 hours after the first arrives, ranked by total time.</td>
<td><img src="docs/screenshots/08-g2-timetable.jpg" alt="Timetable of 12301 Howrah Rajdhani"><br><b>Timetable.</b> Every stop with its day of journey, worked out by window functions over the raw CSV.</td>
</tr>
</table>

### G3 · Inventory and fares

<p align="center">
  <img src="docs/screenshots/09-g3-availability.jpg" alt="Six-day availability grid for 2A, 3A and Sleeper" width="100%">
  <br><sub><b>Seats and fares.</b> Six days by three classes in one call to <code>availability_grid()</code>. The 3A count already reflects berths sold on part of the route.</sub>
</p>

<table>
<tr>
<td width="50%"><img src="docs/screenshots/10-g3-fare-breakup.jpg" alt="Fare breakup for 2A"><br><b>Fare breakup.</b> Base fare by distance slab, reservation charge, superfast surcharge and GST, from <code>calculate_fare()</code>.</td>
<td width="50%"><img src="docs/screenshots/11-g3-seat-map.jpg" alt="Coach B1 seat map with booked berths greyed out"><br><b>Coach map.</b> Coach B1 (3A), 64 berths. Grey berths are taken for this segment; a berth freed at an intermediate station shows free again.</td>
</tr>
</table>

### G4 · Reservation engine

<table>
<tr>
<td width="50%"><img src="docs/screenshots/12-g4-booking-form.jpg" alt="Booking form with quota choice and saved passengers"><br><b>Book.</b> Pick a class and quota (General, Tatkal, Ladies, Senior citizen) and add saved passengers in one tap.</td>
<td width="50%"><img src="docs/screenshots/13-g4-hold.jpg" alt="Berths on hold with a 10 minute timer"><br><b>Hold.</b> Berths are held for ten minutes as <code>PENDING_PAYMENT</code>. Each passenger gets a confirmed berth, RAC or a waiting-list number.</td>
</tr>
<tr>
<td><img src="docs/screenshots/14-g4-my-journeys.jpg" alt="My journeys list"><br><b>My journeys.</b> Every booking with its status, berths and fare. Filter by upcoming or cancelled, or search by PNR.</td>
<td><img src="docs/screenshots/15-g4-cancel.jpg" alt="Cancel one passenger dialog"><br><b>Cancel some passengers.</b> Choose who is not travelling and see the estimate before you confirm.</td>
</tr>
<tr>
<td colspan="2"><img src="docs/screenshots/16-g4-cancelled.jpg" alt="Cancellation successful with refund credited"><br><b>Cancelled.</b> <code>cancel_passenger()</code> frees the berth range, promotes RAC and waiting list, and G5's trigger credits the refund in the same transaction.</td>
</tr>
</table>

### G5 · Wallet and ticketing

<table>
<tr>
<td width="50%"><img src="docs/screenshots/17-g5-wallet.jpg" alt="Wallet balance and statement"><br><b>Wallet.</b> Balance, simulated UPI top-up with an idempotency key, and a statement with a running balance from a window function.</td>
<td width="50%"><img src="docs/screenshots/18-g5-pay.jpg" alt="Pay for PNR from wallet"><br><b>Pay.</b> <code>pay_reservation()</code> locks the wallet row, checks the balance and confirms the booking in one transaction.</td>
</tr>
<tr>
<td><img src="docs/screenshots/19-g5-ticket.jpg" alt="E-ticket with QR code"><br><b>E-ticket.</b> Ticket number, fare paid, a QR code and a PDF download.</td>
<td><img src="docs/screenshots/20-g5-refunds.jpg" alt="Refund history"><br><b>Refunds.</b> 90% at 48 hours or more before departure, 75% from 12 hours, 50% from 4 hours. Tiers live in the <code>refund_rules</code> table.</td>
</tr>
</table>

### G6 · Operations and analytics

<table>
<tr>
<td width="50%"><img src="docs/screenshots/21-g6-run-board.jpg" alt="Staff run board"><br><b>Run board.</b> Staff see every run, log delays, cancel a whole run (everyone is refunded in full by one trigger) and prepare charts.</td>
<td width="50%"><img src="docs/screenshots/22-g6-chart.jpg" alt="Prepared passenger chart"><br><b>Final chart.</b> <code>prepare_chart()</code>, a PL/pgSQL cursor, gives freed berths to RAC and then waiting-list passengers in booking order.</td>
</tr>
<tr>
<td><img src="docs/screenshots/23-g6-analytics.jpg" alt="Admin analytics revenue by day"><br><b>Admin analytics.</b> Revenue by day and class, occupancy, waiting-list conversion and busiest segments, from materialized views refreshed <code>CONCURRENTLY</code>.</td>
<td><img src="docs/screenshots/24-g6-pnr-status.jpg" alt="Public PNR status with masked names"><br><b>PNR status.</b> Public, no sign-in needed, and passenger names are masked by the view itself.</td>
</tr>
</table>

### On a phone

<p align="center">
  <img src="docs/screenshots/phone-search.jpg" alt="Search on a phone" width="240">
  &nbsp;&nbsp;
  <img src="docs/screenshots/phone-journeys.jpg" alt="My journeys on a phone" width="240">
  &nbsp;&nbsp;
  <img src="docs/screenshots/phone-ticket.jpg" alt="E-ticket on a phone" width="240">
  <br><sub>The same app at 390 px wide: search, your journeys, and the ticket you show the TTE.</sub>
</p>

## How a ticket travels

One booking touches every group. This is the path of PNR `1000000006` in the screenshots above.

```mermaid
flowchart LR
    S["Search<br/>G2 search_direct_journeys()<br/>search_connecting_journeys()"] --> A["Seats and fare<br/>G3 availability_grid()<br/>calculate_fare()"]
    A --> H["Hold 10 min<br/>G4 book_tickets()<br/>CNF / RAC / WL"]
    H --> P["Pay<br/>G5 pay_reservation()<br/>ledger + e-ticket"]
    P --> T["Travel<br/>G6 v_pnr_status<br/>prepare_chart()"]
    H -- "not paid in 10 min" --> X["Hold expires<br/>background job frees berths"]
    P --> C["Cancel<br/>G4 cancel_passenger()"]
    C --> R["Refund<br/>G5 trigger + refund_rules"]
    C --> Q["Promote<br/>RAC to CNF, WL to RAC"]
```

### What happens when two people want the last berth

```mermaid
sequenceDiagram
    participant A as Passenger A
    participant B as Passenger B
    participant API as FastAPI
    participant DB as PostgreSQL
    A->>API: POST /reservations
    B->>API: POST /reservations
    API->>DB: pg_advisory_xact_lock(train, date, class)
    API->>DB: book_tickets() for A
    DB-->>API: berth B1-20, CNF
    API->>DB: book_tickets() for B
    Note over DB: INSERT into berth_allocations<br/>overlaps A's stop range<br/>exclusion_violation caught
    DB-->>API: next free berth, or RAC, or WL
    API-->>A: PNR, confirmed
    API-->>B: PNR, RAC 1
```

The lock keeps requests for the same train, date and class in a queue; the exclusion constraint is the safety net that makes a double sale impossible even if the lock were skipped. The G4 doc has the READ COMMITTED vs REPEATABLE READ demonstration ([docs/g4-database-design.md](docs/g4-database-design.md)).

### Architecture

```mermaid
flowchart TB
    UI["React + Vite + TanStack Query<br/>frontend/src/features/&lt;group&gt;"] -- "/api/v1, Bearer JWT" --> API
    subgraph API["FastAPI, backend/app"]
        direction LR
        CORE["core/<br/>JWT, require_role(),<br/>sets app.user_id per request"] --> MOD["modules/<br/>accounts · network · inventory<br/>reservations · wallet · operations"]
    end
    API -- "role nrrms_app<br/>row-level security on" --> DB[("PostgreSQL 16<br/>35 tables · 2 views · 2 materialized views<br/>functions, triggers, policies")]
    W["worker<br/>hold expiry every minute<br/>charts and view refresh every 15 min"] --> DB
    REP["nrrms_report<br/>read-only, no password hashes"] -.-> DB
```

## Six groups, one database

RailYatri's database has **35 tables, 2 views and 2 materialized views in 3NF**. Each group owns a migration range, and a foreign key may only point to a lower-numbered group, so the modules stack cleanly:

$$\text{G1 (Accounts)} \leftarrow \text{G2 (Network)} \leftarrow \text{G3 (Inventory)} \leftarrow \text{G4 (Reservations)} \leftarrow \text{G5 (Wallet)} \leftarrow \text{G6 (Operations)}$$

| Group | Module | Owned tables and views | DBMS concepts it demonstrates | Design doc |
|---|---|---|---|---|
| **G1** | Accounts and access | `users`, `roles`, `user_roles`, `saved_passengers`, `audit_log` | DDL, `CREATE DOMAIN`, row-level security, roles and `GRANT`, audit trigger with JSONB diff | [module README](backend/app/modules/accounts/README.md) |
| **G2** | Rail network | `zones`, `stations`, `trains`, `train_stops`, `train_running_days`, `staging_train_stops` | Bulk `COPY` and cleaning, window functions, generated columns, trigram GIN index with `EXPLAIN ANALYZE` | [g2-database-design.md](docs/g2-database-design.md) |
| **G3** | Inventory and fares | `travel_classes`, `quotas`, `concession_rules`, `fare_slabs`, `train_consist`, `coaches`, `berths`, `berth_allocations` | `int4range` range types, `btree_gist` exclusion constraint, set-returning functions | [g3-database-design.md](docs/g3-database-design.md) |
| **G4** | Reservation engine | `reservations`, `reservation_passengers`, `cancellations`, `booking_rules` | Stored procedures, exception handling, advisory locks, isolation levels, `BEFORE INSERT` trigger | [g4-database-design.md](docs/g4-database-design.md) |
| **G5** | Wallet and ticketing | `wallets`, `ledger_txns`, `ledger_entries`, `topups`, `payments`, `refund_rules`, `refunds`, `e_tickets`, `v_wallet_statement` | Double-entry ledger, deferred constraint trigger, `SELECT ... FOR UPDATE`, idempotency keys | [g5-database-design.md](docs/g5-database-design.md) |
| **G6** | Operations and analytics | `train_runs`, `run_events`, `charts`, `chart_entries`, `v_pnr_status`, `mv_occupancy`, `mv_revenue` | PL/pgSQL cursors, materialized views, `GROUPING SETS`, cascading trigger | [g6-database-design.md](docs/g6-database-design.md) |

<details>
<summary><b>Complete ER diagram</b> (click to expand)</summary>

```mermaid
erDiagram
    %% ==========================================
    %% G1: ACCOUNTS & ACCESS
    %% ==========================================
    users {
        bigint user_id PK
        citext email UK
        text password_hash
        text full_name
        varchar mobile_no
        varchar pincode
        boolean is_active
        timestamptz created_at
    }

    roles {
        int role_id PK
        varchar role_name UK
    }

    user_roles {
        bigint user_id PK,FK
        int role_id PK,FK
        timestamptz granted_at
    }

    saved_passengers {
        bigint passenger_id PK
        bigint user_id FK
        text full_name
        int age
        varchar gender
        varchar berth_preference
        varchar id_type
        varchar id_number
        timestamptz created_at
    }

    audit_log {
        bigint log_id PK
        varchar table_name
        bigint record_id
        varchar action
        bigint changed_by FK
        jsonb old_values
        jsonb new_values
        timestamptz changed_at
    }

    %% ==========================================
    %% G2: RAIL NETWORK
    %% ==========================================
    zones {
        int zone_id PK
        varchar zone_code UK
        text zone_name
    }

    stations {
        int station_id PK
        varchar station_code UK
        text name
        int zone_id FK
        timestamptz created_at
    }

    trains {
        int train_id PK
        varchar train_no UK
        text train_name
        int source_station_id FK
        int dest_station_id FK
        timestamptz created_at
    }

    train_stops {
        int train_id PK,FK
        int seq PK
        int station_id FK
        time arrival
        time departure
        int day_offset
        numeric distance_km
        int arrival_minute
        int departure_minute
    }

    train_running_days {
        int train_id PK,FK
        int weekday PK
    }

    %% ==========================================
    %% G3: INVENTORY & FARES
    %% ==========================================
    travel_classes {
        varchar class_code PK
        varchar name
        numeric base_multiplier
        boolean has_ac
        timestamptz created_at
    }

    quotas {
        varchar quota_code PK
        varchar name
        timestamptz created_at
    }

    concession_rules {
        int rule_id PK
        varchar concession_code UK
        text description
        numeric discount_pct
        int min_age
        int max_age
        varchar gender
        timestamptz created_at
    }

    fare_slabs {
        int slab_id PK
        varchar class_code FK
        int min_km
        int max_km
        numeric base_fare
        numeric per_km_rate
        numeric reservation_fee
        numeric superfast_charge
        numeric tatkal_pct
        timestamptz created_at
    }

    train_consist {
        bigint consist_id PK
        bigint train_id FK
        varchar class_code FK
        int coach_count
        int seq_start
        timestamptz created_at
    }

    coaches {
        bigint coach_id PK
        bigint train_id FK
        varchar coach_code
        varchar class_code FK
        int total_berths
        timestamptz created_at
    }

    berths {
        bigint berth_id PK
        bigint coach_id FK
        int berth_number
        varchar berth_type
        timestamptz created_at
    }

    berth_allocations {
        bigint allocation_id PK
        bigint berth_id FK
        date run_date
        int4range stops
        bigint passenger_id FK
        varchar allocation_type
        timestamptz created_at
    }

    %% ==========================================
    %% G4: RESERVATION ENGINE
    %% ==========================================
    reservations {
        varchar pnr PK
        bigint user_id FK
        bigint train_id FK
        date run_date
        bigint from_station_id FK
        bigint to_station_id FK
        varchar class_code FK
        varchar quota_code FK
        numeric total_fare
        varchar status
        timestamptz hold_expires_at
        timestamptz departure_at
        timestamptz created_at
    }

    reservation_passengers {
        bigint passenger_id PK
        varchar pnr FK
        text full_name
        int age
        varchar gender
        varchar berth_preference
        int concession_rule_id FK
        varchar current_status
        bigint berth_id FK
        bigint coach_id FK
        int berth_no
        int rac_number
        int wl_number
        numeric fare
    }

    booking_rules {
        smallint booking_rule_id PK
        int advance_days
        time tatkal_ac_opens_at
        time tatkal_non_ac_opens_at
        timestamptz updated_at
    }

    cancellations {
        bigint cancellation_id PK
        varchar pnr FK
        bigint passenger_id FK
        numeric fare_amount
        timestamptz cancelled_at
        boolean full_refund
        text reason
    }

    %% ==========================================
    %% G5: WALLET & TICKETING
    %% ==========================================
    wallets {
        bigint wallet_id PK
        bigint user_id UK,FK
        numeric balance
        timestamptz updated_at
    }

    ledger_txns {
        bigint ledger_txn_id PK
        varchar txn_type
        varchar idempotency_key UK
        varchar reference_id UK
        timestamptz posted_at
    }

    ledger_entries {
        bigint entry_id PK
        bigint ledger_txn_id FK
        bigint wallet_id FK
        varchar account_type
        varchar entry_side
        numeric amount
    }

    topups {
        bigint topup_id PK
        bigint wallet_id FK
        bigint ledger_txn_id FK
        numeric amount
        varchar idempotency_key UK
        varchar status
        timestamptz created_at
    }

    payments {
        bigint payment_id PK
        bigint wallet_id FK
        varchar pnr FK
        bigint ledger_txn_id FK
        numeric amount
        timestamptz created_at
    }

    refund_rules {
        int rule_id PK
        int min_hours
        int max_hours
        numeric refund_pct
    }

    refunds {
        bigint refund_id PK
        bigint wallet_id FK
        varchar pnr FK
        bigint cancellation_id FK
        bigint ledger_txn_id FK
        numeric refund_amount
        boolean full_refund
        timestamptz created_at
    }

    e_tickets {
        bigint ticket_id PK
        varchar pnr UK,FK
        varchar ticket_no UK
        timestamptz issued_at
        text qr_code_data
        text pdf_url
    }

    %% ==========================================
    %% G6: OPERATIONS & ANALYTICS
    %% ==========================================
    train_runs {
        bigint run_id PK
        bigint train_id FK
        date run_date
        varchar status
        int delay_minutes
        boolean chart_prepared
        timestamptz created_at
    }

    run_events {
        bigint event_id PK
        bigint run_id FK
        varchar event_type
        bigint station_id FK
        int delay_minutes
        text notes
        bigint recorded_by FK
        timestamptz recorded_at
    }

    charts {
        bigint chart_id PK
        bigint run_id UK,FK
        timestamptz prepared_at
        bigint prepared_by FK
        int final_vacant_berths
    }

    chart_entries {
        bigint entry_id PK
        bigint chart_id FK
        bigint passenger_id FK
        varchar coach_code
        int berth_no
        varchar berth_type
        varchar quota_code
    }

    %% ==========================================
    %% RELATIONSHIPS
    %% ==========================================
    users ||--o{ user_roles : "has"
    roles ||--o{ user_roles : "assigned"
    users ||--o{ saved_passengers : "saves"
    users ||--o{ audit_log : "performs"
    users ||--|| wallets : "owns"
    users ||--o{ reservations : "books"

    zones ||--o{ stations : "contains"
    stations ||--o{ trains : "source"
    stations ||--o{ trains : "dest"
    trains ||--|{ train_stops : "halts at"
    stations ||--o{ train_stops : "stop station"
    trains ||--|{ train_running_days : "runs on"

    trains ||--o{ train_consist : "configured with"
    travel_classes ||--o{ train_consist : "class"
    travel_classes ||--o{ fare_slabs : "rates"
    trains ||--o{ coaches : "consists of"
    travel_classes ||--o{ coaches : "class"
    coaches ||--|{ berths : "contains"
    berths ||--o{ berth_allocations : "allocated for range"

    trains ||--o{ reservations : "journey train"
    stations ||--o{ reservations : "from"
    stations ||--o{ reservations : "to"
    travel_classes ||--o{ reservations : "class"
    quotas ||--o{ reservations : "quota"
    reservations ||--|{ reservation_passengers : "includes"
    concession_rules ||--o{ reservation_passengers : "applies"
    berths ||--o{ reservation_passengers : "assigned"
    reservations ||--o{ cancellations : "cancels"
    reservation_passengers ||--o{ cancellations : "cancelled"
    reservation_passengers ||--o| berth_allocations : "holds range"

    wallets ||--o{ topups : "credits"
    wallets ||--o{ payments : "debits"
    wallets ||--o{ refunds : "credits"
    ledger_txns ||--|{ ledger_entries : "contains"
    wallets ||--o{ ledger_entries : "account"
    ledger_txns ||--o| topups : "records"
    ledger_txns ||--o| payments : "records"
    ledger_txns ||--o| refunds : "records"
    reservations ||--o| payments : "paid by"
    reservations ||--o| refunds : "refunded from"
    cancellations ||--o| refunds : "triggers"
    reservations ||--o| e_tickets : "issues"

    trains ||--o{ train_runs : "instances"
    train_runs ||--o{ run_events : "logs"
    stations ||--o{ run_events : "at station"
    users ||--o{ run_events : "staff operator"
    train_runs ||--o| charts : "produces"
    users ||--o{ charts : "prepared by"
    charts ||--|{ chart_entries : "lists"
    reservation_passengers ||--o| chart_entries : "manifested"
```

</details>

## Getting started

You need **Docker**, and for local development also **Python 3.12** and **Node 20+**. Commands are written for bash; on Windows use Git Bash, or swap `export X=y` for `$env:X="y"` in PowerShell.

### Option A: run everything in Docker (about five minutes)

**1. Clone and configure**
```bash
git clone https://github.com/ManasMeta/K6-RailwayReservationSystem.git
cd K6-RailwayReservationSystem
cp .env.example .env
```
Open `.env` and set `JWT_SECRET` (any 32+ random characters), `APP_DB_PASSWORD` and `POSTGRES_PASSWORD`. If something else already uses port 5432 on your machine, also set `POSTGRES_HOST_PORT=5433`.

**2. Start the stack**
```bash
docker compose up --build -d
```
This starts five services: `db` (PostgreSQL), `migrate` (applies every migration, then creates the restricted `nrrms_api` login and exits), `backend` (API on port 8000), `worker` (background jobs) and `frontend` (UI on port 8080).

**3. Load the timetable, coaches and demo data**
```bash
docker compose run --rm -e DATABASE_URL=postgresql://postgres:$POSTGRES_PASSWORD@db:5432/nrrms migrate \
  sh -c "python db/import/load_sample.py && python db/import/generate_inventory.py"
docker compose exec -T db psql -U postgres -d nrrms < db/seeds/g1_demo_users.sql
docker compose exec -T db psql -U postgres -d nrrms < db/seeds/g6_demo_data.sql
```
`$POSTGRES_PASSWORD` must be set in your shell (or type it in). The G6 seed is meant to run once; a second run stops instead of adding duplicates.

**4. Open it**

| What | Where |
|---|---|
| The app | http://localhost:8080 |
| API docs (try every endpoint) | http://localhost:8000/docs |

### Option B: run for development (hot reload)

```bash
docker compose up -d db                                  # only the database
python -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt   # Windows: backend\.venv\Scripts\pip

export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nrrms
export JWT_SECRET=any-long-random-string-for-local-use

python db/migrate.py up                    # all groups, in order; a rerun changes nothing
python db/import/load_sample.py            # 1,899-row sample: 86 stations, 475 trains
python db/import/generate_inventory.py     # coaches and berths for every train
psql "$DATABASE_URL" -f db/seeds/g1_demo_users.sql   # demo accounts
psql "$DATABASE_URL" -f db/seeds/g6_demo_data.sql    # demo bookings, runs and charts

uvicorn app.main:app --app-dir backend --reload      # API on http://localhost:8000
cd frontend && npm ci && npm run dev                 # UI on http://localhost:5173, /api is proxied
```

Optional, with `Indian_Railway_Reservation_System.xlsx` and the full `Train_details_22122017.csv` (not in the repository):
```bash
python db/import/load_train_details.py Train_details_22122017.csv   # full timetable: 186,124 rows, 8,151 stations (G2)
python db/import/load_zones.py WORKBOOK.xlsx         # zones from the Stations sheet (G2)
python db/import/load_workbook.py WORKBOOK.xlsx      # classes, quotas, concessions, fare slabs (G3)
python db/import/load_pnr_master.py WORKBOOK.xlsx --user alice@yatrio.test --pay   # demo PNRs (G4)
```

To run the API under row-level security as it does in production, create the restricted login and connect as it:
```bash
APP_DB_USER=nrrms_api APP_DB_PASSWORD=choose-one python db/create_login_role.py
export DATABASE_URL=postgresql://nrrms_api:choose-one@localhost:5432/nrrms
```

### Demo accounts

All use the password `yatrio-demo-1`. They exist only after loading `db/seeds/g1_demo_users.sql`, and are for local use only.

| Account | Role | What to try |
|---|---|---|
| `alice@yatrio.test` | passenger | Has bookings, a wallet balance and saved passengers |
| `bob@yatrio.test`, `carol@yatrio.test` | passenger | More bookings to cancel and compare |
| `staff@yatrio.test` | staff | Run board: delays, cancel a run, prepare a chart |
| `admin@yatrio.test` | admin | Everything staff can do, plus analytics |

### A ten-minute tour

1. **Search** (no sign-in). From `HWH` to `NDLS`, any date in the next 60 days. Click **Check Seats & Fares**, pick a cell, then **Fare Breakup** and **View Seat Map**. Try `MAS` to `NDLS` for the **One change** tab.
2. **Book** as `alice`. Click **Book**, choose 3A, add two saved passengers, **Hold berths**. Watch the ten-minute timer.
3. **Pay** from the wallet, then open the **E-ticket** and download the PDF.
4. **Cancel** one passenger from **My journeys**. Check **Refunds** and the **Wallet** statement: the refund is already there.
5. **PNR status** (signed out). Enter your PNR and see the names masked.
6. **Operate** as `staff`. On **Operations**, add a delay to today's run, prepare its chart, or cancel tomorrow's 12302 and watch every passenger get a full refund.
7. **Analyse** as `admin`. Open **Analytics** for revenue, occupancy and the busiest segments.

### Troubleshooting

| Symptom | Fix |
|---|---|
| "Incorrect email or password" for a demo account | The demo users are not loaded. Run `db/seeds/g1_demo_users.sql` against the database. |
| Search finds no stations | The timetable is not loaded. Run `load_sample.py`, then `generate_inventory.py` (without it there are no coaches or berths). |
| `docker compose up` stops with "set JWT_SECRET", or login fails with a server error | `JWT_SECRET` is not set in `.env` (or your shell). There is deliberately no default. |
| `port 5432 is already allocated` | Another PostgreSQL is running. Set `POSTGRES_HOST_PORT=5433` in `.env` and use port 5433 in your `DATABASE_URL`. |
| Ops or analytics pages are empty | Load `db/seeds/g6_demo_data.sql`, and sign in as `staff` or `admin`. |
| You see other users' data, or none at all | Check which role `DATABASE_URL` uses. As `postgres` RLS is bypassed; as `nrrms_api` it applies. |

## API

Everything is under `/api/v1`; errors are `{"detail": "...", "code": "..."}`; list endpoints take `page` and `page_size`. The full, clickable contract is at `/docs`.

| Endpoint | Group | Who | Purpose |
|---|---|---|---|
| `POST /auth/signup`, `/auth/login`, `/auth/refresh` | G1 | anyone / signed in | Create account, sign in, renew token |
| `GET /me`, `PATCH /me` | G1 | signed in | Profile |
| `GET /me/passengers`, `POST /me/passengers`, `DELETE /me/passengers/{id}` | G1 | signed in | Saved passengers (up to 10) |
| `GET /stations?q=` | G2 | anyone | Station autocomplete |
| `GET /journeys?from=&to=&date=` | G2 | anyone | Direct and one-change journeys |
| `GET /trains/{no}/timetable` | G2 | anyone | Stops, days and running days |
| `GET /trains/{no}/availability`, `/fare`, `/trains/{no}/coaches`, `/coaches/{id}/layout` | G3 | anyone | Availability grid, fare breakup, free berths |
| `POST /reservations`, `GET /reservations`, `GET /reservations/{pnr}` | G4 | signed in | Hold berths, list, details |
| `POST /reservations/{pnr}/cancel` | G4 | owner | Cancel passengers, promote RAC and WL |
| `POST /reservations/{pnr}/confirm`, `/reservations/admin/release-expired-holds` | G4 | staff, admin | Overrides |
| `GET /reservations/booking-rules`, `PUT /reservations/booking-rules` | G4 | anyone / admin | Booking window and Tatkal opening times |
| `GET /wallet`, `POST /wallet/topups`, `GET /wallet/transactions` | G5 | signed in | Balance, simulated top-up, statement |
| `GET /reservations/{pnr}/payment`, `POST /reservations/{pnr}/pay` | G5 | owner | Fare quote, pay from wallet |
| `GET /refunds`, `GET /tickets/{pnr}`, `.pdf`, `/qr.png` | G5 | owner | Refunds, e-ticket |
| `GET /pnr/{pnr}` | G6 | anyone | Public PNR status (names masked) |
| `GET /ops/runs`, `POST /ops/runs/{id}/delay`, `/cancel`, `/chart`, `GET /ops/runs/{id}/chart` | G6 | staff, admin | Run board, delays, cancel a run, final chart |
| `GET /reports/revenue`, `/occupancy`, `/wl-conversion`, `/busiest-segments`, `POST /reports/refresh` | G6 | admin | Analytics |

**Signing in.** `POST /auth/signup` always creates a passenger; staff and admin roles are granted in the `user_roles` table. `POST /auth/login` returns a JWT that the frontend sends as `Authorization: Bearer ...`. Wallet, payment, ticket, reservation and saved-passenger routes need a token, `/ops/*` needs staff or admin, and `/reports/*` needs admin. Passengers confirm a booking by paying (`POST /reservations/{pnr}/pay`); `POST /reservations/{pnr}/confirm` is a staff and admin override.

## Working in this repo

### Where things live

```
db/
  migrations/      plain SQL in filename order, one folder per group
                   0000_platform/ 0100_g1_accounts/ 0200_g2_network/ 0300_g3_inventory/
                   0400_g4_reservations/ 0500_g5_wallet/ 0600_g6_operations/
  import/          CSV and workbook loaders (G2, G3, G4) and the coach/berth generator (G3)
  seeds/           demo accounts and demo bookings (local use only)
  tests/           SQL assertion scripts, one or more per group
  migrate.py       the migration runner; create_login_role.py makes the restricted API login
backend/app/
  core/            config, database connection (sets the caller's id and role), JWT auth, require_role()
  jobs/            hold expiry, chart preparation, view refresh
  modules/         accounts/ network/ inventory/ reservations/ wallet/ operations/  (each has a README)
backend/tests/     pytest, one folder per module
frontend/src/
  api/             axios client with the bearer-token interceptor
  features/        accounts/ network/ inventory/ reservations/ wallet/ operations/
scripts/           smoke_test.py: end-to-end check against a running API
docs/              implementation plan, per-group design notes, screenshots
.github/           CI, CD, CODEOWNERS, pull request template
Design.md          the UI design system (tokens, type, components)
```

### Find your group's code

| Group | Database | Backend | Frontend | Owner team |
|---|---|---|---|---|
| G1 | `db/migrations/0100_g1_accounts/` | `backend/app/modules/accounts/` | `frontend/src/features/accounts/` | `@ManasMeta/g1-accounts` |
| G2 | `db/migrations/0200_g2_network/`, `db/import/load_*` | `backend/app/modules/network/` | `frontend/src/features/network/` | `@ManasMeta/g2-network` |
| G3 | `db/migrations/0300_g3_inventory/`, `generate_inventory.py` | `backend/app/modules/inventory/` | `frontend/src/features/inventory/` | `@ManasMeta/g3-inventory` |
| G4 | `db/migrations/0400_g4_reservations/` | `backend/app/modules/reservations/` | `frontend/src/features/reservations/` | `@ManasMeta/g4-reservations` |
| G5 | `db/migrations/0500_g5_wallet/` | `backend/app/modules/wallet/` | `frontend/src/features/wallet/` | `@ManasMeta/g5-wallet` |
| G6 | `db/migrations/0600_g6_operations/` | `backend/app/modules/operations/` | `frontend/src/features/operations/` | `@ManasMeta/g6-operations` |

Shared folders (`db/migrations/0000_platform/`, `backend/app/core/`, `frontend/src/api/`, `.github/`, `docker-compose.yml`) are reviewed by G1. See [.github/CODEOWNERS](.github/CODEOWNERS).

### Making a change

1. **Branch** from your group branch: member branch, then `group/<name>`, then `develop`, then `main`.
2. **Add a migration** for any schema change: a new file in your group's range (G4 uses `04xx`), never an edit to a merged one. Run `python db/migrate.py up` twice; the second run must change nothing.
3. **Test it**: an SQL script in `db/tests/` or a pytest case for the happy path and one failure.
4. **Commit** with Conventional Commits, for example `feat(g5): add refund rules` or `fix(g2): handle midnight halts`.
5. **Open a pull request** using the template: tick your group, attach a screenshot for UI changes, and update your module README.

### Working agreements
- A group writes only inside its own folders. Shared folders change by pull request.
- A migration number belongs to its group's range, and a foreign key points only to a lower range.
- A merged migration is never edited; fixes go in a new file.
- Money is `NUMERIC(10,2)`, never a float. Backend SQL is parameterised; string-built SQL fails review.
- Never commit `.env`, real passwords or API keys. Seeds and demo passwords are for local use only.

### Tests

```bash
# database: migrate, import, then every SQL script (each runs in a rolled-back transaction)
for f in db/tests/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done

# backend (needs the migrated database; integration tests skip if it is not reachable)
cd backend && ruff check . && pytest tests -q

# API end to end against a running server
python scripts/smoke_test.py http://127.0.0.1:8000

# frontend
cd frontend && npm run lint && npm test && npm run build
```
What each SQL script proves is listed in [db/tests/README.md](db/tests/README.md).

### CI/CD
`.github/workflows/ci.yml` runs on every pull request to `main`, `develop` or `group/**`: migration numbering and ranges, all migrations on a fresh PostgreSQL 16 (and a rerun that must change nothing), the sample import, every SQL script, `ruff` and `pytest`, an API smoke test as the restricted `nrrms_app` role, frontend lint, tests and build, and both Docker builds.

`.github/workflows/cd.yml` deploys after CI passes, once `DEPLOY_ENABLED` is set: a push to `develop` goes to staging and a push to `main` to production. Migrations run first, then the backend (Render deploy hook) and the frontend (Vercel). Secrets (`DATABASE_URL`, `APP_DB_PASSWORD`, `RENDER_DEPLOY_HOOK`, `VERCEL_TOKEN`) live in GitHub Environments, never in the repository.

## The team

Seventeen students, six groups, one schema. Each group owns one module end to end: its tables, its SQL functions, its API and its screens.

| Group | Module | Members (roll no.) |
|---|---|---|
| **G1** | Accounts and access | Sakshi (32217) · Yashodhara (32214) · Sanskruti (33215) |
| **G2** | Rail network and journey planner | Shambhavi (32210) · Sanskar (32213) |
| **G3** | Inventory and fares | Manas (32212) · Aditya (32205) · Sujal (32211) |
| **G4** | Reservation engine | Harshvardhan (32221) · Aaryan (32219) · Onkar (32207) |
| **G5** | Wallet and ticketing | Aditya (32220) · Mangesh (32206) · Aditya (32208) |
| **G6** | Operations and analytics | Ketaki (32209) · Pavitra (32216) · Aarshia (32218) |

Who built which SQL object inside each group is in that group's module README under `backend/app/modules/<module>/README.md`.

## Reference

- [Implementation plan (PDF)](docs/Railway%20Reservation%20System%20Implementation%20Plan.pdf)
- Design notes: [G2](docs/g2-database-design.md) · [G3](docs/g3-database-design.md) · [G4](docs/g4-database-design.md) · [G5](docs/g5-database-design.md) · [G6](docs/g6-database-design.md)
- [UI design system](Design.md)
- [SQL tests and what they prove](db/tests/README.md)
