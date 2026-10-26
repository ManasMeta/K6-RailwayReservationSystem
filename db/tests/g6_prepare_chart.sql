-- Tests for prepare_chart(). Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g6_prepare_chart.sql
-- Needs the migrated database and the CI sample timetable (train 12301, HWH -> NDLS).
-- Everything happens inside one transaction that is rolled back at the end.
BEGIN;
SET LOCAL app.skip_booking_window_check = 'true';

DO $$
DECLARE
    v_train  BIGINT;
    v_user   BIGINT;
    v_wallet BIGINT;
    v_res    BIGINT;
    v_run    train_runs%ROWTYPE;
    v_date   DATE := current_date + 4;
    v_topup  BIGINT;
    v_txn    BIGINT;
    v_out    RECORD;
    v_n      INT;
    v_rac    BIGINT;
    v_wl1    BIGINT;
    v_wl2    BIGINT;
BEGIN
    SELECT train_id INTO v_train FROM trains WHERE train_no = '12301';
    PERFORM generate_train_consist_coaches(v_train);

    -- a paid booking with one confirmed passenger on a fresh run
    INSERT INTO users (email, password_hash, full_name)
    VALUES ('g6c-' || gen_random_uuid() || '@example.com', 'x', 'G6 Chart') RETURNING user_id INTO v_user;
    INSERT INTO wallets (user_id) VALUES (v_user) RETURNING wallet_id INTO v_wallet;
    INSERT INTO topups (wallet_id, idempotency_key, amount, status)
    VALUES (v_wallet, 'g6c-' || gen_random_uuid(), 50000, 'PENDING') RETURNING topup_id INTO v_topup;
    INSERT INTO ledger_txns (txn_type, reference_type, reference_id, status, description)
    VALUES ('TOPUP', 'TOPUP', v_topup::TEXT, 'PENDING', 'g6 chart test') RETURNING ledger_txn_id INTO v_txn;
    INSERT INTO ledger_entries (ledger_txn_id, account_code, entry_side, amount)
    VALUES (v_txn, 'RAILWAY_CLEARING', 'DEBIT', 50000), (v_txn, 'CUSTOMER_WALLET', 'CREDIT', 50000);
    UPDATE wallets SET balance = 50000 WHERE wallet_id = v_wallet;
    UPDATE ledger_txns SET status = 'POSTED' WHERE ledger_txn_id = v_txn;
    UPDATE topups SET ledger_txn_id = v_txn, status = 'COMPLETED' WHERE topup_id = v_topup;

    INSERT INTO train_runs (train_id, run_date) VALUES (v_train, v_date) RETURNING * INTO v_run;

    INSERT INTO reservations (pnr, user_id, train_no, run_date, from_station_code, to_station_code,
                              from_seq, to_seq, class_code, quota_code)
    VALUES ('8000000002', v_user, '12301', v_date, 'HWH', 'NDLS', 1, 4, '3A', 'GN')
    RETURNING reservation_id INTO v_res;
    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, berth_preference)
    VALUES (v_res, 'Test Confirmed', 30, 'Female', 'LB');
    CALL book_tickets(v_res);
    PERFORM pay_reservation(v_user, '8000000002');

    -- make the class FULL on that stretch (anonymous holds), so nobody can be promoted
    INSERT INTO berth_allocations (berth_id, run_date, stops, allocation_type)
    SELECT fb.berth_id, v_date, int4range(1, 4, '[)'), 'CNF'
      FROM free_berths(v_train, v_date, 1, 4, '3A') fb;

    -- booking order: RAC is added LAST but must still win over the waiting list
    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, current_status, booking_status, wl_number)
    VALUES (v_res, 'Test Wl One', 30, 'Female', 'WL', 'WL', 1) RETURNING passenger_id INTO v_wl1;
    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, current_status, booking_status, wl_number)
    VALUES (v_res, 'Test Wl Two', 30, 'Female', 'WL', 'WL', 2) RETURNING passenger_id INTO v_wl2;
    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, current_status, booking_status, rac_number)
    VALUES (v_res, 'Test Rac One', 30, 'Male', 'RAC', 'RAC', 1) RETURNING passenger_id INTO v_rac;

    -- free exactly two berths (as if two people cancelled)
    DELETE FROM berth_allocations
     WHERE allocation_id IN (SELECT allocation_id FROM berth_allocations
                              WHERE passenger_id IS NULL AND run_date = v_date
                                AND stops = int4range(1, 4, '[)')
                              ORDER BY allocation_id LIMIT 2);

    SELECT * INTO v_out FROM prepare_chart(v_run.run_id, NULL);

    IF v_out.o_promoted <> 2 THEN RAISE EXCEPTION 'TEST 1 FAIL: expected 2 promoted, got %', v_out.o_promoted; END IF;
    IF v_out.o_remaining_wl <> 1 OR v_out.o_remaining_rac <> 0 THEN
        RAISE EXCEPTION 'TEST 1 FAIL: expected 0 RAC / 1 WL left, got % / %', v_out.o_remaining_rac, v_out.o_remaining_wl; END IF;
    RAISE NOTICE 'TEST 1 PASS: 2 berths freed -> 2 promoted, 1 WL left';

    IF (SELECT current_status FROM reservation_passengers WHERE passenger_id = v_rac) <> 'CNF' THEN
        RAISE EXCEPTION 'TEST 2 FAIL: RAC passenger was not confirmed first'; END IF;
    IF (SELECT current_status FROM reservation_passengers WHERE passenger_id = v_wl1) <> 'CNF'
       OR (SELECT current_status FROM reservation_passengers WHERE passenger_id = v_wl2) <> 'WL' THEN
        RAISE EXCEPTION 'TEST 2 FAIL: the earlier WL booking must be confirmed before the later one'; END IF;
    RAISE NOTICE 'TEST 2 PASS: RAC before WL, then oldest WL first';

    SELECT count(*) INTO v_n FROM chart_entries WHERE chart_id = v_out.o_chart_id AND passenger_id IN (v_rac, v_wl1, v_wl2);
    IF v_n <> 3 THEN RAISE EXCEPTION 'TEST 3 FAIL: chart should list all 3 passengers, has %', v_n; END IF;
    IF (SELECT berth_no FROM chart_entries WHERE chart_id = v_out.o_chart_id AND passenger_id = v_rac) IS NULL THEN
        RAISE EXCEPTION 'TEST 3 FAIL: promoted passenger has no berth on the chart'; END IF;
    RAISE NOTICE 'TEST 3 PASS: chart_entries written with berths';

    IF (SELECT waiting_before FROM charts WHERE chart_id = v_out.o_chart_id) <> 3
       OR (SELECT promoted FROM charts WHERE chart_id = v_out.o_chart_id) <> 2 THEN
        RAISE EXCEPTION 'TEST 3b FAIL: chart should record 3 waiting, 2 promoted'; END IF;
    RAISE NOTICE 'TEST 3b PASS: chart records waiting_before = 3 and promoted = 2';

    IF NOT (SELECT chart_prepared FROM train_runs WHERE run_id = v_run.run_id) THEN
        RAISE EXCEPTION 'TEST 4 FAIL: run not marked chart_prepared'; END IF;
    IF NOT EXISTS (SELECT 1 FROM run_events WHERE run_id = v_run.run_id AND event_type = 'CHART') THEN
        RAISE EXCEPTION 'TEST 4 FAIL: no CHART event logged'; END IF;
    RAISE NOTICE 'TEST 4 PASS: run locked (chart_prepared) and CHART event logged';

    SELECT * INTO v_out FROM prepare_chart(v_run.run_id, NULL);
    IF NOT v_out.o_already_prepared OR v_out.o_promoted <> 0 THEN
        RAISE EXCEPTION 'TEST 5 FAIL: second call must change nothing'; END IF;
    IF (SELECT count(*) FROM charts WHERE run_id = v_run.run_id) <> 1 THEN
        RAISE EXCEPTION 'TEST 5 FAIL: more than one chart for the run'; END IF;
    RAISE NOTICE 'TEST 5 PASS: running twice is safe';

    IF EXISTS (SELECT 1 FROM chart_entries ce
                 JOIN reservation_passengers rp ON rp.passenger_id = ce.passenger_id
                 JOIN reservations r ON r.reservation_id = rp.reservation_id
                WHERE ce.chart_id = v_out.o_chart_id
                  AND r.status NOT IN ('CONFIRMED', 'PARTIALLY_CANCELLED')) THEN
        RAISE EXCEPTION 'TEST 5b FAIL: chart contains passengers of unpaid or cancelled bookings'; END IF;
    RAISE NOTICE 'TEST 5b PASS: only paid bookings are on the chart';

    -- 6/7: a cancelled run and a missing run are refused
    INSERT INTO train_runs (train_id, run_date, status) VALUES (v_train, v_date + 5, 'CANCELLED');
    BEGIN
        PERFORM prepare_chart((SELECT run_id FROM train_runs WHERE train_id = v_train AND run_date = v_date + 5));
        RAISE EXCEPTION 'TEST 6 FAIL: cancelled run accepted';
    EXCEPTION WHEN object_not_in_prerequisite_state THEN
        RAISE NOTICE 'TEST 6 PASS: cancelled run refused';
    END;
    BEGIN
        PERFORM prepare_chart(-1);
        RAISE EXCEPTION 'TEST 7 FAIL: missing run accepted';
    EXCEPTION WHEN no_data_found THEN
        RAISE NOTICE 'TEST 7 PASS: missing run refused';
    END;
END $$;

ROLLBACK;
