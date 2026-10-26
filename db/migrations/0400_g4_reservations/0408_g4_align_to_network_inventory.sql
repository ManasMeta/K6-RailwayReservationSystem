-- Author: G4 Member 3 (Database)
-- Description: align G4 with the real G2/G3 tables and publish the columns G5/G6 read.
--
-- 0403-0407 were written against placeholder network/inventory tables (train_stops.train_no,
-- coaches.train_no, travel_classes.is_ac, calculate_fare(train_no, ...)). The real tables key
-- on train_id / station_id and calculate_fare takes (train_id, from_seq, to_seq, class, quota,
-- concession). This file redefines the affected functions; the earlier files stay untouched.

-- ---------------------------------------------------------------------------
-- Columns other groups rely on
-- ---------------------------------------------------------------------------
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS departure_at TIMESTAMPTZ;
ALTER TABLE cancellations ADD COLUMN IF NOT EXISTS full_refund BOOLEAN NOT NULL DEFAULT false;

-- Departure of the boarding stop, in Indian Standard Time. day_offset is whole days after the
-- day the train leaves its origin; run_date is the origin date.
CREATE OR REPLACE FUNCTION reservation_departure(
    p_train_no TEXT,
    p_run_date DATE,
    p_from_seq INT
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
    SELECT ((p_run_date + ts.day_offset::INT) + COALESCE(ts.departure, ts.arrival, TIME '00:00'))
               AT TIME ZONE 'Asia/Kolkata'
      FROM trains t
      JOIN train_stops ts ON ts.train_id = t.train_id
     WHERE t.train_no = p_train_no AND ts.seq = p_from_seq;
$$;

CREATE OR REPLACE FUNCTION fn_reservation_set_departure()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.departure_at IS NULL THEN
        NEW.departure_at := COALESCE(
            reservation_departure(NEW.train_no, NEW.run_date, NEW.from_seq),
            (NEW.run_date::TIMESTAMP) AT TIME ZONE 'Asia/Kolkata'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_set_departure ON reservations;
CREATE TRIGGER trg_reservation_set_departure
    BEFORE INSERT ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION fn_reservation_set_departure();

UPDATE reservations
   SET departure_at = COALESCE(
           reservation_departure(train_no, run_date, from_seq),
           (run_date::TIMESTAMP) AT TIME ZONE 'Asia/Kolkata')
 WHERE departure_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_run ON reservations (train_no, run_date, class_code);

-- ---------------------------------------------------------------------------
-- is_booking_open(): travel_classes.has_ac, and times in Indian Standard Time
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_booking_open()
RETURNS TRIGGER AS $$
DECLARE
    v_is_ac BOOLEAN := false;
    v_advance_days INT := 60;
    v_now TIMESTAMP := (now() AT TIME ZONE 'Asia/Kolkata');
    v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_now_time TIME := (now() AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_skip_check TEXT;
BEGIN
    -- Allow skipping the booking window check in tests or admin seed flows
    v_skip_check := current_setting('app.skip_booking_window_check', true);
    IF v_skip_check = 'true' THEN
        RETURN NEW;
    END IF;

    IF NEW.run_date < v_today THEN
        RAISE EXCEPTION 'Booking is closed: travel date % is in the past', NEW.run_date
            USING ERRCODE = '22023';
    END IF;

    IF NEW.run_date > (v_today + v_advance_days) THEN
        RAISE EXCEPTION 'Booking is not yet open: travel date % exceeds the %-day advance reservation period',
            NEW.run_date, v_advance_days
            USING ERRCODE = '22023';
    END IF;

    -- Tatkal opens the day before travel: 10:00 for AC classes, 11:00 for non-AC
    IF NEW.quota_code = 'TQ' THEN
        SELECT COALESCE(has_ac, false) INTO v_is_ac
          FROM travel_classes
         WHERE class_code = NEW.class_code;

        IF v_today < (NEW.run_date - 1) THEN
            RAISE EXCEPTION 'Tatkal booking opens only 1 day prior to travel date. Booking opens on %',
                (NEW.run_date - 1)
                USING ERRCODE = '22023';
        END IF;

        IF v_today = (NEW.run_date - 1) THEN
            IF v_is_ac AND v_now_time < TIME '10:00:00' THEN
                RAISE EXCEPTION 'Tatkal booking for AC class % opens at 10:00 AM on the day prior to travel',
                    NEW.class_code
                    USING ERRCODE = '22023';
            ELSIF (NOT v_is_ac) AND v_now_time < TIME '11:00:00' THEN
                RAISE EXCEPTION 'Tatkal booking for non-AC class % opens at 11:00 AM on the day prior to travel',
                    NEW.class_code
                    USING ERRCODE = '22023';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- book_tickets(): berths from G3 by train_id, fares from calculate_fare() per passenger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE book_tickets(IN p_reservation_id BIGINT)
AS $$
DECLARE
    v_res RECORD;
    v_pass RECORD;
    v_berth RECORD;
    v_train_id BIGINT;
    v_allocated BOOLEAN;
    v_stops INT4RANGE;
    v_next_rac INT;
    v_next_wl INT;
    v_max_rac INT := 20;
    v_concession TEXT;
    v_fare NUMERIC(10,2);
BEGIN
    SELECT * INTO v_res FROM reservations WHERE reservation_id = p_reservation_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation % not found', p_reservation_id USING ERRCODE = 'P0002';
    END IF;

    SELECT train_id INTO v_train_id FROM trains WHERE train_no = v_res.train_no;
    IF v_train_id IS NULL THEN
        RAISE EXCEPTION 'Train % not found', v_res.train_no USING ERRCODE = 'P0002';
    END IF;

    v_stops := int4range(v_res.from_seq, v_res.to_seq, '[)');

    FOR v_pass IN
        SELECT * FROM reservation_passengers
         WHERE reservation_id = p_reservation_id
         ORDER BY passenger_id
    LOOP
        v_allocated := false;

        v_concession := CASE
            WHEN v_pass.age < 5 THEN 'CHILD'
            WHEN v_pass.gender ILIKE 'f%' AND v_pass.age >= 58 THEN 'SENIOR_FEMALE'
            WHEN v_pass.gender ILIKE 'm%' AND v_pass.age >= 60 THEN 'SENIOR_MALE'
            ELSE 'GENERAL'
        END;

        SELECT f.total INTO v_fare
          FROM calculate_fare(v_train_id, v_res.from_seq, v_res.to_seq,
                              v_res.class_code, v_res.quota_code, v_concession) f
         LIMIT 1;

        -- Confirmed berth: preferred type first, then any free berth in the class.
        -- A concurrent sale of the same berth raises exclusion_violation; try the next one.
        FOR v_berth IN
            SELECT b.berth_id, c.coach_code, b.berth_number, b.berth_type
              FROM berths b
              JOIN coaches c ON c.coach_id = b.coach_id
             WHERE c.train_id = v_train_id
               AND c.class_code = v_res.class_code
               AND NOT EXISTS (
                   SELECT 1 FROM berth_allocations ba
                    WHERE ba.berth_id = b.berth_id
                      AND ba.run_date = v_res.run_date
                      AND ba.stops && v_stops)
             ORDER BY (b.berth_type IS NOT DISTINCT FROM v_pass.berth_preference) DESC,
                      c.coach_code, b.berth_number
        LOOP
            BEGIN
                INSERT INTO berth_allocations (berth_id, run_date, stops, passenger_id)
                VALUES (v_berth.berth_id, v_res.run_date, v_stops, v_pass.passenger_id);

                UPDATE reservation_passengers
                   SET booking_status = 'CNF', current_status = 'CNF',
                       coach_code = v_berth.coach_code,
                       berth_number = v_berth.berth_number,
                       berth_type = v_berth.berth_type,
                       berth_id = v_berth.berth_id,
                       fare = COALESCE(v_fare, fare),
                       updated_at = now()
                 WHERE passenger_id = v_pass.passenger_id;

                v_allocated := true;
                EXIT;
            EXCEPTION WHEN exclusion_violation THEN
                v_allocated := false;
            END;
        END LOOP;

        -- RAC next
        IF NOT v_allocated THEN
            SELECT COALESCE(MAX(rp.rac_number), 0) + 1 INTO v_next_rac
              FROM reservation_passengers rp
              JOIN reservations r ON r.reservation_id = rp.reservation_id
             WHERE r.train_no = v_res.train_no AND r.run_date = v_res.run_date
               AND r.class_code = v_res.class_code AND rp.current_status = 'RAC';

            IF v_next_rac <= v_max_rac THEN
                UPDATE reservation_passengers
                   SET booking_status = 'RAC', current_status = 'RAC',
                       rac_number = v_next_rac, berth_type = 'RAC',
                       coach_code = NULL, berth_number = NULL, berth_id = NULL,
                       fare = COALESCE(v_fare, fare), updated_at = now()
                 WHERE passenger_id = v_pass.passenger_id;
                v_allocated := true;
            END IF;
        END IF;

        -- Waiting list last
        IF NOT v_allocated THEN
            SELECT COALESCE(MAX(rp.wl_number), 0) + 1 INTO v_next_wl
              FROM reservation_passengers rp
              JOIN reservations r ON r.reservation_id = rp.reservation_id
             WHERE r.train_no = v_res.train_no AND r.run_date = v_res.run_date
               AND r.class_code = v_res.class_code AND rp.current_status = 'WL';

            UPDATE reservation_passengers
               SET booking_status = 'WL', current_status = 'WL',
                   wl_number = v_next_wl, berth_type = 'WL',
                   coach_code = NULL, berth_number = NULL, berth_id = NULL,
                   fare = COALESCE(v_fare, fare), updated_at = now()
             WHERE passenger_id = v_pass.passenger_id;
        END IF;
    END LOOP;

    UPDATE reservations
       SET total_fare = (SELECT COALESCE(SUM(fare), 0.00)
                           FROM reservation_passengers
                          WHERE reservation_id = p_reservation_id),
           updated_at = now()
     WHERE reservation_id = p_reservation_id;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- cancel_passenger(): departure from reservations.departure_at, full_refund flag (used by G6
-- when the railway cancels a run). G5's trigger on cancellations settles the final refund and
-- writes it back to refund_amount / cancellation_charge, which is what this function returns.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS cancel_passenger(BIGINT, TEXT);

CREATE OR REPLACE FUNCTION cancel_passenger(
    p_passenger_id BIGINT,
    p_reason TEXT DEFAULT 'Passenger cancelled',
    p_full_refund BOOLEAN DEFAULT false
)
RETURNS NUMERIC(10,2) AS $$
DECLARE
    v_pass RECORD;
    v_res RECORD;
    v_berth RECORD;
    v_rac_pass RECORD;
    v_wl_pass RECORD;
    v_refund NUMERIC(10,2) := 0.00;
    v_charge NUMERIC(10,2) := 0.00;
    v_active_count INT;
    v_hours_to_dep NUMERIC;
    v_promoted_stops INT4RANGE;
    v_coach_code VARCHAR(10);
    v_berth_number INT;
    v_berth_type VARCHAR(10);
    v_cancellation_id BIGINT;
BEGIN
    SELECT * INTO v_pass FROM reservation_passengers WHERE passenger_id = p_passenger_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Passenger % not found', p_passenger_id USING ERRCODE = 'P0002';
    END IF;
    IF v_pass.current_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Passenger % is already cancelled', p_passenger_id USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_res FROM reservations WHERE reservation_id = v_pass.reservation_id FOR UPDATE;

    -- Provisional amounts; G5's trigger replaces them once a payment is found.
    v_hours_to_dep := EXTRACT(EPOCH FROM (v_res.departure_at - now())) / 3600.0;
    IF v_res.status = 'PENDING_PAYMENT' THEN
        v_charge := 0.00;
        v_refund := 0.00;
    ELSIF p_full_refund THEN
        v_charge := 0.00;
        v_refund := v_pass.fare;
    ELSIF v_hours_to_dep > 48 THEN
        v_charge := LEAST(v_pass.fare, CASE
            WHEN v_res.class_code IN ('1A', 'EC') THEN 240.00
            WHEN v_res.class_code = '2A' THEN 200.00
            WHEN v_res.class_code IN ('3A', '3E', 'CC') THEN 180.00
            ELSE 60.00 END);
        v_refund := v_pass.fare - v_charge;
    ELSIF v_hours_to_dep >= 12 THEN
        v_charge := ROUND(v_pass.fare * 0.25, 2);
        v_refund := v_pass.fare - v_charge;
    ELSIF v_hours_to_dep >= 4 THEN
        v_charge := ROUND(v_pass.fare * 0.50, 2);
        v_refund := v_pass.fare - v_charge;
    ELSE
        v_charge := v_pass.fare;
        v_refund := 0.00;
    END IF;

    -- Free a confirmed berth and promote RAC -> CNF, then WL -> RAC
    IF v_pass.current_status = 'CNF' AND v_pass.berth_id IS NOT NULL THEN
        SELECT stops, berth_id INTO v_berth FROM berth_allocations
         WHERE passenger_id = p_passenger_id LIMIT 1;

        DELETE FROM berth_allocations WHERE passenger_id = p_passenger_id;

        FOR v_rac_pass IN
            SELECT rp.*, r.from_seq, r.to_seq
              FROM reservation_passengers rp
              JOIN reservations r ON rp.reservation_id = r.reservation_id
             WHERE r.train_no = v_res.train_no
               AND r.run_date = v_res.run_date
               AND r.class_code = v_res.class_code
               AND rp.current_status = 'RAC'
             ORDER BY rp.rac_number ASC, rp.passenger_id ASC
        LOOP
            v_promoted_stops := int4range(v_rac_pass.from_seq, v_rac_pass.to_seq, '[)');
            BEGIN
                INSERT INTO berth_allocations (berth_id, run_date, stops, passenger_id)
                VALUES (v_berth.berth_id, v_res.run_date, v_promoted_stops, v_rac_pass.passenger_id);

                SELECT c.coach_code, b.berth_number, b.berth_type
                  INTO v_coach_code, v_berth_number, v_berth_type
                  FROM berths b JOIN coaches c ON b.coach_id = c.coach_id
                 WHERE b.berth_id = v_berth.berth_id;

                UPDATE reservation_passengers
                   SET current_status = 'CNF', booking_status = 'CNF',
                       coach_code = v_coach_code, berth_number = v_berth_number,
                       berth_type = v_berth_type, berth_id = v_berth.berth_id,
                       rac_number = NULL, updated_at = now()
                 WHERE passenger_id = v_rac_pass.passenger_id;

                SELECT rp2.* INTO v_wl_pass
                  FROM reservation_passengers rp2
                  JOIN reservations r2 ON rp2.reservation_id = r2.reservation_id
                 WHERE r2.train_no = v_res.train_no AND r2.run_date = v_res.run_date
                   AND r2.class_code = v_res.class_code AND rp2.current_status = 'WL'
                 ORDER BY rp2.wl_number ASC, rp2.passenger_id ASC
                 LIMIT 1;

                IF FOUND THEN
                    UPDATE reservation_passengers
                       SET current_status = 'RAC', booking_status = 'RAC',
                           rac_number = v_rac_pass.rac_number, wl_number = NULL,
                           berth_type = 'RAC', updated_at = now()
                     WHERE passenger_id = v_wl_pass.passenger_id;
                END IF;

                EXIT;
            EXCEPTION WHEN exclusion_violation THEN
                NULL;
            END;
        END LOOP;
    ELSIF v_pass.current_status = 'RAC' THEN
        SELECT rp2.* INTO v_wl_pass
          FROM reservation_passengers rp2
          JOIN reservations r2 ON rp2.reservation_id = r2.reservation_id
         WHERE r2.train_no = v_res.train_no AND r2.run_date = v_res.run_date
           AND r2.class_code = v_res.class_code AND rp2.current_status = 'WL'
         ORDER BY rp2.wl_number ASC, rp2.passenger_id ASC
         LIMIT 1;

        IF FOUND THEN
            UPDATE reservation_passengers
               SET current_status = 'RAC', booking_status = 'RAC',
                   rac_number = v_pass.rac_number, wl_number = NULL,
                   berth_type = 'RAC', updated_at = now()
             WHERE passenger_id = v_wl_pass.passenger_id;
        END IF;
    END IF;

    UPDATE reservation_passengers
       SET current_status = 'CANCELLED', booking_status = 'CANCELLED',
           coach_code = NULL, berth_number = NULL, berth_id = NULL,
           rac_number = NULL, wl_number = NULL, updated_at = now()
     WHERE passenger_id = p_passenger_id;

    INSERT INTO cancellations (
        reservation_id, passenger_id, refund_amount, cancellation_charge,
        cancelled_at, reason, full_refund
    ) VALUES (
        v_res.reservation_id, p_passenger_id, v_refund, v_charge, now(), p_reason, p_full_refund
    )
    RETURNING cancellation_id INTO v_cancellation_id;

    -- Re-read: a wallet-refund trigger may have settled the real amount
    SELECT refund_amount INTO v_refund FROM cancellations WHERE cancellation_id = v_cancellation_id;

    SELECT COUNT(*) FILTER (WHERE current_status <> 'CANCELLED') INTO v_active_count
      FROM reservation_passengers WHERE reservation_id = v_res.reservation_id;

    UPDATE reservations
       SET status = CASE WHEN v_active_count = 0 THEN 'CANCELLED' ELSE 'PARTIALLY_CANCELLED' END,
           updated_at = now()
     WHERE reservation_id = v_res.reservation_id;

    RETURN v_refund;
END;
$$ LANGUAGE plpgsql;
