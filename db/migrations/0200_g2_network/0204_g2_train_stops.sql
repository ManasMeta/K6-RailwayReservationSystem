-- Author: G2 database (Shambhavi, Sanskar)
-- day_offset: whole days between the train's origin departure date and the day
-- the train ARRIVES at this stop (origin = 0). It is derived on import because
-- the CSV only has times of day.
-- arrival_minute / departure_minute: minutes since 00:00 of the origin day.
-- They are generated columns, so journey time arithmetic never repeats the
-- maths. A halt that crosses midnight (departure earlier than arrival) adds
-- one day to the departure.
CREATE TABLE IF NOT EXISTS train_stops (
    train_id BIGINT NOT NULL REFERENCES trains(train_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL CHECK (seq >= 1),
    station_id BIGINT NOT NULL REFERENCES stations(station_id),
    arrival TIME,
    departure TIME,
    day_offset SMALLINT NOT NULL DEFAULT 0 CHECK (day_offset >= 0),
    distance_km INTEGER NOT NULL DEFAULT 0 CHECK (distance_km >= 0),
    arrival_minute INTEGER GENERATED ALWAYS AS (
        CASE WHEN arrival IS NULL THEN NULL
        ELSE day_offset * 1440
             + EXTRACT(HOUR FROM arrival)::INTEGER * 60
             + EXTRACT(MINUTE FROM arrival)::INTEGER
        END
    ) STORED,
    departure_minute INTEGER GENERATED ALWAYS AS (
        CASE WHEN departure IS NULL THEN NULL
        ELSE day_offset * 1440
             + EXTRACT(HOUR FROM departure)::INTEGER * 60
             + EXTRACT(MINUTE FROM departure)::INTEGER
             + CASE WHEN arrival IS NOT NULL AND departure < arrival
                    THEN 1440 ELSE 0 END
        END
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (train_id, seq),
    CHECK (arrival IS NOT NULL OR departure IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ix_train_stops_station
    ON train_stops (station_id, train_id, seq);
