-- Tests for prepare_chart(). Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g6_prepare_chart.sql
-- Everything happens inside one transaction that is rolled back at the end.
BEGIN;

DO $$
DECLARE
    v_run   train_runs%ROWTYPE;
    v_res   RECORD;
    v_from  INT;
    v_to    INT;
    v_out   RECORD;
    v_n     INT;
    v_rac   BIGINT;
    v_wl1   BIGINT;
    v_wl2   BIGINT;
BEGIN
    -- find an open run that has a confirmed booking
    SELECT tr.* INTO v_run
      FROM train_runs tr
     WHERE tr.status IN ('SCHEDULED', 'DELAYED') AND NOT tr.chart_prepared
       AND EXISTS (SELECT 1 FROM reservations r
                    WHERE r.train_id = tr.train_id AND r.run_date = tr.run_date AND r.status = 'CONFIRMED')
     ORDER BY tr.run_id LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'TEST SETUP: no open run with a confirmed booking (load g6 demo data first)'; END IF;

    SELECT r.pnr, r.class_code, r.from_station_id, r.to_station_id INTO v_res
      FROM reservations r
     WHERE r.train_id = v_run.train_id AND r.run_date = v_run.run_date AND r.status = 'CONFIRMED'
     ORDER BY r.pnr LIMIT 1;
    SELECT seq INTO v_from FROM train_stops WHERE train_id = v_run.train_id AND station_id = v_res.from_station_id;
    SELECT seq INTO v_to   FROM train_stops WHERE train_id = v_run.train_id AND station_id = v_res.to_station_id;

    -- make the class FULL on that stretch (anonymous holds), so nobody can be promoted
    INSERT INTO berth_allocations (berth_id, run_date, stops, allocation_type)
    SELECT fb.berth_id, v_run.run_date, int4range(v_from, v_to, '[)'), 'CNF'
      FROM free_berths(v_run.train_id, v_run.run_date, v_from, v_to, v_res.class_code) fb;

    -- booking order: RAC is added LAST but must still win over the waiting list
    INSERT INTO reservation_passengers (pnr, full_name, age, gender, current_status, wl_number)
    VALUES (v_res.pnr, 'Test Wl One', 30, 'F', 'WL', 1) RETURNING passenger_id INTO v_wl1;
    INSERT INTO reservation_passengers (pnr, full_name, age, gender, current_status, wl_number)
    VALUES (v_res.pnr, 'Test Wl Two', 30, 'F', 'WL', 2) RETURNING passenger_id INTO v_wl2;
    INSERT INTO reservation_passengers (pnr, full_name, age, gender, current_status, rac_number)
    VALUES (v_res.pnr, 'Test Rac One', 30, 'M', 'RAC', 1) RETURNING passenger_id INTO v_rac;

    -- free exactly two berths (as if two people cancelled)
    DELETE FROM berth_allocations
     WHERE allocation_id IN (SELECT allocation_id FROM berth_allocations
                              WHERE passenger_id IS NULL AND run_date = v_run.run_date
                                AND stops = int4range(v_from, v_to, '[)')
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
                 JOIN reservations r ON r.pnr = rp.pnr
                WHERE ce.chart_id = v_out.o_chart_id
                  AND r.status NOT IN ('CONFIRMED', 'PARTIALLY_CANCELLED')) THEN
        RAISE EXCEPTION 'TEST 5b FAIL: chart contains passengers of unpaid or cancelled bookings'; END IF;
    RAISE NOTICE 'TEST 5b PASS: only paid bookings are on the chart';
END $$;

DO $$
DECLARE v_cancelled BIGINT; v_state TEXT;
BEGIN
    SELECT run_id INTO v_cancelled FROM train_runs WHERE status = 'CANCELLED' LIMIT 1;
    BEGIN
        PERFORM prepare_chart(v_cancelled);
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
