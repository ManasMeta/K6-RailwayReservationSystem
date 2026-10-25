-- Author: G3 database (Manas)
-- Concession rules table for discount calculation.

CREATE TABLE IF NOT EXISTS concession_rules (
    rule_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    concession_code VARCHAR(30) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (discount_pct >= 0 AND discount_pct <= 100),
    min_age INT,
    max_age INT,
    gender VARCHAR(1) CHECK (gender IN ('M', 'F', 'T')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed standard concession rules
INSERT INTO concession_rules (concession_code, description, discount_pct, min_age, max_age, gender) VALUES
    ('GENERAL', 'Standard Fare (No concession)', 0.00, NULL, NULL, NULL),
    ('SENIOR_MALE', 'Senior Citizen Male (40% concession)', 40.00, 60, NULL, 'M'),
    ('SENIOR_FEMALE', 'Senior Citizen Female (50% concession)', 50.00, 58, NULL, 'F'),
    ('CHILD', 'Child under 5 years (Free/No berth)', 100.00, 0, 4, NULL),
    ('STUDENT', 'Student Concession (50% concession in Sleeper/2S)', 50.00, 12, 25, NULL)
ON CONFLICT (concession_code) DO UPDATE
SET description = EXCLUDED.description,
    discount_pct = EXCLUDED.discount_pct,
    min_age = EXCLUDED.min_age,
    max_age = EXCLUDED.max_age,
    gender = EXCLUDED.gender;
