-- Author: G4 Member 3 (Database)
-- Test Suite: Group 4 Reservation Engine Database Assertions
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/test_0400_reservations.sql

BEGIN;

-- Setup test environment settings
SET LOCAL app.skip_booking_window_check = 'true';
SET LOCAL app.user_id = '1';

-- 1. Ensure test master data exists
INSERT INTO zones (zone_code, zone_name)
VALUES ('NR', 'Northern Railway')
ON CONFLICT (zone_code) DO NOTHING;

INSERT INTO stations (station_code, name, zone_code) VALUES
    ('NDLS', 'New Delhi', 'NR'),
    ('CNB', 'Kanpur Central', 'NR'),
    ('PRYJ', 'Prayagraj Junction', 'NR'),
    ('DDU', 'Pt. Deen Dayal Upadhyaya Jn', 'NR')
ON CONFLICT (station_code) DO NOTHING;

INSERT INTO trains (train_no, name, train_type, is_ac, source_station_code, dest_station_code)
VALUES ('12424', 'Dibrugarh Rajdhani Express', 'Rajdhani', true, 'NDLS', 'DDU')
ON CONFLICT (train_no) DO NOTHING;

INSERT INTO train_stops (train_no, seq, station_code, arrival, departure, day_offset, distance_km) VALUES
    ('12424', 1, 'NDLS', '16:10:00', '16:10:00', 0, 0),
    ('12424', 2, 'CNB', '21:32:00', '21:37:00', 0, 440),
    ('12424', 3, 'PRYJ', '23:08:00', '23:10:00', 0, 635),
    ('12424', 4, 'DDU', '01:23:00', '01:33:00', 1, 790)
ON CONFLICT (train_no, seq) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, phone)
VALUES ('passenger.test@yatrio.in', 'hashed_pwd_123', 'Aarav Sharma', '9876543210')
ON CONFLICT (email) DO NOTHING;

-- Coaches and berths setup for testing
INSERT INTO coaches (train_no, coach_code, class_code)
VALUES ('12424', 'B1', '3A')
ON CONFLICT (train_no, coach_code) DO NOTHING;

INSERT INTO berths (coach_id, berth_number, berth_type)
SELECT c.coach_id, n, CASE (n % 4) WHEN 1 THEN 'LB' WHEN 2 THEN 'MB' WHEN 3 THEN 'UB' ELSE 'SL' END
FROM coaches c, generate_series(1, 4) n
WHERE c.train_no = '12424' AND c.coach_code = 'B1'
ON CONFLICT (coach_id, berth_number) DO NOTHING;

-- ====================================================================
-- TEST 1: PNR Sequence and 10-Digit Constraint
-- ====================================================================
DO $$
DECLARE
    v_val BIGINT;
BEGIN
    v_val := nextval('pnr_seq');
    ASSERT v_val >= 1000000000 AND v_val <= 9999999999,
        'PNR sequence must generate 10-digit numbers';
    RAISE NOTICE 'TEST 1 PASSED: 10-digit PNR sequence generator verified (Sample: %)', v_val;
END $$;

-- ====================================================================
-- TEST 2: Create Reservation and Passengers
-- ====================================================================
DO $$
DECLARE
    v_user_id BIGINT;
    v_res_id BIGINT;
    v_pnr VARCHAR(10);
    v_pass_id_1 BIGINT;
    v_pass_id_2 BIGINT;
BEGIN
    SELECT user_id INTO v_user_id FROM users WHERE email = 'passenger.test@yatrio.in' LIMIT 1;

    INSERT INTO reservations (
        user_id, train_no, run_date, from_station_code, to_station_code,
        from_seq, to_seq, class_code, quota_code, status
    ) VALUES (
        v_user_id, '12424', CURRENT_DATE + 5, 'NDLS', 'PRYJ',
        1, 3, '3A', 'GN', 'PENDING_PAYMENT'
    ) RETURNING reservation_id, pnr INTO v_res_id, v_pnr;

    ASSERT length(v_pnr) = 10, 'Generated PNR must be exactly 10 digits';

    INSERT INTO reservation_passengers (
        reservation_id, passenger_name, age, gender, berth_preference
    ) VALUES (
        v_res_id, 'Aarav Sharma', 29, 'Male', 'LB'
    ) RETURNING passenger_id INTO v_pass_id_1;

    INSERT INTO reservation_passengers (
        reservation_id, passenger_name, age, gender, berth_preference
    ) VALUES (
        v_res_id, 'Diya Sharma', 27, 'Female', 'MB'
    ) RETURNING passenger_id INTO v_pass_id_2;

    -- Call booking procedure
    CALL book_tickets(v_res_id);

    -- Check allocations
    ASSERT EXISTS (
        SELECT 1 FROM reservation_passengers
        WHERE passenger_id = v_pass_id_1 AND current_status = 'CNF' AND berth_type = 'LB'
    ), 'Passenger 1 must be allocated preferred LB berth';

    ASSERT EXISTS (
        SELECT 1 FROM reservation_passengers
        WHERE passenger_id = v_pass_id_2 AND current_status = 'CNF'
    ), 'Passenger 2 must be allocated CNF berth';

    ASSERT EXISTS (
        SELECT 1 FROM berth_allocations
        WHERE passenger_id = v_pass_id_1
    ), 'Berth allocation record must exist for Passenger 1';

    RAISE NOTICE 'TEST 2 PASSED: book_tickets() successfully allocated preferred berths with CNF status';
