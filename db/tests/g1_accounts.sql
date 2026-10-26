-- G1 tests: domains, sign-up/login functions, row-level security as the application role,
-- the reporting role's limits and the fn_audit() change diff.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g1_accounts.sql
-- Needs the migrated database and the CI sample timetable. Everything is rolled back.
BEGIN;
SET LOCAL app.skip_booking_window_check = 'true';

CREATE TEMP TABLE fx (k TEXT PRIMARY KEY, v BIGINT) ON COMMIT DROP;
GRANT ALL ON fx TO PUBLIC;

-- 1. Domains reject bad values
DO $$
BEGIN
    BEGIN
        PERFORM '12345'::mobile_no;
        RAISE EXCEPTION 'a 5-digit mobile number was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        PERFORM '012345'::pincode;
        RAISE EXCEPTION 'a pincode starting with 0 was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        PERFORM 'not-an-email'::email_addr;
        RAISE EXCEPTION 'a malformed email was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    ASSERT 'Asha@Example.com'::email_addr = 'asha@example.com'::email_addr, 'email_addr must compare case-insensitively';
END $$;

-- 2. auth_register / auth_user_by_email
DO $$
DECLARE
    v_a BIGINT; v_b BIGINT; r RECORD;
BEGIN
    v_a := auth_register('g1-a@example.com', 'hash-a', 'Asha Rao', '9876543210');
    v_b := auth_register('g1-b@example.com', 'hash-b', 'Bala Iyer', NULL);
    INSERT INTO fx VALUES ('a', v_a), ('b', v_b);

    SELECT * INTO r FROM auth_user_by_email('G1-A@example.com');   -- case-insensitive
    ASSERT r.user_id = v_a AND r.role = 'passenger' AND r.password_hash = 'hash-a', 'login lookup wrong';
    ASSERT NOT EXISTS (SELECT 1 FROM auth_user_by_email('nobody@example.com')), 'unknown email returned a row';

    BEGIN
        PERFORM auth_register('g1-a@example.com', 'x', 'Dup', NULL);
        RAISE EXCEPTION 'duplicate email was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        PERFORM auth_register('g1-c@example.com', 'x', 'Bad Phone', '123');
        RAISE EXCEPTION 'a bad phone number was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- sign-up never grants staff or admin
    ASSERT (SELECT array_agg(role_name::TEXT) FROM user_roles JOIN roles USING (role_id) WHERE user_id = v_a) = ARRAY['passenger'],
        'new accounts must be passengers only';
END $$;

-- Data owned by the two users, created as the table owner
DO $$
DECLARE
    v_a BIGINT := (SELECT v FROM fx WHERE k = 'a');
    v_b BIGINT := (SELECT v FROM fx WHERE k = 'b');
BEGIN
    INSERT INTO saved_passengers (user_id, full_name, age, gender) VALUES
        (v_a, 'A Companion', 30, 'Female'), (v_b, 'B Companion', 40, 'Male');
    INSERT INTO reservations (pnr, user_id, train_no, run_date, from_station_code, to_station_code,
                              from_seq, to_seq, class_code, quota_code)
    VALUES ('7000000001', v_a, '12301', current_date + 5, 'HWH', 'NDLS', 1, 4, '3A', 'GN'),
           ('7000000002', v_b, '12301', current_date + 5, 'HWH', 'NDLS', 1, 4, '3A', 'GN');
    INSERT INTO wallets (user_id, balance) VALUES (v_a, 0), (v_b, 0);
END $$;

GRANT SELECT ON fx TO nrrms_app, nrrms_report;

-- 3. Row-level security as the application role
SET LOCAL ROLE nrrms_app;

-- nobody identified: nothing is visible
DO $$
BEGIN
    ASSERT (SELECT count(*) FROM users) = 0, 'anonymous caller can read users';
    ASSERT (SELECT count(*) FROM saved_passengers) = 0, 'anonymous caller can read saved passengers';
    ASSERT (SELECT count(*) FROM reservations) = 0, 'anonymous caller can read reservations';
    ASSERT (SELECT count(*) FROM wallets) = 0, 'anonymous caller can read wallets';
END $$;

-- identified as user A: only A's rows
SELECT set_config('app.user_id', (SELECT v FROM fx WHERE k = 'a')::TEXT, true);
SELECT set_config('app.user_role', 'passenger', true);
DO $$
DECLARE
    v_a BIGINT := (SELECT v FROM fx WHERE k = 'a');
    v_b BIGINT := (SELECT v FROM fx WHERE k = 'b');
