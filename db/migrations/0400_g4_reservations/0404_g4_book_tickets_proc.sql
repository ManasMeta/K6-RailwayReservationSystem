-- Author: G4 Member 3 (Database)
-- Description: book_tickets() procedure for allocating preferred berths, catching exclusion_violation, and falling back to RAC and WL

CREATE OR REPLACE PROCEDURE book_tickets(IN p_reservation_id BIGINT)
AS $$
DECLARE
    v_res RECORD;
    v_pass RECORD;
    v_berth RECORD;
    v_allocated BOOLEAN;
    v_stops INT4RANGE;
    v_next_rac INT;
    v_next_wl INT;
    v_max_rac INT := 20;
    v_fare_rec RECORD;
BEGIN
    -- Fetch reservation details
    SELECT * INTO v_res
    FROM reservations
    WHERE reservation_id = p_reservation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation % not found', p_reservation_id
            USING ERRCODE = 'P0002';
    END IF;

    v_stops := int4range(v_res.from_seq, v_res.to_seq, '[)');

    -- Calculate base fare per passenger if needed
    SELECT total INTO v_fare_rec
    FROM calculate_fare(v_res.train_no, v_res.class_code, v_res.quota_code, v_res.from_seq, v_res.to_seq)
    LIMIT 1;

    -- Process each passenger in the reservation
    FOR v_pass IN
        SELECT *
        FROM reservation_passengers
        WHERE reservation_id = p_reservation_id
        ORDER BY passenger_id
    LOOP
        v_allocated := false;

        -- 1. Try preferred berth type first if specified
        IF v_pass.berth_preference IS NOT NULL AND v_pass.berth_preference <> '' THEN
            FOR v_berth IN
                SELECT
                    b.berth_id,
                    c.coach_code,
                    b.berth_number,
                    b.berth_type
                FROM berths b
                JOIN coaches c ON b.coach_id = c.coach_id
                WHERE c.train_no = v_res.train_no
                  AND c.class_code = v_res.class_code
                  AND b.berth_type = v_pass.berth_preference
                  AND NOT EXISTS (
                      SELECT 1
                      FROM berth_allocations ba
                      WHERE ba.berth_id = b.berth_id
                        AND ba.run_date = v_res.run_date
                        AND ba.stops && v_stops
                  )
                ORDER BY c.coach_code, b.berth_number
            LOOP
                BEGIN
                    INSERT INTO berth_allocations (berth_id, run_date, stops, passenger_id)
                    VALUES (v_berth.berth_id, v_res.run_date, v_stops, v_pass.passenger_id);

                    UPDATE reservation_passengers
                    SET booking_status = 'CNF',
                        current_status = 'CNF',
                        coach_code = v_berth.coach_code,
                        berth_number = v_berth.berth_number,
                        berth_type = v_berth.berth_type,
                        berth_id = v_berth.berth_id,
                        fare = COALESCE(v_fare_rec.total, fare),
                        updated_at = now()
                    WHERE passenger_id = v_pass.passenger_id;

                    v_allocated := true;
                    EXIT; -- Berth allocated successfully
                EXCEPTION WHEN exclusion_violation THEN
                    -- Another transaction took this berth concurrently; continue to next berth
                    v_allocated := false;
                END;
            END LOOP;
        END IF;

        -- 2. If preference not matched or not requested, try ANY other available berth in the class
        IF NOT v_allocated THEN
            FOR v_berth IN
                SELECT
                    b.berth_id,
                    c.coach_code,
                    b.berth_number,
                    b.berth_type
                FROM berths b
                JOIN coaches c ON b.coach_id = c.coach_id
                WHERE c.train_no = v_res.train_no
                  AND c.class_code = v_res.class_code
                  AND NOT EXISTS (
                      SELECT 1
                      FROM berth_allocations ba
                      WHERE ba.berth_id = b.berth_id
                        AND ba.run_date = v_res.run_date
                        AND ba.stops && v_stops
                  )
                ORDER BY c.coach_code, b.berth_number
            LOOP
                BEGIN
                    INSERT INTO berth_allocations (berth_id, run_date, stops, passenger_id)
                    VALUES (v_berth.berth_id, v_res.run_date, v_stops, v_pass.passenger_id);

                    UPDATE reservation_passengers
                    SET booking_status = 'CNF',
                        current_status = 'CNF',
                        coach_code = v_berth.coach_code,
                        berth_number = v_berth.berth_number,
                        berth_type = v_berth.berth_type,
                        berth_id = v_berth.berth_id,
                        fare = COALESCE(v_fare_rec.total, fare),
                        updated_at = now()
                    WHERE passenger_id = v_pass.passenger_id;

                    v_allocated := true;
                    EXIT; -- Allocated
                EXCEPTION WHEN exclusion_violation THEN
                    v_allocated := false;
                END;
            END LOOP;
        END IF;

        -- 3. If no confirmed berth could be allocated, fallback to RAC
        IF NOT v_allocated THEN
            SELECT COALESCE(MAX(rp.rac_number), 0) + 1
            INTO v_next_rac
            FROM reservation_passengers rp
            JOIN reservations r ON rp.reservation_id = r.reservation_id
            WHERE r.train_no = v_res.train_no
              AND r.run_date = v_res.run_date
              AND r.class_code = v_res.class_code
              AND rp.current_status = 'RAC';

            IF v_next_rac <= v_max_rac THEN
                UPDATE reservation_passengers
                SET booking_status = 'RAC',
                    current_status = 'RAC',
                    rac_number = v_next_rac,
                    berth_type = 'RAC',
                    coach_code = NULL,
                    berth_number = NULL,
                    berth_id = NULL,
                    fare = COALESCE(v_fare_rec.total, fare),
                    updated_at = now()
                WHERE passenger_id = v_pass.passenger_id;
                v_allocated := true;
            END IF;
        END IF;

        -- 4. If RAC is also full, fallback to Waiting List (WL)
        IF NOT v_allocated THEN
            SELECT COALESCE(MAX(rp.wl_number), 0) + 1
            INTO v_next_wl
            FROM reservation_passengers rp
            JOIN reservations r ON rp.reservation_id = r.reservation_id
            WHERE r.train_no = v_res.train_no
              AND r.run_date = v_res.run_date
              AND r.class_code = v_res.class_code
              AND rp.current_status = 'WL';

            UPDATE reservation_passengers
            SET booking_status = 'WL',
                current_status = 'WL',
                wl_number = v_next_wl,
                berth_type = 'WL',
                coach_code = NULL,
                berth_number = NULL,
                berth_id = NULL,
                fare = COALESCE(v_fare_rec.total, fare),
                updated_at = now()
            WHERE passenger_id = v_pass.passenger_id;
        END IF;
    END LOOP;

    -- Update reservation total fare
    UPDATE reservations
    SET total_fare = (
        SELECT COALESCE(SUM(fare), 0.00)
        FROM reservation_passengers
        WHERE reservation_id = p_reservation_id
    ),
    updated_at = now()
    WHERE reservation_id = p_reservation_id;
END;
$$ LANGUAGE plpgsql;

-- Convenience function wrapper for book_tickets
CREATE OR REPLACE FUNCTION book_tickets_func(p_reservation_id BIGINT)
RETURNS JSONB AS $$
BEGIN
    CALL book_tickets(p_reservation_id);
    RETURN (
        SELECT jsonb_build_object(
            'reservation_id', r.reservation_id,
            'pnr', r.pnr,
            'status', r.status,
            'total_fare', r.total_fare,
            'passengers', (
                SELECT jsonb_agg(to_jsonb(p))
                FROM reservation_passengers p
                WHERE p.reservation_id = r.reservation_id
            )
        )
        FROM reservations r
        WHERE r.reservation_id = p_reservation_id
    );
END;
$$ LANGUAGE plpgsql;
