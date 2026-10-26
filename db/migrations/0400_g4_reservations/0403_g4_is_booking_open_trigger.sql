-- Author: G4 Member 1 (Frontend & Triggers)
-- Description: is_booking_open() BEFORE INSERT trigger enforcing 60-day advance window and Tatkal opening hours

CREATE OR REPLACE FUNCTION is_booking_open()
RETURNS TRIGGER AS $$
DECLARE
    v_is_ac BOOLEAN := false;
    v_advance_days INT := 60;
    v_now_time TIME := LOCALTIME;
    v_today DATE := CURRENT_DATE;
    v_skip_check TEXT;
BEGIN
    -- Allow skipping booking window check in tests or admin seed flows
    v_skip_check := current_setting('app.skip_booking_window_check', true);
    IF v_skip_check = 'true' THEN
        RETURN NEW;
    END IF;

    -- 1. Date cannot be in the past
    IF NEW.run_date < v_today THEN
        RAISE EXCEPTION 'Booking is closed: travel date % is in the past', NEW.run_date
            USING ERRCODE = '22023';
    END IF;

    -- 2. General 60-day advance booking window
    IF NEW.run_date > (v_today + (v_advance_days || ' days')::INTERVAL) THEN
        RAISE EXCEPTION 'Booking is not yet open: travel date % exceeds the %-day advance reservation period',
            NEW.run_date, v_advance_days
            USING ERRCODE = '22023';
    END IF;

    -- 3. Tatkal Quota Restrictions (TQ and PT)
    IF NEW.quota_code IN ('TQ', 'PT') THEN
        -- Check if travel class is AC
        SELECT is_ac INTO v_is_ac
        FROM travel_classes
        WHERE class_code = NEW.class_code;

        -- Tatkal opens 1 day before the journey date
        IF v_today < (NEW.run_date - INTERVAL '1 day') THEN
            RAISE EXCEPTION 'Tatkal booking opens only 1 day prior to travel date. Booking opens on %',
                (NEW.run_date - INTERVAL '1 day')::DATE
                USING ERRCODE = '22023';
        END IF;

        -- Check opening time on the opening day
        IF v_today = (NEW.run_date - INTERVAL '1 day')::DATE THEN
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

DROP TRIGGER IF EXISTS trg_check_booking_open ON reservations;

CREATE TRIGGER trg_check_booking_open
    BEFORE INSERT ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION is_booking_open();
