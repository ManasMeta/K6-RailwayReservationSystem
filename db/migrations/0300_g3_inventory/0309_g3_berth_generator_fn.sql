-- Author: G3 database (Manas)
-- Berth & Coach generator functions.
-- Generates coaches from consist and berths from standard Indian Railway layout rules.

CREATE OR REPLACE FUNCTION generate_coach_berths(p_coach_id BIGINT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_class_code VARCHAR(5);
    v_total_berths INT;
    v_b INT;
    v_mod INT;
    v_type VARCHAR(5);
    v_count INT := 0;
BEGIN
    SELECT class_code, total_berths INTO v_class_code, v_total_berths
    FROM coaches WHERE coach_id = p_coach_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    FOR v_b IN 1..v_total_berths LOOP
        IF v_class_code IN ('SL', '3A') THEN
            v_mod := v_b % 8;
            IF v_mod IN (1, 4) THEN v_type := 'LB';
            ELSIF v_mod IN (2, 5) THEN v_type := 'MB';
            ELSIF v_mod IN (3, 6) THEN v_type := 'UB';
            ELSIF v_mod = 7 THEN v_type := 'SL';
            ELSE v_type := 'SU';
            END IF;
        ELSIF v_class_code = '2A' THEN
            v_mod := v_b % 6;
            IF v_mod IN (1, 3) THEN v_type := 'LB';
            ELSIF v_mod IN (2, 4) THEN v_type := 'UB';
            ELSIF v_mod = 5 THEN v_type := 'SL';
            ELSE v_type := 'SU';
            END IF;
        ELSIF v_class_code = '1A' THEN
            v_mod := v_b % 2;
            IF v_mod = 1 THEN v_type := 'LB';
            ELSE v_type := 'UB';
            END IF;
        ELSIF v_class_code = 'CC' THEN
            v_mod := v_b % 5;
            IF v_mod IN (1, 0) THEN v_type := 'WS';
            ELSIF v_mod = 2 THEN v_type := 'MS';
            ELSE v_type := 'AS';
            END IF;
        ELSE
            v_type := 'WS';
        END IF;

        INSERT INTO berths (coach_id, berth_number, berth_type)
        VALUES (p_coach_id, v_b, v_type)
        ON CONFLICT (coach_id, berth_number) DO NOTHING;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION generate_train_consist_coaches(p_train_id BIGINT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    r RECORD;
    v_c INT;
    v_coach_code VARCHAR(10);
    v_coach_id BIGINT;
    v_total_berths INT;
    v_coaches_created INT := 0;
BEGIN
    -- If train_consist is not populated for this train, provide default composition:
    -- 2 x 2A, 4 x 3A, 6 x SL
    IF NOT EXISTS (SELECT 1 FROM train_consist WHERE train_id = p_train_id) THEN
        INSERT INTO train_consist (train_id, class_code, coach_count, seq_start) VALUES
            (p_train_id, '2A', 2, 1),
            (p_train_id, '3A', 4, 1),
            (p_train_id, 'SL', 6, 1)
        ON CONFLICT (train_id, class_code) DO NOTHING;
    END IF;

    FOR r IN (SELECT class_code, coach_count, seq_start FROM train_consist WHERE train_id = p_train_id ORDER BY class_code) LOOP
        IF r.class_code = 'SL' THEN
            v_total_berths := 72;
        ELSIF r.class_code = '3A' THEN
            v_total_berths := 64;
        ELSIF r.class_code = '2A' THEN
            v_total_berths := 48;
        ELSIF r.class_code = '1A' THEN
            v_total_berths := 24;
        ELSIF r.class_code = 'CC' THEN
            v_total_berths := 75;
        ELSE
            v_total_berths := 60;
        END IF;

        FOR v_c IN 1..r.coach_count LOOP
            IF r.class_code = 'SL' THEN v_coach_code := 'S' || v_c::TEXT;
            ELSIF r.class_code = '3A' THEN v_coach_code := 'B' || v_c::TEXT;
            ELSIF r.class_code = '2A' THEN v_coach_code := 'A' || v_c::TEXT;
            ELSIF r.class_code = '1A' THEN v_coach_code := 'H' || v_c::TEXT;
            ELSIF r.class_code = 'CC' THEN v_coach_code := 'C' || v_c::TEXT;
            ELSE v_coach_code := 'D' || v_c::TEXT;
            END IF;

            INSERT INTO coaches (train_id, coach_code, class_code, total_berths)
            VALUES (p_train_id, v_coach_code, r.class_code, v_total_berths)
            ON CONFLICT (train_id, coach_code) DO UPDATE
            SET total_berths = EXCLUDED.total_berths
            RETURNING coach_id INTO v_coach_id;

            PERFORM generate_coach_berths(v_coach_id);
            v_coaches_created := v_coaches_created + 1;
        END LOOP;
    END LOOP;

    RETURN v_coaches_created;
END;
$$;
