-- Author: G1 Member 3 (Database)
-- Description: row-level security on the G1 tables, plus the two SECURITY DEFINER functions
-- that sign-up and login need (they run before anyone is identified, so RLS would hide the rows).
--
-- Policy shape: USING (user_id = current_setting('app.user_id')::bigint), written through
-- app_user_id() so an unset or emptied setting matches nothing instead of raising an error.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_passengers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_read ON users;
DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_read ON users FOR SELECT
    USING (user_id = app_user_id() OR app_is_privileged());
CREATE POLICY users_self_update ON users FOR UPDATE
    USING (user_id = app_user_id())
    WITH CHECK (user_id = app_user_id());

DROP POLICY IF EXISTS user_roles_read ON user_roles;
CREATE POLICY user_roles_read ON user_roles FOR SELECT
    USING (user_id = app_user_id() OR app_is_privileged());

DROP POLICY IF EXISTS saved_passengers_owner ON saved_passengers;
CREATE POLICY saved_passengers_owner ON saved_passengers FOR ALL
    USING (user_id = app_user_id())
    WITH CHECK (user_id = app_user_id());

-- Login: find the account by email (the caller is not identified yet).
CREATE OR REPLACE FUNCTION auth_user_by_email(p_email TEXT)
RETURNS TABLE (user_id BIGINT, email TEXT, full_name TEXT, phone TEXT, password_hash TEXT, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT u.user_id, u.email::TEXT, u.full_name, u.phone::TEXT, u.password_hash,
           COALESCE((SELECT r.role_name FROM user_roles ur JOIN roles r USING (role_id)
                      WHERE ur.user_id = u.user_id ORDER BY r.role_id DESC LIMIT 1), 'passenger')
      FROM users u
     WHERE u.email = p_email::email_addr;
$$;

-- Sign-up always creates a passenger. Staff and admin roles are granted in user_roles by an admin.
CREATE OR REPLACE FUNCTION auth_register(p_email TEXT, p_password_hash TEXT, p_full_name TEXT, p_phone TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user BIGINT;
BEGIN
    INSERT INTO users (email, password_hash, full_name, phone)
    VALUES (p_email, p_password_hash, p_full_name, p_phone)
    RETURNING user_id INTO v_user;

    INSERT INTO user_roles (user_id, role_id)
    SELECT v_user, role_id FROM roles WHERE role_name = 'passenger';

    RETURN v_user;
END;
$$;

REVOKE ALL ON FUNCTION auth_user_by_email(TEXT), auth_register(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_user_by_email(TEXT), auth_register(TEXT, TEXT, TEXT, TEXT) TO nrrms_app;
