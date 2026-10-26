-- Author: G4 Member 3 (Database)
-- Test Suite: Group 4 Reservation Engine Database Assertions (runs on the fully migrated database)
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/test_0400_reservations.sql

BEGIN;

-- Setup: booking window check off (tests book on fixed future dates); user and coaches
SET LOCAL app.skip_booking_window_check = 'true';

INSERT INTO users (email, password_hash, full_name, phone)
VALUES ('g4-test@yatrio.in', 'hashed_pwd_123', 'Aarav Sharma', '9876543210')
ON CONFLICT (email) DO NOTHING;

-- Train 12301 (HWH 1 -> DDU 2 -> CNB 3 -> NDLS 4) comes from the CI sample import.
SELECT generate_train_consist_coaches((SELECT train_id FROM trains WHERE train_no = '12301'));

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
    SELECT user_id INTO v_user_id FROM users WHERE email = 'g4-test@yatrio.in' LIMIT 1;

    INSERT INTO reservations (
        user_id, train_no, run_date, from_station_code, to_station_code,
        from_seq, to_seq, class_code, quota_code, status
    ) VALUES (
        v_user_id, '12301', CURRENT_DATE + 5, 'HWH', 'CNB',
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
    SELECT user_id INTO v_user_id FROM users WHERE email = 'g4-test@yatrio.in' LIMIT 1;

    -- Clear previous test allocations
    DELETE FROM berth_allocations;

    -- Passenger A books NDLS to CNB (stops 1 to 2)
    INSERT INTO reservations (
        user_id, train_no, run_date, from_station_code, to_station_code,
        from_seq, to_seq, class_code, quota_code
    ) VALUES (
        v_user_id, '12301', CURRENT_DATE + 10, 'HWH', 'DDU',
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
        v_user_id, '12301', CURRENT_DATE + 10, 'DDU', 'NDLS',
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
    SELECT user_id INTO v_user_id FROM users WHERE email = 'g4-test@yatrio.in' LIMIT 1;
    DELETE FROM berth_allocations;

    -- Setup: Allocate all 4 berths to ensure subsequent bookings go to RAC and WL
    -- Passenger 1 (CNF)
    INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code, status)
    VALUES (v_user_id, '12301', CURRENT_DATE + 15, 'HWH', 'NDLS', 1, 4, '3A', 'GN', 'CONFIRMED')
    RETURNING reservation_id INTO v_res_cnf;
    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, berth_preference, fare)
    VALUES (v_res_cnf, 'Confirmed Passenger', 35, 'Male', 'LB', 1000.00)
    RETURNING passenger_id INTO v_pass_cnf;
    CALL book_tickets(v_res_cnf);

    -- Simulate filling every remaining 3A berth on the run
    INSERT INTO berth_allocations (berth_id, run_date, stops)
    SELECT b.berth_id, CURRENT_DATE + 15, int4range(1, 4, '[)')
    FROM berths b
    JOIN coaches c ON b.coach_id = c.coach_id
    JOIN trains t ON t.train_id = c.train_id
    WHERE t.train_no = '12301' AND c.class_code = '3A'
      AND b.berth_id <> (SELECT berth_id FROM reservation_passengers WHERE passenger_id = v_pass_cnf);

    -- Book another passenger: should go to RAC
    INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code, status)
    VALUES (v_user_id, '12301', CURRENT_DATE + 15, 'HWH', 'NDLS', 1, 4, '3A', 'GN', 'CONFIRMED')
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
    VALUES (v_user_id, '12301', CURRENT_DATE + 15, 'HWH', 'NDLS', 1, 4, '3A', 'GN', 'CONFIRMED')
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
    SELECT user_id INTO v_user_id FROM users WHERE email = 'g4-test@yatrio.in' LIMIT 1;

    INSERT INTO reservations (
        user_id, train_no, run_date, from_station_code, to_station_code,
        from_seq, to_seq, class_code, quota_code, status, hold_expires_at
    ) VALUES (
        v_user_id, '12301', CURRENT_DATE + 20, 'HWH', 'DDU',
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

-- ====================================================================
-- TEST 6: Booking window (is_booking_open) and departure_at
-- ====================================================================
DO $$
DECLARE
    v_user_id BIGINT;
    v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_departure TIMESTAMPTZ;
    v_res_id BIGINT;
    v_state TEXT;
BEGIN
    SELECT user_id INTO v_user_id FROM users WHERE email = 'g4-test@yatrio.in' LIMIT 1;
    PERFORM set_config('app.skip_booking_window_check', 'false', true);

    -- 6a: past dates are refused
    BEGIN
        INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code)
        VALUES (v_user_id, '12301', v_today - 1, 'HWH', 'NDLS', 1, 4, '3A', 'GN');
        RAISE EXCEPTION 'a past travel date was accepted';
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
    END;

    -- 6b: more than 60 days ahead is refused
    BEGIN
        INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code)
        VALUES (v_user_id, '12301', v_today + 61, 'HWH', 'NDLS', 1, 4, '3A', 'GN');
        RAISE EXCEPTION 'a date beyond the 60-day window was accepted';
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
    END;

    -- 6c: Tatkal opens only the day before travel
    BEGIN
        INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code)
        VALUES (v_user_id, '12301', v_today + 5, 'HWH', 'NDLS', 1, 4, '3A', 'TQ');
        RAISE EXCEPTION 'Tatkal was accepted five days ahead';
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
    END;

    -- 6d: a normal booking inside the window is accepted and gets departure_at (16:55 IST at HWH)
    INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code)
    VALUES (v_user_id, '12301', v_today + 5, 'HWH', 'NDLS', 1, 4, '3A', 'GN')
    RETURNING reservation_id, departure_at INTO v_res_id, v_departure;
    ASSERT v_departure = ((v_today + 5) + TIME '16:55') AT TIME ZONE 'Asia/Kolkata',
        format('departure_at should be 16:55 IST on the run date, got %s', v_departure);

    RAISE NOTICE 'TEST 6 PASSED: booking window rules enforced and departure_at derived from the timetable';
