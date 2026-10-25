-- Author: G3 database (Manas)
-- Travel classes master table.
-- Standard Indian Railway class codes: 1A, 2A, 3A, SL, CC, 2S, etc.

CREATE TABLE IF NOT EXISTS travel_classes (
    class_code VARCHAR(5) PRIMARY KEY,
    name TEXT NOT NULL,
    base_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    has_ac BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default travel classes
INSERT INTO travel_classes (class_code, name, base_multiplier, has_ac) VALUES
    ('1A', 'AC First Class', 3.50, true),
    ('2A', 'AC 2 Tier', 2.30, true),
    ('3A', 'AC 3 Tier', 1.60, true),
    ('CC', 'AC Chair Car', 1.40, true),
    ('SL', 'Sleeper', 1.00, false),
    ('2S', 'Second Sitting', 0.60, false)
ON CONFLICT (class_code) DO UPDATE
SET name = EXCLUDED.name,
    base_multiplier = EXCLUDED.base_multiplier,
    has_ac = EXCLUDED.has_ac;
