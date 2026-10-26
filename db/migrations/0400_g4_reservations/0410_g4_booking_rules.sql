-- Author: G4 Member 1 (Frontend)
-- Description: make the booking window configurable instead of hard-coded in is_booking_open().
--
-- booking_rules holds exactly one row: how many days ahead general booking opens, and the time
-- of day (IST, the day before travel) Tatkal opens for AC and non-AC classes. Admins change it
-- with UPDATE; the row-level security policy below lets everyone read it but only an admin
-- (or a background job) write it. is_booking_open() reads the row on every insert, so a change
-- applies to the next booking without a deploy.

CREATE TABLE IF NOT EXISTS booking_rules (
    booking_rule_id        SMALLINT PRIMARY KEY DEFAULT 1 CHECK (booking_rule_id = 1),
    advance_days           INT  NOT NULL DEFAULT 60 CHECK (advance_days BETWEEN 1 AND 365),
    tatkal_ac_opens_at     TIME NOT NULL DEFAULT TIME '10:00',
    tatkal_non_ac_opens_at TIME NOT NULL DEFAULT TIME '11:00',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO booking_rules (booking_rule_id) VALUES (1) ON CONFLICT (booking_rule_id) DO NOTHING;

ALTER TABLE booking_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_rules_read ON booking_rules;
CREATE POLICY booking_rules_read ON booking_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS booking_rules_admin_write ON booking_rules;
CREATE POLICY booking_rules_admin_write ON booking_rules FOR UPDATE
    USING (COALESCE(app_user_role() IN ('admin', 'system'), false))
    WITH CHECK (COALESCE(app_user_role() IN ('admin', 'system'), false));
-- No INSERT or DELETE policy: with row-level security on, the API role can never add or
-- remove the single row, whatever table grants it has.

CREATE OR REPLACE FUNCTION booking_rules_touch()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_rules_touch ON booking_rules;
CREATE TRIGGER trg_booking_rules_touch
    BEFORE UPDATE ON booking_rules
    FOR EACH ROW EXECUTE FUNCTION booking_rules_touch();

DROP TRIGGER IF EXISTS trg_booking_rules_audit ON booking_rules;
CREATE TRIGGER trg_booking_rules_audit
    AFTER UPDATE ON booking_rules
    FOR EACH ROW EXECUTE FUNCTION fn_audit('booking_rule_id');

-- ---------------------------------------------------------------------------
-- is_booking_open(): same rules as 0408, with the numbers read from booking_rules
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_booking_open()
RETURNS TRIGGER AS $$
DECLARE
    v_is_ac BOOLEAN := false;
    v_advance_days INT := 60;
    v_ac_opens TIME := TIME '10:00';
    v_non_ac_opens TIME := TIME '11:00';
    v_opens TIME;
    v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_now_time TIME := (now() AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_skip_check TEXT;
BEGIN
    -- Allow skipping the booking window check in tests or admin seed flows
    v_skip_check := current_setting('app.skip_booking_window_check', true);
    IF v_skip_check = 'true' THEN
        RETURN NEW;
    END IF;

    SELECT advance_days, tatkal_ac_opens_at, tatkal_non_ac_opens_at
      INTO v_advance_days, v_ac_opens, v_non_ac_opens
      FROM booking_rules
     WHERE booking_rule_id = 1;
    -- a missing row keeps the defaults above
    v_advance_days := COALESCE(v_advance_days, 60);
    v_ac_opens := COALESCE(v_ac_opens, TIME '10:00');
    v_non_ac_opens := COALESCE(v_non_ac_opens, TIME '11:00');

    IF NEW.run_date < v_today THEN
        RAISE EXCEPTION 'Booking is closed: travel date % is in the past', NEW.run_date
            USING ERRCODE = '22023';
    END IF;

    IF NEW.run_date > (v_today + v_advance_days) THEN
        RAISE EXCEPTION 'Booking is not yet open: travel date % exceeds the %-day advance reservation period',
            NEW.run_date, v_advance_days
            USING ERRCODE = '22023';
    END IF;

    -- Tatkal opens the day before travel, at the configured time for AC or non-AC classes
    IF NEW.quota_code = 'TQ' THEN
        SELECT COALESCE(has_ac, false) INTO v_is_ac
          FROM travel_classes
         WHERE class_code = NEW.class_code;
        v_opens := CASE WHEN v_is_ac THEN v_ac_opens ELSE v_non_ac_opens END;

        IF v_today < (NEW.run_date - 1) THEN
            RAISE EXCEPTION 'Tatkal booking opens only 1 day prior to travel date. Booking opens on %',
                (NEW.run_date - 1)
                USING ERRCODE = '22023';
        END IF;

        IF v_today = (NEW.run_date - 1) AND v_now_time < v_opens THEN
            RAISE EXCEPTION 'Tatkal booking for % class % opens at % on the day prior to travel',
                CASE WHEN v_is_ac THEN 'AC' ELSE 'non-AC' END, NEW.class_code, to_char(v_opens, 'HH24:MI')
                USING ERRCODE = '22023';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
