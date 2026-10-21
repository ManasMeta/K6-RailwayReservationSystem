-- Author: G2 database (Shambhavi, Sanskar)
-- Station autocomplete: ILIKE '%del%' and similarity (%) use these GIN
-- indexes. See docs/g2-database-design.md for EXPLAIN ANALYZE before/after.
CREATE INDEX IF NOT EXISTS ix_stations_name_trgm
    ON stations USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_stations_code_trgm
    ON stations USING gin (station_code gin_trgm_ops);
