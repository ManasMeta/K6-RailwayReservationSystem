-- Author: G6-Backend (G6 Member 2)
-- Description: prepare_chart(run_id, user_id) - final chart of a train run.
--   1. locks the run row, so two staff members cannot prepare the same chart at once
--   2. walks every RAC / WL passenger of the run in booking order with an explicit cursor
--      (RAC before WL, then oldest booking first) and gives each one the first free berth of
--      their class for their own stretch of the route (G3's free_berths())
--   3. records how many were waiting and how many were promoted (for the WL-conversion report)
--   4. writes one chart_entries row per remaining passenger, and sets chart_prepared = true
-- Running it twice is safe: the second call returns the existing chart and changes nothing.
CREATE OR REPLACE FUNCTION prepare_chart(
    p_run_id  BIGINT,
    p_user_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    o_chart_id            BIGINT,
    o_promoted            INT,
    o_remaining_rac       INT,
    o_remaining_wl        INT,
    o_final_vacant_berths INT,
    o_already_prepared    BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_run       train_runs%ROWTYPE;
    v_chart_id  BIGINT;
    v_promoted  INT := 0;
    v_waiting   INT := 0;
    v_rac       INT;
    v_wl        INT;
    v_vacant    INT;
    v_pass      RECORD;
    v_berth     RECORD;

    -- RAC passengers first, then WL; inside each, the earliest booking first.
    c_waiting CURSOR (cp_train BIGINT, cp_date DATE) FOR
        SELECT rp.passenger_id,
               rp.berth_preference,
               r.class_code,
               r.from_seq,
               r.to_seq
          FROM reservation_passengers rp
          JOIN reservations r ON r.reservation_id = rp.reservation_id
          JOIN trains t ON t.train_no = r.train_no
         WHERE t.train_id = cp_train
           AND r.run_date = cp_date
           AND r.status IN ('CONFIRMED', 'PARTIALLY_CANCELLED')
           AND rp.current_status IN ('RAC', 'WL')
         ORDER BY CASE rp.current_status WHEN 'RAC' THEN 1 ELSE 2 END,
                  r.created_at, rp.passenger_id
           FOR UPDATE OF rp;
BEGIN
    SELECT * INTO v_run FROM train_runs WHERE run_id = p_run_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Run % not found', p_run_id USING ERRCODE = 'P0002';
    END IF;
    IF v_run.status IN ('CANCELLED', 'DEPARTED') THEN
        RAISE EXCEPTION 'Run % is %, no chart can be prepared', p_run_id, v_run.status
            USING ERRCODE = '55000';
    END IF;

    -- Already done: hand back the existing chart.
    IF v_run.chart_prepared THEN
        SELECT c.chart_id, c.final_vacant_berths INTO v_chart_id, v_vacant
          FROM charts c WHERE c.run_id = p_run_id;
        SELECT count(*) FILTER (WHERE ce_status = 'RAC'), count(*) FILTER (WHERE ce_status = 'WL')
          INTO v_rac, v_wl
          FROM (SELECT rp.current_status AS ce_status
                  FROM chart_entries ce
                  JOIN reservation_passengers rp ON rp.passenger_id = ce.passenger_id
                 WHERE ce.chart_id = v_chart_id) x;
        RETURN QUERY SELECT v_chart_id, 0, v_rac, v_wl, v_vacant, true;
        RETURN;
    END IF;

    -- Give berths to waiting passengers, in booking order.
    FOR v_pass IN c_waiting(v_run.train_id, v_run.run_date) LOOP
        v_waiting := v_waiting + 1;
        FOR v_berth IN
            SELECT fb.berth_id, fb.coach_code, fb.berth_number, fb.berth_type
              FROM free_berths(v_run.train_id, v_run.run_date, v_pass.from_seq, v_pass.to_seq,
                               v_pass.class_code) fb
             ORDER BY (fb.berth_type = v_pass.berth_preference) DESC NULLS LAST,
                      fb.coach_code, fb.berth_number
        LOOP
            BEGIN
                -- a booking made at the same moment may take this berth first;
                -- the exclusion constraint then rejects ours and we try the next berth
                INSERT INTO berth_allocations (berth_id, run_date, stops, passenger_id, allocation_type)
                VALUES (v_berth.berth_id, v_run.run_date,
                        int4range(v_pass.from_seq, v_pass.to_seq, '[)'),
                        v_pass.passenger_id, 'CNF');

                UPDATE reservation_passengers
                   SET current_status = 'CNF', booking_status = 'CNF',
                       coach_code = v_berth.coach_code, berth_id = v_berth.berth_id,
                       berth_number = v_berth.berth_number, berth_type = v_berth.berth_type,
                       rac_number = NULL, wl_number = NULL, updated_at = now()
                 WHERE passenger_id = v_pass.passenger_id;

                v_promoted := v_promoted + 1;
                EXIT;
            EXCEPTION WHEN exclusion_violation THEN
                NULL;
            END;
        END LOOP;
    END LOOP;

    -- Write the chart.
    INSERT INTO charts (run_id, prepared_by, waiting_before, promoted)
    VALUES (p_run_id, p_user_id, v_waiting, v_promoted)
    RETURNING chart_id INTO v_chart_id;

    INSERT INTO chart_entries (chart_id, passenger_id, coach_code, berth_no, berth_type, quota_code)
    SELECT v_chart_id, rp.passenger_id, rp.coach_code, rp.berth_number, rp.berth_type, r.quota_code
      FROM reservation_passengers rp
      JOIN reservations r ON r.reservation_id = rp.reservation_id
      JOIN trains t ON t.train_no = r.train_no
     WHERE t.train_id = v_run.train_id
       AND r.run_date = v_run.run_date
       AND r.status IN ('CONFIRMED', 'PARTIALLY_CANCELLED')   -- unpaid bookings are not on the chart
       AND rp.current_status IN ('CNF', 'RAC', 'WL')
     ORDER BY rp.passenger_id;

    SELECT count(*) FILTER (WHERE rp.current_status = 'RAC'),
           count(*) FILTER (WHERE rp.current_status = 'WL')
      INTO v_rac, v_wl
      FROM chart_entries ce
      JOIN reservation_passengers rp ON rp.passenger_id = ce.passenger_id
     WHERE ce.chart_id = v_chart_id;

    -- Berths nobody holds on this date.
    SELECT count(*) INTO v_vacant
      FROM berths b
      JOIN coaches co ON co.coach_id = b.coach_id
     WHERE co.train_id = v_run.train_id
       AND NOT EXISTS (SELECT 1 FROM berth_allocations ba
                        WHERE ba.berth_id = b.berth_id AND ba.run_date = v_run.run_date);

    UPDATE charts SET final_vacant_berths = v_vacant WHERE chart_id = v_chart_id;

    -- Lock the run: chart_prepared = true, and log it.
    UPDATE train_runs SET chart_prepared = true WHERE run_id = p_run_id;
    INSERT INTO run_events (run_id, event_type, notes, recorded_by)
    VALUES (p_run_id, 'CHART',
            format('Chart prepared: %s promoted, %s RAC, %s WL left', v_promoted, v_rac, v_wl),
            p_user_id);

    RETURN QUERY SELECT v_chart_id, v_promoted, v_rac, v_wl, v_vacant, false;
END;
$$;
