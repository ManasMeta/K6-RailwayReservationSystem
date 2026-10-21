-- Author: G2 database (Shambhavi, Sanskar)
CREATE TABLE IF NOT EXISTS trains (
    train_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    train_no TEXT NOT NULL UNIQUE CHECK (train_no ~ '^[0-9A-Z]+$'),
    name TEXT NOT NULL CHECK (name = btrim(name) AND name <> ''),
    source_station_id BIGINT REFERENCES stations(station_id),
    destination_station_id BIGINT REFERENCES stations(station_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
