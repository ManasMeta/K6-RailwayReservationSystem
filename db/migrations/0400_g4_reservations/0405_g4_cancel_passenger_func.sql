-- Author: G4 Member 3 (Database)
-- Description: cancel_passenger() function that frees the berth range and promotes RAC to CNF and WL to RAC

CREATE OR REPLACE FUNCTION cancel_passenger(
    p_passenger_id BIGINT,
    p_reason TEXT DEFAULT 'Passenger cancelled'
)
RETURNS NUMERIC(10,2) AS $$
DECLARE
    v_pass RECORD;
    v_res RECORD;
    v_berth RECORD;
    v_rac_pass RECORD;
    v_rac_res RECORD;
    v_wl_pass RECORD;
    v_refund NUMERIC(10,2) := 0.00;
    v_cancellation_charge NUMERIC(10,2) := 60.00;
    v_active_count INT;
    v_cancelled_count INT;
    v_hours_to_dep NUMERIC;
    v_departure_ts TIMESTAMPTZ;
    v_stops INT4RANGE;
    v_promoted_stops INT4RANGE;
    v_coach_code VARCHAR(10);
    v_berth_number INT;
    v_berth_type VARCHAR(10);
BEGIN
    -- 1. Fetch passenger and their reservation
    SELECT * INTO v_pass
    FROM reservation_passengers
    WHERE passenger_id = p_passenger_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Passenger % not found', p_passenger_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_pass.current_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Passenger % is already cancelled', p_passenger_id
            USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_res
    FROM reservations
    WHERE reservation_id = v_pass.reservation_id
    FOR UPDATE;

    -- Calculate departure timestamp and cancellation charges
    SELECT (v_res.run_date + COALESCE(ts.departure, TIME '00:00:00'))::TIMESTAMPTZ
    INTO v_departure_ts
    FROM train_stops ts
    WHERE ts.train_no = v_res.train_no AND ts.seq = v_res.from_seq;

    IF v_departure_ts IS NULL THEN
        v_departure_ts := (v_res.run_date + TIME '00:00:00')::TIMESTAMPTZ;
    END IF;

    v_hours_to_dep := EXTRACT(EPOCH FROM (v_departure_ts - now())) / 3600.0;

    IF v_res.status = 'PENDING_PAYMENT' THEN
        -- No payment was made yet
        v_cancellation_charge := 0.00;
        v_refund := 0.00;
    ELSIF v_hours_to_dep > 48 THEN
        v_cancellation_charge := CASE
            WHEN v_res.class_code IN ('1A', 'EC') THEN 240.00
            WHEN v_res.class_code IN ('2A') THEN 200.00
            WHEN v_res.class_code IN ('3A', '3E', 'CC') THEN 180.00
            ELSE 60.00
        END;
        v_refund := GREATEST(0.00, v_pass.fare - v_cancellation_charge);
    ELSIF v_hours_to_dep >= 12 THEN
        v_cancellation_charge := ROUND(v_pass.fare * 0.25, 2);
        v_refund := GREATEST(0.00, v_pass.fare - v_cancellation_charge);
    ELSIF v_hours_to_dep >= 4 THEN
        v_cancellation_charge := ROUND(v_pass.fare * 0.50, 2);
        v_refund := GREATEST(0.00, v_pass.fare - v_cancellation_charge);
    ELSE
        -- Less than 4 hours before departure: zero refund
        v_cancellation_charge := v_pass.fare;
        v_refund := 0.00;
    END IF;

    -- 2. Handle Confirmed Berth Release & Reallocation
    IF v_pass.current_status = 'CNF' AND v_pass.berth_id IS NOT NULL THEN
        -- Get the stops range and berth before deletion
        SELECT stops, berth_id INTO v_berth
        FROM berth_allocations
        WHERE passenger_id = p_passenger_id
        LIMIT 1;

        -- Remove berth allocation for this cancelled passenger
        DELETE FROM berth_allocations WHERE passenger_id = p_passenger_id;

        -- Check for RAC passenger to promote to CNF
        FOR v_rac_pass IN
            SELECT rp.*, r.from_seq, r.to_seq, r.train_no, r.run_date, r.class_code
            FROM reservation_passengers rp
            JOIN reservations r ON rp.reservation_id = r.reservation_id
            WHERE r.train_no = v_res.train_no
              AND r.run_date = v_res.run_date
              AND r.class_code = v_res.class_code
              AND rp.current_status = 'RAC'
            ORDER BY rp.rac_number ASC, rp.passenger_id ASC
        LOOP
            v_promoted_stops := int4range(v_rac_pass.from_seq, v_rac_pass.to_seq, '[)');
            
            -- Try to give the freed berth to this RAC passenger
            BEGIN
                INSERT INTO berth_allocations (berth_id, run_date, stops, passenger_id)
                VALUES (v_berth.berth_id, v_res.run_date, v_promoted_stops, v_rac_pass.passenger_id);

                -- Fetch coach details for berth
                SELECT c.coach_code, b.berth_number, b.berth_type
                INTO v_coach_code, v_berth_number, v_berth_type
                FROM berths b
                JOIN coaches c ON b.coach_id = c.coach_id
                WHERE b.berth_id = v_berth.berth_id;

                -- Promote RAC passenger to CNF
                UPDATE reservation_passengers
                SET current_status = 'CNF',
                    coach_code = v_coach_code,
                    berth_number = v_berth_number,
                    berth_type = v_berth_type,
                    berth_id = v_berth.berth_id,
                    rac_number = NULL,
                    updated_at = now()
                WHERE passenger_id = v_rac_pass.passenger_id;

                -- Now promote highest priority WL to RAC
                SELECT rp2.* INTO v_wl_pass
                FROM reservation_passengers rp2
                JOIN reservations r2 ON rp2.reservation_id = r2.reservation_id
                WHERE r2.train_no = v_res.train_no
                  AND r2.run_date = v_res.run_date
                  AND r2.class_code = v_res.class_code
                  AND rp2.current_status = 'WL'
                ORDER BY rp2.wl_number ASC, rp2.passenger_id ASC
                LIMIT 1;

                IF FOUND THEN
                    UPDATE reservation_passengers
                    SET current_status = 'RAC',
                        rac_number = v_rac_pass.rac_number,
                        wl_number = NULL,
                        updated_at = now()
                    WHERE passenger_id = v_wl_pass.passenger_id;
                END IF;

                EXIT; -- Allocation and cascading promotion finished
            EXCEPTION WHEN exclusion_violation THEN
                -- If this berth overlaps with other bookings on this segment, try next
                NULL;
            END;
        END LOOP;
    ELSIF v_pass.current_status = 'RAC' THEN
        -- If an RAC passenger cancelled, promote earliest WL to RAC
        SELECT rp2.* INTO v_wl_pass
        FROM reservation_passengers rp2
        JOIN reservations r2 ON rp2.reservation_id = r2.reservation_id
        WHERE r2.train_no = v_res.train_no
          AND r2.run_date = v_res.run_date
          AND r2.class_code = v_res.class_code
          AND rp2.current_status = 'WL'
        ORDER BY rp2.wl_number ASC, rp2.passenger_id ASC
        LIMIT 1;

        IF FOUND THEN
            UPDATE reservation_passengers
            SET current_status = 'RAC',
                rac_number = v_pass.rac_number,
                wl_number = NULL,
                updated_at = now()
            WHERE passenger_id = v_wl_pass.passenger_id;
        END IF;
    END IF;

    -- 3. Mark current passenger as CANCELLED
    UPDATE reservation_passengers
    SET current_status = 'CANCELLED',
        coach_code = NULL,
        berth_number = NULL,
        berth_id = NULL,
        rac_number = NULL,
        wl_number = NULL,
        updated_at = now()
    WHERE passenger_id = p_passenger_id;

    -- 4. Insert cancellation audit record
    INSERT INTO cancellations (
        reservation_id, passenger_id, refund_amount, cancellation_charge, cancelled_at, reason
    ) VALUES (
        v_res.reservation_id, p_passenger_id, v_refund, v_cancellation_charge, now(), p_reason
    );

    -- 5. Update parent reservation status
    SELECT
        COUNT(*) FILTER (WHERE current_status <> 'CANCELLED'),
        COUNT(*) FILTER (WHERE current_status = 'CANCELLED')
    INTO v_active_count, v_cancelled_count
    FROM reservation_passengers
    WHERE reservation_id = v_res.reservation_id;

    IF v_active_count = 0 THEN
        UPDATE reservations
        SET status = 'CANCELLED', updated_at = now()
        WHERE reservation_id = v_res.reservation_id;
    ELSE
        UPDATE reservations
        SET status = 'PARTIALLY_CANCELLED', updated_at = now()
        WHERE reservation_id = v_res.reservation_id;
    END IF;

    RETURN v_refund;
END;
$$ LANGUAGE plpgsql;
