-- Author: G3 database (Manas)
-- Train consist (rake composition: how many coaches of each class belong to a train).

CREATE TABLE IF NOT EXISTS train_consist (
    consist_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    train_id BIGINT NOT NULL REFERENCES trains(train_id) ON DELETE CASCADE,
    class_code VARCHAR(5) NOT NULL REFERENCES travel_classes(class_code),
    coach_count INT NOT NULL CHECK (coach_count > 0),
    seq_start INT NOT NULL DEFAULT 1 CHECK (seq_start >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_train_class_consist UNIQUE (train_id, class_code)
);
