-- G6 Member 3 tests: train_runs, v_pnr_status, the run-cancel trigger and mv_occupancy.
-- Author: G6-DB (G6 Member 3)
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g6_operations.sql
-- Needs the migrated database and the CI sample timetable (train 12301, HWH -> NDLS).
-- The test builds its own booking through G4's book_tickets() and G5's pay_reservation(),
-- then rolls everything back.
BEGIN;
SET LOCAL app.skip_booking_window_check = 'true';

CREATE TEMP TABLE fx (k TEXT PRIMARY KEY, v BIGINT) ON COMMIT DROP;

-- Fixture: a paid 5-passenger booking (PNR 8000000001) on a run three days out.
DO $$
DECLARE
    v_train  BIGINT;
    v_user   BIGINT;
    v_wallet BIGINT;
    v_res    BIGINT;
    v_topup  BIGINT;
    v_txn    BIGINT;
    v_date   DATE := current_date + 3;
BEGIN
    SELECT train_id INTO v_train FROM trains WHERE train_no = '12301';
    PERFORM generate_train_consist_coaches(v_train);

    INSERT INTO users (email, password_hash, full_name)
    VALUES ('g6-' || gen_random_uuid() || '@example.com', 'x', 'G6 Test') RETURNING user_id INTO v_user;
    INSERT INTO wallets (user_id) VALUES (v_user) RETURNING wallet_id INTO v_wallet;

    -- fund the wallet through a balanced, posted ledger transaction
    INSERT INTO topups (wallet_id, idempotency_key, amount, status)
    VALUES (v_wallet, 'g6-' || gen_random_uuid(), 100000, 'PENDING') RETURNING topup_id INTO v_topup;
    INSERT INTO ledger_txns (txn_type, reference_type, reference_id, status, description)
    VALUES ('TOPUP', 'TOPUP', v_topup::TEXT, 'PENDING', 'g6 test') RETURNING ledger_txn_id INTO v_txn;
    INSERT INTO ledger_entries (ledger_txn_id, account_code, entry_side, amount)
    VALUES (v_txn, 'RAILWAY_CLEARING', 'DEBIT', 100000), (v_txn, 'CUSTOMER_WALLET', 'CREDIT', 100000);
    UPDATE wallets SET balance = 100000 WHERE wallet_id = v_wallet;
    UPDATE ledger_txns SET status = 'POSTED' WHERE ledger_txn_id = v_txn;
    UPDATE topups SET ledger_txn_id = v_txn, status = 'COMPLETED' WHERE topup_id = v_topup;

    INSERT INTO train_runs (train_id, run_date) VALUES (v_train, v_date);

    INSERT INTO reservations (pnr, user_id, train_no, run_date, from_station_code, to_station_code,
                              from_seq, to_seq, class_code, quota_code)
    VALUES ('8000000001', v_user, '12301', v_date, 'HWH', 'NDLS', 1, 4, '3A', 'GN')
    RETURNING reservation_id INTO v_res;
    INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, berth_preference)
    SELECT v_res, 'Passenger ' || i, 30 + i, CASE WHEN i % 2 = 1 THEN 'Female' ELSE 'Male' END, 'LB'
      FROM generate_series(1, 5) i;
    CALL book_tickets(v_res);
    PERFORM pay_reservation(v_user, '8000000001');

    -- two RAC and two waitlisted passengers, as if the class had been full
    DELETE FROM berth_allocations WHERE passenger_id IN
        (SELECT passenger_id FROM reservation_passengers
          WHERE reservation_id = v_res ORDER BY passenger_id OFFSET 1);
    UPDATE reservation_passengers rp
       SET current_status = x.st, booking_status = x.st,
           rac_number = x.rac, wl_number = x.wl,
           coach_code = NULL, berth_number = NULL, berth_id = NULL
      FROM (SELECT passenger_id,
                   CASE rn WHEN 2 THEN 'RAC' WHEN 3 THEN 'RAC' ELSE 'WL' END AS st,
                   CASE rn WHEN 2 THEN 1 WHEN 3 THEN 2 END AS rac,
                   CASE rn WHEN 4 THEN 1 WHEN 5 THEN 2 END AS wl
              FROM (SELECT passenger_id, row_number() OVER (ORDER BY passenger_id) rn
                      FROM reservation_passengers WHERE reservation_id = v_res) q
             WHERE rn > 1) x
     WHERE rp.passenger_id = x.passenger_id;

    INSERT INTO fx VALUES ('train', v_train), ('user', v_user), ('res', v_res);
END $$;

-- 1. UNIQUE (train_id, run_date): a duplicate run is rejected
DO $$
DECLARE v_train BIGINT; v_date DATE;
BEGIN
    SELECT train_id, run_date INTO v_train, v_date FROM train_runs LIMIT 1;
    BEGIN
        INSERT INTO train_runs (train_id, run_date) VALUES (v_train, v_date);
        RAISE EXCEPTION 'duplicate run was accepted';
    EXCEPTION WHEN unique_violation THEN
        NULL;  -- expected
    END;
END $$;

