-- Author: G2 database (Shambhavi, Sanskar)
CREATE TABLE IF NOT EXISTS stations (
    station_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    station_code TEXT NOT NULL UNIQUE
        CHECK (station_code = upper(btrim(station_code)) AND station_code <> ''),
    name TEXT NOT NULL CHECK (name = btrim(name) AND name <> ''),
    zone_id BIGINT REFERENCES zones(zone_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_stations_zone_id ON stations (zone_id);
