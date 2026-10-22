-- STAND-INS for tables owned by other groups, used only to build and test G6
-- (operations and analytics) on its own.
--
-- Apply AFTER G2's migrations (0200_g2_network) and BEFORE db/migrations/0600_g6_operations.
-- Never apply this on a database that already has the real G1/G3/G4 objects.
--
-- Shapes follow the group ER diagram (Yatrio.pdf): keys are train_id / station_id,
-- reservations are keyed by pnr, and cancellations carry pnr, fare_amount and full_refund.
-- This is also what G5's refund trigger expects.
-- G4's current branch does NOT match the diagram yet (it uses train_no / station_code,
-- reservation_id, and cancellations without pnr / fare_amount / full_refund). G4 has to
-- align to the diagram; until then G6 builds against the diagram, not against G4's branch.
--
-- G2 (trains, stations) is real and is NOT created here.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------- G1 stand-in ----------
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT 'Test User'
);

-- ---------- G3 stand-ins ----------
CREATE TABLE IF NOT EXISTS travel_classes (
    class_code VARCHAR(5) PRIMARY KEY,
    class_name TEXT NOT NULL,
    base_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.00
);
INSERT INTO travel_classes (class_code, class_name) VALUES
    ('1A', 'First AC'), ('2A', 'AC 2-Tier'), ('3A', 'AC 3-Tier'),
    ('CC', 'AC Chair Car'), ('SL', 'Sleeper Class')
ON CONFLICT (class_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS quotas (
    quota_code VARCHAR(5) PRIMARY KEY,
    quota_name TEXT NOT NULL
);
INSERT INTO quotas (quota_code, quota_name) VALUES
    ('GN', 'General'), ('TQ', 'Tatkal'), ('LD', 'Ladies'), ('SS', 'Senior Citizen')
ON CONFLICT (quota_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS coaches (
    coach_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    train_id BIGINT NOT NULL REFERENCES trains(train_id) ON DELETE CASCADE,
    coach_code VARCHAR(10) NOT NULL,
    class_code VARCHAR(5) NOT NULL REFERENCES travel_classes(class_code),
    total_berths INT NOT NULL DEFAULT 0,
    UNIQUE (train_id, coach_code)
);

CREATE TABLE IF NOT EXISTS berths (
    berth_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    coach_id BIGINT NOT NULL REFERENCES coaches(coach_id) ON DELETE CASCADE,
    berth_number INT NOT NULL,
    berth_type VARCHAR(10) NOT NULL,
    UNIQUE (coach_id, berth_number)
);

CREATE TABLE IF NOT EXISTS berth_allocations (
    allocation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    berth_id BIGINT NOT NULL REFERENCES berths(berth_id) ON DELETE CASCADE,
    run_date DATE NOT NULL,
    stops INT4RANGE NOT NULL,
    EXCLUDE USING gist (berth_id WITH =, run_date WITH =, stops WITH &&)
);
-- passenger_id is added after reservation_passengers exists (G4's migration 0401 does this).

-- ---------- G4 stand-ins (shape from the ER diagram) ----------
CREATE SEQUENCE IF NOT EXISTS pnr_seq
    START WITH 1000000000 MINVALUE 1000000000 MAXVALUE 9999999999 CYCLE;

CREATE TABLE IF NOT EXISTS reservations (
    pnr VARCHAR(10) PRIMARY KEY DEFAULT nextval('pnr_seq')::text,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    train_id BIGINT NOT NULL REFERENCES trains(train_id),
    run_date DATE NOT NULL,
    from_station_id BIGINT NOT NULL REFERENCES stations(station_id),
    to_station_id BIGINT NOT NULL REFERENCES stations(station_id),
    class_code VARCHAR(5) NOT NULL REFERENCES travel_classes(class_code),
    quota_code VARCHAR(5) NOT NULL REFERENCES quotas(quota_code),
    total_fare NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT'
        CHECK (status IN ('PENDING_PAYMENT','CONFIRMED','CANCELLED','EXPIRED','PARTIALLY_CANCELLED')),
    hold_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
    departure_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservation_passengers (
    passenger_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pnr VARCHAR(10) NOT NULL REFERENCES reservations(pnr) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    age INT NOT NULL CHECK (age > 0 AND age <= 125),
    gender VARCHAR(10) NOT NULL,
    berth_preference VARCHAR(20),
    concession_rule_id INT,
    current_status VARCHAR(20) NOT NULL DEFAULT 'WL',   -- CNF / RAC / WL / CANCELLED
    berth_id BIGINT REFERENCES berths(berth_id),
    coach_id BIGINT REFERENCES coaches(coach_id),
    berth_no INT,
    rac_number INT,
    wl_number INT,
    fare NUMERIC(10,2) NOT NULL DEFAULT 0.00
);

ALTER TABLE berth_allocations
    ADD COLUMN IF NOT EXISTS passenger_id BIGINT
    REFERENCES reservation_passengers(passenger_id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS cancellations (
    cancellation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pnr VARCHAR(10) NOT NULL REFERENCES reservations(pnr),
    passenger_id BIGINT NOT NULL REFERENCES reservation_passengers(passenger_id),
    fare_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    full_refund BOOLEAN NOT NULL DEFAULT false,
    reason TEXT
);

-- Simplified stand-in for G4's cancel_passenger(). The real one also promotes RAC to CNF
-- and WL to RAC; this one only frees the berth and records the cancellation, which is all
-- G6's run-cancel trigger needs to be tested.
-- PROPOSED, not in G4 yet: the third argument, so a railway-cancelled run can set
-- cancellations.full_refund = true and G5 refunds 100%.
CREATE OR REPLACE FUNCTION cancel_passenger(
    p_passenger_id BIGINT,
    p_reason TEXT DEFAULT 'Passenger cancelled',
    p_full_refund BOOLEAN DEFAULT false
)
RETURNS NUMERIC(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_pass reservation_passengers%ROWTYPE;
BEGIN
    SELECT * INTO v_pass FROM reservation_passengers WHERE passenger_id = p_passenger_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Passenger % not found', p_passenger_id USING ERRCODE = 'P0002';
    END IF;
    IF v_pass.current_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Passenger % is already cancelled', p_passenger_id USING ERRCODE = '22023';
    END IF;

    DELETE FROM berth_allocations WHERE passenger_id = p_passenger_id;

    UPDATE reservation_passengers
       SET current_status = 'CANCELLED', berth_id = NULL, coach_id = NULL,
           berth_no = NULL, rac_number = NULL, wl_number = NULL
     WHERE passenger_id = p_passenger_id;

    INSERT INTO cancellations (pnr, passenger_id, fare_amount, full_refund, reason)
    VALUES (v_pass.pnr, p_passenger_id, v_pass.fare, p_full_refund, p_reason);

    UPDATE reservations
       SET status = CASE WHEN EXISTS (
                SELECT 1 FROM reservation_passengers
                 WHERE pnr = v_pass.pnr AND current_status <> 'CANCELLED')
               THEN 'PARTIALLY_CANCELLED' ELSE 'CANCELLED' END
     WHERE pnr = v_pass.pnr;

    RETURN CASE WHEN p_full_refund THEN v_pass.fare ELSE 0 END;
END;
$$;

-- Stand-in for G4's confirm_reservation(pnr), which G5's pay_reservation() calls after a
-- successful payment. Same name and return type as G4's real function.
CREATE OR REPLACE FUNCTION confirm_reservation(p_pnr VARCHAR(10))
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE reservations SET status = 'CONFIRMED'
     WHERE pnr = p_pnr AND status = 'PENDING_PAYMENT';
    RETURN true;
END;
$$;
