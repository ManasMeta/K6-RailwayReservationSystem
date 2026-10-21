-- EXPLAIN ANALYZE for station autocomplete, before and after the trigram index.
-- Pads stations up to the real size (8,151), then rolls everything back:
--   psql "$DATABASE_URL" -f db/import/g2_explain_demo.sql
BEGIN;

INSERT INTO stations (station_code, name)
SELECT 'ZZ' || lpad(n::TEXT, 5, '0'),
       'DEMO ' || md5(n::TEXT) || ' JN'
FROM generate_series(1, 8151) AS n
ON CONFLICT DO NOTHING;
ANALYZE stations;

\echo '--- BEFORE: no trigram index'
DROP INDEX ix_stations_name_trgm;
DROP INDEX ix_stations_code_trgm;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
SELECT station_code, name FROM stations WHERE name ILIKE '%kanp%' ORDER BY similarity(name, 'kanp') DESC LIMIT 10;

\echo '--- AFTER: GIN gin_trgm_ops index'
CREATE INDEX ix_stations_name_trgm ON stations USING gin (name gin_trgm_ops);
CREATE INDEX ix_stations_code_trgm ON stations USING gin (station_code gin_trgm_ops);
ANALYZE stations;
SET LOCAL enable_seqscan = off;  -- the table is small; force the planner to show the index path
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
SELECT station_code, name FROM stations WHERE name ILIKE '%kanp%' ORDER BY similarity(name, 'kanp') DESC LIMIT 10;

ROLLBACK;
