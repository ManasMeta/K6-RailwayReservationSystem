-- Author: G6-DB (G6 Member 3)
-- Description: chart_entries - one row per passenger on the final chart
CREATE TABLE IF NOT EXISTS chart_entries (
    entry_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chart_id      BIGINT NOT NULL REFERENCES charts (chart_id),
    passenger_id  BIGINT NOT NULL REFERENCES reservation_passengers (passenger_id),
    coach_code    TEXT,
    berth_no      INT,
    berth_type    TEXT,
    quota_code    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (chart_id, passenger_id)                       -- a passenger appears once per chart
);
CREATE INDEX IF NOT EXISTS idx_chart_entries_chart ON chart_entries (chart_id);
