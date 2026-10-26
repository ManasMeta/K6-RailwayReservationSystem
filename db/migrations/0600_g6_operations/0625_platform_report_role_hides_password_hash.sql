-- Description: take password hashes back from the reporting role.
--
-- 0624 granted nrrms_report SELECT on every existing table, which includes users and so the
-- password_hash column that 0102 deliberately left out. A table-level REVOKE also removes
-- the column grants, so the columns reports may read are granted again, exactly as in 0102.

REVOKE SELECT ON users FROM nrrms_report;
GRANT SELECT (user_id, email, full_name, created_at) ON users TO nrrms_report;
