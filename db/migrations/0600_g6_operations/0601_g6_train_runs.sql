-- Author: G6-DB (G6 Member 3)
-- Description: train_runs - one row per train per date; holds status, delay and chart flag
CREATE TABLE IF NOT EXISTS train_runs (
    run_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    train_id        BIGINT NOT NULL REFERENCES trains (train_id),
    run_date        DATE   NOT NULL,                      -- date the train leaves its origin
    status          TEXT   NOT NULL DEFAULT 'SCHEDULED'
                    CHECK (status IN ('SCHEDULED', 'DELAYED', 'CANCELLED', 'DEPARTED')),
    delay_minutes   INT    NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
    chart_prepared  BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (train_id, run_date)                           -- one row per train per date
);