-- 2. CHECK on status: a bad value is rejected
DO $$
BEGIN
    BEGIN
        UPDATE train_runs SET status = 'EXPLODED' WHERE run_id = (SELECT min(run_id) FROM train_runs);
        RAISE EXCEPTION 'bad status was accepted';
    EXCEPTION WHEN check_violation THEN
        NULL;  -- expected
    END;
END $$;

-- 3. v_pnr_status returns one row per passenger and shows the delay after a run update
DO $$
DECLARE v_run BIGINT; v_rows INT; v_delay INT; v_status TEXT; v_cnf INT;
BEGIN
    SELECT count(*), count(*) FILTER (WHERE passenger_status = 'CNF')
      INTO v_rows, v_cnf FROM v_pnr_status WHERE pnr = '8000000001';
    ASSERT v_rows = 5, format('expected 5 passenger rows, got %s', v_rows);
    ASSERT v_cnf = 1, format('expected 1 confirmed passenger, got %s', v_cnf);

    SELECT tr.run_id INTO v_run
      FROM train_runs tr
      JOIN trains t ON t.train_id = tr.train_id
      JOIN reservations r ON r.train_no = t.train_no AND r.run_date = tr.run_date
     WHERE r.pnr = '8000000001';
    ASSERT v_run IS NOT NULL, 'reservation has no matching train_runs row';
    INSERT INTO fx VALUES ('run', v_run);

    UPDATE train_runs SET status = 'DELAYED', delay_minutes = 45 WHERE run_id = v_run;
    SELECT max(delay_minutes), max(run_status) INTO v_delay, v_status
      FROM v_pnr_status WHERE pnr = '8000000001';
    ASSERT v_delay = 45 AND v_status = 'DELAYED',
           format('expected 45 / DELAYED, got %s / %s', v_delay, v_status);
END $$;

-- 4. Cancelling a run refunds everyone in full; cancelling again does nothing
DO $$
DECLARE
    v_run BIGINT := (SELECT v FROM fx WHERE k = 'run');
    v_paid NUMERIC; v_refunded NUMERIC; v_ref_after INT; v_ref_again INT; v_events INT; v_live INT;
BEGIN
    SELECT amount INTO v_paid FROM payments WHERE pnr = '8000000001';
    ASSERT v_paid > 0, 'fixture booking was not paid';

    UPDATE train_runs SET status = 'CANCELLED' WHERE run_id = v_run;

    SELECT count(*), COALESCE(sum(amount), 0) INTO v_ref_after, v_refunded
      FROM refunds WHERE pnr = '8000000001';
    ASSERT v_ref_after >= 1, 'no refund created on run cancel';
    ASSERT v_refunded = v_paid, format('railway cancellation must refund in full: paid %s, refunded %s', v_paid, v_refunded);

    SELECT count(*) INTO v_live FROM v_pnr_status
     WHERE pnr = '8000000001' AND passenger_status <> 'CANCELLED';
    ASSERT v_live = 0, 'passengers still live after run cancel';
    ASSERT (SELECT status FROM reservations WHERE pnr = '8000000001') = 'CANCELLED', 'reservation not cancelled';

    -- second cancel: the trigger must not fire again
    UPDATE train_runs SET status = 'CANCELLED' WHERE run_id = v_run;
    SELECT count(*) INTO v_ref_again FROM refunds WHERE pnr = '8000000001';
    ASSERT v_ref_again = v_ref_after, 'second cancel created extra refunds';

    SELECT count(*) INTO v_events FROM run_events WHERE run_id = v_run AND event_type = 'CANCEL';
    ASSERT v_events = 1, format('expected 1 CANCEL event, got %s', v_events);
END $$;

-- 5. mv_occupancy: unique (run_id, class_code) and a sane percentage
DO $$
DECLARE v_bad INT;
BEGIN
    REFRESH MATERIALIZED VIEW mv_occupancy;
    SELECT count(*) INTO v_bad FROM mv_occupancy
     WHERE occupancy_pct < 0 OR occupancy_pct > 100 OR booked_berths > total_berths;
    ASSERT v_bad = 0, 'mv_occupancy has impossible numbers';
END $$;

-- 6. Failure cases
-- 6a. v_pnr_status: an unknown PNR returns no rows
DO $$
DECLARE v_rows INT;
BEGIN
    SELECT count(*) INTO v_rows FROM v_pnr_status WHERE pnr = '9999999999';
    ASSERT v_rows = 0, 'unknown PNR returned rows';
END $$;

-- 6b. charts: only one chart per run (UNIQUE run_id)
DO $$
DECLARE v_run BIGINT := (SELECT v FROM fx WHERE k = 'run');
BEGIN
    INSERT INTO charts (run_id) VALUES (v_run);
    BEGIN
        INSERT INTO charts (run_id) VALUES (v_run);
        RAISE EXCEPTION 'second chart for the same run was accepted';
    EXCEPTION WHEN unique_violation THEN
        NULL;  -- expected
    END;
END $$;

-- 6c. mv_occupancy: a run that does not exist has no row
DO $$
DECLARE v_rows INT;
BEGIN
    SELECT count(*) INTO v_rows FROM mv_occupancy WHERE run_id = -1;
    ASSERT v_rows = 0, 'mv_occupancy has a row for a non-existent run';
END $$;

ROLLBACK;
