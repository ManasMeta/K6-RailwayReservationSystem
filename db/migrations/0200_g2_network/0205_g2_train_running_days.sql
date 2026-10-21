-- Author: G2 database (Shambhavi, Sanskar)
-- weekday uses ISO numbering (1 = Monday ... 7 = Sunday) of the day the train
-- leaves its ORIGIN. The CSV has no running days, so import adds all 7 days
-- for each new train; staff may then delete rows.
CREATE TABLE IF NOT EXISTS train_running_days (
    train_id BIGINT NOT NULL REFERENCES trains(train_id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (train_id, weekday)
);
