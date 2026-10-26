-- Author: G2 Member 3 (Database)
-- Description: Rail network schema (zones, stations, trains, train_stops, train_running_days)

CREATE TABLE IF NOT EXISTS zones (
    zone_code VARCHAR(10) PRIMARY KEY,
    zone_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stations (
    station_code VARCHAR(10) PRIMARY KEY,
    name TEXT NOT NULL,
    zone_code VARCHAR(10) REFERENCES zones(zone_code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stations_name_trgm ON stations USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS trains (
    train_no VARCHAR(10) PRIMARY KEY,
    name TEXT NOT NULL,
    train_type VARCHAR(20) NOT NULL,
    is_ac BOOLEAN NOT NULL DEFAULT false,
    source_station_code VARCHAR(10) REFERENCES stations(station_code),
    dest_station_code VARCHAR(10) REFERENCES stations(station_code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS train_stops (
    train_no VARCHAR(10) NOT NULL REFERENCES trains(train_no) ON DELETE CASCADE,
    seq INT NOT NULL,
    station_code VARCHAR(10) NOT NULL REFERENCES stations(station_code),
    arrival TIME,
    departure TIME,
    day_offset INT NOT NULL DEFAULT 0,
    distance_km NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (train_no, seq)
);

CREATE TABLE IF NOT EXISTS train_running_days (
    train_no VARCHAR(10) NOT NULL REFERENCES trains(train_no) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    PRIMARY KEY (train_no, day_of_week)
);
