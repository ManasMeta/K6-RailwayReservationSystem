-- Author: G1 Member 2 (Backend)
-- Description: application database roles and the session helpers every RLS policy reads.
--
-- The backend sets two settings from the verified JWT for each request:
--   app.user_id    the signed-in user
--   app.user_role  passenger | staff | admin | system (background jobs)
-- nrrms_app    is the role the API connects as: it is subject to row-level security.
-- nrrms_report is read-only, for reporting. Both are NOLOGIN group roles; create a login
-- role per environment and GRANT it one of them (see the README).

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nrrms_app') THEN
        CREATE ROLE nrrms_app NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nrrms_report') THEN
        CREATE ROLE nrrms_report NOLOGIN;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION app_user_id() RETURNS BIGINT
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')::BIGINT
$$;

CREATE OR REPLACE FUNCTION app_user_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.user_role', true), '')
$$;

-- Staff, admins, background jobs and the reporting role may see every row.
CREATE OR REPLACE FUNCTION app_is_privileged() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(app_user_role() IN ('staff', 'admin', 'system'), false)
        OR pg_has_role(current_user, 'nrrms_report', 'member')
$$;

GRANT USAGE ON SCHEMA public TO nrrms_app, nrrms_report;
GRANT EXECUTE ON FUNCTION app_user_id(), app_user_role(), app_is_privileged() TO nrrms_app, nrrms_report;

-- Tables and sequences created by later migrations are usable by the API role and readable
-- by the reporting role, so no group has to repeat the GRANTs.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nrrms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nrrms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO nrrms_report;

-- The G1 tables that already exist
GRANT SELECT, INSERT, UPDATE, DELETE ON roles, users, user_roles, saved_passengers TO nrrms_app;
GRANT SELECT ON roles, user_roles, audit_log TO nrrms_report;
-- reports never need password hashes
GRANT SELECT (user_id, email, full_name, created_at) ON users TO nrrms_report;
-- audit rows are written only by fn_audit() (SECURITY DEFINER); the API role cannot touch them
REVOKE ALL ON audit_log FROM nrrms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nrrms_app;
