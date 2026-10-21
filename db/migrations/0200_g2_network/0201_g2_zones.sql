-- Author: G2 database (Shambhavi, Sanskar)
-- G2 depends only on extensions from 0000_platform (G1); pg_trgm is also
-- created here with IF NOT EXISTS so G2 applies on a fresh database.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS zones (
    zone_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    zone_code TEXT NOT NULL UNIQUE
        CHECK (zone_code = upper(btrim(zone_code)) AND zone_code <> ''),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