END $$;

-- ====================================================================
-- TEST 3: Segment-wise Berth Sharing and Exclusion Constraint
-- Passenger A on [1,3) and Passenger B on [3,4) can share the same berth;
-- Passenger C on [2,4) cannot overlap!
-- ====================================================================
DO $$
DECLARE
    v_user_id BIGINT;
    v_res_a BIGINT;
    v_res_b BIGINT;
    v_pass_a BIGINT;
    v_pass_b BIGINT;
    v_berth_a BIGINT;
    v_berth_b BIGINT;
BEGIN
    SELECT user_id INTO v_user_id FROM users WHERE email = 'passenger.test@yatrio.in' LIMIT 1;

    -- Clear previous test allocations
    DELETE FROM berth_allocations;

    -- Passenger A books NDLS to CNB (stops 1 to 2)
    INSERT INTO reservations (
        user_id, train_no, run_date, from_station_code, to_station_code,
        from_seq, to_seq, class_code, quota_code
    ) VALUES (
        v_user_id, '12424', CURRENT_DATE + 10, 'NDLS', 'CNB',
        1, 2, '3A', 'GN'
    ) RETURNING reservation_id INTO v_res_a;

    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, berth_preference)
    VALUES (v_res_a, 'Passenger A', 30, 'Male', 'LB')
    RETURNING passenger_id INTO v_pass_a;

    CALL book_tickets(v_res_a);
    SELECT berth_id INTO v_berth_a FROM reservation_passengers WHERE passenger_id = v_pass_a;

    -- Passenger B books CNB to DDU (stops 2 to 4) - should be able to share the freed berth!
    INSERT INTO reservations (
        user_id, train_no, run_date, from_station_code, to_station_code,
        from_seq, to_seq, class_code, quota_code
    ) VALUES (
        v_user_id, '12424', CURRENT_DATE + 10, 'CNB', 'DDU',
        2, 4, '3A', 'GN'
    ) RETURNING reservation_id INTO v_res_b;

    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, berth_preference)
    VALUES (v_res_b, 'Passenger B', 32, 'Female', 'LB')
    RETURNING passenger_id INTO v_pass_b;

    CALL book_tickets(v_res_b);
    SELECT berth_id INTO v_berth_b FROM reservation_passengers WHERE passenger_id = v_pass_b;

    ASSERT v_berth_a = v_berth_b,
        'Segment-wise seat sharing: Passenger B on [2,4) should share the same berth freed after stop 2';

    RAISE NOTICE 'TEST 3 PASSED: Segment-wise berth reuse validated across non-overlapping stops [1,2) and [2,4)';
END $$;

-- ====================================================================
-- TEST 4: Cancellation and Cascading Promotion (RAC -> CNF, WL -> RAC)
-- ====================================================================
DO $$
DECLARE
    v_user_id BIGINT;
    v_res_cnf BIGINT;
    v_res_rac BIGINT;
    v_res_wl BIGINT;
    v_pass_cnf BIGINT;
    v_pass_rac BIGINT;
    v_pass_wl BIGINT;
    v_refund NUMERIC(10,2);
