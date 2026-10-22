-- Author: G3 database (Manas)
-- Physical coaches generated from train_consist.

CREATE TABLE IF NOT EXISTS coaches (
    coach_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    train_id BIGINT NOT NULL REFERENCES trains(train_id) ON DELETE CASCADE,
    coach_code VARCHAR(10) NOT NULL,
    class_code VARCHAR(5) NOT NULL REFERENCES travel_classes(class_code),
    total_berths INT NOT NULL CHECK (total_berths > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_train_coach UNIQUE (train_id, coach_code)
);

CREATE INDEX IF NOT EXISTS ix_coaches_train_class ON coaches (train_id, class_code);