BEGIN
    ASSERT (SELECT array_agg(user_id) FROM users) = ARRAY[v_a], 'user A must see only their own account';
    ASSERT (SELECT array_agg(full_name) FROM saved_passengers) = ARRAY['A Companion'], 'user A saw someone else''s passengers';
    ASSERT (SELECT array_agg(pnr::TEXT) FROM reservations) = ARRAY['7000000001'], 'user A saw someone else''s reservation';
    ASSERT (SELECT array_agg(user_id) FROM wallets) = ARRAY[v_a], 'user A saw someone else''s wallet';

    -- cannot write into B's data
    BEGIN
        INSERT INTO saved_passengers (user_id, full_name, age, gender) VALUES (v_b, 'Planted', 20, 'Male');
        RAISE EXCEPTION 'user A inserted a passenger for user B';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    UPDATE users SET full_name = 'Hacked' WHERE user_id = v_b;
    GET DIAGNOSTICS v_a = ROW_COUNT;
    ASSERT v_a = 0, 'user A updated user B''s account';
    DELETE FROM saved_passengers WHERE user_id = v_b;
    GET DIAGNOSTICS v_a = ROW_COUNT;
    ASSERT v_a = 0, 'user A deleted user B''s passenger';

    -- A can change their own profile
    UPDATE users SET full_name = 'Asha R. Rao' WHERE user_id = (SELECT v FROM fx WHERE k = 'a');
    GET DIAGNOSTICS v_a = ROW_COUNT;
    ASSERT v_a = 1, 'user A could not update their own profile';

    -- the audit log is closed to the application role
    BEGIN
        PERFORM count(*) FROM audit_log;
        RAISE EXCEPTION 'application role can read audit_log';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END $$;

-- staff see every reservation and user
SELECT set_config('app.user_role', 'staff', true);
DO $$
BEGIN
    ASSERT (SELECT count(*) FROM reservations WHERE pnr IN ('7000000001', '7000000002')) = 2, 'staff must see all reservations';
    ASSERT (SELECT count(*) FROM users WHERE email::TEXT LIKE 'g1-%') = 2, 'staff must see all users';
END $$;

-- 4. The reporting role: read-only, sees all rows, never password hashes
RESET ROLE;
SET LOCAL ROLE nrrms_report;
SELECT set_config('app.user_id', '', true);
SELECT set_config('app.user_role', '', true);
DO $$
BEGIN
    ASSERT (SELECT count(*) FROM reservations WHERE pnr IN ('7000000001', '7000000002')) = 2, 'reports must see all reservations';
    ASSERT (SELECT count(*) FROM users WHERE email::TEXT LIKE 'g1-%') = 2, 'reports must see all users';
    BEGIN
        PERFORM password_hash FROM users;
        RAISE EXCEPTION 'reporting role can read password hashes';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE reservations SET status = 'CANCELLED';
        RAISE EXCEPTION 'reporting role can write';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END $$;
RESET ROLE;

-- 5. fn_audit(): only changed columns, the acting user, no password hashes
DO $$
DECLARE
    v_a BIGINT := (SELECT v FROM fx WHERE k = 'a');
    r RECORD;
    v_before INT;
BEGIN
    PERFORM set_config('app.user_id', v_a::TEXT, true);

    -- the earlier profile update by user A produced one UPDATE row containing only full_name
    SELECT * INTO r FROM audit_log WHERE table_name = 'users' AND record_id = v_a AND action = 'UPDATE'
     ORDER BY audit_id DESC LIMIT 1;
    ASSERT r.audit_id IS NOT NULL, 'profile update was not audited';
    ASSERT r.new_values = '{"full_name": "Asha R. Rao"}'::JSONB, format('expected only full_name in new_values, got %s', r.new_values);
    ASSERT r.old_values = '{"full_name": "Asha Rao"}'::JSONB, format('expected only full_name in old_values, got %s', r.old_values);
    ASSERT r.changed_by = v_a, 'audit row must record the acting user';

    -- an UPDATE that changes nothing writes nothing
    SELECT count(*) INTO v_before FROM audit_log WHERE table_name = 'users';
    UPDATE users SET full_name = full_name WHERE user_id = v_a;
    ASSERT (SELECT count(*) FROM audit_log WHERE table_name = 'users') = v_before, 'a no-op update was audited';

    -- the hash is never stored
    UPDATE users SET password_hash = 'new-secret-hash' WHERE user_id = v_a;
    SELECT * INTO r FROM audit_log WHERE table_name = 'users' AND record_id = v_a ORDER BY audit_id DESC LIMIT 1;
    ASSERT r.new_values::TEXT NOT LIKE '%new-secret-hash%' AND r.old_values::TEXT NOT LIKE '%hash-a%',
        'password hashes leaked into audit_log';
    ASSERT NOT EXISTS (SELECT 1 FROM audit_log WHERE new_values::TEXT LIKE '%hash-a%' OR new_values::TEXT LIKE '%hash-b%'),
        'insert audit rows must not contain the hash';

    -- reservations and wallets are audited by their own groups
    UPDATE reservations SET status = 'CANCELLED' WHERE pnr = '7000000001';
    ASSERT (SELECT new_values FROM audit_log WHERE table_name = 'reservations' AND action = 'UPDATE'
             ORDER BY audit_id DESC LIMIT 1) ->> 'status' = 'CANCELLED', 'reservation change not audited';
    ASSERT EXISTS (SELECT 1 FROM audit_log WHERE table_name = 'wallets' AND action = 'INSERT'), 'wallet insert not audited';
END $$;

ROLLBACK;
