-- Author: G3 database (Manas)
-- Distance-based fare slabs and ancillary charges per travel class.

CREATE TABLE IF NOT EXISTS fare_slabs (
    slab_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_code VARCHAR(5) NOT NULL REFERENCES travel_classes(class_code) ON DELETE CASCADE,
    min_km INT NOT NULL CHECK (min_km >= 0),
    max_km INT NOT NULL CHECK (max_km > min_km),
    base_fare NUMERIC(10,2) NOT NULL CHECK (base_fare >= 0),
    per_km_rate NUMERIC(10,4) NOT NULL CHECK (per_km_rate >= 0),
    reservation_fee NUMERIC(10,2) NOT NULL DEFAULT 20.00,
    superfast_charge NUMERIC(10,2) NOT NULL DEFAULT 30.00,
    tatkal_min_charge NUMERIC(10,2) NOT NULL DEFAULT 100.00,
    tatkal_max_charge NUMERIC(10,2) NOT NULL DEFAULT 500.00,
    tatkal_pct NUMERIC(5,2) NOT NULL DEFAULT 30.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_class_km UNIQUE (class_code, min_km, max_km)
);

-- Seed default fare slabs for Indian Railway classes
INSERT INTO fare_slabs 
(class_code, min_km, max_km, base_fare, per_km_rate, reservation_fee, superfast_charge, tatkal_min_charge, tatkal_max_charge, tatkal_pct)
VALUES
    -- Sleeper (SL)
    ('SL', 0, 300, 120.00, 0.4500, 20.00, 30.00, 100.00, 200.00, 10.00),
    ('SL', 301, 1000, 255.00, 0.4000, 20.00, 30.00, 100.00, 200.00, 10.00),
    ('SL', 1001, 5000, 535.00, 0.3500, 20.00, 30.00, 100.00, 200.00, 10.00),

    -- AC 3 Tier (3A)
    ('3A', 0, 300, 450.00, 1.2500, 40.00, 45.00, 300.00, 400.00, 30.00),
    ('3A', 301, 1000, 825.00, 1.1500, 40.00, 45.00, 300.00, 400.00, 30.00),
    ('3A', 1001, 5000, 1630.00, 1.0500, 40.00, 45.00, 300.00, 400.00, 30.00),

    -- AC 2 Tier (2A)
    ('2A', 0, 300, 680.00, 1.8000, 50.00, 45.00, 400.00, 500.00, 30.00),
    ('2A', 301, 1000, 1220.00, 1.6500, 50.00, 45.00, 400.00, 500.00, 30.00),
    ('2A', 1001, 5000, 2375.00, 1.5000, 50.00, 45.00, 400.00, 500.00, 30.00),

    -- AC First Class (1A)
    ('1A', 0, 300, 1150.00, 2.9000, 60.00, 75.00, 400.00, 500.00, 30.00),
    ('1A', 301, 1000, 2020.00, 2.7000, 60.00, 75.00, 400.00, 500.00, 30.00),
    ('1A', 1001, 5000, 3910.00, 2.5000, 60.00, 75.00, 400.00, 500.00, 30.00),

    -- AC Chair Car (CC)
    ('CC', 0, 300, 350.00, 1.1000, 40.00, 45.00, 125.00, 225.00, 30.00),
    ('CC', 301, 1000, 680.00, 0.9500, 40.00, 45.00, 125.00, 225.00, 30.00),
    ('CC', 1001, 5000, 1345.00, 0.8500, 40.00, 45.00, 125.00, 225.00, 30.00),

    -- Second Sitting (2S)
    ('2S', 0, 300, 60.00, 0.2500, 15.00, 15.00, 10.00, 15.00, 10.00),
    ('2S', 301, 1000, 135.00, 0.2000, 15.00, 15.00, 10.00, 15.00, 10.00),
    ('2S', 1001, 5000, 275.00, 0.1800, 15.00, 15.00, 10.00, 15.00, 10.00)
ON CONFLICT (class_code, min_km, max_km) DO UPDATE
SET base_fare = EXCLUDED.base_fare,
    per_km_rate = EXCLUDED.per_km_rate;
