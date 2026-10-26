-- Description: give the API and reporting roles the privileges they need on objects that
-- already existed before migration 0102 set its default privileges.
--
-- ALTER DEFAULT PRIVILEGES (0102) only applies to objects created after it runs. A database
-- first migrated before 0102 was in the migration set keeps every table from that earlier run
-- with no grants, so the API fails with "permission denied". A fresh database already gets
-- these through the defaults, and GRANT is idempotent, so re-granting is a no-op there.
--
-- The same privileges the defaults give: nrrms_app reads and writes tables, reads views, and
-- uses sequences; nrrms_report reads everything. audit_log stays closed to nrrms_app (see 0102).

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nrrms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nrrms_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO nrrms_report;
REVOKE ALL ON audit_log FROM nrrms_app;
