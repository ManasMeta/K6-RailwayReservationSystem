-- Author: G3 database (Manas)
-- Individual physical berths / seats in a coach.

CREATE TABLE IF NOT EXISTS berths (
    berth_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    coach_id BIGINT NOT NULL REFERENCES coaches(coach_id) ON DELETE CASCADE,
    berth_number INT NOT NULL CHECK (berth_number >= 1),
    berth_type VARCHAR(5) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_coach_berth_num UNIQUE (coach_id, berth_number)
);

CREATE INDEX IF NOT EXISTS ix_berths_coach ON berths (coach_id);
