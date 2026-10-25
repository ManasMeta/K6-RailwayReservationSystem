-- Author: G3 backend & database (Manas)
-- Fare calculation function adhering to Indian Railway fare rules.
-- Returns table with base, reservation_fee, superfast, tatkal, concession, gst, total.

CREATE OR REPLACE FUNCTION calculate_fare(
    p_train_id BIGINT,
    p_from_seq INT,
    p_to_seq INT,
    p_class_code VARCHAR(5),
    p_quota_code VARCHAR(5) DEFAULT 'GN',
    p_concession_code VARCHAR(30) DEFAULT 'GENERAL'
)
RETURNS TABLE (
    distance_km INT,
    base NUMERIC(10,2),
    reservation_fee NUMERIC(10,2),
    superfast NUMERIC(10,2),
    tatkal NUMERIC(10,2),
    concession NUMERIC(10,2),
    gst NUMERIC(10,2),
    total NUMERIC(10,2)
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_dist INT;
    v_has_ac BOOLEAN;
    v_base_fare NUMERIC(10,2) := 0.00;
    v_min_km INT := 0;
    v_per_km_rate NUMERIC(10,4) := 0.00;
    v_res_fee NUMERIC(10,2) := 20.00;
    v_sf_fee NUMERIC(10,2) := 30.00;
    v_tatkal_charge NUMERIC(10,2) := 0.00;
    v_tatkal_min NUMERIC(10,2) := 100.00;
    v_tatkal_max NUMERIC(10,2) := 500.00;
    v_tatkal_pct NUMERIC(5,2) := 30.00;
    v_disc_pct NUMERIC(5,2) := 0.00;
    v_calc_base NUMERIC(10,2);
    v_calc_concession NUMERIC(10,2);
    v_calc_subtotal NUMERIC(10,2);
    v_calc_gst NUMERIC(10,2);
    v_calc_total NUMERIC(10,2);
BEGIN
    -- 1. Compute distance between boarding and alighting stops
    SELECT ABS(t2.distance_km - t1.distance_km)
    INTO v_dist
    FROM train_stops t1
    JOIN train_stops t2 ON t2.train_id = t1.train_id
    WHERE t1.train_id = p_train_id AND t1.seq = p_from_seq
      AND t2.train_id = p_train_id AND t2.seq = p_to_seq;

    IF v_dist IS NULL OR v_dist <= 0 THEN
        v_dist := 100; -- Fallback nominal distance if timetable distances missing
    END IF;

    -- 2. AC status check
    SELECT has_ac INTO v_has_ac FROM travel_classes WHERE class_code = p_class_code;
    IF v_has_ac IS NULL THEN
        v_has_ac := false;
    END IF;

    -- 3. Lookup fare slab
    SELECT 
        s.base_fare, s.min_km, s.per_km_rate, 
        s.reservation_fee, s.superfast_charge,
        s.tatkal_min_charge, s.tatkal_max_charge, s.tatkal_pct
    INTO 
        v_base_fare, v_min_km, v_per_km_rate,
        v_res_fee, v_sf_fee,
        v_tatkal_min, v_tatkal_max, v_tatkal_pct
    FROM fare_slabs s
    WHERE s.class_code = p_class_code
      AND v_dist >= s.min_km AND v_dist <= s.max_km
    LIMIT 1;

    IF NOT FOUND THEN
        -- Fallback to default class rates if exact slab is missing
        v_base_fare := 150.00;
        v_per_km_rate := 0.50;
    END IF;

    -- Base fare computation
    v_calc_base := ROUND(v_base_fare + ((v_dist - v_min_km) * v_per_km_rate), 2);

    -- 4. Concession computation
    SELECT discount_pct INTO v_disc_pct
    FROM concession_rules
    WHERE concession_code = p_concession_code;

    IF v_disc_pct IS NULL THEN
        v_disc_pct := 0.00;
    END IF;

    v_calc_concession := ROUND(v_calc_base * (v_disc_pct / 100.0), 2);

    -- 5. Tatkal surcharge computation
    IF p_quota_code = 'TQ' THEN
        v_tatkal_charge := ROUND(v_calc_base * (v_tatkal_pct / 100.0), 2);
        IF v_tatkal_charge < v_tatkal_min THEN
            v_tatkal_charge := v_tatkal_min;
        ELSIF v_tatkal_charge > v_tatkal_max THEN
            v_tatkal_charge := v_tatkal_max;
        END IF;
    ELSE
        v_tatkal_charge := 0.00;
    END IF;

    -- 6. GST computation (5% for AC travel classes)
    v_calc_subtotal := (v_calc_base - v_calc_concession) + v_res_fee + v_sf_fee + v_tatkal_charge;
    IF v_has_ac THEN
        v_calc_gst := ROUND(v_calc_subtotal * 0.05, 2);
    ELSE
        v_calc_gst := 0.00;
    END IF;

    -- 7. Total rounded to nearest integer / 2 decimals
    v_calc_total := ROUND(v_calc_subtotal + v_calc_gst, 2);

    RETURN QUERY SELECT 
        v_dist,
        v_calc_base,
        v_res_fee,
        v_sf_fee,
        v_tatkal_charge,
        v_calc_concession,
        v_calc_gst,
        v_calc_total;
END;
$$;
