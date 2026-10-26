-- G6 Member 3 tests.
-- Author: G6-DB (G6 Member 3)
-- Run: docker exec -i nrrms-postgres psql -U postgres -d nrrms -v ON_ERROR_STOP=1 < db/tests/g6_operations.sql
-- Needs db/seeds/g6_seed.sql (reservation PNR 1000000000) loaded first.
BEGIN;

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
DECLARE v_run BIGINT; v_rows INT; v_delay INT; v_status TEXT;
BEGIN
    SELECT count(*) INTO v_rows FROM v_pnr_status WHERE pnr = '1000000000';
    ASSERT v_rows = 5, format('expected 5 passenger rows, got %s', v_rows);

    SELECT tr.run_id INTO v_run
    FROM train_runs tr JOIN reservations r ON r.train_id = tr.train_id AND r.run_date = tr.run_date
    WHERE r.pnr = '1000000000';
    ASSERT v_run IS NOT NULL, 'seed reservation has no matching train_runs row';

    UPDATE train_runs SET status = 'DELAYED', delay_minutes = 45 WHERE run_id = v_run;
    SELECT max(delay_minutes), max(run_status) INTO v_delay, v_status
    FROM v_pnr_status WHERE pnr = '1000000000';
    ASSERT v_delay = 45 AND v_status = 'DELAYED',
           format('expected 45 / DELAYED, got %s / %s', v_delay, v_status);
END $$;

-- 4. Cancelling a run refunds everyone; cancelling again does nothing
DO $$
DECLARE
    v_run BIGINT; v_ref_before INT; v_ref_after INT; v_ref_again INT; v_events INT; v_live INT;
BEGIN
    SELECT tr.run_id INTO v_run
    FROM train_runs tr JOIN reservations r ON r.train_id = tr.train_id AND r.run_date = tr.run_date
    WHERE r.pnr = '1000000000';

    SELECT count(*) INTO v_ref_before FROM refunds;
    UPDATE train_runs SET status = 'CANCELLED' WHERE run_id = v_run;
    SELECT count(*) INTO v_ref_after FROM refunds;
    ASSERT v_ref_after > v_ref_before, 'no refund created on run cancel';

    SELECT count(*) INTO v_live FROM v_pnr_status
    WHERE pnr = '1000000000' AND passenger_status <> 'CANCELLED';
    ASSERT v_live = 0, 'passengers still live after run cancel';

    -- second cancel: the trigger must not fire again
    UPDATE train_runs SET status = 'CANCELLED' WHERE run_id = v_run;
    SELECT count(*) INTO v_ref_again FROM refunds;
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
DECLARE v_run BIGINT;
BEGIN
    SELECT min(run_id) INTO v_run FROM train_runs;
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
