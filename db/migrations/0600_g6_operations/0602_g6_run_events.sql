-- Author: G6-DB (G6 Member 3)
-- Description: run_events - log of what staff (or triggers) did to a run
CREATE TABLE IF NOT EXISTS run_events (
    event_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id         BIGINT NOT NULL REFERENCES train_runs (run_id),
    event_type     TEXT   NOT NULL,                           -- DELAY, CANCEL, CHART, ...
    station_id     BIGINT REFERENCES stations (station_id),   -- may be empty
    delay_minutes  INT,
    notes          TEXT,
    recorded_by    BIGINT REFERENCES users (user_id),         -- empty when written by a trigger
    recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_run_events_run ON run_events (run_id, recorded_at);