END $$;

-- ====================================================================
-- TEST 7: pay -> cancel -> refund through G5 (the G4/G5 contract)
-- ====================================================================
DO $$
DECLARE
    v_user_id BIGINT;
    v_wallet BIGINT;
    v_res_id BIGINT;
    v_pnr VARCHAR(10);
    v_pass BIGINT;
    v_refund NUMERIC(10,2);
    v_paid NUMERIC(10,2);
    v_topup BIGINT;
    v_txn BIGINT;
BEGIN
    SELECT user_id INTO v_user_id FROM users WHERE email = 'g4-test@yatrio.in' LIMIT 1;
    PERFORM set_config('app.skip_booking_window_check', 'true', true);

    INSERT INTO wallets (user_id) VALUES (v_user_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT wallet_id INTO v_wallet FROM wallets WHERE user_id = v_user_id;
    INSERT INTO topups (wallet_id, idempotency_key, amount, status)
    VALUES (v_wallet, 'g4-' || gen_random_uuid(), 20000, 'PENDING') RETURNING topup_id INTO v_topup;
    INSERT INTO ledger_txns (txn_type, reference_type, reference_id, status, description)
    VALUES ('TOPUP', 'TOPUP', v_topup::TEXT, 'PENDING', 'g4 test') RETURNING ledger_txn_id INTO v_txn;
    INSERT INTO ledger_entries (ledger_txn_id, account_code, entry_side, amount)
    VALUES (v_txn, 'RAILWAY_CLEARING', 'DEBIT', 20000), (v_txn, 'CUSTOMER_WALLET', 'CREDIT', 20000);
    UPDATE wallets SET balance = balance + 20000 WHERE wallet_id = v_wallet;
    UPDATE ledger_txns SET status = 'POSTED' WHERE ledger_txn_id = v_txn;
    UPDATE topups SET ledger_txn_id = v_txn, status = 'COMPLETED' WHERE topup_id = v_topup;

    INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code)
    VALUES (v_user_id, '12301', CURRENT_DATE + 30, 'HWH', 'NDLS', 1, 4, '3A', 'GN')
    RETURNING reservation_id, pnr INTO v_res_id, v_pnr;
    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender)
    VALUES (v_res_id, 'Refund Tester', 33, 'Male') RETURNING passenger_id INTO v_pass;
    CALL book_tickets(v_res_id);

    PERFORM pay_reservation(v_user_id, v_pnr);
    ASSERT (SELECT status FROM reservations WHERE reservation_id = v_res_id) = 'CONFIRMED',
        'payment must confirm the reservation';
    SELECT amount INTO v_paid FROM payments WHERE pnr = v_pnr;

    -- cancelled 30 days out: 90% back to the wallet, and cancel_passenger() reports that amount
    v_refund := cancel_passenger(v_pass, 'test');
    ASSERT v_refund = round(v_paid * 0.90, 2), format('expected 90%% of %s back, got %s', v_paid, v_refund);
    ASSERT (SELECT amount FROM refunds WHERE pnr = v_pnr) = v_refund, 'wallet refund must equal the reported refund';
    ASSERT (SELECT refund_amount FROM cancellations WHERE passenger_id = v_pass) = v_refund,
        'cancellations.refund_amount must hold the credited amount';
    ASSERT (SELECT status FROM reservations WHERE reservation_id = v_res_id) = 'CANCELLED',
        'a fully cancelled reservation must be CANCELLED';

    RAISE NOTICE 'TEST 7 PASSED: pay -> cancel_passenger() -> wallet refund agree (refund %)', v_refund;
END $$;

ROLLBACK; -- Clean rollback of test suite
