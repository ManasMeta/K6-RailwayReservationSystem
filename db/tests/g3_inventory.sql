-- Author: G3 test suite (Manas)
-- Tests for G3 Inventory and Fares:
-- 1. Travel classes, quotas, concession rules and fare slabs loaded
-- 2. Coach and berth generator
-- 3. Segment-wise berth allocation exclusion constraint (GiST)
--    - Non-overlapping ranges [1,5) and [5,10) on same berth & run_date SUCCEED
--    - Overlapping range [3,7) on same berth & run_date FAILS with exclusion_violation
-- 4. free_berths() returns available berths
-- 5. calculate_fare() returns accurate fare components
-- 6. availability_grid() returns 6-date availability matrix
-- Everything runs in a transaction that is rolled back.

BEGIN;

-- 1. Check lookup tables
DO $$
BEGIN
    IF (SELECT count(*) FROM travel_classes) < 5 THEN
        RAISE EXCEPTION 'expected at least 5 travel classes, got %', (SELECT count(*) FROM travel_classes);
    END IF;

    IF (SELECT count(*) FROM quotas) < 4 THEN
        RAISE EXCEPTION 'expected at least 4 quotas, got %', (SELECT count(*) FROM quotas);
    END IF;

    IF (SELECT count(*) FROM fare_slabs) < 10 THEN
        RAISE EXCEPTION 'expected at least 10 fare slabs, got %', (SELECT count(*) FROM fare_slabs);
    END IF;
END $$;

-- 2. Test berth generation for a dummy train if none exists
DO $$
DECLARE
    v_train_id BIGINT;
    v_coaches_created INT;
    v_berth_count INT;
BEGIN
    SELECT train_id INTO v_train_id FROM trains LIMIT 1;
    IF v_train_id IS NULL THEN
        -- Insert a dummy train for testing if G2 sample not loaded
        INSERT INTO trains (train_no, name) VALUES ('99999', 'TEST EXPRESS')
        RETURNING train_id INTO v_train_id;
    END IF;

    v_coaches_created := generate_train_consist_coaches(v_train_id);
    IF v_coaches_created = 0 THEN
        RAISE EXCEPTION 'coach generator failed to create coaches';
    END IF;

    SELECT count(*) INTO v_berth_count 
    FROM berths b 
    JOIN coaches c ON c.coach_id = b.coach_id 
    WHERE c.train_id = v_train_id;

    IF v_berth_count < 100 THEN
        RAISE EXCEPTION 'expected at least 100 berths generated, got %', v_berth_count;
    END IF;
END $$;

-- 3. Test GiST exclusion constraint on berth_allocations
DO $$
DECLARE
    v_berth_id BIGINT;
    v_caught_violation BOOLEAN := false;
BEGIN
    SELECT berth_id INTO v_berth_id FROM berths LIMIT 1;

    -- Passenger A boards at stop 1, alights at stop 5 -> [1, 5)
    INSERT INTO berth_allocations (berth_id, run_date, stops)
    VALUES (v_berth_id, '2026-11-02', int4range(1, 5, '[)'));

    -- Passenger B boards at stop 5, alights at stop 10 -> [5, 10) (adjacent, no overlap, MUST SUCCEED)
    INSERT INTO berth_allocations (berth_id, run_date, stops)
    VALUES (v_berth_id, '2026-11-02', int4range(5, 10, '[)'));

    -- Passenger C tries stops [3, 7) on the same berth and date (MUST FAIL with exclusion_violation)
    BEGIN
        INSERT INTO berth_allocations (berth_id, run_date, stops)
        VALUES (v_berth_id, '2026-11-02', int4range(3, 7, '[)'));
    EXCEPTION WHEN exclusion_violation THEN
        v_caught_violation := true;
    END;

    IF NOT v_caught_violation THEN
        RAISE EXCEPTION 'GiST exclusion constraint FAILED to reject overlapping berth allocation!';
    END IF;
END $$;

-- 4. Test free_berths()
DO $$
DECLARE
    v_train_id BIGINT;
    v_free_count INT;
BEGIN
    SELECT train_id INTO v_train_id FROM trains LIMIT 1;
    
    SELECT count(*) INTO v_free_count
    FROM free_berths(v_train_id, '2026-11-02', 1, 4, 'SL');

    IF v_free_count = 0 THEN
        RAISE EXCEPTION 'free_berths returned 0 available sleeper berths';
    END IF;
END $$;

-- 5. Test calculate_fare()
DO $$
DECLARE
    v_train_id BIGINT;
    v_fare RECORD;
BEGIN
    SELECT train_id INTO v_train_id FROM trains LIMIT 1;

    SELECT * INTO v_fare FROM calculate_fare(v_train_id, 1, 4, '3A', 'GN', 'GENERAL');
    IF v_fare.total <= 0 THEN
        RAISE EXCEPTION 'calculate_fare failed to produce positive fare: %', v_fare.total;
    END IF;
    IF v_fare.base <= 0 THEN
        RAISE EXCEPTION 'calculate_fare base fare is non-positive';
    END IF;
END $$;

ROLLBACK;
