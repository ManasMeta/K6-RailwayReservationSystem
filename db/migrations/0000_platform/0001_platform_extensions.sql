-- Author: Platform Team (G1)
-- Description: Enable core PostgreSQL extensions required by NRRMS

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