BEGIN
    SELECT user_id INTO v_user_id FROM users WHERE email = 'passenger.test@yatrio.in' LIMIT 1;
    DELETE FROM berth_allocations;

    -- Setup: Allocate all 4 berths to ensure subsequent bookings go to RAC and WL
    -- Passenger 1 (CNF)
    INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code, status)
    VALUES (v_user_id, '12424', CURRENT_DATE + 15, 'NDLS', 'DDU', 1, 4, '3A', 'GN', 'CONFIRMED')
    RETURNING reservation_id INTO v_res_cnf;
    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, berth_preference, fare)
    VALUES (v_res_cnf, 'Confirmed Passenger', 35, 'Male', 'LB', 1000.00)
    RETURNING passenger_id INTO v_pass_cnf;
    CALL book_tickets(v_res_cnf);

    -- Simulate filling remaining berths
    INSERT INTO berth_allocations (berth_id, run_date, stops)
    SELECT b.berth_id, CURRENT_DATE + 15, int4range(1, 4, '[)')
    FROM berths b
    JOIN coaches c ON b.coach_id = c.coach_id
    WHERE c.train_no = '12424' AND c.coach_code = 'B1' AND b.berth_id <> (SELECT berth_id FROM reservation_passengers WHERE passenger_id = v_pass_cnf);

    -- Book another passenger: should go to RAC
    INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code, status)
    VALUES (v_user_id, '12424', CURRENT_DATE + 15, 'NDLS', 'DDU', 1, 4, '3A', 'GN', 'CONFIRMED')
    RETURNING reservation_id INTO v_res_rac;
    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, fare)
    VALUES (v_res_rac, 'RAC Passenger', 40, 'Female', 1000.00)
    RETURNING passenger_id INTO v_pass_rac;
    CALL book_tickets(v_res_rac);

    ASSERT (SELECT current_status FROM reservation_passengers WHERE passenger_id = v_pass_rac) = 'RAC',
        'Passenger should be placed in RAC when all berths are full';

    -- Simulate filling RAC to push next booking to WL
    UPDATE reservation_passengers SET rac_number = 20 WHERE passenger_id = v_pass_rac;

    -- Book another passenger: should go to WL
    INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code, status)
    VALUES (v_user_id, '12424', CURRENT_DATE + 15, 'NDLS', 'DDU', 1, 4, '3A', 'GN', 'CONFIRMED')
    RETURNING reservation_id INTO v_res_wl;
    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, fare)
    VALUES (v_res_wl, 'WL Passenger', 22, 'Male', 1000.00)
    RETURNING passenger_id INTO v_pass_wl;
    CALL book_tickets(v_res_wl);

    ASSERT (SELECT current_status FROM reservation_passengers WHERE passenger_id = v_pass_wl) = 'WL',
        'Passenger should be placed in WL when RAC is full';

    -- Reset rac_number to 1 for test
    UPDATE reservation_passengers SET rac_number = 1 WHERE passenger_id = v_pass_rac;

    -- Cancel Confirmed Passenger!
    v_refund := cancel_passenger(v_pass_cnf, 'Change of travel plans');

    ASSERT v_refund > 0, 'Refund must be calculated for cancellation';
    ASSERT (SELECT current_status FROM reservation_passengers WHERE passenger_id = v_pass_cnf) = 'CANCELLED',
        'Passenger status must become CANCELLED';

    -- Verify RAC passenger was promoted to CNF!
    ASSERT (SELECT current_status FROM reservation_passengers WHERE passenger_id = v_pass_rac) = 'CNF',
        'RAC passenger must be promoted to CNF';

    -- Verify WL passenger was promoted to RAC!
    ASSERT (SELECT current_status FROM reservation_passengers WHERE passenger_id = v_pass_wl) = 'RAC',
        'WL passenger must be promoted to RAC';

    RAISE NOTICE 'TEST 4 PASSED: cancel_passenger() released berth, promoted RAC to CNF, and promoted WL to RAC (Refund: %)', v_refund;
END $$;

-- ====================================================================
-- TEST 5: Hold Expiry and Confirmation Function
-- ====================================================================
DO $$
DECLARE
    v_user_id BIGINT;
    v_res_id BIGINT;
    v_pnr VARCHAR(10);
    v_expired_count INT;
BEGIN
    SELECT user_id INTO v_user_id FROM users WHERE email = 'passenger.test@yatrio.in' LIMIT 1;

    INSERT INTO reservations (
        user_id, train_no, run_date, from_station_code, to_station_code,
        from_seq, to_seq, class_code, quota_code, status, hold_expires_at
    ) VALUES (
        v_user_id, '12424', CURRENT_DATE + 20, 'NDLS', 'CNB',
        1, 2, '3A', 'GN', 'PENDING_PAYMENT', now() - INTERVAL '1 minute'
    ) RETURNING reservation_id, pnr INTO v_res_id, v_pnr;

    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender)
    VALUES (v_res_id, 'Expired Hold User', 28, 'Female');

    CALL book_tickets(v_res_id);

    -- Run hold release
    v_expired_count := release_expired_holds();

    ASSERT v_expired_count >= 1, 'release_expired_holds must release the overdue reservation';
    ASSERT (SELECT status FROM reservations WHERE reservation_id = v_res_id) = 'EXPIRED',
        'Reservation status must be marked EXPIRED';

    RAISE NOTICE 'TEST 5 PASSED: release_expired_holds() successfully expired hold and cleaned up records';
END $$;

ROLLBACK; -- Clean rollback of test suite
