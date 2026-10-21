-- Author: G3 Member 3 (Database)
-- Description: Inventory & Fares schema (travel_classes, quotas, concession_rules, fare_slabs, coaches, berths, berth_allocations, free_berths)

CREATE TABLE IF NOT EXISTS travel_classes (
    class_code VARCHAR(5) PRIMARY KEY,
    class_name TEXT NOT NULL,
    is_ac BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO travel_classes (class_code, class_name, is_ac) VALUES
    ('1A', 'First AC', true),
    ('2A', 'AC 2-Tier', true),
    ('3A', 'AC 3-Tier', true),
    ('3E', 'AC 3 Economy', true),
    ('CC', 'AC Chair Car', true),
    ('EC', 'Executive Chair Car', true),
    ('SL', 'Sleeper Class', false),
    ('2S', 'Second Sitting', false)
ON CONFLICT (class_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS quotas (
    quota_code VARCHAR(5) PRIMARY KEY,
    quota_name TEXT NOT NULL
);

INSERT INTO quotas (quota_code, quota_name) VALUES
    ('GN', 'General'),
    ('TQ', 'Tatkal'),
    ('PT', 'Premium Tatkal'),
    ('LD', 'Ladies'),
    ('SS', 'Senior Citizen')
ON CONFLICT (quota_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS concession_rules (
    rule_id INT PRIMARY KEY,
    category TEXT NOT NULL,
    discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00
);

INSERT INTO concession_rules (rule_id, category, discount_pct) VALUES
    (1, 'General', 0.00),
    (2, 'Senior Citizen Male', 40.00),
    (3, 'Senior Citizen Female', 50.00),
    (4, 'Student', 50.00),
    (5, 'Divyangjan', 75.00)
ON CONFLICT (rule_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS fare_slabs (
    slab_id INT PRIMARY KEY,
    class_code VARCHAR(5) NOT NULL REFERENCES travel_classes(class_code),
    min_km INT NOT NULL,
    max_km INT NOT NULL,
    base_fare NUMERIC(10,2) NOT NULL
);

INSERT INTO fare_slabs (slab_id, class_code, min_km, max_km, base_fare) VALUES
    (1, 'SL', 1, 500, 350.00),
    (2, 'SL', 501, 1500, 650.00),
    (3, '3A', 1, 500, 950.00),
    (4, '3A', 501, 1500, 1650.00),
    (5, '2A', 1, 500, 1400.00),
    (6, '2A', 501, 1500, 2400.00),
    (7, '1A', 1, 500, 2200.00),
    (8, '1A', 501, 1500, 3800.00),
    (9, 'CC', 1, 500, 750.00),
    (10, 'CC', 501, 1500, 1350.00)
ON CONFLICT (slab_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS coaches (
    coach_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    train_no VARCHAR(10) NOT NULL REFERENCES trains(train_no) ON DELETE CASCADE,
    coach_code VARCHAR(10) NOT NULL,
    class_code VARCHAR(5) NOT NULL REFERENCES travel_classes(class_code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (train_no, coach_code)
);

CREATE TABLE IF NOT EXISTS berths (
    berth_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    coach_id BIGINT NOT NULL REFERENCES coaches(coach_id) ON DELETE CASCADE,
    berth_number INT NOT NULL,
    berth_type VARCHAR(10) NOT NULL, -- LB, MB, UB, SL, SU, WS, AS
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (coach_id, berth_number)
);

CREATE TABLE IF NOT EXISTS berth_allocations (
    allocation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- passenger_id (FK) is added later by G4's migration 0401
    berth_id BIGINT NOT NULL REFERENCES berths(berth_id) ON DELETE CASCADE,
    run_date DATE NOT NULL,
    stops INT4RANGE NOT NULL,
    EXCLUDE USING gist (berth_id WITH =, run_date WITH =, stops WITH &&)
);

CREATE OR REPLACE FUNCTION free_berths(
    p_train_no VARCHAR(10),
    p_run_date DATE,
    p_from_seq INT,
    p_to_seq INT,
    p_class_code VARCHAR(5)
)
RETURNS TABLE (
    berth_id BIGINT,
    coach_id BIGINT,
    coach_code VARCHAR(10),
    berth_number INT,
    berth_type VARCHAR(10),
    class_code VARCHAR(5)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.berth_id,
        c.coach_id,
        c.coach_code,
        b.berth_number,
        b.berth_type,
        c.class_code
    FROM berths b
    JOIN coaches c ON b.coach_id = c.coach_id
    WHERE c.train_no = p_train_no
      AND c.class_code = p_class_code
      AND NOT EXISTS (
          SELECT 1
          FROM berth_allocations ba
          WHERE ba.berth_id = b.berth_id
            AND ba.run_date = p_run_date
            AND ba.stops && int4range(p_from_seq, p_to_seq, '[)')
      )
    ORDER BY c.coach_code, b.berth_number;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION calculate_fare(
    p_train_no VARCHAR(10),
    p_class_code VARCHAR(5),
    p_quota_code VARCHAR(5),
    p_from_seq INT,
    p_to_seq INT,
    p_concession_rule_id INT DEFAULT 1
)
RETURNS TABLE (
    base NUMERIC(10,2),
    reservation_fee NUMERIC(10,2),
    superfast NUMERIC(10,2),
    tatkal NUMERIC(10,2),
    concession NUMERIC(10,2),
    gst NUMERIC(10,2),
    total NUMERIC(10,2)
) AS $$
DECLARE
    v_distance NUMERIC(8,2) := 0;
    v_base NUMERIC(10,2) := 500.00;
    v_res_fee NUMERIC(10,2) := 40.00;
    v_superfast NUMERIC(10,2) := 30.00;
    v_tatkal NUMERIC(10,2) := 0.00;
    v_discount_pct NUMERIC(5,2) := 0.00;
    v_concession NUMERIC(10,2) := 0.00;
    v_gst NUMERIC(10,2) := 0.00;
    v_total NUMERIC(10,2) := 0.00;
    v_is_ac BOOLEAN := false;
BEGIN
    SELECT COALESCE(MAX(distance_km) - MIN(distance_km), 300)
    INTO v_distance
    FROM train_stops
    WHERE train_no = p_train_no AND seq BETWEEN p_from_seq AND p_to_seq;

    SELECT COALESCE(fs.base_fare, 500.00)
    INTO v_base
    FROM fare_slabs fs
    WHERE fs.class_code = p_class_code
      AND v_distance BETWEEN fs.min_km AND fs.max_km
    LIMIT 1;

    SELECT is_ac INTO v_is_ac FROM travel_classes WHERE class_code = p_class_code;

    IF p_quota_code = 'TQ' THEN
        v_tatkal := CASE
            WHEN p_class_code IN ('1A', '2A', 'EC') THEN 400.00
            WHEN p_class_code IN ('3A', '3E', 'CC') THEN 300.00
            ELSE 150.00
        END;
    END IF;

    SELECT discount_pct INTO v_discount_pct FROM concession_rules WHERE rule_id = p_concession_rule_id;
    IF v_discount_pct > 0 THEN
        v_concession := ROUND((v_base * v_discount_pct / 100.0), 2);
    END IF;

    IF v_is_ac THEN
        v_gst := ROUND(((v_base - v_concession + v_res_fee + v_superfast + v_tatkal) * 0.05), 2);
    END IF;

    v_total := (v_base - v_concession) + v_res_fee + v_superfast + v_tatkal + v_gst;

    RETURN QUERY SELECT v_base, v_res_fee, v_superfast, v_tatkal, v_concession, v_gst, v_total;
END;
$$ LANGUAGE plpgsql STABLE;
