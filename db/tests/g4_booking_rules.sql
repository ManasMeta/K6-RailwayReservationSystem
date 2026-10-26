-- Author: G4 Member 1 (Frontend)
-- Test: booking_rules drives is_booking_open(); only an admin can change it (row-level security).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g4_booking_rules.sql

BEGIN;

INSERT INTO users (email, password_hash, full_name, phone)
VALUES ('g4-rules@yatrio.in', 'hashed_pwd_123', 'Rules Tester', '9876500000')
ON CONFLICT (email) DO NOTHING;

-- 1. The seeded row carries the plan's defaults
DO $$
BEGIN
    ASSERT (SELECT count(*) FROM booking_rules) = 1, 'booking_rules must hold exactly one row';
    ASSERT (SELECT advance_days FROM booking_rules) = 60, 'default advance window is 60 days';
    ASSERT (SELECT tatkal_ac_opens_at FROM booking_rules) = TIME '10:00', 'AC Tatkal opens at 10:00';
    ASSERT (SELECT tatkal_non_ac_opens_at FROM booking_rules) = TIME '11:00', 'non-AC Tatkal opens at 11:00';
    BEGIN
        INSERT INTO booking_rules (booking_rule_id) VALUES (2);
        RAISE EXCEPTION 'a second booking_rules row was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    RAISE NOTICE 'TEST 1 PASS: one row with the default window';
END $$;

-- 2. As the API role: a passenger can read but not change the rules; an admin can
SET LOCAL ROLE nrrms_app;
SELECT set_config('app.user_role', 'passenger', true);
DO $$
DECLARE
    v_rows INT;
BEGIN
    ASSERT (SELECT advance_days FROM booking_rules) = 60, 'passengers must be able to read the rules';
    UPDATE booking_rules SET advance_days = 5;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    ASSERT v_rows = 0, 'a passenger changed booking_rules';
    BEGIN
        DELETE FROM booking_rules;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        ASSERT v_rows = 0, 'the API role deleted booking_rules';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END $$;

SELECT set_config('app.user_role', 'admin', true);
DO $$
DECLARE
    v_rows INT;
BEGIN
    UPDATE booking_rules SET advance_days = 30;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    ASSERT v_rows = 1, 'an admin must be able to change booking_rules';
    RAISE NOTICE 'TEST 2 PASS: passengers read only, admins write';
END $$;
RESET ROLE;

-- 3. is_booking_open() uses the configured advance window (now 30 days)
DO $$
DECLARE
    v_user BIGINT := (SELECT user_id FROM users WHERE email = 'g4-rules@yatrio.in');
    v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::DATE;
BEGIN
    PERFORM set_config('app.skip_booking_window_check', 'false', true);
    BEGIN
        INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code)
        VALUES (v_user, '12301', v_today + 45, 'HWH', 'NDLS', 1, 4, '3A', 'GN');
        RAISE EXCEPTION 'a date beyond the configured 30-day window was accepted';
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
    END;
    INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code)
    VALUES (v_user, '12301', v_today + 20, 'HWH', 'NDLS', 1, 4, '3A', 'GN');
    RAISE NOTICE 'TEST 3 PASS: advance window follows booking_rules';
END $$;

-- 4. Tatkal opening time follows booking_rules (24:00 = never open today, 00:00 = already open)
DO $$
DECLARE
    v_user BIGINT := (SELECT user_id FROM users WHERE email = 'g4-rules@yatrio.in');
    v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::DATE;
BEGIN
    PERFORM set_config('app.skip_booking_window_check', 'false', true);

    UPDATE booking_rules SET tatkal_ac_opens_at = TIME '24:00', tatkal_non_ac_opens_at = TIME '00:00';
    BEGIN
        INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code)
        VALUES (v_user, '12301', v_today + 1, 'HWH', 'NDLS', 1, 4, '3A', 'TQ');
        RAISE EXCEPTION 'AC Tatkal was accepted before the configured opening time';
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
    END;
    -- SL is non-AC, which opened at 00:00
    INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code)
    VALUES (v_user, '12301', v_today + 1, 'HWH', 'NDLS', 1, 4, 'SL', 'TQ');

    UPDATE booking_rules SET tatkal_ac_opens_at = TIME '00:00';
    INSERT INTO reservations (user_id, train_no, run_date, from_station_code, to_station_code, from_seq, to_seq, class_code, quota_code)
    VALUES (v_user, '12301', v_today + 1, 'HWH', 'NDLS', 1, 4, '3A', 'TQ');

    ASSERT (SELECT updated_at FROM booking_rules) = now(), 'updated_at must move on change';
    RAISE NOTICE 'TEST 4 PASS: Tatkal opening times follow booking_rules';
END $$;

ROLLBACK;
