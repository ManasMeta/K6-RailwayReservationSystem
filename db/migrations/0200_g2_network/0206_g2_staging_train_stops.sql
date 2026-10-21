-- Author: G2 database (Shambhavi, Sanskar)
-- Raw landing table for Train_details_22122017.csv. Everything is text because
-- the file is Latin-1 with padded values; import_train_details() cleans it.
CREATE TABLE IF NOT EXISTS staging_train_stops (
    train_no TEXT,
    train_name TEXT,
    seq TEXT,
    station_code TEXT,
    station_name TEXT,
    arrival TEXT,
    departure TEXT,
    distance TEXT,
    source_station_code TEXT,
    source_station_name TEXT,
    destination_station_code TEXT,
    destination_station_name TEXT
);
